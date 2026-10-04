'use strict';
// Companion-maandquotum op SQLite: X vragen per gebruiker per kalendermaand
// (YYYY-MM, UTC — zelfde venster als de Netlify-functie). Gebruikt door server.js.

const monthKey = (d = new Date()) => d.toISOString().slice(0, 7); // 'YYYY-MM'

function ensureTable(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS companion_usage (
    user_id INTEGER NOT NULL,
    month TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, month)
  )`);
  // Bijgekochte extra vragen (vervallen niet per maand) + verwerkte Stripe-sessies.
  db.exec(`CREATE TABLE IF NOT EXISTS companion_extra (
    user_id INTEGER PRIMARY KEY,
    credits INTEGER NOT NULL DEFAULT 0
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS companion_topups (
    session_id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL
  )`);
}

// Hoeveel vragen deze maand al gesteld zijn.
function monthCount(db, userId) {
  return db.prepare('SELECT count FROM companion_usage WHERE user_id = ? AND month = ?')
    .get(userId, monthKey())?.count || 0;
}

// Nog beschikbare bijgekochte vragen.
function extraCredits(db, userId) {
  return db.prepare('SELECT credits FROM companion_extra WHERE user_id = ?').get(userId)?.credits || 0;
}

// Bijkoop boeken; idempotent per Stripe-sessie (dubbel bevestigen telt één keer).
function addTopup(db, userId, sessionId, n) {
  const r = db.prepare('INSERT OR IGNORE INTO companion_topups (session_id, user_id) VALUES (?, ?)').run(sessionId, userId);
  if (r.changes) db.prepare(`INSERT INTO companion_extra (user_id, credits) VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET credits = credits + excluded.credits`).run(userId, n);
  return extraCredits(db, userId);
}

// Teller +1 na een gelukte Companion-beurt; nieuwe maand begint vanzelf op 0.
// Is de maandlimiet al bereikt, dan gaat er een bijgekochte vraag af.
function bump(db, userId, limit = Infinity) {
  if (monthCount(db, userId) >= limit && extraCredits(db, userId) > 0) {
    db.prepare('UPDATE companion_extra SET credits = credits - 1 WHERE user_id = ?').run(userId);
    return;
  }
  db.prepare(`INSERT INTO companion_usage (user_id, month, count) VALUES (?, ?, 1)
    ON CONFLICT(user_id, month) DO UPDATE SET count = count + 1`)
    .run(userId, monthKey());
}

module.exports = { monthKey, ensureTable, monthCount, bump, extraCredits, addTopup };

// Zelf-check (in-memory, geen server nodig): node --experimental-sqlite lib/companion-quota.js
if (require.main === module) {
  const assert = require('node:assert');
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(':memory:');
  ensureTable(db);
  assert.strictEqual(monthKey(new Date('2026-08-08T12:00:00Z')), '2026-08');
  assert.strictEqual(monthCount(db, 1), 0, 'nieuwe gebruiker begint op 0');
  bump(db, 1); bump(db, 1);
  assert.strictEqual(monthCount(db, 1), 2, 'teller loopt op');
  assert.strictEqual(monthCount(db, 2), 0, 'per gebruiker gescheiden');
  // Maandwissel: oude maand telt niet mee in de nieuwe.
  db.prepare('UPDATE companion_usage SET month = ? WHERE user_id = ?').run('2020-01', 1);
  assert.strictEqual(monthCount(db, 1), 0, 'nieuwe maand reset naar 0');
  const LIMIT = 10;
  for (let i = 0; i < LIMIT; i++) bump(db, 3);
  assert.ok(monthCount(db, 3) >= LIMIT, 'limietgrens bereikt na 10 beurten');
  // Bijkoop: idempotent per sessie, pas verbruikt na de maandlimiet.
  assert.strictEqual(addTopup(db, 3, 'cs_1', 5), 5);
  assert.strictEqual(addTopup(db, 3, 'cs_1', 5), 5, 'zelfde sessie telt één keer');
  bump(db, 3, LIMIT);
  assert.strictEqual(extraCredits(db, 3), 4, 'extra vraag gaat af na de limiet');
  assert.strictEqual(monthCount(db, 3), LIMIT, 'maandteller blijft staan');
  addTopup(db, 4, 'cs_2', 5); bump(db, 4, LIMIT);
  assert.strictEqual(extraCredits(db, 4), 5, 'onder de limiet: extra blijft onaangeroerd');
  assert.strictEqual(monthCount(db, 4), 1);
  db.prepare('UPDATE companion_usage SET month = ? WHERE user_id = ?').run('2020-01', 3);
  assert.strictEqual(extraCredits(db, 3), 4, 'extra vervalt niet bij maandwissel');
  console.log('ok');
}

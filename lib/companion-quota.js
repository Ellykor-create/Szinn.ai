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
}

// Hoeveel vragen deze maand al gesteld zijn.
function monthCount(db, userId) {
  return db.prepare('SELECT count FROM companion_usage WHERE user_id = ? AND month = ?')
    .get(userId, monthKey())?.count || 0;
}

// Teller +1 na een gelukte Companion-beurt; nieuwe maand begint vanzelf op 0.
function bump(db, userId) {
  db.prepare(`INSERT INTO companion_usage (user_id, month, count) VALUES (?, ?, 1)
    ON CONFLICT(user_id, month) DO UPDATE SET count = count + 1`)
    .run(userId, monthKey());
}

module.exports = { monthKey, ensureTable, monthCount, bump };

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
  console.log('ok');
}

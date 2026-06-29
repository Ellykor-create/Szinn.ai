const express = require('express');
const session = require('express-session');
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = 3000;
const ROOT = __dirname;

// ── Database ───────────────────────────────────────────────────────────────────
const db = new DatabaseSync(path.join(ROOT, 'szinn.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    email      TEXT UNIQUE NOT NULL,
    password   TEXT NOT NULL,
    name       TEXT NOT NULL,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id                    TEXT PRIMARY KEY,
    user_id               INTEGER NOT NULL,
    type                  TEXT NOT NULL DEFAULT 'personal',
    status                TEXT NOT NULL DEFAULT 'pending',
    client_name           TEXT NOT NULL,
    birth_date            TEXT,
    birth_time            TEXT,
    birth_location        TEXT,
    created_at            TEXT DEFAULT (CURRENT_TIMESTAMP),
    completed_at          TEXT,
    blueprint_url         TEXT,
    alignment_score       INTEGER DEFAULT NULL,
    astro_score           INTEGER DEFAULT NULL,
    numerology_score      INTEGER DEFAULT NULL,
    soul_direction_score  INTEGER DEFAULT NULL,
    personal_year_score   INTEGER DEFAULT NULL
  );

  CREATE TABLE IF NOT EXISTS gift_codes (
    code              TEXT PRIMARY KEY,
    owner_user_id     INTEGER NOT NULL,
    source_order_id   TEXT,
    used_by_user_id   INTEGER DEFAULT NULL,
    used_at           TEXT DEFAULT NULL,
    created_at        TEXT DEFAULT (CURRENT_TIMESTAMP)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    sid    TEXT PRIMARY KEY,
    data   TEXT NOT NULL,
    expiry INTEGER
  );
`);

// Migrate: add score columns if they don't exist
['alignment_score','astro_score','numerology_score','soul_direction_score','personal_year_score'].forEach(col => {
  try { db.exec(`ALTER TABLE orders ADD COLUMN ${col} INTEGER DEFAULT NULL`); } catch {}
});

// ── Seed demo data ─────────────────────────────────────────────────────────────
const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
if (userCount === 0) {
  const addUser  = db.prepare('INSERT INTO users (email, password, name) VALUES (?, ?, ?)');
  const addOrder = db.prepare(`
    INSERT INTO orders (id, user_id, type, status, client_name, birth_date, birth_time, birth_location,
      created_at, completed_at, blueprint_url, alignment_score, astro_score, numerology_score,
      soul_direction_score, personal_year_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const hash = pw => bcrypt.hashSync(pw, 10);

  addUser.run('demo@szinn.ai', hash('szinn2024'), 'Demo gebruiker');
  const u1 = db.prepare('SELECT id FROM users WHERE email = ?').get('demo@szinn.ai').id;

  addUser.run('sara@voorbeeld.nl', hash('szinn2024'), 'Sara Bakker');
  const u2 = db.prepare('SELECT id FROM users WHERE email = ?').get('sara@voorbeeld.nl').id;

  // demo user: 3 orders (one completed with scores)
  addOrder.run('ORD-2026-001', u1, 'personal', 'completed',
    'Sara Emily Thomas', '1990-03-15', '14:30', 'Amsterdam, Netherlands',
    '2026-06-15T10:30:00Z', '2026-06-15T10:33:00Z',
    '/szinn-portal/blueprints/sample-blueprint.html',
    74, 78, 82, 65, 72);
  addOrder.run('ORD-2026-002', u1, 'gift', 'processing',
    'Marc de Vries', '1985-11-22', '08:15', 'Rotterdam, Netherlands',
    '2026-06-20T09:00:00Z', null, null, null, null, null, null, null);
  addOrder.run('ORD-2026-003', u1, 'personal', 'questionnaire',
    'Lisa Jansen', '1993-07-08', null, 'Utrecht, Netherlands',
    '2026-06-22T08:00:00Z', null, null, null, null, null, null, null);

  // Gift code for demo user (from their completed order)
  db.prepare('INSERT INTO gift_codes (code, owner_user_id, source_order_id) VALUES (?, ?, ?)')
    .run('SZINN-DEMO-2026', u1, 'ORD-2026-001');

  // sara user: 1 completed order
  addOrder.run('ORD-2026-004', u2, 'personal', 'completed',
    'Sara Bakker', '1990-03-15', '09:00', 'Den Haag, Netherlands',
    '2026-06-10T08:00:00Z', '2026-06-10T08:05:00Z',
    '/szinn-portal/blueprints/sample-blueprint.html',
    81, 85, 88, 74, 79);

  console.log('\n✓ Demo data aangemaakt:');
  console.log('  demo@szinn.ai     / szinn2024  (3 aanvragen, gift code: SZINN-DEMO-2026)');
  console.log('  sara@voorbeeld.nl / szinn2024  (1 aanvraag)\n');
}

// ── SQLite session store ───────────────────────────────────────────────────────
class SQLiteStore extends session.Store {
  get(sid, cb) {
    try {
      const r = db.prepare('SELECT data, expiry FROM sessions WHERE sid = ?').get(sid);
      if (!r) return cb(null, null);
      if (r.expiry && r.expiry < Date.now()) {
        db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
        return cb(null, null);
      }
      cb(null, JSON.parse(r.data));
    } catch (e) { cb(e); }
  }
  set(sid, s, cb) {
    try {
      const expiry = s.cookie?.expires ? new Date(s.cookie.expires).getTime() : Date.now() + 7*86400000;
      db.prepare('INSERT OR REPLACE INTO sessions (sid, data, expiry) VALUES (?, ?, ?)')
        .run(sid, JSON.stringify(s), expiry);
      cb(null);
    } catch (e) { cb(e); }
  }
  destroy(sid, cb) {
    try { db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid); cb(null); }
    catch (e) { cb(e); }
  }
}

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  store: new SQLiteStore(),
  secret: 'szinn-local-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7*86400000 }
}));
app.use(express.static(ROOT));

// ── Auth ──────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email en wachtwoord zijn verplicht' });
  const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email.trim());
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Onjuist e-mailadres of wachtwoord' });
  req.session.userId = user.id;
  res.json({ id: user.id, email: user.email, name: user.name, initials: user.name.substring(0,2).toUpperCase() });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Niet ingelogd' });
  const user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Gebruiker niet gevonden' });
  res.json({ ...user, initials: user.name.substring(0,2).toUpperCase() });
});

// ── Orders ────────────────────────────────────────────────────────────────────
function toOrder(o) {
  return {
    id: o.id, type: o.type, status: o.status,
    clientName: o.client_name, birthDate: o.birth_date,
    birthTime: o.birth_time, birthLocation: o.birth_location,
    createdAt: o.created_at, completedAt: o.completed_at,
    blueprintUrl: o.blueprint_url,
    scores: (o.alignment_score != null) ? {
      alignment: o.alignment_score, astro: o.astro_score,
      numerology: o.numerology_score, soulDirection: o.soul_direction_score,
      personalYear: o.personal_year_score
    } : null
  };
}

app.get('/api/orders', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Niet ingelogd' });
  const rows = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.session.userId);
  res.json(rows.map(toOrder));
});

app.get('/api/orders/:id', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Niet ingelogd' });
  const row = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
  if (!row) return res.status(404).json({ error: 'Aanvraag niet gevonden' });
  res.json(toOrder(row));
});

// ── Gift codes ────────────────────────────────────────────────────────────────
app.get('/api/gift/codes', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Niet ingelogd' });
  const codes = db.prepare('SELECT * FROM gift_codes WHERE owner_user_id = ? ORDER BY created_at DESC').all(req.session.userId);
  res.json(codes);
});

app.post('/api/gift/generate', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Niet ingelogd' });
  // Max 3 unused codes per user
  const unused = db.prepare('SELECT COUNT(*) AS n FROM gift_codes WHERE owner_user_id = ? AND used_by_user_id IS NULL').get(req.session.userId).n;
  if (unused >= 3) return res.status(400).json({ error: 'Je hebt al 3 beschikbare codes. Gebruik of deel bestaande codes eerst.' });
  const part = crypto.randomBytes(3).toString('hex').toUpperCase();
  const code = `SZINN-${part.slice(0,4)}-${part.slice(4,8)}`;
  db.prepare('INSERT INTO gift_codes (code, owner_user_id) VALUES (?, ?)').run(code, req.session.userId);
  res.json({ code });
});

// ── AI Companion ──────────────────────────────────────────────────────────────
app.post('/api/companion/chat', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Niet ingelogd' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.json({
      content: 'De AI Companion is beschikbaar zodra een ANTHROPIC_API_KEY is geconfigureerd. Start de server met: ANTHROPIC_API_KEY=sk-... npm start'
    });
  }

  const { messages, orderId } = req.body;
  if (!messages?.length) return res.status(400).json({ error: 'Geen berichten' });

  // Build context from user's blueprint
  let blueprintContext = '';
  if (orderId) {
    const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(orderId, req.session.userId);
    if (order?.scores) {
      blueprintContext = `\n\nBlueprint context: ${order.client_name}, geboren ${order.birth_date}. Scores: Alignment ${order.alignment_score}%, Astrologie ${order.astro_score}%, Numerologie ${order.numerology_score}%, Soul Direction ${order.soul_direction_score}%, Personal Year ${order.personal_year_score}%.`;
    }
  }

  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic.default({ apiKey });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: `Je bent de SZINN AI Companion — een warm, helder en praktisch begeleider die SZINN Blueprint gebruikers helpt hun document te begrijpen en toe te passen. Je toon is uitnodigend, nooit oordelend. Je spreekt de gebruiker aan met 'jij' en 'jouw'. Geen new-age clichés. Geen bullet points. Schrijf in vloeiende zinnen. Geef concrete, persoonlijke antwoorden.${blueprintContext}`,
      messages: messages.map(m => ({ role: m.role, content: m.content }))
    });

    res.json({ content: response.content[0].text });
  } catch (err) {
    console.error('Companion API error:', err.message);
    res.status(500).json({ error: 'De AI Companion is tijdelijk niet beschikbaar.' });
  }
});

// ── Book order (placeholder) ──────────────────────────────────────────────────
app.post('/api/book/order', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Niet ingelogd' });
  // TODO: connect to Stripe/Plug&Pay checkout
  res.json({ checkoutUrl: 'https://szinn.ai/boek' });
});

// ── Static fallback ────────────────────────────────────────────────────────────
app.get('*', (req, res, next) => {
  const htmlFile = path.join(ROOT, req.path, 'index.html');
  if (fs.existsSync(htmlFile)) return res.sendFile(htmlFile);
  next();
});

app.listen(PORT, () => {
  console.log(`\n🌿 SZINN lokale server: http://localhost:${PORT}`);
  console.log(`   Portal:  http://localhost:${PORT}/szinn-portal/pages/login.html`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('\n   ⚠ AI Companion: stel ANTHROPIC_API_KEY in voor volledig gebruik');
    console.log('   Start via: ANTHROPIC_API_KEY=sk-... npm start\n');
  }
});

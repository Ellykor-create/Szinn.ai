// Lokaal: lees .env in (o.a. COMPANION_API_KEY). No-op op Netlify/Railway,
// waar env-vars uit het dashboard komen en er geen .env-bestand staat.
try { process.loadEnvFile(); } catch {}

const express = require('express');
const session = require('express-session');
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { sendGiftEmail, sendGiftConfirmationEmail } = require('./lib/email');

const app = express();
const PORT = process.env.PORT || 301;
const ROOT = __dirname;

// DATA_DIR: writable persistent directory (set to /data on Railway with volume)
const DATA_DIR = process.env.DATA_DIR || ROOT;
if (DATA_DIR !== ROOT) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── Database ───────────────────────────────────────────────────────────────────
const db = new DatabaseSync(path.join(DATA_DIR, 'szinn.db'));

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

// Migrate: add columns if they don't exist
['alignment_score','astro_score','numerology_score','soul_direction_score','personal_year_score'].forEach(col => {
  try { db.exec(`ALTER TABLE orders ADD COLUMN ${col} INTEGER DEFAULT NULL`); } catch {}
});
try { db.exec(`ALTER TABLE orders ADD COLUMN intake_data TEXT DEFAULT NULL`); } catch {}
try { db.exec(`ALTER TABLE orders ADD COLUMN birth_lat REAL DEFAULT NULL`); } catch {}
try { db.exec(`ALTER TABLE orders ADD COLUMN birth_lng REAL DEFAULT NULL`); } catch {}
try { db.exec(`ALTER TABLE orders ADD COLUMN birth_tz TEXT DEFAULT NULL`); } catch {}
try { db.exec(`ALTER TABLE orders ADD COLUMN full_birth_name TEXT DEFAULT NULL`); } catch {}
try { db.exec(`ALTER TABLE orders ADD COLUMN blueprint_language TEXT DEFAULT 'nl'`); } catch {}
try { db.exec(`ALTER TABLE orders ADD COLUMN blueprint_html TEXT DEFAULT NULL`); } catch {}
try { db.exec(`ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0`); } catch {}
// Telefoonnummer voor de dagelijkse WhatsApp-reading (kaal internationaal, bv. 31612345678).
try { db.exec(`ALTER TABLE users ADD COLUMN phone TEXT DEFAULT NULL`); } catch {}
// Companion-geheugen per account: { memory, messages, turns } als JSON.
db.exec(`CREATE TABLE IF NOT EXISTS companion_state (
  user_id INTEGER PRIMARY KEY,
  state TEXT NOT NULL,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
)`);
// Companion-quotum: aantal vragen per gebruiker per kalendermaand (YYYY-MM, UTC).
const companionQuota = require('./lib/companion-quota');
companionQuota.ensureTable(db);
// Dagboek: dagstart/dagafsluiting per gebruiker per dag ({ morning, evening } als JSON).
db.exec(`CREATE TABLE IF NOT EXISTS journal_entries (
  user_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (user_id, date)
)`);
// Intake-betaalpoort: welke Stripe checkout-sessies al een intake opleverden
// (één intake per betaling) en wanneer een cadeaucode is verzilverd.
db.exec(`CREATE TABLE IF NOT EXISTS used_checkout_sessions (
  sid TEXT PRIMARY KEY,
  order_id TEXT,
  used_at TEXT DEFAULT (CURRENT_TIMESTAMP)
)`);
try { db.exec(`ALTER TABLE gift_codes ADD COLUMN redeemed_at TEXT DEFAULT NULL`); } catch {}
try { db.exec(`ALTER TABLE gift_codes ADD COLUMN redeemed_order TEXT DEFAULT NULL`); } catch {}
// Abonnement €3,69/mnd: compacte Stripe-samenvatting als JSON per gebruiker.
try { db.exec(`ALTER TABLE users ADD COLUMN subscription TEXT DEFAULT NULL`); } catch {}
// Meldingsvoorkeur: 'whatsapp' | 'email' | 'off'. Default 'off' zodat niemand
// ongevraagd berichten krijgt; de gebruiker kiest expliciet in zijn instellingen.
try { db.exec(`ALTER TABLE users ADD COLUMN notify_channel TEXT DEFAULT 'off'`); } catch {}
// Admin-overrides: dashboard-toegang ('on'/'off', NULL = automatisch via
// proef/abonnement) en een eenmalige gratis nieuwe intake (blueprint-heractivering).
try { db.exec(`ALTER TABLE users ADD COLUMN dashboard_access TEXT DEFAULT NULL`); } catch {}
try { db.exec(`ALTER TABLE users ADD COLUMN intake_grant INTEGER DEFAULT 0`); } catch {}
// Onraadbaar deel-/kijktoken per order. Zo staat het volgnummer (ORD-…) nooit
// in een URL en kan niemand door een nummer te raden andermans blueprint openen.
try { db.exec(`ALTER TABLE orders ADD COLUMN view_token TEXT`); } catch {}
// Cadeau-velden op gift_codes (ontvanger, bericht, verzenddatum, status).
['recipient_email TEXT','recipient_name TEXT','message TEXT','send_date TEXT','lang TEXT DEFAULT \'nl\'',
 'status TEXT DEFAULT \'draft\'','sent_at TEXT','paid INTEGER DEFAULT 0'].forEach(coldef => {
  try { db.exec(`ALTER TABLE gift_codes ADD COLUMN ${coldef}`); } catch {}
});

// Beheerder-instellingen (o.a. de prompt-aanscherping), key/value.
db.exec(`CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TEXT
);`);

// Feedback vanaf /feedback (NL) en /en/feedback (EN); zichtbaar in het admin-dashboard.
db.exec(`CREATE TABLE IF NOT EXISTS feedback (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  name       TEXT,
  email      TEXT,
  rating     INTEGER,
  message    TEXT NOT NULL,
  lang       TEXT DEFAULT 'nl'
);`);

// ── Admin-account ───────────────────────────────────────────────────────────────
// Zorgt dat er altijd één admin-account in de database staat (idempotent).
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@szinn.ai').trim().toLowerCase();
(function ensureAdmin() {
  const adminPw = process.env.ADMIN_PASSWORD || 'szinn-admin';
  if (db.prepare('SELECT id FROM users WHERE is_admin = 1').get()) return;
  const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(ADMIN_EMAIL);
  if (existing) {
    db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(existing.id);
  } else {
    db.prepare('INSERT INTO users (email, password, name, is_admin) VALUES (?, ?, ?, 1)')
      .run(ADMIN_EMAIL, bcrypt.hashSync(adminPw, 10), 'Admin');
  }
  console.log(`✓ Admin-account klaar: ${ADMIN_EMAIL}`);
})();

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

// ── Volledig gevuld demo-account ───────────────────────────────────────────────
// Een account waarvan het dashboard NIET op "coming soon" staat: een voltooide
// blueprint mét intake-data en teksten (Barry uit lib/demo-blueprint), zodat alle
// blokken zich vullen. Idempotent: draait elke start, maakt niets dubbel.
(function ensureFullDemo() {
  try {
    const demo   = require('./lib/demo-blueprint');
    const email  = 'demo-plus@szinn.ai';
    const orderId = 'ORD-DEMO-VOL';

    let u = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
    if (!u) {
      db.prepare('INSERT INTO users (email, password, name) VALUES (?, ?, ?)')
        .run(email, bcrypt.hashSync('szinn2024', 10), demo.intake.clientName);
      u = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
    }

    if (!db.prepare('SELECT id FROM orders WHERE id = ?').get(orderId)) {
      db.prepare(`INSERT INTO orders
        (id, user_id, type, status, client_name, birth_date, birth_time, birth_location,
         created_at, completed_at, blueprint_url, blueprint_language, full_birth_name, intake_data,
         birth_lat, birth_lng, birth_tz,
         alignment_score, astro_score, numerology_score, soul_direction_score, personal_year_score)
        VALUES (?, ?, 'personal', 'completed', ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, 'nl', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(orderId, u.id, demo.intake.clientName, demo.intake.birthDate, demo.intake.birthTime,
          `${demo.intake.birthCity}, ${demo.intake.birthCountry}`,
          '/szinn-portal/blueprints/sample-blueprint.html', demo.intake.birthName,
          JSON.stringify(demo.intake.raw || {}), demo.intake.lat, demo.intake.lng, demo.intake.tz,
          78, 80, 82, 70, 74);
    }

    // Teksten op schijf zodat de companion-endpoint ze lokaal kan lezen
    const dir = path.join(DATA_DIR, 'blueprints');
    fs.mkdirSync(dir, { recursive: true });
    const tf = path.join(dir, `${orderId}.texts.json`);
    if (!fs.existsSync(tf)) fs.writeFileSync(tf, JSON.stringify({ orderId, nl: demo.texts, en: demo.texts }), 'utf8');

    console.log(`✓ Volledig demo-account klaar: ${email} / szinn2024`);
  } catch (e) { console.error('Volledig demo-account kon niet worden aangemaakt:', e.message); }
})();

// ── View-tokens backfillen ─────────────────────────────────────────────────────
// Geef elke bestaande order zonder token een onraadbaar token, zodat alle
// blueprint-links via ?t=<token> lopen i.p.v. via het volgnummer.
(function backfillViewTokens() {
  const rows = db.prepare('SELECT id FROM orders WHERE view_token IS NULL OR view_token = ?').all('');
  if (!rows.length) return;
  const upd = db.prepare('UPDATE orders SET view_token = ? WHERE id = ?');
  for (const r of rows) upd.run(crypto.randomBytes(16).toString('hex'), r.id);
  console.log(`✓ ${rows.length} view-token(s) toegekend aan bestaande orders`);
})();

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
// CORS for live domain
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (origin && (allowed.includes(origin) || allowed.includes('*'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  store: new SQLiteStore(),
  secret: 'szinn-local-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7*86400000 }
}));
// Serve blueprints: filesystem first (local), then DB column (production).
// upgradeNav() zet het burgermenu in oudere blueprints die nog zonder zijn
// gerenderd, zodat de navigatie ook op mobiel binnen beeld blijft.
app.get('/szinn-portal/blueprints/:filename', (req, res, next) => {
  const filename = req.params.filename;
  const { upgradeNav } = require('./lib/blueprint-nav');
  // Try filesystem (local dev or DATA_DIR)
  for (const dir of [
    path.join(ROOT, 'szinn-portal', 'blueprints'),
    path.join(DATA_DIR, 'blueprints')
  ]) {
    const fp = path.join(dir, filename);
    if (fs.existsSync(fp)) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(upgradeNav(fs.readFileSync(fp, 'utf8')));
    }
  }
  // Fallback to DB (Railway production without persistent volume)
  const orderId = filename.replace(/\.html$/, '');
  const row = db.prepare('SELECT blueprint_html FROM orders WHERE id = ?').get(orderId);
  if (row?.blueprint_html) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(upgradeNav(row.blueprint_html));
  }
  next();
});

// ── Schone URL's (geen .html) ─────────────────────────────────────────────────
// Vaste, nette aliassen naar de portal- en cadeaupagina's.
const PAGE_ALIASES = {
  '/portaal': 'szinn-portal/pages/dashboard.html',
  '/portaal/inloggen': 'szinn-portal/pages/login.html',
  '/portaal/vragenlijst': 'szinn-portal/pages/questionnaire.html',
  '/portaal/blueprint': 'szinn-portal/pages/blueprint-viewer.html',
  '/portaal/mandala': 'szinn-portal/pages/mandala.html',
  '/cadeau': 'szinn-portal/pages/gift.html',
};
app.get(Object.keys(PAGE_ALIASES), (req, res) => {
  res.sendFile(path.join(ROOT, PAGE_ALIASES[req.path]));
});
// Cadeau verzilveren → intake (met eventuele code).
app.get('/cadeau/verzilveren', (req, res) => {
  const code = req.query.code ? `?code=${encodeURIComponent(String(req.query.code))}` : '';
  res.redirect(302, `/intake${code}`);
});
// Elke .html-pagina 301 naar de schone variant (blueprint-bestanden uitgezonderd).
app.use((req, res, next) => {
  if (req.method === 'GET' && req.path.endsWith('.html') && !req.path.startsWith('/szinn-portal/blueprints/')) {
    let clean = req.path.replace(/\.html$/, '').replace(/\/index$/, '') || '/';
    const map = {
      '/szinn-portal/pages/dashboard': '/portaal',
      '/szinn-portal/pages/login': '/portaal/inloggen',
      '/szinn-portal/pages/questionnaire': '/portaal/vragenlijst',
      '/szinn-portal/pages/blueprint-viewer': '/portaal/blueprint',
      '/szinn-portal/pages/mandala': '/portaal/mandala',
      '/szinn-portal/pages/gift': '/cadeau',
    };
    if (map[clean]) clean = map[clean];
    const qs = req.originalUrl.slice(req.path.length); // behoud ?query
    return res.redirect(301, clean + qs);
  }
  next();
});

app.use(express.static(ROOT));

// ── Auth ──────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const en = req.body?.lang === 'en';
  if (!email || !password) return res.status(400).json({ error: en ? 'Email and password are required' : 'Email en wachtwoord zijn verplicht' });
  const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email.trim());
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: en ? 'Incorrect email address or password' : 'Onjuist e-mailadres of wachtwoord' });
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

// ── Meldingsvoorkeur (WhatsApp / e-mail / uit) ────────────────────────────────
// Het nummer wordt voorgevuld met wat al in de database staat (users.phone);
// de gebruiker hoeft het maar één keer in te vullen.
app.get('/api/settings/notifications', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Niet ingelogd' });
  const u = db.prepare('SELECT email, phone, notify_channel FROM users WHERE id = ?').get(req.session.userId);
  if (!u) return res.status(401).json({ error: 'Gebruiker niet gevonden' });
  res.json({ channel: u.notify_channel || 'off', phone: u.phone || '', email: u.email });
});

app.post('/api/settings/notifications', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Niet ingelogd' });
  const channel = String(req.body.channel || '').trim();
  if (!['whatsapp', 'email', 'off'].includes(channel))
    return res.status(400).json({ error: 'Ongeldige keuze' });
  // Kaal internationaal nummer: alleen cijfers, bv. 31612345678.
  const phone = String(req.body.phone || '').replace(/[^\d]/g, '');
  if (channel === 'whatsapp' && phone.length < 8)
    return res.status(400).json({ error: 'Vul een geldig telefoonnummer in (met landcode, bijv. 316…)' });
  db.prepare('UPDATE users SET notify_channel = ?, phone = ? WHERE id = ?')
    .run(channel, phone || null, req.session.userId);
  res.json({ ok: true, channel, phone });
});

// ── Orders ────────────────────────────────────────────────────────────────────
function toOrder(o) {
  return {
    id: o.id, type: o.type, status: o.status,
    viewToken: o.view_token,
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

// Resolve op onraadbaar view_token (nieuw) óf op het volgnummer (backward
// compat), altijd binnen de eigen account. Zo kan niemand met een geraden
// nummer andermans blueprint openen.
function findOwnOrder(idOrToken, userId) {
  return db.prepare('SELECT * FROM orders WHERE (view_token = ? OR id = ?) AND user_id = ?')
    .get(idOrToken, idOrToken, userId);
}

app.get('/api/orders/:id', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Niet ingelogd' });
  const row = findOwnOrder(req.params.id, req.session.userId);
  if (!row) return res.status(404).json({ error: 'Aanvraag niet gevonden' });
  res.json(toOrder(row));
});

// Directe PDF-download: rendert de blueprint-HTML on-the-fly naar een print-PDF
// met alle kleuren (printBackground) en ingesloten afbeeldingen.
app.get('/api/orders/:id/pdf', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Niet ingelogd' });
  const row = findOwnOrder(req.params.id, req.session.userId);
  if (!row) return res.status(404).json({ error: 'Aanvraag niet gevonden' });

  // Bron van de HTML: bij voorkeur het opgeslagen bestand op blueprint_url,
  // anders de in de db bewaarde HTML.
  let html = null;
  if (row.blueprint_url) {
    const file = path.join(ROOT, row.blueprint_url.replace(/^\//, '').split('?')[0]);
    try { if (fs.existsSync(file)) html = fs.readFileSync(file, 'utf8'); } catch {}
  }
  if (!html && row.blueprint_html) html = row.blueprint_html;
  if (!html) return res.status(404).json({ error: 'Blueprint nog niet beschikbaar' });

  try {
    const { upgradeNav } = require('./lib/blueprint-nav');
    const { generatePDF } = require('./lib/pdf');
    const pdf = await generatePDF(upgradeNav(html));
    const name = (row.client_name || 'SZINN').replace(/[^\w\-]+/g, '-');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="SZINN-Blueprint-${name}.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error('PDF-generatie mislukt:', err.message);
    res.status(500).json({ error: `De PDF kon niet worden gemaakt: ${err.message}` });
  }
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

// ── Cadeau-flow: betaling → ontvanger + verzenddatum → (ingeplande) mail ──────
// Betaling: nu een mock (bouw-nu-koppel-Stripe-later). Zodra STRIPE_SECRET_KEY
// bestaat, maak hier een Stripe Checkout Session en geef session.url terug.
const GIFT_PRICE_EUR = process.env.GIFT_PRICE_EUR || '39,90';
const GIFT_PRICE_CENTS = parseInt(process.env.GIFT_PRICE_CENTS || '3990', 10);

function newGiftCode() {
  const part = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `SZINN-${part.slice(0, 4)}-${part.slice(4, 8)}`;
}

// Echte betaling verifiëren: sessie is betaald, hoort bij dit account en is nog niet gebruikt.
async function verifyGiftPayment(sid, userId) {
  if (!sid) return false;
  if (db.prepare('SELECT sid FROM used_checkout_sessions WHERE sid = ?').get(sid)) return false;
  try {
    const s = await stripeReq('GET', `/checkout/sessions/${encodeURIComponent(sid)}`);
    return s.payment_status === 'paid' && String(s.client_reference_id) === String(userId);
  } catch (e) { console.error('cadeaubetaling verifiëren mislukt:', e.message); return false; }
}

app.post('/api/gift/checkout', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Niet ingelogd' });
  if (stripeConfigured()) {
    const user = db.prepare('SELECT email FROM users WHERE id = ?').get(req.session.userId);
    const baseUrl = process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
    try {
      const session = await createGiftCheckout({ email: user?.email, userId: req.session.userId, baseUrl, priceCents: GIFT_PRICE_CENTS });
      return res.json({ url: session.url });
    } catch (e) {
      console.error('cadeau-checkout mislukt:', e.message);
      return res.status(500).json({ error: 'Kon de betaalpagina niet openen. Probeer het later opnieuw.' });
    }
  }
  // Geen sleutel (lokaal/test): mock-betaling. De front-end simuleert de betaalstap.
  res.json({ mock: true, price: GIFT_PRICE_EUR, paidToken: 'mock-' + crypto.randomBytes(6).toString('hex') });
});

// Datum in "vandaag of later" (YYYY-MM-DD). Leeg/vandaag = direct versturen.
function isTodayOrPast(dateStr) {
  if (!dateStr) return true;
  const today = new Date().toISOString().slice(0, 10);
  return dateStr <= today;
}

app.post('/api/gift/create', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Niet ingelogd' });
  const { recipientEmail, recipientName, message, sendDate, lang, paidToken } = req.body || {};

  if (stripeConfigured()) {
    if (!(await verifyGiftPayment(paidToken, req.session.userId)))
      return res.status(402).json({ error: 'Betaling niet bevestigd.' });
  } else if (!String(paidToken || '').startsWith('mock-')) {
    return res.status(402).json({ error: 'Betaling niet bevestigd.' });
  }
  if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail))
    return res.status(400).json({ error: 'Vul een geldig e-mailadres van de ontvanger in.' });
  if (sendDate && !/^\d{4}-\d{2}-\d{2}$/.test(sendDate))
    return res.status(400).json({ error: 'Ongeldige verzenddatum.' });

  const language = lang === 'en' ? 'en' : 'nl';
  const sender = db.prepare('SELECT name, email FROM users WHERE id = ?').get(req.session.userId);
  const code = newGiftCode();
  const sendNow = isTodayOrPast(sendDate);
  const status = sendNow ? 'sending' : 'pending';

  db.prepare(`INSERT INTO gift_codes
    (code, owner_user_id, recipient_email, recipient_name, message, send_date, lang, status, paid)
    VALUES (?,?,?,?,?,?,?,?,1)`).run(
    code, req.session.userId, recipientEmail.trim(),
    (recipientName || '').trim() || null, (message || '').trim() || null,
    sendDate || null, language, status
  );
  // Echte betaalsessie eenmalig markeren zodat dezelfde betaling geen tweede cadeau oplevert.
  if (stripeConfigured() && paidToken)
    db.prepare('INSERT OR IGNORE INTO used_checkout_sessions (sid, order_id) VALUES (?, ?)').run(paidToken, code);

  if (sendNow) {
    try {
      await sendGiftEmail({ to: recipientEmail.trim(), recipientName, senderName: sender?.name, giftCode: code, personalMessage: message, lang: language });
      db.prepare(`UPDATE gift_codes SET status='sent', sent_at=CURRENT_TIMESTAMP WHERE code=?`).run(code);
    } catch (err) {
      console.error('cadeau-mail mislukt:', err.message);
      db.prepare(`UPDATE gift_codes SET status='pending' WHERE code=?`).run(code);
    }
  }
  // Bevestiging aan de gever (best effort).
  if (sender?.email) {
    sendGiftConfirmationEmail({ to: sender.email, senderName: sender.name, recipientEmail: recipientEmail.trim(), sendDate: sendNow ? 'now' : sendDate, giftCode: code, lang: language })
      .catch(e => console.error('cadeau-bevestiging mislukt:', e.message));
  }

  res.json({ ok: true, code, scheduled: !sendNow, sendDate: sendNow ? null : sendDate });
});

// Verwerkt ingeplande cadeaus waarvan de verzenddatum bereikt is.
async function processScheduledGifts() {
  const today = new Date().toISOString().slice(0, 10);
  const due = db.prepare(`SELECT * FROM gift_codes WHERE status='pending' AND (send_date IS NULL OR send_date <= ?)`).all(today);
  for (const g of due) {
    try {
      const sender = db.prepare('SELECT name FROM users WHERE id = ?').get(g.owner_user_id);
      await sendGiftEmail({ to: g.recipient_email, recipientName: g.recipient_name, senderName: sender?.name, giftCode: g.code, personalMessage: g.message, lang: g.lang });
      db.prepare(`UPDATE gift_codes SET status='sent', sent_at=CURRENT_TIMESTAMP WHERE code=?`).run(g.code);
      console.log(`✓ Ingepland cadeau verstuurd: ${g.code} → ${g.recipient_email}`);
    } catch (err) {
      console.error(`cadeau ${g.code} versturen mislukt:`, err.message);
    }
  }
}
// Elk uur controleren (en één keer bij de start).
setInterval(() => { processScheduledGifts().catch(e => console.error(e.message)); }, 60 * 60 * 1000);
setTimeout(() => { processScheduledGifts().catch(e => console.error(e.message)); }, 5000);

// ── Dagelijkse WhatsApp-reading (rond 12:00 NL-tijd) ──────────────────────────
// Stuurt elke gebruiker met een voltooide blueprint én telefoonnummer een appje
// dat de dagelijkse reading klaarstaat, met een mini sneak-peek (thema + focus)
// uit dezelfde berekening als het dashboard (cDayFromBlueprint).
async function sendDailyReadings() {
  // Uur in Europe/Amsterdam — server draait mogelijk op UTC, dus niet op lokale tijd vertrouwen.
  const hourNL = Number(new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', hour12: false }).format(new Date()));
  if (hourNL !== 12) return;

  // Eén keer per dag: dedupe op datum via de settings-tabel.
  const today = new Date().toISOString().slice(0, 10);
  const sent = db.prepare(`SELECT value FROM settings WHERE key='daily_wa_sent'`).get();
  if (sent?.value === today) return;
  db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('daily_wa_sent', ?, CURRENT_TIMESTAMP)
              ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`).run(today);

  const { sendWhatsApp } = require('./lib/whatsapp');
  const { sendDailyReadingEmail } = require('./lib/email');
  // Alleen wie 'whatsapp' of 'email' als voorkeur koos; 'off' krijgt niets.
  const recipients = db.prepare(`
    SELECT DISTINCT u.id, u.name, u.email, u.phone, u.notify_channel, u.created_at FROM users u
    JOIN orders o ON o.user_id = u.id
    WHERE o.status='completed' AND u.notify_channel IN ('whatsapp','email')`).all();

  const TRIAL_DAYS = parseInt(process.env.TRIAL_DAYS || '11', 10);
  for (const u of recipients) {
    try {
      // Reminders horen bij dashboard-toegang: lopend abonnement óf 11-daagse
      // proef (demo-accounts uitgezonderd).
      const inTrial = u.created_at && (Date.now() - new Date(u.created_at).getTime()) / 86400000 < TRIAL_DAYS;
      if (stripeConfigured() && !DEMO_SUB_EMAILS.includes(u.email.toLowerCase())
          && !subIsActive(await userSubscription(u.id)) && !inTrial) continue;
      const c = companionContext(u.id);
      if (!c.order || c.order.status !== 'completed') continue;
      const day = cDayFromBlueprint(c);
      const firstName = (u.name || '').trim().split(/\s+/)[0] || (c.lang === 'en' ? 'there' : 'daar');
      if (u.notify_channel === 'whatsapp') {
        if (!u.phone) continue; // WhatsApp gekozen maar geen nummer → overslaan
        await sendWhatsApp({ to: u.phone, lang: c.lang, params: [firstName, day.thema, day.focus] });
        console.log(`✓ Dagelijkse reading-app verstuurd → ${u.phone}`);
      } else {
        await sendDailyReadingEmail({ to: u.email, name: u.name, theme: day.thema, focus: day.focus, lang: c.lang });
        console.log(`✓ Dagelijkse reading-mail verstuurd → ${u.email}`);
      }
    } catch (err) {
      console.error(`Dagelijkse reading voor user ${u.id} mislukt:`, err.message);
    }
  }
}
// Elk uur checken; alleen het tikje in het 12e uur (NL) verstuurt. ponytail: uur-resolutie
// (niet klok-uitgelijnd op 12:00 sharp) volstaat voor een dagelijks appje.
setInterval(() => { sendDailyReadings().catch(e => console.error(e.message)); }, 60 * 60 * 1000);
setTimeout(() => { sendDailyReadings().catch(e => console.error(e.message)); }, 8000);

// ── Companion-dashboarddata (pariteit met de live Netlify-functie) ────────────
// Levert alle blokdata voor het dashboard: laag 1 (berekend) + laag 2 (teksten).
// Teksten worden lokaal van schijf gelezen (DATA_DIR/blueprints/<id>.texts.json);
// ontbreken ze, dan valt de dagduiding terug op vaste teksten.
function readLocalTexts(orderId, lang) {
  try {
    const f = path.join(DATA_DIR, 'blueprints', `${orderId}.texts.json`);
    if (!fs.existsSync(f)) return null;
    const all = JSON.parse(fs.readFileSync(f, 'utf8'));
    return all[lang] || all.nl || null;
  } catch { return null; }
}

function companionContext(userId, langOverride) {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  const order = orders.find(o => o.status === 'completed') || orders[0] || null;
  if (!order || order.status !== 'completed') return { order };

  const lang = langOverride === 'en' ? 'en'
    : langOverride === 'nl' ? 'nl'
    : (order.blueprint_language === 'en' ? 'en' : 'nl');
  const texts = readLocalTexts(order.id, lang);

  const { buildContext } = require('./lib/pipeline');
  const { calcPersonalMonths, calcPersonalDay, DAY_INFO } = require('./lib/numerology');
  const { currentSky } = require('./lib/astro');

  const ctx = buildContext(order);
  const now = new Date();
  const pm = calcPersonalMonths(order.birth_date, now, 1)[0];
  const pd = calcPersonalDay(pm.number, now.getDate());
  const sky = currentSky(now);

  const [, bm, bd] = order.birth_date.split('-').map(Number);
  let solar = new Date(now.getFullYear(), bm - 1, bd);
  if (solar < now) solar = new Date(now.getFullYear() + 1, bm - 1, bd);

  return { order, ctx, texts, lang, now, pm, pd, sky, solar, dayInfo: DAY_INFO };
}

function cFmtPos(p) {
  return p && p.sign !== '?'
    ? { sign: p.sign, signEn: p.signEn, deg: p.deg, min: p.min, house: p.house || null, retro: !!p.retrograde }
    : null;
}
const C_SIGN_EN = {
  Ram: 'Aries', Stier: 'Taurus', Tweelingen: 'Gemini', Kreeft: 'Cancer',
  Leeuw: 'Leo', Maagd: 'Virgo', Weegschaal: 'Libra', Schorpioen: 'Scorpio',
  Boogschutter: 'Sagittarius', Steenbok: 'Capricorn', Waterman: 'Aquarius', Vissen: 'Pisces',
};
const cSignT = (lang, s) => (lang === 'en' ? (C_SIGN_EN[s] || s) : s);
const C_DAY_INFO_EN = {
  1: 'Day 1 carries a new beginning. Take the initiative yourself today.',
  2: 'Day 2 asks for patience and cooperation. Listen and attune.',
  3: 'Day 3 carries expression and joy. Share what lives inside you.',
  4: 'Day 4 carries ground and structure. Build, organise, finish.',
  5: 'Day 5 brings movement and change. Leave room for the unexpected.',
  6: 'Day 6 is about care and harmony. Give attention to your people and your home.',
  7: 'Day 7 asks for depth and stillness. Turn inward for a moment.',
  8: 'Day 8 carries decisiveness and form. Act, complete.',
  9: 'Day 9 closes. Let go of what is finished and be gentle.',
  11: 'Master day 11: heightened intuition. Follow your feeling before you reason it away.',
  22: 'Master day 22: build concretely on your greatest vision today.',
};
const C_PY_INFO_EN = {
  1: { theme: 'New beginning',        energy: 'sowing, starting, choosing direction, taking initiative' },
  2: { theme: 'Cooperation',          energy: 'patience, deepening relationships, listening, receiving' },
  3: { theme: 'Expression & Joy',     energy: 'creativity, visibility, communicating, playing' },
  4: { theme: 'Building & Structure', energy: 'hard work, laying foundations, discipline, order' },
  5: { theme: 'Change',               energy: 'freedom, movement, new experiences, letting go' },
  6: { theme: 'Responsibility',       energy: 'home, care, balance, relationships, being of service' },
  7: { theme: 'Inner year',           energy: 'reflection, study, rest, spiritual deepening' },
  8: { theme: 'Harvest & Power',      energy: 'material matters, business, reaping results, leadership' },
  9: { theme: 'Completion & Release', energy: 'rounding off, forgiving, making room for the new' },
};
const C_LP_INFO_EN = {
  1:{name:'Leader & Pioneer',challenge:'self-centredness'}, 2:{name:'Mediator & Partner',challenge:'dependency'},
  3:{name:'Creative Expresser',challenge:'scattering'}, 4:{name:'Builder & Organiser',challenge:'rigidity'},
  5:{name:'Freedom Seeker',challenge:'impatience'}, 6:{name:'Caregiver & Guardian',challenge:'perfectionism'},
  7:{name:'Seeker & Philosopher',challenge:'isolation'}, 8:{name:'Material Master',challenge:'materialism'},
  9:{name:'Humanitarian & Completer',challenge:'difficulty letting go'}, 11:{name:'Spiritual Lightbringer',challenge:'sensitivity'},
  22:{name:'Master Builder',challenge:'perfectionism'}, 33:{name:'Master Teacher',challenge:'self-sacrifice'},
};
function cDayFromBlueprint(c) {
  const t = c.texts || {};
  const en = c.lang === 'en';
  const dayIdx = Math.floor(c.now.getTime() / 86400000);
  const questions = (t.reflection && t.reflection.questions) || [];
  const giftNames = en
    ? ['intuition', 'imagination', 'memory', 'reasoning', 'perception', 'willpower']
    : ['intuïtie', 'verbeeldingskracht', 'geheugen', 'redeneren', 'waarneming', 'wilskracht'];
  const g1 = giftNames[dayIdx % 6], g2 = giftNames[(dayIdx + 2) % 6];
  const natalMoon = c.ctx.chart.planets.moon;
  const py = c.ctx.numerology.personalYear;
  const moonSign = cSignT(c.lang, c.sky.moon.sign);
  const pyInfo = en ? (C_PY_INFO_EN[py] || C_PY_INFO_EN[9]) : c.ctx.numerology.personalYearInfo;
  if (en) return {
    thema: (t.summary && t.summary.oneLiner) || 'Your blueprint as a compass for today',
    focus: (t.integration && t.integration.layers && t.integration.layers.focus) || 'Take one small, concrete step',
    vraag: questions.length ? questions[dayIdx % questions.length] : 'What asks for your attention today?',
    lucht: `The moon is in ${moonSign} today, ${c.sky.waxing ? 'waxing' : 'waning'}. Your own moon is in ${cSignT('en', natalMoon.sign)}: use today's energy without losing your own foundation.`,
    numFocus: C_DAY_INFO_EN[c.pd] || C_DAY_INFO_EN[9],
    numReminder: `Year ${py} asks for ${pyInfo.theme.toLowerCase()}: ${pyInfo.energy.toLowerCase()}.`,
    gaven: `Today ${g1} and ${g2} light up. Lean consciously on these two capacities.`,
  };
  return {
    thema: (t.summary && t.summary.oneLiner) || 'Jouw blueprint als kompas voor vandaag',
    focus: (t.integration && t.integration.layers && t.integration.layers.focus) || 'Zet één kleine, concrete stap',
    vraag: questions.length ? questions[dayIdx % questions.length] : 'Wat vraagt vandaag om jouw aandacht?',
    lucht: `De maan staat vandaag in ${moonSign}, ${c.sky.waxing ? 'wassend' : 'afnemend'}. Jouw eigen maan staat in ${natalMoon.sign}: gebruik de energie van vandaag zonder je eigen basis te verliezen.`,
    numFocus: c.dayInfo[c.pd] || c.dayInfo[9],
    numReminder: `Jaar ${py} vraagt om ${(c.ctx.numerology.personalYearInfo.theme || '').toLowerCase()}: ${(c.ctx.numerology.personalYearInfo.energy || '').toLowerCase()}.`,
    gaven: `Vandaag lichten ${g1} en ${g2} op. Leun bewust op deze twee vermogens.`,
  };
}

app.get('/api/companion/blueprint', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Niet ingelogd' });
  const c = companionContext(req.session.userId, req.query.lang);
  if (!c.order) return res.json({ status: 'none' });
  if (c.order.status !== 'completed') return res.json({ status: c.order.status, orderId: c.order.id, clientName: c.order.client_name });

  const { generateMiniMandalaSVG } = require('./lib/mandala');
  const P = c.ctx.chart.planets;
  const n = c.ctx.numerology;
  const en = c.lang === 'en';

  // De dagelijks veranderende duiding hoort bij het abonnement; de blueprint
  // zelf (eenmalig gekocht) blijft altijd zichtbaar.
  const subscribed = await hasSubscriptionAccess(req);

  res.json({
    subscribed,
    status: 'completed',
    orderId: c.order.id,
    viewToken: c.order.view_token,
    lang: c.lang,
    clientName: c.ctx.intake.clientName,
    firstName: (c.ctx.intake.clientName || '').trim().split(/\s+/)[0],
    birthDate: c.order.birth_date,
    birthTime: c.order.birth_time,
    birthLocation: c.order.birth_location,
    chart: {
      sun: cFmtPos(P.sun), moon: cFmtPos(P.moon), ascendant: cFmtPos(P.ascendant),
      northNode: cFmtPos(P.northNode), southNode: cFmtPos(P.southNode), chiron: cFmtPos(P.chiron),
    },
    numerology: (() => {
      const lp = en ? (C_LP_INFO_EN[n.lifePath] || n.lifePathInfo) : n.lifePathInfo;
      const py = en ? (C_PY_INFO_EN[n.personalYear] || n.personalYearInfo) : n.personalYearInfo;
      return {
        lifePath: n.lifePath, lifePathName: lp.name, lifePathShadow: lp.challenge,
        personalYear: n.personalYear, personalYearTheme: py.theme, personalYearEnergy: py.energy,
        personalMonth: c.pm.number, personalDay: c.pd,
        expression: n.expression, soulUrge: n.soulUrge, personality: n.personality,
      };
    })(),
    sky: {
      moonSign: cSignT(c.lang, c.sky.moon.sign), waxing: c.sky.waxing,
      nextNewMoon: c.sky.nextNewMoon ? { date: c.sky.nextNewMoon.date, sign: cSignT(c.lang, c.sky.nextNewMoon.sign) } : null,
      nextFullMoon: c.sky.nextFullMoon ? { date: c.sky.nextFullMoon.date, sign: cSignT(c.lang, c.sky.nextFullMoon.sign) } : null,
      solarReturn: { date: c.solar, sign: cSignT(c.lang, P.sun.sign) },
    },
    day: subscribed ? cDayFromBlueprint(c) : null,
    texts: c.texts,
    mandala: generateMiniMandalaSVG(c.ctx.chart),
    blueprintUrl: c.order.blueprint_url,
    blueprintLanguages: (() => { try { return JSON.parse(c.order.blueprint_languages); } catch { return ['nl']; } })(),
    pdfAvailable: !!c.order.pdf_available,
  });
});

// ── Dagboek: dagstart & dagafsluiting (kalender + popup in het dashboard) ─────
const { DATE_RE, mergeJournalEntry } = require('./lib/journal');

app.get('/api/journal', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Niet ingelogd' });
  // Laatste 120 dagen volstaat voor week-/maandoverzicht én popup.
  const rows = db.prepare('SELECT date, data FROM journal_entries WHERE user_id = ? ORDER BY date DESC LIMIT 120')
    .all(req.session.userId);
  const entries = {};
  for (const r of rows) { try { entries[r.date] = JSON.parse(r.data); } catch {} }
  res.json({ entries });
});

app.post('/api/journal', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Niet ingelogd' });
  const date = String(req.body?.date || '');
  if (!DATE_RE.test(date)) return res.status(400).json({ error: 'Ongeldige datum' });
  const row = db.prepare('SELECT data FROM journal_entries WHERE user_id = ? AND date = ?')
    .get(req.session.userId, date);
  let entry = null;
  try { entry = row ? JSON.parse(row.data) : null; } catch {}
  entry = mergeJournalEntry(entry, req.body);
  db.prepare(`INSERT INTO journal_entries (user_id, date, data, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, date) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP`)
    .run(req.session.userId, date, JSON.stringify(entry));
  res.json({ ok: true, date, entry });
});

// ── Feedback (publiek formulier op /feedback en /en/feedback) ─────────────────
const { validateFeedback } = require('./lib/feedback');

app.post('/api/feedback', (req, res) => {
  const fb = validateFeedback(req.body);
  if (fb.error) return res.status(400).json({ error: fb.error });
  db.prepare('INSERT INTO feedback (name, email, rating, message, lang) VALUES (?, ?, ?, ?, ?)')
    .run(fb.name, fb.email, fb.rating, fb.message, fb.lang);
  res.json({ ok: true });
});

// ── Abonnement €3,69/mnd (pariteit met de live Netlify-functie) ───────────────
// Daily dashboard + WhatsApp-reminders + companion. Afsluiten vanuit het
// dashboard via een Stripe Checkout-sessie; status wordt hooguit één keer per
// dag bij Stripe ververst (geen webhook nodig).
const {
  createSubscriptionCheckout, createGiftCheckout, summarizeSub, subIsActive, refreshSubIfStale, cancelSubscription,
} = require('./lib/stripe');
const DEMO_SUB_EMAILS = ['demo@szinn.ai', 'demo-plus@szinn.ai', 'sara@voorbeeld.nl'];

function getUserSub(userId) {
  const row = db.prepare('SELECT subscription FROM users WHERE id = ?').get(userId);
  try { return row?.subscription ? JSON.parse(row.subscription) : null; } catch { return null; }
}
function setUserSub(userId, sub) {
  db.prepare('UPDATE users SET subscription = ? WHERE id = ?').run(sub ? JSON.stringify(sub) : null, userId);
}
async function userSubscription(userId) {
  const sub = getUserSub(userId);
  if (!sub?.id) return null;
  try {
    const fresh = await refreshSubIfStale(sub);
    if (fresh !== sub) setUserSub(userId, fresh);
    return fresh;
  } catch (e) { console.error('abonnement verversen mislukt:', e.message); return sub; }
}
// Admin en demo-accounts altijd; zonder Stripe-sleutel (lokaal) niet blokkeren.
async function hasSubscriptionAccess(req) {
  if (req.session.isAdmin) return true;
  const u = req.session.userId
    ? db.prepare('SELECT email, dashboard_access FROM users WHERE id = ?').get(req.session.userId)
    : null;
  // Admin-override per account gaat vóór demo/abonnement én de lokale fail-open.
  if (u?.dashboard_access === 'off') return false;
  if (u?.dashboard_access === 'on') return true;
  if (!stripeConfigured()) return true;
  if (!u) return false;
  if (DEMO_SUB_EMAILS.includes(u.email.toLowerCase())) return true;
  return subIsActive(await userSubscription(req.session.userId));
}

app.post('/api/subscription/checkout', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Niet ingelogd' });
  if (!stripeConfigured()) return res.status(501).json({ error: 'Stripe nog niet ingesteld (STRIPE_SECRET_KEY).' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Gebruiker niet gevonden' });
  if (subIsActive(await userSubscription(user.id)))
    return res.status(400).json({ error: 'Je hebt al een lopend abonnement.' });
  const baseUrl = process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
  try {
    const session = await createSubscriptionCheckout({ email: user.email, userId: user.id, baseUrl });
    res.json({ url: session.url });
  } catch (e) {
    console.error('abonnement-checkout mislukt:', e.message);
    res.status(500).json({ error: 'Kon de betaalpagina niet openen. Probeer het later opnieuw.' });
  }
});

app.post('/api/subscription/confirm', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Niet ingelogd' });
  const sid = String(req.body?.session_id || '').trim();
  if (!sid) return res.status(400).json({ error: 'session_id verplicht' });
  try {
    const s = await stripeReq('GET', `/checkout/sessions/${encodeURIComponent(sid)}`);
    if (s.mode !== 'subscription' || !s.subscription || String(s.client_reference_id) !== String(req.session.userId))
      return res.status(400).json({ error: 'Deze betaalsessie hoort niet bij dit account.' });
    const sub = summarizeSub(await stripeReq('GET', `/subscriptions/${s.subscription}`));
    setUserSub(req.session.userId, sub);
    res.json({ ok: true, active: subIsActive(sub) });
  } catch (e) {
    console.error('abonnement bevestigen mislukt:', e.message);
    res.status(500).json({ error: 'Kon het abonnement niet bevestigen.' });
  }
});

app.get('/api/subscription/status', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Niet ingelogd' });
  const sub = await userSubscription(req.session.userId);
  res.json({
    active: subIsActive(sub) || await hasSubscriptionAccess(req),
    status: sub?.status || null,
    cancelAtPeriodEnd: !!sub?.cancel_at_period_end,
    currentPeriodEnd: sub?.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
    configured: stripeConfigured(),
  });
});

app.post('/api/subscription/cancel', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Niet ingelogd' });
  const sub = getUserSub(req.session.userId);
  if (!sub?.id) return res.status(400).json({ error: 'Geen lopend abonnement' });
  try {
    const updated = summarizeSub(await cancelSubscription(sub.id));
    setUserSub(req.session.userId, updated);
    res.json({ ok: true, cancelAtPeriodEnd: true, currentPeriodEnd: updated.current_period_end ? new Date(updated.current_period_end * 1000).toISOString() : null });
  } catch (e) {
    console.error('abonnement opzeggen mislukt:', e.message);
    res.status(500).json({ error: 'Kon het abonnement niet opzeggen.' });
  }
});

// ── AI Companion (pariteit met de live Netlify-functie) ───────────────────────
// Zelfde vaste basisprompt als api.js: geverifieerde kaart- en getalgegevens,
// zodat de companion nooit zelf rekent of verzint.
function cCompanionSystem(c) {
  const P = c.ctx.chart.planets;
  const n = c.ctx.numerology;
  const line = (p) => `${p.sign} ${p.deg}°${String(p.min).padStart(2, '0')}'${p.house ? ` (Huis ${p.house})` : ''}`;
  return `Je bent de SZINN Companion, de ingebouwde begeleider in het dagelijkse dashboard van ${c.ctx.intake.clientName}.
Toon: warm, gegrond, helder, nooit zweverig, geen new-age clichés. Spreek aan met jij/jouw, nooit u. Geen voorspellingen, geen medische, psychologische of financiële claims. Je bent een spiegel, geen orakel. ${c.ctx.intake.clientName} is altijd de enige expert over zichzelf.
Je REKENT NOOIT zelf astrologie of numerologie. Gebruik uitsluitend deze vaste, geverifieerde gegevens en verzin niets nieuws:
Zon ${line(P.sun)}; Maan ${line(P.moon)}; Ascendant ${line(P.ascendant)}; Noordknoop ${line(P.northNode)}; Zuidknoop ${line(P.southNode)}; Chiron ${line(P.chiron)}.
Levenspad ${n.lifePath}; Persoonlijk Jaar ${n.personalYear} (${n.personalYearInfo.theme}); Persoonlijke Maand ${c.pm.number}; Persoonlijke Dag ${c.pd}.
Vandaag: maan in ${c.sky.moon.sign}, ${c.sky.waxing ? 'wassend' : 'afnemend'}. Datum: ${c.now.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.${c.texts && c.texts.summary && c.texts.summary.oneLiner ? `\nKern van de blueprint: ${c.texts.summary.oneLiner}` : ''}${c.lang === 'en' ? '\nIMPORTANT: The user uses the English dashboard. Reply entirely in English (use English zodiac sign names), while keeping the same warm, grounded tone.' : ''}`;
}

// Geschiedenis + samengevat geheugen per account, zodat een nieuwe sessie
// naadloos verdergaat. State als JSON in companion_state (SQLite).
function loadCompanionState(userId) {
  const row = db.prepare('SELECT state FROM companion_state WHERE user_id = ?').get(userId);
  try { return row ? JSON.parse(row.state) : null; } catch { return null; }
}
function saveCompanionState(userId, state) {
  db.prepare(`INSERT INTO companion_state (user_id, state, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET state=excluded.state, updated_at=CURRENT_TIMESTAMP`)
    .run(userId, JSON.stringify(state));
}

// 10 Companion-vragen per kalendermaand (zelfde venster als de Netlify-functie).
// Admin/demo-accounts en lokaal draaien zonder Stripe-sleutel blijven onbeperkt.
const SUB_COMPANION_LIMIT = parseInt(process.env.SUB_COMPANION_LIMIT || '10', 10);
function companionUnlimited(req) {
  if (!stripeConfigured() || req.session.isAdmin) return true;
  const u = db.prepare('SELECT email FROM users WHERE id = ?').get(req.session.userId);
  return !!u && DEMO_SUB_EMAILS.includes(u.email.toLowerCase());
}

app.post('/api/companion/chat', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Niet ingelogd' });

  const { companionConfigured, companionTurn, emptyCompanionState } = require('./lib/companion-llm');
  if (!companionConfigured()) {
    return res.json({
      content: 'De AI Companion is beschikbaar zodra een COMPANION_API_KEY (Gemini) is geconfigureerd. Start de server met: COMPANION_API_KEY=... npm start'
    });
  }

  const lang = (req.body?.lang === 'en') ? 'en' : 'nl';
  // Nieuw formaat: { message }. Oude clients sturen { messages: [...] } — pak daaruit de laatste gebruikersbeurt.
  const userMessage = String(req.body?.message
    || (Array.isArray(req.body?.messages) ? [...req.body.messages].reverse().find(m => m.role === 'user')?.content : '')
    || '').trim().slice(0, 4000);
  if (!userMessage) return res.status(400).json({ error: 'Geen bericht' });

  // De companion hoort bij het abonnement.
  if (!(await hasSubscriptionAccess(req)))
    return res.status(402).json({ error: 'De Companion hoort bij het SZINN-abonnement.', subscribe: true });

  // Abonnement: 10 vragen aan SZINN Companion per kalendermaand.
  const unlimited = companionUnlimited(req);
  if (!unlimited && companionQuota.monthCount(db, req.session.userId) >= SUB_COMPANION_LIMIT)
    return res.status(429).json({
      error: lang === 'en'
        ? `You've used your ${SUB_COMPANION_LIMIT} SZINN Companion questions for this month. They renew next month.`
        : `Je hebt je ${SUB_COMPANION_LIMIT} vragen aan SZINN Companion voor deze maand gebruikt. Volgende maand staan er weer ${SUB_COMPANION_LIMIT} voor je klaar.`,
      limitReached: true,
    });

  let system = lang === 'en'
    ? 'You are the SZINN AI Companion — warm, clear, practical. No bullet points. Write flowing sentences in English.'
    : 'Je bent de SZINN AI Companion — warm, helder, praktisch. Spreek de gebruiker aan met jij/jouw. Geen bullet points. Schrijf vloeiende zinnen.';
  let intakeRaw = null, name = null;
  try {
    const c = companionContext(req.session.userId, lang);
    if (c.ctx) { system = cCompanionSystem(c); intakeRaw = c.ctx.intake.raw; name = c.ctx.intake.clientName; }
  } catch (e) { /* generieke system prompt volstaat */ }

  const state = loadCompanionState(req.session.userId) || emptyCompanionState();
  try {
    const content = await companionTurn({ state, userMessage, baseSystem: system, name, intakeRaw, lang });
    saveCompanionState(req.session.userId, state);
    if (!unlimited) companionQuota.bump(db, req.session.userId); // teller +1 na een gelukte beurt
    res.json({
      content,
      companionLeft: unlimited ? null : Math.max(0, SUB_COMPANION_LIMIT - companionQuota.monthCount(db, req.session.userId)),
    });
  } catch (err) {
    console.error('Companion API error:', err.message);
    res.status(500).json({ error: 'De AI Companion is tijdelijk niet beschikbaar.' });
  }
});

// Gespreksgeschiedenis voor het dashboard (nieuwe sessie gaat verder waar de vorige ophield).
app.get('/api/companion/history', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Niet ingelogd' });
  const state = loadCompanionState(req.session.userId);
  res.json({ messages: (state?.messages || []).slice(-30) });
});

// ── Intake-toegang: alleen na betaling of met cadeaucode (pariteit Netlify) ───
// De betaallink stuurt na betaling door naar /intake?session_id={CHECKOUT_SESSION_ID};
// die sessie verifiëren we bij Stripe en houden we vast in de server-sessie.
const { stripeReq, stripeConfigured } = require('./lib/stripe');
const INTAKE_PAY_LINK = process.env.INTAKE_PAY_LINK || 'https://buy.stripe.com/fZu9AL8g20KT5xgdpO0kE00';
// Engelse betaallink (eigen redirect naar /intake-en); zolang die er nog niet
// is valt de Engelse intake terug op de Nederlandse link.
const INTAKE_PAY_LINK_EN = process.env.INTAKE_PAY_LINK_EN || INTAKE_PAY_LINK;

async function intakeAccess(req, { sessionId, code } = {}) {
  if (req.session.isAdmin) return { ok: true };
  // Heractivering door admin: eenmalig een nieuwe intake zonder betaling;
  // de submit verbruikt de toekenning via grantUserId.
  if (req.session.userId) {
    const u = db.prepare('SELECT intake_grant FROM users WHERE id = ?').get(req.session.userId);
    if (u && u.intake_grant) return { ok: true, grantUserId: req.session.userId };
  }
  const held = req.session.intakeAccess;
  if (held) {
    const sidUsed = held.sid && db.prepare('SELECT sid FROM used_checkout_sessions WHERE sid = ?').get(held.sid);
    const codeUsed = held.code && db.prepare('SELECT redeemed_at FROM gift_codes WHERE code = ?').get(held.code)?.redeemed_at;
    if (!sidUsed && !codeUsed) return { ok: true, sid: held.sid || null, code: held.code || null };
  }
  if (sessionId && stripeConfigured()) {
    if (db.prepare('SELECT sid FROM used_checkout_sessions WHERE sid = ?').get(sessionId)) return { ok: false };
    try {
      const s = await stripeReq('GET', `/checkout/sessions/${encodeURIComponent(sessionId)}`);
      // 100%-kortingscode → Stripe zet no_payment_required i.p.v. paid; ook geldig.
      if (s.status === 'complete' && (s.payment_status === 'paid' || s.payment_status === 'no_payment_required'))
        return { ok: true, sid: sessionId, fresh: true };
    } catch (e) { console.error('checkout-sessie verifiëren mislukt:', e.message); }
  }
  if (code) {
    const g = db.prepare('SELECT * FROM gift_codes WHERE code = ?').get(String(code).trim().toUpperCase());
    if (g && !g.redeemed_at) return { ok: true, code: g.code, fresh: true };
  }
  // Zonder Stripe-sleutel (lokaal ontwikkelen) niet blokkeren.
  if (!stripeConfigured()) return { ok: true };
  return { ok: false };
}

app.post('/api/intake/access', async (req, res) => {
  const access = await intakeAccess(req, { sessionId: req.body?.session_id || null, code: req.body?.code || null });
  if (!access.ok) return res.status(402).json({ ok: false, payLink: INTAKE_PAY_LINK, payLinkEn: INTAKE_PAY_LINK_EN });
  if (access.fresh) req.session.intakeAccess = { sid: access.sid || null, code: access.code || null };
  res.json({ ok: true });
});

// ── Intake submit ─────────────────────────────────────────────────────────────
app.post('/api/intake/submit', async (req, res) => {
  const data = req.body;
  if (!data.email || !data.geboortedatum) {
    return res.status(400).json({ error: 'Email en geboortedatum zijn verplicht' });
  }

  // Betaalpoort: alleen met geverifieerde betaling of cadeaucode.
  const access = await intakeAccess(req, { sessionId: data.stripe_session_id || null, code: data.gift_code || null });
  if (!access.ok) return res.status(402).json({ error: 'Deze aanvraag vereist eerst een betaling.', payLink: INTAKE_PAY_LINK });

  // Find or create user
  let user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(data.email.trim());
  let tempPassword = null;
  const clientName = `${data.voornaam || ''} ${data.achternaam || ''}`.trim();

  if (!user) {
    tempPassword = crypto.randomBytes(4).toString('hex');
    const hashed = bcrypt.hashSync(tempPassword, 10);
    db.prepare('INSERT INTO users (email, password, name) VALUES (?, ?, ?)').run(
      data.email.trim(), hashed, clientName || data.email
    );
    user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(data.email.trim());
    console.log(`\n✓ Nieuw account: ${data.email} / ${tempPassword}`);
  }

  // Create order
  const orderId = `ORD-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const lat = parseFloat(data.geboorte_lat) || null;
  const lng = parseFloat(data.geboorte_lng) || null;

  db.prepare(`
    INSERT INTO orders (
      id, user_id, type, status, client_name,
      birth_date, birth_time, birth_location, birth_lat, birth_lng, birth_tz,
      full_birth_name, blueprint_language, intake_data, view_token, created_at
    ) VALUES (?, ?, 'personal', 'processing', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
    orderId, user.id, clientName,
    data.geboortedatum, data.geboortetijd || null,
    data.geboorteplaats_volledig || data.geboorteplaats || null,
    lat, lng, data.geboorte_tz || null,
    data.geboortenaam || clientName,
    data.blueprint_taal || 'nl',
    JSON.stringify(data),
    crypto.randomBytes(16).toString('hex')
  );

  // Betaling/cadeaucode verzilveren: één intake per betaling.
  if (access.sid) db.prepare('INSERT OR IGNORE INTO used_checkout_sessions (sid, order_id) VALUES (?, ?)').run(access.sid, orderId);
  if (access.code) db.prepare('UPDATE gift_codes SET redeemed_at = CURRENT_TIMESTAMP, redeemed_order = ? WHERE code = ?').run(orderId, access.code);
  // Heractivering verbruiken: één nieuwe intake per toekenning.
  if (access.grantUserId) db.prepare('UPDATE users SET intake_grant = 0 WHERE id = ?').run(access.grantUserId);

  // Auto-login this user
  req.session.userId = user.id;

  // Trigger async Blueprint generation
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    setImmediate(() => generateBlueprint(orderId).catch(err => {
      console.error(`Blueprint generation failed for ${orderId}:`, err.message);
      db.prepare("UPDATE orders SET status = 'failed' WHERE id = ?").run(orderId);
    }));
  } else {
    console.warn('\n⚠ ANTHROPIC_API_KEY niet ingesteld — Blueprint wordt niet gegenereerd');
    console.warn('  Start via: ANTHROPIC_API_KEY=sk-ant-... npm start\n');
  }

  res.json({
    success: true,
    orderId,
    loginEmail: data.email,
    tempPassword,
    message: tempPassword
      ? `Account aangemaakt. Inloggen met: ${data.email} / ${tempPassword}`
      : 'Blueprint wordt gegenereerd in je bestaande account'
  });
});

// ── Blueprint generatie (intern) ───────────────────────────────────────────────
async function generateBlueprint(orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) throw new Error(`Order ${orderId} niet gevonden`);

  const intake = JSON.parse(order.intake_data || '{}');
  const lat    = order.birth_lat || parseFloat(intake.geboorte_lat) || 52.37;
  const lng    = order.birth_lng || parseFloat(intake.geboorte_lng) || 4.9;

  // Parse timezone offset from "Europe/Amsterdam" style string
  let tzOffset = 1; // default CET
  if (order.birth_tz) {
    try {
      const fmt = new Intl.DateTimeFormat('nl', { timeZone: order.birth_tz, timeZoneName: 'shortOffset' });
      const parts = fmt.formatToParts(new Date(`${order.birth_date}T12:00:00`));
      const off = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT+1';
      const m = off.match(/GMT([+-]\d+)/);
      if (m) tzOffset = parseInt(m[1]);
    } catch {}
  }

  console.log(`\n⏳ Blueprint genereren voor ${orderId} (${order.client_name})…`);

  const { calcBirthChart } = require('./lib/astro');
  const { calcAll }        = require('./lib/numerology');
  const { generateBlueprint: genHtml } = require('./lib/generate-blueprint');

  const chart = calcBirthChart(order.birth_date, order.birth_time, lat, lng, tzOffset);
  const numData = calcAll(order.full_birth_name || order.client_name, order.birth_date);

  const blueprintsDir = path.join(ROOT, 'szinn-portal', 'blueprints');
  if (!fs.existsSync(blueprintsDir)) fs.mkdirSync(blueprintsDir, { recursive: true });

  const { scores, html } = await genHtml(
    orderId, intake, chart, numData,
    process.env.ANTHROPIC_API_KEY,
    blueprintsDir
  );

  // Also store HTML in DB so it survives redeploys on Railway/Render
  if (html) db.prepare('UPDATE orders SET blueprint_html = ? WHERE id = ?').run(html, orderId);

  // Update order
  db.prepare(`
    UPDATE orders SET
      status               = 'completed',
      completed_at         = CURRENT_TIMESTAMP,
      blueprint_url        = ?,
      alignment_score      = ?,
      astro_score          = ?,
      numerology_score     = ?,
      soul_direction_score = ?,
      personal_year_score  = ?
    WHERE id = ?
  `).run(
    `/szinn-portal/blueprints/${orderId}.html`,
    scores.alignment, scores.astro, scores.numerology, scores.soulDirection, scores.personalYear,
    orderId
  );

  console.log(`✓ Blueprint klaar: ${orderId} — alignment ${scores.alignment}%`);
}

// ── Book order (placeholder) ──────────────────────────────────────────────────
app.post('/api/book/order', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Niet ingelogd' });
  // TODO: connect to Stripe/Plug&Pay checkout
  res.json({ checkoutUrl: 'https://szinn.ai/boek' });
});

// ── Admin panel ───────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'szinn-admin';

function isAdmin(req) { return req.session.isAdmin === true; }

app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body || {};

  // Inloggen met e-mailadres + wachtwoord tegen het admin-account in de database.
  if (email) {
    const admin = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?) AND is_admin = 1').get(String(email).trim());
    if (admin && bcrypt.compareSync(password || '', admin.password)) {
      req.session.isAdmin = true;
      req.session.adminUserId = admin.id;
      return res.json({ ok: true });
    }
    return res.status(401).json({ error: 'Onjuist e-mailadres of wachtwoord' });
  }

  // Achterwaarts compatibel: alleen het gedeelde wachtwoord.
  if (password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Onjuist wachtwoord' });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.isAdmin = false;
  res.json({ ok: true });
});

// List all orders for admin
app.get('/api/admin/orders', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Geen toegang' });
  const rows = db.prepare(`
    SELECT o.*, u.email, u.name AS user_name
    FROM orders o LEFT JOIN users u ON o.user_id = u.id
    ORDER BY o.created_at DESC
  `).all();
  res.json(rows);
});

// Feedback-inzendingen (nieuwste eerst) voor het admin-dashboard.
app.get('/api/admin/feedback', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Geen toegang' });
  res.json(db.prepare('SELECT * FROM feedback ORDER BY created_at DESC, id DESC LIMIT 500').all());
});

// Build prompt for an order (to paste into claude.ai)
app.get('/api/admin/prompt/:orderId', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Geen toegang' });
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Aanvraag niet gevonden' });

  try {
    const intake = JSON.parse(order.intake_data || '{}');
    const lat    = order.birth_lat || parseFloat(intake.geboorte_lat) || 52.37;
    const lng    = order.birth_lng || parseFloat(intake.geboorte_lng) || 4.9;
    let tzOffset = 1;
    if (order.birth_tz) {
      try {
        const fmt   = new Intl.DateTimeFormat('nl', { timeZone: order.birth_tz, timeZoneName: 'shortOffset' });
        const parts = fmt.formatToParts(new Date(`${order.birth_date}T12:00:00`));
        const off   = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT+1';
        const m     = off.match(/GMT([+-]\d+)/);
        if (m) tzOffset = parseInt(m[1]);
      } catch {}
    }

    const { calcBirthChart }       = require('./lib/astro');
    const { calcAll }              = require('./lib/numerology');
    const { buildFullPromptForClaudeAI, getScoreLabels, generateBirthChartSVG } = require('./lib/generate-blueprint');

    const chart      = calcBirthChart(order.birth_date, order.birth_time, lat, lng, tzOffset);
    const numData    = calcAll(order.full_birth_name || order.client_name, order.birth_date);
    const svgContent = generateBirthChartSVG(chart);
    const fullPrompt = buildFullPromptForClaudeAI(intake, chart, numData);

    res.json({ prompt: fullPrompt, svg: svgContent, orderId: order.id, clientName: order.client_name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save blueprint HTML pasted from claude.ai
app.post('/api/admin/save-blueprint', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Geen toegang' });
  const { orderId, html } = req.body;
  if (!orderId || !html) return res.status(400).json({ error: 'orderId en html verplicht' });

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return res.status(404).json({ error: 'Aanvraag niet gevonden' });

  // Strip markdown fences if user accidentally copied them
  let cleanHtml = html.replace(/^```(?:html)?\n?/i, '').replace(/\n?```\s*$/, '').trim();

  // Extract scores comment
  const scoresMatch = cleanHtml.match(/<!--\s*SZINN_SCORES:\s*(\{[^}]+\})\s*-->/);
  let scores = { alignment: 72, astro: 72, numerology: 72, soulDirection: 72, personalYear: 72 };
  if (scoresMatch) {
    try { scores = JSON.parse(scoresMatch[1]); } catch {}
  }

  // Inject SVG if placeholder still present
  if (cleanHtml.includes('{{MANDALA_SVG}}')) {
    try {
      const intake = JSON.parse(order.intake_data || '{}');
      const lat    = order.birth_lat || parseFloat(intake.geboorte_lat) || 52.37;
      const lng    = order.birth_lng || parseFloat(intake.geboorte_lng) || 4.9;
      const { calcBirthChart } = require('./lib/astro');
      const { generateBirthChartSVG } = require('./lib/generate-blueprint');
      const chart = calcBirthChart(order.birth_date, order.birth_time, lat, lng, 1);
      const svg   = generateBirthChartSVG(chart);
      cleanHtml   = cleanHtml.replace('{{MANDALA_SVG}}', `<div class="mandala-svg">${svg}</div>`);
    } catch {}
  }

  // Save file to filesystem (works locally; skipped gracefully in production)
  try {
    const blueprintsDir = path.join(ROOT, 'szinn-portal', 'blueprints');
    fs.mkdirSync(blueprintsDir, { recursive: true });
    fs.writeFileSync(path.join(blueprintsDir, `${orderId}.html`), cleanHtml, 'utf8');
  } catch {}

  // Update order (also store HTML in DB for Railway/Render production)
  db.prepare(`
    UPDATE orders SET
      status = 'completed', completed_at = CURRENT_TIMESTAMP,
      blueprint_url = ?, blueprint_html = ?,
      alignment_score = ?, astro_score = ?, numerology_score = ?,
      soul_direction_score = ?, personal_year_score = ?
    WHERE id = ?
  `).run(
    `/szinn-portal/blueprints/${orderId}.html`, cleanHtml,
    scores.alignment, scores.astro, scores.numerology, scores.soulDirection, scores.personalYear,
    orderId
  );

  console.log(`✓ Blueprint opgeslagen via admin: ${orderId}`);
  res.json({ ok: true, blueprintUrl: `/szinn-portal/blueprints/${orderId}.html` });
});

// ── Prompt-aanscherping (addendum) — pariteit met de live Netlify-functie ──────
// Aanvullende schrijfinstructies die bij elke volgende generatie bovenop de
// vaste basisprompt worden meegestuurd (lib/ai-texts.js verwerkt ze als een
// apart systeemblok ná de gecachete basisprompt).
app.get('/api/admin/prompt-settings', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Geen toegang' });
  const { SYSTEM } = require('./lib/ai-texts');
  const row = db.prepare('SELECT value, updated_at FROM settings WHERE key = ?').get('promptAddendum');
  res.json({ addendum: (row && row.value) || '', updatedAt: (row && row.updated_at) || null, basePrompt: SYSTEM });
});

app.post('/api/admin/prompt-settings', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Geen toegang' });
  const addendum = String((req.body && req.body.addendum) || '').slice(0, 8000);
  db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('promptAddendum', ?, CURRENT_TIMESTAMP)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`).run(addendum);
  res.json({ ok: true, length: addendum.length });
});

// ── Status van een aanvraag handmatig wijzigen ─────────────────────────────────
// Zo kan de beheerder een blueprint die klaar is maar nog op "In behandeling"
// staat, op "Klaar" zetten zodat de klant hem kan inzien.
const ALLOWED_STATUSES = ['questionnaire', 'processing', 'completed', 'failed'];
app.post('/api/admin/order/:orderId/status', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Geen toegang' });
  const status = String((req.body && req.body.status) || '').trim();
  if (!ALLOWED_STATUSES.includes(status)) return res.status(400).json({ error: 'Onbekende status' });

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Aanvraag niet gevonden' });

  // Op "Klaar" zetten mag alleen als er echt een blueprint klaarstaat, anders
  // zou de klant een lege inkijkpagina te zien krijgen.
  if (status === 'completed' && !order.blueprint_url && !order.blueprint_html) {
    return res.status(400).json({ error: 'Er staat nog geen blueprint klaar voor deze aanvraag — op "Klaar" zetten zou de klant een lege pagina tonen. Sla eerst een blueprint op.' });
  }

  if (status === 'completed') {
    db.prepare(`UPDATE orders SET status = 'completed', completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP) WHERE id = ?`).run(order.id);
  } else {
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, order.id);
  }
  console.log(`✓ Status gewijzigd via admin: ${order.id} → ${status}`);
  res.json({ ok: true, status });
});

// ── Gebruikersbeheer: dashboard-toegang + blueprint-heractivering ──────────────
app.get('/api/admin/users', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Geen toegang' });
  const rows = db.prepare(`
    SELECT u.id, u.email, u.name, u.created_at, u.dashboard_access, u.intake_grant, u.subscription,
           (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id AND o.status = 'completed') AS blueprints
    FROM users u WHERE u.is_admin IS NOT 1 ORDER BY u.created_at DESC
  `).all();
  res.json(rows.map(r => ({
    id: r.id, email: r.email, name: r.name, created_at: r.created_at,
    dashboard_access: r.dashboard_access || 'auto',
    intake_grant: !!r.intake_grant,
    subActive: (() => { try { return subIsActive(JSON.parse(r.subscription)); } catch { return false; } })(),
    blueprints: r.blueprints,
  })));
});

// Zet per gebruiker de dashboard-toegang ('on'/'off'/'auto') en/of de eenmalige
// gratis nieuwe intake (blueprint-heractivering) aan of uit.
app.post('/api/admin/user/:userId/access', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Geen toegang' });
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(Number(req.params.userId) || 0);
  if (!user) return res.status(404).json({ error: 'Gebruiker niet gevonden' });
  const { dashboard, intakeGrant } = req.body || {};
  if (dashboard !== undefined) {
    if (!['on', 'off', 'auto'].includes(dashboard))
      return res.status(400).json({ error: 'dashboard moet on, off of auto zijn' });
    db.prepare('UPDATE users SET dashboard_access = ? WHERE id = ?').run(dashboard === 'auto' ? null : dashboard, user.id);
  }
  if (intakeGrant !== undefined)
    db.prepare('UPDATE users SET intake_grant = ? WHERE id = ?').run(intakeGrant ? 1 : 0, user.id);
  const fresh = db.prepare('SELECT dashboard_access, intake_grant FROM users WHERE id = ?').get(user.id);
  res.json({ ok: true, dashboard_access: fresh.dashboard_access || 'auto', intake_grant: !!fresh.intake_grant });
});

// Serve admin page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(ROOT, 'admin', 'index.html'));
});

// ── Static fallback (schone, extensieloze URL's) ───────────────────────────────
app.get('*', (req, res, next) => {
  if (path.extname(req.path)) return next();
  const candidates = [
    path.join(ROOT, req.path + '.html'),
    path.join(ROOT, req.path, 'index.html'),
  ];
  for (const f of candidates) { if (fs.existsSync(f)) return res.sendFile(f); }
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

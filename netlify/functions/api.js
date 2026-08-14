'use strict';
// ── SZINN Netlify Function — alle API routes ───────────────────────────────────
// Database: Netlify Blobs (ingebouwd, geen extern account)
// Auth:     JWT in httpOnly cookie (geen server-side sessions nodig)

const express    = require('express');
const serverless = require('serverless-http');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const cookieLib  = require('cookie');
const crypto     = require('crypto');
const { blueprintStore, loadDB, saveDB } = require('../../lib/db');
const { upgradeNav } = require('../../lib/blueprint-nav');
const { sendAccountEmail, sendDraftEmail, sendNewOrderEmail, sendGiftEmail, sendGiftConfirmationEmail, sendPasswordResetEmail } = require('../../lib/email');

const app = express();
app.use(express.json());

// Wrap álle route-handlers automatisch: een rejection in een async handler
// (bijv. een DB-fout) wordt zo doorgestuurd naar de foutafhandelaar onderaan
// i.p.v. een hangende request. Express 4 doet dit niet uit zichzelf.
// Handlers met arity 4 (foutafhandelaars) laten we ongemoeid.
for (const method of ['get', 'post', 'put', 'delete', 'use']) {
  const orig = app[method].bind(app);
  app[method] = (...args) => orig(...args.map(a =>
    (typeof a === 'function' && a.length < 4)
      ? (req, res, next) => Promise.resolve(a(req, res, next)).catch(next)
      : a
  ));
}

const JWT_SECRET      = process.env.JWT_SECRET      || 'szinn-jwt-2026-change-me';
// trim(): een meegekopieerd regeleinde/spatie in de Netlify env var zou anders
// elke login laten mislukken.
const ADMIN_PASSWORD  = (process.env.ADMIN_PASSWORD  || 'szinn-admin').trim();
const ADMIN_EMAIL     = (process.env.ADMIN_EMAIL || 'admin@szinn.ai').trim().toLowerCase();
const DEMO_EMAIL      = (process.env.DEMO_EMAIL || 'demo@szinn.ai').trim().toLowerCase();
const DEMO_PASSWORD   = process.env.DEMO_PASSWORD || 'szinn-demo';
const DEMO_ORDER_ID   = 'ORD-DEMO-0001';
const TRIGGER_SECRET  = process.env.INTERNAL_TRIGGER_SECRET || JWT_SECRET;

// Zorgt dat er een admin-account in de database staat (idempotent).
// Retourneert true als de database is gewijzigd (dan moet-ie opgeslagen worden).
function ensureAdminUser(db) {
  if (db.users.some(u => u.is_admin)) return false;
  const existing = db.users.find(u => u.email.toLowerCase() === ADMIN_EMAIL);
  if (existing) {
    existing.is_admin = true;
  } else {
    db.users.push({
      id: db.nextUserId++, email: ADMIN_EMAIL,
      password: bcrypt.hashSync(ADMIN_PASSWORD, 10),
      name: 'Admin', is_admin: true,
      created_at: new Date().toISOString(),
    });
  }
  return true;
}

// Zorgt dat er een demo-gebruiker met een compleet voorbeeld-blueprint bestaat,
// zodat het gebruikers-dashboard en de blueprint-viewer getest kunnen worden
// zonder AI-call. Idempotent: rendert en slaat één keer op.
async function ensureDemoData(db) {
  let user = db.users.find(u => u.email.toLowerCase() === DEMO_EMAIL);
  const orderExists = user && db.orders.some(o => o.id === DEMO_ORDER_ID);
  if (orderExists) return false;

  if (!user) {
    user = {
      id: db.nextUserId++, email: DEMO_EMAIL,
      password: bcrypt.hashSync(DEMO_PASSWORD, 10),
      name: 'Barry', created_at: new Date().toISOString(),
    };
    db.users.push(user);
  }

  const demo = require('../../lib/demo-blueprint');
  const now = new Date().toISOString();
  const order = {
    id: DEMO_ORDER_ID, user_id: user.id, type: 'personal', status: 'completed',
    view_token: crypto.randomBytes(16).toString('hex'),
    client_name: demo.intake.clientName, birth_date: demo.intake.birthDate,
    birth_time: demo.intake.birthTime,
    birth_location: `${demo.intake.birthCity}, ${demo.intake.birthCountry}`,
    birth_lat: demo.intake.lat, birth_lng: demo.intake.lng, birth_tz: demo.intake.tz,
    full_birth_name: demo.intake.birthName,
    blueprint_language: 'nl',
    intake_data: JSON.stringify(demo.intake.raw || {}),
    created_at: now, completed_at: now,
    blueprint_url: `/szinn-portal/blueprints/${DEMO_ORDER_ID}.html`,
    blueprint_languages: ['nl'], pdf_available: false,
    alignment_score: null, astro_score: null, numerology_score: null,
    soul_direction_score: null, personal_year_score: null,
  };
  db.orders.push(order);

  // Blueprint renderen en opslaan (zelfde weg als de echte pipeline)
  const { buildContext } = require('../../lib/pipeline');
  const { renderBlueprint } = require('../../lib/template');
  const ctx = buildContext(order);
  const html = renderBlueprint({ ...ctx, ai: demo.texts, lang: 'nl' });
  const store = blueprintStore();
  await store.set(`${DEMO_ORDER_ID}.nl.html`, html);
  await store.setJSON(`${DEMO_ORDER_ID}.texts.json`, { orderId: DEMO_ORDER_ID, demo: true, nl: demo.texts, en: demo.texts });
  console.log(`Demo-blueprint aangemaakt voor ${DEMO_EMAIL}`);
  return true;
}

// Start de blueprint-generatie als background function (15 min limiet).
// Fire-and-forget: de intake-response wacht alleen op de 202-acceptatie.
// De order gaat mee in de payload: Blobs is eventually consistent, dus de
// background function ziet de zojuist opgeslagen order mogelijk nog niet.
async function triggerGeneration(orderId, order) {
  const base = process.env.URL || process.env.DEPLOY_URL;
  if (!base) {
    console.log(`Generatie-trigger overgeslagen (geen site-URL bekend, lokaal?): ${orderId}`);
    return false;
  }
  const res = await fetch(`${base}/.netlify/functions/generate-blueprint-background`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, order: order || null, secret: TRIGGER_SECRET }),
  });
  console.log(`Generatie getriggerd voor ${orderId}: HTTP ${res.status}`);
  return res.status >= 200 && res.status < 300;
}

// ── JWT auth middleware ────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const cookies = cookieLib.parse(req.headers.cookie || '');
  req.auth = null;
  if (cookies.szinn_token) {
    try { req.auth = jwt.verify(cookies.szinn_token, JWT_SECRET); } catch {}
  }
  next();
});

function setAuthCookie(res, payload) {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  res.setHeader('Set-Cookie', cookieLib.serialize('szinn_token', token, {
    httpOnly: true, sameSite: 'lax', secure: true,
    maxAge: 7 * 86400, path: '/'
  }));
}
function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', cookieLib.serialize('szinn_token', '', {
    httpOnly: true, sameSite: 'lax', secure: true,
    maxAge: 0, path: '/'
  }));
}

// ── Auth ──────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const en = req.body?.lang === 'en';
  if (!email || !password) return res.status(400).json({ error: en ? 'Email and password are required' : 'Email en wachtwoord zijn verplicht' });
  const db   = await loadDB();
  // Demo-account + voorbeeld-blueprint aanmaken zodra iemand ermee inlogt.
  if (email.trim().toLowerCase() === DEMO_EMAIL) {
    if (await ensureDemoData(db)) await saveDB(db);
  }
  const user = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: en ? 'Incorrect email address or password' : 'Onjuist e-mailadres of wachtwoord' });
  setAuthCookie(res, { userId: user.id, email: user.email, name: user.name, isAdmin: !!user.is_admin });
  res.json({ id: user.id, email: user.email, name: user.name, initials: user.name.substring(0,2).toUpperCase(), isAdmin: !!user.is_admin });
});

app.post('/api/auth/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// Wachtwoord vergeten: genereer een nieuw wachtwoord, sla het gehasht op en
// mail het naar de gebruiker. Het antwoord is bewust altijd generiek (ok:true),
// zodat we niet lekken welke e-mailadressen een account hebben. Het admin-account
// is uitgesloten (dat wordt via ADMIN_PASSWORD beheerd).
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email, lang } = req.body || {};
  if (!email || !String(email).includes('@'))
    return res.status(400).json({ error: 'Vul een geldig e-mailadres in' });

  const normalized = String(email).trim().toLowerCase();
  const db   = await loadDB();
  const user = db.users.find(u => u.email.toLowerCase() === normalized);

  if (user && !user.is_admin) {
    const newPassword = crypto.randomBytes(5).toString('hex'); // 10 hex-tekens
    user.password = bcrypt.hashSync(newPassword, 10);
    await saveDB(db);
    try {
      await sendPasswordResetEmail({ to: user.email, name: user.name, newPassword, lang: lang === 'en' ? 'en' : 'nl' });
    } catch (e) {
      console.error('wachtwoord-reset mail mislukt:', e.message);
      return res.status(500).json({ error: 'Kon de e-mail niet versturen. Probeer het later opnieuw.' });
    }
  }
  res.json({ ok: true });
});

app.get('/api/auth/me', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Niet ingelogd' });
  const db   = await loadDB();
  const user = db.users.find(u => u.id === req.auth.userId);
  if (!user) return res.status(401).json({ error: 'Gebruiker niet gevonden' });
  res.json({ id: user.id, email: user.email, name: user.name, initials: user.name.substring(0,2).toUpperCase() });
});

// ── Orders ────────────────────────────────────────────────────────────────────
// Kent elke order zonder view_token een onraadbaar token toe. Zo staat het
// volgnummer (ORD-…) nooit in een URL en kan niemand door te raden andermans
// blueprint openen. Retourneert of er iets is gewijzigd (dan saveDB nodig).
function ensureTokens(db) {
  let changed = false;
  for (const o of db.orders || []) {
    if (!o.view_token) { o.view_token = crypto.randomBytes(16).toString('hex'); changed = true; }
  }
  return changed;
}

function toOrder(o) {
  return {
    id: o.id, type: o.type, status: o.status,
    viewToken: o.view_token,
    clientName: o.client_name, birthDate: o.birth_date,
    birthTime: o.birth_time, birthLocation: o.birth_location,
    createdAt: o.created_at, completedAt: o.completed_at,
    blueprintUrl: o.blueprint_url,
    blueprintLanguages: o.blueprint_languages || null,
    pdfAvailable: !!o.pdf_available,
    generationError: o.status === 'failed' ? (o.generation_error || 'onbekende fout') : null,
    scores: (o.alignment_score != null) ? {
      alignment: o.alignment_score, astro: o.astro_score,
      numerology: o.numerology_score, soulDirection: o.soul_direction_score,
      personalYear: o.personal_year_score
    } : null
  };
}

app.get('/api/orders', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Niet ingelogd' });
  const db = await loadDB();
  if (ensureTokens(db)) await saveDB(db);
  const orders = db.orders.filter(o => o.user_id === req.auth.userId)
    .sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(orders.map(toOrder));
});

app.get('/api/orders/:id', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Niet ingelogd' });
  const db    = await loadDB();
  // De viewer opent met ?t=<view_token>; oude links gebruiken nog het volgnummer.
  // Resolve op beide, net als de blueprint-serve-route (authorizedOrder).
  const order = db.orders.find(o => (o.view_token === req.params.id || o.id === req.params.id) && o.user_id === req.auth.userId);
  if (!order) return res.status(404).json({ error: 'Aanvraag niet gevonden' });
  res.json(toOrder(order));
});

// ── Gift codes ────────────────────────────────────────────────────────────────
app.get('/api/gift/codes', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Niet ingelogd' });
  const db    = await loadDB();
  const codes = db.giftCodes.filter(c => c.owner_user_id === req.auth.userId);
  res.json(codes);
});

app.post('/api/gift/generate', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Niet ingelogd' });
  const db   = await loadDB();
  const part = crypto.randomBytes(3).toString('hex').toUpperCase();
  const code = { code: `SZINN-${part.slice(0,4)}-${part.slice(4)}`, owner_user_id: req.auth.userId, created_at: new Date().toISOString() };
  db.giftCodes.push(code);
  await saveDB(db);
  res.json({ code: code.code });
});

// ── Cadeau-flow: betaling (mock) → ontvanger + datum → (ingeplande) mail ──────
const GIFT_PRICE_EUR = process.env.GIFT_PRICE_EUR || '39,90';
const GIFT_PRICE_CENTS = parseInt(process.env.GIFT_PRICE_CENTS || '3990', 10);

app.post('/api/gift/checkout', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Niet ingelogd' });
  if (stripeConfigured()) {
    const db = await loadDB();
    const user = db.users.find(u => u.id === req.auth.userId);
    try {
      const session = await createGiftCheckout({ email: user?.email, userId: req.auth.userId, baseUrl: SITE_URL, priceCents: GIFT_PRICE_CENTS });
      return res.json({ url: session.url });
    } catch (e) {
      console.error('cadeau-checkout mislukt:', e.message);
      return res.status(500).json({ error: 'Kon de betaalpagina niet openen. Probeer het later opnieuw.' });
    }
  }
  // Fail-closed in productie: zonder Stripe-sleutel mag niemand gratis langs de
  // betaalstap. Mock (doorlopen zonder betalen) alleen lokaal, niet op Netlify.
  if (process.env.NETLIFY) return res.status(503).json({ error: 'Betalen is tijdelijk niet beschikbaar. Stel STRIPE_SECRET_KEY in en probeer opnieuw.' });
  res.json({ mock: true, price: GIFT_PRICE_EUR, paidToken: 'mock-' + crypto.randomBytes(6).toString('hex') });
});

function giftIsDue(sendDate) {
  if (!sendDate) return true;
  return sendDate <= new Date().toISOString().slice(0, 10);
}

// Echte betaling verifiëren: betaald, hoort bij dit account, nog niet gebruikt.
async function verifyGiftPayment(db, sid, userId) {
  if (!sid) return false;
  if ((db.usedCheckoutSessions || []).includes(sid)) return false;
  try {
    const s = await stripeReq('GET', `/checkout/sessions/${encodeURIComponent(sid)}`);
    return s.payment_status === 'paid' && String(s.client_reference_id) === String(userId);
  } catch (e) { console.error('cadeaubetaling verifiëren mislukt:', e.message); return false; }
}

app.post('/api/gift/create', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Niet ingelogd' });
  const { recipientEmail, recipientName, message, sendDate, lang, paidToken } = req.body || {};
  if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail))
    return res.status(400).json({ error: 'Vul een geldig e-mailadres van de ontvanger in.' });
  if (sendDate && !/^\d{4}-\d{2}-\d{2}$/.test(sendDate))
    return res.status(400).json({ error: 'Ongeldige verzenddatum.' });

  const language = lang === 'en' ? 'en' : 'nl';
  const db = await loadDB();
  if (stripeConfigured()) {
    if (!(await verifyGiftPayment(db, paidToken, req.auth.userId)))
      return res.status(402).json({ error: 'Betaling niet bevestigd.' });
  } else if (!String(paidToken || '').startsWith('mock-')) {
    return res.status(402).json({ error: 'Betaling niet bevestigd.' });
  }
  const sender = db.users.find(u => u.id === req.auth.userId);
  const part = crypto.randomBytes(3).toString('hex').toUpperCase();
  const code = `SZINN-${part.slice(0, 4)}-${part.slice(4)}`;
  const due = giftIsDue(sendDate);
  const entry = {
    code, owner_user_id: req.auth.userId, recipient_email: recipientEmail.trim(),
    recipient_name: (recipientName || '').trim() || null, message: (message || '').trim() || null,
    send_date: sendDate || null, lang: language, status: due ? 'sending' : 'pending',
    paid: true, created_at: new Date().toISOString(), sent_at: null,
  };
  db.giftCodes.push(entry);
  // Echte betaalsessie eenmalig markeren zodat dezelfde betaling geen tweede cadeau oplevert.
  if (stripeConfigured() && paidToken) {
    db.usedCheckoutSessions = db.usedCheckoutSessions || [];
    if (!db.usedCheckoutSessions.includes(paidToken)) db.usedCheckoutSessions.push(paidToken);
  }

  if (due) {
    try {
      await sendGiftEmail({ to: entry.recipient_email, recipientName, senderName: sender?.name, giftCode: code, personalMessage: message, lang: language });
      entry.status = 'sent'; entry.sent_at = new Date().toISOString();
    } catch (err) { console.error('cadeau-mail mislukt:', err.message); entry.status = 'pending'; }
  }
  await saveDB(db);

  if (sender?.email) {
    sendGiftConfirmationEmail({ to: sender.email, senderName: sender.name, recipientEmail: entry.recipient_email, sendDate: due ? 'now' : sendDate, giftCode: code, lang: language })
      .catch(e => console.error('cadeau-bevestiging mislukt:', e.message));
  }
  res.json({ ok: true, code, scheduled: !due, sendDate: due ? null : sendDate });
});

// Verwerkt ingeplande cadeaus waarvan de datum bereikt is (voor scheduled function).
app.post('/api/gift/process', async (req, res) => {
  const db = await loadDB();
  const due = (db.giftCodes || []).filter(g => g.status === 'pending' && giftIsDue(g.send_date));
  let sent = 0;
  for (const g of due) {
    try {
      const sender = db.users.find(u => u.id === g.owner_user_id);
      await sendGiftEmail({ to: g.recipient_email, recipientName: g.recipient_name, senderName: sender?.name, giftCode: g.code, personalMessage: g.message, lang: g.lang });
      g.status = 'sent'; g.sent_at = new Date().toISOString(); sent++;
    } catch (err) { console.error(`cadeau ${g.code} mislukt:`, err.message); }
  }
  if (sent) await saveDB(db);
  res.json({ ok: true, sent });
});

// ── AI Companion & dashboard-data ────────────────────────────────────────────
const { companionChat, companionConfigured, companionTurn, emptyCompanionState } = require('../../lib/companion-llm');

// Verzamelt alles wat het dashboard en de companion nodig hebben voor deze
// gebruiker: laatste order, berekende kaart/getallen (laag 1) en de
// blueprint-teksten uit de database (laag 2).
async function companionContext(userId, langOverride) {
  const db = await loadDB();
  if (ensureTokens(db)) await saveDB(db);
  const orders = db.orders.filter(o => o.user_id === userId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const order = orders.find(o => o.status === 'completed') || orders[0] || null;
  if (!order || order.status !== 'completed') return { order };

  const lang = langOverride === 'en' ? 'en'
    : langOverride === 'nl' ? 'nl'
    : (order.blueprint_language === 'en' ? 'en' : 'nl');
  const textsAll = await blueprintStore().get(`${order.id}.texts.json`, { type: 'json' });
  const texts = textsAll ? (textsAll[lang] || textsAll.nl) : null;

  const { buildContext } = require('../../lib/pipeline');
  const { calcPersonalMonths, calcPersonalDay, DAY_INFO } = require('../../lib/numerology');
  const { currentSky } = require('../../lib/astro');

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

function fmtPos(p) {
  return p && p.sign !== '?'
    ? { sign: p.sign, signEn: p.signEn, deg: p.deg, min: p.min, house: p.house || null, retro: !!p.retrograde }
    : null;
}

// ── Engelse vertalingen voor de companion (labels + dagduiding) ───────────────
const SIGN_EN = {
  Ram: 'Aries', Stier: 'Taurus', Tweelingen: 'Gemini', Kreeft: 'Cancer',
  Leeuw: 'Leo', Maagd: 'Virgo', Weegschaal: 'Libra', Schorpioen: 'Scorpio',
  Boogschutter: 'Sagittarius', Steenbok: 'Capricorn', Waterman: 'Aquarius', Vissen: 'Pisces',
};
const signT = (lang, s) => (lang === 'en' ? (SIGN_EN[s] || s) : s);
const DAY_INFO_EN = {
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
const PY_INFO_EN = {
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
const LP_INFO_EN = {
  1:  { name: 'Leader & Pioneer',        challenge: 'self-centredness' },
  2:  { name: 'Mediator & Partner',      challenge: 'dependency' },
  3:  { name: 'Creative Expresser',      challenge: 'scattering' },
  4:  { name: 'Builder & Organiser',     challenge: 'rigidity' },
  5:  { name: 'Freedom Seeker',          challenge: 'impatience' },
  6:  { name: 'Caregiver & Guardian',    challenge: 'perfectionism' },
  7:  { name: 'Seeker & Philosopher',    challenge: 'isolation' },
  8:  { name: 'Material Master',         challenge: 'materialism' },
  9:  { name: 'Humanitarian & Completer', challenge: 'difficulty letting go' },
  11: { name: 'Spiritual Lightbringer', challenge: 'sensitivity' },
  22: { name: 'Master Builder',          challenge: 'perfectionism' },
  33: { name: 'Master Teacher',          challenge: 'self-sacrifice' },
};

// Deterministische dagduiding, opgebouwd uit blueprint-teksten en berekeningen.
// Dient ook als vangnet wanneer de AI (tijdelijk) niet beschikbaar is.
function dayFromBlueprint(c) {
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
  const moonSign = signT(c.lang, c.sky.moonSign || c.sky.moon.sign);
  const pyInfo = en ? (PY_INFO_EN[py] || PY_INFO_EN[9]) : c.ctx.numerology.personalYearInfo;
  if (en) return {
    thema: (t.summary && t.summary.oneLiner) || 'Your blueprint as a compass for today',
    focus: (t.integration && t.integration.layers && t.integration.layers.focus) || 'Take one small, concrete step',
    vraag: questions.length ? questions[dayIdx % questions.length] : 'What asks for your attention today?',
    lucht: `The moon is in ${moonSign} today, ${c.sky.waxing ? 'waxing' : 'waning'}. Your own moon is in ${signT('en', natalMoon.sign)}: use today's energy without losing your own foundation.`,
    numFocus: DAY_INFO_EN[c.pd] || DAY_INFO_EN[9],
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

function companionSystem(c) {
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

// Alle blueprint-data voor de dashboardblokken
app.get('/api/companion/blueprint', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Niet ingelogd' });
  const c = await companionContext(req.auth.userId, req.query.lang);
  if (!c.order) {
    // Geen aanvraag: wél een opgeslagen concept? Dan 'draft' zodat het
    // dashboard "maak je vragenlijst af" kan tonen i.p.v. "geen aanvraag".
    const db = await loadDB();
    const user = db.users.find(u => u.id === req.auth.userId);
    return res.json({ status: (user && user.intake_draft) ? 'draft' : 'none' });
  }
  if (!c.ctx) return res.json({ status: c.order.status, orderId: c.order.id, clientName: c.order.client_name });

  const { generateMiniMandalaSVG } = require('../../lib/mandala');
  const P = c.ctx.chart.planets;
  const n = c.ctx.numerology;

  // De dagelijks veranderende duiding hoort bij dashboard-toegang (proef of
  // abonnement); de blueprint zelf (eenmalig gekocht) blijft altijd zichtbaar.
  const acc = await accessState(await loadDB(), req);
  const subscribed = acc.dashboardOpen;

  res.json({
    subscribed,
    paid: acc.paid,
    trial: acc.trial,
    trialDaysLeft: acc.trialDaysLeft,
    companionLimit: Number.isFinite(acc.companionLimit) ? acc.companionLimit : null,
    companionLeft: Number.isFinite(acc.companionLeft) ? acc.companionLeft : null,
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
      sun: fmtPos(P.sun), moon: fmtPos(P.moon), ascendant: fmtPos(P.ascendant),
      northNode: fmtPos(P.northNode), southNode: fmtPos(P.southNode), chiron: fmtPos(P.chiron),
    },
    numerology: (() => {
      const en = c.lang === 'en';
      const lp = en ? (LP_INFO_EN[n.lifePath] || n.lifePathInfo) : n.lifePathInfo;
      const py = en ? (PY_INFO_EN[n.personalYear] || n.personalYearInfo) : n.personalYearInfo;
      return {
        lifePath: n.lifePath, lifePathName: lp.name, lifePathShadow: lp.challenge,
        personalYear: n.personalYear, personalYearTheme: py.theme, personalYearEnergy: py.energy,
        personalMonth: c.pm.number, personalDay: c.pd,
        expression: n.expression, soulUrge: n.soulUrge, personality: n.personality,
      };
    })(),
    sky: {
      moonSign: signT(c.lang, c.sky.moon.sign), waxing: c.sky.waxing,
      nextNewMoon: c.sky.nextNewMoon ? { date: c.sky.nextNewMoon.date, sign: signT(c.lang, c.sky.nextNewMoon.sign) } : null,
      nextFullMoon: c.sky.nextFullMoon ? { date: c.sky.nextFullMoon.date, sign: signT(c.lang, c.sky.nextFullMoon.sign) } : null,
      solarReturn: { date: c.solar, sign: signT(c.lang, P.sun.sign) },
    },
    day: subscribed ? dayFromBlueprint(c) : null,
    texts: c.texts,
    mandala: generateMiniMandalaSVG(c.ctx.chart),
    blueprintUrl: c.order.blueprint_url,
    blueprintLanguages: c.order.blueprint_languages || ['nl'],
    pdfAvailable: !!c.order.pdf_available,
  });
});

// Dagduiding vernieuwen: AI-versie met de blueprint-fallback als vangnet
app.post('/api/companion/day', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Niet ingelogd' });
  // Dagelijkse duiding hoort bij dashboard-toegang (proef of abonnement).
  const dayLang = (req.body?.lang === 'en' || req.query.lang === 'en') ? 'en' : 'nl';
  if (!(await accessState(await loadDB(), req)).dashboardOpen)
    return res.status(402).json({ error: dayLang === 'en'
      ? 'Your 11-day trial has ended. Subscribe (€3.69/month) for your daily reading.'
      : 'Je proefperiode van 11 dagen is voorbij. Neem het abonnement (€3,69/mnd) voor je dagelijkse duiding.', subscribe: true });

  const c = await companionContext(req.auth.userId, req.body?.lang || req.query.lang);
  if (!c.ctx) return res.status(400).json({ error: 'Nog geen voltooide blueprint' });

  const fallback = dayFromBlueprint(c);
  if (!companionConfigured()) return res.json({ source: 'blueprint', ...fallback });

  try {
    const str = { type: 'string' };
    const schema = {
      type: 'object', additionalProperties: false,
      properties: { thema: str, focus: str, vraag: str, lucht: str, numFocus: str, numReminder: str, gaven: str },
      required: ['thema', 'focus', 'vraag', 'lucht', 'numFocus', 'numReminder', 'gaven'],
    };
    const userPrompt = c.lang === 'en'
      ? `Generate today's daily reading in ENGLISH, fully grounded in the fixed data. Fields: thema (short powerful sentence), focus (one concrete small step), vraag (one reflection question), lucht (2-3 sentences about today's moon linked to the natal moon), numFocus (1 sentence for Personal Day ${c.pd}), numReminder (1 sentence for Personal Year ${c.ctx.numerology.personalYear}), gaven (1 sentence: which 2 of the six gifts light up today and why).`
      : `Genereer de dagduiding voor vandaag, volledig gegrond in de vaste gegevens. Velden: thema (korte krachtige zin), focus (één concrete kleine stap), vraag (één reflectievraag), lucht (2-3 zinnen over de maanstand vandaag gekoppeld aan de geboortemaan), numFocus (1 zin bij Persoonlijke Dag ${c.pd}), numReminder (1 zin bij Persoonlijk Jaar ${c.ctx.numerology.personalYear}), gaven (1 zin: welke 2 van de zes gaven vandaag oplichten en waarom).`;
    const reading = await companionChat({
      system: companionSystem(c),
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 700,
      jsonSchema: schema,
    });
    res.json({ source: 'ai', ...reading });
  } catch (err) {
    console.error('companion/day AI-fout:', err.message);
    res.json({ source: 'blueprint', ...fallback });
  }
});

// Gesprek met de Companion (kent de kaart en blueprint van de gebruiker).
// De geschiedenis en het samengevatte geheugen leven per account op de server
// (user.companion), zodat een nieuwe sessie naadloos verdergaat waar de vorige
// ophield — de client stuurt alleen het nieuwste bericht.
app.post('/api/companion/chat', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Niet ingelogd' });
  if (!companionConfigured()) return res.json({ content: 'De Companion is nog niet geactiveerd. Stel COMPANION_API_KEY (Gemini) in via Netlify → Site settings → Environment variables.' });

  const lang = (req.body?.lang === 'en') ? 'en' : 'nl';
  // Nieuw formaat: { message }. Oude clients sturen { messages: [...] } — pak daaruit de laatste gebruikersbeurt.
  const userMessage = String(req.body?.message
    || (Array.isArray(req.body?.messages) ? [...req.body.messages].reverse().find(m => m.role === 'user')?.content : '')
    || '').trim().slice(0, 4000);
  if (!userMessage) return res.status(400).json({ error: 'Geen bericht' });

  // Companion hoort bij dashboard-toegang (proef of abonnement), met een
  // vragenlimiet per account: 3 tijdens de proef, 10 per maand met abonnement.
  const db  = await loadDB();
  const acc = await accessState(db, req);
  if (!acc.dashboardOpen)
    return res.status(402).json({ error: lang === 'en'
      ? 'Your 11-day trial has ended. Subscribe (€3.69/month) to keep talking with your Companion.'
      : 'Je proefperiode van 11 dagen is voorbij. Neem het abonnement (€3,69/mnd) om verder te praten met je Companion.', subscribe: true });
  if (acc.companionLeft <= 0)
    return res.status(429).json({ error: acc.paid
      ? (lang === 'en' ? `You've reached your ${SUB_COMPANION_LIMIT} Companion questions for this month. They renew next month.`
                       : `Je hebt je ${SUB_COMPANION_LIMIT} Companion-vragen voor deze maand bereikt. Ze vernieuwen volgende maand.`)
      : (lang === 'en' ? `You've used your ${TRIAL_COMPANION_LIMIT} trial questions. Subscribe (€3.69/month) for ${SUB_COMPANION_LIMIT} questions a month.`
                       : `Je hebt je ${TRIAL_COMPANION_LIMIT} proefvragen gebruikt. Neem het abonnement (€3,69/mnd) voor ${SUB_COMPANION_LIMIT} vragen per maand.`),
      subscribe: !acc.paid, limitReached: true });

  let system = lang === 'en'
    ? 'You are the SZINN AI Companion — warm, clear, practical. No bullet points. Write flowing sentences in English.'
    : 'Je bent de SZINN AI Companion — warm, helder, praktisch. Spreek de gebruiker aan met jij/jouw. Geen bullet points. Schrijf vloeiende zinnen.';
  let intakeRaw = null, name = null;
  try {
    const c = await companionContext(req.auth.userId, lang);
    if (c.ctx) { system = companionSystem(c); intakeRaw = c.ctx.intake.raw; name = c.ctx.intake.clientName; }
  } catch (e) { /* generieke system prompt volstaat */ }

  const user = acc.user; // al geladen bij de toegangscheck hierboven
  if (!user) return res.status(401).json({ error: 'Gebruiker niet gevonden' });
  user.companion = user.companion || emptyCompanionState();

  try {
    const content = await companionTurn({ state: user.companion, userMessage, baseSystem: system, name, intakeRaw, lang });
    bumpCompanionUsage(user, acc.paid); // teller +1 na een gelukte beurt
    await saveDB(db);
    res.json({ content, companionLeft: Number.isFinite(acc.companionLeft) ? acc.companionLeft - 1 : null });
  } catch (err) {
    console.error('companion/chat fout:', err.message);
    res.status(500).json({ error: 'AI Companion tijdelijk niet beschikbaar.' });
  }
});

// Gespreksgeschiedenis voor het dashboard: zo gaat een nieuwe sessie verder
// waar de vorige ophield i.p.v. met een leeg venster.
app.get('/api/companion/history', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Niet ingelogd' });
  const db = await loadDB();
  const user = db.users.find(u => u.id === req.auth.userId);
  // Quota mee zodat de drawer tijdens de proef "nog X van 3 vragen" kan tonen.
  const acc = await accessState(db, req);
  res.json({
    messages: (user?.companion?.messages || []).slice(-30),
    trial: acc.trial, paid: acc.paid,
    companionLeft: Number.isFinite(acc.companionLeft) ? acc.companionLeft : null,
    companionLimit: Number.isFinite(acc.companionLimit) ? acc.companionLimit : null,
  });
});

// ── Meldingsvoorkeur (WhatsApp / e-mail / uit) voor de dagelijkse reminder ────
// Het nummer wordt voorgevuld met wat al bij het account staat (users.phone).
app.get('/api/settings/notifications', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Niet ingelogd' });
  const db = await loadDB();
  const u = db.users.find(u => u.id === req.auth.userId);
  if (!u) return res.status(401).json({ error: 'Gebruiker niet gevonden' });
  res.json({ channel: u.notify_channel || 'off', phone: u.phone || '', email: u.email });
});

app.post('/api/settings/notifications', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Niet ingelogd' });
  const channel = String(req.body?.channel || '').trim();
  if (!['whatsapp', 'email', 'off'].includes(channel))
    return res.status(400).json({ error: 'Ongeldige keuze' });
  const phone = normalizePhone(req.body?.phone);
  if (channel === 'whatsapp' && (!phone || phone.replace(/\D/g, '').length < 8))
    return res.status(400).json({ error: 'Vul een geldig telefoonnummer in (met landcode, bijv. 316…)' });
  const db = await loadDB();
  const u = db.users.find(u => u.id === req.auth.userId);
  if (!u) return res.status(401).json({ error: 'Gebruiker niet gevonden' });
  u.notify_channel = channel;
  if (phone) u.phone = phone;
  await saveDB(db);
  res.json({ ok: true, channel, phone: u.phone || '' });
});

// ── Intake-toegang: alleen na betaling (of met cadeaucode) ───────────────────
// De betaallink (buy.stripe.com) stuurt na betaling door naar
// /intake?session_id={CHECKOUT_SESSION_ID}; die sessie verifiëren we bij Stripe.
// Toegang wordt daarna 24 uur vastgehouden in een eigen JWT-cookie, zodat de
// gebruiker rustig kan invullen (en een concept later kan afmaken).
const {
  stripeReq, stripeConfigured,
  createSubscriptionCheckout, createGiftCheckout, summarizeSub, subIsActive, refreshSubIfStale, cancelSubscription,
} = require('../../lib/stripe');
const INTAKE_PAY_LINK = process.env.INTAKE_PAY_LINK || 'https://buy.stripe.com/fZu9AL8g20KT5xgdpO0kE00';
// Engelse betaallink (eigen redirect naar /intake-en); zolang die er nog niet
// is valt de Engelse intake terug op de Nederlandse link.
const INTAKE_PAY_LINK_EN = process.env.INTAKE_PAY_LINK_EN || INTAKE_PAY_LINK;

function setIntakeCookie(res, payload) {
  const token = jwt.sign({ intake: true, ...payload }, JWT_SECRET, { expiresIn: '24h' });
  // Naast het auth-cookie: intake-toegang staat los van ingelogd zijn.
  const prev = res.getHeader('Set-Cookie');
  const cookie = cookieLib.serialize('szinn_intake', token, { httpOnly: true, sameSite: 'lax', secure: true, maxAge: 86400, path: '/' });
  res.setHeader('Set-Cookie', prev ? [].concat(prev, cookie) : cookie);
}

// Wie mag de intake in? { ok, sid?, code? } — sid/code gaan mee zodat de
// submit ze als 'gebruikt' kan markeren (één intake per betaling/cadeau).
async function intakeAccess(req, db, { sessionId, code } = {}) {
  if (req.auth?.isAdmin) return { ok: true };
  if (req.auth) {
    const u = db.users.find(u => u.id === req.auth.userId);
    // Heractivering door admin: eenmalig een nieuwe intake zonder betaling;
    // de submit verbruikt de toekenning via grantUserId.
    if (u?.intake_grant) return { ok: true, grantUserId: u.id };
    if (u?.intake_draft) return { ok: true }; // had al toegang: concept staat klaar
  }
  const cookies = cookieLib.parse(req.headers.cookie || '');
  if (cookies.szinn_intake) {
    try {
      const t = jwt.verify(cookies.szinn_intake, JWT_SECRET);
      const sidUsed = t.sid && (db.usedCheckoutSessions || []).includes(t.sid);
      const codeUsed = t.code && (db.giftCodes || []).find(c => c.code === t.code)?.redeemed_at;
      if (t.intake && !sidUsed && !codeUsed)
        return { ok: true, sid: t.sid || null, code: t.code || null };
    } catch {}
  }
  if (sessionId && stripeConfigured()) {
    if ((db.usedCheckoutSessions || []).includes(sessionId)) return { ok: false };
    try {
      const s = await stripeReq('GET', `/checkout/sessions/${encodeURIComponent(sessionId)}`);
      // 100%-kortingscode → Stripe zet no_payment_required i.p.v. paid; ook geldig.
      if (s.status === 'complete' && (s.payment_status === 'paid' || s.payment_status === 'no_payment_required'))
        return { ok: true, sid: sessionId, fresh: true };
    } catch (e) { console.error('checkout-sessie verifiëren mislukt:', e.message); }
  }
  if (code) {
    const g = (db.giftCodes || []).find(c => c.code === String(code).trim().toUpperCase());
    if (g && !g.redeemed_at) return { ok: true, code: g.code, fresh: true };
  }
  // Zonder Stripe-sleutel (lokaal ontwikkelen) niet blokkeren.
  if (!stripeConfigured()) return { ok: true };
  return { ok: false };
}

// Poortwachter voor de intake-pagina: verifieert betaling/cadeaucode en zet
// bij succes het toegangscookie. De pagina zelf roept dit aan vóór hij toont.
app.post('/api/intake/access', async (req, res) => {
  const db = await loadDB();
  const access = await intakeAccess(req, db, {
    sessionId: req.body?.session_id || null,
    code: req.body?.code || null,
  });
  if (!access.ok) return res.status(402).json({ ok: false, payLink: INTAKE_PAY_LINK, payLinkEn: INTAKE_PAY_LINK_EN });
  if (access.fresh) setIntakeCookie(res, { sid: access.sid || null, code: access.code || null });
  res.json({ ok: true });
});

// ── Dagboek: dagstart & dagafsluiting (kalender + popup in het dashboard) ─────
// Eén entry per gebruiker per dag in user.journal ('YYYY-MM-DD' → entry);
// merge/validatie in lib/journal.js (gedeeld met server.js).
const { DATE_RE, mergeJournalEntry } = require('../../lib/journal');

app.get('/api/journal', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Niet ingelogd' });
  const db = await loadDB();
  const user = db.users.find(u => u.id === req.auth.userId);
  res.json({ entries: (user && user.journal) || {} });
});

app.post('/api/journal', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Niet ingelogd' });
  const date = String(req.body?.date || '');
  if (!DATE_RE.test(date)) return res.status(400).json({ error: 'Ongeldige datum' });
  const db = await loadDB();
  const user = db.users.find(u => u.id === req.auth.userId);
  if (!user) return res.status(401).json({ error: 'Gebruiker niet gevonden' });
  user.journal = user.journal || {};
  user.journal[date] = mergeJournalEntry(user.journal[date], req.body);
  // Cap: bewaar de laatste 200 dagen (het dashboard kijkt hooguit maanden terug).
  const keys = Object.keys(user.journal).sort();
  while (keys.length > 200) delete user.journal[keys.shift()];
  await saveDB(db);
  res.json({ ok: true, date, entry: user.journal[date] });
});

// ── Feedback (publiek formulier op /feedback en /en/feedback) ─────────────────
const { validateFeedback } = require('../../lib/feedback');

app.post('/api/feedback', async (req, res) => {
  const fb = validateFeedback(req.body);
  if (fb.error) return res.status(400).json({ error: fb.error });
  const db = await loadDB();
  db.feedback = db.feedback || [];
  db.nextFeedbackId = db.nextFeedbackId || 1;
  db.feedback.push({ id: db.nextFeedbackId++, created_at: new Date().toISOString(), ...fb });
  await saveDB(db);
  res.json({ ok: true });
});

// Korte AI-samenvatting van het dagboek (ochtend + avond) van de gebruiker, plus
// tellingen voor het ritme-overzicht op het dashboard. Valt zonder AI-sleutel
// terug op een simpele telling. ponytail: alleen op de Netlify-api toegevoegd;
// server.js (lokaal) heeft geen companionChat — daar degradeert de UI naar de telling.
app.get('/api/companion/journal-summary', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Niet ingelogd' });
  const lang = req.query.lang === 'en' ? 'en' : 'nl';
  const db = await loadDB();
  const user = db.users.find(u => u.id === req.auth.userId);
  const journal = (user && user.journal) || {};
  const dates = Object.keys(journal).sort().slice(-21);
  if (!dates.length) return res.json({ summary: null, morningCount: 0, eveningCount: 0, days: 0 });

  let morningCount = 0, eveningCount = 0;
  const lines = dates.map(d => {
    const e = journal[d] || {};
    if (e.morning) morningCount++;
    if (e.evening) eveningCount++;
    const m = e.morning ? `ochtend — intentie: ${e.morning.intention || '-'}; gevoel: ${e.morning.feeling || '-'}; dankbaar: ${(e.morning.gratitude || []).join(', ') || '-'}` : '';
    const ev = e.evening ? `avond — helderheid: ${e.evening.clarity ?? '-'}/10; dankbaar: ${(e.evening.gratitude || []).join(', ') || '-'}; notitie: ${e.evening.note || '-'}` : '';
    return `${d}: ${[m, ev].filter(Boolean).join(' | ')}`;
  }).join('\n');
  const counts = { morningCount, eveningCount, days: dates.length };

  if (!companionConfigured()) {
    return res.json({
      summary: lang === 'en'
        ? `You checked in on ${morningCount} mornings and ${eveningCount} evenings across your last ${dates.length} logged days.`
        : `Je checkte de afgelopen ${dates.length} genoteerde dagen ${morningCount} ochtenden en ${eveningCount} avonden in.`,
      ...counts,
    });
  }
  try {
    const system = lang === 'en'
      ? 'You are the SZINN AI Companion. Warm, clear, practical. Given a journal, write ONE short paragraph (max 3 sentences) reflecting the pattern and tone across the days. Speak to the user with you/your. No bullet points.'
      : 'Je bent de SZINN AI Companion. Warm, helder, praktisch. Schrijf op basis van het dagboek ÉÉN korte alinea (max 3 zinnen) die het patroon en de toon over de dagen weerspiegelt. Spreek de gebruiker aan met jij/jouw. Geen bullet points.';
    const out = await companionChat({
      system,
      messages: [{ role: 'user', content: (lang === 'en' ? 'My recent journal:\n' : 'Mijn recente dagboek:\n') + lines }],
      maxTokens: 300,
      jsonSchema: { type: 'object', additionalProperties: false, properties: { summary: { type: 'string' } }, required: ['summary'] },
    });
    res.json({ summary: out.summary, ...counts });
  } catch (err) {
    console.error('journal-summary AI-fout:', err.message);
    res.json({ summary: null, ...counts });
  }
});

// ── Abonnement €3,69/mnd: daily dashboard + WhatsApp-reminders + companion ───
// Afsluiten vanuit het dashboard: wij maken een Stripe Checkout-sessie
// (mode=subscription) aan; Stripe maakt product/prijs/klant zelf aan.
const SITE_URL = (process.env.URL || 'https://szinn.ai').replace(/\/+$/, '');

// Actuele status voor deze gebruiker; ververst hooguit één keer per dag bij
// Stripe (geen webhook nodig) en slaat het resultaat terug op.
async function userSubscription(db, user) {
  if (!user?.subscription?.id) return null;
  try {
    const fresh = await refreshSubIfStale(user.subscription);
    if (fresh !== user.subscription) { user.subscription = fresh; await saveDB(db); }
  } catch (e) { console.error('abonnement verversen mislukt:', e.message); }
  return user.subscription;
}

// Wie mag de betaalde companion-/daily-functies gebruiken?
// Admin en demo-accounts altijd; zonder Stripe-sleutel (lokaal) niet blokkeren.
async function hasSubscriptionAccess(db, req) {
  if (!stripeConfigured()) return true;
  if (req.auth?.isAdmin) return true;
  const user = db.users.find(u => u.id === req.auth.userId);
  if (!user) return false;
  // Admin-override per account gaat vóór demo/abonnement.
  if (user.dashboard_access === 'off') return false;
  if (user.dashboard_access === 'on') return true;
  if (user.email.toLowerCase() === DEMO_EMAIL || user.email.toLowerCase() === 'demo-plus@szinn.ai') return true;
  return subIsActive(await userSubscription(db, user));
}

// ── Proefperiode (11 dagen) + Companion-quota ────────────────────────────────
// Nieuw account → 11 dagen gratis dashboard-toegang; daarna alleen met een
// abonnement (€3,69/mnd). Companion: 3 vragen in de proef (totaal), 10 per
// maand met abonnement. Alles per account bijgehouden in user.companion_usage.
const TRIAL_DAYS             = parseInt(process.env.TRIAL_DAYS || '11', 10);
const TRIAL_COMPANION_LIMIT  = parseInt(process.env.TRIAL_COMPANION_LIMIT || '3', 10);
const SUB_COMPANION_LIMIT    = parseInt(process.env.SUB_COMPANION_LIMIT || '10', 10);

function trialDaysLeft(user) {
  if (!user?.created_at) return 0;
  const elapsedDays = (Date.now() - new Date(user.created_at).getTime()) / 86400000;
  return Math.max(0, Math.ceil(TRIAL_DAYS - elapsedDays));
}
function currentMonthKey(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
// Lees-only: hoeveel Companion-vragen zijn al gebruikt in het lopende venster.
function companionUsedAndLimit(user, paid) {
  const u = user.companion_usage || {};
  if (paid) {
    const used = (u.month === currentMonthKey()) ? (u.monthCount || 0) : 0; // maandwissel = reset
    return { used, limit: SUB_COMPANION_LIMIT };
  }
  return { used: u.trial || 0, limit: TRIAL_COMPANION_LIMIT };
}
// Muteert de teller na een gelukte Companion-beurt (caller doet saveDB).
function bumpCompanionUsage(user, paid) {
  const u = user.companion_usage || (user.companion_usage = { trial: 0, month: null, monthCount: 0 });
  if (paid) {
    const mk = currentMonthKey();
    if (u.month !== mk) { u.month = mk; u.monthCount = 0; }
    u.monthCount = (u.monthCount || 0) + 1;
  } else {
    u.trial = (u.trial || 0) + 1;
  }
}

// Centrale toegangsstatus voor dashboard + Companion.
//   unlimited → admin/demo of geen Stripe-sleutel (lokaal): alles open
//   paid      → lopend abonnement (10 vragen/maand)
//   trial     → binnen de 11-daagse proef (3 vragen totaal, dashboard open)
//   anders    → dashboard op slot, companion uit tot er wordt geabonneerd
async function accessState(db, req) {
  const user = req.auth ? db.users.find(u => u.id === req.auth.userId) : null;
  const unlimited = !stripeConfigured() || !!req.auth?.isAdmin ||
    (!!user && (user.email.toLowerCase() === DEMO_EMAIL || user.email.toLowerCase() === 'demo-plus@szinn.ai'));
  if (!user) {
    return { user: null, paid: false, trial: false, unlimited, dashboardOpen: unlimited,
      trialDaysLeft: 0, companionUsed: 0, companionLimit: unlimited ? Infinity : 0, companionLeft: unlimited ? Infinity : 0 };
  }
  // Admin-override per account: 'on' = altijd toegang (telt als abonnement voor
  // het companion-quotum), 'off' = dashboard dicht ondanks proef/abonnement.
  const override = user.dashboard_access || null;
  const paid  = override === 'on' || subIsActive(await userSubscription(db, user));
  const left  = trialDaysLeft(user);
  const trial = !paid && left > 0;
  const dashboardOpen = override === 'off' ? false : (unlimited || paid || trial);
  const { used, limit } = companionUsedAndLimit(user, paid);
  const companionLimit = unlimited ? Infinity : (dashboardOpen ? limit : 0);
  const companionLeft  = unlimited ? Infinity : Math.max(0, companionLimit - used);
  return { user, paid, trial, unlimited, dashboardOpen, trialDaysLeft: left,
    companionUsed: used, companionLimit, companionLeft };
}

app.post('/api/subscription/checkout', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Niet ingelogd' });
  if (!stripeConfigured()) return res.status(501).json({ error: 'Stripe nog niet ingesteld (STRIPE_SECRET_KEY).' });
  const db = await loadDB();
  const user = db.users.find(u => u.id === req.auth.userId);
  if (!user) return res.status(401).json({ error: 'Gebruiker niet gevonden' });
  if (subIsActive(await userSubscription(db, user)))
    return res.status(400).json({ error: 'Je hebt al een lopend abonnement.' });
  const session = await createSubscriptionCheckout({ email: user.email, userId: user.id, baseUrl: SITE_URL });
  res.json({ url: session.url });
});

// Terug van Stripe (success_url bevat ?sub_session=…): sessie verifiëren en
// het abonnement aan het account koppelen.
app.post('/api/subscription/confirm', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Niet ingelogd' });
  const sid = String(req.body?.session_id || '').trim();
  if (!sid) return res.status(400).json({ error: 'session_id verplicht' });
  const s = await stripeReq('GET', `/checkout/sessions/${encodeURIComponent(sid)}`);
  if (s.mode !== 'subscription' || !s.subscription || String(s.client_reference_id) !== String(req.auth.userId))
    return res.status(400).json({ error: 'Deze betaalsessie hoort niet bij dit account.' });
  const sub = await stripeReq('GET', `/subscriptions/${s.subscription}`);
  const db = await loadDB();
  const user = db.users.find(u => u.id === req.auth.userId);
  if (!user) return res.status(401).json({ error: 'Gebruiker niet gevonden' });
  user.subscription = summarizeSub(sub);
  await saveDB(db);
  res.json({ ok: true, active: subIsActive(user.subscription) });
});

app.get('/api/subscription/status', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Niet ingelogd' });
  const db = await loadDB();
  const user = db.users.find(u => u.id === req.auth.userId);
  const sub = user ? await userSubscription(db, user) : null;
  const acc = await accessState(db, req);
  res.json({
    active: subIsActive(sub) || await hasSubscriptionAccess(db, req),
    status: sub?.status || null,
    cancelAtPeriodEnd: !!sub?.cancel_at_period_end,
    currentPeriodEnd: sub?.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
    configured: stripeConfigured(),
    trial: acc.trial,
    trialDaysLeft: acc.trialDaysLeft,
    paid: acc.paid,
  });
});

app.post('/api/subscription/cancel', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Niet ingelogd' });
  const db = await loadDB();
  const user = db.users.find(u => u.id === req.auth.userId);
  if (!user?.subscription?.id) return res.status(400).json({ error: 'Geen lopend abonnement' });
  const sub = await cancelSubscription(user.subscription.id);
  user.subscription = summarizeSub(sub);
  await saveDB(db);
  res.json({ ok: true, cancelAtPeriodEnd: true, currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null });
});

// ── Intake concept (tussentijds opslaan) ─────────────────────────────────────
// Slaat een half ingevulde vragenlijst op in het account. Zonder account wordt
// er één aangemaakt (met mail + inloggegevens). Een bestaand e-mailadres van
// iemand die níét is ingelogd wordt geweigerd: anders zou je andermans account
// kunnen vullen of overnemen.
// Telefoon → kaal internationaal formaat voor WhatsApp (Meta wil geen + of spaties).
// NL-centrisch: leidende 0 wordt 31. ponytail: enkel NL/E.164, uitbreiden zodra nodig.
function normalizePhone(raw) {
  if (!raw) return null;
  let d = String(raw).replace(/[^\d]/g, '');
  if (d.startsWith('0')) d = '31' + d.slice(1);
  return d.length >= 10 ? d : null;
}

app.post('/api/intake/draft', async (req, res) => {
  const data = req.body || {};
  const db   = await loadDB();
  const mailLang = (data.language === 'en' || data.blueprint_taal === 'en') ? 'en' : 'nl';

  let user = req.auth ? db.users.find(u => u.id === req.auth.userId) : null;
  let tempPassword = null;
  if (!user) {
    const email = (data.email || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ error: 'invalid_email' });
    const existing = db.users.find(u => u.email.toLowerCase() === email);
    if (existing) return res.status(409).json({ error: 'account_exists' });
    tempPassword = crypto.randomBytes(4).toString('hex');
    const clientName = `${data.voornaam || ''} ${data.achternaam || ''}`.trim();
    user = {
      id: db.nextUserId++, email,
      password: bcrypt.hashSync(tempPassword, 10),
      name: clientName || email, created_at: new Date().toISOString(),
    };
    db.users.push(user);
    console.log(`Nieuw account via concept-opslag: ${user.email}`);
  }

  const draftPhone = normalizePhone(data.telefoon || data.phone);
  if (draftPhone) user.phone = draftPhone;
  user.intake_draft = { data, updated_at: new Date().toISOString() };
  await saveDB(db);

  if (tempPassword) {
    await sendDraftEmail({ to: user.email, name: user.name, tempPassword, lang: mailLang })
      .catch(err => console.error('concept-mail mislukt:', err.message));
    setAuthCookie(res, { userId: user.id, email: user.email, name: user.name });
  }
  res.json({ ok: true, newAccount: !!tempPassword });
});

// Opgeslagen concept ophalen (alleen je eigen account)
app.get('/api/intake/draft', async (req, res) => {
  if (!req.auth) return res.json({ exists: false });
  const db   = await loadDB();
  const user = db.users.find(u => u.id === req.auth.userId);
  if (!user || !user.intake_draft) return res.json({ exists: false });
  res.json({ exists: true, data: user.intake_draft.data, updatedAt: user.intake_draft.updated_at });
});

// ── Intake submit ─────────────────────────────────────────────────────────────
app.post('/api/intake/submit', async (req, res) => {
  const data = req.body;
  if (!data.email || !data.geboortedatum) return res.status(400).json({ error: 'Email en geboortedatum zijn verplicht' });

  const db         = await loadDB();

  // Betaalpoort: alleen met geverifieerde betaling of cadeaucode (zie intakeAccess).
  const access = await intakeAccess(req, db, { sessionId: data.stripe_session_id || null, code: data.gift_code || null });
  if (!access.ok) return res.status(402).json({ error: 'Deze aanvraag vereist eerst een betaling.', payLink: INTAKE_PAY_LINK });
  const clientName = `${data.voornaam || ''} ${data.achternaam || ''}`.trim();
  let user         = db.users.find(u => u.email.toLowerCase() === data.email.trim().toLowerCase());
  let tempPassword = null;

  if (!user) {
    tempPassword = crypto.randomBytes(4).toString('hex');
    user = {
      id: db.nextUserId++, email: data.email.trim().toLowerCase(),
      password: bcrypt.hashSync(tempPassword, 10), name: clientName || data.email,
      created_at: new Date().toISOString()
    };
    db.users.push(user);
    console.log(`Nieuw account: ${user.email} / ${tempPassword}`);
  }

  const submitPhone = normalizePhone(data.telefoon || data.phone);
  if (submitPhone) user.phone = submitPhone;

  const orderId = `ORD-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const order = {
    id: orderId, user_id: user.id, type: 'personal', status: 'processing',
    view_token: crypto.randomBytes(16).toString('hex'),
    client_name: clientName, birth_date: data.geboortedatum,
    birth_time: data.geboortetijd || null,
    birth_location: data.geboorteplaats_volledig || data.geboorteplaats || null,
    birth_lat: parseFloat(data.geboorte_lat) || null, birth_lng: parseFloat(data.geboorte_lng) || null,
    birth_tz: data.geboorte_tz || null,
    full_birth_name: data.geboortenaam || clientName,
    blueprint_language: data.blueprint_taal || 'nl',
    intake_data: JSON.stringify(data), created_at: new Date().toISOString(),
    completed_at: null, blueprint_url: null,
    alignment_score: null, astro_score: null, numerology_score: null,
    soul_direction_score: null, personal_year_score: null
  };
  db.orders.push(order);
  // Concept opruimen: het formulier is nu definitief ingestuurd
  if (user.intake_draft) user.intake_draft = null;
  // Heractivering verbruiken: één nieuwe intake per toekenning.
  if (access.grantUserId) {
    const gu = db.users.find(u => u.id === access.grantUserId);
    if (gu) gu.intake_grant = false;
  }
  // Betaling/cadeaucode verzilveren: één intake per betaling.
  if (access.sid) {
    db.usedCheckoutSessions = db.usedCheckoutSessions || [];
    db.usedCheckoutSessions.push(access.sid);
  }
  if (access.code) {
    const g = (db.giftCodes || []).find(c => c.code === access.code);
    if (g) { g.redeemed_at = new Date().toISOString(); g.redeemed_order = orderId; }
  }
  await saveDB(db);

  // Mail 1: account + wachtwoord (of "nieuwe blueprint in je bestaande account")
  const mailLang = (order.blueprint_language === 'en') ? 'en' : 'nl';
  await sendAccountEmail({
    to: user.email, name: clientName || user.name,
    tempPassword, isNewAccount: !!tempPassword, lang: mailLang,
  }).catch(err => console.error('account-mail mislukt:', err.message));

  // Admin-notificatie: nieuwe aanvraag binnengekomen
  await sendNewOrderEmail({
    orderId, clientName, email: user.email,
    birthDate: order.birth_date, birthLocation: order.birth_location,
    language: order.blueprint_language,
  }).catch(err => console.error('nieuwe-aanvraag-mail mislukt:', err.message));

  // Automatisch de generatie starten (background function, kan uren-melding tonen)
  await triggerGeneration(orderId, order).catch(err => console.error('generatie-trigger mislukt:', err.message));

  // Auto-login
  setAuthCookie(res, { userId: user.id, email: user.email, name: user.name });

  res.json({
    success: true, orderId,
    loginEmail: data.email, tempPassword,
    message: tempPassword
      ? `Account aangemaakt. Inloggen met: ${data.email} / ${tempPassword}`
      : 'Blueprint wordt samengesteld in je bestaande account'
  });
});

// ── Blueprint serve (via Netlify Blobs) ───────────────────────────────────────
// Alleen de eigenaar (of admin) mag de blueprint zien.
async function authorizedOrder(req, idOrToken) {
  if (!req.auth) return null;
  const db = await loadDB();
  // Resolve op onraadbaar view_token (nieuw) óf op het volgnummer (oude links).
  const order = db.orders.find(o => o.view_token === idOrToken || o.id === idOrToken);
  if (!order) return null;
  if (!req.auth.isAdmin && order.user_id !== req.auth.userId) return null;
  return order;
}

app.get('/szinn-portal/blueprints/:filename', async (req, res) => {
  const orderId = req.params.filename.replace(/\.html$/, '');
  const order = await authorizedOrder(req, orderId);
  if (!order) return res.status(403).send('<h1>Geen toegang</h1><p>Log in op je dashboard om je blueprint te bekijken.</p>');

  const lang = req.query.lang === 'en' ? 'en' : 'nl';
  const store = blueprintStore();
  // Nieuwe pipeline: taalvarianten; oude admin-workflow: kale orderId-key
  const html = (await store.get(`${orderId}.${lang}.html`))
            || (lang === 'en' ? await store.get(`${orderId}.nl.html`) : null)
            || (await store.get(orderId));
  if (html) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Oudere blueprints zijn gerenderd vóór het burgermenu bestond; upgradeNav
    // zet het er alsnog in zodat de navigatie op mobiel niet buiten beeld loopt.
    return res.send(upgradeNav(html));
  }
  res.status(404).send('<h1>Blueprint niet gevonden</h1>');
});

// Een blueprint renderen duurt ruim langer dan de 10 seconden die een gewone
// Netlify-function krijgt. Daarom doet de background function het werk en
// serveert deze route alleen de klaargezette PDF; ontbreekt die, dan zet hij de
// job in gang en antwoordt 202 zodat de viewer kan blijven pollen.
async function triggerPdf(orderId, lang) {
  const base = process.env.URL || process.env.DEPLOY_URL;
  if (!base) return false;
  const res = await fetch(`${base}/.netlify/functions/blueprint-pdf-background`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, lang, secret: TRIGGER_SECRET }),
  });
  console.log(`PDF-generatie getriggerd voor ${orderId} (${lang}): HTTP ${res.status}`);
  return res.status >= 200 && res.status < 300;
}

app.get('/api/orders/:id/pdf', async (req, res) => {
  const order = await authorizedOrder(req, req.params.id);
  if (!order) return res.status(403).json({ error: 'Geen toegang' });
  const lang  = req.query.lang === 'en' ? 'en' : 'nl';
  const store = blueprintStore();
  const name  = (order.client_name || order.id).replace(/[^\w\-]+/g, '-');

  // ?refresh=1 gooit een verouderde PDF weg (bijv. na een nieuwe render van de
  // blueprint) zodat de achtergrondjob hem opnieuw maakt.
  if (req.query.refresh) {
    await store.delete(`${order.id}.${lang}.pdf`).catch(() => {});
    await store.delete(`${order.id}.${lang}.pdf.job`).catch(() => {});
  }

  // 1) Klaargezette PDF (pipeline of een eerdere achtergrondjob)
  const pregen = await store.get(`${order.id}.${lang}.pdf`, { type: 'arrayBuffer' });
  if (pregen) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="SZINN-Blueprint-${name}.pdf"`);
    return res.send(Buffer.from(pregen));
  }

  const html = (await store.get(`${order.id}.${lang}.html`))
            || (lang === 'en' ? await store.get(`${order.id}.nl.html`) : null)
            || (await store.get(order.id));
  if (!html) return res.status(404).json({ error: 'Blueprint nog niet beschikbaar' });

  // 2) Lokaal (netlify dev, geen site-URL): gewoon direct renderen.
  const jobKey = `${order.id}.${lang}.pdf.job`;
  if (!process.env.URL && !process.env.DEPLOY_URL) {
    try {
      const { generatePDF } = require('../../lib/pdf');
      const pdf = await generatePDF(upgradeNav(html));
      try { await store.set(`${order.id}.${lang}.pdf`, pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength)); } catch {}
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="SZINN-Blueprint-${name}.pdf"`);
      return res.send(pdf);
    } catch (err) {
      console.error('Directe PDF mislukt:', err.message);
      return res.status(500).json({ error: `De PDF kon niet worden gemaakt: ${err.message}` });
    }
  }

  // 3) Achtergrondjob: lopend, mislukt of nog te starten
  const job = await store.get(jobKey, { type: 'json' }).catch(() => null);
  if (job && job.error) {
    await store.delete(jobKey).catch(() => {});
    return res.status(500).json({ error: `De PDF kon niet worden gemaakt: ${job.error}` });
  }
  // Een job die er 5 minuten over doet is vastgelopen; dan opnieuw starten.
  const running = job && (Date.now() - Date.parse(job.started)) < 5 * 60 * 1000;
  if (!running) {
    await store.setJSON(jobKey, { started: new Date().toISOString() }).catch(() => {});
    try { await triggerPdf(order.id, lang); } catch (err) { console.error('PDF-trigger mislukt:', err.message); }
  }
  res.status(202).json({ status: 'generating' });
});

// ── Admin ─────────────────────────────────────────────────────────────────────
app.post('/api/admin/login', async (req, res) => {
  const { email, password } = req.body || {};
  const db = await loadDB();
  if (ensureAdminUser(db)) await saveDB(db);

  // De env var ADMIN_PASSWORD is leidend: als die is ingesteld en afwijkt van
  // de opgeslagen hash (bijv. account eerder aangemaakt met het standaard-
  // wachtwoord), wordt de hash bijgewerkt en vervalt het oude wachtwoord.
  if (process.env.ADMIN_PASSWORD) {
    const adminUser = db.users.find(u => u.is_admin && u.email.toLowerCase() === ADMIN_EMAIL);
    if (adminUser && !bcrypt.compareSync(ADMIN_PASSWORD, adminUser.password)) {
      adminUser.password = bcrypt.hashSync(ADMIN_PASSWORD, 10);
      await saveDB(db);
      console.log('Admin-wachtwoord gesynchroniseerd met ADMIN_PASSWORD env var');
    }
  }

  // Inloggen met e-mailadres + wachtwoord tegen het admin-account in de database.
  if (email) {
    const admin = db.users.find(u => u.is_admin && u.email.toLowerCase() === String(email).trim().toLowerCase());
    if (admin && bcrypt.compareSync(password || '', admin.password)) {
      setAuthCookie(res, { isAdmin: true, userId: admin.id, email: admin.email, name: admin.name });
      return res.json({ ok: true });
    }
    return res.status(401).json({ error: 'Onjuist e-mailadres of wachtwoord' });
  }

  // Achterwaarts compatibel: alleen het gedeelde wachtwoord (env ADMIN_PASSWORD).
  if (password === ADMIN_PASSWORD) {
    setAuthCookie(res, { isAdmin: true, userId: 0, email: ADMIN_EMAIL, name: 'Admin' });
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Onjuist wachtwoord' });
});

app.post('/api/admin/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

app.get('/api/admin/orders', async (req, res) => {
  if (!req.auth?.isAdmin) return res.status(401).json({ error: 'Geen toegang' });
  const db = await loadDB();
  const orders = db.orders.map(o => {
    const user = db.users.find(u => u.id === o.user_id);
    return { ...o, email: user?.email, user_name: user?.name };
  }).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(orders);
});

// Feedback-inzendingen (nieuwste eerst) voor het admin-dashboard.
app.get('/api/admin/feedback', async (req, res) => {
  if (!req.auth?.isAdmin) return res.status(401).json({ error: 'Geen toegang' });
  const db = await loadDB();
  res.json((db.feedback || []).slice().sort((a, b) => b.id - a.id).slice(0, 500));
});

// Generatie (opnieuw) starten voor een order — bijv. na een 'failed'
// ── Prompt-instellingen: aanscherping voor alle volgende generaties ─────────
app.get('/api/admin/prompt-settings', async (req, res) => {
  if (!req.auth?.isAdmin) return res.status(401).json({ error: 'Geen toegang' });
  const db = await loadDB();
  const { SYSTEM } = require('../../lib/ai-texts');
  res.json({
    addendum: (db.settings && db.settings.promptAddendum) || '',
    updatedAt: (db.settings && db.settings.promptAddendumUpdatedAt) || null,
    basePrompt: SYSTEM,
  });
});

app.post('/api/admin/prompt-settings', async (req, res) => {
  if (!req.auth?.isAdmin) return res.status(401).json({ error: 'Geen toegang' });
  const addendum = String(req.body?.addendum || '').slice(0, 8000);
  const db = await loadDB();
  db.settings = {
    ...(db.settings || {}),
    promptAddendum: addendum,
    promptAddendumUpdatedAt: new Date().toISOString(),
  };
  await saveDB(db);
  res.json({ ok: true, length: addendum.length });
});

app.post('/api/admin/regenerate/:orderId', async (req, res) => {
  if (!req.auth?.isAdmin) return res.status(401).json({ error: 'Geen toegang' });
  const db = await loadDB();
  const order = db.orders.find(o => o.id === req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Aanvraag niet gevonden' });
  order.status = 'processing';
  order.generation_error = null;
  await saveDB(db);
  const ok = await triggerGeneration(order.id, order);
  res.json({ ok, orderId: order.id });
});

app.get('/api/admin/prompt/:orderId', async (req, res) => {
  if (!req.auth?.isAdmin) return res.status(401).json({ error: 'Geen toegang' });
  const db    = await loadDB();
  const order = db.orders.find(o => o.id === req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Aanvraag niet gevonden' });
  if (!order.intake_data) return res.status(400).json({ error: 'Geen intake-data voor deze aanvraag' });

  try {
    const intake = JSON.parse(order.intake_data);
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

    const { calcBirthChart }             = require('../../lib/astro');
    const { calcAll }                    = require('../../lib/numerology');
    const { buildFullPromptForClaudeAI, generateBirthChartSVG } = require('../../lib/generate-blueprint');

    const chart      = calcBirthChart(order.birth_date, order.birth_time, lat, lng, tzOffset);
    const numData    = calcAll(order.full_birth_name || order.client_name, order.birth_date);
    const svgContent = generateBirthChartSVG(chart);
    const fullPrompt = buildFullPromptForClaudeAI(intake, chart, numData);

    res.json({ prompt: fullPrompt, svg: svgContent, orderId: order.id, clientName: order.client_name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/save-blueprint', async (req, res) => {
  if (!req.auth?.isAdmin) return res.status(401).json({ error: 'Geen toegang' });
  const { orderId, html } = req.body;
  if (!orderId || !html) return res.status(400).json({ error: 'orderId en html verplicht' });

  const db    = await loadDB();
  const order = db.orders.find(o => o.id === orderId);
  if (!order) return res.status(404).json({ error: 'Aanvraag niet gevonden' });

  let cleanHtml = html.replace(/^```(?:html)?\n?/i, '').replace(/\n?```\s*$/, '').trim();

  const scoresMatch = cleanHtml.match(/<!--\s*SZINN_SCORES:\s*(\{[^}]+\})\s*-->/);
  let scores = { alignment: 72, astro: 72, numerology: 72, soulDirection: 72, personalYear: 72 };
  if (scoresMatch) { try { scores = JSON.parse(scoresMatch[1]); } catch {} }

  // Inject SVG if placeholder present
  if (cleanHtml.includes('{{MANDALA_SVG}}')) {
    try {
      const intake = JSON.parse(order.intake_data || '{}');
      const lat    = order.birth_lat || parseFloat(intake.geboorte_lat) || 52.37;
      const lng    = order.birth_lng || parseFloat(intake.geboorte_lng) || 4.9;
      const { calcBirthChart }      = require('../../lib/astro');
      const { generateBirthChartSVG } = require('../../lib/generate-blueprint');
      const chart  = calcBirthChart(order.birth_date, order.birth_time, lat, lng, 1);
      cleanHtml    = cleanHtml.replace('{{MANDALA_SVG}}', `<div class="mandala-svg">${generateBirthChartSVG(chart)}</div>`);
    } catch {}
  }

  // Save HTML to Netlify Blobs
  await blueprintStore().set(orderId, cleanHtml);

  // Update order in DB
  order.status               = 'completed';
  order.completed_at         = new Date().toISOString();
  order.blueprint_url        = `/szinn-portal/blueprints/${orderId}.html`;
  order.alignment_score      = scores.alignment;
  order.astro_score          = scores.astro;
  order.numerology_score     = scores.numerology;
  order.soul_direction_score = scores.soulDirection;
  order.personal_year_score  = scores.personalYear;
  await saveDB(db);

  console.log(`Blueprint opgeslagen via admin: ${orderId}`);
  res.json({ ok: true, blueprintUrl: `/szinn-portal/blueprints/${orderId}.html` });
});

// ── Status van een aanvraag handmatig wijzigen ─────────────────────────────────
// Zo kan de beheerder een blueprint die klaar is maar nog op "In behandeling"
// staat, op "Klaar" zetten zodat de klant hem kan inzien.
app.post('/api/admin/order/:orderId/status', async (req, res) => {
  if (!req.auth?.isAdmin) return res.status(401).json({ error: 'Geen toegang' });
  const status = String(req.body?.status || '').trim();
  const ALLOWED = ['questionnaire', 'processing', 'completed', 'failed'];
  if (!ALLOWED.includes(status)) return res.status(400).json({ error: 'Onbekende status' });

  const db    = await loadDB();
  const order = db.orders.find(o => o.id === req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Aanvraag niet gevonden' });

  // Op "Klaar" zetten mag alleen als er echt een blueprint klaarstaat.
  if (status === 'completed' && !order.blueprint_url) {
    return res.status(400).json({ error: 'Er staat nog geen blueprint klaar voor deze aanvraag — op "Klaar" zetten zou de klant een lege pagina tonen. Sla eerst een blueprint op.' });
  }

  order.status = status;
  if (status === 'completed' && !order.completed_at) order.completed_at = new Date().toISOString();
  if (status !== 'failed') order.generation_error = null;
  await saveDB(db);

  console.log(`Status gewijzigd via admin: ${order.id} → ${status}`);
  res.json({ ok: true, status });
});

// ── Gebruikersbeheer: dashboard-toegang + blueprint-heractivering ──────────────
app.get('/api/admin/users', async (req, res) => {
  if (!req.auth?.isAdmin) return res.status(401).json({ error: 'Geen toegang' });
  const db = await loadDB();
  const users = db.users.filter(u => !u.is_admin).map(u => ({
    id: u.id, email: u.email, name: u.name, created_at: u.created_at,
    dashboard_access: u.dashboard_access || 'auto',
    intake_grant: !!u.intake_grant,
    subActive: subIsActive(u.subscription),
    trialDaysLeft: trialDaysLeft(u),
    blueprints: db.orders.filter(o => o.user_id === u.id && o.status === 'completed').length,
  })).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  res.json(users);
});

// Zet per gebruiker de dashboard-toegang ('on'/'off'/'auto') en/of de eenmalige
// gratis nieuwe intake (blueprint-heractivering) aan of uit.
app.post('/api/admin/user/:userId/access', async (req, res) => {
  if (!req.auth?.isAdmin) return res.status(401).json({ error: 'Geen toegang' });
  const db = await loadDB();
  const user = db.users.find(u => u.id === Number(req.params.userId));
  if (!user) return res.status(404).json({ error: 'Gebruiker niet gevonden' });
  const { dashboard, intakeGrant } = req.body || {};
  if (dashboard !== undefined) {
    if (!['on', 'off', 'auto'].includes(dashboard))
      return res.status(400).json({ error: 'dashboard moet on, off of auto zijn' });
    user.dashboard_access = dashboard === 'auto' ? null : dashboard;
  }
  if (intakeGrant !== undefined) user.intake_grant = !!intakeGrant;
  await saveDB(db);
  res.json({ ok: true, dashboard_access: user.dashboard_access || 'auto', intake_grant: !!user.intake_grant });
});

// ── Foutafhandelaar ─────────────────────────────────────────────────────────────
// Vangt alle doorgestuurde fouten op (arity 4 → Express herkent dit als error-handler).
app.use((err, req, res, next) => {
  console.error('API-fout:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Er ging iets mis op de server. Probeer het later opnieuw.' });
});

// ── Export ────────────────────────────────────────────────────────────────────
// Klassieke Lambda-handlers krijgen de Netlify Blobs-configuratie niet
// automatisch; connectLambda(event) leest die uit de request en zet hem klaar.
const { connectLambda } = require('@netlify/blobs');
// Zonder `binary` geeft serverless-http de response als UTF-8-tekst terug; een
// PDF komt er dan onherstelbaar verminkt uit (alle streams onuitpakbaar).
const serverlessHandler = serverless(app, { binary: ['application/pdf'] });
module.exports.handler = async (event, context) => {
  try { connectLambda(event); } catch (e) { console.error('connectLambda:', e.message); }
  return serverlessHandler(event, context);
};
module.exports.app = app;   // t.b.v. lokale tests; Netlify gebruikt alleen .handler
module.exports._quota = { trialDaysLeft, currentMonthKey, companionUsedAndLimit, bumpCompanionUsage,
  TRIAL_DAYS, TRIAL_COMPANION_LIMIT, SUB_COMPANION_LIMIT };

// Zelf-check (offline, geen Blobs/Stripe): node netlify/functions/api.js
if (require.main === module) {
  const assert = require('node:assert');
  const dayMs = 86400000;
  const iso = (ms) => new Date(Date.now() - ms).toISOString();
  // Proefperiode: vers account → volle TRIAL_DAYS; verlopen → 0.
  assert.strictEqual(trialDaysLeft({ created_at: iso(0) }), TRIAL_DAYS);
  assert.strictEqual(trialDaysLeft({ created_at: iso((TRIAL_DAYS + 1) * dayMs) }), 0);
  assert.strictEqual(trialDaysLeft({}), 0);
  // Companion-quota lezen: proef telt totaal, abonnement per maand (stale = reset).
  assert.deepStrictEqual(companionUsedAndLimit({ companion_usage: { trial: 2 } }, false), { used: 2, limit: TRIAL_COMPANION_LIMIT });
  assert.deepStrictEqual(companionUsedAndLimit({ companion_usage: { month: currentMonthKey(), monthCount: 5 } }, true), { used: 5, limit: SUB_COMPANION_LIMIT });
  assert.deepStrictEqual(companionUsedAndLimit({ companion_usage: { month: '1999-01', monthCount: 9 } }, true), { used: 0, limit: SUB_COMPANION_LIMIT });
  // Ophogen: proef +1 op trial; abonnement start verse maand op 1.
  const t = { companion_usage: { trial: 0, month: null, monthCount: 0 } };
  bumpCompanionUsage(t, false); assert.strictEqual(t.companion_usage.trial, 1);
  const p = {}; bumpCompanionUsage(p, true);
  assert.strictEqual(p.companion_usage.month, currentMonthKey());
  assert.strictEqual(p.companion_usage.monthCount, 1);
  console.log('api quota self-check ok');

  // Admin-overrides: dashboard-toegang + intake-heractivering (geen Stripe/Blobs nodig).
  (async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_selfcheck_dummy'; // anders is lokaal alles 'unlimited'
    const req = { auth: { userId: 1 }, headers: {} };
    const expired = (extra) => ({ id: 1, email: 'x@y.z', created_at: iso((TRIAL_DAYS + 5) * dayMs), ...extra });
    // Proef voorbij, geen abonnement → dicht; override 'on' → open; 'off' wint van de proef.
    assert.strictEqual((await accessState({ users: [expired()] }, req)).dashboardOpen, false);
    assert.strictEqual((await accessState({ users: [expired({ dashboard_access: 'on' })] }, req)).dashboardOpen, true);
    assert.strictEqual((await accessState({ users: [{ ...expired({ dashboard_access: 'off' }), created_at: iso(0) }] }, req)).dashboardOpen, false);
    // Heractivering: intakeAccess geeft toegang mét grant-marker; zonder grant dicht.
    const a = await intakeAccess(req, { users: [expired({ intake_grant: true })] }, {});
    assert.strictEqual(a.ok, true);
    assert.strictEqual(a.grantUserId, 1);
    assert.strictEqual((await intakeAccess(req, { users: [expired()] }, {})).ok, false);
    console.log('api access self-check ok');
  })().catch(e => { console.error(e); process.exit(1); });
}

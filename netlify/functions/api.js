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
const { sendAccountEmail, sendDraftEmail, sendNewOrderEmail, sendGiftEmail, sendGiftConfirmationEmail } = require('../../lib/email');

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
  if (!email || !password) return res.status(400).json({ error: 'Email en wachtwoord zijn verplicht' });
  const db   = await loadDB();
  // Demo-account + voorbeeld-blueprint aanmaken zodra iemand ermee inlogt.
  if (email.trim().toLowerCase() === DEMO_EMAIL) {
    if (await ensureDemoData(db)) await saveDB(db);
  }
  const user = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Onjuist e-mailadres of wachtwoord' });
  setAuthCookie(res, { userId: user.id, email: user.email, name: user.name, isAdmin: !!user.is_admin });
  res.json({ id: user.id, email: user.email, name: user.name, initials: user.name.substring(0,2).toUpperCase(), isAdmin: !!user.is_admin });
});

app.post('/api/auth/logout', (req, res) => {
  clearAuthCookie(res);
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
  const order = db.orders.find(o => o.id === req.params.id && o.user_id === req.auth.userId);
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
const GIFT_PRICE_EUR = process.env.GIFT_PRICE_EUR || '49,90';

app.post('/api/gift/checkout', (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Niet ingelogd' });
  if (process.env.STRIPE_SECRET_KEY) {
    // TODO: echte Stripe Checkout Session; success_url → /cadeau?paid=1
    return res.status(501).json({ error: 'Stripe nog niet ingesteld.' });
  }
  res.json({ mock: true, price: GIFT_PRICE_EUR, paidToken: 'mock-' + crypto.randomBytes(6).toString('hex') });
});

function giftIsDue(sendDate) {
  if (!sendDate) return true;
  return sendDate <= new Date().toISOString().slice(0, 10);
}

app.post('/api/gift/create', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Niet ingelogd' });
  const { recipientEmail, recipientName, message, sendDate, lang, paidToken } = req.body || {};
  if (!process.env.STRIPE_SECRET_KEY && !String(paidToken || '').startsWith('mock-'))
    return res.status(402).json({ error: 'Betaling niet bevestigd.' });
  if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail))
    return res.status(400).json({ error: 'Vul een geldig e-mailadres van de ontvanger in.' });
  if (sendDate && !/^\d{4}-\d{2}-\d{2}$/.test(sendDate))
    return res.status(400).json({ error: 'Ongeldige verzenddatum.' });

  const language = lang === 'en' ? 'en' : 'nl';
  const db = await loadDB();
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
const COMPANION_MODEL = () => process.env.COMPANION_MODEL || 'claude-sonnet-5';

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
Vandaag: maan in ${c.sky.moon.sign}, ${c.sky.waxing ? 'wassend' : 'afnemend'}. Datum: ${c.now.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.${c.lang === 'en' ? '\nIMPORTANT: The user uses the English dashboard. Reply entirely in English (use English zodiac sign names), while keeping the same warm, grounded tone.' : ''}`;
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

  res.json({
    status: 'completed',
    orderId: c.order.id,
    viewToken: c.order.view_token,
    lang: c.lang,
    clientName: c.ctx.intake.clientName,
    firstName: (c.ctx.intake.clientName || '').trim().split(/\s+/)[0],
    birthDate: c.order.birth_date,
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
    day: dayFromBlueprint(c),
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
  const c = await companionContext(req.auth.userId, req.body?.lang || req.query.lang);
  if (!c.ctx) return res.status(400).json({ error: 'Nog geen voltooide blueprint' });

  const fallback = dayFromBlueprint(c);
  if (!process.env.ANTHROPIC_API_KEY) return res.json({ source: 'blueprint', ...fallback });

  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new (Anthropic.default || Anthropic)({ apiKey: process.env.ANTHROPIC_API_KEY });
    const str = { type: 'string' };
    const schema = {
      type: 'object', additionalProperties: false,
      properties: { thema: str, focus: str, vraag: str, lucht: str, numFocus: str, numReminder: str, gaven: str },
      required: ['thema', 'focus', 'vraag', 'lucht', 'numFocus', 'numReminder', 'gaven'],
    };
    const userPrompt = c.lang === 'en'
      ? `Generate today's daily reading in ENGLISH, fully grounded in the fixed data. Fields: thema (short powerful sentence), focus (one concrete small step), vraag (one reflection question), lucht (2-3 sentences about today's moon linked to the natal moon), numFocus (1 sentence for Personal Day ${c.pd}), numReminder (1 sentence for Personal Year ${c.ctx.numerology.personalYear}), gaven (1 sentence: which 2 of the six gifts light up today and why).`
      : `Genereer de dagduiding voor vandaag, volledig gegrond in de vaste gegevens. Velden: thema (korte krachtige zin), focus (één concrete kleine stap), vraag (één reflectievraag), lucht (2-3 zinnen over de maanstand vandaag gekoppeld aan de geboortemaan), numFocus (1 zin bij Persoonlijke Dag ${c.pd}), numReminder (1 zin bij Persoonlijk Jaar ${c.ctx.numerology.personalYear}), gaven (1 zin: welke 2 van de zes gaven vandaag oplichten en waarom).`;
    const response = await client.messages.create({
      model: COMPANION_MODEL(), max_tokens: 700,
      system: companionSystem(c),
      messages: [{ role: 'user', content: userPrompt }],
      output_config: { format: { type: 'json_schema', schema } },
    });
    const txt = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
    res.json({ source: 'ai', ...JSON.parse(txt) });
  } catch (err) {
    console.error('companion/day AI-fout:', err.message);
    res.json({ source: 'blueprint', ...fallback });
  }
});

// Gesprek met de Companion (kent de kaart en blueprint van de gebruiker)
app.post('/api/companion/chat', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Niet ingelogd' });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.json({ content: 'De Companion is nog niet geactiveerd. Stel ANTHROPIC_API_KEY in via Netlify → Site settings → Environment variables.' });

  const { messages, lang } = req.body;
  if (!messages?.length) return res.status(400).json({ error: 'Geen berichten' });

  let system = lang === 'en'
    ? 'You are the SZINN AI Companion — warm, clear, practical. No bullet points. Write flowing sentences in English.'
    : 'Je bent de SZINN AI Companion — warm, helder, praktisch. Spreek de gebruiker aan met jij/jouw. Geen bullet points. Schrijf vloeiende zinnen.';
  try {
    const c = await companionContext(req.auth.userId, lang);
    if (c.ctx) system = companionSystem(c);
  } catch (e) { /* generieke system prompt volstaat */ }

  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new (Anthropic.default || Anthropic)({ apiKey });
    const response = await client.messages.create({
      model: COMPANION_MODEL(), max_tokens: 800,
      system,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });
    res.json({ content: response.content.filter(b => b.type === 'text').map(b => b.text).join('') });
  } catch (err) {
    console.error('companion/chat fout:', err.message);
    res.status(500).json({ error: 'AI Companion tijdelijk niet beschikbaar.' });
  }
});

// ── Intake concept (tussentijds opslaan) ─────────────────────────────────────
// Slaat een half ingevulde vragenlijst op in het account. Zonder account wordt
// er één aangemaakt (met mail + inloggegevens). Een bestaand e-mailadres van
// iemand die níét is ingelogd wordt geweigerd: anders zou je andermans account
// kunnen vullen of overnemen.
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
    return res.send(html);
  }
  res.status(404).send('<h1>Blueprint niet gevonden</h1>');
});

// PDF-download van de blueprint. Snelle route: de tijdens de pipeline vooraf
// gegenereerde PDF. Ontbreekt die (oudere order, PDF-stap ooit gefaald, of de
// demo), dan renderen we hem alsnog on-the-fly uit de opgeslagen HTML — zodat
// de download altijd werkt, met alle kleuren en afbeeldingen.
app.get('/api/orders/:id/pdf', async (req, res) => {
  const order = await authorizedOrder(req, req.params.id);
  if (!order) return res.status(403).json({ error: 'Geen toegang' });
  const lang  = req.query.lang === 'en' ? 'en' : 'nl';
  const store = blueprintStore();
  const name  = (order.client_name || order.id).replace(/[^\w\-]+/g, '-');

  // 1) Vooraf gegenereerde PDF (snel)
  const pregen = await store.get(`${order.id}.${lang}.pdf`, { type: 'arrayBuffer' });
  if (pregen) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="SZINN-Blueprint-${name}.pdf"`);
    return res.send(Buffer.from(pregen));
  }

  // 2) Terugval: on-demand renderen uit de opgeslagen blueprint-HTML
  const html = (await store.get(`${order.id}.${lang}.html`))
            || (lang === 'en' ? await store.get(`${order.id}.nl.html`) : null)
            || (await store.get(order.id));
  if (!html) return res.status(404).json({ error: 'Blueprint nog niet beschikbaar' });

  try {
    const { generatePDF } = require('../../lib/pdf');
    const pdf = await generatePDF(html);
    // Best effort: bewaar hem voor de volgende keer
    try { await store.set(`${order.id}.${lang}.pdf`, pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength)); } catch {}
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="SZINN-Blueprint-${name}.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error('On-demand PDF mislukt:', err.message);
    res.status(500).json({ error: 'De PDF kon niet worden gemaakt. Probeer het zo nog eens.' });
  }
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
const serverlessHandler = serverless(app);
module.exports.handler = async (event, context) => {
  try { connectLambda(event); } catch (e) { console.error('connectLambda:', e.message); }
  return serverlessHandler(event, context);
};
module.exports.app = app;   // t.b.v. lokale tests; Netlify gebruikt alleen .handler

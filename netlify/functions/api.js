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
const { getStore } = require('@netlify/blobs');

const app = express();
app.use(express.json());

const JWT_SECRET      = process.env.JWT_SECRET      || 'szinn-jwt-2026-change-me';
const ADMIN_PASSWORD  = process.env.ADMIN_PASSWORD  || 'szinn-admin';

// ── Netlify Blobs stores ───────────────────────────────────────────────────────
// Alles in één JSON store (eenvoudig, werkt prima voor kleine schaal)
function dbStore()         { return getStore({ name: 'szinn-db',         consistency: 'strong' }); }
function blueprintStore()  { return getStore({ name: 'szinn-blueprints', consistency: 'strong' }); }

async function loadDB() {
  try {
    const data = await dbStore().get('data', { type: 'json' });
    return data || defaultDB();
  } catch { return defaultDB(); }
}

async function saveDB(data) {
  await dbStore().setJSON('data', data);
}

function defaultDB() {
  return { users: [], orders: [], giftCodes: [], nextUserId: 1 };
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
  const user = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Onjuist e-mailadres of wachtwoord' });
  setAuthCookie(res, { userId: user.id, email: user.email, name: user.name });
  res.json({ id: user.id, email: user.email, name: user.name, initials: user.name.substring(0,2).toUpperCase() });
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

app.get('/api/orders', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Niet ingelogd' });
  const db = await loadDB();
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

// ── AI Companion ──────────────────────────────────────────────────────────────
app.post('/api/companion/chat', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Niet ingelogd' });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.json({ content: 'De AI Companion vereist een ANTHROPIC_API_KEY. Stel deze in via Netlify → Site settings → Environment variables.' });

  const { messages } = req.body;
  if (!messages?.length) return res.status(400).json({ error: 'Geen berichten' });
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const client    = new Anthropic.default({ apiKey });
    const response  = await client.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 800,
      system: 'Je bent de SZINN AI Companion — warm, helder, praktisch. Spreek de gebruiker aan met jij/jouw. Geen bullet points. Schrijf vloeiende zinnen.',
      messages: messages.map(m => ({ role: m.role, content: m.content }))
    });
    res.json({ content: response.content[0].text });
  } catch (err) {
    res.status(500).json({ error: 'AI Companion tijdelijk niet beschikbaar.' });
  }
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
  await saveDB(db);

  // Auto-login
  setAuthCookie(res, { userId: user.id, email: user.email, name: user.name });

  res.json({
    success: true, orderId,
    loginEmail: data.email, tempPassword,
    message: tempPassword
      ? `Account aangemaakt. Inloggen met: ${data.email} / ${tempPassword}`
      : 'Blueprint wordt gegenereerd in je bestaande account'
  });
});

// ── Blueprint serve (via Netlify Blobs) ───────────────────────────────────────
app.get('/szinn-portal/blueprints/:filename', async (req, res) => {
  const orderId = req.params.filename.replace(/\.html$/, '');
  try {
    const html = await blueprintStore().get(orderId);
    if (html) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }
  } catch {}
  res.status(404).send('<h1>Blueprint niet gevonden</h1>');
});

// ── Admin ─────────────────────────────────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Onjuist wachtwoord' });
  setAuthCookie(res, { isAdmin: true, userId: 0, email: 'admin', name: 'Admin' });
  res.json({ ok: true });
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

// ── Export ────────────────────────────────────────────────────────────────────
module.exports.handler = serverless(app);

'use strict';
// Koppeling met de Python blueprint-worker (blueprint-worker/, draait op Railway).
// De worker bouwt de Blueprint volgens masterprompt v4 met de SZINN-kit en meldt
// het resultaat terug op /api/internal/blueprint-result. Bestanden (PDF's, audit)
// blijven op de worker en worden via kortlevende, HMAC-getekende links geserveerd.

const crypto = require('crypto');

const WORKER_URL = () => (process.env.BLUEPRINT_WORKER_URL || '').replace(/\/$/, '');
const SECRET = () => process.env.WORKER_SECRET || '';

// Alleen Nederlandstalige orders: de vaste basistekst van de kit bestaat (nog) alleen in het Nederlands.
function kitEnabledFor(order) {
  return !!(WORKER_URL() && SECRET()) && order.blueprint_language !== 'en';
}

async function queueKitJob(order) {
  const site = process.env.URL || process.env.DEPLOY_URL;
  const res = await fetch(`${WORKER_URL()}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Worker-Secret': SECRET() },
    body: JSON.stringify({ orderId: order.id, order, callbackUrl: `${site}/api/internal/blueprint-result` }),
  });
  if (res.status !== 202) throw new Error(`blueprint-worker weigerde de job: HTTP ${res.status} ${await res.text().catch(() => '')}`);
}

// soort: digitaal | binnenwerk | omslag | audit
function signedFileUrl(orderId, soort, ttlSeconds = 3600) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = crypto.createHmac('sha256', SECRET()).update(`${orderId}:${soort}:${exp}`).digest('hex');
  return `${WORKER_URL()}/files/${encodeURIComponent(orderId)}/${soort}?exp=${exp}&sig=${sig}`;
}

async function setSpine(orderId, mm) {
  const res = await fetch(`${WORKER_URL()}/jobs/${encodeURIComponent(orderId)}/rug`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Worker-Secret': SECRET() },
    body: JSON.stringify({ mm }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status !== 202) throw new Error(body.error || `HTTP ${res.status}`);
}

function validCallbackSecret(secret) {
  const a = Buffer.from(String(secret || '')), b = Buffer.from(SECRET());
  return b.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { kitEnabledFor, queueKitJob, signedFileUrl, setSpine, validCallbackSecret };

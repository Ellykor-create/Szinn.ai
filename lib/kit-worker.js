'use strict';
// Koppeling met de Python blueprint-worker (blueprint-worker/). Die draait als
// GitHub Actions-workflow in de private runner-repo (kit + workflow), één run per
// job, en meldt het resultaat terug op /api/internal/blueprint-result. Bestanden
// (PDF's, audit) staan in de release "order-<id>" van die repo en worden via
// kortlevende, HMAC-getekende links geserveerd door netlify/edge-functions/kit-files.js.

const crypto = require('crypto');

const REPO = () => process.env.BLUEPRINT_RUNNER_REPO || 'UDefine1/szinn-blueprint-runner';
const TOKEN = () => process.env.GITHUB_RUNNER_TOKEN || '';
const SECRET = () => process.env.WORKER_SECRET || '';

// NL én EN: de worker kiest de taal op order.blueprint_language (szinn_taal.py, szinn_vast_en.py).
function kitEnabledFor(order) {
  return !!(TOKEN() && SECRET());
}

function github(path, init = {}) {
  return fetch(`https://api.github.com/repos/${REPO()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN()}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
  });
}

async function dispatch(inputs) {
  const res = await github('/actions/workflows/blueprint.yml/dispatches', { method: 'POST', body: JSON.stringify({ ref: 'main', inputs }) });
  if (res.status !== 204) throw new Error(`blueprint-runner weigerde de job: HTTP ${res.status} ${await res.text().catch(() => '')}`);
}

// ponytail: de order gaat als workflow-input mee (GitHub: max 65.535 tekens); een
// grotere intake geeft hier een 422 en de order komt als 'failed' in de admin.
async function queueKitJob(order) {
  const site = process.env.URL || process.env.DEPLOY_URL;
  await dispatch({ orderId: order.id, order: JSON.stringify(order), callbackUrl: `${site}/api/internal/blueprint-result` });
}

// soort: digitaal | binnenwerk | omslag | audit
function signedFileUrl(orderId, soort, ttlSeconds = 3600) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = crypto.createHmac('sha256', SECRET()).update(`${orderId}:${soort}:${exp}`).digest('hex');
  return `/kit-files/${encodeURIComponent(orderId)}/${soort}?exp=${exp}&sig=${sig}`;
}

async function setSpine(orderId, mm) {
  const rel = await github(`/releases/tags/order-${encodeURIComponent(orderId)}`);
  if (rel.status === 404) throw new Error('nog geen Blueprint voor deze order');
  if (!rel.ok) throw new Error(`GitHub HTTP ${rel.status}`);
  await dispatch({ orderId, rug: String(mm) });
}

function validCallbackSecret(secret) {
  const a = Buffer.from(String(secret || '')), b = Buffer.from(SECRET());
  return b.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { kitEnabledFor, queueKitJob, signedFileUrl, setSpine, validCallbackSecret };

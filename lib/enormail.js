'use strict';

// Voegt een koper toe aan Enormail — zelfde REST-API als netlify/functions/subscribe.mjs,
// maar dan server-side aangeroepen zodra een betaalde intake binnenkomt (zie de
// /api/intake/submit handlers in server.js en netlify/functions/api.js).
//
// Standaardlijst: form 87998 (szinn-event-gratis-workshop). Override via env
// ENORMAIL_BUYERS_FORM; valt terug op de waitlist-lijst als die is ingesteld.
// Zonder ENORMAIL_API_KEY wordt toevoegen netjes overgeslagen zodat de rest
// van de intake-flow gewoon doorwerkt (fails open, net als lib/email.js).

const BUYERS_FORM = () =>
  process.env.ENORMAIL_BUYERS_FORM || '87998';

async function addBuyerToEnormail({ name, email, birthday } = {}) {
  const key = process.env.ENORMAIL_API_KEY;
  if (!key) {
    console.log(`[enormail overgeslagen — geen ENORMAIL_API_KEY] koper: ${email || '?'}`);
    return { skipped: true };
  }
  if (!email) return { skipped: true };

  const form = new URLSearchParams();
  form.append('name', String(name || '').slice(0, 120));
  form.append('email', String(email).trim().slice(0, 200));
  if (birthday) form.append('fields[birthday]', String(birthday)); // JJJJ-MM-DD

  const auth = Buffer.from(`${key}:x`).toString('base64');
  const formId = BUYERS_FORM();
  const res = await fetch(`https://api.enormail.eu/api/1.0/forms/${formId}.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  if (res.status === 200 || res.status === 201) return { ok: true };
  const body = await res.text().catch(() => '');
  throw new Error(`enormail ${res.status}: ${body.slice(0, 200)}`);
}

module.exports = { addBuyerToEnormail };

// ponytail: één self-check — zonder key → skip, en de default-lijst klopt.
if (require.main === module) {
  const assert = require('assert');
  delete process.env.ENORMAIL_API_KEY;
  addBuyerToEnormail({ email: 'test@voorbeeld.nl' }).then(r => {
    assert.strictEqual(r.skipped, true);
    assert.strictEqual(BUYERS_FORM(), '87998');
    console.log('lib/enormail.js zelfcheck OK');
  });
}

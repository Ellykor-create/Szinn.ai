'use strict';
// Netlify Background Function (naam eindigt op "-background" → 15 min limiet).
// Rendert de opgeslagen blueprint-HTML van één order naar een PDF en bewaart
// die als blob. Nodig omdat een gewone function na 10 seconden wordt afgekapt
// en een volledige blueprint (±900 kB HTML, ±40 pagina's) daar niet in past.
//
// Aanroep (alleen intern, vanuit api.js):
//   POST /.netlify/functions/blueprint-pdf-background
//   body: { orderId, lang, secret }

const { connectLambda } = require('@netlify/blobs');
const { blueprintStore } = require('../../lib/db');
const { upgradeNav } = require('../../lib/blueprint-nav');
const { generatePDF } = require('../../lib/pdf');

const SECRET = () => process.env.INTERNAL_TRIGGER_SECRET || process.env.JWT_SECRET || 'szinn-jwt-2026-change-me';

exports.handler = async (event) => {
  try { connectLambda(event); } catch (e) { console.error('connectLambda:', e.message); }
  let payload = {};
  try { payload = JSON.parse(event.body || '{}'); } catch {}
  const { orderId, secret } = payload;
  const lang = payload.lang === 'en' ? 'en' : 'nl';

  if (secret !== SECRET()) {
    console.error('blueprint-pdf: ongeldige trigger (secret klopt niet)');
    return { statusCode: 403, body: 'forbidden' };
  }
  if (!orderId) return { statusCode: 400, body: 'orderId ontbreekt' };

  const store = blueprintStore();
  const jobKey = `${orderId}.${lang}.pdf.job`;
  const started = Date.now();
  try {
    // Zelfde sleutelvolgorde als de serve-route: taalvariant, anders NL, anders
    // de kale orderId-key van de oude admin-workflow.
    const html = (await store.get(`${orderId}.${lang}.html`))
              || (lang === 'en' ? await store.get(`${orderId}.nl.html`) : null)
              || (await store.get(orderId));
    if (!html) throw new Error('blueprint-HTML niet gevonden');

    const pdf = await generatePDF(upgradeNav(html));
    await store.set(`${orderId}.${lang}.pdf`, pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength));
    await store.delete(jobKey).catch(() => {});
    console.log(`blueprint-pdf ${orderId} ${lang}: ${Math.round(pdf.length / 1024)} kB in ${Math.round((Date.now() - started) / 1000)}s`);
    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    // De fout in de job-marker zetten zodat de download-route hem kan tonen
    // in plaats van te blijven wachten.
    console.error(`blueprint-pdf ${orderId} ${lang} mislukt:`, err);
    try { await store.setJSON(jobKey, { started: new Date(started).toISOString(), error: String(err.message || err) }); } catch {}
    return { statusCode: 500, body: String(err.message || err) };
  }
};

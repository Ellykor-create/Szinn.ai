'use strict';
// Her-rendert ALLE bestaande blueprints met de gecorrigeerde rekenmodule
// (lib/astro.js). Alleen laag 1: chart + template + PDF worden opnieuw
// opgebouwd uit de AL OPGESLAGEN AI-teksten ({orderId}.texts.json). GEEN
// AI-call, dus geen generatiekosten. De interpretatie-prosa blijft ongewijzigd.
//
// Toegang tot de productie-Blobs: zet NETLIFY_SITE_ID en NETLIFY_TOKEN
// (personal access token) in de omgeving. Zonder die twee stopt het script.
//
// Draai (eerst kijken, schrijft niets):
//   NETLIFY_SITE_ID=... NETLIFY_TOKEN=... node scripts/rerender-blueprints.js
// Daadwerkelijk herschrijven (maakt eerst .bak van de oude HTML):
//   NETLIFY_SITE_ID=... NETLIFY_TOKEN=... node scripts/rerender-blueprints.js --apply

const { getStore } = require('@netlify/blobs');
const { buildContext } = require('../lib/pipeline');
const { renderBlueprint } = require('../lib/template');

const APPLY = process.argv.includes('--apply');
const SITE = process.env.NETLIFY_SITE_ID;
const TOKEN = process.env.NETLIFY_TOKEN;
if (!SITE || !TOKEN) {
  console.error('Zet NETLIFY_SITE_ID en NETLIFY_TOKEN in de omgeving. Afgebroken.');
  process.exit(1);
}

const bp = getStore({ name: 'szinn-blueprints', siteID: SITE, token: TOKEN });
const db = getStore({ name: 'szinn-db', siteID: SITE, token: TOKEN });

const P = ch => ch.planets;
const short = p => `${p.sign} ${p.deg}°${String(p.min).padStart(2, '0')}'${p.house ? ' h' + p.house : ''}${p.retrograde ? ' Rx' : ''}`;

(async () => {
  const data = await db.get('data', { type: 'json' });
  const orders = (data && data.orders) || [];
  const stamp = new Date().toISOString().slice(0, 10);

  const { blobs } = await bp.list();
  const ids = [...new Set(blobs.map(b => b.key).filter(k => k.endsWith('.texts.json')).map(k => k.replace('.texts.json', '')))];
  console.log(`${ids.length} blueprints met opgeslagen teksten gevonden.${APPLY ? '' : '  (DRY-RUN — schrijft niets; gebruik --apply)'}\n`);

  let done = 0, skipped = 0, failed = 0;
  for (const id of ids) {
    const order = orders.find(o => o.id === id);
    if (!order) { console.log(`- ${id}: geen order in db — overgeslagen`); skipped++; continue; }
    try {
      const texts = await bp.get(`${id}.texts.json`, { type: 'json' });
      const ctx = buildContext(order);
      const p = P(ctx.chart);
      console.log(`- ${id} (${ctx.intake.clientName}, ${ctx.intake.birthDate}): `
        + `ASC ${short(p.ascendant)} | MC ${short(p.mc || {sign:'?',deg:0,min:0})} | NN ${short(p.northNode)} | Chiron ${short(p.chiron)}`);

      for (const lang of ['nl', 'en']) {
        const ai = texts[lang];
        if (!ai) continue;
        const html = renderBlueprint({ ...ctx, ai, lang });
        if (APPLY) {
          const old = await bp.get(`${id}.${lang}.html`);
          if (old) await bp.set(`${id}.${lang}.html.bak-${stamp}`, old);
          await bp.set(`${id}.${lang}.html`, html);
          try {
            const { generatePDF } = require('../lib/pdf');
            const pdf = await generatePDF(html);
            const oldPdf = await bp.get(`${id}.${lang}.pdf`, { type: 'arrayBuffer' });
            if (oldPdf) await bp.set(`${id}.${lang}.pdf.bak-${stamp}`, oldPdf);
            await bp.set(`${id}.${lang}.pdf`, pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength));
          } catch (e) { console.log(`    PDF ${lang} niet opnieuw gebakken: ${e.message}`); }
        }
      }
      done++;
    } catch (e) { console.log(`- ${id}: FOUT — ${e.message}`); failed++; }
  }
  console.log(`\nKlaar. ${APPLY ? 'Herschreven' : 'Zou herschrijven'}: ${done}, overgeslagen: ${skipped}, fouten: ${failed}.`);
})();

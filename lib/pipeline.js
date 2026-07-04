'use strict';
// De volledige blueprint-pipeline (laag 1 + laag 2 + audit + opslag + mail).
// Wordt aangeroepen door de Netlify background function; alle stappen loggen
// naar console zodat de Netlify function logs het verloop laten zien.

const { calcBirthChart } = require('./astro');
const { calcAll } = require('./numerology');
const { generateBlueprintTexts } = require('./ai-texts');
const { renderBlueprint } = require('./template');
const { auditTexts, auditHTML } = require('./audit');
const { sendReadyEmail, sendAdminAlert } = require('./email');

function tzOffsetFor(tz, dateStr) {
  if (!tz) return 1; // Nederland historisch vrijwel altijd UTC+1 (geboortes vóór zomertijd-registratie)
  try {
    const fmt = new Intl.DateTimeFormat('nl', { timeZone: tz, timeZoneName: 'shortOffset' });
    const parts = fmt.formatToParts(new Date(`${dateStr}T12:00:00`));
    const off = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT+1';
    const m = off.match(/GMT([+-]\d+)(?::(\d+))?/);
    if (m) return parseInt(m[1], 10) + (m[2] ? Math.sign(parseInt(m[1], 10)) * parseInt(m[2], 10) / 60 : 0);
  } catch {}
  return 1;
}

function buildContext(order) {
  const raw = JSON.parse(order.intake_data || '{}');
  const intake = {
    clientName: order.client_name || raw.voornaam || 'Onbekend',
    birthName: order.full_birth_name || order.client_name,
    birthDate: order.birth_date,
    birthTime: order.birth_time || '12:00',
    birthCity: (order.birth_location || '').split(',')[0].trim() || raw.geboorteplaats || '',
    birthCountry: (order.birth_location || '').split(',').slice(1).join(',').trim() || 'Nederland',
    raw,
  };
  const lat = order.birth_lat || parseFloat(raw.geboorte_lat) || 52.37;
  const lng = order.birth_lng || parseFloat(raw.geboorte_lng) || 4.9;
  const tzOffset = tzOffsetFor(order.birth_tz, order.birth_date);
  const chart = calcBirthChart(order.birth_date, intake.birthTime, lat, lng, tzOffset);
  const numerology = calcAll(intake.birthName, order.birth_date);
  return { intake, chart, numerology };
}

// Genereert teksten + HTML voor één taal, met audit
async function generateLanguage(ctx, lang, client) {
  const { texts, usage } = await generateBlueprintTexts(ctx, lang, client);
  const tAudit = auditTexts(texts);
  if (!tAudit.ok) throw new Error(`tekst-audit ${lang}: ${tAudit.problems.join('; ')}`);
  const html = renderBlueprint({ ...ctx, ai: texts, lang });
  const hAudit = auditHTML(html, { clientName: ctx.intake.clientName, birthDate: ctx.intake.birthDate });
  if (!hAudit.ok) throw new Error(`html-audit ${lang}: ${hAudit.problems.join('; ')}`);
  return { texts, html, usage };
}

// Hoofdfunctie. deps = { loadDB, saveDB, blueprintStore, orderData? } uit de
// function-context. orderData is de order zoals de intake hem meestuurde:
// Netlify Blobs is eventually consistent, dus direct na de intake kan deze
// functie-instantie de order nog niet zien in de database.
async function runGeneration(orderId, deps) {
  const { loadDB, saveDB, blueprintStore, orderData } = deps;
  const started = Date.now();

  let db = await loadDB();
  let order = db.orders.find(o => o.id === orderId);
  // Eventual consistency: even wachten tot de zojuist opgeslagen order
  // zichtbaar wordt voor deze (verse) functie-instantie.
  for (let i = 0; i < 10 && !order; i++) {
    console.log(`${orderId}: nog niet zichtbaar in db (poging ${i + 1}), 3s wachten…`);
    await new Promise(r => setTimeout(r, 3000));
    db = await loadDB();
    order = db.orders.find(o => o.id === orderId);
  }
  if (!order && orderData && orderData.id === orderId) {
    // Vangnet: gebruik de meegestuurde order en zet hem (terug) in de db.
    console.log(`${orderId}: db blijft achterlopen — meegestuurde orderdata gebruikt`);
    order = orderData;
    db.orders.push(order);
  }
  if (!order) throw new Error(`Order ${orderId} niet gevonden`);
  if (order.status === 'completed') { console.log(`${orderId}: al voltooid, overslaan`); return { ok: true, skipped: true }; }

  order.status = 'generating';
  order.generation_started_at = new Date().toISOString();
  order.generation_error = null;
  await saveDB(db);

  const ctx = buildContext(order);
  console.log(`${orderId}: kaart+getallen berekend (${ctx.intake.clientName}, ${ctx.intake.birthDate})`);

  const MAX_ATTEMPTS = 2; // 1 poging + 1 automatische retry (afspraak met opdrachtgever)
  let lastError = null;
  let result = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS && !result; attempt++) {
    try {
      const nl = await generateLanguage(ctx, 'nl', null);
      console.log(`${orderId}: NL-teksten ok (poging ${attempt}; ${JSON.stringify(nl.usage || {})})`);
      const en = await generateLanguage(ctx, 'en', null);
      console.log(`${orderId}: EN-teksten ok (poging ${attempt})`);
      result = { nl, en };
    } catch (err) {
      lastError = err;
      console.error(`${orderId}: poging ${attempt} mislukt — ${err.message}`);
    }
  }

  db = await loadDB(); // herladen: intake kan intussen andere orders hebben toegevoegd
  let freshOrder = db.orders.find(o => o.id === orderId);
  if (!freshOrder) { freshOrder = order; db.orders.push(freshOrder); } // stale read: order terugzetten

  if (!result) {
    freshOrder.status = 'failed';
    freshOrder.generation_error = String(lastError && lastError.message || lastError);
    await saveDB(db);
    await sendAdminAlert({ orderId, error: lastError, attempts: MAX_ATTEMPTS }).catch(e => console.error('admin-alert mislukt:', e.message));
    return { ok: false, error: freshOrder.generation_error };
  }

  // Opslaan: teksten (de "database"-laag met 2 taalvelden) + gerenderde HTML per taal
  const store = blueprintStore();
  await store.setJSON(`${orderId}.texts.json`, {
    orderId,
    generatedAt: new Date().toISOString(),
    model: process.env.BLUEPRINT_MODEL || 'claude-sonnet-5',
    nl: result.nl.texts,
    en: result.en.texts,
  });
  await store.set(`${orderId}.nl.html`, result.nl.html);
  await store.set(`${orderId}.en.html`, result.en.html);

  // PDF (best effort — een PDF-fout mag de oplevering niet blokkeren)
  let pdfOk = false;
  try {
    const { generatePDF } = require('./pdf');
    for (const lang of ['nl', 'en']) {
      const pdf = await generatePDF(result[lang].html);
      await store.set(`${orderId}.${lang}.pdf`, pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength));
      console.log(`${orderId}: PDF ${lang} gegenereerd (${Math.round(pdf.length / 1024)} kB)`);
    }
    pdfOk = true;
  } catch (err) {
    console.error(`${orderId}: PDF-generatie mislukt (blueprint blijft beschikbaar): ${err.message}`);
  }

  const defaultLang = (freshOrder.blueprint_language === 'en') ? 'en' : 'nl';
  freshOrder.status = 'completed';
  freshOrder.completed_at = new Date().toISOString();
  freshOrder.blueprint_url = `/szinn-portal/blueprints/${orderId}.html`;
  freshOrder.blueprint_languages = ['nl', 'en'];
  freshOrder.pdf_available = pdfOk;
  freshOrder.generation_error = null;
  await saveDB(db);

  // Mail 2 — blueprint klaar
  const user = db.users.find(u => u.id === freshOrder.user_id);
  if (user) {
    await sendReadyEmail({ to: user.email, name: freshOrder.client_name || user.name, orderId, lang: defaultLang })
      .catch(e => console.error('klaar-mail mislukt:', e.message));
  }

  console.log(`${orderId}: voltooid in ${Math.round((Date.now() - started) / 1000)}s (pdf: ${pdfOk})`);
  return { ok: true };
}

module.exports = { runGeneration, buildContext, tzOffsetFor };

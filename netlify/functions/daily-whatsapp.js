'use strict';
// Ingeplande functie: stuurt elke gebruiker met een voltooide blueprint én
// telefoonnummer rond 12:00 NL-tijd een WhatsApp dat de dagelijkse reading
// klaarstaat, met een mini sneak-peek (thema + focus) uit de blueprint-teksten.
// Netlify-tegenhanger van de setInterval-job in server.js.
//
// Netlify-cron draait op UTC en kent geen tijdzone. We plannen 10:00 én 11:00
// UTC en versturen alleen wanneer het op dát moment 12:xx in Amsterdam is —
// zo klopt het in zomer- én wintertijd en vuurt het precies één keer per dag.

const { loadDB, blueprintStore } = require('../../lib/db');
const { sendWhatsApp } = require('../../lib/whatsapp');
const { subIsActive, stripeConfigured } = require('../../lib/stripe');

const FALLBACK = {
  nl: { thema: 'Jouw blueprint als kompas voor vandaag', focus: 'Zet één kleine, concrete stap' },
  en: { thema: 'Your blueprint as a compass for today',  focus: 'Take one small, concrete step' },
};

// De dagelijkse reading hoort bij het abonnement; demo-accounts uitgezonderd.
// Zonder Stripe-sleutel (lokaal) niet blokkeren — gelijk aan hasSubscriptionAccess in api.js.
const DEMO_EMAILS = [(process.env.DEMO_EMAIL || 'demo@szinn.ai').trim().toLowerCase(), 'demo-plus@szinn.ai'];

exports.handler = async () => {
  const hourNL = Number(new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', hour12: false }).format(new Date()));
  if (hourNL !== 12) return { statusCode: 200, body: 'buiten NL-venster' };

  const db = await loadDB();
  // Per gebruiker de (meest recente) voltooide order — volgorde maakt niet uit
  // voor thema/focus, die komen uit de blueprint-teksten van die order.
  const completedByUser = new Map();
  for (const o of db.orders || []) {
    if (o.status === 'completed') completedByUser.set(o.user_id, o);
  }

  let sent = 0;
  for (const u of db.users || []) {
    if (!u.phone) continue;
    const order = completedByUser.get(u.id);
    if (!order) continue;
    if (stripeConfigured() && !DEMO_EMAILS.includes((u.email || '').toLowerCase()) && !subIsActive(u.subscription)) continue;
    try {
      const lang = order.blueprint_language === 'en' ? 'en' : 'nl';
      const textsAll = await blueprintStore().get(`${order.id}.texts.json`, { type: 'json' });
      const t = (textsAll && (textsAll[lang] || textsAll.nl)) || {};
      const fb = FALLBACK[lang];
      const thema = (t.summary && t.summary.oneLiner) || fb.thema;
      const focus = (t.integration && t.integration.layers && t.integration.layers.focus) || fb.focus;
      const firstName = (u.name || order.client_name || '').trim().split(/\s+/)[0] || (lang === 'en' ? 'there' : 'daar');
      await sendWhatsApp({ to: u.phone, lang, params: [firstName, thema, focus] });
      sent++;
    } catch (err) {
      console.error(`daily-whatsapp voor user ${u.id} mislukt:`, err.message);
    }
  }
  console.log(`daily-whatsapp: ${sent} reading-app(s) verstuurd.`);
  return { statusCode: 200, body: JSON.stringify({ sent }) };
};

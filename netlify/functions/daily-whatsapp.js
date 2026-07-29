'use strict';
// Ingeplande functie: stuurt elke gebruiker met een voltooide blueprint rond
// 12:00 NL-tijd een dagelijkse reading-reminder via het gekozen kanaal
// (WhatsApp of e-mail), met een mini sneak-peek (thema + focus) uit de
// blueprint-teksten. Toegang: proef (11 dagen) of lopend abonnement.
// Netlify-tegenhanger van de setInterval-job in server.js.
//
// Netlify-cron draait op UTC en kent geen tijdzone. We plannen 10:00 én 11:00
// UTC en versturen alleen wanneer het op dát moment 12:xx in Amsterdam is —
// zo klopt het in zomer- én wintertijd en vuurt het precies één keer per dag.

const { loadDB, blueprintStore } = require('../../lib/db');
const { sendWhatsApp } = require('../../lib/whatsapp');
const { sendDailyReadingEmail } = require('../../lib/email');
const { subIsActive, stripeConfigured } = require('../../lib/stripe');

// Proefperiode: verse accounts krijgen TRIAL_DAYS gratis dashboard + reminders
// (gelijk aan api.js). Daarna alleen nog met een lopend abonnement.
const TRIAL_DAYS = parseInt(process.env.TRIAL_DAYS || '11', 10);
function withinTrial(createdAt) {
  if (!createdAt) return false;
  return (Date.now() - new Date(createdAt).getTime()) / 86400000 < TRIAL_DAYS;
}

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
    const order = completedByUser.get(u.id);
    if (!order) continue;
    // Toegang: demo, lopend abonnement, óf binnen de 11-daagse proef. Zonder
    // Stripe-sleutel (lokaal) niet blokkeren.
    const hasAccess = !stripeConfigured() || DEMO_EMAILS.includes((u.email || '').toLowerCase())
      || subIsActive(u.subscription) || withinTrial(u.created_at);
    if (!hasAccess) continue;
    // Kanaalkeuze: onbekend/leeg valt terug op WhatsApp mits er een nummer is.
    const channel = u.notify_channel || (u.phone ? 'whatsapp' : 'off');
    if (channel === 'off') continue;
    if (channel === 'whatsapp' && !u.phone) continue;
    try {
      const lang = order.blueprint_language === 'en' ? 'en' : 'nl';
      const textsAll = await blueprintStore().get(`${order.id}.texts.json`, { type: 'json' });
      const t = (textsAll && (textsAll[lang] || textsAll.nl)) || {};
      const fb = FALLBACK[lang];
      const thema = (t.summary && t.summary.oneLiner) || fb.thema;
      const focus = (t.integration && t.integration.layers && t.integration.layers.focus) || fb.focus;
      const firstName = (u.name || order.client_name || '').trim().split(/\s+/)[0] || (lang === 'en' ? 'there' : 'daar');
      if (channel === 'email') {
        if (!u.email) continue;
        await sendDailyReadingEmail({ to: u.email, name: u.name, theme: thema, focus, lang });
      } else {
        await sendWhatsApp({ to: u.phone, lang, params: [firstName, thema, focus] });
      }
      sent++;
    } catch (err) {
      console.error(`daily-whatsapp voor user ${u.id} mislukt:`, err.message);
    }
  }
  console.log(`daily-whatsapp: ${sent} reading-app(s) verstuurd.`);
  return { statusCode: 200, body: JSON.stringify({ sent }) };
};

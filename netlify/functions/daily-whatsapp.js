'use strict';
// Ingeplande functie: stuurt elke gebruiker met een voltooide blueprint rond
// 12:00 NL-tijd een dagelijkse reading-reminder via het gekozen kanaal
// (WhatsApp of e-mail), met een mini sneak-peek (thema + focus) uit de
// dagduiding van vandaag (lib/daily-reading: transits op de eigen kaart), dus
// elke dag anders. Toegang: proef (11 dagen) of lopend abonnement.
// Netlify-tegenhanger van de setInterval-job in server.js.
//
// Netlify-cron draait op UTC en kent geen tijdzone. We plannen 10:00 én 11:00
// UTC en versturen alleen wanneer het op dát moment 12:xx in Amsterdam is —
// zo klopt het in zomer- én wintertijd en vuurt het precies één keer per dag.

const { loadDB, saveDB, blueprintStore } = require('../../lib/db');
const { connectLambda } = require('@netlify/blobs');
const { sendWhatsApp } = require('../../lib/whatsapp');
const { sendDailyReadingEmail } = require('../../lib/email');
const { subIsActive, stripeConfigured, trialStartedAt } = require('../../lib/stripe');
const { dayContext, todaysReading } = require('../../lib/daily-reading');

// Proefperiode: TRIAL_DAYS gratis dashboard + reminders vanaf het moment dat de
// klant de proef start (gelijk aan api.js). Daarna alleen met een abonnement.
const TRIAL_DAYS = parseInt(process.env.TRIAL_DAYS || '11', 10);
function withinTrial(user) {
  const start = trialStartedAt(user);
  if (!start) return false;
  return (Date.now() - new Date(start).getTime()) / 86400000 < TRIAL_DAYS;
}

// De dagelijkse reading hoort bij het abonnement; demo-accounts uitgezonderd.
// Zonder Stripe-sleutel (lokaal) niet blokkeren — gelijk aan hasSubscriptionAccess in api.js.
const DEMO_EMAILS = [(process.env.DEMO_EMAIL || 'demo@szinn.ai').trim().toLowerCase(), 'demo-plus@szinn.ai'];
// Permanente super-accounts (Morgan/Elly/Danillo): altijd reminders, net als demo.
// dashboard_access==='on' dekt ze ook (zo geseed), maar env houdt het overrideable.
const SUPER_EMAILS = (process.env.SUPER_EMAILS || 'morgan@szinn.ai,elly@szinn.ai,danillo@udefine.nl')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

// Eén reminder via het gekozen kanaal (of `channel` om te forceren, voor de
// admin-testknop). Geeft de ruwe respons van Meta/Resend terug; gooit bij fouten.
async function sendReminder(u, order, channel) {
  // Kanaalkeuze: onbekend/leeg valt terug op WhatsApp mits er een nummer is.
  channel = channel || u.notify_channel || (u.phone ? 'whatsapp' : 'off');
  if (channel === 'off') return { sent: false, reason: 'kanaal uit' };
  if (channel === 'whatsapp' && !u.phone) return { sent: false, reason: 'geen telefoonnummer' };
  if (channel === 'email' && !u.email) return { sent: false, reason: 'geen e-mailadres' };
  // Taal: de voorkeur die de klant zelf koos (login/dashboard), anders de
  // taal van de blueprint. Template 'szinn' bestaat in nl én en.
  const lang = u.lang === 'en' || u.lang === 'nl' ? u.lang
    : (order.blueprint_language === 'en' ? 'en' : 'nl');
  const textsAll = await blueprintStore().get(`${order.id}.texts.json`, { type: 'json' });
  // Zelfde reading als de dagkaart op het dashboard; zet hem ook in de cache
  // op `u` (runDaily slaat de DB op). WhatsApp-parameters mogen geen regeleindes.
  const { reading } = await todaysReading(u, dayContext(order, textsAll, lang));
  const thema = reading.thema.replace(/\s+/g, ' ').trim();
  const focus = reading.focus.replace(/\s+/g, ' ').trim();
  const firstName = (u.name || order.client_name || '').trim().split(/\s+/)[0] || (lang === 'en' ? 'there' : 'daar');
  const result = channel === 'email'
    ? await sendDailyReadingEmail({ to: u.email, name: u.name, theme: thema, focus, lang })
    : await sendWhatsApp({ to: u.phone, lang, params: [firstName, thema, focus] });
  return { sent: !result?.skipped, channel, result };
}

// Toegang: demo, lopend abonnement, óf binnen de 11-daagse proef. Zonder
// Stripe-sleutel (lokaal) niet blokkeren.
function hasReminderAccess(u) {
  const email = (u.email || '').toLowerCase();
  return !stripeConfigured() || DEMO_EMAILS.includes(email)
    || SUPER_EMAILS.includes(email) || u.dashboard_access === 'on'
    || subIsActive(u.subscription) || withinTrial(u);
}

exports.sendReminder = sendReminder;
exports.hasReminderAccess = hasReminderAccess;
// Stuurt de reminder naar iedereen die er recht op heeft en bewaart per account
// het resultaat (user.last_reminder), zodat de admin kan zien of hij uitging.
// dryRun: alleen laten zien wie wat zou krijgen, niets versturen of opslaan.
async function runDaily({ dryRun = false } = {}) {
  const db = await loadDB();
  // Per gebruiker de (meest recente) voltooide order — volgorde maakt niet uit
  // voor thema/focus, die komen uit de blueprint-teksten van die order.
  const completedByUser = new Map();
  for (const o of db.orders || []) {
    if (o.status === 'completed') completedByUser.set(o.user_id, o);
  }

  // Parallel: elke reading is een AI-call en de scheduled function heeft een
  // tijdslimiet. ponytail: alles tegelijk, batchen zodra er honderden users zijn.
  const report = [];
  await Promise.all((db.users || []).map(async (u) => {
    const order = completedByUser.get(u.id);
    if (!order || !hasReminderAccess(u)) return;
    const channel = u.notify_channel || (u.phone ? 'whatsapp' : 'off');
    if (dryRun) { report.push({ email: u.email, channel, lang: u.lang || order.blueprint_language || 'nl' }); return; }
    try {
      const r = await sendReminder(u, order);
      u.last_reminder = { at: new Date().toISOString(), ok: r.sent, channel: r.channel || channel, info: r.reason || r.result?.language || null };
    } catch (err) {
      console.error(`daily-whatsapp voor user ${u.id} mislukt:`, err.message);
      u.last_reminder = { at: new Date().toISOString(), ok: false, channel, info: err.message.slice(0, 200) };
    }
    report.push({ email: u.email, ...u.last_reminder });
  }));
  if (!dryRun) await saveDB(db);
  const sent = report.filter(r => r.ok).length;
  console.log(`daily-whatsapp: ${sent}/${report.length} reminder(s) verstuurd.`, JSON.stringify(report));
  return { sent, report };
}

exports.runDaily = runDaily;
exports.handler = async (event) => {
  // Klassieke Lambda-handler: zonder connectLambda geen Netlify Blobs → loadDB
  // faalt en gaat er niemand iets uit (oorzaak gemiste 12:00-run 28-09-2026).
  try { connectLambda(event); } catch (e) { console.error('connectLambda:', e.message); }
  const hourNL = Number(new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', hour12: false }).format(new Date()));
  if (hourNL !== 12) return { statusCode: 200, body: 'buiten NL-venster' };
  const { sent } = await runDaily();
  return { statusCode: 200, body: JSON.stringify({ sent }) };
};

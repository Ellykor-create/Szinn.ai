'use strict';
// Transactionele e-mail via Resend (https://resend.com) — geen SDK nodig,
// de REST-API is één fetch. Afzender: noreply@szinn.ai (domein in Resend
// geverifieerd via DNS). Zonder RESEND_API_KEY wordt mail overgeslagen en
// gelogd, zodat lokaal testen en de rest van de pipeline gewoon doorwerken.

// TIJDELIJK: udefine.dev als afzender (szinn.ai is nog niet geverifieerd in
// Resend). Zodra szinn.ai geverifieerd is: terugzetten naar noreply@szinn.ai
// of EMAIL_FROM als env var zetten.
const FROM = () => process.env.EMAIL_FROM || 'SZINN <noreply@udefine.dev>';
const SITE = () => (process.env.URL || 'https://szinn.ai').replace(/\/$/, '');
// Waar admin-notificaties (nieuwe aanvraag, mislukte generatie) heen gaan.
// Bewust los van ADMIN_EMAIL: dat is het inlog-account van het admin-paneel.
const ALERT_TO = () => process.env.ADMIN_ALERT_EMAIL || 'danillo@udefine.nl';

async function sendEmail({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email overgeslagen — geen RESEND_API_KEY] aan: ${to} | ${subject}`);
    return { skipped: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM(), to: [to], subject, html }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

// ── Huisstijl-wrapper ────────────────────────────────────────────────────────
function layout(inner) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F0EBE2;font-family:Georgia,'Times New Roman',serif;color:#1C1810">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px">
    <div style="text-align:center;letter-spacing:6px;font-size:20px;color:#A67C3A;margin-bottom:6px">SZINN</div>
    <div style="text-align:center;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#8a7a5c;margin-bottom:32px">Alignment Blueprint</div>
    <div style="background:#FBF8F2;border:1px solid #E3D9C5;border-radius:10px;padding:32px 28px;font-size:15px;line-height:1.75">
      ${inner}
    </div>
    <p style="text-align:center;font-size:11px;color:#8a7a5c;margin-top:26px;line-height:1.7">
      © ${new Date().getFullYear()} Elly Elizabeth Korving · Alterego BV · szinn.ai<br>
      Deze e-mail is persoonlijk en vertrouwelijk.
    </p>
  </div></body></html>`;
}

const btn = (href, label) =>
  `<div style="text-align:center;margin:26px 0"><a href="${href}" style="background:#A67C3A;color:#FBF8F2;text-decoration:none;padding:13px 30px;border-radius:6px;font-size:14px;letter-spacing:1px">${label}</a></div>`;

// Mail 1 — direct na insturen van de vragenlijst
async function sendAccountEmail({ to, name, tempPassword, isNewAccount, lang = 'nl' }) {
  const loginUrl = `${SITE()}/szinn-portal/pages/login.html`;
  if (lang === 'en') {
    const inner = isNewAccount ? `
      <p>Dear ${esc(name)},</p>
      <p>Thank you for your trust. Your personal Alignment Blueprint is now <strong>being composed</strong> — this can take several hours. You will receive an email the moment it is ready.</p>
      <p>Your personal dashboard has been created. You can log in with:</p>
      <p style="background:#F0EBE2;border-radius:6px;padding:14px 18px">
        Email: <strong>${esc(to)}</strong><br>Password: <strong>${esc(tempPassword)}</strong></p>
      ${btn(loginUrl, 'Open your dashboard')}
      <p style="font-size:13px;color:#8a7a5c">Tip: change your password after your first login.</p>` : `
      <p>Dear ${esc(name)},</p>
      <p>Thank you for your trust. A new Alignment Blueprint is being composed in your existing account — this can take several hours. You will receive an email the moment it is ready.</p>
      ${btn(loginUrl, 'Open your dashboard')}`;
    return sendEmail({ to, subject: 'Your SZINN Blueprint is being composed', html: layout(inner) });
  }
  const inner = isNewAccount ? `
    <p>Beste ${esc(name)},</p>
    <p>Dank voor je vertrouwen. Jouw persoonlijke Alignment Blueprint wordt nu <strong>samengesteld</strong> — dit kan een aantal uur duren. Je ontvangt een e-mail zodra hij klaarstaat.</p>
    <p>Je persoonlijke dashboard is aangemaakt. Je kunt inloggen met:</p>
    <p style="background:#F0EBE2;border-radius:6px;padding:14px 18px">
      E-mail: <strong>${esc(to)}</strong><br>Wachtwoord: <strong>${esc(tempPassword)}</strong></p>
    ${btn(loginUrl, 'Open je dashboard')}
    <p style="font-size:13px;color:#8a7a5c">Tip: wijzig je wachtwoord na je eerste keer inloggen.</p>` : `
    <p>Beste ${esc(name)},</p>
    <p>Dank voor je vertrouwen. In je bestaande account wordt een nieuwe Alignment Blueprint samengesteld — dit kan een aantal uur duren. Je ontvangt een e-mail zodra hij klaarstaat.</p>
    ${btn(loginUrl, 'Open je dashboard')}`;
  return sendEmail({ to, subject: 'Je SZINN Blueprint wordt samengesteld', html: layout(inner) });
}

// Mail 2 — blueprint klaar
async function sendReadyEmail({ to, name, orderId, lang = 'nl' }) {
  const dashUrl = `${SITE()}/szinn-portal/pages/dashboard.html`;
  if (lang === 'en') {
    const inner = `
      <p>Dear ${esc(name)},</p>
      <p>It is ready. Your personal <strong>SZINN Alignment Blueprint</strong> awaits you in your dashboard — composed from your birth chart, your numbers and your soul task.</p>
      ${btn(dashUrl, 'View your Blueprint')}
      <p style="font-size:13px;color:#8a7a5c">Take your time. This document is not meant to be understood in one reading — it is meant to be returned to.</p>`;
    return sendEmail({ to, subject: 'Your SZINN Alignment Blueprint is ready ✦', html: layout(inner) });
  }
  const inner = `
    <p>Beste ${esc(name)},</p>
    <p>Hij is klaar. Jouw persoonlijke <strong>SZINN Alignment Blueprint</strong> staat voor je klaar in je dashboard — samengesteld uit jouw geboortekaart, jouw getallen en jouw zielstaak.</p>
    ${btn(dashUrl, 'Bekijk je Blueprint')}
    <p style="font-size:13px;color:#8a7a5c">Neem de tijd. Dit document is niet bedoeld om in één keer te begrijpen — het is bedoeld om naar terug te keren.</p>`;
  return sendEmail({ to, subject: 'Je SZINN Alignment Blueprint staat klaar ✦', html: layout(inner) });
}

// Admin-alert bij een mislukte generatie (na de automatische retry)
async function sendAdminAlert({ orderId, error, attempts }) {
  const inner = `
    <p><strong>Blueprint-generatie mislukt</strong></p>
    <p>Order: <strong>${esc(orderId)}</strong><br>Pogingen: ${attempts}<br>Fout:</p>
    <pre style="background:#F0EBE2;border-radius:6px;padding:12px;font-size:12px;white-space:pre-wrap">${esc(String(error).slice(0, 1500))}</pre>
    <p>Herstart de generatie via het admin-paneel of onderzoek de fout in de Netlify function logs.</p>`;
  return sendEmail({ to: ALERT_TO(), subject: `⚠️ SZINN blueprint-generatie mislukt: ${orderId}`, html: layout(inner) });
}

// Admin-notificatie bij een nieuwe aanvraag (intake ingestuurd)
async function sendNewOrderEmail({ orderId, clientName, email, birthDate, birthLocation, language }) {
  const inner = `
    <p><strong>Nieuwe blueprint-aanvraag</strong></p>
    <p style="background:#F0EBE2;border-radius:6px;padding:14px 18px;font-size:14px;line-height:1.9">
      Order: <strong>${esc(orderId)}</strong><br>
      Naam: <strong>${esc(clientName || '—')}</strong><br>
      E-mail: ${esc(email)}<br>
      Geboortedatum: ${esc(birthDate || '—')}<br>
      Geboorteplaats: ${esc(birthLocation || '—')}<br>
      Taal: ${esc((language || 'nl').toUpperCase())}</p>
    <p style="font-size:13px;color:#8a7a5c">De generatie is automatisch gestart. Je ontvangt alleen nog een mail als deze mislukt.</p>`;
  return sendEmail({ to: ALERT_TO(), subject: `Nieuwe SZINN aanvraag: ${clientName || email} (${orderId})`, html: layout(inner) });
}

function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

module.exports = { sendEmail, sendAccountEmail, sendReadyEmail, sendAdminAlert, sendNewOrderEmail };

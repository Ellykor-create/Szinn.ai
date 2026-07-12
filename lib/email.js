'use strict';
// Transactionele e-mail via Resend (https://resend.com) — geen SDK nodig,
// de REST-API is één fetch. Afzender: noreply@szinn.ai (domein in Resend
// geverifieerd via DNS). Zonder RESEND_API_KEY wordt mail overgeslagen en
// gelogd, zodat lokaal testen en de rest van de pipeline gewoon doorwerken.
//
// Huisstijl: gebaseerd op de SZINN e-mail stijlgids — smalle banner, gouden
// lijn, Cormorant-serif koppen, crème kaders, gouden knop, donkere voettekst
// met de vaste signatuurregel. E-mail-client-proof: tabel-layout + inline CSS.

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

// ── Huisstijl ────────────────────────────────────────────────────────────────
const FONTS = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Jost:wght@300;400;500&display=swap";
const SERIF = "'Cormorant Garamond',Georgia,'Times New Roman',serif";
const SANS = "'Jost',Helvetica,Arial,sans-serif";

const COPY = {
  nl: { signature: 'Je was nooit verloren, je was aan het herinneren.', warmth: 'Met warme groet,', facilitator: 'facilitator van SZINN', rights: 'Alle rechten voorbehouden', remember: 'Herinner je wie je bent.' },
  en: { signature: 'You were never lost, you were remembering.', warmth: 'With warmth,', facilitator: 'facilitator of SZINN', rights: 'All rights reserved', remember: 'Remember who you are.' },
};
const t = (lang) => COPY[lang === 'en' ? 'en' : 'nl'];

// Volledige mail rond de body-inhoud (inner). preheader = verborgen previewtekst.
function layout(inner, { preheader = '', lang = 'nl', footNote = '' } = {}) {
  const c = t(lang);
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="${lang === 'en' ? 'en' : 'nl'}" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<link href="${FONTS}" rel="stylesheet">
<!--[if mso]><style>* {font-family: Georgia, 'Times New Roman', serif !important;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:#E7E1D6;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#E7E1D6;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#E7E1D6;">
<tr><td align="center" style="padding:28px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#FFFFFF;border:1px solid rgba(166,124,58,0.18);border-radius:4px;overflow:hidden;">
    <!-- BANNER -->
    <tr><td style="background:#F0EBE2;padding:34px 44px 26px;text-align:center;">
      <div style="font-family:${SERIF};font-size:34px;font-weight:600;letter-spacing:0.2em;color:#A67C3A;line-height:1;">SZINN</div>
      <div style="width:44px;height:1px;background:#C9A96E;line-height:1px;font-size:0;margin:14px auto 12px;">&nbsp;</div>
      <div style="font-family:${SANS};font-size:10px;font-weight:500;letter-spacing:0.32em;text-transform:uppercase;color:#8a7860;">Alignment Blueprint</div>
    </td></tr>
    <tr><td style="height:3px;background:#C9A96E;line-height:3px;font-size:0;">&nbsp;</td></tr>
    <!-- BODY -->
    <tr><td style="padding:38px 44px 30px;font-family:${SANS};font-size:15px;line-height:1.85;font-weight:300;color:#2c2622;">
${inner}
    </td></tr>
    <!-- FOOTER -->
    <tr><td style="background:#0D0A07;padding:26px 44px;text-align:center;">
      <div style="font-family:${SERIF};font-style:italic;font-size:15px;color:rgba(244,236,221,0.6);margin-bottom:12px;">${c.remember}</div>
      <div style="font-family:${SANS};font-size:11px;letter-spacing:0.04em;color:rgba(201,169,110,0.75);line-height:1.7;">
        Elly Elizabeth Korving &middot; SZINN<br>110 Life &amp; Business Awareness &middot; <a href="https://szinn.ai" style="color:rgba(201,169,110,0.85);text-decoration:none;">szinn.ai</a>
      </div>
      <div style="font-family:${SANS};font-size:9px;letter-spacing:0.03em;color:rgba(201,169,110,0.4);margin-top:14px;">&copy; ${year} Alterego BV &middot; ${c.rights}</div>
    </td></tr>
  </table>
  ${footNote ? `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;"><tr><td style="padding:14px 8px;text-align:center;font-family:${SANS};font-size:10px;color:#8a7860;">${footNote}</td></tr></table>` : ''}
</td></tr>
</table>
</body></html>`;
}

// ── Bouwstenen (retourneren HTML voor in de body) ─────────────────────────────
const heading = (text) =>
  `<div style="font-family:${SERIF};font-size:27px;font-weight:600;line-height:1.25;color:#1f1a14;margin:0 0 18px;">${text}</div>`;

const p = (html, style = '') =>
  `<p style="margin:0 0 16px;${style}">${html}</p>`;

const infoBox = (html) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;"><tr><td style="background:#FBF8F3;border:1px solid rgba(166,124,58,0.18);border-radius:6px;padding:16px 18px;font-family:${SANS};font-size:13px;line-height:1.7;font-weight:300;color:#5b5046;">${html}</td></tr></table>`;

const credsBox = (rows) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;"><tr><td style="background:#F6F1E8;border:1px solid rgba(166,124,58,0.18);border-radius:6px;padding:16px 20px;font-family:${SANS};font-size:14px;line-height:1.9;color:#2c2622;">${rows}</td></tr></table>`;

const code = (text) =>
  `<code style="background:rgba(201,169,110,0.15);padding:2px 8px;border-radius:3px;font-family:'Courier New',monospace;">${esc(text)}</code>`;

const divider = () =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="width:70px;border-top:1px solid rgba(166,124,58,0.3);font-size:0;line-height:0;">&nbsp;</td><td style="padding:0 10px;color:#C9A96E;font-size:9px;">&#9670;</td><td style="width:70px;border-top:1px solid rgba(166,124,58,0.3);font-size:0;line-height:0;">&nbsp;</td></tr></table>`;

const quote = (text) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 20px;"><tr><td style="background:#F6F1E8;border-left:3px solid #C9A96E;padding:16px 20px;font-family:${SERIF};font-style:italic;font-size:17px;line-height:1.6;color:#1f1a14;">&ldquo;${text}&rdquo;</td></tr></table>`;

const softLine = (text) =>
  `<div style="font-family:${SERIF};font-style:italic;font-size:19px;color:#A67C3A;margin:26px 0 22px;line-height:1.5;">${text}</div>`;

const button = (href, label) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 22px;"><tr><td style="background:#A67C3A;border-radius:4px;"><a href="${href}" style="display:inline-block;padding:13px 30px;font-family:${SANS};font-size:12px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#FFFFFF;text-decoration:none;">${esc(label)}</a></td></tr></table>`;

const signature = (lang) => {
  const c = t(lang);
  return `<p style="margin:0 0 2px;">${c.warmth}</p>
<p style="margin:0;font-family:${SERIF};font-size:22px;font-weight:500;color:#1f1a14;">Elly Elizabeth Korving</p>
<p style="margin:2px 0 0;font-size:12px;letter-spacing:0.04em;color:#8a7860;">${c.facilitator}</p>`;
};

// ── Mail 1 — direct na insturen van de vragenlijst ────────────────────────────
async function sendAccountEmail({ to, name, tempPassword, isNewAccount, lang = 'nl' }) {
  const en = lang === 'en';
  const loginUrl = `${SITE()}/portaal/inloggen`;
  const creds = credsBox(
    en
      ? `<b style="font-weight:500;">Your account is ready.</b><br>Email: ${code(to)}<br>Password: ${code(tempPassword)}<br><span style="font-size:12px;color:#8a7860;">Save this password — you can change it later in your profile.</span>`
      : `<b style="font-weight:500;">Je account staat klaar.</b><br>E-mail: ${code(to)}<br>Wachtwoord: ${code(tempPassword)}<br><span style="font-size:12px;color:#8a7860;">Bewaar dit wachtwoord — je kunt het later wijzigen in je profiel.</span>`
  );
  const inner = en
    ? heading(isNewAccount ? `Welcome, ${esc(name)}.` : `It's on its way, ${esc(name)}.`) +
      p('Thank you for taking this step. Your personal SZINN Alignment Blueprint is now <b style="font-weight:500;">being composed</b> — this can take a few hours. You will receive an email the moment it is ready.') +
      (isNewAccount ? creds : '') +
      divider() +
      p('While you wait, your dashboard is already yours to explore.') +
      button(`${SITE()}/portaal`, 'Open your dashboard') +
      softLine('You were never lost, you were remembering.') +
      signature(lang)
    : heading(isNewAccount ? `Welkom, ${esc(name)}.` : `Hij is onderweg, ${esc(name)}.`) +
      p('Dank dat je deze stap zet. Jouw persoonlijke SZINN Alignment Blueprint wordt nu <b style="font-weight:500;">samengesteld</b> — dit kan een aantal uur duren. Je ontvangt een e-mail zodra hij klaarstaat.') +
      (isNewAccount ? creds : '') +
      divider() +
      p('Ondertussen is je dashboard al van jou om te verkennen.') +
      button(`${SITE()}/portaal`, 'Open je dashboard') +
      softLine('Je was nooit verloren, je was aan het herinneren.') +
      signature(lang);
  return sendEmail({
    to,
    subject: en ? 'Your SZINN Blueprint is being composed' : 'Je SZINN Blueprint wordt samengesteld',
    html: layout(inner, { lang, preheader: en ? 'Your personal Blueprint is being composed.' : 'Je persoonlijke Blueprint wordt samengesteld.' }),
  });
}

// ── Mail 1b — tussentijds opgeslagen: account aangemaakt, hier ga je verder ────
async function sendDraftEmail({ to, name, tempPassword, lang = 'nl' }) {
  const en = lang === 'en';
  const continueUrl = `${SITE()}${en ? '/intake-en' : '/intake'}`;
  const creds = credsBox(
    en
      ? `<b style="font-weight:500;">An account has been created for you.</b><br>Email: ${code(to)}<br>Password: ${code(tempPassword)}`
      : `<b style="font-weight:500;">Er is een account voor je aangemaakt.</b><br>E-mail: ${code(to)}<br>Wachtwoord: ${code(tempPassword)}`
  );
  const inner = en
    ? heading(`Your answers are safe, ${esc(name)}.`) +
      p('You have <b style="font-weight:500;">saved</b> your questionnaire. Take all the time you need — you can continue whenever it suits you.') +
      creds +
      p('Open the questionnaire while logged in and your saved answers load automatically.') +
      button(continueUrl, 'Continue your questionnaire') +
      softLine('You were never lost, you were remembering.') +
      signature(lang)
    : heading(`Je antwoorden zijn veilig, ${esc(name)}.`) +
      p('Je hebt je vragenlijst <b style="font-weight:500;">opgeslagen</b>. Neem gerust de tijd — je maakt hem af wanneer het jou uitkomt.') +
      creds +
      p('Open de vragenlijst terwijl je ingelogd bent en je opgeslagen antwoorden worden automatisch ingeladen.') +
      button(continueUrl, 'Ga verder met je vragenlijst') +
      softLine('Je was nooit verloren, je was aan het herinneren.') +
      signature(lang);
  return sendEmail({
    to,
    subject: en ? 'Your SZINN questionnaire is saved — continue anytime' : 'Je SZINN vragenlijst is opgeslagen — ga verder wanneer je wilt',
    html: layout(inner, { lang, preheader: en ? 'Your questionnaire is saved.' : 'Je vragenlijst is opgeslagen.' }),
  });
}

// ── Mail 2 — blueprint klaar (aflevering) ─────────────────────────────────────
async function sendReadyEmail({ to, name, orderId, lang = 'nl' }) {
  const en = lang === 'en';
  const viewUrl = `${SITE()}/portaal/blueprint?id=${encodeURIComponent(orderId)}`;
  const inner = en
    ? heading(`Your Blueprint has arrived, ${esc(name)}.`) +
      p('It is ready for you today: a mirror, not a prediction. Not a truth about who you should be, but a reflection of what is already present in your chart.') +
      p('Read it slowly. One section at a time is enough. Let the words land where they resonate and leave the rest; you are always the only expert on yourself.') +
      divider() +
      p('When you are ready, your personal Alignment Blueprint is waiting in your dashboard — composed from your birth chart, your numbers and your soul task.') +
      button(viewUrl, 'Open your Blueprint') +
      p('Reading it together with someone dear to you is welcome. Sometimes another voice reflects back what you could not yet put into words.') +
      softLine('You were never lost, you were remembering.') +
      signature(lang)
    : heading(`Je Blueprint is er, ${esc(name)}.`) +
      p('Hij staat vandaag voor je klaar: een spiegel, geen voorspelling. Geen waarheid over wie je zou moeten zijn, maar een weerspiegeling van wat er al in je kaart aanwezig is.') +
      p('Lees hem rustig. Eén sectie tegelijk is genoeg. Laat de woorden landen waar ze resoneren en laat de rest; jij bent en blijft de enige expert op jezelf.') +
      divider() +
      p('Wanneer je er klaar voor bent, wacht je persoonlijke Alignment Blueprint in je dashboard — samengesteld uit jouw geboortekaart, jouw getallen en jouw zielstaak.') +
      button(viewUrl, 'Open je Blueprint') +
      p('Hem samen lezen met iemand die je dierbaar is, mag. Soms weerkaatst een andere stem wat je zelf nog niet in woorden had.') +
      softLine('Je was nooit verloren, je was aan het herinneren.') +
      signature(lang);
  return sendEmail({
    to,
    subject: en ? 'Your SZINN Alignment Blueprint has arrived ✦' : 'Je SZINN Alignment Blueprint is er ✦',
    html: layout(inner, { lang, preheader: en ? 'Your personal Alignment Blueprint is ready for you.' : 'Je persoonlijke Alignment Blueprint staat voor je klaar.' }),
  });
}

// ── Cadeau — uitnodiging voor de ontvanger ────────────────────────────────────
// De ontvanger heeft nog geen geboortegegevens; de mail nodigt uit om de code
// te verzilveren: account maken → intake invullen → eigen blueprint.
async function sendGiftEmail({ to, recipientName, senderName, giftCode, personalMessage, lang = 'nl' }) {
  const en = lang === 'en';
  const redeemUrl = `${SITE()}/cadeau/verzilveren?code=${encodeURIComponent(giftCode)}`;
  const greeting = recipientName ? (en ? `Dear ${esc(recipientName)},` : `Lieve ${esc(recipientName)},`) : (en ? 'Hello,' : 'Hallo,');
  const from = senderName ? esc(senderName) : (en ? 'someone who cares about you' : 'iemand die om je geeft');
  const inner = en
    ? heading('A gift has been made for you.') +
      p(`${greeting}`) +
      p(`<b style="font-weight:500;">${from}</b> has given you a personal <b style="font-weight:500;">SZINN Alignment Blueprint</b> — a warm, in-depth mirror woven from astrology, numerology and Kabbalah, made uniquely for you.`) +
      (personalMessage ? quote(esc(personalMessage)) : '') +
      p('To receive it, open the link below, create your account and answer a few reflective questions. Your personal Blueprint is then composed for you.') +
      infoBox(`Your gift code: ${code(giftCode)}`) +
      button(redeemUrl, 'Redeem your gift') +
      softLine('You were never lost, you were remembering.') +
      signature(lang)
    : heading('Er is een cadeau voor je gemaakt.') +
      p(`${greeting}`) +
      p(`<b style="font-weight:500;">${from}</b> heeft je een persoonlijke <b style="font-weight:500;">SZINN Alignment Blueprint</b> cadeau gedaan — een warme, diepgaande spiegel, geweven uit astrologie, numerologie en Kabbalah, speciaal voor jou.`) +
      (personalMessage ? quote(esc(personalMessage)) : '') +
      p('Om hem te ontvangen, open je de link hieronder, maak je een account aan en beantwoord je een paar reflectievragen. Daarna wordt jouw persoonlijke Blueprint voor je samengesteld.') +
      infoBox(`Jouw cadeaucode: ${code(giftCode)}`) +
      button(redeemUrl, 'Verzilver je cadeau') +
      softLine('Je was nooit verloren, je was aan het herinneren.') +
      signature(lang);
  return sendEmail({
    to,
    subject: en ? `${senderName || 'Someone'} gave you a SZINN Alignment Blueprint ✦` : `${senderName || 'Iemand'} gaf je een SZINN Alignment Blueprint ✦`,
    html: layout(inner, { lang, preheader: en ? 'A personal SZINN Alignment Blueprint has been gifted to you.' : 'Een persoonlijke SZINN Alignment Blueprint is aan jou cadeau gedaan.' }),
  });
}

// Bevestiging aan de gever dat het cadeau is ingepland/verstuurd
async function sendGiftConfirmationEmail({ to, senderName, recipientEmail, sendDate, giftCode, lang = 'nl' }) {
  const en = lang === 'en';
  const scheduled = sendDate && sendDate !== 'now';
  const inner = en
    ? heading('Your gift is on its way.') +
      p(`Thank you, ${esc(senderName || 'you')}. ${scheduled ? `Your SZINN Blueprint gift will be delivered to <b style="font-weight:500;">${esc(recipientEmail)}</b> on <b style="font-weight:500;">${esc(sendDate)}</b>.` : `Your SZINN Blueprint gift has just been sent to <b style="font-weight:500;">${esc(recipientEmail)}</b>.`}`) +
      infoBox(`Gift code: ${code(giftCode)} — this is the code your recipient uses to redeem their Blueprint.`) +
      signature(lang)
    : heading('Je cadeau is onderweg.') +
      p(`Dank je, ${esc(senderName || '')}. ${scheduled ? `Je SZINN Blueprint-cadeau wordt bezorgd bij <b style="font-weight:500;">${esc(recipientEmail)}</b> op <b style="font-weight:500;">${esc(sendDate)}</b>.` : `Je SZINN Blueprint-cadeau is zojuist verstuurd naar <b style="font-weight:500;">${esc(recipientEmail)}</b>.`}`) +
      infoBox(`Cadeaucode: ${code(giftCode)} — dit is de code waarmee de ontvanger de Blueprint verzilvert.`) +
      signature(lang);
  return sendEmail({
    to,
    subject: en ? 'Your SZINN gift is on its way ✦' : 'Je SZINN cadeau is onderweg ✦',
    html: layout(inner, { lang }),
  });
}

// ── Admin-notificaties (intern, zelfde stijl) ─────────────────────────────────
async function sendAdminAlert({ orderId, error, attempts }) {
  const inner = heading('Blueprint-generatie mislukt') +
    infoBox(`Order: <b style="font-weight:500;">${esc(orderId)}</b><br>Pogingen: ${attempts}`) +
    `<pre style="background:#F6F1E8;border-radius:6px;padding:12px;font-size:12px;white-space:pre-wrap;font-family:'Courier New',monospace;color:#2c2622;">${esc(String(error).slice(0, 1500))}</pre>` +
    p('Herstart de generatie via het admin-paneel of onderzoek de fout in de Netlify function logs.');
  return sendEmail({ to: ALERT_TO(), subject: `⚠️ SZINN blueprint-generatie mislukt: ${orderId}`, html: layout(inner, { lang: 'nl' }) });
}

async function sendNewOrderEmail({ orderId, clientName, email, birthDate, birthLocation, language }) {
  const inner = heading('Nieuwe blueprint-aanvraag') +
    infoBox(`Order: <b style="font-weight:500;">${esc(orderId)}</b><br>Naam: <b style="font-weight:500;">${esc(clientName || '—')}</b><br>E-mail: ${esc(email)}<br>Geboortedatum: ${esc(birthDate || '—')}<br>Geboorteplaats: ${esc(birthLocation || '—')}<br>Taal: ${esc((language || 'nl').toUpperCase())}`) +
    p('De generatie is automatisch gestart. Je ontvangt alleen nog een mail als deze mislukt.');
  return sendEmail({ to: ALERT_TO(), subject: `Nieuwe SZINN aanvraag: ${clientName || email} (${orderId})`, html: layout(inner, { lang: 'nl' }) });
}

function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

module.exports = {
  sendEmail, sendAccountEmail, sendDraftEmail, sendReadyEmail,
  sendGiftEmail, sendGiftConfirmationEmail, sendAdminAlert, sendNewOrderEmail,
};

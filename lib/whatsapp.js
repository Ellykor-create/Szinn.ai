'use strict';
// WhatsApp via Meta Cloud API — geen SDK nodig, de REST-API is één fetch,
// net als lib/email.js. Zonder WHATSAPP_TOKEN/WHATSAPP_PHONE_ID wordt het
// bericht overgeslagen en gelogd, zodat lokaal draaien blijft werken.
//
// Bedrijf-geïnitieerde WhatsApp MOET een goedgekeurde template gebruiken
// (Meta Business Manager → WhatsApp → Message templates).
// Verwachte template (naam via WHATSAPP_TEMPLATE, standaard 'daily_reading'):
//
//   Hoi {{1}}, je SZINN-reading van vandaag staat klaar 🌙
//   Vandaag: {{2}}
//   {{3}}
//   [knop] Open je dashboard → https://szinn.ai/dashboard
//
// De 3 body-variabelen worden per gebruiker ingevuld (naam, thema, focusregel).
// De dashboardlink is een statische URL-knop in de template zelf.

const GRAPH = 'https://graph.facebook.com/v21.0';

async function sendWhatsApp({ to, params = [], lang = 'nl', template } = {}) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const name = template || process.env.WHATSAPP_TEMPLATE || 'daily_reading';
  if (!token || !phoneId) {
    console.log(`[whatsapp overgeslagen — geen WHATSAPP_TOKEN/PHONE_ID] aan: ${to} | ${name}`);
    return { skipped: true };
  }
  const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: String(to).replace(/[^\d]/g, ''), // Meta wil kaal internationaal nummer, geen + of spaties
      type: 'template',
      template: {
        name,
        language: { code: lang === 'en' ? 'en' : 'nl' },
        components: [{ type: 'body', parameters: params.map(text => ({ type: 'text', text: String(text) })) }],
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`WhatsApp ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

module.exports = { sendWhatsApp };

// Zelfcheck: `node lib/whatsapp.js` — zonder creds mag er niets verstuurd worden
// en mag er niets crashen (de server moet blijven draaien).
if (require.main === module) {
  delete process.env.WHATSAPP_TOKEN; delete process.env.WHATSAPP_PHONE_ID;
  sendWhatsApp({ to: '+31 6 1234 5678', params: ['a', 'b', 'c'] }).then(r => {
    if (!r.skipped) throw new Error('had moeten overslaan zonder creds');
    console.log('OK: overgeslagen zonder creds');
  });
}

'use strict';
// Boekproduct: zodra de Blueprint klaar is plaatst de worker-callback (api.js) hier
// automatisch een order bij Print&Bind (https://www.printenbind.nl/api/docs). Het
// boek is de digitale 3delen-PDF als één bestand, zoals Elly hem tot nu toe met
// de hand bestelde; Print&Bind haalt hem op via een lang geldige getekende link.
// Er is geen sandbox: dit token plaatst echte orders op Elly's account.

const API = 'https://www.printenbind.nl/api/rest';

// Instellingen zoals Elly het boek op printenbind.nl bestelt (screenshots 18 okt 2026):
// A4, dubbelzijdig kleur, titelpagina enkelzijdig, randloos, rustiek 120 g, garenloos,
// linnen omslag 300 g glanzend gelamineerd, achterkant omslag onbedrukt, bedrukte rug
// via de bindrug-editor (tekst per klant, zie spineText). PRINTENBIND_ARTICLE (JSON) overschrijft.
const ARTICLE = {
  product: 'boek', number: 1, color: 'all', size: 'a4', printside: 'double', printside_front: 'single',
  borderless: true, check_doc: false, add_inserts: false, papertype: 'rustic_120', finishing_extra: 'none',
  finishing: 'garenloos inbinden', spine: 'custom', spine_edge: false,
  spine_editor_font: 'Merriweather-Regular', spine_editor_text_align: 'center',
  spine_editor_text_color: '#FFFFFF', spine_editor_bg_color: '#0D0A07',
  papertype_cover: 'linen_300', finishing_cover: 'laminating_glossy', printside_back: false,
};

// Rugtekst, bv. "Szinn Alignment Blueprint | Jaymie Pieplenbosch | 2026".
const spineText = (name, year = new Date().getFullYear()) => `Szinn Alignment Blueprint | ${String(name || '').trim()} | ${year}`.slice(0, 1000);

const COUNTRIES = ['NL', 'BE', 'DE', 'LU', 'FR', 'AT', 'GB'];

const configured = () => !!process.env.PRINTENBIND_TOKEN;

// Bezorgadres uit de intake (stap 2 in boekmodus) → null als iets ontbreekt.
function parseAddress(d) {
  const a = {
    contact: String(d.bezorg_naam || '').trim().slice(0, 35),
    street: String(d.bezorg_straat || '').trim(),
    number: String(d.bezorg_huisnummer || '').trim(),
    number_ext: String(d.bezorg_toevoeging || '').trim() || null,
    postalcode: String(d.bezorg_postcode || '').trim().toUpperCase(),
    city: String(d.bezorg_plaats || '').trim(),
    country: String(d.bezorg_land || 'NL').trim().toUpperCase(),
  };
  if (!a.contact || !a.street || !a.number || !a.postalcode || !a.city || !COUNTRIES.includes(a.country)) return null;
  return a;
}

async function pb(method, path, body) {
  const form = body instanceof FormData;
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${process.env.PRINTENBIND_TOKEN}`, Accept: 'application/json', ...(form ? {} : { 'Content-Type': 'application/json' }) },
    body: form ? body : body ? JSON.stringify(body) : undefined,
    // Zonder timeout breekt Netlify de background function na 15 min stil af (geen fout, geen alert).
    signal: AbortSignal.timeout(10 * 60 * 1000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Print&Bind HTTP ${res.status}: ${json.message || ''} ${JSON.stringify(json.errors || '')}`.slice(0, 1500));
  return json.data;
}

// PDF zelf uploaden naar de documentenmap van het account. Met add_file_method 'url'
// bleef de order op "Wachten – Bestanden" staan: Print&Bind haalde onze getekende
// link (zonder .pdf in het pad) nooit op (ORD-2026-88C36C, 19 okt 2026).
async function uploadPdf(fileUrl, filename) {
  const r = await fetch(fileUrl, { signal: AbortSignal.timeout(5 * 60 * 1000) });
  if (!r.ok) throw new Error(`PDF ophalen voor Print&Bind: HTTP ${r.status}`);
  const form = new FormData();
  form.append('file', new Blob([await r.arrayBuffer()], { type: 'application/pdf' }), filename);
  return (await pb('POST', '/documents', form)).name;
}

const pdfName = (orderId) => `SZINN_Alignment_Blueprint_${orderId}.pdf`;

// Uploadt de PDF en plaatst de order; geeft { id, status, amount, delivery_at }.
// fileUrl = ophaalbare link naar de PDF; pages = paginatal (Print&Bind: "copies").
async function placeBookOrder({ orderId, address, email, fileUrl, pages, name }) {
  const extra = process.env.PRINTENBIND_ARTICLE ? JSON.parse(process.env.PRINTENBIND_ARTICLE) : {};
  const filename = await uploadPdf(fileUrl, pdfName(orderId));
  const o = await pb('POST', '/orders', {
    ...address,
    delivery_method: address.country === 'NL' ? 'post' : 'international',
    production_method: 'standard',
    reference: orderId, // uniek bij Print&Bind: een tweede poging met dezelfde order wordt geweigerd
    email,
    articles: [{ ...ARTICLE, ...extra, add_file_method: 'upload', filenames: filename, copies: pages, spine_editor_text: spineText(name), reference: orderId }],
  });
  return { id: o.id, status: o.status, amount: o.amount, delivery_at: o.delivery_at };
}

// Geplaatste order die nog op het bestand wacht: PDF uploaden en aan het artikel koppelen.
async function attachPdf({ pbOrderId, orderId, fileUrl }) {
  const art = (await pb('GET', `/orders/${pbOrderId}/articles`)).find(a => a.waiting_for_file);
  if (!art) return { attached: false };
  const filename = await uploadPdf(fileUrl, pdfName(orderId));
  await pb('POST', `/articles/${art.id}/documents`, { filenames: filename, file_overwrite: true });
  const o = await pb('GET', `/orders/${pbOrderId}`);
  return { attached: true, status: o.status };
}

module.exports = { configured, parseAddress, placeBookOrder, attachPdf, spineText, COUNTRIES };

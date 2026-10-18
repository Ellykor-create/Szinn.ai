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
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${process.env.PRINTENBIND_TOKEN}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    // Print&Bind haalt de PDF (± 24 MB) op tijdens POST /orders; zonder timeout breekt
    // Netlify de background function na 15 min stil af (geen fout, geen alert).
    signal: AbortSignal.timeout(12 * 60 * 1000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Print&Bind HTTP ${res.status}: ${json.message || ''} ${JSON.stringify(json.errors || '')}`.slice(0, 1500));
  return json.data;
}

// Plaatst de order; geeft { id, status, amount, delivery_at }. fileUrl moet absoluut
// en publiek ophaalbaar zijn; pages = paginatal van die PDF (Print&Bind: "copies").
async function placeBookOrder({ orderId, address, email, fileUrl, pages, name }) {
  const extra = process.env.PRINTENBIND_ARTICLE ? JSON.parse(process.env.PRINTENBIND_ARTICLE) : {};
  const o = await pb('POST', '/orders', {
    ...address,
    delivery_method: address.country === 'NL' ? 'post' : 'international',
    production_method: 'standard',
    reference: orderId, // uniek bij Print&Bind: een tweede poging met dezelfde order wordt geweigerd
    email,
    articles: [{ ...ARTICLE, ...extra, add_file_method: 'url', file_url: fileUrl, file_overwrite: true, copies: pages, spine_editor_text: spineText(name), reference: orderId }],
  });
  return { id: o.id, status: o.status, amount: o.amount, delivery_at: o.delivery_at };
}

module.exports = { configured, parseAddress, placeBookOrder, spineText, COUNTRIES };

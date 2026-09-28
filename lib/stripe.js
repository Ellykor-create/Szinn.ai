'use strict';
// Stripe via de kale REST-API — één fetch, net als lib/whatsapp.js en lib/email.js.
// Geen SDK nodig: de API is form-encoded. Gedeeld door server.js (lokaal/Railway)
// en de Netlify-functie. Zonder STRIPE_SECRET_KEY gooien aanroepen een duidelijke
// fout, zodat endpoints netjes kunnen terugvallen.

const API = 'https://api.stripe.com/v1';

function stripeConfigured() { return !!process.env.STRIPE_SECRET_KEY; }

// params → x-www-form-urlencoded met Stripe's bracket-notatie
// ({ a: { b: 1 }, c: [x] } → a[b]=1&c[0]=x). Arrays werken vanzelf via indices.
function encodeForm(params, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') encodeForm(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function stripeReq(method, path, params) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY niet ingesteld');
  const qs = method === 'GET' && params ? `?${encodeForm(params)}` : '';
  const res = await fetch(`${API}${path}${qs}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(method !== 'GET' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: method !== 'GET' && params ? encodeForm(params).toString() : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${(data.error && data.error.message) || 'onbekende fout'}`);
  return data;
}

// ── Abonnement (€3,69/mnd, incl. 10 Companion-vragen p/mnd) ──────────────────
const SUB_PRICE_CENTS = parseInt(process.env.SUB_PRICE_CENTS || '369', 10);
const SUB_PRODUCT_NAME = 'SZINN Daily Dashboard & Companion';

// Checkout-sessie voor het abonnement. price_data + product_data: Stripe maakt
// het product/de prijs zelf aan — niets vooraf klaarzetten in het dashboard.
function createSubscriptionCheckout({ email, userId, baseUrl }) {
  return stripeReq('POST', '/checkout/sessions', {
    mode: 'subscription',
    customer_email: email,
    client_reference_id: String(userId),
    // Zonder dit toont Stripe geen kortingscode-veld — nodig om te kunnen testen
    // en om acties te draaien zonder de prijs in de code te wijzigen.
    allow_promotion_codes: true,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'eur',
        unit_amount: SUB_PRICE_CENTS,
        recurring: { interval: 'month' },
        product_data: { name: SUB_PRODUCT_NAME },
      },
    }],
    success_url: `${baseUrl}/portaal?sub_session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/portaal`,
  });
}

// ── Cadeau (eenmalig): een Alignment Blueprint cadeau geven ───────────────────
// Eenmalige betaling (mode: payment) i.p.v. een abonnement. success_url komt
// terug op /cadeau met de sessie-id, die de server verifieert voordat het
// cadeau echt wordt aangemaakt.
function createGiftCheckout({ email, userId, baseUrl, priceCents }) {
  return stripeReq('POST', '/checkout/sessions', {
    mode: 'payment',
    customer_email: email,
    client_reference_id: String(userId),
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'eur',
        unit_amount: priceCents,
        product_data: { name: 'SZINN Alignment Blueprint (cadeau)' },
      },
    }],
    // Stripe maakt en mailt een factuur voor deze eenmalige betaling
    // (mits "Email finalized invoices" aanstaat in het Stripe-dashboard).
    invoice_creation: { enabled: true },
    success_url: `${baseUrl}/cadeau?gift_session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/cadeau`,
  });
}

// Compacte samenvatting die we per gebruiker opslaan (Blobs of SQLite-JSON).
function summarizeSub(s) {
  return {
    id: s.id,
    customer: s.customer,
    status: s.status,
    current_period_end: s.current_period_end || null, // unix-seconden
    cancel_at_period_end: !!s.cancel_at_period_end,
    checked_at: Date.now(),
  };
}

function subIsActive(sub) {
  return !!sub && (sub.status === 'active' || sub.status === 'trialing');
}

// De 11-daagse proef start pas als de klant zelf op "Start je elf dagen"
// klikt (user.trial_started_at). Accounts van vóór die regel liepen al vanaf
// created_at en houden dat, anders gaat hun lopende proef ineens op slot.
const TRIAL_ON_CLICK_SINCE = '2026-09-28';
function trialStartedAt(user) {
  if (user?.trial_started_at) return user.trial_started_at;
  return user?.created_at && user.created_at < TRIAL_ON_CLICK_SINCE ? user.created_at : null;
}

// Verse status uit Stripe, hooguit één keer per dag (de rest komt uit opslag).
// Muteert niets: geeft de (eventueel ververste) samenvatting terug.
async function refreshSubIfStale(sub) {
  if (!sub || !sub.id) return sub;
  if (sub.checked_at && Date.now() - sub.checked_at < 86400000) return sub;
  return summarizeSub(await stripeReq('GET', `/subscriptions/${sub.id}`));
}

function cancelSubscription(id) {
  // Netjes aan het einde van de betaalde periode, niet abrupt.
  return stripeReq('POST', `/subscriptions/${id}`, { cancel_at_period_end: true });
}

module.exports = {
  stripeReq, stripeConfigured, encodeForm,
  createSubscriptionCheckout, createGiftCheckout, summarizeSub, subIsActive, trialStartedAt, refreshSubIfStale, cancelSubscription,
};

// Zelf-check (zonder netwerk): node lib/stripe.js
if (require.main === module) {
  const assert = require('node:assert');
  const s = encodeForm({ mode: 'subscription', line_items: [{ price_data: { currency: 'eur', unit_amount: 2000 } }] }).toString();
  assert.strictEqual(decodeURIComponent(s), 'mode=subscription&line_items[0][price_data][currency]=eur&line_items[0][price_data][unit_amount]=2000');
  assert.strictEqual(encodeForm({ a: null, b: 1 }).toString(), 'b=1', 'null-waarden overslaan');
  assert.strictEqual(subIsActive({ status: 'active' }), true);
  assert.strictEqual(subIsActive({ status: 'canceled' }), false);
  assert.strictEqual(subIsActive(null), false);
  assert.strictEqual(trialStartedAt({ created_at: '2026-10-01T00:00:00Z' }), null, 'nieuw account: proef nog niet gestart');
  assert.strictEqual(trialStartedAt({ created_at: '2026-09-01T00:00:00Z' }), '2026-09-01T00:00:00Z', 'oud account: loopt vanaf created_at');
  assert.strictEqual(trialStartedAt({ created_at: '2026-10-01', trial_started_at: '2026-10-02' }), '2026-10-02');
  console.log('ok');
}

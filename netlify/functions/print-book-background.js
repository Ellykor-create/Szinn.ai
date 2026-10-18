'use strict';
// Netlify Background Function (15 min): plaatst de boekorder bij Print&Bind zodra
// de Blueprint klaar is. Apart van de worker-callback omdat Print&Bind de PDF
// (± 24 MB) tijdens het plaatsen ophaalt; dat past niet in een gewone function.
//
// Aanroep (alleen intern, vanuit api.js: worker-callback en admin-knop):
//   POST /.netlify/functions/print-book-background   body: { orderId, secret }

const { connectLambda } = require('@netlify/blobs');
const { loadDB, updateDB } = require('../../lib/db');
const { signedFileUrl } = require('../../lib/kit-worker');
const { placeBookOrder } = require('../../lib/printenbind');
const { sendAdminAlert } = require('../../lib/email');

const SECRET = () => process.env.INTERNAL_TRIGGER_SECRET || process.env.JWT_SECRET || 'szinn-jwt-2026-change-me';
const SITE = () => (process.env.URL || 'https://szinn.ai').replace(/\/+$/, '');

exports.handler = async (event) => {
  try { connectLambda(event); } catch (e) { console.error('connectLambda:', e.message); }
  let payload = {};
  try { payload = JSON.parse(event.body || '{}'); } catch {}
  const { orderId, book, email, name, secret } = payload;
  if (secret !== SECRET()) return { statusCode: 403, body: 'forbidden' };
  // book/email komen mee in de payload: Blobs is eventually consistent, de db hier kan
  // de zojuist opgeslagen paginatelling nog missen. Dubbel plaatsen weigert Print&Bind
  // zelf (reference = orderId is uniek), dus de pb_order_id-check is alleen een kortsluiting.
  const db = await loadDB();
  if (db.orders.find(o => o.id === orderId)?.book?.pb_order_id) return { statusCode: 200, body: 'al geplaatst' };

  let patch;
  try {
    if (!book?.address || !book.pages) throw new Error('bezorgadres of paginatal ontbreekt (worker meldt geen pages?)');
    // 30 dagen geldig: Print&Bind haalt het bestand opnieuw op bij een herdruk of bestandscontrole.
    const r = await placeBookOrder({
      orderId, address: book.address, email,
      fileUrl: SITE() + signedFileUrl(orderId, 'digitaal', 30 * 86400), pages: book.pages, name,
    });
    patch = { status: 'placed', pb_order_id: r.id, pb_status: r.status, pb_amount: r.amount, delivery_at: r.delivery_at, placed_at: new Date().toISOString(), error: null };
    console.log(`${orderId}: boek geplaatst bij Print&Bind (#${r.id}, ${r.status}, levering ${r.delivery_at})`);
  } catch (e) {
    patch = { status: 'failed', error: e.message };
    console.error(`${orderId}: Print&Bind mislukt:`, e.message);
    await sendAdminAlert({ orderId, error: `Boek naar Print&Bind mislukt: ${e.message}`, attempts: 'Print&Bind-boekorder (admin: opnieuw naar drukker)' })
      .catch(err => console.error('admin-alert mislukt:', err.message));
  }
  await updateDB(db => {
    const o = db.orders.find(o => o.id === orderId);
    if (o?.book) o.book = { ...o.book, ...patch };
  });
  return { statusCode: 200, body: JSON.stringify(patch) };
};

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
const { placeBookOrder, attachPdf } = require('../../lib/printenbind');
const { sendAdminAlert } = require('../../lib/email');

const SECRET = () => process.env.INTERNAL_TRIGGER_SECRET || process.env.JWT_SECRET || 'szinn-jwt-2026-change-me';
const SITE = () => (process.env.URL || 'https://szinn.ai').replace(/\/+$/, '');

exports.handler = async (event) => {
  try { connectLambda(event); } catch (e) { console.error('connectLambda:', e.message); }
  let payload = {};
  try { payload = JSON.parse(event.body || '{}'); } catch {}
  const { orderId, book, email, name, secret } = payload;
  if (secret !== SECRET()) { console.error(`print-book: ongeldige trigger voor ${orderId}`); return { statusCode: 403, body: 'forbidden' }; }
  console.log(`${orderId}: boek naar Print&Bind (${book?.pages} pagina's, ${book?.address?.country})`);
  // book/email komen mee in de payload: Blobs is eventually consistent, de db hier kan
  // de zojuist opgeslagen paginatelling nog missen. Dubbel plaatsen weigert Print&Bind
  // zelf (reference = orderId is uniek), dus de pb_order_id-check is alleen een kortsluiting.
  const db = await loadDB();
  const placed = db.orders.find(o => o.id === orderId)?.book;
  if (placed?.file_attached) return { statusCode: 200, body: 'al geplaatst' };

  let patch;
  try {
    const fileUrl = SITE() + signedFileUrl(orderId, 'digitaal', 3600);
    if (placed?.pb_order_id) {
      // Al geplaatst maar zonder bestand (oude url-methode): PDF alsnog koppelen.
      const r = await attachPdf({ pbOrderId: placed.pb_order_id, orderId, fileUrl });
      patch = { file_attached: true, pb_status: r.status || placed.pb_status, error: null };
      console.log(`${orderId}: PDF gekoppeld aan Print&Bind #${placed.pb_order_id} (${r.attached ? r.status : 'wachtte niet op bestand'})`);
    } else {
      if (!book?.address || !book.pages) throw new Error('bezorgadres of paginatal ontbreekt (worker meldt geen pages?)');
      const r = await placeBookOrder({ orderId, address: book.address, email, fileUrl, pages: book.pages, name });
      patch = { status: 'placed', file_attached: true, pb_order_id: r.id, pb_status: r.status, pb_amount: r.amount, delivery_at: r.delivery_at, placed_at: new Date().toISOString(), error: null };
      console.log(`${orderId}: boek geplaatst bij Print&Bind (#${r.id}, ${r.status}, levering ${r.delivery_at})`);
    }
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

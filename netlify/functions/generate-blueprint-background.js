'use strict';
// Netlify Background Function (naam eindigt op "-background" → 15 min limiet).
// Draait de volledige blueprint-pipeline voor één order: berekenen → AI-teksten
// (NL + EN) → audit → renderen → PDF → opslaan → klaar-mail.
//
// Aanroep (alleen intern, vanuit api.js):
//   POST /.netlify/functions/generate-blueprint-background
//   body: { orderId, secret }

const { connectLambda } = require('@netlify/blobs');
const { loadDB, saveDB, blueprintStore } = require('../../lib/db');
const { runGeneration } = require('../../lib/pipeline');

const SECRET = () => process.env.INTERNAL_TRIGGER_SECRET || process.env.JWT_SECRET || 'szinn-jwt-2026-change-me';

exports.handler = async (event) => {
  // Klassieke Lambda-handlers krijgen de Blobs-configuratie niet automatisch;
  // connectLambda(event) leest die uit de request en zet hem klaar.
  try { connectLambda(event); } catch (e) { console.error('connectLambda:', e.message); }
  let payload = {};
  try { payload = JSON.parse(event.body || '{}'); } catch {}
  const { orderId, order, secret } = payload;

  if (secret !== SECRET()) {
    console.error('generate-blueprint: ongeldige trigger (secret klopt niet)');
    return { statusCode: 403, body: 'forbidden' };
  }
  if (!orderId) return { statusCode: 400, body: 'orderId ontbreekt' };

  console.log(`generate-blueprint gestart voor ${orderId}`);
  try {
    const result = await runGeneration(orderId, { loadDB, saveDB, blueprintStore, orderData: order });
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    console.error(`generate-blueprint fataal voor ${orderId}:`, err);
    // status op failed zetten zodat het dashboard en de admin het zien
    try {
      const db = await loadDB();
      const order = db.orders.find(o => o.id === orderId);
      if (order && order.status !== 'completed') {
        order.status = 'failed';
        order.generation_error = String(err.message || err);
        await saveDB(db);
      }
    } catch {}
    return { statusCode: 500, body: String(err.message || err) };
  }
};

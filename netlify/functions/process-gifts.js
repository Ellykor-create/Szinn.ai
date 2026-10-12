'use strict';
// Ingeplande functie: levert cadeaus af waarvan de verzenddatum bereikt is.
// Draait dagelijks (schema in netlify.toml). Idempotent: alleen 'pending'
// cadeaus met send_date <= vandaag; logica in lib/gift.js (gedeeld met api.js).

const { loadDB, saveDB } = require('../../lib/db');
const { connectLambda } = require('@netlify/blobs');
const { processDueGifts } = require('../../lib/gift');

exports.handler = async (event) => {
  // Zonder connectLambda geen Netlify Blobs in een klassieke Lambda-handler.
  try { connectLambda(event); } catch (e) { console.error('connectLambda:', e.message); }
  const db = await loadDB();
  const sent = await processDueGifts(db);
  if (sent) await saveDB(db);
  console.log(`process-gifts: ${sent} cadeau(s) afgeleverd.`);
  return { statusCode: 200, body: JSON.stringify({ sent }) };
};

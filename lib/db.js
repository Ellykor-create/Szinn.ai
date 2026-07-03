'use strict';
// Gedeelde database-laag (Netlify Blobs) voor de API-function én de
// background function. Eén JSON-document voor users/orders/giftcodes;
// grote artefacten (blueprints, teksten, PDF's) apart in szinn-blueprints.

const { getStore } = require('@netlify/blobs');

function dbStore()        { return getStore({ name: 'szinn-db',         consistency: 'strong' }); }
function blueprintStore() { return getStore({ name: 'szinn-blueprints', consistency: 'strong' }); }

function defaultDB() {
  return { users: [], orders: [], giftCodes: [], nextUserId: 1 };
}

async function loadDB() {
  // get() geeft null terug als de key nog niet bestaat (verse database) → default.
  // Een echte fout (bijv. Blobs niet bereikbaar) NIET opvangen: anders zouden we
  // een lege DB teruggeven en bij de eerstvolgende save alle data overschrijven.
  const data = await dbStore().get('data', { type: 'json' });
  return data || defaultDB();
}

async function saveDB(data) {
  await dbStore().setJSON('data', data);
}

module.exports = { dbStore, blueprintStore, loadDB, saveDB, defaultDB };

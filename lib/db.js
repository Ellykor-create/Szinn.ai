'use strict';
// Gedeelde database-laag (Netlify Blobs) voor de API-function én de
// background function. Eén JSON-document voor users/orders/giftcodes;
// grote artefacten (blueprints, teksten, PDF's) apart in szinn-blueprints.

const { getStore } = require('@netlify/blobs');

// Geen 'strong' consistency: het klassieke Lambda-handlerformaat geeft geen
// uncachedEdgeURL mee, waardoor strong reads falen (BlobsConsistencyError).
// Eventual consistency volstaat: één JSON-document, propagatie is vrijwel direct.
function dbStore()        { return getStore({ name: 'szinn-db' }); }
function blueprintStore() { return getStore({ name: 'szinn-blueprints' }); }

function defaultDB() {
  return { users: [], orders: [], giftCodes: [], nextUserId: 1 };
}

// Per geladen db: etag + kopie van wat gelezen is. saveDB schrijft daarmee
// conditioneel; anders overschrijft een (verouderde) lezing andermans wijziging.
const loaded = new WeakMap();

async function loadDB() {
  // null als de key nog niet bestaat (verse database) → default.
  // Een echte fout (bijv. Blobs niet bereikbaar) NIET opvangen: anders zouden we
  // een lege DB teruggeven en bij de eerstvolgende save alle data overschrijven.
  const cur = await dbStore().getWithMetadata('data', { type: 'json' });
  const data = cur?.data || defaultDB();
  loaded.set(data, { etag: cur?.etag || null, base: JSON.stringify(data) });
  return data;
}

// Arrays van records (users, orders, giftCodes, feedback, usedCheckoutSessions).
const keyOf = x => (x && typeof x === 'object') ? (x.id ?? x.code ?? JSON.stringify(x)) : JSON.stringify(x);

// 3-way merge: wat deze aanroep veranderde t.o.v. base, toegepast op de verse db.
// ponytail: per record, niet per veld; schrijven twee aanroepen tegelijk hetzelfde
// record, dan wint de laatste. Tellers (nextUserId) nemen het maximum, maar twee
// gelijktijdige nieuwe users kunnen dan nog hetzelfde id krijgen.
function merge(base, mine, fresh) {
  const out = { ...fresh };
  for (const k of new Set([...Object.keys(base), ...Object.keys(mine)])) {
    const b = base[k], m = mine[k], f = fresh[k];
    if (JSON.stringify(b) === JSON.stringify(m)) continue; // niet door ons gewijzigd
    if (Array.isArray(m) && Array.isArray(f)) {
      const bMap = new Map((Array.isArray(b) ? b : []).map(x => [keyOf(x), JSON.stringify(x)]));
      const mMap = new Map(m.map(x => [keyOf(x), x]));
      const res = f.filter(x => !(bMap.has(keyOf(x)) && !mMap.has(keyOf(x)))) // door ons verwijderd
        .map(x => { const mx = mMap.get(keyOf(x)); return mx !== undefined && JSON.stringify(mx) !== bMap.get(keyOf(x)) ? mx : x; });
      const inRes = new Set(res.map(keyOf));
      for (const [key, x] of mMap) if (!bMap.has(key) && !inRes.has(key)) res.push(x); // door ons toegevoegd
      out[k] = res;
    } else if (typeof m === 'number' && typeof f === 'number') out[k] = Math.max(m, f);
    else if (m === undefined) delete out[k];
    else out[k] = m;
  }
  return out;
}

async function saveDB(data, pogingen = 8) {
  const meta = loaded.get(data);
  if (!meta) { await dbStore().setJSON('data', data); return; } // niet via loadDB gelezen
  let { etag } = meta;
  let next = data;
  for (let i = 0; i < pogingen; i++) {
    const w = await dbStore().setJSON('data', next, etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
    if (w.modified) {
      // Gemerged: de aanroeper werkt verder met de verse stand.
      if (next !== data) { for (const k of Object.keys(data)) if (!(k in next)) delete data[k]; Object.assign(data, next); }
      loaded.set(data, { etag: w.etag || null, base: JSON.stringify(data) });
      return;
    }
    const cur = await dbStore().getWithMetadata('data', { type: 'json' });
    etag = cur?.etag || null;
    next = merge(JSON.parse(meta.base), data, cur?.data || defaultDB());
    await new Promise(r => setTimeout(r, 100 + Math.random() * 300));
  }
  throw new Error('saveDB: te veel gelijktijdige schrijfacties');
}

// Lezen-wijzigen-schrijven met ETag-controle: gelijktijdige schrijvers (bv. drie
// worker-callbacks tegelijk) overschrijven elkaars wijziging dan niet meer.
// fn(db) past db aan; bij een tussentijdse schrijfactie opnieuw vanaf verse data.
async function updateDB(fn, pogingen = 8) {
  for (let i = 0; i < pogingen; i++) {
    const cur = await dbStore().getWithMetadata('data', { type: 'json' });
    const db = cur?.data || defaultDB();
    const result = await fn(db);
    const w = await dbStore().setJSON('data', db, cur ? { onlyIfMatch: cur.etag } : { onlyIfNew: true });
    if (w.modified) return result;
    await new Promise(r => setTimeout(r, 200 + Math.random() * 500));
  }
  throw new Error('updateDB: te veel gelijktijdige schrijfacties');
}

module.exports = { dbStore, blueprintStore, loadDB, saveDB, updateDB, defaultDB };

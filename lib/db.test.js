'use strict';
// Gelijktijdige schrijvers mogen elkaars wijziging niet wegpoetsen (okt 2026:
// Jane's 'completed' ging verloren door een saveDB met een oude lezing).
// Draai: node lib/db.test.js
const assert = require('assert');

// Nep-Blobs-store met etags, in plaats van @netlify/blobs.
let blob = null, etag = 0;
const store = {
  async getWithMetadata() { return blob && { data: JSON.parse(blob), etag: String(etag) }; },
  async setJSON(_k, v, o = {}) {
    if (o.onlyIfMatch && o.onlyIfMatch !== String(etag)) return { modified: false };
    if (o.onlyIfNew && blob) return { modified: false };
    blob = JSON.stringify(v); etag++;
    return { modified: true, etag: String(etag) };
  },
};
require.cache[require.resolve('@netlify/blobs')] = { exports: { getStore: () => store } };
const { loadDB, saveDB } = require('./db');

(async () => {
  blob = JSON.stringify({ users: [{ id: 1 }], orders: [{ id: 'A', status: 'processing' }, { id: 'B', status: 'processing' }, { id: 'X' }], nextUserId: 2 });

  const a = await loadDB(), b = await loadDB(); // allebei dezelfde (oude) lezing
  a.orders[0].status = 'completed';
  a.orders = a.orders.filter(o => o.id !== 'X');
  await saveDB(a);
  b.orders[1].status = 'completed';
  b.users.push({ id: 2 }); b.nextUserId = 3;
  await saveDB(b);

  const db = JSON.parse(blob);
  assert.deepStrictEqual(db.orders.map(o => [o.id, o.status]), [['A', 'completed'], ['B', 'completed']]);
  assert.deepStrictEqual(db.users.map(u => u.id), [1, 2]);
  assert.strictEqual(db.nextUserId, 3);
  assert.strictEqual(b.orders[0].status, 'completed', 'aanroeper ziet na merge de verse stand');

  await saveDB(b); // tweede save op hetzelfde object: geen conflict meer
  console.log('db.test.js: ok');
})().catch(e => { console.error(e); process.exit(1); });

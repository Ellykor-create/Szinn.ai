'use strict';
// Dagboek: dagstart (ochtend) en dagafsluiting (avond) per gebruiker per dag.
// Storage-agnostisch, net als lib/companion-llm.js: beide backends (SQLite en
// Netlify Blobs) geven de bestaande entry + de request-body door; deze module
// valideert, begrenst en merge't. Eén entry per dag, sleutel 'YYYY-MM-DD':
//   { morning: { intention, feeling, powers[], gratitude[10], micro[6], body, at },
//     evening: { gratitude[10], clarity 0-10, shadows[], conscious[4], microDone,
//                released, note, at } }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function clean(v, max = 500) { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }
function cleanList(a, n, max) { return Array.isArray(a) ? a.slice(0, n).map(x => clean(x, max)) : []; }
function clamp10(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : null;
}

// Merge't een ochtend- en/of avonddeel in de bestaande entry. Alleen bekende
// velden, alles begrensd (trust boundary: dit komt rechtstreeks van de client).
function mergeJournalEntry(entry, body) {
  entry = entry && typeof entry === 'object' ? entry : {};
  body = body || {};
  if (body.morning && typeof body.morning === 'object') {
    const m = body.morning;
    entry.morning = {
      intention: clean(m.intention),
      feeling: clean(m.feeling, 80),
      energy: clean(m.energy, 40),
      powers: cleanList(m.powers, 8, 40),
      gratitude: cleanList(m.gratitude, 10, 300),
      // Micro-stappen: max 6 objecten {id, titel, tekst}; niet-objecten overslaan.
      micro: Array.isArray(m.micro)
        ? m.micro.filter(x => x && typeof x === 'object').slice(0, 6)
            .map(x => ({ id: clean(x.id, 40), titel: clean(x.titel, 40), tekst: clean(x.tekst, 300) }))
        : [],
      body: clean(m.body, 40), // gekozen lichaamszone
      at: (entry.morning && entry.morning.at) || new Date().toISOString(),
    };
  }
  if (body.evening && typeof body.evening === 'object') {
    const e = body.evening;
    entry.evening = {
      gratitude: cleanList(e.gratitude, 10, 300),
      clarity: clamp10(e.clarity),
      shadows: Array.isArray(e.shadows) ? e.shadows.slice(0, 6).map(clamp10) : [],
      // Bewuste keuzes: max 4 korte codes ('1'..'4').
      conscious: cleanList(e.conscious, 4, 2),
      microDone: clean(e.microDone, 300), // 'id:ja|id:nee'-formaat
      released: !!e.released,             // losgelaten-vinkje
      note: clean(e.note, 2000),
      at: (entry.evening && entry.evening.at) || new Date().toISOString(),
    };
  }
  return entry;
}

module.exports = { DATE_RE, mergeJournalEntry };

// Zelf-check: node lib/journal.js
if (require.main === module) {
  const assert = require('node:assert');
  assert.ok(DATE_RE.test('2026-07-26') && !DATE_RE.test('26-07-2026'));

  // ochtend opslaan, daarna avond erbij: ochtend blijft staan
  let e = mergeJournalEntry(null, { morning: {
    intention: ' focus ', feeling: 'rustig', energy: 'Sinn', powers: ['Intuïtie'],
    gratitude: Array.from({ length: 12 }, (_, i) => 'g' + i), // 12 → cap 10
    micro: [{ id: 'a', titel: 'x', tekst: 'y' }, 'rommel', { id: 'b' }],
    body: 'x'.repeat(60), // > 40 → afgekapt
  } });
  assert.strictEqual(e.morning.intention, 'focus');
  assert.strictEqual(e.morning.energy, 'Sinn', 'energie-keuze bewaard');
  assert.strictEqual(e.morning.gratitude.length, 10, 'max 10 dankbaarheden');
  assert.strictEqual(e.morning.micro.length, 2, 'niet-objecten overgeslagen');
  assert.deepStrictEqual(e.morning.micro[0], { id: 'a', titel: 'x', tekst: 'y' });
  assert.deepStrictEqual(e.morning.micro[1], { id: 'b', titel: '', tekst: '' }, 'ontbrekende velden → leeg');
  assert.strictEqual(e.morning.body.length, 40, 'lichaamszone geklemd op 40');
  const morningAt = e.morning.at;
  e = mergeJournalEntry(e, { evening: {
    gratitude: Array.from({ length: 12 }, (_, i) => 'd' + i), clarity: '14',
    shadows: [3, '99', 'q'], conscious: ['1', '2', '3', '4', '5'], microDone: 'a:ja|b:nee',
    released: 1, note: 'n',
  } });
  assert.strictEqual(e.morning.at, morningAt, 'ochtend onaangetast');
  assert.strictEqual(e.evening.gratitude.length, 10, 'max 10 avond-dankbaarheden');
  assert.strictEqual(e.evening.clarity, 10, 'clarity geklemd op 10');
  assert.deepStrictEqual(e.evening.shadows, [3, 10, null]);
  assert.deepStrictEqual(e.evening.conscious, ['1', '2', '3', '4'], 'max 4 bewuste keuzes');
  assert.strictEqual(e.evening.microDone, 'a:ja|b:nee');
  assert.strictEqual(e.evening.released, true, '1 → true');

  // rommel-invoer breekt niets
  const junk = mergeJournalEntry({}, { morning: { intention: 42, powers: 'nee', gratitude: null, micro: 'nee' } });
  assert.strictEqual(junk.morning.intention, '');
  assert.deepStrictEqual(junk.morning.powers, []);
  assert.deepStrictEqual(junk.morning.micro, []);
  assert.strictEqual(junk.morning.body, '');
  console.log('ok');
}

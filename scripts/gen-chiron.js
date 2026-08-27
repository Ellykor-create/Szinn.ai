'use strict';
// Bakt Chiron uit de Swiss Ephemeris tot een compacte tabel (lib/chiron-data.js).
// Eenmalig/bij herijking draaien; de runtime (lib/astro.js) heeft daarna GEEN
// ephemeris of native dependency nodig — hij interpoleert alleen de tabel.
//
// Vereist (alleen build-time):
//   npm i sweph            (native binding, niet in de project-deps)
//   de bestanden seas_18.se1 + sepl_18.se1 in ./ephe  (of zet SE_EPHE_PATH)
//   bron: https://github.com/aloistr/swisseph/tree/master/ephe
// Draai:  SE_EPHE_PATH=./ephe node scripts/gen-chiron.js
//
// Tabel: cumulatieve (ontwikkelde, niet-gewrapte) ecliptische lengte van datum
// in boogseconden, Int32, om de STEP_DAYS dagen vanaf JD0. Catmull-Rom-interpolatie
// in de runtime geeft <0,25' fout t.o.v. de volle ephemeris (geverifieerd).

const fs = require('fs');
const path = require('path');
const swe = require('sweph');

swe.set_ephe_path(process.env.SE_EPHE_PATH || path.join(process.cwd(), 'ephe'));
const CH = swe.constants.SE_CHIRON;
const FL = swe.constants.SEFLG_SWIEPH;

// JD0 identiek aan de runtime-afleiding uit een JS-Date (UTC): dus geen
// julday-conversie nodig, JD_UT = ms/86400000 + 2440587.5.
const JD0 = Date.UTC(1900, 0, 1) / 86400000 + 2440587.5;
const JD1 = Date.UTC(2035, 0, 1) / 86400000 + 2440587.5;
const STEP_DAYS = 16;

const rawLon = (jd) => swe.calc_ut(jd, CH, FL).data[0];

const n = Math.ceil((JD1 - JD0) / STEP_DAYS) + 3;
const arcsec = new Int32Array(n);
let cum = rawLon(JD0);
let prev = cum;
arcsec[0] = Math.round(cum * 3600);
for (let k = 1; k < n; k++) {
  const r = rawLon(JD0 + k * STEP_DAYS);
  cum += ((r - prev + 540) % 360) - 180;   // kortste stap, nooit een 360°-sprong
  prev = r;
  arcsec[k] = Math.round(cum * 3600);
}

const b64 = Buffer.from(arcsec.buffer, arcsec.byteOffset, arcsec.byteLength).toString('base64');
const out = `'use strict';
// AUTOGEGENEREERD door scripts/gen-chiron.js — niet met de hand bewerken.
// Chiron (Swiss Ephemeris, seas_18.se1): cumulatieve ecliptische lengte van datum
// in boogseconden (Int32LE), om de ${STEP_DAYS} dagen vanaf JD0. Geverifieerd exact
// tegen zeven klantcharts; interpolatiefout <0,25' t.o.v. de volle ephemeris.
module.exports = {
  jd0: ${JD0},
  step: ${STEP_DAYS},
  count: ${n},
  arcsecB64: '${b64}'
};
`;
const dest = path.join(__dirname, '..', 'lib', 'chiron-data.js');
fs.writeFileSync(dest, out);
console.log(`geschreven ${dest} — ${n} samples, ${(b64.length / 1024).toFixed(1)} KB base64`);

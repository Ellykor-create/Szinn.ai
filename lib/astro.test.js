'use strict';
// Regressietest tegen zeven geverifieerde klantcharts (Swiss Ephemeris / Placidus,
// True Node). Bron: correctie-masterprompt aug 2026. Draai: node lib/astro.test.js
const { calcBirthChart } = require('./astro');
const { tzOffsetFor } = require('./pipeline');

// [naam, datum, tijd, lat, lon, iana, {verwacht}]
const CHARTS = [
  ['Rotterdam',  '1963-06-24','15:15', 51.9225,  4.4792, 'Europe/Amsterdam',
    { asc:['Weegschaal',28,8], mc:['Leeuw',7,50], sun:['Kreeft',2,21,9],
      nn:['Kreeft',20,28,9], chiron:['Vissen',14,54,5,true], mars:['Maagd',11,12,10] }],
  ['Guyana',     '1979-03-22','12:00',  6.80,   -58.17, 'America/Guyana',
    { asc:['Tweelingen',20,6], mc:['Vissen',15,3], sun:['Ram',1,23,10],
      nn:['Maagd',17,25,4], chiron:['Stier',7,2,11], moon:['Steenbok',16,22,7] }],
  ['Opmeer',     '1971-10-15','04:30', 52.703,   4.933, 'Europe/Amsterdam',
    { asc:['Maagd',23,23], mc:['Tweelingen',21,14],
      nn:['Waterman',12,14,5,true], chiron:['Ram',11,9,7,true] }],
  ['Paramaribo', '1948-08-29','13:50',  5.866,  -55.167,'America/Paramaribo',
    { asc:['Steenbok',0,4], mc:['Weegschaal',2,51],
      nn:['Stier',6,58,5,true], chiron:['Schorpioen',19,54,11], uranus:['Tweelingen',29,58,6] }],
  ['Haarlem',    '1955-10-16','02:30', 52.381,   4.637, 'Europe/Amsterdam',
    { asc:['Maagd',2,51], mc:['Stier',23,20],
      nn:['Boogschutter',18,49,4,true], chiron:['Waterman',0,6,5] }],
  ['Hexham',     '1973-05-03','18:50', 54.971,  -2.101, 'Europe/London',
    { asc:['Weegschaal',24,45], mc:['Leeuw',4,33], sun:['Stier',13,9,7],
      nn:['Steenbok',9,5,3,true], chiron:['Ram',18,21,6] }],
  ['Zaandam',    '1977-05-13','03:45', 52.439,   4.829, 'Europe/Amsterdam',
    { asc:['Vissen',9,55], mc:['Boogschutter',22,27],
      nn:['Weegschaal',24,9,7], chiron:['Stier',2,44,1] }],
];

const KEY = { asc:'ascendant', mc:'mc', sun:'sun', moon:'moon', mars:'mars',
  uranus:'uranus', nn:'northNode', chiron:'chiron' };
const SIGN_LON = { Ram:0,Stier:30,Tweelingen:60,Kreeft:90,Leeuw:120,Maagd:150,
  Weegschaal:180,Schorpioen:210,Boogschutter:240,Steenbok:270,Waterman:300,Vissen:330 };

function fmt(p){ return p ? `${p.sign} ${p.deg}°${String(p.min).padStart(2,'0')}'${p.house?' h'+p.house:''}${p.retrograde?' Rx':''}` : '—'; }

// Enkele referentiecoördinaten (Vergenoegen, Paramaribo, Hexham) zijn benaderd;
// daar mag de boog tot ~10' afwijken. Chiron komt uit de gebakken Swiss-Ephemeris-
// tabel (lib/chiron-data.js) en telt volwaardig mee.
const TOL = 10;
let fails = 0;
for (const [name, date, time, lat, lon, tz, exp] of CHARTS) {
  const off = tzOffsetFor(tz, date);
  const chart = calcBirthChart(date, time, lat, lon, off);
  console.log(`\n== ${name} (tzOffset ${off}) ==`);
  for (const [k, e] of Object.entries(exp)) {
    const p = chart.planets[KEY[k]];
    const [esign, edeg, emin, ehouse] = e;
    const dSign = p && p.sign === esign;
    const eLon = SIGN_LON[esign] + edeg + emin/60;
    const diff = p ? Math.abs((((p.lon - eLon)%360)+540)%360-180)*60 : 999;
    const houseOk = ehouse == null || (p && p.house === ehouse);
    const ok = dSign && diff < TOL && houseOk;
    if (!ok) fails++;
    console.log(`  ${ok?'OK ':'XX '} ${k.padEnd(7)} got ${fmt(p).padEnd(26)} exp ${esign} ${edeg}°${emin}'${ehouse?' h'+ehouse:''}  Δ${diff.toFixed(1)}'`);
  }
}
console.log(`\n${fails} afwijkingen`);
process.exitCode = fails ? 1 : 0;

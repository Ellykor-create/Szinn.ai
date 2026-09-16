'use strict';
const A = require('astronomy-engine');

const SIGNS_NL = [
  'Ram','Stier','Tweelingen','Kreeft','Leeuw','Maagd',
  'Weegschaal','Schorpioen','Boogschutter','Steenbok','Waterman','Vissen'
];
const SIGN_EN = [
  'Aries','Taurus','Gemini','Cancer','Leo','Virgo',
  'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'
];
const ELEMENTS = {
  Ram:'vuur',Leeuw:'vuur',Boogschutter:'vuur',
  Stier:'aarde',Maagd:'aarde',Steenbok:'aarde',
  Tweelingen:'lucht',Weegschaal:'lucht',Waterman:'lucht',
  Kreeft:'water',Schorpioen:'water',Vissen:'water'
};
const MODALITIES = {
  Ram:'cardinaal',Kreeft:'cardinaal',Weegschaal:'cardinaal',Steenbok:'cardinaal',
  Stier:'vast',Leeuw:'vast',Schorpioen:'vast',Waterman:'vast',
  Tweelingen:'veranderlijk',Maagd:'veranderlijk',Boogschutter:'veranderlijk',Vissen:'veranderlijk'
};
const PLANET_NAMES = {
  sun:'Zon',moon:'Maan',mercury:'Mercurius',venus:'Venus',mars:'Mars',
  jupiter:'Jupiter',saturn:'Saturnus',uranus:'Uranus',neptune:'Neptunus',pluto:'Pluto'
};

function lonToPos(lon) {
  const n = ((lon % 360) + 360) % 360;
  let idx = Math.floor(n / 30);
  let deg = Math.floor(n - idx * 30);
  // Boogminuten AFRONDEN (niet afkappen); bij 60' de graad, en zo nodig het
  // teken, laten doorschuiven (12°41,7' → 12°42', 29°59,7' → volgend teken 0°00').
  let min = Math.round(((n - idx * 30) - deg) * 60);
  if (min === 60) { min = 0; deg += 1; }
  if (deg === 30) { deg = 0; idx = (idx + 1) % 12; }
  const sign = SIGNS_NL[idx];
  return {
    sign, signEn: SIGN_EN[idx],
    deg, min,
    lon: n,                       // volle precisie behouden voor huistoewijzing
    element: ELEMENTS[sign],
    modality: MODALITIES[sign]
  };
}

// True Node (osculerende klimmende maansknoop) uit de baanimpuls van de Maan,
// in de echte ecliptica van datum — dezelfde frame als A.Ecliptic hierboven.
// Nooit de Mean Node. Geverifieerd exact tegen zeven klantcharts.
function trueNodeLon(dt) {
  const t = A.MakeTime(dt);
  const st = A.GeoMoonState(t);                 // positie + snelheid (EQJ)
  const e = A.RotateState(A.Rotation_EQJ_ECT(t), st); // → ecliptica van datum
  const hx = e.y * e.vz - e.z * e.vy;           // baanimpuls h = r × v
  const hy = e.z * e.vx - e.x * e.vz;
  // knoopvector N = ẑ × h = (−hy, hx); lengte = atan2(N.y, N.x)
  const lon = Math.atan2(hx, -hy) * 180 / Math.PI;
  return ((lon % 360) + 360) % 360;
}

const DEG = Math.PI / 180;

// ── Chiron via voorgebakken Swiss-Ephemeris-tabel (lib/chiron-data.js) ───────
// De Kepler-tweelichamenbenadering liep uit de pas met de leeftijd (~4° rond
// 1948). De tabel is uit de volle Swiss Ephemeris (seas_18.se1) gebakken; hier
// alleen Catmull-Rom-interpolatie, <0,25' fout. Herbakken: scripts/gen-chiron.js.
const CH_DATA = require('./chiron-data');
const CH_CUM = (() => {                          // cumulatieve lengte in boogseconden
  const buf = Buffer.from(CH_DATA.arcsecB64, 'base64');
  const a = new Int32Array(buf.length / 4);
  for (let k = 0; k < a.length; k++) a[k] = buf.readInt32LE(k * 4);
  return a;
})();

function chironEclipticLon(dt) {
  const jd = dt.getTime() / 86400000 + 2440587.5;
  const x = (jd - CH_DATA.jd0) / CH_DATA.step;
  const i = Math.max(1, Math.min(CH_CUM.length - 3, Math.floor(x)));
  const t = x - i;
  const p0 = CH_CUM[i - 1], p1 = CH_CUM[i], p2 = CH_CUM[i + 1], p3 = CH_CUM[i + 2];
  const v = 0.5 * (2 * p1 + (-p0 + p2) * t
    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
    + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  return ((v / 3600) % 360 + 360) % 360;   // boogseconden → graden, gewrapt
}

// ── Placidus-huizen (iteratieve halve-boog-methode); Porphyry als vangnet ────
function eclFromRA(raDeg, epsDeg) {
  const ra = raDeg * DEG, eps = epsDeg * DEG;
  let lon = Math.atan2(Math.sin(ra), Math.cos(ra) * Math.cos(eps)) / DEG;
  return ((lon % 360) + 360) % 360;
}

function placidusCusp(ramc, offsetInit, frac, nocturnal, latDeg, epsDeg) {
  // frac: aandeel van de (dag- of nacht-)halve boog; iteratief oplossen
  let ra = ramc + offsetInit;
  for (let k = 0; k < 30; k++) {
    const lon = eclFromRA(ra, epsDeg);
    const dec = Math.asin(Math.sin(epsDeg * DEG) * Math.sin(lon * DEG));
    const x = Math.tan(latDeg * DEG) * Math.tan(dec);
    if (x < -1 || x > 1) return null; // circumpolair: Placidus ondefinieerd
    const ad = Math.asin(x) / DEG;
    const next = nocturnal
      ? ramc + 180 - (90 - ad) * frac   // cusps 2/3 (onder de horizon)
      : ramc + (90 + ad) * frac;        // cusps 11/12 (boven de horizon)
    if (Math.abs((((next - ra) % 360) + 540) % 360 - 180) < 1e-7) { ra = next; break; }
    ra = next;
  }
  return eclFromRA(ra, epsDeg);
}

function calcHouses(ramc, ascLon, mcLon, latDeg, epsDeg) {
  const cusps = new Array(13).fill(null);
  cusps[1] = ascLon;
  cusps[10] = mcLon;
  cusps[4] = (mcLon + 180) % 360;
  cusps[7] = (ascLon + 180) % 360;
  const c11 = placidusCusp(ramc, 30, 1 / 3, false, latDeg, epsDeg);
  const c12 = placidusCusp(ramc, 60, 2 / 3, false, latDeg, epsDeg);
  const c2  = placidusCusp(ramc, 120, 2 / 3, true, latDeg, epsDeg);
  const c3  = placidusCusp(ramc, 150, 1 / 3, true, latDeg, epsDeg);
  if (c11 === null || c12 === null || c2 === null || c3 === null) {
    // Porphyry-vangnet voor extreme breedtegraden
    const arc1 = (((mcLon - ascLon) % 360) + 360) % 360; // ASC→MC achterwaarts
    const seg = ((((ascLon + 180) % 360) - mcLon + 360) % 360) / 3; // MC→DESC? — kwadrant IC..ASC
    const q1 = ((((mcLon + 180) % 360) - ascLon + 360) % 360) / 3;  // ASC→IC
    cusps[2] = (ascLon + q1) % 360;
    cusps[3] = (ascLon + 2 * q1) % 360;
    const q4 = ((ascLon - mcLon + 360) % 360) / 3; // MC→ASC
    cusps[11] = (mcLon + q4) % 360;
    cusps[12] = (mcLon + 2 * q4) % 360;
  } else {
    cusps[11] = c11; cusps[12] = c12; cusps[2] = c2; cusps[3] = c3;
  }
  for (const [from, to] of [[2, 8], [3, 9], [11, 5], [12, 6]]) cusps[to] = (cusps[from] + 180) % 360;
  return cusps.slice(1); // index 0 = cusp huis 1
}

function houseOf(lon, cusps) {
  for (let h = 0; h < 12; h++) {
    const a = cusps[h], b = cusps[(h + 1) % 12];
    const span = ((b - a) % 360 + 360) % 360;
    const off = ((lon - a) % 360 + 360) % 360;
    if (off < span) return h + 1;
  }
  return 12;
}

function calcBirthChart(birthDateStr, birthTimeStr, lat, lng, tzOffsetHours = 0) {
  const [y, m, d] = birthDateStr.split('-').map(Number);
  const [h, mn] = birthTimeStr ? birthTimeStr.split(':').map(Number) : [12, 0];

  // Convert local time to UTC using timezone offset
  const localMs = Date.UTC(y, m - 1, d, h, mn);
  const utcMs   = localMs - tzOffsetHours * 3600000;
  const dt = new Date(utcMs);

  const bodyDefs = [
    { key:'sun',     body:A.Body.Sun },
    { key:'moon',    body:A.Body.Moon },
    { key:'mercury', body:A.Body.Mercury },
    { key:'venus',   body:A.Body.Venus },
    { key:'mars',    body:A.Body.Mars },
    { key:'jupiter', body:A.Body.Jupiter },
    { key:'saturn',  body:A.Body.Saturn },
    { key:'uranus',  body:A.Body.Uranus },
    { key:'neptune', body:A.Body.Neptune },
    { key:'pluto',   body:A.Body.Pluto },
  ];

  const dtNext = new Date(utcMs + 86400000); // voor retrograde-detectie

  const planets = {};
  for (const { key, body } of bodyDefs) {
    try {
      const ecl = A.Ecliptic(A.GeoVector(body, dt, false));
      planets[key] = { name: PLANET_NAMES[key], ...lonToPos(ecl.elon) };
      if (!['sun', 'moon'].includes(key)) {
        const next = A.Ecliptic(A.GeoVector(body, dtNext, false)).elon;
        const delta = ((next - ecl.elon) % 360 + 540) % 360 - 180;
        planets[key].retrograde = delta < 0;
      } else {
        planets[key].retrograde = false;
      }
    } catch (e) {
      planets[key] = { name: PLANET_NAMES[key], sign:'?', deg:0, min:0, lon:0, element:'?', modality:'?', retrograde:false };
    }
  }

  // Chiron (Kepler-benadering)
  try {
    const cLon = chironEclipticLon(dt);
    const cNext = chironEclipticLon(dtNext);
    planets.chiron = { name:'Chiron', ...lonToPos(cLon), retrograde: (((cNext - cLon) % 360 + 540) % 360 - 180) < 0 };
  } catch (e) {
    planets.chiron = { name:'Chiron', sign:'?', deg:0, min:0, lon:0, element:'?', modality:'?', retrograde:false };
  }

  // Ascendant, MC en huizen (Placidus)
  let houseCusps = null;
  try {
    const gst  = A.SiderealTime(dt);
    const lst  = ((gst + lng / 15) % 24 + 24) % 24;
    const ramc = lst * 15;
    const T    = (dt.getTime() / 86400000 - 10957.5) / 36525; // Juliaanse eeuwen sinds J2000
    const eps  = 23.4392911 - 0.0130042 * T;
    const ramcR = ramc  * Math.PI / 180;
    const latR  = lat   * Math.PI / 180;
    const epsR  = eps   * Math.PI / 180;

    // MC = ecliptisch punt dat culmineert (RA = RAMC). eclFromRA is via atan2
    // kwadrant-correct: geen los "+180"-correctie nodig.
    const mcLon = eclFromRA(ramc, eps);
    planets.mc = { name:'MC (Midhemel)', ...lonToPos(mcLon) };

    // Ascendant: het opkomende ecliptisch punt. De ruwe formule geeft de juiste
    // graad; het juiste halfrond volgt uit de MC — de ASC ligt altijd 0..180°
    // vóór de MC in ecliptische lengte. Dit vangt elke 180°-flip zonder ad-hoc
    // ramc-drempels (voorheen fout op Rotterdam '63, Guyana '79, Hexham '73).
    let ascLon = Math.atan2(
      Math.cos(ramcR),
      -(Math.sin(ramcR) * Math.cos(epsR) + Math.tan(latR) * Math.sin(epsR))
    ) * 180 / Math.PI;
    ascLon = ((ascLon % 360) + 360) % 360;
    if (((ascLon - mcLon) % 360 + 360) % 360 > 180) ascLon = (ascLon + 180) % 360;
    planets.ascendant = { name:'Ascendant', ...lonToPos(ascLon) };

    houseCusps = calcHouses(ramc, ascLon, mcLon, lat, eps);
  } catch(e) {
    planets.ascendant = { name:'Ascendant', sign:'?', deg:0, min:0, lon:0, element:'?', modality:'?' };
    planets.mc = { name:'MC (Midhemel)', sign:'?', deg:0, min:0, lon:0, element:'?', modality:'?' };
  }

  // Noordknoop = True Node (osculerend), retrograde-status uit de dagbeweging.
  const nnLon = trueNodeLon(dt);
  const nnNext = trueNodeLon(dtNext);
  const nnRetro = ((nnNext - nnLon) % 360 + 540) % 360 - 180 < 0;
  const snLon = (nnLon + 180) % 360;
  planets.northNode = { name:'Noordknoop ☊', ...lonToPos(nnLon), retrograde: nnRetro };
  planets.southNode = { name:'Zuidknoop ☋',  ...lonToPos(snLon), retrograde: nnRetro };

  // Huistoewijzing voor alle punten
  if (houseCusps) {
    for (const p of Object.values(planets)) {
      if (p.lon !== undefined && p.sign !== '?') p.house = houseOf(p.lon, houseCusps);
    }
  }

  // Summary helpers
  const sun  = planets.sun;
  const moon = planets.moon;
  const asc  = planets.ascendant;

  return {
    planets,
    houseCusps,
    summary: {
      sun:  `${sun.sign} ${sun.deg}°${sun.min}'`,
      moon: `${moon.sign} ${moon.deg}°${moon.min}'`,
      asc:  `${asc.sign} ${asc.deg}°${asc.min}'`,
      northNode: `${planets.northNode.sign}`,
      southNode: `${planets.southNode.sign}`,
      dominantElement: getDominant(planets, 'element'),
      dominantModality: getDominant(planets, 'modality'),
    },
    birthUTC: dt.toISOString()
  };
}

function getDominant(planets, field) {
  const counts = {};
  for (const p of Object.values(planets)) {
    if (p[field] && p[field] !== '?') counts[p[field]] = (counts[p[field]] || 0) + 1;
  }
  return Object.entries(counts).sort((a,b) => b[1]-a[1])[0]?.[0] || '?';
}

// Actuele hemelstand voor het dashboard: transit-maan, maanfase en de
// eerstvolgende nieuwe/volle maan. Alles deterministisch berekend.
function currentSky(date = new Date()) {
  const moonLon = A.Ecliptic(A.GeoVector(A.Body.Moon, date, false)).elon;
  const sunLon = A.Ecliptic(A.GeoVector(A.Body.Sun, date, false)).elon;
  const phaseAngle = A.MoonPhase(date); // 0 = nieuw, 180 = vol
  const waxing = phaseAngle < 180;

  let nextNewMoon = null, nextFullMoon = null;
  try {
    const nn = A.SearchMoonPhase(0, date, 40);
    const fm = A.SearchMoonPhase(180, date, 40);
    if (nn) nextNewMoon = { date: nn.date, ...lonToPos(A.Ecliptic(A.GeoVector(A.Body.Moon, nn.date, false)).elon) };
    if (fm) nextFullMoon = { date: fm.date, ...lonToPos(A.Ecliptic(A.GeoVector(A.Body.Sun, fm.date, false)).elon + 180) };
  } catch (e) { /* niet-fataal */ }

  return {
    moon: lonToPos(moonLon),
    sun: lonToPos(sunLon),
    phaseAngle,
    waxing,
    nextNewMoon,
    nextFullMoon,
  };
}

module.exports = { calcBirthChart, currentSky };

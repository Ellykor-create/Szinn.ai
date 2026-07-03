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
  const idx = Math.floor(n / 30);
  const degInSign = n - idx * 30;
  const sign = SIGNS_NL[idx];
  return {
    sign, signEn: SIGN_EN[idx],
    deg: Math.floor(degInSign),
    min: Math.floor((degInSign % 1) * 60),
    lon: n,
    element: ELEMENTS[sign],
    modality: MODALITIES[sign]
  };
}

// ── Chiron (2060) via Kepler-baanelementen (JPL SBDB, epoch JD 2461200.5) ────
const CHIRON = {
  epochJD: 2461200.5,
  a: 13.68426760850124,      // au
  e: 0.3797656311453571,
  i: 6.930574468846328,      // graden
  om: 209.2961258613147,     // klimmende knoop
  w: 339.2878326589729,      // perihelium-argument
  ma: 216.7198966018106,     // middelbare anomalie op epoch
  n: 0.0194702593257484,     // graden/dag
};
const DEG = Math.PI / 180;

function chironEclipticLon(dt) {
  const jd = dt.getTime() / 86400000 + 2440587.5;
  // Kepler: middelbare → excentrische → ware anomalie
  const M = (((CHIRON.ma + CHIRON.n * (jd - CHIRON.epochJD)) % 360 + 360) % 360) * DEG;
  let E = M;
  for (let k = 0; k < 20; k++) E = E - (E - CHIRON.e * Math.sin(E) - M) / (1 - CHIRON.e * Math.cos(E));
  const nu = 2 * Math.atan2(Math.sqrt(1 + CHIRON.e) * Math.sin(E / 2), Math.sqrt(1 - CHIRON.e) * Math.cos(E / 2));
  const r = CHIRON.a * (1 - CHIRON.e * Math.cos(E));
  // positie in baanvlak → heliocentrisch ecliptisch J2000
  const cosO = Math.cos(CHIRON.om * DEG), sinO = Math.sin(CHIRON.om * DEG);
  const cosI = Math.cos(CHIRON.i * DEG), sinI = Math.sin(CHIRON.i * DEG);
  const u = nu + CHIRON.w * DEG;
  const cosU = Math.cos(u), sinU = Math.sin(u);
  const xh = r * (cosO * cosU - sinO * sinU * cosI);
  const yh = r * (sinO * cosU + cosO * sinU * cosI);
  const zh = r * (sinU * sinI);
  // ecliptisch J2000 → equatoriaal J2000 (astronomy-engine HelioVector is EQJ)
  const epsJ2000 = 23.4392911 * DEG;
  const xe = xh;
  const ye = yh * Math.cos(epsJ2000) - zh * Math.sin(epsJ2000);
  const ze = yh * Math.sin(epsJ2000) + zh * Math.cos(epsJ2000);
  const time = A.MakeTime(dt);
  const earth = A.HelioVector(A.Body.Earth, time);
  const geo = new A.Vector(xe - earth.x, ye - earth.y, ze - earth.z, time);
  return A.Ecliptic(geo).elon;
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

    let ascLon = Math.atan2(
      Math.cos(ramcR),
      -(Math.sin(ramcR) * Math.cos(epsR) + Math.tan(latR) * Math.sin(epsR))
    ) * 180 / Math.PI;
    ascLon = ((ascLon % 360) + 360) % 360;
    if (ramc > 180 && ascLon < 180) ascLon += 180;
    if (ramc <= 180 && ascLon >= 180) ascLon -= 180;
    planets.ascendant = { name:'Ascendant', ...lonToPos(ascLon) };

    // MC (Midheaven)
    let mcLon = Math.atan2(Math.tan(ramcR), Math.cos(epsR)) * 180 / Math.PI;
    mcLon = ((mcLon % 360) + 360) % 360;
    // MC ligt in het kwadrant vóór de ASC (boven de horizon, west van opkomst)
    if (((ascLon - mcLon) % 360 + 360) % 360 > 180) mcLon = (mcLon + 180) % 360;
    planets.mc = { name:'MC (Midhemel)', ...lonToPos(mcLon) };

    houseCusps = calcHouses(ramc, ascLon, mcLon, lat, eps);
  } catch(e) {
    planets.ascendant = { name:'Ascendant', sign:'?', deg:0, min:0, lon:0, element:'?', modality:'?' };
    planets.mc = { name:'MC (Midhemel)', sign:'?', deg:0, min:0, lon:0, element:'?', modality:'?' };
  }

  // North Node (J2000 approximate regression: -0.0529539°/day)
  const J2000ms = Date.UTC(2000, 0, 1, 12, 0);
  const daysSinceJ2000 = (dt.getTime() - J2000ms) / 86400000;
  const nnLon = ((125.0 - 0.0529539 * daysSinceJ2000) % 360 + 360) % 360;
  const snLon = (nnLon + 180) % 360;
  planets.northNode = { name:'Noordknoop ☊', ...lonToPos(nnLon) };
  planets.southNode = { name:'Zuidknoop ☋',  ...lonToPos(snLon) };

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

module.exports = { calcBirthChart };

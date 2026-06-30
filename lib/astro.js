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

  const planets = {};
  for (const { key, body } of bodyDefs) {
    try {
      const vec = A.GeoVector(body, dt, false);
      const ecl = A.Ecliptic(vec);
      planets[key] = { name: PLANET_NAMES[key], ...lonToPos(ecl.elon) };
    } catch (e) {
      planets[key] = { name: PLANET_NAMES[key], sign:'?', deg:0, min:0, lon:0, element:'?', modality:'?' };
    }
  }

  // Ascendant
  try {
    const gst  = A.SiderealTime(dt);
    const lst  = ((gst + lng / 15) % 24 + 24) % 24;
    const ramc = lst * 15;
    const eps  = 23.4393 - 3.563e-7 * (dt.getTime() / 86400000 / 36525);
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
    planets.mc = { name:'MC (Midhemel)', ...lonToPos(mcLon) };
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

  // Summary helpers
  const sun  = planets.sun;
  const moon = planets.moon;
  const asc  = planets.ascendant;

  return {
    planets,
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

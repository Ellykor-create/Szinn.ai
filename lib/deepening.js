'use strict';
// Verdieping van de geboortekaart: chartheerser, waardigheden, eindheerser, aspectpatronen, maanfase, halfronden,
// secundaire progressies en levenscycli. Node-tegenhanger van blueprint-worker/verdieping.py (NL kit-pipeline);
// houd de twee gelijk. Regels zijn feitentekst voor de AI; geen graden, bij progressies geen huisnummers.
const A = require('astronomy-engine');
const { chironEclipticLon } = require('./astro');
const CH = require('./chiron-data');

const TEKENS = ['Ram', 'Stier', 'Tweelingen', 'Kreeft', 'Leeuw', 'Maagd', 'Weegschaal', 'Schorpioen', 'Boogschutter', 'Steenbok', 'Waterman', 'Vissen'];
const TIEN = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
const NL = { sun: 'Zon', moon: 'Maan', mercury: 'Mercurius', venus: 'Venus', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturnus',
  uranus: 'Uranus', neptune: 'Neptunus', pluto: 'Pluto', chiron: 'Chiron' };
const HEERSER = { Ram: 'mars', Stier: 'venus', Tweelingen: 'mercury', Kreeft: 'moon', Leeuw: 'sun', Maagd: 'mercury', Weegschaal: 'venus',
  Schorpioen: 'pluto', Boogschutter: 'jupiter', Steenbok: 'saturn', Waterman: 'uranus', Vissen: 'neptune' };
const KLASSIEK = { Schorpioen: 'mars', Waterman: 'saturn', Vissen: 'jupiter' };
const VERHEVEN = { sun: 'Ram', moon: 'Stier', mercury: 'Maagd', venus: 'Vissen', mars: 'Steenbok', jupiter: 'Kreeft', saturn: 'Weegschaal' };
const GEBIED = { 1: 'jezelf en hoe je binnenkomt', 2: 'geld, bezit en eigenwaarde', 3: 'praten, leren en je directe omgeving',
  4: 'thuis, familie en je wortels', 5: 'plezier, creativiteit en kinderen', 6: 'je werkdag, gewoontes en gezondheid',
  7: 'relaties en samenwerking', 8: 'intimiteit, vertrouwen en gedeelde zaken', 9: 'reizen, studie en zingeving',
  10: 'roeping, werk en hoe de wereld je ziet', 11: 'vrienden, groepen en toekomstdromen', 12: 'rust, binnenwereld en afronding' };
const FASEN = ['nieuwe maan (begin, instinct)', 'wassende sikkel (doorzetten)', 'eerste kwartier (actie, knopen doorhakken)',
  'wassende maan (verfijnen, verbeteren)', 'volle maan (bewustzijn, relaties)', 'afnemende maan (delen, doorgeven)',
  'laatste kwartier (heroverwegen, oude vormen loslaten)', 'balsamische maan (afronden, voorbereiden op iets nieuws)'];
const CYCLI = [['Saturnus-return', 'saturn', 0, 26, 31], ['Uranus-oppositie', 'uranus', 180, 37, 45],
  ['Chiron-return', 'chiron', 0, 46, 53], ['tweede Saturnus-return', 'saturn', 0, 56, 61]];
const JAAR = 365.2422, DAG = 86400000;
const BODY = { sun: 'Sun', moon: 'Moon', saturn: 'Saturn', uranus: 'Uranus' };
const CH_EIND = CH.jd0 + CH.step * (Buffer.from(CH.arcsecB64, 'base64').length / 4 - 3);   // tabel loopt tot ~2035

const mod = (x) => ((x % 360) + 360) % 360;
const teken = (l) => TEKENS[Math.floor(mod(l) / 30)];
const volgend = (t) => TEKENS[(TEKENS.indexOf(t) + 1) % 12];
const tegen = (t) => TEKENS[(TEKENS.indexOf(t) + 6) % 12];
const lijst = (xs) => (xs.length > 1 ? xs.slice(0, -1).join(', ') + ' en ' + xs[xs.length - 1] : xs[0]);
const jdVan = (d) => d.getTime() / DAG + 2440587.5;
const lon = (key, d) => (key === 'chiron' ? chironEclipticLon(d) : mod(A.Ecliptic(A.GeoVector(A.Body[BODY[key]], d, false)).elon));
const sep = (a, b) => Math.abs(mod(a - b + 180) - 180);

function huis(l, cusps) {
  for (let i = 0; i < 12; i++) if (mod(l - cusps[i]) < mod(cusps[(i + 1) % 12] - cusps[i])) return i + 1;
}

function waardigheden(P) {
  const out = [];
  for (const k of TIEN.slice(0, 7)) {
    const t = P[k].sign, n = NL[k];
    const thuis = [...Object.entries(HEERSER), ...Object.entries(KLASSIEK)].filter(([, h]) => h === k).map(([s]) => s);
    if (thuis.includes(t)) out.push(`${n} in ${t}: in eigen teken (werkt makkelijk en vanzelf)`);
    else if (thuis.map(tegen).includes(t)) out.push(`${n} in ${t}: tegenover eigen teken (moet het op een eigen manier leren)`);
    if (VERHEVEN[k] === t) out.push(`${n} in ${t}: verheven (komt op zijn best tot uiting)`);
    else if (tegen(VERHEVEN[k]) === t) out.push(`${n} in ${t}: in val (vraagt meer bewuste aandacht)`);
  }
  return out;
}

function heerschap(P) {
  const eind = (k, gezien = []) => {
    const h = HEERSER[P[k].sign];
    return h === k ? k : gezien.includes(h) ? null : eind(h, [...gezien, k]);
  };
  const eindes = new Set(TIEN.map((k) => eind(k)));
  const out = eindes.size === 1 && !eindes.has(null)
    ? [`eindheerser ${NL[[...eindes][0]]} (alle planeten leiden via hun tekenheerser naar deze planeet: de baas van de kaart)`] : [];
  TIEN.forEach((a, i) => TIEN.slice(i + 1).forEach((b) => {
    if (HEERSER[P[a].sign] === b && HEERSER[P[b].sign] === a) {
      out.push(`wederzijdse receptie ${NL[a]} in ${P[a].sign} en ${NL[b]} in ${P[b].sign} (elk in het teken van de ander: ze werken als team)`);
    }
  }));
  return out;
}

function patronen(P) {
  // zelfde orbs als chart.py (6°) en de yod-quincunx (2,5°); de aspecttabel van astro.js is te krap voor patronen
  const heeft = (x, y, hoek) => Math.abs(sep(P[x].lon, P[y].lon) - hoek) <= 6;
  const out = [];
  for (let i = 0; i < 10; i++) for (let j = i + 1; j < 10; j++) {
    const [a, b] = [TIEN[i], TIEN[j]];
    for (let k = j + 1; k < 10; k++) {
      const c = TIEN[k];
      if (heeft(a, b, 120) && heeft(b, c, 120) && heeft(a, c, 120)) out.push(`grote driehoek ${NL[a]}, ${NL[b]} en ${NL[c]} (een gesloten kring van gemak en talent)`);
    }
    if (heeft(a, b, 180)) {
      for (const c of TIEN) if (heeft(a, c, 90) && heeft(b, c, 90)) out.push(`T-kruis ${NL[a]} oppositie ${NL[b]}, met ${NL[c]} in het midden (spanning die tot actie dwingt; ${NL[c]} is het drukpunt)`);
    }
    if (heeft(a, b, 60)) {
      for (const c of TIEN) {
        if (c !== a && c !== b && Math.abs(sep(P[a].lon, P[c].lon) - 150) <= 2.5 && Math.abs(sep(P[b].lon, P[c].lon) - 150) <= 2.5) {
          out.push(`yod: ${NL[a]} en ${NL[b]} wijzen samen naar ${NL[c]} (het gevoel van een eigen opdracht, via ${NL[c]})`);
        }
      }
    }
  }
  for (const [sleutel, voor] of [['sign', ''], ['house', 'huis ']]) {
    const groep = new Map();
    for (const k of TIEN) if (P[k][sleutel]) groep.set(P[k][sleutel], [...(groep.get(P[k][sleutel]) || []), NL[k]]);
    for (const [g, ns] of groep) if (ns.length >= 3) out.push(`stellium in ${voor}${g}: ${lijst(ns)} (veel energie op één plek)`);
  }
  return out;
}

// Secundaire progressie: de stand op dag N na de geboorte staat voor levensjaar N.
function progressies(geboorte, leeftijd, cusps) {
  const dp = new Date(geboorte.getTime() + leeftijd * DAG);
  const volgende = new Date(dp.getTime() + DAG);
  const out = [];
  for (const [k, uitleg] of [['sun', 'hoe je identiteit zich door de jaren ontwikkelt'], ['moon', 'je emotionele seizoen van nu']]) {
    const l = lon(k, dp), snel = mod(lon(k, volgende) - l);
    const sinds = leeftijd - (l % 30) / snel, tot = leeftijd + (30 - (l % 30)) / snel;
    const wanneer = k === 'sun'
      ? `${sinds > 0 ? `sinds je ${Math.floor(sinds)}e` : 'al sinds je geboorte'}, wisselt rond je ${Math.floor(tot)}e naar ${volgend(teken(l))}`
      : `nog ongeveer ${Math.max(1, Math.round((tot - leeftijd) * 12))} maanden, daarna ${volgend(teken(l))}`;
    out.push(`Geprogresseerde ${NL[k]} (${uitleg}): in ${teken(l)}, ${wanneer}${cusps ? `; levensgebied: ${GEBIED[huis(l, cusps)]}` : ''}`);
  }
  out.push(`Geprogresseerde maanfase (levensfase van ongeveer 30 jaar): ${FASEN[Math.floor(mod(lon('moon', dp) - lon('sun', dp)) / 45)]}`);
  return out;
}

// Exacte momenten waarop een planeet een lengte raakt (ook de retrograde passages), als Date.
function zoek(key, doel, van, tot) {
  const f = (t) => mod(lon(key, new Date(t)) - doel + 180) - 180;
  const uit = [];
  let t = van.getTime(), v = f(t);
  while (t < tot.getTime()) {
    const w = f(t + 4 * DAG);
    if ((v < 0) !== (w < 0) && Math.abs(v - w) < 20) {
      let a = t, b = t + 4 * DAG;
      for (let i = 0; i < 30; i++) { const m = (a + b) / 2; if ((f(m) < 0) === (v < 0)) a = m; else b = m; }
      uit.push(new Date(a));
    }
    t += 4 * DAG; v = w;
  }
  return uit;
}

function deepening(chart, vandaag = new Date()) {
  const P = chart.planets, cusps = chart.houseCusps;
  const geboorte = new Date(chart.birthUTC);
  const leeftijd = (vandaag - geboorte) / DAG / JAAR;
  const regels = [];
  if (P.ascendant && P.ascendant.sign !== '?') {
    const at = P.ascendant.sign, ch = HEERSER[at], kl = KLASSIEK[at];
    regels.push(`Chartheerser (heerser van de Ascendant in ${at}): ${NL[ch]} in ${P[ch].sign}, huis ${P[ch].house}`
      + (kl ? `; klassieke heerser ${NL[kl]} in ${P[kl].sign}, huis ${P[kl].house}` : ''));
  }
  regels.push(...waardigheden(P).map((x) => 'Waardigheid: ' + x));
  regels.push(...heerschap(P).map((x) => 'Heerschap: ' + x));
  regels.push(...patronen(P).map((x) => 'Aspectpatroon: ' + x));
  regels.push(`Maanfase bij geboorte: ${FASEN[Math.floor(mod(P.moon.lon - P.sun.lon) / 45)]}`);
  if (cusps) {
    const boven = TIEN.filter((k) => P[k].house >= 7).length;
    const oost = TIEN.filter((k) => [10, 11, 12, 1, 2, 3].includes(P[k].house)).length;
    regels.push(`Halfronden (tien planeten): ${boven} boven de horizon (naar buiten, zichtbaar) en ${10 - boven} eronder (naar binnen, persoonlijk); `
      + `${oost} aan de oostkant (eigen initiatief) en ${10 - oost} aan de westkant (via anderen)`);
  }
  regels.push(...progressies(geboorte, leeftijd, cusps).map((x) => 'Progressie: ' + x));
  for (const [naam, key, hoek, van, tot] of CYCLI) {
    const eind = new Date(geboorte.getTime() + tot * JAAR * DAG);
    if (key === 'chiron' && jdVan(eind) > CH_EIND) {
      // ponytail: voorbij de Chiron-tabel (~2035) alleen de omlooptijd (±50,7 jaar); herbak chiron-data.js voor exact
      if (leeftijd < 46) regels.push(`Levenscyclus ${naam}: rond je 50e (komt nog)`);
      continue;
    }
    const hits = zoek(key, mod(lon(key, geboorte) + hoek), new Date(geboorte.getTime() + van * JAAR * DAG), eind);
    if (!hits.length) continue;
    const a = (hits[0] - geboorte) / DAG / JAAR, b = (hits[hits.length - 1] - geboorte) / DAG / JAAR;
    const status = a - 1 <= leeftijd && leeftijd <= b + 1 ? 'nu bezig' : leeftijd > b ? 'achter je' : 'komt nog';
    regels.push(`Levenscyclus ${naam}: rond je ${Math.floor(a)}e (${status})`);
  }
  return regels;
}

module.exports = { deepening };

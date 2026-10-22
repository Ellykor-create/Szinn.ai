'use strict';
// Het overzichtsblad ("Eén blad. Jouw hele beeld.") per klant, in A4, A3 en A2.
// Naar het voorbeeld van Elly's blad (SZINN-overzicht-A3-nl.pdf): op blad 1
// planeten, elementen, kwaliteiten, getallen en de eigen teksten, op blad 2 de
// geboortekaart met standen, hoeken en huizen. Alle getallen en standen komen
// uit de rekenlaag (astro.js/numerology.js); zinnen alleen uit de AI-teksten
// van de blueprint (<orderId>.texts.json). Ontbreekt een tekst, dan valt dat
// blok weg; liever minder tekst dan andermans verhaal.
//
// A3 en A2 zijn dezelfde tekening, alleen groter; A4 is dezelfde inhoud over
// vier vellen. Past de tekst niet, dan krimpt de basisgrootte in de browser tot
// hij past (FIT_SCRIPT).

const { SIGNS_NL, SIGN_EN } = require('./astro');

// basis: lettergrootte waarop alles in rem schaalt.
const SIZES = {
  A4: { w: 210, h: 297, basis: 10.4, breed: false },
  A3: { w: 297, h: 420, basis: 10.6, breed: true },
  A2: { w: 420, h: 594, basis: 15, breed: true },
};

const PLANETS = [
  ['sun',       '☉', 'Zon',        'Sun',        'wat je drijft',        'what drives you'],
  ['moon',      '☽', 'Maan',       'Moon',       'wat je voedt',         'what nourishes you'],
  ['mercury',   '☿', 'Mercurius',  'Mercury',    'hoe je denkt',         'how you think'],
  ['venus',     '♀', 'Venus',      'Venus',      'hoe je liefhebt',      'how you love'],
  ['mars',      '♂', 'Mars',       'Mars',       'hoe je handelt',       'how you act'],
  ['jupiter',   '♃', 'Jupiter',    'Jupiter',    'waar je groeit',       'where you grow'],
  ['saturn',    '♄', 'Saturnus',   'Saturn',     'je leraar',            'your teacher'],
  ['uranus',    '♅', 'Uranus',     'Uranus',     'waar je breekt',       'where you break open'],
  ['neptune',   '♆', 'Neptunus',   'Neptune',    'waar je droomt',       'where you dream'],
  ['pluto',     '♇', 'Pluto',      'Pluto',      'waar je transformeert', 'where you transform'],
  ['chiron',    '⚷', 'Chiron',     'Chiron',     'waar je wond zit',     'where your wound is'],
  ['southNode', '☋', 'Zuidknoop',  'South Node', 'je herkomst',          'where you come from'],
  ['northNode', '☊', 'Noordknoop', 'North Node', 'je richting',          'your direction'],
  ['ascendant', 'AC', 'Ascendant', 'Ascendant',  'hoe je binnenkomt',    'how you enter'],
  ['mc',        'MC', 'Midhemel',  'Midheaven',  'je zichtbare rol',     'your visible role'],
];
// Elementen/kwaliteiten tellen over de tien planeten + ASC + MC, zoals astro.js.
const COUNTED = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'ascendant', 'mc'];
const ELEMENTS = [
  ['vuur', 'Vuur', 'Fire', 'doen, aanzetten, vooropgaan', 'doing, initiating, leading'],
  ['water', 'Water', 'Water', 'voelen, aanvoelen, verbinden', 'feeling, sensing, connecting'],
  ['lucht', 'Lucht', 'Air', 'denken, praten, verbanden zien', 'thinking, talking, seeing connections'],
  ['aarde', 'Aarde', 'Earth', 'bouwen, volhouden, vormgeven', 'building, persisting, giving form'],
];
const MODALITIES = [
  ['vast', 'Vast', 'Fixed', 'vasthouden en doorzetten', 'holding on and persevering'],
  ['cardinaal', 'Cardinaal', 'Cardinal', 'beginnen en in gang zetten', 'starting and setting in motion'],
  ['veranderlijk', 'Beweeglijk', 'Mutable', 'meebewegen en aanpassen', 'moving along and adapting'],
];
const MONTHS = {
  nl: ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

const L = {
  nl: {
    eyebrow1: 'Herkenning · planeten, elementen, getallen', eyebrow2: 'Herkenning · jouw geboortekaart',
    lagen: 'De drie lagen', herkennen: 'Wat je mag herkennen', planeten: 'Jouw planeten en wat ze bij jou doen',
    planetenSub: 'Dit mag je herkennen en onderzoeken.', elementen: 'Jouw elementen', kwaliteiten: 'Jouw kwaliteiten',
    getallen: 'Jouw getallen, jouw trilling', groei: 'Jouw groei', gaven: 'Jouw gaven', permissions: 'Jouw Inner Permissions', gedachten: 'Jouw onbewuste gedachten',
    gedachtenNoot: 'Geen van deze zinnen is waar. Ze waren ooit alleen nuttig.',
    patroon: 'Patroon', patroonRol: 'wat eruit springt', oefenen: 'Wat je kunt oefenen',
    huis: 'huis', retro: 'retrograde', kaartTitel: 'Jouw geboortekaart',
    kaartKop: 'Dit is de hemel op het moment dat jij je eerste adem nam.',
    kaartTekst: 'De buitenste ring zijn de twaalf tekens. De spaken daarbinnen zijn je twaalf huizen, ongelijk verdeeld, want die komen uit je geboortetijd en je geboorteplaats. Daarom is deze kaart van niemand anders. De lijnen in het hart zijn de aspecten, de gesprekken die je planeten met elkaar voeren.',
    standen: 'De standen', hoeken: 'De vier hoeken', huizen: 'De huizen',
    hoekNamen: ['Ascendant', 'Midhemel', 'Descendant', 'Imum Coeli'],
    kaartNoot: 'Berekend met Placidus. Retrograde staat als ℞.',
    getal: { lifePath: 'Levenspad', expression: 'Expressie', soulUrge: 'Zielsverlangen', personality: 'Persoonlijkheid', birthday: 'Geboortedag', year: 'Persoonlijk jaar' },
    voetL: 'SZINN · szinn.ai', voetM: 'Een spiegel, geen oordeel. Jouw start is een blauwdruk.',
    disclaimer: 'Dit blad is samengesteld met behulp van AI. AI kan fouten maken: controleer wat belangrijk voor je is en houd je eigen waarneming aan als iets niet klopt. Het blad is bedoeld voor zelfinzicht en reflectie en is geen medisch, psychologisch, juridisch of financieel advies en geen voorspelling. Jij blijft degene die over jezelf gaat. Alles wat hier staat is een uitnodiging om te onderzoeken, niet een oordeel om te geloven. Vragen of iets dat niet klopt? Laat het weten via szinn.ai.',
  },
  en: {
    eyebrow1: 'Recognition · planets, elements, numbers', eyebrow2: 'Recognition · your birth chart',
    lagen: 'The three layers', herkennen: 'What you may recognise', planeten: 'Your planets and what they do in you',
    planetenSub: 'Recognise and explore.', elementen: 'Your elements', kwaliteiten: 'Your qualities',
    getallen: 'Your numbers, your vibration', groei: 'Your growth', gaven: 'Your gifts', permissions: 'Your Inner Permissions', gedachten: 'Your unconscious thoughts',
    gedachtenNoot: 'None of these sentences is true. They were only ever useful.',
    patroon: 'Pattern', patroonRol: 'what stands out', oefenen: 'What you can practise',
    huis: 'house', retro: 'retrograde', kaartTitel: 'Your birth chart',
    kaartKop: 'This is the sky at the moment you took your first breath.',
    kaartTekst: 'The outer ring holds the twelve signs. The spokes inside are your twelve houses, unevenly divided, because they come from your birth time and birthplace. That is why this chart belongs to no one else. The lines in the centre are the aspects, the conversations your planets have with each other.',
    standen: 'The positions', hoeken: 'The four angles', huizen: 'The houses',
    hoekNamen: ['Ascendant', 'Midheaven', 'Descendant', 'Imum Coeli'],
    kaartNoot: 'Calculated with Placidus. Retrograde is shown as ℞.',
    getal: { lifePath: 'Life path', expression: 'Expression', soulUrge: 'Soul urge', personality: 'Personality', birthday: 'Birthday', year: 'Personal year' },
    voetL: 'SZINN · szinn.ai', voetM: 'A mirror, not a judgement. Your start is a blueprint.',
    disclaimer: 'This sheet was compiled with the help of AI. AI can make mistakes: check what matters to you and trust your own perception if something does not fit. The sheet is meant for self-insight and reflection and is not medical, psychological, legal or financial advice, nor a prediction. You remain the one who decides about yourself. Everything here is an invitation to explore, not a verdict to believe. Questions, or something that does not fit? Let us know via szinn.ai.',
  },
};

// ── helpers ──────────────────────────────────────────────────────────────────
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const decode = s => s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const plain = s => decode(String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
const t = s => esc(plain(s));
const paras = html => String(html || '').split(/<\/p>/i).map(plain).filter(Boolean);
const dm = (deg, min) => `${deg}°${String(min).padStart(2, '0')}′`;
const lonPos = (lon, en) => {
  const x = ((lon % 360) + 360) % 360;
  const inSign = x % 30;
  let deg = Math.floor(inSign), min = Math.round((inSign - deg) * 60);
  if (min === 60) { deg += 1; min = 0; }
  return { pos: dm(deg, min), sign: (en ? SIGN_EN : SIGNS_NL)[Math.floor(x / 30)] };
};
// de knopen staan in astro.js altijd "retrograde" (true node); dat is geen eigenschap om te tonen
const isRetro = (key, p) => p.retrograde && !/Node$/.test(key);

function planetRows(chart, lang) {
  const en = lang === 'en', T = L[lang];
  return PLANETS.map(([key, glyph, nl, enName, rolNl, rolEn]) => {
    const p = chart.planets[key];
    if (!p || p.sign === '?') return null;
    const where = [en ? p.signEn : p.sign];
    if (p.house && key !== 'ascendant' && key !== 'mc') where.push(`${T.huis} ${p.house}`);
    if (isRetro(key, p)) where.push(T.retro);
    return { key, glyph, naam: en ? enName : nl, rol: en ? rolEn : rolNl, waar: where.join(' · '), p };
  }).filter(Boolean);
}

function tally(chart, lang, field, table) {
  const en = lang === 'en';
  const naam = Object.fromEntries(PLANETS.map(r => [r[0], en ? r[3] : r[2]]));
  return table.map(([k, nl, enName, betNl, betEn]) => {
    const wie = COUNTED.filter(key => chart.planets[key] && chart.planets[key][field] === k)
      .map(key => naam[key] + (isRetro(key, chart.planets[key]) ? ' retrograde' : ''));
    return { naam: en ? enName : nl, bet: en ? betEn : betNl, aantal: wie.length, wie };
  }).sort((a, b) => b.aantal - a.aantal);
}

function numberRows(num, texts, lang) {
  const T = L[lang], tn = (texts && texts.numerology) || {}, nl = lang === 'nl';
  // de *Info-namen uit numerology.js zijn alleen Nederlands
  const rows = [
    [num.lifePath, T.getal.lifePath, tn.lifePathTitle || (nl ? (num.lifePathInfo || {}).name : '')],
    [num.expression, T.getal.expression, tn.expressionBody || (nl ? (num.expressionInfo || {}).name : '')],
    [num.soulUrge, T.getal.soulUrge, tn.soulUrgeBody || ''],
    [num.personality, T.getal.personality, tn.personalityBody || ''],
    [num.birthday, T.getal.birthday, ''],
    [num.personalYear, `${T.getal.year} ${num.currentYear}`, nl ? (num.personalYearInfo || {}).theme : ''],
  ];
  const m = (num.personalMonths || [])[0];
  if (m) rows.push([m.number, MONTHS[lang][m.month - 1], '']);
  return rows.filter(r => r[0] != null);
}

// ── de geboortekaart ─────────────────────────────────────────────────────────
// ASC links, lengte loopt tegen de klok in. Tekens buiten, huizen binnen,
// aspecten in het hart: spanning (vierkant, oppositie) goud, stroming grijs.
const SIGN_GLYPHS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'].map(g => g + '\uFE0E');
const SIGN_TINT = ['#F6E9D8', '#EFE9DC', '#F1EEE6', '#E8EEEF']; // vuur, aarde, lucht, water
function chartSVG(chart) {
  const C = 300, R1 = 290, R2 = 250, R3 = 150, R4 = 118;
  const asc = chart.planets.ascendant.lon, mc = chart.planets.mc.lon;
  const ang = lon => (180 + lon - asc) * Math.PI / 180;
  const pt = (lon, r) => [C + r * Math.cos(ang(lon)), C - r * Math.sin(ang(lon))].map(v => v.toFixed(1));
  const seg = (l1, r1, l2, r2, attrs) => { const [a, b] = pt(l1, r1), [c, d] = pt(l2, r2); return `<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" ${attrs}/>`; };
  const line = (l, r1, r2, attrs) => seg(l, r1, l, r2, attrs);
  const text = (l, r, s, attrs) => { const [x, y] = pt(l, r); return `<text x="${x}" y="${y}" ${attrs}>${s}</text>`; };
  const out = [`<svg class="kaart" viewBox="-40 -40 680 680" xmlns="http://www.w3.org/2000/svg" font-family="'DejaVu Sans','Segoe UI Symbol','Noto Sans Symbols',sans-serif" text-anchor="middle" dominant-baseline="central">`];

  // tekenring
  for (let i = 0; i < 12; i++) {
    const [a, b] = pt(i * 30, R1), [c, d] = pt(i * 30 + 30, R1), [e, f] = pt(i * 30 + 30, R2), [g, h] = pt(i * 30, R2);
    out.push(`<path d="M${a} ${b} A${R1} ${R1} 0 0 0 ${c} ${d} L${e} ${f} A${R2} ${R2} 0 0 1 ${g} ${h}Z" fill="${SIGN_TINT[i % 4]}" stroke="#C9B48A" stroke-width=".6"/>`);
    out.push(text(i * 30 + 15, (R1 + R2) / 2, SIGN_GLYPHS[i], 'font-size="22" fill="#9A7B3C"'));
  }
  out.push(`<circle cx="${C}" cy="${C}" r="${R3}" fill="none" stroke="#C9B48A" stroke-width=".6"/>`);
  out.push(`<circle cx="${C}" cy="${C}" r="${R4}" fill="none" stroke="#C9B48A" stroke-width=".6"/>`);

  // huizen: spaken + nummers halverwege; de vier hoeken dik en tot buiten de ring
  const cusps = chart.houseCusps || [];
  cusps.forEach((lon, i) => {
    const hoek = i % 3 === 0;
    out.push(line(lon, R4, hoek ? R1 + 12 : R2, hoek ? 'stroke="#9A7B3C" stroke-width="2"' : 'stroke="#C9B48A" stroke-width=".7" stroke-dasharray="3 3"'));
    const next = cusps[(i + 1) % 12];
    const mid = lon + (((next - lon) % 360 + 360) % 360) / 2;
    out.push(text(mid, (R3 + R4) / 2, i + 1, 'font-size="13" fill="#9A7B3C"'));
  });
  [['AC', asc], ['MC', mc], ['DC', asc + 180], ['IC', mc + 180]].forEach(([l, lon]) =>
    out.push(text(lon, R1 + 26, l, 'font-size="15" fill="#9A7B3C" letter-spacing="1"')));

  // planeten: dicht bij elkaar staande glyphs iets uit elkaar duwen (min 9°)
  const keys = PLANETS.map(r => r[0]).filter(k => k !== 'ascendant' && k !== 'mc' && chart.planets[k] && chart.planets[k].sign !== '?');
  const glyph = Object.fromEntries(PLANETS.map(r => [r[0], r[1]]));
  const items = keys.map(k => ({ k, lon: chart.planets[k].lon, at: chart.planets[k].lon })).sort((a, b) => a.lon - b.lon);
  for (let pass = 0; pass < 10; pass++) {
    for (let i = 0; i < items.length; i++) {
      const a = items[i], b = items[(i + 1) % items.length];
      const gap = ((b.at - a.at) % 360 + 360) % 360;
      if (items.length > 1 && gap < 9) { const push = (9 - gap) / 2; a.at -= push; b.at += push; }
    }
  }
  items.forEach(({ k, lon, at }) => {
    const p = chart.planets[k];
    out.push(line(lon, R2, R2 - 8, 'stroke="#1E1A16" stroke-width="1"'));
    out.push(seg(lon, R2 - 8, at, R2 - 22, 'stroke="#C9B48A" stroke-width=".5"'));
    out.push(text(at, R2 - 36, glyph[k] + '\uFE0E', 'font-size="22" fill="#1E1A16"'));
    out.push(text(at, R2 - 62, `${p.deg}°${isRetro(k, p) ? ' ℞' : ''}`, 'font-size="11" fill="#9A7B3C"'));
  });

  // aspecten
  const kleur = { vierkant: '#B08A4A', oppositie: '#B08A4A', driehoek: '#9AA3A6', sextiel: '#9AA3A6' };
  (chart.aspects || []).forEach(a => {
    const pa = chart.planets[a.a], pb = chart.planets[a.b];
    if (!kleur[a.type] || !pa || !pb) return;
    const [x1, y1] = pt(pa.lon, R4), [x2, y2] = pt(pb.lon, R4);
    out.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${kleur[a.type]}" stroke-width=".9"/>`);
  });
  out.push('</svg>');
  return out.join('');
}

function bars(items, max) {
  return items.map(e => `
    <div class="bar">
      <div class="barkop"><span class="lbl">${esc(e.naam)}</span><span class="lijn"><i style="width:${Math.round(100 * e.aantal / max)}%"></i></span><span class="tal">${e.aantal}</span></div>
      <div class="bet">${esc(e.bet)}</div>
      <div class="wie">${esc(e.wie.join(', '))}</div>
    </div>`).join('');
}

// ── het blad ─────────────────────────────────────────────────────────────────
// ctx: { intake, chart, numerology } uit pipeline.buildContext; texts: taal-laag of null
function overviewHTML(ctx, texts, { lang = 'nl', size = 'A4' } = {}) {
  lang = lang === 'en' ? 'en' : 'nl';
  const S = SIZES[size] || SIZES.A4, T = L[lang], en = lang === 'en';
  const { intake, chart, numerology: num } = ctx;
  const tx = texts || {};
  const now = new Date();
  const [y, mo, d] = String(intake.birthDate || '').split('-').map(Number);
  const geboren = y ? `${d} ${MONTHS[lang][mo - 1]} ${y}` : '';
  const meta = [geboren, intake.birthTime, intake.birthCity, 'Placidus', 'Pythagoras', `${MONTHS[lang][now.getMonth()]} ${now.getFullYear()}`]
    .filter(Boolean).map(esc).join(' · ');
  const naam = esc(intake.birthName || intake.clientName || '');

  const pl = planetRows(chart, lang);
  const q = (tx.astrology && tx.astrology.qualities) || {};
  const planetLi = r => `
    <div class="pl">
      <div class="pnaam">${esc(r.naam)}</div>
      <div class="prol">${esc(r.rol)}<small>${esc(r.waar)}</small></div>
      <div class="pzin">${r.key === 'patroon' ? t(pat.body) : t(q[r.key])}</div>
    </div>`;
  // het opvallendste patroon als laatste rij, zoals op Elly's blad
  const pat = Array.isArray(tx.patterns) && tx.patterns[0];
  if (pat) pl.push({ naam: T.patroon, rol: T.patroonRol, waar: plain(pat.label), key: 'patroon' });
  const half = Math.ceil(pl.length / 2);

  const el = tally(chart, lang, 'element', ELEMENTS);
  const mod = tally(chart, lang, 'modality', MODALITIES);
  const maxCount = Math.max(...el.map(e => e.aantal), ...mod.map(e => e.aantal), 1);

  const intro = paras(tx.introduction);
  const herkennen = (tx.summary && Array.isArray(tx.summary.rows) ? tx.summary.rows : []).slice(0, 3).map(plain);
  const groei = tx.tikkun && Array.isArray(tx.tikkun.cards) ? tx.tikkun.cards : [];
  const gaven = (tx.integration && Array.isArray(tx.integration.gifts) ? tx.integration.gifts : []).map(plain);
  const oefenen = tx.integration && Array.isArray(tx.integration.practices) ? tx.integration.practices : [];
  const slot = plain((tx.summary && tx.summary.oneLiner) || '');
  const perms = Array.isArray(tx.permissions) ? tx.permissions : [];
  const gedachten = Array.isArray(tx.thoughts) ? tx.thoughts : [];
  const elTekst = tx.elements && Array.isArray(tx.elements.distribution) ? tx.elements.distribution.map(plain) : [];

  const blok = (kop, inner) => inner ? `<div class="blok"><h3>${esc(kop)}</h3>${inner}</div>` : '';
  const voet = `
    <footer>
      <div class="voetrij"><span>${T.voetL}</span><span class="goud">${T.voetM}</span><span>© ${now.getFullYear()} ${naam}</span></div>
      <p class="disc">${T.disclaimer}</p>
    </footer>`;
  const kop = (eyebrow, titel) => `<header><div class="eyebrow">${eyebrow}</div><h1>${titel}</h1><div class="meta">${meta}</div></header>`;

  // ── blad 1 ──
  const lagenHTML = (tx.hero && tx.hero.core) || intro.length
    ? `<p class="lead">${t(tx.hero && tx.hero.core)}</p>${intro.slice(0, 2).map(p => `<p>${esc(p)}</p>`).join('')}` : '';
  const getallenHTML = numberRows(num, tx, lang).map(([g, label, zin]) =>
    `<p class="getal"><b>${esc(g)}</b> <span class="lbl">${esc(label)}</span> ${t(zin)}</p>`).join('');
  const groeiHTML = groei.map(c => `<p><b>${t(c.title)}.</b> ${t(c.body)}</p>`).join('');
  const gavenHTML = gaven.length ? `<ul>${gaven.map(g => `<li>${esc(g)}</li>`).join('')}</ul>` : '';
  const permHTML = perms.length ? `<ul>${perms.map(x => `<li><b>${t(x.text)}</b> ${t(x.note)}</li>`).join('')}</ul>` : '';
  const gedachtenHTML = gedachten.length
    ? gedachten.map(x => `<p class="gedachte">“${t(x.text)}”<small>${t(x.source)}</small></p>`).join('') + `<p class="noot">${T.gedachtenNoot}</p>` : '';
  const oefenHTML = oefenen.length ? `<ul>${oefenen.map(o => `<li><b>${t(o.title)}.</b> ${t(o.body)}</li>`).join('')}</ul>` : '';

  // Elke pagina is precies één vel hoog, met kop en voet.
  const pagina = (eyebrow, titel, inner) => `
  <section class="pagina"><div class="binnen">${kop(eyebrow, titel)}${inner}${voet}</div></section>`;
  const lagen = `<div class="rij r-lagen">${blok(T.lagen, lagenHTML)}${blok(T.herkennen, herkennen.map(h => `<p>${esc(h)}</p>`).join(''))}</div>`;
  const planeten = `
      <div class="blok">
        <h3>${T.planeten}</h3><p class="sub">${T.planetenSub}</p>
        <div class="kol2 pl2"><div>${pl.slice(0, half).map(planetLi).join('')}</div><div>${pl.slice(half).map(planetLi).join('')}</div></div>
      </div>`;
  const elementen = `<div class="rij r-elem">${blok(T.elementen, bars(el, maxCount) + elTekst.map(p => `<p class="klein">${esc(p)}</p>`).join(''))}${blok(T.kwaliteiten, bars(mod, maxCount))}</div>`;
  // Inner Permissions gaan voor de gaven: zo staat het op Elly's blad
  // met gedachten: Elly's vier kolommen (getallen, groei, gedachten, permissions); anders gaven/oefenen als aanvulling
  const vier = gedachtenHTML
    ? [blok(T.getallen, getallenHTML), blok(T.groei, groeiHTML), blok(T.gedachten, gedachtenHTML), blok(T.permissions, permHTML) || blok(T.gaven, gavenHTML)]
    : [blok(T.getallen, getallenHTML), blok(T.groei, groeiHTML), blok(T.permissions, permHTML) || blok(T.gaven, gavenHTML), blok(T.oefenen, oefenHTML)];
  const rij = blokken => blokken.join('') ? `<div class="rij r-vier">${blokken.join('')}</div>` : '';
  const slotHTML = slot ? `<p class="slot">${esc(slot)}</p>` : '';

  // ── blad 2: de geboortekaart ──
  const svg = chartSVG(chart);
  const standen = pl.filter(r => r.p && r.key !== 'ascendant' && r.key !== 'mc').map(r => `
    <div class="st"><span class="gl">${r.glyph}</span><span class="nm">${esc(r.naam)}</span>
      <span class="ps">${dm(r.p.deg, r.p.min)} ${esc(en ? r.p.signEn : r.p.sign)}${isRetro(r.key, r.p) ? ' ℞' : ''}<small>${T.huis} ${r.p.house || ''}</small></span></div>`).join('');
  const asc = chart.planets.ascendant, mc = chart.planets.mc;
  const hoeken = [['AC', asc.lon], ['MC', mc.lon], ['DC', asc.lon + 180], ['IC', mc.lon + 180]].map(([ab, lon], i) => {
    const p = lonPos(lon, en);
    return `<div class="st"><span class="gl">${ab}</span><span class="nm">${T.hoekNamen[i]}</span><span class="ps">${p.pos} ${esc(p.sign)}</span></div>`;
  }).join('');
  const huizen = (chart.houseCusps || []).map((lon, i) => {
    const p = lonPos(lon, en);
    return `<div class="hz"><span class="gl">${i + 1}</span><span class="ps">${p.pos} ${esc(p.sign)}</span></div>`;
  }).join('');

  const kaartblad = pagina(T.eyebrow2, T.kaartTitel, `
      <div class="rij r-lagen"><p class="lead">${T.kaartKop}</p><p class="klein">${T.kaartTekst}</p></div>
      <div class="kaartvak">${svg}</div>
      <div class="rij r-standen">
        ${blok(T.standen, `<div class="kol2 st2">${standen}</div>`)}${blok(T.hoeken, hoeken)}${blok(T.huizen, huizen)}
      </div>
      <p class="noot">${T.kaartNoot}</p>`);

  // A4: vier vellen om te lezen; A3/A2: alles op één poster plus de kaart.
  const bladen = S.breed
    ? [pagina(T.eyebrow1, naam, lagen + planeten + elementen + rij(vier) + slotHTML), kaartblad]
    : [pagina(T.eyebrow1, naam, lagen + planeten),
       pagina(T.eyebrow1, naam, elementen + rij(vier.slice(0, 2))),
       kaartblad,
       pagina(T.eyebrow1, naam, rij(vier.slice(2)) + slotHTML)];

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>SZINN · ${naam}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">
<style>${css(S, size)}</style></head>
<body class="${S.breed ? 'breed' : 'a4'}">${bladen.join('')}
<script>${FIT_SCRIPT}</script></body></html>`;
}

// Elk blad is precies één pagina hoog; krimp de basis tot alle bladen passen.
// lib/pdf.js wacht op window.__klaar voordat hij print.
const FIT_SCRIPT = `window.__klaar = document.fonts.ready.then(function () {
  var r = document.documentElement, basis = parseFloat(getComputedStyle(r).fontSize), min = basis * 0.55;
  function past() { return [].every.call(document.querySelectorAll('.binnen'), function (b) { return b.scrollHeight <= b.clientHeight + 1; }); }
  while (!past() && basis > min) { basis *= 0.97; r.style.fontSize = basis + 'px'; }
});`;

function css(S, size) {
  return `
@page { size: ${S.w}mm ${S.h}mm; margin: 0; }
:root { --goud: #9A7B3C; --inkt: #1E1A16; --grijs: #6E665C; --lijn: #E4DACA; --vlak: #F4EEE3; }
html { font-size: ${S.basis}px; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: "Jost", system-ui, sans-serif; font-weight: 300; color: var(--inkt); background: #fff; line-height: 1.45; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.pagina { width: ${S.w}mm; break-after: page; }
.pagina:last-child { break-after: auto; }
.pagina { height: ${S.h}mm; overflow: hidden; }
.binnen { padding: 4.2rem 4.4rem 3rem; display: flex; flex-direction: column; gap: 2.2rem; }
.binnen { height: 100%; }
.a4 .binnen { padding: 14mm 14mm 12mm; }
header { border-bottom: 1px solid var(--lijn); padding-bottom: 1.2rem; }
.eyebrow, h3 { font-size: .72rem; letter-spacing: .28em; text-transform: uppercase; color: var(--goud); font-weight: 400; }
h1 { font-family: "Cormorant Garamond", Georgia, serif; font-weight: 600; font-size: 3rem; line-height: 1.1; margin: .5rem 0 .3rem; }
.meta, .sub, small, .wie, .noot { color: var(--grijs); font-size: .78rem; }
.sub { font-family: "Cormorant Garamond", Georgia, serif; font-style: italic; font-size: 1.1rem; margin: -.4rem 0 .8rem; }
h3 { margin-bottom: .9rem; }
p + p { margin-top: .6rem; }
.lead { font-family: "Cormorant Garamond", Georgia, serif; font-size: 1.55rem; line-height: 1.3; margin-bottom: .6rem; }
.rij { display: grid; gap: 2.6rem; }
.r-lagen { grid-template-columns: 2fr 1fr; }
.r-lagen > * + * { border-left: 1px solid var(--lijn); padding-left: 1.6rem; margin-top: 0 !important; }
.r-elem { grid-template-columns: 3fr 2fr; }
.r-vier { grid-template-columns: repeat(4, 1fr); }
.a4 .r-vier { grid-template-columns: 1fr 1fr; }
.st2 { grid-auto-flow: column; grid-template-rows: repeat(7, auto); }
.a4 .r-elem, .a4 .r-lagen:has(.blok) { grid-template-columns: 1fr; }
.a4 .r-lagen:has(.blok) > * + * { border-left: 0; padding-left: 0; }
.kol2 { display: grid; grid-template-columns: 1fr 1fr; column-gap: 2.6rem; }
.a4 .pl2 { grid-template-columns: 1fr; }
.pl { display: grid; grid-template-columns: 7rem 10rem 1fr; gap: .8rem; padding: .55rem 0; border-bottom: 1px solid var(--lijn); }
.pnaam { font-family: "Cormorant Garamond", Georgia, serif; font-size: 1.25rem; font-weight: 500; }
.prol { font-family: "Cormorant Garamond", Georgia, serif; font-size: 1.1rem; color: var(--goud); line-height: 1.2; }
.prol small { display: block; font-family: "Jost", sans-serif; font-size: .7rem; margin-top: .2rem; }
.pzin { font-size: .86rem; }
.bar { margin-bottom: .9rem; }
.barkop { display: grid; grid-template-columns: 8rem 1fr 2rem; align-items: center; gap: .8rem; }
.lbl { font-size: .72rem; letter-spacing: .2em; text-transform: uppercase; color: var(--grijs); }
.lijn { height: .3rem; background: var(--vlak); position: relative; }
.lijn i { position: absolute; top: 0; bottom: 0; left: 0; background: var(--goud); }
.tal { font-family: "Cormorant Garamond", Georgia, serif; font-size: 1.5rem; color: var(--goud); text-align: right; }
.bet, .wie { padding-left: 8.8rem; }
.bet { font-family: "Cormorant Garamond", Georgia, serif; font-style: italic; font-size: 1.02rem; }
.r-vier p, .r-vier li { font-size: .86rem; }
.getal b { font-family: "Cormorant Garamond", Georgia, serif; font-size: 1.6rem; font-weight: 500; color: var(--goud); }
.getal .lbl { font-size: .62rem; margin-right: .3rem; }
ul { list-style: none; }
li { padding-left: .9rem; position: relative; margin-bottom: .5rem; }
li::before { content: "•"; position: absolute; left: 0; color: var(--goud); }
b { font-weight: 500; }
.slot { font-family: "Cormorant Garamond", Georgia, serif; font-size: 1.6rem; line-height: 1.35; border-top: 1px solid var(--lijn); padding-top: 1.4rem; }
footer { margin-top: auto; border-top: 1px solid var(--lijn); padding-top: .8rem; }
.voetrij { display: flex; justify-content: space-between; gap: 1rem; font-size: .66rem; letter-spacing: .12em; text-transform: uppercase; color: var(--grijs); }
.goud { color: var(--goud); text-transform: none; letter-spacing: 0; font-size: .78rem; }
.disc { font-size: .6rem; color: var(--grijs); margin-top: .5rem; line-height: 1.4; }
.klein { font-size: .86rem; }
.kaartvak { flex: 1 1 auto; min-height: 0; display: flex; justify-content: center; align-items: center; }
.kaart { width: 100%; height: 100%; max-width: ${S.breed ? '82%' : '100%'}; max-height: none; }
.r-standen { grid-template-columns: 2fr 1fr 1fr; }
.a4 .r-standen { grid-template-columns: 1fr 1fr; }
.a4 .r-standen > .blok:first-child { grid-column: 1 / -1; }
.st, .hz { display: grid; grid-template-columns: 2rem 7rem 1fr; gap: .5rem; padding: .35rem 0; border-bottom: 1px solid var(--lijn); font-size: .82rem; align-items: baseline; }
.hz { grid-template-columns: 2rem 1fr; }
.st .gl, .hz .gl { color: var(--goud); }
.st .nm { font-family: "Cormorant Garamond", Georgia, serif; font-size: 1.05rem; font-weight: 500; }
.st small { display: block; }
.gedachte { font-family: "Cormorant Garamond", Georgia, serif; font-style: italic; font-size: 1.1rem; line-height: 1.25; }
.gedachte small { display: block; font-family: "Jost", sans-serif; font-style: normal; margin-top: .15rem; }
`;
}

// Blob-sleutel per order/taal/formaat. De generatietijd van de teksten zit in de
// sleutel, zodat een nieuwe blueprint vanzelf een nieuw blad krijgt.
// ponytail: oude bladen blijven als blob staan; opruimen als de opslag ertoe doet.
function overviewKey(orderId, lang, size, textsAll) {
  const stamp = String((textsAll && textsAll.generatedAt) || '0').replace(/\W/g, '');
  return `${orderId}.${lang}.overview-${size}-${stamp}.pdf`;
}

module.exports = { overviewHTML, overviewKey, SIZES };

// Zelf-check (offline): node lib/overview.js [map]  → schrijft de HTML's ook naar map
if (require.main === module) {
  const assert = require('node:assert');
  const fs = require('fs');
  const path = require('path');
  const { calcBirthChart } = require('./astro');
  const { calcAll } = require('./numerology');
  const chart = calcBirthChart('1973-10-25', '23:30', 52.08, 4.39, 1);
  const numerology = calcAll('Test Persoon Voorbeeld', '1973-10-25');
  const intake = { birthName: 'Test Persoon Voorbeeld', birthDate: '1973-10-25', birthTime: '23:30', birthCity: 'Leidschendam' };
  let textsAll = null;
  try { textsAll = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'blueprints', 'ORD-SALES-ELLY.texts.json'), 'utf8')); } catch {}
  for (const lang of ['nl', 'en']) {
    for (const size of Object.keys(SIZES)) {
      const html = overviewHTML({ intake, chart, numerology }, textsAll && textsAll[lang], { lang, size });
      assert.ok(html.includes('Test Persoon Voorbeeld'), 'volledige geboortenaam');
      assert.ok(html.includes(`size: ${SIZES[size].w}mm ${SIZES[size].h}mm`), `${size}: paginaformaat`);
      assert.ok(html.includes(lang === 'en' ? 'Scorpio' : 'Schorpioen'), `${lang}: zonneteken`);
      assert.ok(!/undefined|NaN/.test(html), `${lang} ${size}: geen undefined/NaN`);
      assert.strictEqual((html.match(/class="disc"/g) || []).length, size === 'A4' ? 4 : 2, 'disclaimer op elk vel');
      if (process.argv[2]) fs.writeFileSync(path.join(process.argv[2], `overzicht-${size}-${lang}.html`), html);
    }
    // kit-v4-velden voor het blad: permissions, patroon, elementtekst, naamgetallen
    const kit = { permissions: [{ text: 'Ik geef mezelf toestemming om X', note: 'Voor Y.' }], patterns: [{ label: 'stellium · huis 4', title: 'T', body: 'Patroonzin.' }],
      elements: { distribution: ['Elementzin.'], pull: '' }, numerology: { expressionBody: 'Expressiezin.' }, thoughts: [{ text: 'Als ik het niet draag, valt het uit elkaar.', source: 'Saturnus in Kreeft, huis 11' }] };
    const k = overviewHTML({ intake, chart, numerology }, kit, { lang, size: 'A3' });
    ['toestemming om X', 'stellium · huis 4', 'Patroonzin.', 'Elementzin.', 'Expressiezin.', 'Inner Permissions', 'valt het uit elkaar.”', 'Saturnus in Kreeft, huis 11'].forEach(x => assert.ok(k.includes(x), `${lang}: kit-veld ${x}`));
    // zonder AI-teksten blijft het blad heel
    assert.ok(!/undefined/.test(overviewHTML({ intake, chart, numerology }, null, { lang })), `${lang}: zonder teksten`);
  }
  // kaartcontrole: het huis van elke planeet volgt uit de cuspen op de kaart
  const cusps = chart.houseCusps;
  const huisUit = lon => 1 + cusps.findIndex((c, i) => ((lon - c + 360) % 360) < ((cusps[(i + 1) % 12] - c + 360) % 360));
  PLANETS.forEach(([k]) => { if (k !== 'ascendant' && k !== 'mc') assert.strictEqual(huisUit(chart.planets[k].lon), chart.planets[k].house, `huis ${k}`); });
  console.log('overview self-check ok');
}

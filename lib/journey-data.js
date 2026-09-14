'use strict';
// Bouwt de klantdata (client.json) voor de Herkenning-journey per gebruiker.
// De demo-JSON in szinn-portal/journey/ is de template; alles wat over de
// demo-klant gaat wordt vervangen door gegevens uit de eigen kaart, getallen
// en de AI-teksten van de blueprint (<orderId>.texts.json). Wat niet uit
// echte klantdata af te leiden is, wordt weggelaten — liever minder tekst
// dan andermans verhaal.

const fs = require('fs');
const path = require('path');

const JOURNEY_DIR = path.join(__dirname, '..', 'szinn-portal', 'journey');
const TEMPLATES = {}; // per taal gecachet

function template(lang) {
  const file = lang === 'en' ? 'client.json' : 'client-nl.json';
  if (!TEMPLATES[file]) {
    TEMPLATES[file] = JSON.parse(fs.readFileSync(path.join(JOURNEY_DIR, file), 'utf8'));
  }
  return JSON.parse(JSON.stringify(TEMPLATES[file])); // verse kopie per aanroep
}

// ── kleine helpers ───────────────────────────────────────────────────────────
function stripHTML(s) {
  return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
function paragraphs(html) {
  // "<p>a</p><p>b</p>" → ["a", "b"]
  return String(html || '').split(/<\/p>/i).map(stripHTML).filter(Boolean);
}
function findStap(fase, blokType) {
  return (fase.stappen || []).find(st => (st.blokken || []).some(b => b && b.type === blokType));
}
function findBlok(houder, blokType) {
  return (houder.blokken || []).find(b => b && b.type === blokType);
}
function verwijderBlok(houder, blok) {
  if (!houder.blokken || !blok) return;
  const i = houder.blokken.indexOf(blok);
  if (i >= 0) houder.blokken.splice(i, 1);
}

// ── vaste tabellen ───────────────────────────────────────────────────────────
const SIGN_GLYPH = {
  Aries: '♈︎', Taurus: '♉︎', Gemini: '♊︎', Cancer: '♋︎', Leo: '♌︎', Virgo: '♍︎',
  Libra: '♎︎', Scorpio: '♏︎', Sagittarius: '♐︎', Capricorn: '♑︎', Aquarius: '♒︎', Pisces: '♓︎',
};
const SIGN_THEMES = {
  Aries:       { nl: ['Moed', 'Beginnen', 'Direct zijn', 'Vuur'],            en: ['Courage', 'Initiating', 'Directness', 'Fire'] },
  Taurus:      { nl: ['Rust', 'Volhouden', 'Zintuigen', 'Waarde'],           en: ['Calm', 'Persistence', 'The senses', 'Value'] },
  Gemini:      { nl: ['Nieuwsgierigheid', 'Woorden', 'Beweging', 'Verbinden'], en: ['Curiosity', 'Words', 'Movement', 'Connecting'] },
  Cancer:      { nl: ['Gevoel', 'Zorg', 'Thuis', 'Geheugen'],                en: ['Feeling', 'Care', 'Home', 'Memory'] },
  Leo:         { nl: ['Warmte', 'Zichtbaarheid', 'Spel', 'Hart'],            en: ['Warmth', 'Visibility', 'Play', 'Heart'] },
  Virgo:       { nl: ['Precisie', 'Dienstbaarheid', 'Verfijnen', 'Ambacht'], en: ['Precision', 'Service', 'Refining', 'Craft'] },
  Libra:       { nl: ['Evenwicht', 'Schoonheid', 'De ander', 'Eerlijkheid'], en: ['Balance', 'Beauty', 'The other', 'Fairness'] },
  Scorpio:     { nl: ['Diepte', 'Loyaliteit', 'Eerlijkheid', 'Transformatie'], en: ['Depth', 'Loyalty', 'Honesty', 'Transformation'] },
  Sagittarius: { nl: ['Ruimte', 'Waarheid', 'Avontuur', 'Betekenis'],        en: ['Space', 'Truth', 'Adventure', 'Meaning'] },
  Capricorn:   { nl: ['Bouwen', 'Verantwoordelijkheid', 'Geduld', 'Meesterschap'], en: ['Building', 'Responsibility', 'Patience', 'Mastery'] },
  Aquarius:    { nl: ['Eigenheid', 'Vernieuwing', 'Het geheel', 'Vrijheid'], en: ['Originality', 'Renewal', 'The collective', 'Freedom'] },
  Pisces:      { nl: ['Gevoeligheid', 'Verbeelding', 'Overgave', 'Mededogen'], en: ['Sensitivity', 'Imagination', 'Surrender', 'Compassion'] },
};

// Maanfase: index 0–7 in dezelfde volgorde als de acht kaartjes in de template.
const MOON_TEXT = [
  { nl: 'Je bent geboren aan het begin van een cyclus, met de maan donker aan de hemel. Nieuwemaan-mensen beginnen op gevoel, vaak zonder dat het plan al af is. Je start iets omdat het klopt, en het verhaal wordt onderweg zichtbaar.',
    en: 'You were born at the start of a cycle, with the moon dark in the sky. New-moon people begin on instinct, often before the plan is finished. You start something because it feels right, and the story becomes visible along the way.',
    themasNl: ['Beginnen', 'Instinct', 'Vertrouwen', 'Frisse start'], themasEn: ['Beginning', 'Instinct', 'Trust', 'Fresh start'] },
  { nl: 'De maan was net aan het groeien toen jij aankwam. Je draagt de energie van de eerste stap: iets willen opbouwen, soms tegen de stroom in. Het oude loslaten kost jou meer moeite dan opnieuw beginnen.',
    en: 'The moon had just begun to grow when you arrived. You carry the energy of the first step: wanting to build, sometimes against the current. Letting go of the old costs you more than starting again.',
    themasNl: ['Opbouwen', 'Wilskracht', 'Tegen de stroom', 'Groei'], themasEn: ['Building up', 'Willpower', 'Against the current', 'Growth'] },
  { nl: 'Precies tussen donker en vol, op het scherpst van de groei. Je bent gemaakt om te handelen als het spannend wordt en om beslissingen te nemen waar anderen aarzelen.',
    en: 'Exactly between dark and full, at the sharpest point of growth. You are made to act when things get tense and to decide where others hesitate.',
    themasNl: ['Daadkracht', 'Keuzes', 'Spanning aankunnen', 'Doorzetten'], themasEn: ['Decisiveness', 'Choices', 'Handling tension', 'Perseverance'] },
  { nl: 'Bijna vol. Je verfijnt, verbetert en wilt begrijpen hoe het beter kan. Je bent op je best vlak voor de finish, als alles samen moet komen.',
    en: 'Almost full. You refine, improve and want to understand how it can be better. You are at your best just before the finish, when everything has to come together.',
    themasNl: ['Verfijnen', 'Toewijding', 'Inzicht', 'Perfectioneren'], themasEn: ['Refining', 'Dedication', 'Insight', 'Perfecting'] },
  { nl: 'Geboren onder een volle hemel. Je leeft in het zicht: relaties, spiegels en betekenis. Wat in anderen leeft, licht bij jou op — en jij laat zien wat af is.',
    en: 'Born under a full sky. You live in view: relationships, mirrors and meaning. What lives in others lights up in you — and you show what is complete.',
    themasNl: ['Zichtbaarheid', 'Relaties', 'Helderheid', 'Volheid'], themasEn: ['Visibility', 'Relationships', 'Clarity', 'Fullness'] },
  { nl: 'Na de volle maan komt het delen. Je bent hier om door te geven wat je begrijpt: uitleggen, overdragen, betekenis geven aan wat je hebt meegemaakt.',
    en: 'After the full moon comes the sharing. You are here to pass on what you understand: explaining, teaching, giving meaning to what you have lived.',
    themasNl: ['Delen', 'Overdragen', 'Betekenis', 'Wijsheid'], themasEn: ['Sharing', 'Passing on', 'Meaning', 'Wisdom'] },
  { nl: 'De cyclus keert naar binnen. Je herziet, breekt af wat niet meer klopt en maakt ruimte voor wat komt. Een keerpunt-mens: jij ziet wanneer iets zijn vorm heeft gehad.',
    en: 'The cycle turns inward. You revise, dismantle what no longer fits and make room for what comes. A turning-point person: you see when something has had its form.',
    themasNl: ['Herzien', 'Afronden', 'Ruimte maken', 'Keerpunt'], themasEn: ['Revising', 'Completing', 'Making room', 'Turning point'] },
  { nl: 'De laatste streep licht voor het donker, het einde van een cyclus. Je voelt eindes aankomen voordat iemand ze uitspreekt, laat vroeg los en leeft vaak al in het hoofdstuk dat de anderen nog niet hebben opengeslagen.',
    en: 'The last sliver of light before the dark, the end of a cycle. You sense endings before anyone names them, let go early, and often already live in the chapter the others have not yet opened.',
    themasNl: ['Einde voelen', 'Loslaten', 'Stilte', 'Een cyclus sluiten'], themasEn: ['Sensing endings', 'Letting go', 'Stillness', 'Closing a cycle'] },
];

// Volgorde van de twaalf planeetkaarten in de template.
const PLANET_KEYS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn',
  'uranus', 'neptune', 'pluto', 'chiron', 'northNode'];

// ── zinnen ───────────────────────────────────────────────────────────────────
function jouwZin(lang, naam, p) {
  const sign = lang === 'en' ? p.signEn : p.sign;
  const retro = p.retrograde ? ', retrograde' : '';
  const huis = p.house ? (lang === 'en' ? `, in house ${p.house}` : `, in huis ${p.house}`) : '';
  return lang === 'en'
    ? `Your ${naam} is in ${sign}${retro}${huis}.`
    : `Jouw ${naam} staat in ${sign}${retro}${huis}.`;
}

function moonPhaseIndex(chart) {
  const sun = chart.planets.sun, moon = chart.planets.moon;
  const angle = ((moon.lon - sun.lon) % 360 + 360) % 360;
  return Math.round(angle / 45) % 8;
}

function ritmeHTML(templateHtml, birthYear, nowYear) {
  // De kopjes (1 begin … 9 opruimen) zijn generiek en komen uit de template;
  // het jarenrooster eronder wordt op het eigen geboortejaar opgebouwd.
  const knip = String(templateHtml || '').indexOf('<div class="ritmerij">');
  if (knip < 0 || !birthYear) return null;
  const prefix = templateHtml.slice(0, knip);
  let rows = '';
  for (let r = 0; r < 12; r++) {
    let row = '<div class="ritmerij">';
    for (let c = 0; c < 9; c++) {
      const jaar = birthYear + r * 9 + c;
      const cls = ['jr', c === 0 ? 'een' : '', c === 8 ? 'negen' : '', jaar === nowYear ? 'nu' : '']
        .filter(Boolean).join(' ');
      row += `<div class="${cls}"><b>${jaar}</b><i>${jaar - birthYear}</i><u></u></div>`;
    }
    rows += row + '</div>';
  }
  return prefix + rows + '</div>';
}

// ── hoofdopbouw ──────────────────────────────────────────────────────────────
// opts: { lang, order, chart, numerology, texts, ready, userName }
// order:  de order-rij (id/view_token/client_name/full_birth_name/birth_date)
// texts:  de taal-laag uit <orderId>.texts.json (dus .nl of .en), mag null
function buildJourneyJSON(opts) {
  const lang = opts.lang === 'en' ? 'en' : 'nl';
  const d = template(lang);
  const en = lang === 'en';

  // Taalwissel: beide talen via de dynamische routes, niet de statische demo.
  (d.talen || []).forEach(t => { t.data = t.code === 'nl' ? 'client-nl.json' : 'client-en.json'; });

  const naam = (opts.order && opts.order.full_birth_name) || (opts.order && opts.order.client_name) || opts.userName || '';
  const voornaam = ((opts.order && opts.order.client_name) || opts.userName || naam).split(' ')[0] || '';
  d.naam = naam || d.naam;
  d.voornaam = voornaam || d.voornaam;
  d.voettekst = `© ${new Date().getFullYear()} ${naam || 'SZINN'} · szinn.ai`;
  if (d.welkom) d.welkom.titel = en ? `Welcome, ${voornaam}.` : `Welkom, ${voornaam}.`;
  if (d.navigatie && d.navigatie.citaat) d.navigatie.citaat.naam = naam || d.navigatie.citaat.naam;

  if (!opts.ready) return lockedJSON(d, lang);

  const { chart, numerology, texts, order } = opts;
  const orderRef = (order && (order.view_token || order.id)) || '';
  const pdfHref = `/api/orders/${encodeURIComponent(orderRef)}/pdf?lang=${lang}`;
  d.blueprintKlaar = true;
  d.blauwdruk = `/portaal/blueprint?id=${encodeURIComponent(orderRef)}`;

  const hk = d.herkenning || {};

  // ── fase 1 · stap "Jouw verhaal": de eigen introductie uit de blueprint ──
  if (hk.stappen && hk.stappen[0] && texts && texts.introduction) {
    const st = hk.stappen[0];
    const oud = st.blokken || [];
    const houd = t => oud.filter(b => b && b.type === t);
    const intro = paragraphs(texts.introduction).map(t => ({ tekst: t }));
    const lijst = (texts.summary && Array.isArray(texts.summary.rows) && texts.summary.rows.length)
      ? [{ type: 'lijst', kop: en ? 'You may recognise this' : 'Dit herken je misschien', items: texts.summary.rows.map(stripHTML) }]
      : [];
    st.blokken = [...intro, ...houd('afsluiter'), ...lijst, ...houd('herinnering'), ...houd('invoer')];
  }

  // ── fase 1 · geboortekaart: het eigen kaartbeeld ──
  const kaartStap = findStap(hk, 'zwevend');
  if (kaartStap) {
    const zw = findBlok(kaartStap, 'zwevend');
    zw.src = 'chart.svg';
    zw.onder = en ? 'The sky at the moment you were born.' : 'De hemel op het moment dat jij werd geboren.';
  }

  // ── fase 1 · planeten ──
  const plStap = findStap(hk, 'planeten');
  if (plStap && chart) {
    const blok = findBlok(plStap, 'planeten');
    const q = (texts && texts.astrology && texts.astrology.qualities) || {};
    (blok.items || []).forEach((item, i) => {
      const p = chart.planets[PLANET_KEYS[i]];
      if (!p || p.sign === '?') return;
      const zin = jouwZin(lang, item.naam, p);
      const kwaliteit = stripHTML(q[PLANET_KEYS[i]] || '');
      item.tekenTeken = SIGN_GLYPH[p.signEn] || '';
      item.jouw = zin;
      item.jouwtekst = kwaliteit ? `${zin} ${kwaliteit}${/[.!?]$/.test(kwaliteit) ? '' : '.'}` : zin;
      item.themas = (SIGN_THEMES[p.signEn] || {})[lang] || [];
      item.herkenning = [];   // demo-specifiek; zonder eigen tekst liever leeg
      item.herinnering = '';
    });
  }

  // ── fase 1 · maanfase ──
  const maanStap = findStap(hk, 'maanfases');
  if (maanStap && chart) {
    const idx = moonPhaseIndex(chart);
    const fasen = findBlok(maanStap, 'maanfases');
    (fasen.items || []).forEach((m, i) => { m.actief = i === idx; });
    const label = ((fasen.items || [])[idx] || {}).label || '';
    const vak = findBlok(maanStap, 'vak');
    if (vak) {
      vak.beeld = `assets/maan-${idx}.jpg`;
      vak.kop = en
        ? `You were born under a ${label.toLowerCase()}${/moon/i.test(label) ? '' : ' moon'}.`
        : `Je bent geboren onder een ${label.toLowerCase()}.`;
      vak.tekst = MOON_TEXT[idx][lang];
      vak.themas = en ? MOON_TEXT[idx].themasEn : MOON_TEXT[idx].themasNl;
    }
    verwijderBlok(maanStap, findBlok(maanStap, 'duo'));
  }

  // ── fase 1 · getallen ──
  const getalStap = findStap(hk, 'getallen');
  if (getalStap && numerology) {
    const kern = findBlok(getalStap, 'getallen');
    kern.items = [
      { getal: String(numerology.lifePath), label: en ? 'life path' : 'levenspad' },
      { getal: String(numerology.expression), label: en ? 'expression' : 'expressie' },
      { getal: String(numerology.soulUrge), label: en ? 'soul urge' : 'zielsverlangen' },
      { getal: String(numerology.personalYear), label: en ? `year ${numerology.currentYear}` : `jaar ${numerology.currentYear}` },
    ];
    kern.tekst = '';
    const vak = findBlok(getalStap, 'vak');
    if (vak) {
      const titel = texts && texts.numerology && texts.numerology.lifePathTitle;
      vak.kop = (en ? `Life path ${numerology.lifePath}` : `Levenspad ${numerology.lifePath}`) + (titel ? ` · ${titel}` : '');
      vak.tekst = stripHTML((texts && texts.numerology && texts.numerology.lifePathBody) || '')
        || `${(numerology.lifePathInfo || {}).name || ''} · ${(numerology.lifePathInfo || {}).keyword || ''}`;
      vak.themas = [];
    }
    verwijderBlok(getalStap, findBlok(getalStap, 'uitklap')); // groeigetallen: demo-specifiek
    const ritme = findBlok(getalStap, 'html');
    const birthYear = parseInt(String((order || {}).birth_date || '').slice(0, 4), 10);
    if (ritme && birthYear) {
      const nieuw = ritmeHTML(ritme.html, birthYear, new Date().getFullYear());
      if (nieuw) ritme.html = nieuw;
    }
    verwijderBlok(getalStap, findBlok(getalStap, 'duo'));
  }

  // ── fase 1 · Tikkun ──
  const tikkunStap = (hk.stappen || []).find(st => /tikkun/i.test(st.titel || ''));
  if (tikkunStap && texts && texts.tikkun && Array.isArray(texts.tikkun.cards) && texts.tikkun.cards.length) {
    const cards = texts.tikkun.cards;
    const vak = findBlok(tikkunStap, 'vak');
    if (vak) {
      vak.kop = cards[0].title;
      vak.tekst = stripHTML(cards[0].body);
      vak.themas = [];
    }
    verwijderBlok(tikkunStap, findBlok(tikkunStap, 'duo'));
    // Overige kaarten als gewone tekstblokken, vóór het schrijfvak.
    const invoer = findBlok(tikkunStap, 'invoer');
    const plek = invoer ? tikkunStap.blokken.indexOf(invoer) : tikkunStap.blokken.length;
    tikkunStap.blokken.splice(plek, 0, ...cards.slice(1).map(c => ({ kop: c.title, tekst: `<p>${stripHTML(c.body)}</p>` })));
  }

  // ── fase 2 · Helderheid ──
  const hl = d.helderheid || {};
  const s = hl.stappen || [];
  const summary = (texts && texts.summary) || {};
  if (s[0]) {
    const lijst = findBlok(s[0], 'lijst');
    if (lijst) {
      if (summary.oneLiner) lijst.items = [stripHTML(summary.oneLiner)];
      else verwijderBlok(s[0], lijst);
    }
  }
  if (s[1]) {
    const lijst = findBlok(s[1], 'lijst');
    const lagen = texts && texts.integration && texts.integration.layers;
    if (lijst) {
      if (lagen) {
        lijst.kop = en ? 'Where the systems say the same thing' : 'Waar de systemen hetzelfde zeggen';
        lijst.items = Object.values(lagen).map(stripHTML).filter(Boolean);
      } else verwijderBlok(s[1], lijst);
    }
    const uitklap = findBlok(s[1], 'uitklap');
    const nodes = texts && texts.nodes;
    if (uitklap) {
      if (nodes && chart) {
        uitklap.kop = en ? 'Look a little longer at these' : 'Kijk hier wat langer naar';
        uitklap.items = [
          { titel: en ? `Your South Node in ${chart.planets.southNode.signEn}` : `Jouw Zuidknoop in ${chart.planets.southNode.sign}`,
            beeld: 'assets/pl-northnode.jpg', kort: '', tekst: nodes.south || '' },
          { titel: en ? `Your North Node in ${chart.planets.northNode.signEn}` : `Jouw Noordknoop in ${chart.planets.northNode.sign}`,
            beeld: 'assets/pl-northnode.jpg', kort: '', tekst: nodes.north || '' },
          { titel: en ? `Chiron in ${chart.planets.chiron.signEn}` : `Chiron in ${chart.planets.chiron.sign}`,
            beeld: 'assets/pl-chiron.jpg', kort: '', tekst: nodes.chiron || '' },
        ].filter(x => x.tekst);
      } else verwijderBlok(s[1], uitklap);
    }
    verwijderBlok(s[1], findBlok(s[1], 'duo'));
  }
  if (s[2]) {
    const lijst = findBlok(s[2], 'lijst');
    if (lijst) {
      if (Array.isArray(summary.rows) && summary.rows.length) lijst.items = summary.rows.map(stripHTML);
      else verwijderBlok(s[2], lijst);
    }
    const vak = findBlok(s[2], 'vak');
    if (vak) {
      vak.kop = en ? `${voornaam} in one sentence.` : `${voornaam} in één zin.`;
      vak.tekst = stripHTML(summary.oneLiner || '') || vak.tekst;
      if (vak.themas) vak.themas = [];
    }
  }
  // Print: rechtstreeks de eigen blueprint-PDF, geen demo-bestanden.
  const bp = findBlok(hl, 'blauwdruk');
  if (bp) {
    bp.pdf = pdfHref;
    bp.print = [{
      knop: en ? 'Print your blueprint' : 'Print jouw blueprint',
      sub: en ? 'PDF · straight from your own blueprint' : 'PDF · rechtstreeks uit jouw eigen blauwdruk',
      href: pdfHref,
    }];
  }

  return d;
}

// Nog geen voltooide blueprint: alleen het welkomstscherm (video + uitleg),
// de fases blijven leeg en het startpunt is vergrendeld tot alles klaar is.
function lockedJSON(d, lang) {
  const en = lang === 'en';
  d.blueprintKlaar = false;
  d.slotKlaar = en
    ? 'Your personal blueprint is being prepared. You will receive an email the moment everything is ready — then your journey opens here.'
    : 'Je persoonlijke blauwdruk wordt voor je gemaakt. Je ontvangt een e-mail zodra alles klaar staat — dan gaat je reis hier open.';
  if (d.welkom) {
    d.welkom.altijd = true;
    if (d.welkom.reis) d.welkom.reis.knop = '';
  }
  ['herkenning', 'helderheid', 'integratie'].forEach(f => {
    d[f] = { titel: (d[f] || {}).titel || f };
  });
  d.allesOpen = false;
  return d;
}

module.exports = { buildJourneyJSON, moonPhaseIndex, ritmeHTML };

// Zelf-check (offline): node lib/journey-data.js
if (require.main === module) {
  const assert = require('node:assert');
  const { calcBirthChart } = require('./astro');
  const { calcAll } = require('./numerology');
  const chart = calcBirthChart('1990-03-15', '10:30', 52.37, 4.9, 1);
  const numerology = calcAll('Test Persoon Voorbeeld', '1990-03-15');
  let textsAll = null;
  try { textsAll = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'blueprints', 'ORD-SALES-ELLY.texts.json'), 'utf8')); } catch {}
  const order = { id: 'ORD-TEST', view_token: 'tok123', client_name: 'Test Persoon', full_birth_name: 'Test Persoon Voorbeeld', birth_date: '1990-03-15' };

  for (const lang of ['nl', 'en']) {
    const texts = textsAll ? textsAll[lang] : null;
    const j = buildJourneyJSON({ lang, order, chart, numerology, texts, ready: true });
    const blob = JSON.stringify(j);
    assert.ok(!blob.includes('Elly'), `${lang}: demo-naam weggewerkt`);
    assert.ok(!blob.includes('Korving'), `${lang}: demo-achternaam weggewerkt`);
    assert.ok(!blob.includes('overzicht-A4-nl.pdf') && !blob.includes('overview-A4-en.pdf'), `${lang}: demo-print-PDF weg`);
    assert.ok(blob.includes('/api/orders/tok123/pdf'), `${lang}: eigen PDF-link aanwezig`);
    assert.ok(blob.includes('chart.svg'), `${lang}: eigen kaartbeeld`);
    // planeetzin klopt met de berekende kaart
    const zon = findStap(j.herkenning, 'planeten').blokken.find(b => b.type === 'planeten').items[0];
    assert.ok(zon.jouw.includes(lang === 'en' ? chart.planets.sun.signEn : chart.planets.sun.sign), `${lang}: zonneteken in zin`);
    // maanfase: precies één actief
    const fasen = findStap(j.herkenning, 'maanfases').blokken.find(b => b.type === 'maanfases');
    assert.strictEqual(fasen.items.filter(m => m.actief).length, 1, `${lang}: één actieve maanfase`);
    // ritme begint op het eigen geboortejaar
    const ritme = findStap(j.herkenning, 'html').blokken.find(b => b.type === 'html');
    assert.ok(ritme.html.includes('<b>1990</b><i>0</i>'), `${lang}: ritme op eigen geboortejaar`);
  }

  const locked = buildJourneyJSON({ lang: 'nl', order, ready: false, userName: 'Test Persoon' });
  assert.strictEqual(locked.blueprintKlaar, false);
  assert.ok(!JSON.stringify(locked).includes('Schorpioen'), 'locked: geen demo-planeetteksten');
  assert.ok(!locked.herkenning.stappen, 'locked: fases leeg');
  assert.strictEqual(locked.welkom.altijd, true, 'locked: welkom altijd');
  console.log('journey-data self-check ok');
}

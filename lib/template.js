'use strict';
// Rendert de canonieke blueprint-template: berekende data (laag 1) + AI-teksten
// (laag 2) → volledige HTML. De template zelf (CSS, structuur, vaste teksten)
// staat in templates/blueprint.<lang>.html en wordt nooit door de AI geschreven.

const fs = require('fs');
const path = require('path');
const { generateMandalaSVG } = require('./mandala');

const MONTHS = {
  nl: ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'],
  en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
};

const L = {
  nl: {
    sun: 'Zon', moon: 'Maan', asc: 'Asc', ascFull: 'Ascendant', lifePath: 'Levenspad',
    py: 'Persoonlijk Jaar', pyShort: 'Pers. Jaar', birthday: 'Geboortedag',
    scardTitles: ['Astrologie', 'Numerologie', 'Zielrichting', 'Persoonlijk Jaar'],
    movesVia: 'Beweegt via',
    flowLbls: ['Sin / Lichaam', 'Sinn / Betekenis', 'Zin / Richting'],
    coreLbls: { lifePath: 'Levenspad', py: 'Persoonlijk Jaar', birthday: 'Geboortedag', expression: 'Uitdrukking', soulUrge: 'Zielenurge', personality: 'Persoonlijkheid' },
    tikkunLbls: ['Kernthema', 'Groei', 'Zielstaak'],
    summaryLbls: ['Kernidentiteit', 'Emotioneel kompas', 'Zielrichting', 'Levensthema', 'Tikkun', 'Schaduwthema'],
    energyLbls: ['Ochtend', 'Aarde &amp; lichaam', 'Hart &amp; verbinding', 'Werk &amp; bijdrage', 'Avond &amp; herstel'],
    giftTitles: ['Intuïtie', 'Verbeeldingskracht', 'Geheugen', 'Redeneren', 'Waarneming', 'Wilskracht'],
    gift: 'Gave', practice: 'Praktijk', prompt: 'Prompt', copy: 'Kopieer',
    personalMonth: 'Persoonlijke Maand', masterMonth: 'meestermaand', to: 'tot',
    planetNames: { sun:'Zon', moon:'Maan', mercury:'Mercurius', venus:'Venus', mars:'Mars', jupiter:'Jupiter', saturn:'Saturnus', uranus:'Uranus', neptune:'Neptunus', pluto:'Pluto', northNode:'Noordknoop', chiron:'Chiron' },
  },
  en: {
    sun: 'Sun', moon: 'Moon', asc: 'Asc', ascFull: 'Ascendant', lifePath: 'Life Path',
    py: 'Personal Year', pyShort: 'Pers. Year', birthday: 'Birth Day',
    scardTitles: ['Astrology', 'Numerology', 'Soul Direction', 'Personal Year'],
    movesVia: 'Moves through',
    flowLbls: ['Sin / Body', 'Sinn / Meaning', 'Zin / Direction'],
    coreLbls: { lifePath: 'Life Path', py: 'Personal Year', birthday: 'Birth Day', expression: 'Expression', soulUrge: 'Soul Urge', personality: 'Personality' },
    tikkunLbls: ['Core theme', 'Growth', 'Soul task'],
    summaryLbls: ['Core identity', 'Emotional compass', 'Soul direction', 'Life theme', 'Tikkun', 'Shadow theme'],
    energyLbls: ['Morning', 'Earth &amp; body', 'Heart &amp; connection', 'Work &amp; contribution', 'Evening &amp; recovery'],
    giftTitles: ['Intuition', 'Imagination', 'Memory', 'Reasoning', 'Perception', 'Willpower'],
    gift: 'Gift', practice: 'Practice', prompt: 'Prompt', copy: 'Copy',
    personalMonth: 'Personal Month', masterMonth: 'master month', to: 'to',
    planetNames: { sun:'Sun', moon:'Moon', mercury:'Mercury', venus:'Venus', mars:'Mars', jupiter:'Jupiter', saturn:'Saturn', uranus:'Uranus', neptune:'Neptune', pluto:'Pluto', northNode:'North Node', chiron:'Chiron' },
  },
};

const PLANET_SYMBOLS = { sun:'☉', moon:'☽', mercury:'☿', venus:'♀', mars:'♂', jupiter:'♃', saturn:'♄', uranus:'⛢', neptune:'♆', pluto:'♇', northNode:'☊', chiron:'⚷' };

// Engelse tekennamen voor de EN-variant
const SIGN_EN = {
  Ram:'Aries', Stier:'Taurus', Tweelingen:'Gemini', Kreeft:'Cancer', Leeuw:'Leo', Maagd:'Virgo',
  Weegschaal:'Libra', Schorpioen:'Scorpio', Boogschutter:'Sagittarius', Steenbok:'Capricorn', Waterman:'Aquarius', Vissen:'Pisces',
};
function signName(sign, lang) { return lang === 'en' ? (SIGN_EN[sign] || sign) : sign; }

// ── Kalender: vaste teksten per maandgetal ───────────────────────────────────
const CAL_COLORS = { 1:'#7FB45F', 2:'#6E9E9B', 3:'#A67C3A', 4:'#5A9BD9', 5:'#C2734A', 6:'#B5838D', 7:'#6E7BA8', 8:'#C2895A', 9:'#A0739E', 11:'#7B7BA0', 22:'#8A6FA8' };
const CAL_TEXTS = {
  nl: {
    1: { theme:'Een nieuw begin', body:'De 1 opent een nieuwe cyclus. Begin iets van jezelf, klein en eigen, vanuit initiatief en eigen wil.', bullets:['Zet een eerste stap vanuit wat jij wilt','Begin iets kleins dat puur van jou is','Neem het initiatief, wacht niet af'] },
    2: { theme:'Verbinding en geduld', body:'De 2 vraagt om samenwerking, luisteren en timing. Een maand om te verdiepen in plaats van te forceren.', bullets:['Luister meer dan je spreekt','Verdiep één belangrijke relatie','Vertrouw op timing in plaats van druk'] },
    3: { theme:'Expressie en vreugde', body:'De 3 brengt expressie, vreugde en communicatie. Laat je zien, deel wat je maakt en geniet van je mensen.', bullets:['Deel openlijk wat in je leeft','Doe iets puur omdat het je vreugde geeft','Geniet bewust van je vrienden en de groep'] },
    4: { theme:'Grond en structuur', body:'De 4 brengt grond, structuur en fundament. Een maand om af te maken en stevigheid te bouwen onder wat je begonnen bent.', bullets:['Maak af waar je aan begonnen bent','Breng orde aan, één ding tegelijk','Bouw een stevig fundament onder je richting'] },
    5: { theme:'Vrijheid en beweging', body:'De 5 brengt verandering, avontuur en beweging. Een maand om ruimte te maken en het onbekende toe te laten.', bullets:['Doorbreek één vaste gewoonte','Zeg ja tegen iets nieuws','Beweeg letterlijk: reis, wandel, verander van plek'] },
    6: { theme:'Zorg en harmonie', body:'De 6 brengt zorg, verantwoordelijkheid en harmonie. Een maand voor thuis, relaties en geven vanuit liefde.', bullets:['Geef aandacht aan thuis en familie','Herstel wat uit balans is geraakt','Geef vanuit liefde, niet vanuit plicht'] },
    7: { theme:'Verdieping en stilte', body:'De 7 vraagt om reflectie, studie en rust. Een maand om naar binnen te keren en te luisteren naar je innerlijk weten.', bullets:['Maak ruimte voor stilte en alleen-zijn','Verdiep je in iets dat je fascineert','Vertrouw op je innerlijk weten'] },
    8: { theme:'Kracht en oogst', body:'De 8 brengt kracht, oogst en manifestatie. Een maand om te oogsten wat klaar is en je plek te pakken. Concreet en doelgericht.', bullets:['Oogst wat klaar is om geoogst te worden','Pak je plek en je autoriteit','Zet kracht achter wat je begint'] },
    9: { theme:'Voltooien en loslaten', body:'De 9 sluit een cyclus. Een maand om af te ronden, los te laten en ruimte te maken. Mededogen voor jezelf en voor wat geweest is.', bullets:['Rond af wat afgerond mag worden','Laat los wat niet mee mag naar het nieuwe','Wees mild voor jezelf en voor wat was'] },
    11: { theme:'Intuïtie en gevoeligheid', body:'Een meestermaand met verhoogde gevoeligheid en intuïtie. Maak ruimte voor stilte en luister extra naar wat je van binnen voelt.', bullets:['Maak ruimte voor stilte','Volg je gevoel voordat je het wegredeneert','Let op wat zich aandient, het draagt richting'] },
    22: { theme:'Bouwen op grote schaal', body:'Een meestermaand van de meesterbouwer. Wat je nu neerzet kan groter dragen dan jijzelf. Bouw praktisch aan een visie.', bullets:['Werk concreet aan je grootste visie','Denk groot, bouw klein en gestaag','Verbind je visie met het dagelijkse werk'] },
  },
  en: {
    1: { theme:'A new beginning', body:'The 1 opens a new cycle. Start something of your own, small and personal, from initiative and your own will.', bullets:['Take a first step from what you want','Start something small that is purely yours','Take the initiative, don’t wait'] },
    2: { theme:'Connection and patience', body:'The 2 asks for cooperation, listening and timing. A month to deepen rather than force.', bullets:['Listen more than you speak','Deepen one important relationship','Trust timing instead of pressure'] },
    3: { theme:'Expression and joy', body:'The 3 brings expression, joy and communication. Show yourself, share what you create and enjoy your people.', bullets:['Openly share what lives in you','Do something purely because it brings you joy','Consciously enjoy your friends and community'] },
    4: { theme:'Ground and structure', body:'The 4 brings ground, structure and foundation. A month to finish things and build solidity under what you started.', bullets:['Finish what you started','Create order, one thing at a time','Build a solid foundation under your direction'] },
    5: { theme:'Freedom and movement', body:'The 5 brings change, adventure and movement. A month to make space and welcome the unknown.', bullets:['Break one fixed habit','Say yes to something new','Move literally: travel, walk, change places'] },
    6: { theme:'Care and harmony', body:'The 6 brings care, responsibility and harmony. A month for home, relationships and giving from love.', bullets:['Give attention to home and family','Restore what has fallen out of balance','Give from love, not from duty'] },
    7: { theme:'Depth and stillness', body:'The 7 asks for reflection, study and rest. A month to turn inward and listen to your inner knowing.', bullets:['Make space for silence and solitude','Dive into something that fascinates you','Trust your inner knowing'] },
    8: { theme:'Power and harvest', body:'The 8 brings power, harvest and manifestation. A month to harvest what is ready and claim your place. Concrete and focused.', bullets:['Harvest what is ready to be harvested','Claim your place and your authority','Put power behind what you begin'] },
    9: { theme:'Completing and letting go', body:'The 9 closes a cycle. A month to finish, release and make space. Compassion for yourself and for what has been.', bullets:['Complete what may be completed','Release what cannot come along into the new','Be gentle with yourself and with what was'] },
    11: { theme:'Intuition and sensitivity', body:'A master month of heightened sensitivity and intuition. Make space for silence and listen closely to what you feel inside.', bullets:['Make space for stillness','Follow your feeling before you reason it away','Notice what presents itself; it carries direction'] },
    22: { theme:'Building on a grand scale', body:'A master month of the master builder. What you create now can carry more than yourself. Build practically toward a vision.', bullets:['Work concretely on your biggest vision','Think big, build small and steadily','Connect your vision to daily work'] },
  },
};

// ── Scorelabels (kwalitatief, geen cijfers) ──────────────────────────────────
function scoreLabels(numerology, lang) {
  const py = numerology.personalYear, lp = numerology.lifePath;
  const nl = {
    astro: 'Sterk geactiveerd',
    num: (lp === 9 && py <= 2) ? 'Drempeljaar' : py === 1 ? 'Nieuw begin' : py === 9 ? 'Afsluiting' : py === 8 ? 'Oogstjaar' : py === 5 ? 'Jaar van verandering' : py === 7 ? 'Innerlijk jaar' : 'In beweging',
    soul: 'Ongerept terrein',
    py: ({ 1:'Nieuw begin', 2:'Samenwerking', 3:'Expressie & Vreugde', 4:'Opbouw & Structuur', 5:'Jaar van verandering', 6:'Verantwoordelijkheid', 7:'Innerlijk jaar', 8:'Oogst & Kracht', 9:'Afsluiting & Loslaten' })[py] || 'In beweging',
  };
  if (lang !== 'en') return nl;
  const map = {
    'Sterk geactiveerd':'Strongly activated', 'Drempeljaar':'Threshold year', 'Nieuw begin':'New beginning', 'Afsluiting':'Completion',
    'Oogstjaar':'Harvest year', 'Jaar van verandering':'Year of change', 'Innerlijk jaar':'Inner year', 'In beweging':'In motion',
    'Ongerept terrein':'Untouched terrain', 'Samenwerking':'Cooperation', 'Expressie & Vreugde':'Expression & Joy',
    'Opbouw & Structuur':'Building & Structure', 'Verantwoordelijkheid':'Responsibility', 'Oogst & Kracht':'Harvest & Power',
    'Afsluiting & Loslaten':'Completion & Release',
  };
  return Object.fromEntries(Object.entries(nl).map(([k, v]) => [k, map[v] || v]));
}

// ── Hulpjes ──────────────────────────────────────────────────────────────────
function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
// Beperkte HTML uit de AI: alleen p/em/strong/br toegestaan, rest wordt geneutraliseerd
function limitedHTML(s) {
  return String(s ?? '')
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<(?!\/?(p|em|strong|br)\b)[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}
function pos(p) { return `${p.sign} ${p.deg}°${String(p.min).padStart(2, '0')}'`; }
function posLang(p, lang) { return `${signName(p.sign, lang)} ${p.deg}°${String(p.min).padStart(2, '0')}'`; }

function formatDateLong(dateStr, lang) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return lang === 'en' ? `${MONTHS.en[m - 1]} ${d}, ${y}` : `${d} ${MONTHS.nl[m - 1]} ${y}`;
}

// Template van schijf lezen. In de gebundelde Netlify-function wijst __dirname
// naar de function-map; lokaal naar lib/. Daarom meerdere kandidaten proberen.
function readTemplate(lang) {
  const bases = [
    path.join(__dirname, '..', 'templates'),
    path.join(process.cwd(), 'templates'),
    path.join(process.env.LAMBDA_TASK_ROOT || '', 'templates'),
    path.join(__dirname, 'templates'),
  ];
  for (const base of bases) {
    for (const file of [`blueprint.${lang}.html`, 'blueprint.nl.html']) {
      const p = path.join(base, file);
      try { if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8'); } catch {}
    }
  }
  throw new Error(`blueprint-template niet gevonden (gezocht in: ${bases.join(' | ')})`);
}

// ── Hoofd-render ─────────────────────────────────────────────────────────────
// ctx: { intake: {clientName, birthName, birthDate, birthTime, birthCity, birthCountry},
//        chart, numerology, ai (tekstobject van ai-texts.js), lang }
function renderBlueprint(ctx) {
  const { intake, chart, numerology: num, ai } = ctx;
  const lang = ctx.lang === 'en' ? 'en' : 'nl';
  const t = L[lang];
  const P = chart.planets;
  const year = num.currentYear;

  let html = readTemplate(lang);

  const labels = scoreLabels(num, lang);
  const birthPlace = [intake.birthCity, intake.birthCountry].filter(Boolean).join(', ');

  const tokens = {
    CLIENT_NAME: esc(intake.clientName),
    GEN_YEAR: String(year),
    BIRTH_DATE_LONG: formatDateLong(intake.birthDate, lang),
    BIRTH_TIME: esc(intake.birthTime || '12:00'),
    BIRTH_CITY: esc(intake.birthCity || ''),
    BIRTH_PLACE: esc(birthPlace),
    BIRTH_LINE: `${formatDateLong(intake.birthDate, lang)} · ${esc(intake.birthTime || '12:00')} · ${esc(birthPlace)}`,
    L_SUN: t.sun, L_MOON: t.moon, L_ASC: t.asc, L_ASC_FULL: t.ascFull,
    L_LIFEPATH: t.lifePath, L_PY: t.py, L_PY_SHORT: t.pyShort, L_BIRTHDAY: t.birthday,
    SUN_SIGN: signName(P.sun.sign, lang), MOON_SIGN: signName(P.moon.sign, lang), ASC_SIGN: signName(P.ascendant.sign, lang),
    NN_SIGN: signName(P.northNode.sign, lang), ZN_SIGN: signName(P.southNode.sign, lang), CHIRON_SIGN: signName(P.chiron.sign, lang),
    SUN_HOUSE: String(P.sun.house || ''), MOON_HOUSE: String(P.moon.house || ''),
    NN_HOUSE: String(P.northNode.house || ''), ZN_HOUSE: String(P.southNode.house || ''), CHIRON_HOUSE: String(P.chiron.house || ''),
    NN_DEG: `${P.northNode.deg}°${String(P.northNode.min).padStart(2, '0')}'`,
    SUN_POS: posLang(P.sun, lang), MOON_POS: posLang(P.moon, lang), ASC_POS: posLang(P.ascendant, lang),
    LIFE_PATH: String(num.lifePath), PERSONAL_YEAR: String(num.personalYear), BIRTHDAY_NUM: String(num.birthday),
    CAL_RANGE: calRange(num.personalMonths, lang),
    MANDALA_SVG: generateMandalaSVG(chart, { lang, clientName: intake.clientName, year }),

    // AI-tekstvelden (beperkte HTML of platte tekst)
    AI_HERO_CORE: limitedHTML(ai.hero.core),
    AI_HERO_PATTERNS: limitedHTML(ai.hero.patterns),
    AI_HERO_ALIGN_ASTRO: limitedHTML(ai.hero.alignAstro),
    AI_HERO_ALIGN_SOUL: limitedHTML(ai.hero.alignSoul),
    AI_HERO_ALIGN_YEAR: limitedHTML(ai.hero.alignYear),
    AI_DASH_CLOSING: limitedHTML(ai.dashboard.closing),
    AI_INTRO_QUOTE: limitedHTML(ai.introQuote),
    AI_INTRODUCTION_BODY: limitedHTML(ai.introduction),
    AI_FLOW_BODY: limitedHTML(ai.flow.body),
    AI_ASTRO_PATTERNS: limitedHTML(ai.astrology.patterns),
    AI_NODES_BODY: limitedHTML(ai.nodes.body),
    AI_NODES_SOUTH: limitedHTML(ai.nodes.south),
    AI_NODES_NORTH: limitedHTML(ai.nodes.north),
    AI_NODES_CHIRON: limitedHTML(ai.nodes.chiron),
    AI_LIFEPATH_TITLE: limitedHTML(ai.numerology.lifePathTitle),
    AI_LIFEPATH_BODY: limitedHTML(ai.numerology.lifePathBody),
    AI_PY_BODY: limitedHTML(ai.numerology.pyBody),
    AI_CYCLE_TITLE: limitedHTML(ai.numerology.cycleTitle),
    AI_CYCLE_BODY: limitedHTML(ai.numerology.cycleBody),
    AI_TIKKUN_RETRO_TITLE: limitedHTML(ai.tikkun.retroTitle),
    AI_TIKKUN_RETRO_BODY: limitedHTML(ai.tikkun.retroBody),
    AI_SUMMARY_ONELINER: limitedHTML(ai.summary.oneLiner),
    AI_ENERGY_RHYTHM: limitedHTML(ai.energy.rhythm),
    AI_LAYERS_ASTRO: limitedHTML(ai.integration.layers.astro),
    AI_LAYERS_NUM: limitedHTML(ai.integration.layers.num),
    AI_LAYERS_SOUL: limitedHTML(ai.integration.layers.soul),
    AI_LAYERS_YEAR: limitedHTML(ai.integration.layers.year),
    AI_LAYERS_FOCUS: limitedHTML(ai.integration.layers.focus),
    AI_SHADOW_BODY: limitedHTML(ai.integration.shadow),
    AI_BREATH_BODY: limitedHTML(ai.integration.breath),
    AI_CLOSING_BODY: limitedHTML(ai.closing),

    // Samengestelde componenten
    SCORE_CARDS: buildScoreCards(ai, labels, t),
    PLANET_TABLE_ROWS: buildPlanetRows(P, ai, t, lang),
    FLOW_GRID: buildNGrid(t.flowLbls.map((lbl, i) => ({ lbl, val: ai.flow.grid[i]?.val, desc: ai.flow.grid[i]?.desc }))),
    FLOW_QUESTIONS: buildQuestions(ai.flow.questions),
    ASTRO_CARDS: (ai.astrology.cards || []).map(c => ncard(c.label, c.title, c.body)).join('\n    '),
    CORE_NUMBERS_GRID: buildCoreNumbers(num, ai, t, year),
    TIKKUN_CARDS: buildTikkunCards(ai, t),
    SUMMARY_ROWS: buildSummaryRows(P, num, ai, t, lang, year),
    REFLECTION_QUESTIONS: buildQuestions(ai.reflection.questions),
    ENERGY_GRID: buildNGrid(t.energyLbls.map((lbl, i) => ({ lbl, val: ai.energy.grid[i]?.val, desc: ai.energy.grid[i]?.desc }))),
    ELEMENT_CARDS: (ai.energy.elements || []).map(c => ncard(c.label, c.title, c.body)).join('\n    '),
    GIFT_CARDS: buildGiftCards(ai, t),
    PRACTICES: buildPractices(ai, t),
    PROMPT_CARDS: buildPrompts(ai, t),
    CALENDAR_MONTHS: buildCalendar(num.personalMonths, t, lang),
  };

  html = html.replace(/{{([A-Z0-9_]+)}}/g, (m, key) => (key in tokens ? tokens[key] : m));
  return html;
}

function calRange(months, lang) {
  const m = MONTHS[lang] || MONTHS.nl;
  const first = months[0], last = months[months.length - 1];
  const f = m[first.month - 1], l = m[last.month - 1];
  return lang === 'en'
    ? `${f} ${first.year !== last.year ? first.year + ' ' : ''}${L.en.to} ${l} ${last.year}`
    : `${f}${first.year !== last.year ? ' ' + first.year : ''} ${L.nl.to} ${l} ${last.year}`;
}

function buildScoreCards(ai, labels, t) {
  const lbls = [labels.astro, labels.num, labels.soul, labels.py];
  return (ai.dashboard.cards || []).slice(0, 4).map((c, i) => `
    <div class="scard">
      <div class="scard-pct" style="font-size:20px;letter-spacing:.02em">${esc(lbls[i])}</div>
      <div class="scard-title">${t.scardTitles[i]}</div>
      <div class="scard-body">${limitedHTML(c.body)}</div>
      <div class="scard-moves">${t.movesVia}</div>
      <div class="scard-with">${limitedHTML(c.via)}</div>
    </div>`).join('');
}

function buildPlanetRows(P, ai, t, lang) {
  const order = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto','northNode','chiron'];
  return order.map(key => {
    const p = P[key];
    if (!p || p.sign === '?') return '';
    const rx = p.retrograde ? ' <span class="rx">Rx</span>' : '';
    const quality = limitedHTML((ai.astrology.qualities || {})[key] || '');
    return `\n      <tr><td>${PLANET_SYMBOLS[key]} ${t.planetNames[key]}${rx}</td><td>${posLang(p, lang)}</td><td>${p.house || ''}</td><td>${quality}</td></tr>`;
  }).join('');
}

function buildNGrid(cells) {
  return cells.map(c => `
    <div class="ncell"><div class="nlbl">${c.lbl}</div><div class="nval">${limitedHTML(c.val)}</div><div class="ndesc">${limitedHTML(c.desc)}</div></div>`).join('');
}

function buildQuestions(questions) {
  return (questions || []).map((q, i) => `
    <li><span class="q-num">${i + 1}</span>${limitedHTML(q)}</li>`).join('');
}

function ncard(label, title, body) {
  return `<div class="ncard">
      <div class="ncard-lbl">${limitedHTML(label)}</div>
      ${title ? `<h3>${limitedHTML(title)}</h3>\n      ` : ''}<p>${limitedHTML(body)}</p>
    </div>`;
}

function buildCoreNumbers(num, ai, t, year) {
  const nn = ai.numerology.nameNumbers || {};
  // De uitleg-strings uit numerology.js zijn Nederlands; voor EN de woorden vertalen
  const en = t === L.en;
  const bd = (s) => en ? String(s).replace(/\bdag\b/g, 'day').replace(/\bmaand\b/g, 'month').replace(/\bjaar\b/g, 'year') : s;
  const cells = [
    { lbl: t.coreLbls.lifePath, val: num.lifePath, desc: bd(num.breakdowns.lifePath) },
    { lbl: `${t.coreLbls.py} ${year}`, val: num.personalYear, desc: bd(num.breakdowns.personalYear) },
    { lbl: t.coreLbls.birthday, val: num.birthday, desc: bd(num.breakdowns.birthday) },
    { lbl: t.coreLbls.expression, val: num.expression, desc: nn.expression },
    { lbl: t.coreLbls.soulUrge, val: num.soulUrge, desc: nn.soulUrge },
    { lbl: t.coreLbls.personality, val: num.personality, desc: nn.personality },
  ];
  return cells.map(c => `
    <div class="ncell"><div class="nlbl">${c.lbl}</div><div class="nval">${esc(c.val)}</div><div class="ndesc">${limitedHTML(c.desc)}</div></div>`).join('');
}

function buildTikkunCards(ai, t) {
  const cards = ai.tikkun.cards || [];
  return cards.slice(0, 3).map((c, i) => `<div class="ncard-wrap"><div class="ncard">
    <div class="ncard-lbl">${t.tikkunLbls[i]}</div>
    ${c.title ? `<h3>${limitedHTML(c.title)}</h3>\n    ` : ''}<p>${limitedHTML(c.body)}</p>
  </div></div>`).join('\n  ');
}

function buildSummaryRows(P, num, ai, t, lang, year) {
  const subs = [
    `${t.sun} ${signName(P.sun.sign, lang)} H${P.sun.house || ''}`,
    `${t.moon} ${signName(P.moon.sign, lang)} H${P.moon.house || ''}`,
    `NN ${signName(P.northNode.sign, lang)} H${P.northNode.house || ''}`,
    `${t.lifePath} ${num.lifePath} / PJ ${num.personalYear}`,
    limitedHTML(ai.summary.tikkunSub),
    `ZN ${signName(P.southNode.sign, lang)} H${P.southNode.house || ''}`,
  ];
  return (ai.summary.rows || []).slice(0, 6).map((body, i) => `
      <tr><td><strong>${t.summaryLbls[i]}</strong><br>${subs[i]}</td><td>${limitedHTML(body)}</td></tr>`).join('');
}

function buildGiftCards(ai, t) {
  return (ai.integration.gifts || []).slice(0, 6).map((body, i) => `
    <div class="gift-card"><div class="gift-num">${t.gift} 0${i + 1}</div><div class="gift-title">${t.giftTitles[i]}</div><div class="gift-body">${limitedHTML(body)}</div></div>`).join('');
}

function buildPractices(ai, t) {
  return (ai.integration.practices || []).slice(0, 6).map((p, i) => `
  <div class="practice"><div class="practice-num">${t.practice} 0${i + 1}</div><div class="practice-title">${limitedHTML(p.title)}</div><div class="practice-body">${limitedHTML(p.body)}</div></div>`).join('');
}

function buildPrompts(ai, t) {
  return (ai.integration.prompts || []).slice(0, 6).map((p, i) => `
  <div class="prompt"><div class="plbl">${t.prompt} 0${i + 1} — ${limitedHTML(p.label)}</div><p>${limitedHTML(p.text)}</p><button class="copy-btn" onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent)">${t.copy}</button></div>`).join('');
}

function buildCalendar(personalMonths, t, lang) {
  const monthNames = MONTHS[lang] || MONTHS.nl;
  const texts = CAL_TEXTS[lang] || CAL_TEXTS.nl;
  return (personalMonths || []).map(m => {
    const info = texts[m.number] || texts[9];
    const color = CAL_COLORS[m.number] || '#A67C3A';
    const monthName = monthNames[m.month - 1];
    const nameCap = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    const master = (m.number === 11 || m.number === 22) ? ` — ${t.masterMonth}` : '';
    return `
    <div class="cal-month"><div class="cal-month-name">${nameCap} ${m.year}</div><div class="cal-month-num" style="color:${color}">${m.number}</div><div class="cal-month-theme">${info.theme}</div><div class="cal-pm">${t.personalMonth} ${m.number}${master}</div><div class="cal-body">${info.body}</div><ul class="cal-bullets">${info.bullets.map(b => `<li>${b}</li>`).join('')}</ul></div>`;
  }).join('');
}

module.exports = { renderBlueprint, scoreLabels, limitedHTML };

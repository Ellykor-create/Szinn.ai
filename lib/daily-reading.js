'use strict';
// Dagduiding: één persoonlijke reading per gebruiker per dag, opgebouwd uit de
// geboortekaart, de échte transits van vandaag (lib/astro) en de persoonlijke
// getallen. Gedeeld door het dashboard (api.js) en de 12:00-reminder
// (daily-whatsapp.js), zodat appje/mail en dagkaart dezelfde tekst tonen.
// De reading wordt per dag gecachet op user.dayReading ({ date, lang, data }).

const { buildContext } = require('./pipeline');
const { calcPersonalMonths, calcPersonalDay, DAY_INFO } = require('./numerology');
const { currentSky, dailyTransits } = require('./astro');
const { companionChat, companionConfigured } = require('./companion-llm');

// ── Engelse vertalingen voor de companion (labels + dagduiding) ───────────────
const SIGN_EN = {
  Ram: 'Aries', Stier: 'Taurus', Tweelingen: 'Gemini', Kreeft: 'Cancer',
  Leeuw: 'Leo', Maagd: 'Virgo', Weegschaal: 'Libra', Schorpioen: 'Scorpio',
  Boogschutter: 'Sagittarius', Steenbok: 'Capricorn', Waterman: 'Aquarius', Vissen: 'Pisces',
};
const signT = (lang, s) => (lang === 'en' ? (SIGN_EN[s] || s) : s);
const DAY_INFO_EN = {
  1: 'Day 1 carries a new beginning. Take the initiative yourself today.',
  2: 'Day 2 asks for patience and cooperation. Listen and attune.',
  3: 'Day 3 carries expression and joy. Share what lives inside you.',
  4: 'Day 4 carries ground and structure. Build, organise, finish.',
  5: 'Day 5 brings movement and change. Leave room for the unexpected.',
  6: 'Day 6 is about care and harmony. Give attention to your people and your home.',
  7: 'Day 7 asks for depth and stillness. Turn inward for a moment.',
  8: 'Day 8 carries decisiveness and form. Act, complete.',
  9: 'Day 9 closes. Let go of what is finished and be gentle.',
  11: 'Master day 11: heightened intuition. Follow your feeling before you reason it away.',
  22: 'Master day 22: build concretely on your greatest vision today.',
};
const PY_INFO_EN = {
  1: { theme: 'New beginning',        energy: 'sowing, starting, choosing direction, taking initiative' },
  2: { theme: 'Cooperation',          energy: 'patience, deepening relationships, listening, receiving' },
  3: { theme: 'Expression & Joy',     energy: 'creativity, visibility, communicating, playing' },
  4: { theme: 'Building & Structure', energy: 'hard work, laying foundations, discipline, order' },
  5: { theme: 'Change',               energy: 'freedom, movement, new experiences, letting go' },
  6: { theme: 'Responsibility',       energy: 'home, care, balance, relationships, being of service' },
  7: { theme: 'Inner year',           energy: 'reflection, study, rest, spiritual deepening' },
  8: { theme: 'Harvest & Power',      energy: 'material matters, business, reaping results, leadership' },
  9: { theme: 'Completion & Release', energy: 'rounding off, forgiving, making room for the new' },
};
const LP_INFO_EN = {
  1:  { name: 'Leader & Pioneer',        challenge: 'self-centredness' },
  2:  { name: 'Mediator & Partner',      challenge: 'dependency' },
  3:  { name: 'Creative Expresser',      challenge: 'scattering' },
  4:  { name: 'Builder & Organiser',     challenge: 'rigidity' },
  5:  { name: 'Freedom Seeker',          challenge: 'impatience' },
  6:  { name: 'Caregiver & Guardian',    challenge: 'perfectionism' },
  7:  { name: 'Seeker & Philosopher',    challenge: 'isolation' },
  8:  { name: 'Material Master',         challenge: 'materialism' },
  9:  { name: 'Humanitarian & Completer', challenge: 'difficulty letting go' },
  11: { name: 'Spiritual Lightbringer', challenge: 'sensitivity' },
  22: { name: 'Master Builder',          challenge: 'perfectionism' },
  33: { name: 'Master Teacher',          challenge: 'self-sacrifice' },
};
// Levensgebied per huis, voor de vangnet-duiding zonder AI.
const HOUSE_AREA = {
  nl: ['', 'jezelf en hoe je binnenkomt', 'geld, eigenwaarde en wat je bezit', 'praten, leren en je directe omgeving',
    'thuis, familie en je basis', 'plezier, creativiteit en liefde', 'werk, gezondheid en je dagelijkse ritme',
    'relaties en samenwerking', 'diepgang, intimiteit en wat je deelt', 'de grote vragen en je horizon',
    'je roeping en hoe je gezien wordt', 'vrienden, groepen en je toekomstdromen', 'rust, stilte en je binnenwereld'],
  en: ['', 'yourself and how you show up', 'money, self-worth and what you own', 'talking, learning and your surroundings',
    'home, family and your foundation', 'joy, creativity and love', 'work, health and your daily rhythm',
    'relationships and partnership', 'depth, intimacy and what you share', 'the big questions and your horizon',
    'your calling and how you are seen', 'friends, groups and your hopes', 'rest, silence and your inner world'],
};

// Datum in Amsterdam (YYYY-MM-DD): de dag van de klant, niet die van de server.
const amsterdamDate = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(d);

// Alles wat de dagduiding en de companion nodig hebben voor één voltooide
// order: kaart/getallen (laag 1), teksten (laag 2), de lucht en transits van nu.
function dayContext(order, textsAll, langOverride, now = new Date()) {
  const lang = langOverride === 'en' ? 'en'
    : langOverride === 'nl' ? 'nl'
    : (order.blueprint_language === 'en' ? 'en' : 'nl');
  const texts = textsAll ? (textsAll[lang] || textsAll.nl) : null;

  const ctx = buildContext(order);
  const pm = calcPersonalMonths(order.birth_date, now, 1)[0];
  const pd = calcPersonalDay(pm.number, now.getDate());
  const sky = currentSky(now);
  const transits = dailyTransits(ctx.chart, now);

  const [, bm, bd] = order.birth_date.split('-').map(Number);
  let solar = new Date(now.getFullYear(), bm - 1, bd);
  if (solar < now) solar = new Date(now.getFullYear() + 1, bm - 1, bd);

  return { order, ctx, texts, lang, now, pm, pd, sky, transits, solar, dayInfo: DAY_INFO };
}

// Deterministische dagduiding uit de berekeningen en blueprint-teksten. Dient
// als vangnet wanneer de AI (tijdelijk) niet beschikbaar is; thema en focus
// volgen de transit-maan en de persoonlijke dag, zodat ook dit elke dag wisselt.
function dayFromBlueprint(c) {
  const t = c.texts || {};
  const en = c.lang === 'en';
  const dayIdx = Math.floor(c.now.getTime() / 86400000);
  const questions = (t.reflection && t.reflection.questions) || [];
  const giftNames = en
    ? ['intuition', 'imagination', 'memory', 'reasoning', 'perception', 'willpower']
    : ['intuïtie', 'verbeeldingskracht', 'geheugen', 'redeneren', 'waarneming', 'wilskracht'];
  const g1 = giftNames[dayIdx % 6], g2 = giftNames[(dayIdx + 2) % 6];
  const natalMoon = c.ctx.chart.planets.moon;
  const py = c.ctx.numerology.personalYear;
  const moonSign = signT(c.lang, c.sky.moonSign || c.sky.moon.sign);
  const moonHouse = c.transits && c.transits.positions.moon && c.transits.positions.moon.house;
  const area = moonHouse ? HOUSE_AREA[en ? 'en' : 'nl'][moonHouse] : null;
  const pyInfo = en ? (PY_INFO_EN[py] || PY_INFO_EN[9]) : c.ctx.numerology.personalYearInfo;
  const dayText = en ? (DAY_INFO_EN[c.pd] || DAY_INFO_EN[9]) : (c.dayInfo[c.pd] || c.dayInfo[9]);
  if (en) return {
    thema: area ? `The moon in ${moonSign} lights up ${area} today` : `The moon in ${moonSign} sets today's tone`,
    focus: dayText,
    vraag: questions.length ? questions[dayIdx % questions.length] : 'What asks for your attention today?',
    lucht: `The moon is in ${moonSign} today, ${c.sky.waxing ? 'waxing' : 'waning'}. Your own moon is in ${signT('en', natalMoon.sign)}: use today's energy without losing your own foundation.`,
    numFocus: dayText,
    numReminder: `Year ${py} asks for ${pyInfo.theme.toLowerCase()}: ${pyInfo.energy.toLowerCase()}.`,
    gaven: `Today ${g1} and ${g2} light up. Lean consciously on these two capacities.`,
  };
  return {
    thema: area ? `De maan in ${moonSign} licht vandaag ${area} op` : `De maan in ${moonSign} zet vandaag de toon`,
    focus: dayText,
    vraag: questions.length ? questions[dayIdx % questions.length] : 'Wat vraagt vandaag om jouw aandacht?',
    lucht: `De maan staat vandaag in ${moonSign}, ${c.sky.waxing ? 'wassend' : 'afnemend'}. Jouw eigen maan staat in ${natalMoon.sign}: gebruik de energie van vandaag zonder je eigen basis te verliezen.`,
    numFocus: dayText,
    numReminder: `Jaar ${py} vraagt om ${(c.ctx.numerology.personalYearInfo.theme || '').toLowerCase()}: ${(c.ctx.numerology.personalYearInfo.energy || '').toLowerCase()}.`,
    gaven: `Vandaag lichten ${g1} en ${g2} op. Leun bewust op deze twee vermogens.`,
  };
}

function companionSystem(c) {
  const P = c.ctx.chart.planets;
  const n = c.ctx.numerology;
  const line = (p) => `${p.sign} ${p.deg}°${String(p.min).padStart(2, '0')}'${p.house ? ` (Huis ${p.house})` : ''}`;
  return `Je bent de SZINN Companion, de ingebouwde begeleider in het dagelijkse dashboard van ${c.ctx.intake.clientName}.
Toon: warm, gegrond, helder, nooit zweverig, geen new-age clichés. Spreek aan met jij/jouw, nooit u. Geen voorspellingen, geen medische, psychologische of financiële claims. Je bent een spiegel, geen orakel. ${c.ctx.intake.clientName} is altijd de enige expert over zichzelf.
Je REKENT NOOIT zelf astrologie of numerologie. Gebruik uitsluitend deze vaste, geverifieerde gegevens en verzin niets nieuws:
Zon ${line(P.sun)}; Maan ${line(P.moon)}; Ascendant ${line(P.ascendant)}; Noordknoop ${line(P.northNode)}; Zuidknoop ${line(P.southNode)}; Chiron ${line(P.chiron)}.
Levenspad ${n.lifePath}; Persoonlijk Jaar ${n.personalYear} (${n.personalYearInfo.theme}); Persoonlijke Maand ${c.pm.number}; Persoonlijke Dag ${c.pd}.
Vandaag: maan in ${c.sky.moon.sign}, ${c.sky.waxing ? 'wassend' : 'afnemend'}. Datum: ${c.now.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.${c.texts && c.texts.summary && c.texts.summary.oneLiner ? `\nKern van de blueprint: ${c.texts.summary.oneLiner}` : ''}${c.lang === 'en' ? '\nIMPORTANT: The user uses the English dashboard. Reply entirely in English (use English zodiac sign names), while keeping the same warm, grounded tone.' : ''}`;
}

// De berekende transits van vandaag als vaste gegevens voor de prompt.
function transitLines(c) {
  const en = c.lang === 'en';
  const natal = c.ctx.chart.planets;
  const T = c.transits;
  const pos = ['sun', 'moon', 'mercury', 'venus', 'mars'].filter(k => T.positions[k]).map(k => {
    const p = T.positions[k];
    return en
      ? `${k} in ${p.signEn}${p.house ? ` (your house ${p.house})` : ''}`
      : `${natal[k] ? natal[k].name : k} in ${p.sign}${p.house ? ` (jouw huis ${p.house})` : ''}`;
  }).join('; ');
  const hits = T.hits.map(h => en
    ? `- transiting ${h.transit} ${h.typeEn} natal ${h.target} (orb ${h.orb}°)`
    : `- transit-${h.transitName} ${h.type} geboorte-${natal[h.target] ? natal[h.target].name : h.target} (orb ${h.orb}°)`).join('\n');
  return en
    ? `Today's sky (calculated): ${pos}.\nToday's transits to the natal chart, tightest first:\n${hits || '- none within orb'}`
    : `De lucht van vandaag (berekend): ${pos}.\nTransits van vandaag op de geboortekaart, strakste eerst:\n${hits || '- geen binnen orb'}`;
}

const READING_SCHEMA = (() => {
  const str = { type: 'string' };
  return {
    type: 'object', additionalProperties: false,
    properties: { thema: str, focus: str, vraag: str, lucht: str, numFocus: str, numReminder: str, gaven: str },
    required: ['thema', 'focus', 'vraag', 'lucht', 'numFocus', 'numReminder', 'gaven'],
  };
})();

async function aiDayReading(c) {
  const date = c.now.toLocaleDateString(c.lang === 'en' ? 'en-GB' : 'nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' });
  const userPrompt = c.lang === 'en'
    ? `Write the personal daily reading for ${date} in ENGLISH. It must be about THIS day: build it from today's transits below on this person's natal chart, plus Personal Day ${c.pd}. Do not repeat the general blueprint summary; tomorrow's reading must read differently. Never calculate positions yourself; use only these fixed data.
${transitLines(c)}
Fields: thema (what today is about for this person, max 14 words, one sentence), focus (one concrete small step for today, max 16 words), vraag (one reflection question fitting today's transits), lucht (2-3 sentences explaining the tightest transits of today in plain language, linked to the natal chart), numFocus (1 sentence for Personal Day ${c.pd}), numReminder (1 sentence for Personal Year ${c.ctx.numerology.personalYear}), gaven (1 sentence: which 2 of the six gifts light up today and why).`
    : `Schrijf de persoonlijke dagduiding voor ${date}. Die moet over DEZE dag gaan: bouw hem op uit de transits van vandaag hieronder op de geboortekaart van deze persoon, plus Persoonlijke Dag ${c.pd}. Herhaal niet de algemene blueprint-samenvatting; morgen moet de duiding anders lezen. Bereken nooit zelf standen; gebruik alleen deze vaste gegevens.
${transitLines(c)}
Velden: thema (waar vandaag voor deze persoon om draait, max 14 woorden, één zin), focus (één concrete kleine stap voor vandaag, max 16 woorden), vraag (één reflectievraag die past bij de transits van vandaag), lucht (2-3 zinnen die de strakste transits van vandaag in gewone taal uitleggen, gekoppeld aan de geboortekaart), numFocus (1 zin bij Persoonlijke Dag ${c.pd}), numReminder (1 zin bij Persoonlijk Jaar ${c.ctx.numerology.personalYear}), gaven (1 zin: welke 2 van de zes gaven vandaag oplichten en waarom).`;
  return companionChat({
    system: companionSystem(c),
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 800,
    jsonSchema: READING_SCHEMA,
  });
}

// De reading van vandaag voor deze gebruiker: uit de cache op user.dayReading,
// anders nieuw gemaakt en op `user` gezet (de aanroeper slaat de DB op als
// `fresh`). Bij een AI-fout of zonder sleutel het vangnet, niet gecachet, zodat
// een volgende aanroep het opnieuw probeert.
async function todaysReading(user, c) {
  const date = amsterdamDate(c.now);
  const cached = user && user.dayReading;
  if (cached && cached.date === date && cached.lang === c.lang) return { reading: cached.data, source: 'ai', fresh: false };
  if (!companionConfigured()) return { reading: dayFromBlueprint(c), source: 'blueprint', fresh: false };
  try {
    const reading = await aiDayReading(c);
    if (user) user.dayReading = { date, lang: c.lang, data: reading };
    return { reading, source: 'ai', fresh: !!user };
  } catch (err) {
    console.error('dagduiding AI-fout:', err.message);
    return { reading: dayFromBlueprint(c), source: 'blueprint', fresh: false };
  }
}

module.exports = {
  SIGN_EN, signT, DAY_INFO_EN, PY_INFO_EN, LP_INFO_EN,
  amsterdamDate, dayContext, dayFromBlueprint, companionSystem, todaysReading,
};

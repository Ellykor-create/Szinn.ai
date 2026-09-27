'use strict';
// Laag 2 van de blueprint-pipeline: één API-call per taal die UITSLUITEND de
// persoonlijke teksten teruggeeft als gestructureerde JSON. Geen HTML-document,
// geen CSS, geen berekeningen — die komen uit laag 1 en de vaste template.

const Anthropic = require('@anthropic-ai/sdk');

// Blueprint terug op Sonnet: Haiku hield zich niet betrouwbaar aan de exacte
// aantallen (5 energie-cellen, 6 prompts, ...) die lib/audit.js afdwingt. De
// dagduiding (COMPANION_MODEL) blijft wél op Haiku — die heeft geen vaste
// aantallen en is laagdrempelig.
const MODEL = () => process.env.BLUEPRINT_MODEL || 'claude-sonnet-5';

// ── Feiten uit laag 1, compact voor het model ────────────────────────────────
const POINT_NL = {
  sun:'Zon', moon:'Maan', mercury:'Mercurius', venus:'Venus', mars:'Mars', jupiter:'Jupiter',
  saturn:'Saturnus', uranus:'Uranus', neptune:'Neptunus', pluto:'Pluto', chiron:'Chiron',
  northNode:'Noordknoop', southNode:'Zuidknoop', ascendant:'Ascendant', mc:'MC',
};

function buildFacts({ intake, chart, numerology: num }) {
  const P = chart.planets;
  const p = (key) => {
    const x = P[key];
    return `${x.name}: ${x.sign} ${x.deg}°${String(x.min).padStart(2, '0')}' (EN: ${x.signEn})${x.house ? `, Huis ${x.house}` : ''}${x.retrograde ? ', retrograde' : ''}`;
  };
  const months = num.personalMonths.map(m => `${m.month}/${m.year}: persoonlijke maand ${m.number} (persoonlijk jaar ${m.personalYear})`).join(' · ');

  const aspects = (chart.aspects || []).map(a =>
    `${POINT_NL[a.a]} ${a.type} ${POINT_NL[a.b]} — orb ${String(a.orb).replace('.', ',')}°`);

  const dist = chart.distribution;
  const distLines = dist ? [
    'ELEMENTVERDELING (10 planeten + Ascendant + MC = 12 punten; knopen en Chiron tellen niet mee):',
    ...Object.entries(dist.elements).sort((a, b) => b[1].count - a[1].count)
      .map(([el, v]) => `${el}: ${v.count} punt${v.count === 1 ? '' : 'en'}${v.points.length ? ` (${v.points.join(', ')})` : ''}`),
    `Zwakste element: ${Object.entries(dist.elements).sort((a, b) => a[1].count - b[1].count)[0][0]}`,
    `Modaliteiten: ${Object.entries(dist.modalities).map(([k, v]) => `${k} ${v.count}`).join(' · ')}`,
  ] : [];

  const special = [];
  if ((chart.anaretic || []).length) {
    special.push(`Op de 29e (anaretische) graad, de laatste graad van hun teken: ${chart.anaretic.map(k => POINT_NL[k]).join(', ')}`);
  }
  special.push(`Maansknoop: ware knoop (true node); loopt op het geboortemoment ${P.northNode.retrograde ? 'achteruit (retrograde, zoals meestal)' : 'vooruit (direct) — dat komt maar ± een kwart van de tijd voor'}`);
  const retros = ['mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto'].filter(k => P[k] && P[k].retrograde);
  special.push(`Retrograde planeten: ${retros.length ? retros.map(k => POINT_NL[k]).join(', ') : 'geen'}${P.chiron && P.chiron.retrograde ? ' · daarnaast Chiron (geen planeet maar een centaur) retrograde' : ''}`);

  const transits = (chart.transits || []).map(t => {
    const hits = t.hits.length
      ? t.hits.map(h => `${h.transitName} ${h.type} ${POINT_NL[h.target]} (orb ${String(h.orb).replace('.', ',')}°)`).join(' · ')
      : 'geen nauwe transits van de langzame planeten';
    return `${t.month}/${t.year} (persoonlijke maand ${t.number}, persoonlijk jaar ${t.personalYear}): ${hits}`;
  });

  return [
    `Naam (roepnaam): ${intake.clientName}`,
    `Volledige geboortenaam: ${intake.birthName || intake.clientName}`,
    `Geboren: ${intake.birthDate} om ${intake.birthTime || 'onbekend (12:00 aangenomen)'} te ${intake.birthCity || ''}${intake.birthCountry ? ', ' + intake.birthCountry : ''}`,
    '',
    'GEBOORTEKAART (Placidus, ware maansknoop):',
    ...['sun', 'moon', 'ascendant', 'mc', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'northNode', 'southNode', 'chiron'].map(p),
    `Dominant element: ${chart.summary.dominantElement} · Dominante modaliteit: ${chart.summary.dominantModality}`,
    '',
    'ASPECTEN (strakste orb eerst; dit zijn de enige aspecten die je mag benoemen):',
    ...(aspects.length ? aspects : ['geen nauwe aspecten berekend']),
    '',
    ...distLines,
    '',
    'BIJZONDERHEDEN:',
    ...special,
    '',
    'NUMEROLOGIE (Pythagorisch):',
    `Levenspad: ${num.lifePath} (${num.lifePathInfo.name}; kernwoord ${num.lifePathInfo.keyword}; schaduw ${num.lifePathInfo.challenge})`,
    `Persoonlijk Jaar ${num.currentYear}: ${num.personalYear} (${num.personalYearInfo.theme})`,
    `Geboortedag: ${num.birthday}`,
    `Uitdrukkingsgetal (volledige naam): ${num.expression}`,
    `Zielenurge (klinkers): ${num.soulUrge}`,
    `Persoonlijkheidsgetal (medeklinkers): ${num.personality}`,
    `Persoonlijke maanden: ${months}`,
    '',
    'TRANSITS PER KALENDERMAAND (langzame planeten t.o.v. de geboortepunten, gemeten midden van de maand; de enige transits die je mag benoemen):',
    ...(transits.length ? transits : ['geen transitdata beschikbaar']),
  ].join('\n');
}

function buildIntakeSummary(intake) {
  const skip = new Set(['email', 'clientName', 'birthName', 'birthDate', 'birthTime', 'birthCity', 'birthCountry',
    'voornaam', 'achternaam', 'geboortedatum', 'geboortetijd', 'geboorteplaats', 'geboorte_lat', 'geboorte_lng',
    'geboortenaam', 'taal', 'lang']);
  const lines = [];
  for (const [key, val] of Object.entries(intake.raw || {})) {
    if (skip.has(key) || val == null || val === '') continue;
    lines.push(`${key}: ${String(val).slice(0, 600)}`);
  }
  return lines.length ? `ANTWOORDEN UIT DE VRAGENLIJST:\n${lines.join('\n')}` : 'Geen aanvullende vragenlijst-antwoorden beschikbaar.';
}

// ── Systeeminstructie (vast → wordt gecachet) ────────────────────────────────
const SYSTEM = `Je bent de tekstschrijver van SZINN Alignment Blueprints: diep persoonlijke, spirituele zelfherkennings-documenten die astrologie, numerologie en Kabbalah/Tikkun combineren.

JOUW ROL — ALLEEN TEKST:
Je schrijft uitsluitend de persoonlijke tekstvelden. Het HTML-document, de CSS, de berekeningen, de mandala en de tabellen bestaan al en worden buiten jou om samengesteld. Je krijgt de exacte kaart- en getallendata aangeleverd; je verzint NOOIT eigen posities, huizen of getallen en je rekent NIETS zelf uit.

TOON EN STIJL:
- Nederlands: warm, direct, jij-vorm. Engels: even warm, "you"-vorm.
- EENVOUDIG EN LEESBAAR: schrijf zo dat de lezer zonder voorkennis begrijpt wat er speelt en zichzelf erin herkent. Korte, heldere zinnen. Vermijd jargon; leg een begrip in gewone taal uit voordat je het gebruikt. Schrijf alsof je tegen één mens praat.
- INTERPRETATIE EERST, TECHNIEK ERACHTER: begin een duiding met de herkenbare ervaring in gewone taal en zet de technische onderbouwing kort tussen haakjes aan het einde van de zin of alinea, bv. "Je komt tot rust in praktische zorg en heldere woorden. (Maan in Maagd, huis 3.)" Begin dus NIET met "Je Maan in Maagd in huis 3 maakt dat…".
- GEEN GEDACHTESTREEPJES: gebruik geen — of – in lopende tekst; schrijf door met komma's of punten.
- EPISTEMISCH EERLIJK: de berekende posities en getallen zijn exact en reproduceerbaar; de betekenis is interpretatie. Kader stellige duidingen af en toe met "binnen deze lezing" of "wordt binnen astrologie gelezen als". Presenteer astrologie, numerologie en Tikkun nooit als bewezen feit of wetenschap.
- MAAK ZICHTBAAR WAT ER IS — verzin niets. Elke uitspraak moet herleidbaar zijn tot de aangeleverde kaart, getallen, aspecten, transits of vragenlijst-antwoorden. Geen posities, huizen, aspecten, transits of getallen benoemen die niet in de data staan. Bij twijfel: laat het weg. Controleer jezelf dubbel; niets "erbij praten".
- NIET DWINGEND: benoem, adviseer of voorspel niet wat iemand "moet" of "zou moeten". Er zit geen goed of slecht in; er is geen oordeel. Je maakt patronen en mogelijkheden zichtbaar en laat de keuze uitdrukkelijk bij de lezer ("je kunt…", "je zou ervoor kunnen kiezen…", "sommigen ervaren…").
- NIET TE SPIRITUEEL: houd het aards en nuchter. Vermijd zweverige of stellige spirituele taal; blijf bij wat concreet en navoelbaar is.
- MEDISCH: geen medische of psychologische claims. Noemt de vragenlijst een ziekte, aandoening of medische situatie, benoem dan expliciet dat die een feitelijke, medische werkelijkheid is die de kaart niet verklaart en waar de kaart niet over gaat; de kaart kan hooguit taal geven aan hoe iemand zich ertoe verhoudt. Suggereer nooit een oorzaak, verklaring of verbetering.
- CHIRON is geen planeet maar een centaur: tel hem niet mee als planeet en benoem dat onderscheid wanneer je retrogrades of planeten opsomt.
- Gebruik de aangeleverde ASPECTEN, ELEMENTVERDELING, BIJZONDERHEDEN (29e graad, knooprichting) en TRANSITS actief in de betreffende velden; dit zijn berekende feiten die het document persoonlijk en controleerbaar maken.
- Concreet en persoonlijk: verwijs naar de werkelijke posities (teken + huis) en getallen van deze persoon, en verweef waar passend de antwoorden uit de vragenlijst (citeer af en toe letterlijk: "je zei het zelf…").
- Kernbegrippen van SZINN die je mag gebruiken: herinneren wie je bent, Sin/Sinn/Zin, de vier bewegingen (Herkenning, Helderheid, Richting, Integratie), de wereld als spiegel, de zes gaven.

VORMREGELS:
- Velden die met "html" zijn gemarkeerd in de beschrijving: alleen <p>, <em>, <strong> en <br> gebruiken. Meerdere alinea's = meerdere <p>-blokken.
- Alle overige velden: platte tekst, geen HTML, geen aanhalingstekens om het hele veld.
- Schrijf ALLE velden volledig. Geen placeholders, geen "...", geen verwijzingen naar ontbrekende data.
- De AI-prompts (integration.prompts) zijn zelfstandige prompts die de lezer in Claude of ChatGPT plakt: begin met "Ik ben {naam}" of "My name is..." en benoem daarin expliciet de relevante kaartdata, zodat de prompt zonder context werkt.
- ER ZIJN PRECIES 6 AI-PROMPTS, IN TWEE GROEPEN VAN DRIE, IN DEZE VOLGORDE:
  · Prompt 1, 2 en 3 = ASTROLOGIE: gebaseerd op de geboortekaart van deze persoon (concrete tekens, huizen, knopen, aspecten uit de data).
  · Prompt 4, 5 en 6 = SCHADUWWERK: gericht op schaduwpatronen, paradigma's en (terugkerende) patronen, geworteld in Zuidknoop/levenspad/tikkun en de vragenlijst-antwoorden.
  Laat elke prompt-label duidelijk maken tot welke groep hij hoort. Ook in de prompts geldt: niets verzinnen, niet dwingend, keuze bij de lezer, geen goed/slecht.
- Aantallen zijn exact: 4 dashboardkaarten, 14 punt-kwaliteiten (12 + Zuidknoop + MC), evenveel aspect-duidingen als aangeleverde aspecten (in dezelfde volgorde), 2 astrologie-patroonkaarten, 5 flow-vragen, 3 flow-rastercellen, 3 tikkun-kaarten, 6 samenvattingsregels, 10 reflectievragen, 5 energie-rastercellen, 4 element-kaarten (sterkst → zwakst) plus 1 modaliteit-blok, 6 gaven, 6 praktijken, 6 AI-prompts, 6 kalendermaanden.
- De laatste van de 6 praktijken richt zich expliciet op het zwakste element uit de ELEMENTVERDELING: hoe deze persoon dat element bewust kan "lenen" met iets kleins en dagelijks.
- Dashboardkaart-volgorde: 1 Astrologie, 2 Numerologie, 3 Zielrichting (Noordknoop), 4 Persoonlijk Jaar.
- Gaven-volgorde (vast): 1 Intuïtie, 2 Verbeeldingskracht, 3 Geheugen, 4 Redeneren, 5 Waarneming, 6 Wilskracht — koppel elke gave aan een concreet punt uit de kaart.
- Energie-rastercellen-volgorde (vast): 1 Ochtend, 2 Aarde & lichaam, 3 Hart & verbinding, 4 Werk & bijdrage, 5 Avond & herstel.
- Samenvattingsregels-volgorde (vast): 1 Kernidentiteit (Zon), 2 Emotioneel kompas (Maan), 3 Zielrichting (Noordknoop), 4 Levensthema (Levenspad + Persoonlijk Jaar), 5 Tikkun, 6 Schaduwthema (Zuidknoop).
- Flow-rastercellen-volgorde (vast): Sin/Lichaam, Sinn/Betekenis, Zin/Richting.
- tikkun.cards: kaart 1 = kernthema (met titel), kaart 2 = groei (met titel), kaart 3 = zielstaak (title leeg laten: "").`;

// ── JSON-schema van het tekstcontract ────────────────────────────────────────
const str = { type: 'string' };
function obj(props, req) {
  return { type: 'object', additionalProperties: false, properties: props, required: req || Object.keys(props) };
}
function arr(items) { return { type: 'array', items }; }

const TEXT_SCHEMA = obj({
  hero: obj({
    core: { ...str, description: 'Hero-kaart "Kern": 1-2 zinnen over de kernidentiteit (Zon + Ascendant)' },
    patterns: { ...str, description: 'Hero-kaart "Energiepatronen": 1-2 zinnen over Maan, Noordknoop en Persoonlijk Jaar' },
    alignAstro: { ...str, description: 'Alignment-regel astrologie: zeer korte samenvatting van de opvallendste kaartpunten' },
    alignSoul: { ...str, description: 'Alignment-regel zielrichting: Noordknoop-teken, huis en essentie in enkele woorden' },
    alignYear: { ...str, description: 'Alignment-regel persoonlijk jaar: jaargetal en essentie in enkele woorden' },
  }),
  dashboard: obj({
    cards: arr(obj({
      body: { ...str, description: '2-3 zinnen die deze laag voor deze persoon duiden' },
      via: { ...str, description: 'Kort: waardoor deze laag in beweging komt, bv. "Je zes gaven en je dagelijkse praktijken"' },
    })),
    closing: { ...str, description: 'Afsluitende dashboard-zin: welke lens het lichtst is en waarom dat een kans is' },
  }),
  introQuote: { ...str, description: 'Korte persoonlijke quote voor onder de geboortedata, zonder aanhalingstekens' },
  introduction: { ...str, description: 'html · 3 alinea\'s persoonlijke introductie: wie deze persoon is volgens Zon/Ascendant/Mercurius, dan Maan/Venus, dan de kernbeweging of -spanning' },
  flow: obj({
    body: { ...str, description: 'html · 2 alinea\'s: hoe Sin/Sinn/Zin zich in déze kaart vertalen, en wat de flow nog onderbreekt' },
    grid: arr(obj({
      val: { ...str, description: 'Kaartpunten voor deze laag, kort, bv. "Kreeft-zon · Mercurius Kreeft"' },
      desc: { ...str, description: 'Eén zin die deze laag duidt' },
    })),
    questions: { ...arr(str), description: '5 flow-reflectievragen, persoonlijk voor deze kaart' },
  }),
  astrology: obj({
    qualities: obj({
      sun: str, moon: str, mercury: str, venus: str, mars: str, jupiter: str,
      saturn: str, uranus: str, neptune: str, pluto: str, northNode: str,
      southNode: { ...str, description: 'Zuidknoop-kwaliteit: waar je vandaan komt, moeiteloos en niet meer voedend' },
      chiron: str,
      mc: { ...str, description: 'MC/Midhemel-kwaliteit: wat je hier komt brengen, je publieke rol' },
    }),
    aspects: { ...arr(str), description: 'Per aangeleverd aspect één duiding van 1-2 zinnen in gewone taal, in EXACT dezelfde volgorde en met EXACT evenveel items als de ASPECTEN-lijst in de data. Zonder de technische naam te herhalen (die staat al in de tabel).' },
    patterns: { ...str, description: 'html · 4 alinea\'s over de opvallendste patronen in deze kaart (clusters, knopen-as, retrogrades, verbinding met numerologie)' },
    cards: arr(obj({
      label: { ...str, description: 'Korte kaartlabel, bv. "Cluster Huis 11 (Zon · Mercurius · Venus)"' },
      title: str,
      body: str,
    })),
  }),
  nodes: obj({
    body: { ...str, description: 'html · 2 alinea\'s: het verhaal van de knooppunt-as van deze persoon (Zuidknoop vertrouwd patroon → Noordknoop groeirichting)' },
    south: { ...str, description: 'Zuidknoop-kaarttekst: het vertrouwde patroon en wanneer het niet meer voedt' },
    north: { ...str, description: 'Noordknoop-kaarttekst: de groeirichting en de concrete stap' },
    chiron: { ...str, description: 'Chiron-alinea: de wond, waar die speelt (teken+huis) en hoe die heelt tot gave' },
  }),
  numerology: obj({
    lifePathTitle: { ...str, description: 'Archetype-naam van het levenspad, bv. "De Wijze"' },
    lifePathBody: { ...str, description: 'html · 2 alinea\'s: het levenspadgetal geduid, incl. licht en schaduw, en de link met de kaart' },
    pyBody: { ...str, description: 'html · 2 alinea\'s: het persoonlijk jaar geduid en de link met de kaart' },
    cycleTitle: { ...str, description: 'Titel van de maandcyclus-kaart, bv. "Van oogst naar fundament"' },
    cycleBody: { ...str, description: 'De persoonlijke maandgetallen als doorlopend verhaal (gebruik de exacte aangeleverde maandgetallen)' },
    nameNumbers: obj({
      expression: { ...str, description: 'Eén zin over het uitdrukkingsgetal van deze persoon' },
      soulUrge: { ...str, description: 'Eén zin over de zielenurge van deze persoon' },
      personality: { ...str, description: 'Eén zin over het persoonlijkheidsgetal van deze persoon' },
    }),
  }),
  tikkun: obj({
    cards: arr(obj({ title: str, body: str })),
    retroTitle: { ...str, description: 'Titel voor het retrograde-blok, bv. "Retrograde planeten: innerlijke verwerking" — of bij géén retrogrades een titel over directe energie' },
    retroBody: { ...str, description: 'Alinea over de retrograde planeten van deze persoon (of het ontbreken ervan) en wat dat betekent' },
  }),
  summary: obj({
    oneLiner: { ...str, description: 'Deze persoon in één samenvattende zin, zonder aanhalingstekens' },
    tikkunSub: { ...str, description: 'Zeer korte tikkun-essentie voor in de tabel, bv. "Van het zelf naar de bijdrage"' },
    rows: { ...arr(str), description: '6 tabelregels (elk 1-2 zinnen) in de vaste volgorde' },
  }),
  reflection: obj({ questions: { ...arr(str), description: '10 persoonlijke journalingvragen' } }),
  energy: obj({
    rhythm: { ...str, description: 'Alinea: het eigen ritme van deze kaart (spanningen en samenspel tussen de elementen/planeten)' },
    grid: arr(obj({
      val: { ...str, description: 'Kort motto voor dit dagdeel, bv. "Voel eerst naar binnen"' },
      desc: { ...str, description: '1-2 zinnen advies voor dit dagdeel, gekoppeld aan de kaart' },
    })),
    elements: {
      ...arr(obj({
        label: { ...str, description: 'Element + telling + punten, bv. "Vuur · 5 punten (Mars en Saturnus in Leeuw, Ascendant in Leeuw, Neptunus in Boogschutter, MC in Ram)"' },
        title: str,
        body: str,
      })),
      description: 'PRECIES 4 element-kaarten: alle vier de elementen, gesorteerd van sterkst naar zwakst vertegenwoordigd volgens de ELEMENTVERDELING. De laatste kaart (zwakste element) krijgt als titel iets als "Jouw minst vertegenwoordigde element" en duidt wat het betekent dat dit gereedschap bewust opgehaald moet worden.',
    },
    modality: obj({
      title: { ...str, description: 'Korte kop over de modaliteitsverdeling, bv. "En hoe vast je zit" of "En hoe wendbaar je bent"' },
      body: { ...str, description: 'Alinea: leg cardinaal/vast/beweeglijk kort uit, noem de exacte telling uit de data en wat de dominante modaliteit voor deze persoon betekent' },
    }),
  }),
  integration: obj({
    layers: obj({
      astro: { ...str, description: 'Eén regel: de astrologische laag nu' },
      num: { ...str, description: 'Eén regel: de numerologische laag nu' },
      soul: { ...str, description: 'Eén regel: de zielrichting nu' },
      year: { ...str, description: 'Eén regel: het persoonlijk jaar nu' },
      focus: { ...str, description: 'Waar de meeste beweging mogelijk is, als korte zin die na "Voor jou is dat nu vooral:" past' },
    }),
    shadow: { ...str, description: 'Alinea: de 1-2 schaduwpatronen van deze persoon (geworteld in Zuidknoop/levenspad) en hoe ze willen evolueren' },
    breath: { ...str, description: 'Alinea over de adem als sleutel, gekoppeld aan deze kaart' },
    gifts: { ...arr(str), description: '6 gaven-teksten in de vaste volgorde; elk: kaartpunt + duiding + concrete toepassing' },
    practices: arr(obj({
      title: { ...str, description: 'Korte titel van de praktijk' },
      body: { ...str, description: 'Kaartpunt + concrete dagelijkse praktijk in 2-3 zinnen' },
    })),
    prompts: {
      ...arr(obj({
        label: { ...str, description: 'Korte promptnaam met de groep erin herkenbaar, bv. "Astrologie · Je kernidentiteit belichten" of "Schaduwwerk · Een terugkerend patroon onderzoeken"' },
        text: { ...str, description: 'De volledige, zelfstandige AI-prompt met de echte kaartdata erin verwerkt' },
      })),
      description: 'PRECIES 6 AI-prompts in vaste volgorde: 1-3 gebaseerd op ASTROLOGIE (de geboortekaart), 4-6 gericht op SCHADUWWERK / paradigma\'s / patronen (Zuidknoop, levenspad, tikkun, vragenlijst).',
    },
  }),
  calendar: obj({
    intro: { ...str, description: 'html · 1-2 alinea\'s boven de kalender: uit welk persoonlijk jaar de maandgetallen komen (benoem een eventuele jaarovergang op 1 januari expliciet, incl. een niet-gereduceerd meestergetal) en welke 1-2 grote transitbewegingen door de hele periode heen lopen (alleen uit de aangeleverde TRANSITS)' },
    months: {
      ...arr(obj({
        theme: { ...str, description: 'Eén woord of zeer korte kop voor deze maand, bv. "Beginnen", "De kanteling"' },
        body: { ...str, description: '2-3 zinnen: wat het maandgetal vraagt én wat er astronomisch gebeurt volgens de aangeleverde transits van deze maand (met orb waar die klein is). Geen transits verzinnen; zijn er geen, schrijf dan alleen over het maandgetal.' },
        bullets: { ...arr(str), description: '3 korte, concrete acties voor deze maand, persoonlijk voor deze kaart' },
      })),
      description: 'PRECIES 6 maanden, in dezelfde volgorde als de aangeleverde persoonlijke maanden.',
    },
  }),
  closing: { ...str, description: 'html · 2 slotalinea\'s ("Tot slot"): de kern van deze blueprint, warm en bekrachtigend' },
});

// ── De generatie-calls ───────────────────────────────────────────────────────
// Het volledige schema is te groot voor de grammar-compiler van de API
// ("compiled grammar too large"). Daarom drie parallelle calls met elk een
// deel-schema; de facts + system worden via prompt caching gedeeld.
const SCHEMA_PARTS = [
  ['hero', 'dashboard', 'introQuote', 'introduction', 'flow', 'astrology'],
  ['nodes', 'numerology', 'tikkun', 'summary', 'reflection', 'calendar'],
  ['energy', 'integration', 'closing'],
];

function partSchema(keys) {
  return {
    type: 'object', additionalProperties: false,
    properties: Object.fromEntries(keys.map(k => [k, TEXT_SCHEMA.properties[k]])),
    required: keys,
  };
}

async function generatePart(client, ctx, lang, keys, shared) {
  const langDirective = lang === 'en'
    ? 'Write ALL fields in natural, warm ENGLISH. Use the English zodiac sign names (given as "EN:" in the data). Address the reader as "you".'
    : 'Schrijf ALLE velden in warm, natuurlijk NEDERLANDS in de jij-vorm. Gebruik de Nederlandse tekennamen.';

  // Aanvullende instructies uit het admin-paneel komen NA het gecachete
  // basisblok, zodat de prompt-cache geldig blijft als ze wijzigen.
  const system = [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }];
  if (shared.addendum) {
    system.push({
      type: 'text',
      text: `AANVULLENDE INSTRUCTIES VAN DE BEHEERDER (aanscherping op het bovenstaande; bij tegenstrijdigheid gaan deze vóór):\n${shared.addendum}`,
    });
  }

  const stream = client.messages.stream({
    model: MODEL(),
    max_tokens: 28000,
    system,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Hier is de volledige, exact berekende data van de cliënt.\n\n${shared.facts}\n\n${shared.intakeSummary}`,
          cache_control: { type: 'ephemeral' },
        },
        { type: 'text', text: `${langDirective}\n\nSchrijf nu UITSLUITEND deze onderdelen van de Alignment Blueprint: ${keys.join(', ')}.` },
      ],
    }],
    output_config: { format: { type: 'json_schema', schema: partSchema(keys) } },
  });

  const message = await stream.finalMessage();
  if (message.stop_reason === 'refusal') {
    throw new Error(`AI-generatie geweigerd (deel ${keys[0]}…, stop_reason: refusal).`);
  }
  if (message.stop_reason === 'max_tokens') {
    throw new Error(`AI-generatie afgekapt (deel ${keys[0]}…, max_tokens bereikt).`);
  }
  const text = message.content.filter(b => b.type === 'text').map(b => b.text).join('');
  return { part: JSON.parse(text), usage: message.usage };
}

async function generateBlueprintTexts(ctx, lang, client, options) {
  client = client || new Anthropic();
  const shared = {
    facts: buildFacts(ctx),
    intakeSummary: buildIntakeSummary(ctx.intake),
    addendum: String((options && options.addendum) || '').trim().slice(0, 8000),
  };

  const results = await Promise.all(SCHEMA_PARTS.map(keys => generatePart(client, ctx, lang, keys, shared)));

  const texts = Object.assign({}, ...results.map(r => r.part));
  const usage = results.reduce((acc, r) => {
    for (const [k, v] of Object.entries(r.usage || {})) {
      if (typeof v === 'number') acc[k] = (acc[k] || 0) + v;
    }
    return acc;
  }, {});
  return { texts, usage };
}

module.exports = { generateBlueprintTexts, buildFacts, TEXT_SCHEMA, SYSTEM };

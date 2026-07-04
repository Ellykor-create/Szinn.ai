'use strict';
// Laag 2 van de blueprint-pipeline: één API-call per taal die UITSLUITEND de
// persoonlijke teksten teruggeeft als gestructureerde JSON. Geen HTML-document,
// geen CSS, geen berekeningen — die komen uit laag 1 en de vaste template.

const Anthropic = require('@anthropic-ai/sdk');

const MODEL = () => process.env.BLUEPRINT_MODEL || 'claude-sonnet-5';

// ── Feiten uit laag 1, compact voor het model ────────────────────────────────
function buildFacts({ intake, chart, numerology: num }) {
  const P = chart.planets;
  const p = (key) => {
    const x = P[key];
    return `${x.name}: ${x.sign} ${x.deg}°${String(x.min).padStart(2, '0')}' (EN: ${x.signEn})${x.house ? `, Huis ${x.house}` : ''}${x.retrograde ? ', retrograde' : ''}`;
  };
  const months = num.personalMonths.map(m => `${m.month}/${m.year}: persoonlijke maand ${m.number}`).join(' · ');
  return [
    `Naam (roepnaam): ${intake.clientName}`,
    `Volledige geboortenaam: ${intake.birthName || intake.clientName}`,
    `Geboren: ${intake.birthDate} om ${intake.birthTime || 'onbekend (12:00 aangenomen)'} te ${intake.birthCity || ''}${intake.birthCountry ? ', ' + intake.birthCountry : ''}`,
    '',
    'GEBOORTEKAART (Placidus):',
    ...['sun', 'moon', 'ascendant', 'mc', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'northNode', 'southNode', 'chiron'].map(p),
    `Dominant element: ${chart.summary.dominantElement} · Dominante modaliteit: ${chart.summary.dominantModality}`,
    '',
    'NUMEROLOGIE (Pythagorisch):',
    `Levenspad: ${num.lifePath} (${num.lifePathInfo.name}; kernwoord ${num.lifePathInfo.keyword}; schaduw ${num.lifePathInfo.challenge})`,
    `Persoonlijk Jaar ${num.currentYear}: ${num.personalYear} (${num.personalYearInfo.theme})`,
    `Geboortedag: ${num.birthday}`,
    `Uitdrukkingsgetal (volledige naam): ${num.expression}`,
    `Zielenurge (klinkers): ${num.soulUrge}`,
    `Persoonlijkheidsgetal (medeklinkers): ${num.personality}`,
    `Persoonlijke maanden: ${months}`,
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
- Geen voorspellingen, geen oordelen, geen medische of psychologische claims. Het document is een spiegel en een uitnodiging.
- Concreet en persoonlijk: verwijs naar de werkelijke posities (teken + huis) en getallen van deze persoon, en verweef waar passend de antwoorden uit de vragenlijst.
- Vermijd jargon zonder uitleg; schrijf alsof je tegen één mens praat.
- Kernbegrippen van SZINN die je mag gebruiken: herinneren wie je bent, Sin/Sinn/Zin, de vier bewegingen (Herkenning, Helderheid, Richting, Integratie), de wereld als spiegel, de zes gaven.

VORMREGELS:
- Velden die met "html" zijn gemarkeerd in de beschrijving: alleen <p>, <em>, <strong> en <br> gebruiken. Meerdere alinea's = meerdere <p>-blokken.
- Alle overige velden: platte tekst, geen HTML, geen aanhalingstekens om het hele veld.
- Schrijf ALLE velden volledig. Geen placeholders, geen "...", geen verwijzingen naar ontbrekende data.
- De AI-prompts (integration.prompts) zijn zelfstandige prompts die de lezer in Claude of ChatGPT plakt: begin met "Ik ben {naam}" of "My name is..." en benoem daarin expliciet de relevante kaartdata, zodat de prompt zonder context werkt.
- Aantallen zijn exact: 4 dashboardkaarten, 12 planeet-kwaliteiten, 2 astrologie-patroonkaarten, 5 flow-vragen, 3 flow-rastercellen, 3 tikkun-kaarten, 6 samenvattingsregels, 10 reflectievragen, 5 energie-rastercellen, 3 element-kaarten, 6 gaven, 6 praktijken, 6 AI-prompts.
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
      saturn: str, uranus: str, neptune: str, pluto: str, northNode: str, chiron: str,
    }),
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
    elements: arr(obj({
      label: { ...str, description: 'Element + kaartpunten, bv. "Water (Zon & Mercurius Kreeft)"' },
      title: str,
      body: str,
    })),
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
    prompts: arr(obj({
      label: { ...str, description: 'Korte promptnaam, bv. "Onderscheiden tussen het persoonlijke en de bijdrage"' },
      text: { ...str, description: 'De volledige, zelfstandige AI-prompt met de echte kaartdata erin verwerkt' },
    })),
  }),
  closing: { ...str, description: 'html · 2 slotalinea\'s ("Tot slot"): de kern van deze blueprint, warm en bekrachtigend' },
});

// ── De generatie-calls ───────────────────────────────────────────────────────
// Het volledige schema is te groot voor de grammar-compiler van de API
// ("compiled grammar too large"). Daarom drie parallelle calls met elk een
// deel-schema; de facts + system worden via prompt caching gedeeld.
const SCHEMA_PARTS = [
  ['hero', 'dashboard', 'introQuote', 'introduction', 'flow', 'astrology'],
  ['nodes', 'numerology', 'tikkun', 'summary', 'reflection'],
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

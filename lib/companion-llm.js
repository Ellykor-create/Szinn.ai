// SZINN Companion — provider-agnostische chat via een OpenAI-compatibel
// /chat/completions endpoint. Werkt met Gemini, Mistral, Groq, OpenRouter,
// DeepSeek of OpenAI; wissel van provider met env-vars, zonder code te wijzigen:
//   COMPANION_API_KEY   API-sleutel (verplicht om de companion te activeren)
//   COMPANION_BASE_URL  basis-URL (default: Google Gemini)
//   COMPANION_MODEL     modelnaam (default: gemini-2.5-flash-lite)
// Node 22 heeft fetch ingebouwd — geen extra dependency nodig.

const DEFAULT_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai';
const DEFAULT_MODEL = 'gemini-flash-lite-latest'; // alias: altijd de nieuwste, goedkoopste Flash-Lite

// Breek een trage/hangende LLM-call af rúim vóór de platform-limiet. Netlify
// doodt een synchrone functie na ~10s en geeft dan een HTML 502 terug; de
// client kan die niet als JSON lezen en toont "Companion niet bereikbaar".
// Een eigen timeout laat de call falen als nette, herkenbare JSON-fout i.p.v.
// als gekilde functie. Verhoog dit alleen als je de Netlify-functielimiet ook
// verhoogt. ponytail: vaste marge onder 10s; env-tunable als de limiet wijzigt.
const DEFAULT_TIMEOUT_MS = Number(process.env.COMPANION_TIMEOUT_MS) || 8000;

function companionKey() {
  return process.env.COMPANION_API_KEY || process.env.GEMINI_API_KEY || '';
}

// Is er een sleutel? Zo niet, dan valt de companion terug op zijn vangnet.
function companionConfigured() {
  return !!companionKey();
}

// Eén chat-beurt. Geef jsonSchema mee voor gestructureerde JSON-uitvoer
// (dagduiding); zonder schema komt platte tekst terug (gesprek).
async function companionChat({ system, messages, maxTokens = 800, jsonSchema = null, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const key = companionKey();
  if (!key) throw new Error('COMPANION_API_KEY niet ingesteld');
  const base = (process.env.COMPANION_BASE_URL || DEFAULT_BASE).replace(/\/+$/, '');
  const model = process.env.COMPANION_MODEL || DEFAULT_MODEL;

  const body = {
    model,
    max_tokens: maxTokens,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      ...messages.map(m => ({ role: m.role, content: m.content })),
    ],
  };
  if (jsonSchema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: { name: 'reading', schema: jsonSchema, strict: true },
    };
  }

  let r;
  try {
    r = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    if (e.name === 'TimeoutError' || e.name === 'AbortError')
      throw new Error(`Companion LLM timeout na ${timeoutMs}ms`);
    throw e;
  }
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    throw new Error(`Companion LLM ${r.status}: ${detail.slice(0, 300)}`);
  }
  const data = await r.json();
  const text = data.choices?.[0]?.message?.content || '';
  return jsonSchema ? JSON.parse(text) : text;
}

// ── Gesprek met geheugen ──────────────────────────────────────────────────────
// Storage-agnostisch: de aanroeper (Netlify Blobs of SQLite) bewaart per
// gebruiker één state-object { memory, messages, turns } en geeft dat hier
// door. companionTurn muteert de state en geeft het antwoord terug.
const HISTORY_IN_PROMPT = 12; // laatste berichten die letterlijk meegaan in de prompt
const HISTORY_KEPT = 40;      // bewaarde berichten per gebruiker
const SUMMARIZE_EVERY = 5;    // om de zoveel gebruikersbeurten het geheugen verversen

function emptyCompanionState() {
  return { memory: '', messages: [], turns: 0 };
}

// De eigen woorden van de gebruiker uit de intake (vrije-tekstantwoorden),
// zodat de companion toon en woordkeuze kan spiegelen.
function intakeVoice(raw, maxChars = 1800) {
  const out = [];
  for (const [k, v] of Object.entries(raw || {})) {
    if (typeof v === 'string' && v.trim().length >= 30 && !k.startsWith('consent')) out.push(v.trim());
  }
  return out.join('\n').slice(0, maxChars);
}

// Spiegel-persona: zacht, uitnodigend, zet aan het denken i.p.v. oplossingen op te leggen.
function mirrorPersona(lang, name) {
  if (lang === 'en') return `You are a gentle mirror, not an oracle or advisor. For questions about the blueprint: explain calmly and concretely what a part means, always linked to ${name}'s daily life. For personal struggles: first acknowledge the feeling, reflect back what you hear in their own words, then ask ONE open, deepening question that invites them to think for themselves — no ready-made solutions, no lists of advice. At most one question per reply. Keep replies short (3-6 sentences), warm and human. Mirror the user's tone and wording: if they write briefly and plainly, so do you; if they write expansively and sensitively, move with them.`;
  return `Je bent een zachte spiegel, geen orakel of adviseur. Bij vragen over de blueprint: leg rustig en concreet uit wat een onderdeel betekent, altijd gekoppeld aan het dagelijks leven van ${name}. Bij persoonlijke struggles: erken eerst het gevoel, benoem in eigen woorden wat je hoort, en stel dan ÉÉN open, verdiepende vraag die aan het denken zet — geen kant-en-klare oplossingen, geen adviezenlijstjes. Maximaal één vraag per antwoord. Houd antwoorden kort (3-6 zinnen), warm en menselijk. Spiegel de toon en woordkeuze van de gebruiker: schrijft die kort en nuchter, doe jij dat ook; schrijft die uitgebreid en gevoelig, beweeg dan mee.`;
}

function buildChatSystem({ baseSystem, name, intakeRaw, memory, lang }) {
  const en = lang === 'en';
  const parts = [baseSystem, mirrorPersona(lang, name || (en ? 'the user' : 'de gebruiker'))];
  const voice = intakeVoice(intakeRaw);
  if (voice) parts.push((en
    ? 'These are the user\'s own intake answers, in their own words. Use them for tone of voice AND as context for what is alive in their life right now:\n'
    : 'Dit zijn de eigen intake-antwoorden van de gebruiker, in eigen woorden. Gebruik ze voor de tone of voice ÉN als context voor wat er nu in dit leven speelt:\n') + voice);
  if (memory) parts.push((en
    ? 'What you remember from earlier conversations (do not repeat this literally, build on it naturally):\n'
    : 'Wat je je herinnert uit eerdere gesprekken (niet letterlijk herhalen, bouw er natuurlijk op voort):\n') + memory);
  return parts.join('\n\n');
}

// Comprimeert de recente gespreksbeurten + het oude geheugen tot een nieuw,
// compact doorlopend geheugen (max ~200 woorden).
async function updateMemory({ memory, messages, lang, timeoutMs }) {
  const en = lang === 'en';
  const convo = messages.map(m => `${m.role === 'user' ? (en ? 'User' : 'Gebruiker') : 'Companion'}: ${m.content}`).join('\n');
  const content = await companionChat({
    system: en
      ? 'You maintain the private memory of the SZINN Companion about one user. Write in compact prose (max 200 words): themes that keep coming back, struggles, what matters to them, their tone of writing, agreements or insights from the conversation. No greetings, no meta-text — only the memory itself.'
      : 'Jij onderhoudt het privé-geheugen van de SZINN Companion over één gebruiker. Schrijf compacte lopende tekst (max 200 woorden): terugkerende thema\'s, struggles, wat er voor deze persoon toe doet, de schrijftoon, afspraken of inzichten uit het gesprek. Geen begroeting, geen meta-tekst — alleen het geheugen zelf.',
    messages: [{ role: 'user', content: `${en ? 'Current memory' : 'Huidig geheugen'}:\n${memory || (en ? '(empty)' : '(leeg)')}\n\n${en ? 'Latest conversation' : 'Nieuwste gesprek'}:\n${convo}\n\n${en ? 'Write the updated memory.' : 'Schrijf het bijgewerkte geheugen.'}` }],
    maxTokens: 400,
    timeoutMs,
  });
  return String(content || '').trim().slice(0, 4000);
}

// Eén volledige gespreksbeurt: prompt bouwen, antwoorden, state bijwerken en
// (om de SUMMARIZE_EVERY beurten, best effort) het geheugen verversen.
async function companionTurn({ state, userMessage, baseSystem, name, intakeRaw, lang, maxTokens = 800 }) {
  const system = buildChatSystem({ baseSystem, name, intakeRaw, memory: state.memory, lang });
  const messages = [...state.messages.slice(-HISTORY_IN_PROMPT), { role: 'user', content: userMessage }];
  const content = await companionChat({ system, messages, maxTokens });

  state.messages.push({ role: 'user', content: userMessage }, { role: 'assistant', content });
  if (state.messages.length > HISTORY_KEPT) state.messages = state.messages.slice(-HISTORY_KEPT);
  state.turns = (state.turns || 0) + 1;
  if (state.turns >= SUMMARIZE_EVERY) {
    // Krap budget: het antwoord is al berekend, dit mag de functie niet over de
    // platform-limiet duwen. Faalt dit, dan blijft het oude geheugen staan en
    // proberen we het volgende beurt opnieuw. ponytail: 3s-cap, best effort.
    try {
      state.memory = await updateMemory({ memory: state.memory, messages: state.messages.slice(-SUMMARIZE_EVERY * 2), lang, timeoutMs: 3000 });
      state.turns = 0;
    } catch (e) { console.error('companion-geheugen bijwerken mislukt:', e.message); }
  }
  return content;
}

module.exports = { companionChat, companionConfigured, emptyCompanionState, intakeVoice, buildChatSystem, updateMemory, companionTurn };

// Zelf-check (zonder netwerk): node lib/companion-llm.js
if (require.main === module) {
  const assert = require('node:assert');
  const saved = process.env.COMPANION_API_KEY;
  delete process.env.COMPANION_API_KEY;
  delete process.env.GEMINI_API_KEY;
  assert.strictEqual(companionConfigured(), false, 'zonder sleutel: niet geconfigureerd');
  process.env.COMPANION_API_KEY = 'test-key';
  assert.strictEqual(companionConfigured(), true, 'met sleutel: geconfigureerd');
  if (saved === undefined) delete process.env.COMPANION_API_KEY; else process.env.COMPANION_API_KEY = saved;

  // intakeVoice: alleen vrije tekst ≥ 30 tekens, geen consent-velden
  const raw = {
    voornaam: 'Kim',
    consent_verwerking: 'ja, ik ga hier volledig en van harte mee akkoord',
    levensvraag: 'Ik loop al een tijd vast in mijn werk en vraag me af wat ik echt wil.',
  };
  assert.ok(intakeVoice(raw).includes('vast in mijn werk'), 'levensvraag hoort in de voice');
  assert.ok(!intakeVoice(raw).includes('akkoord'), 'consent-velden horen niet in de voice');
  assert.strictEqual(intakeVoice({}), '', 'lege intake: lege voice');

  // buildChatSystem: alle blokken aanwezig
  const sys = buildChatSystem({ baseSystem: 'BASIS', name: 'Kim', intakeRaw: raw, memory: 'eerder: werkstress', lang: 'nl' });
  assert.ok(sys.startsWith('BASIS'), 'basis-system voorop');
  assert.ok(sys.includes('zachte spiegel'), 'spiegel-persona aanwezig');
  assert.ok(sys.includes('vast in mijn werk'), 'intake-voice aanwezig');
  assert.ok(sys.includes('eerder: werkstress'), 'geheugen aanwezig');

  const st = emptyCompanionState();
  assert.deepStrictEqual(st, { memory: '', messages: [], turns: 0 });

  // Timeout-vangnet: de runtime moet AbortSignal.timeout kennen én een trage
  // call moet als nette fout falen (geen hang → geen gekilde functie → geen
  // "niet bereikbaar"). Test tegen een adres dat nooit antwoordt, budget 50ms.
  assert.strictEqual(typeof AbortSignal.timeout, 'function', 'AbortSignal.timeout vereist');
  (async () => {
    process.env.COMPANION_API_KEY = 'test-key';
    process.env.COMPANION_BASE_URL = 'http://10.255.255.1'; // niet-routeerbaar: hangt
    let msg = '';
    try { await companionChat({ system: '', messages: [{ role: 'user', content: 'hoi' }], timeoutMs: 50 }); }
    catch (e) { msg = e.message; }
    assert.ok(/timeout/i.test(msg), 'trage call moet als timeout falen, kreeg: ' + msg);
    console.log('ok');
  })();
}

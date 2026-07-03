'use strict';
// Kwaliteitscontrole op de gegenereerde blueprint. Twee niveaus:
// 1. auditTexts()  — controleert het AI-tekstobject vóór het renderen
// 2. auditHTML()   — controleert het uiteindelijke HTML-document

const SECTION_IDS = ['vision', 'introduction', 'flow', 'astrology', 'nodes', 'numerology',
  'tikkun', 'mandala', 'summary', 'reflection', 'energy', 'integration', 'deepening'];

function auditTexts(ai) {
  const problems = [];
  const need = (cond, msg) => { if (!cond) problems.push(msg); };
  const filled = (v) => typeof v === 'string' && v.trim().length > 0;

  try {
    need(filled(ai.introQuote), 'introQuote leeg');
    need(filled(ai.introduction), 'introduction leeg');
    need(filled(ai.closing), 'closing leeg');
    need((ai.dashboard?.cards || []).length === 4, `dashboard.cards: ${(ai.dashboard?.cards || []).length} i.p.v. 4`);
    need((ai.flow?.questions || []).length === 5, `flow.questions: ${(ai.flow?.questions || []).length} i.p.v. 5`);
    need((ai.flow?.grid || []).length === 3, `flow.grid: ${(ai.flow?.grid || []).length} i.p.v. 3`);
    need((ai.astrology?.cards || []).length === 2, `astrology.cards: ${(ai.astrology?.cards || []).length} i.p.v. 2`);
    const q = ai.astrology?.qualities || {};
    for (const k of ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto','northNode','chiron']) {
      need(filled(q[k]), `astrology.qualities.${k} leeg`);
    }
    need((ai.tikkun?.cards || []).length === 3, `tikkun.cards: ${(ai.tikkun?.cards || []).length} i.p.v. 3`);
    need((ai.summary?.rows || []).length === 6, `summary.rows: ${(ai.summary?.rows || []).length} i.p.v. 6`);
    need((ai.reflection?.questions || []).length === 10, `reflection.questions: ${(ai.reflection?.questions || []).length} i.p.v. 10`);
    need((ai.energy?.grid || []).length === 5, `energy.grid: ${(ai.energy?.grid || []).length} i.p.v. 5`);
    need((ai.energy?.elements || []).length === 3, `energy.elements: ${(ai.energy?.elements || []).length} i.p.v. 3`);
    need((ai.integration?.gifts || []).length === 6, `integration.gifts: ${(ai.integration?.gifts || []).length} i.p.v. 6`);
    need((ai.integration?.practices || []).length === 6, `integration.practices: ${(ai.integration?.practices || []).length} i.p.v. 6`);
    need((ai.integration?.prompts || []).length === 6, `integration.prompts: ${(ai.integration?.prompts || []).length} i.p.v. 6`);
    for (const [i, p] of (ai.integration?.prompts || []).entries()) {
      need(filled(p.text) && p.text.length > 80, `prompt ${i + 1} te kort of leeg`);
    }
  } catch (e) {
    problems.push(`structuurfout in AI-teksten: ${e.message}`);
  }
  return { ok: problems.length === 0, problems };
}

function auditHTML(html, { clientName, birthDate } = {}) {
  const problems = [];
  const need = (cond, msg) => { if (!cond) problems.push(msg); };

  // 1. Geen onvervulde tokens of prompt-placeholders
  const leftovers = html.match(/{{[A-Z0-9_]+}}/g);
  need(!leftovers, `onvervulde tokens: ${[...new Set(leftovers || [])].join(', ')}`);

  // 2. Alle 13 secties aanwezig
  for (const id of SECTION_IDS) {
    need(html.includes(`id="${id}"`), `sectie ontbreekt: ${id}`);
  }

  // 3. Persoonlijke data aanwezig, geen sporen van andere klanten
  if (clientName) need(html.includes(clientName), `klantnaam "${clientName}" niet gevonden`);
  if (clientName && clientName.toLowerCase() !== 'barry') {
    need(!/\bBarry\b/.test(html), 'naam van referentieklant (Barry) aangetroffen');
  }

  // 4. Kerncomponenten aanwezig
  need(html.includes('<svg') && html.includes('id="merkaba"'), 'mandala-SVG ontbreekt of is onvolledig');
  need((html.match(/class="cal-month"/g) || []).length === 6, 'kalender heeft geen 6 maanden');
  need((html.match(/class="prompt"/g) || []).length === 6, 'geen 6 AI-promptkaarten');
  need((html.match(/class="practice"/g) || []).length === 6, 'geen 6 praktijken');
  need((html.match(/class="gift-card"/g) || []).length === 6, 'geen 6 gaven');
  need((html.match(/class="scard"/g) || []).length === 4, 'geen 4 dashboardkaarten');

  // 5. Basis-HTML-validiteit
  need(html.trim().startsWith('<!DOCTYPE') || html.trim().startsWith('<!doctype'), 'geen doctype');
  need(html.includes('</html>'), 'sluitende </html> ontbreekt');
  for (const tag of ['section', 'table', 'ul']) {
    const open = (html.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length;
    const close = (html.match(new RegExp(`</${tag}>`, 'g')) || []).length;
    need(open === close, `<${tag}> niet gebalanceerd (${open} open, ${close} dicht)`);
  }

  return { ok: problems.length === 0, problems: problems.filter(Boolean) };
}

module.exports = { auditTexts, auditHTML, SECTION_IDS };

'use strict';

const PYTHAGOREAN = {
  a:1,b:2,c:3,d:4,e:5,f:6,g:7,h:8,i:9,
  j:1,k:2,l:3,m:4,n:5,o:6,p:7,q:8,r:9,
  s:1,t:2,u:3,v:4,w:5,x:6,y:7,z:8
};
const VOWELS = new Set('aeiouy');

function reduce(n, keepMaster = true) {
  n = Math.abs(Math.round(n));
  while (n > 9 && !(keepMaster && (n === 11 || n === 22 || n === 33))) {
    n = String(n).split('').reduce((s, d) => s + parseInt(d, 10), 0);
  }
  return n;
}

function letterVal(str) {
  return str.toLowerCase().replace(/[^a-z]/g, '').split('')
    .reduce((s, c) => s + (PYTHAGOREAN[c] || 0), 0);
}

function calcLifePath(dateStr) {
  const parts = dateStr.split('-').map(s => parseInt(s, 10));
  // Reduce each part separately (more authentic method)
  const reduced = parts.map(p => reduce(String(p).split('').reduce((s,d) => s + parseInt(d), 0)));
  return reduce(reduced.reduce((s,v) => s + v, 0));
}

function calcExpression(fullName) {
  return reduce(letterVal(fullName));
}

function calcSoulUrge(fullName) {
  const vowelSum = fullName.toLowerCase().replace(/[^a-z]/g, '').split('')
    .filter(c => VOWELS.has(c))
    .reduce((s, c) => s + (PYTHAGOREAN[c] || 0), 0);
  return reduce(vowelSum);
}

function calcPersonality(fullName) {
  const consSum = fullName.toLowerCase().replace(/[^a-z]/g, '').split('')
    .filter(c => !VOWELS.has(c))
    .reduce((s, c) => s + (PYTHAGOREAN[c] || 0), 0);
  return reduce(consSum);
}

function calcPersonalYear(birthDateStr, year) {
  const [, m, d] = birthDateStr.split('-').map(Number);
  const a = reduce(d, false);
  const b = reduce(m, false);
  const c = reduce(String(year).split('').reduce((s,x) => s + parseInt(x), 0), false);
  return reduce(a + b + c, false);
}

function calcBirthday(birthDateStr) {
  const d = parseInt(birthDateStr.split('-')[2], 10);
  return reduce(d);
}

const LIFE_PATH_INFO = {
  1:  { name:'Leider & Pionier',        keyword:'onafhankelijkheid',  challenge:'egocentrisme' },
  2:  { name:'Bemiddelaar & Partner',   keyword:'samenwerking',       challenge:'afhankelijkheid' },
  3:  { name:'Creatieve Uitdrukker',    keyword:'expressie',          challenge:'verstrooiing' },
  4:  { name:'Bouwer & Organisator',    keyword:'stabiliteit',        challenge:'starheid' },
  5:  { name:'Vrijheidzoeker',          keyword:'vrijheid',           challenge:'ongeduld' },
  6:  { name:'Verzorger & Hoeder',      keyword:'verantwoordelijkheid',challenge:'perfectionisme' },
  7:  { name:'Zoeker & Filosoof',       keyword:'innerlijk weten',    challenge:'isolement' },
  8:  { name:'Materiële Meester',       keyword:'kracht & succes',    challenge:'materialisme' },
  9:  { name:'Humanist & Voltooier',    keyword:'mededogen',          challenge:'moeilijk loslaten' },
  11: { name:'Spirituele Lichtbrenger', keyword:'intuïtie & verlichting', challenge:'gevoeligheid' },
  22: { name:'Meesterbouwer',           keyword:'manifestatie op grote schaal', challenge:'perfectionisme' },
  33: { name:'Meesterleermeester',      keyword:'onvoorwaardelijke liefde', challenge:'zelfopoffering' },
};

const PERSONAL_YEAR_INFO = {
  1: { theme:'Nieuw begin',        energy:'Zaaien, starten, richting kiezen, initiatief nemen' },
  2: { theme:'Samenwerking',       energy:'Geduld, relaties verdiepen, luisteren, ontvangen' },
  3: { theme:'Expressie & Vreugde', energy:'Creativiteit, zichtbaarheid, communiceren, spelen' },
  4: { theme:'Opbouw & Structuur', energy:'Hard werken, fundament leggen, discipline, orde' },
  5: { theme:'Verandering',        energy:'Vrijheid, beweging, nieuwe ervaringen, loslaten' },
  6: { theme:'Verantwoordelijkheid', energy:'Thuis, zorg, balans, relaties, dienend zijn' },
  7: { theme:'Innerlijk jaar',     energy:'Reflectie, studie, rust, spirituele verdieping' },
  8: { theme:'Oogst & Kracht',     energy:'Materieel, zakelijk, resultaten oogsten, leiderschap' },
  9: { theme:'Afsluiting & Loslaten', energy:'Afronding, vergeven, ruimte maken voor het nieuwe' },
};

function calcAll(fullBirthName, birthDateStr) {
  const year = new Date().getFullYear();
  const lp  = calcLifePath(birthDateStr);
  const exp = calcExpression(fullBirthName);
  const su  = calcSoulUrge(fullBirthName);
  const per = calcPersonality(fullBirthName);
  const py  = calcPersonalYear(birthDateStr, year);
  const bd  = calcBirthday(birthDateStr);

  return {
    lifePath: lp,
    lifePathInfo: LIFE_PATH_INFO[lp] || { name:'Speciaal getal', keyword:'?', challenge:'?' },
    expression: exp,
    expressionInfo: LIFE_PATH_INFO[exp] || null,
    soulUrge: su,
    personality: per,
    birthday: bd,
    personalYear: py,
    personalYearInfo: PERSONAL_YEAR_INFO[py] || { theme:'?', energy:'?' },
    currentYear: year,
  };
}

module.exports = { calcAll };

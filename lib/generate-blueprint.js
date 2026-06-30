'use strict';
const fs   = require('fs');
const path = require('path');

// ─── SVG Birth Chart Generator ────────────────────────────────────────────────

const ZODIAC_SYMBOLS = ['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'];
const ZODIAC_NAMES   = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
                        'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const PLANET_SYMBOLS = {
  sun:'☉', moon:'☽', mercury:'☿', venus:'♀', mars:'♂',
  jupiter:'♃', saturn:'♄', uranus:'⛢', neptune:'♆', pluto:'♇',
  northNode:'☊', southNode:'☋', ascendant:'AC', mc:'MC'
};

function lonToAngle(lon, ascLon) {
  // Chart wheel: ASC is at 180° (left), counter-clockwise = forward in zodiac
  const rel = ((lon - ascLon) + 360) % 360;
  const svgDeg = (180 - rel + 360) % 360;
  return svgDeg * Math.PI / 180;
}

function generateBirthChartSVG(chart) {
  const CX = 300, CY = 300;
  const R_OUTER = 258, R_SIGN = 234, R_INNER = 180, R_PLANET = 152;
  const parts = [];

  parts.push(`<svg viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;opacity:.38">`);
  parts.push(`<defs><filter id="glow"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`);

  // Outer rings
  parts.push(`<circle cx="${CX}" cy="${CY}" r="${R_OUTER}" fill="none" stroke="#C9A96E" stroke-width="0.8" stroke-opacity=".5"/>`);
  parts.push(`<circle cx="${CX}" cy="${CY}" r="${R_SIGN}" fill="none" stroke="#C9A96E" stroke-width="0.4" stroke-opacity=".3"/>`);
  parts.push(`<circle cx="${CX}" cy="${CY}" r="${R_INNER}" fill="none" stroke="#C9A96E" stroke-width="0.6" stroke-opacity=".35"/>`);
  parts.push(`<circle cx="${CX}" cy="${CY}" r="70" fill="none" stroke="#C9A96E" stroke-width="0.4" stroke-opacity=".25"/>`);

  // Get ASC longitude for chart orientation (astro.js uses .lon)
  const ascLon = chart.planets.ascendant ? (chart.planets.ascendant.lon || 0) : 0;

  // 12 sign divisions
  for (let i = 0; i < 12; i++) {
    const angle = lonToAngle(i * 30 + ascLon, ascLon);
    const x1 = CX + R_INNER * Math.cos(angle);
    const y1 = CY + R_INNER * Math.sin(angle);
    const x2 = CX + R_OUTER * Math.cos(angle);
    const y2 = CY + R_OUTER * Math.sin(angle);
    parts.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#C9A96E" stroke-width="0.5" stroke-opacity=".35"/>`);

    // Sign symbol at midpoint of segment
    const midAngle = lonToAngle(i * 30 + 15 + ascLon, ascLon);
    const sx = CX + R_SIGN * 1.04 * Math.cos(midAngle);
    const sy = CY + R_SIGN * 1.04 * Math.sin(midAngle);
    parts.push(`<text x="${sx.toFixed(1)}" y="${sy.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="#C9A96E" opacity=".6">${ZODIAC_SYMBOLS[i]}</text>`);
  }

  // ASC / DC / MC / IC axis lines
  parts.push(`<line x1="${CX-R_OUTER}" y1="${CY}" x2="${CX+R_OUTER}" y2="${CY}" stroke="#A67C3A" stroke-width="0.5" stroke-opacity=".4"/>`);
  parts.push(`<line x1="${CX}" y1="${CY-R_OUTER}" x2="${CX}" y2="${CY+R_OUTER}" stroke="#A67C3A" stroke-width="0.5" stroke-opacity=".4"/>`);

  // Planets
  const planetKeys = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto','northNode'];
  const usedAngles = [];

  for (const key of planetKeys) {
    const pl = chart.planets[key];
    if (!pl || pl.longitude == null) continue;
    const lon = parseFloat(pl.lon);
    if (isNaN(lon)) continue;

    let angle = lonToAngle(lon, ascLon);

    // Small nudge if overlapping another planet
    for (const used of usedAngles) {
      if (Math.abs(angle - used) < 0.12) angle += 0.12;
    }
    usedAngles.push(angle);

    const px = CX + R_PLANET * Math.cos(angle);
    const py = CY + R_PLANET * Math.sin(angle);

    // Spoke line from inner circle to planet
    const lineX1 = CX + R_INNER * Math.cos(angle);
    const lineY1 = CY + R_INNER * Math.sin(angle);
    parts.push(`<line x1="${lineX1.toFixed(1)}" y1="${lineY1.toFixed(1)}" x2="${(px - 8*Math.cos(angle)).toFixed(1)}" y2="${(py - 8*Math.sin(angle)).toFixed(1)}" stroke="#6A5C40" stroke-width="0.5" stroke-opacity=".5"/>`);

    const sym = PLANET_SYMBOLS[key] || '';
    parts.push(`<text x="${px.toFixed(1)}" y="${py.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="11" fill="#1C1810" font-family="serif" filter="url(#glow)">${sym}</text>`);
  }

  // Merkaba (two overlapping triangles) in center
  const R_M = 55;
  const tri1 = [0, 1, 2].map(i => {
    const a = (i * 120 - 90) * Math.PI / 180;
    return `${(CX + R_M * Math.cos(a)).toFixed(1)},${(CY + R_M * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  const tri2 = [0, 1, 2].map(i => {
    const a = (i * 120 + 90) * Math.PI / 180;
    return `${(CX + R_M * Math.cos(a)).toFixed(1)},${(CY + R_M * Math.sin(a)).toFixed(1)}`;
  }).join(' ');

  parts.push(`<polygon points="${tri1}" fill="none" stroke="#C9A96E" stroke-width="0.8" stroke-opacity=".6"/>`);
  parts.push(`<polygon points="${tri2}" fill="none" stroke="#C9A96E" stroke-width="0.8" stroke-opacity=".6"/>`);
  parts.push(`<circle cx="${CX}" cy="${CY}" r="6" fill="none" stroke="#C9A96E" stroke-width="0.6" stroke-opacity=".4"/>`);

  parts.push(`</svg>`);
  return parts.join('\n');
}

// ─── Qualitative Score Labels ──────────────────────────────────────────────────

function getScoreLabels(chart, numerology) {
  const py = numerology.personalYear;
  const lp = numerology.lifePath;

  // Astrologie label
  const hasAngularPlanets = ['ascendant','mc'].some(k => chart.planets[k]);
  const astroLabel = hasAngularPlanets ? 'Sterk geactiveerd' : 'Actief';

  // Numerologie label
  const numLabel = (lp === 9 && py <= 2) ? 'Drempeljaar'
    : py === 1 ? 'Nieuw begin'
    : py === 9 ? 'Afsluiting'
    : py === 8 ? 'Oogstjaar'
    : py === 5 ? 'Jaar van verandering'
    : py === 7 ? 'Innerlijk jaar'
    : 'In beweging';

  // Zielrichting label (North Node)
  const nnSign = chart.planets.northNode ? chart.planets.northNode.sign : '';
  const soulLabel = nnSign ? 'Ongerept terrein' : 'Groei zichtbaar';

  // Persoonlijk jaar label
  const pyLabels = {
    1:'Nieuw begin', 2:'Samenwerking', 3:'Expressie & Vreugde', 4:'Opbouw & Structuur',
    5:'Jaar van verandering', 6:'Verantwoordelijkheid', 7:'Innerlijk jaar',
    8:'Oogst & Kracht', 9:'Afsluiting & Loslaten'
  };
  const pyLabel = pyLabels[py] || 'In beweging';

  // Personal month values (6 months from current)
  const personalMonths = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    const mSum = String(m).split('').reduce((s,x) => s + parseInt(x), 0);
    const ySum = String(y).split('').reduce((s,x) => s + parseInt(x), 0);
    let pm = mSum + ySum + py;
    while (pm > 9) pm = String(pm).split('').reduce((s,x) => s + parseInt(x), 0);
    const MONTHS_NL = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
    personalMonths.push({ month: MONTHS_NL[d.getMonth()], year: y, pm });
  }

  return { astroLabel, numLabel, soulLabel, pyLabel, personalMonths };
}

// ─── System Prompt ─────────────────────────────────────────────────────────────

const SZINN_SYSTEM_PROMPT = `Je bent de SZINN Blueprint Generator. Je genereert volledige, persoonlijke Alignment Blueprint HTML-documenten die er PRECIES uitzien als het officiële SZINN blueprint.

TOON & SCHRIJFSTIJL:
- Warm, diepgaand, poëtisch maar concreet. Nooit vaag.
- Tweede persoon (je/jij/jouw).
- Literaire kwaliteit — zinnen mogen lang en rijk zijn.
- Gebruik metaforen, maar blijf altijd herkenbaar en persoonlijk.
- Geen spirituele clichés. Wél concrete inzichten.
- Nederlandstalig (tenzij anders aangegeven).

KRITISCHE OUTPUTREGELS:
1. Begin ALTIJD met: <!DOCTYPE html>
2. Eindig ALTIJD met: </html>
3. Gebruik ALTIJD deze exacte CSS en font links in <head>:
   <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400;1,500&family=Jost:wght@200;300;400;500&display=swap" rel="stylesheet">
   <link rel="stylesheet" href="/szinn-portal/css/blueprint.css">
4. Voeg GEEN <style> blok toe — alleen de externe CSS.
5. Genereer ALLE 13 secties.
6. Eindig vlak voor </body> altijd met:
   <!-- SZINN_SCORES: {"alignment":XX,"astro":XX,"numerology":XX,"soulDirection":XX,"personalYear":XX} -->
   (XX = jouw inschatting 0–100 op basis van de data)

HTML STRUCTUUR (gebruik EXACT deze klassen):

<nav>
  <a href="#" class="nav-l">SZINN · {VOORNAAM}</a>
  <div class="nav-links">
    <a href="#vision" class="nav-link">Visie</a>
    <a href="#introduction" class="nav-link">Introductie</a>
    <a href="#flow" class="nav-link">Flow</a>
    <a href="#astrology" class="nav-link">Astrologie</a>
    <a href="#nodes" class="nav-link">Knopen</a>
    <a href="#numerology" class="nav-link">Numerologie</a>
    <a href="#tikkun" class="nav-link">Tikkun</a>
    <a href="#mandala" class="nav-link">Mandala</a>
    <a href="#summary" class="nav-link">Overzicht</a>
    <a href="#reflection" class="nav-link">Reflectie</a>
    <a href="#energy" class="nav-link">Energie</a>
    <a href="#integration" class="nav-link">Integratie</a>
    <a href="#deepening" class="nav-link verdieping">Verdieping</a>
  </div>
  <span class="nav-date">{VOORNAAM}&#10;{JAAR}</span>
</nav>

<div class="hero-outer">
<section class="hero">
  <div class="logo-block">
    <img class="logo-img" src="/assets/logo.png" alt="SZINN" onerror="this.style.display='none'">
  </div>
  <div class="hero-text">
    <div class="hero-ey">Jouw persoonlijke Alignment Blueprint</div>
    <h1 class="hero-name">{NAAM}</h1>
    <p class="hero-meta">{GEBOORTEDATUM} · {GEBOORTETIJD}<br>{GEBOORTEPLAATS}</p>
    <p class="hero-desc">{2-3 zinnen: kern van wie deze persoon is, gebaseerd op zon/maan/ascendant}</p>
    <div class="hero-tags">
      <span class="hero-tag">Zon {ZON_TEKEN}</span>
      <span class="hero-tag">Maan {MAAN_TEKEN}</span>
      <span class="hero-tag">Asc {ASC_TEKEN}</span>
      <span class="hero-tag">Levenspad {LP}</span>
    </div>
  </div>
  <div class="hero-cards">
    <div class="hcard">
      <div class="hcard-eye">Kern</div>
      <div class="hcard-title">{KERN_TITEL — bijv. "De Zoeker"}</div>
      <div class="hcard-sub">{Zon in Teken — korte essentie}</div>
      <div style="font-size:12px;color:var(--muted);line-height:1.7">{2 zinnen over de kern-energie van deze persoon}</div>
    </div>
    <div class="hcard">
      <div class="hcard-eye">Energiepatronen</div>
      <div class="hcard-title">{ENERGIE_TITEL — bijv. "Vuur · Lucht"}</div>
      <div class="hcard-sub">{Dominant element(en) en modaliteit}</div>
      <div style="font-size:12px;color:var(--muted);line-height:1.7">{2 zinnen over het energetische profiel}</div>
    </div>
    <div class="hcard">
      <div class="hcard-eye">Zielspad</div>
      <div class="hcard-title">{ZIEL_TITEL — bijv. "Van Veiligheid naar Vrijheid"}</div>
      <div class="hcard-sub">{Noordknoop Teken · Zuidknoop Teken}</div>
      <div style="font-size:12px;color:var(--muted);line-height:1.7">{2 zinnen over de zielsmissie}</div>
    </div>
  </div>
</section>
</div>

<div class="mini-row">
  <div class="mini">
    <div class="mini-ico">&#8593;</div>
    <div class="mini-lbl">Zielsgroei-richting</div>
    <div class="mini-val">Noordknoop {NN_TEKEN}</div>
  </div>
  <div class="mini">
    <div class="mini-ico">&#9790;</div>
    <div class="mini-lbl">Maan</div>
    <div class="mini-val">{MAAN_TEKEN} · {MAAN_GRAAD}°</div>
  </div>
  <div class="mini">
    <div class="mini-ico">&#9737;</div>
    <div class="mini-lbl">Zon</div>
    <div class="mini-val">{ZON_TEKEN} · {ZON_GRAAD}°</div>
  </div>
  <div class="mini">
    <div class="mini-ico">&#9670;</div>
    <div class="mini-lbl">Levenspad</div>
    <div class="mini-val">{LP} · {LP_NAAM}</div>
  </div>
</div>

<section class="score-sec" id="dashboard">
  <div class="score-header">
    <h2>Jouw <em>Dashboard</em></h2>
    <p>Een overzicht van de vier actieve energievelden in jouw blueprint — elk met zijn eigen kwaliteit en uitnodiging voor dit moment.</p>
  </div>
  <div class="score-grid">
    <div class="scard">
      <div class="scard-pct" style="font-size:20px;letter-spacing:.02em">{ASTRO_LABEL}</div>
      <div class="scard-title">Astrologie</div>
      <div class="scard-body">{2 zinnen over de actuele astrologische energetische kwaliteit}</div>
      <div class="scard-moves">Bewustwordingsbeweging</div>
      <div class="scard-with">{Korte actie-aanwijzing gebaseerd op de kaart}</div>
    </div>
    <div class="scard">
      <div class="scard-pct" style="font-size:20px;letter-spacing:.02em">{NUMEROLOGIE_LABEL}</div>
      <div class="scard-title">Numerologie</div>
      <div class="scard-body">{2 zinnen over levenspad + persoonlijk jaar samenspel}</div>
      <div class="scard-moves">Bewustwordingsbeweging</div>
      <div class="scard-with">{Concrete actie voor dit jaar}</div>
    </div>
    <div class="scard">
      <div class="scard-pct" style="font-size:20px;letter-spacing:.02em">{ZIEL_LABEL}</div>
      <div class="scard-title">Zielrichting</div>
      <div class="scard-body">{2 zinnen over de Noord/Zuidknoop as en groeirichting}</div>
      <div class="scard-moves">Bewustwordingsbeweging</div>
      <div class="scard-with">{Concrete actie richting Noordknoop}</div>
    </div>
    <div class="scard">
      <div class="scard-pct" style="font-size:20px;letter-spacing:.02em">{PY_LABEL}</div>
      <div class="scard-title">Persoonlijk Jaar {PY}</div>
      <div class="scard-body">{2 zinnen over het huidige persoonlijke jaar-thema}</div>
      <div class="scard-moves">Bewustwordingsbeweging</div>
      <div class="scard-with">{Concrete handeling passend bij het jaar-thema}</div>
    </div>
  </div>
</section>

<div class="bp-intro">
  <div class="bp-intro-inner">
    <div class="bp-mark-wrap"><div class="bp-mark">✦</div></div>
    <h2 class="bp-name-big">{NAAM}</h2>
    <p class="bp-birth">{GEBOORTEDATUM} · {GEBOORTETIJD} · {GEBOORTEPLAATS}</p>
    <div class="bp-sun-row">
      <div class="bp-planet"><div class="bp-planet-label">Zon</div><div class="bp-planet-val">{ZON_TEKEN} {ZON_GRAAD}°</div></div>
      <div class="bp-planet"><div class="bp-planet-label">Maan</div><div class="bp-planet-val">{MAAN_TEKEN} {MAAN_GRAAD}°</div></div>
      <div class="bp-planet"><div class="bp-planet-label">Ascendant</div><div class="bp-planet-val">{ASC_TEKEN} {ASC_GRAAD}°</div></div>
      <div class="bp-planet"><div class="bp-planet-label">Levenspad</div><div class="bp-planet-val">{LP}</div></div>
      <div class="bp-planet"><div class="bp-planet-label">Persoonlijk Jaar</div><div class="bp-planet-val">{PY}</div></div>
      <div class="bp-planet"><div class="bp-planet-label">Noordknoop</div><div class="bp-planet-val">{NN_TEKEN}</div></div>
    </div>
    <p class="bp-quote">"{1 poëtische zin die de essentie van deze persoon vat}"</p>
  </div>
</div>

<div class="orn">· · · ◦ · · ·</div>

<!-- SECTIE 01 -->
<section class="section" id="vision">
  <div class="sec-num">01 — Visie &amp; Missie</div>
  <h2>De SZINN <em>Filosofie</em></h2>
  <p>SZINN staat voor Samenkomst van Ziel, Intentie, Numerologie en Natalkaart. Het is geen voorspellingsmodel, maar een navigatieinstrument — een spiegel die laat zien wie je al bent en wat er wacht om bewust geleefd te worden.</p>
  <p>Dit document is geen handleiding voor de perfecte versie van jezelf. Het is een uitnodiging om de patronen te zien die al altijd in je leven aanwezig zijn geweest, en om van daaruit bewuster te kiezen hoe je beweegt.</p>
  <p>Elk getal, elke planeetpositie, elke knooppuntrichting is een kompas — geen oordeel. Jij bent altijd de kapitein van je eigen schip.</p>
  <blockquote>"Alignment is niet het vinden van de juiste weg. Het is herkennen dat je er al op staat."</blockquote>
</section>

<div class="orn">· · · ◦ · · ·</div>

<!-- SECTIE 02 -->
<section class="section" id="introduction">
  <div class="sec-num">02 — Introductie</div>
  <h2>Welkom, <em>{VOORNAAM}</em></h2>
  <p>{Persoonlijke introductie van 3-4 stevige alinea's. Verweef Zon-teken, Maan-teken en Ascendant tot een coherent portret. Benoem concrete energetische kwaliteiten. Refereer aan de antwoorden die de persoon gaf — wat houdt hen bezig, waarnaar verlangen ze — en laat zien hoe dat spiegelt in de kaart.}</p>
  <p>{Tweede alinea: De spanning en het geschenk van hun dominante element en modaliteit.}</p>
  <p>{Derde alinea: Het thema van dit specifieke leven op basis van levenspad + persoonlijk jaar.}</p>
  <div class="note"><p>Dit document is met zorg samengesteld uit jouw geboortedata, naam en de vragen die jij beantwoordde. Alles wat je hier leest is bedoeld als spiegel — neem wat resoneert, laat de rest.</p></div>
</section>

<div class="orn">· · · ◦ · · ·</div>

<!-- SECTIE 03 -->
<section class="section" id="flow">
  <div class="sec-num">03 — Flow · Sin · Sinn · Zin</div>
  <h2>De drie <em>lagen</em> van jouw energie</h2>
  <h3>Sin — Intuïtie &amp; Drijfveer</h3>
  <p>{2 alinea's over de intuïtieve laag van deze persoon op basis van Maan-positie en zielsverlangensgetal. Wat drijft hen van binnenuit?}</p>
  <h3>Sinn — Zintuigen &amp; Expressie</h3>
  <p>{2 alinea's over hoe de persoon energie uitdrukt via Zon, Ascendant en expressiengetal. Hoe manifesteert hun energie zich in de wereld?}</p>
  <h3>Zin — Betekenis &amp; Richting</h3>
  <p>{2 alinea's over de diepere betekenislaag — wat wil dit leven betekenen? Verbind Noordknoop-thema met het levenspadgetal.}</p>
</section>

<div class="orn">· · · ◦ · · ·</div>

<!-- SECTIE 04 -->
<section class="section" id="astrology">
  <div class="sec-num">04 — Geboortekaart &amp; Astrologie</div>
  <h2>Jouw astrologische <em>Blauwdruk</em></h2>
  <p>{Inleiding van 2 alinea's over de globale indruk van de kaart — dominant element, modaliteit, opvallende clusters of patronen.}</p>
  <h3>Planeetposities</h3>
  <table class="ptab">
    <thead><tr><th>Planeet</th><th>Teken</th><th>Graad</th><th>Element</th><th>Modaliteit</th></tr></thead>
    <tbody>
      {Vul alle planeten in als <tr><td>Naam</td><td>Teken</td><td>X°Y'</td><td>Element</td><td>Modaliteit</td></tr>}
    </tbody>
  </table>
  <h3>Zon in {ZON_TEKEN}</h3>
  <p>{3 alinea's over de Zon-positie: kernidentiteit, levensdoel, hoe deze energie zich uitdrukt, licht én schaduw.}</p>
  <h3>Maan in {MAAN_TEKEN}</h3>
  <p>{2-3 alinea's over de Maan: emotionele aard, behoeften, hoe de persoon omgaat met gevoel en veiligheid.}</p>
  <h3>Ascendant in {ASC_TEKEN}</h3>
  <p>{2 alinea's over de Ascendant: hoe de wereld hen ervaart, hun sociale masker, de eerste indruk die zij maken.}</p>
  <h3>Persoonlijke planeten</h3>
  <p>{2-3 alinea's over Mercurius (denken/communiceren), Venus (liefde/waarden) en Mars (actie/drijfveer).}</p>
  <h3>Sociale &amp; transpersoonlijke planeten</h3>
  <p>{2 alinea's over Jupiter (groei/geluk), Saturnus (lessen/structuur) en eventueel Uranus/Neptunus/Pluto als ze opvallend gepositioneerd zijn.}</p>
</section>

<div class="orn">· · · ◦ · · ·</div>

<!-- SECTIE 05 -->
<section class="section" id="nodes">
  <div class="sec-num">05 — Noord &amp; Zuidknoop</div>
  <h2>De as van <em>zielevolutie</em></h2>
  <p>{2 alinea's over de betekenis van de knooppuntas in het algemeen — van where je vandaan komt (ZK) naar waar je naartoe groeit (NK).}</p>
  <h3>Zuidknoop in {ZK_TEKEN} — Wat je meebrengt</h3>
  <p>{3 alinea's: de kwaliteiten en patronen die je uit vorige levens/vroege leven meebrengt. Wat je automatisch doet. Welk comfort dit biedt. Maar ook: waarom dit niet meer jouw groeirichting is.}</p>
  <h3>Noordknoop in {NN_TEKEN} — Waarheen je groeit</h3>
  <p>{3 alinea's: de uitnodiging van de Noordknoop. Welke kwaliteiten wachten op bewuste ontwikkeling. Concreet gedrag en keuzes die passen bij de NK-richting.}</p>
  <div class="note"><p>De Noordknoop voelt vaak onwennig — dat is het teken dat je er naar toe beweegt. Elke stap die ongemakkelijk voelt in de NK-richting is een stap die de ziel beloont.</p></div>
</section>

<div class="orn">· · · ◦ · · ·</div>

<!-- SECTIE 06 -->
<section class="section" id="numerology">
  <div class="sec-num">06 — Numerologie</div>
  <h2>De taal van <em>getallen</em></h2>
  <p>{Inleiding 2 alinea's over hoe de naam en geboortedatum samen een energetisch profiel vormen.}</p>
  <div class="ngrid">
    <div class="ncell">
      <div class="nlbl">Levenspad</div>
      <div class="nval">{LP}</div>
      <div class="ndesc">{LP_NAAM}</div>
    </div>
    <div class="ncell">
      <div class="nlbl">Expressie</div>
      <div class="nval">{EXP}</div>
      <div class="ndesc">{EXP_NAAM}</div>
    </div>
    <div class="ncell">
      <div class="nlbl">Zielsverlangens</div>
      <div class="nval">{SU}</div>
      <div class="ndesc">{SU_NAAM}</div>
    </div>
    <div class="ncell">
      <div class="nlbl">Persoonlijkheid</div>
      <div class="nval">{PERS}</div>
      <div class="ndesc">{PERS_NAAM}</div>
    </div>
    <div class="ncell">
      <div class="nlbl">Geboortedag</div>
      <div class="nval">{BD}</div>
      <div class="ndesc">{BD beschrijving}</div>
    </div>
    <div class="ncell">
      <div class="nlbl">Persoonlijk Jaar</div>
      <div class="nval">{PY}</div>
      <div class="ndesc">{PY_THEMA}</div>
    </div>
  </div>
  <div class="nsplit">
    <div class="ncard">
      <div class="ncard-lbl">Levenspad {LP}</div>
      <h3>{LP_NAAM}</h3>
      <p>{3-4 alinea's: wat dit levenspad betekent, zijn gaven, valkuilen, hoe het zich uit in relaties, werk en zelfexpressie.}</p>
    </div>
    <div class="ncard">
      <div class="ncard-lbl">Persoonlijk Jaar {PY} · {JAAR}</div>
      <h3>{PY_THEMA}</h3>
      <p>{3-4 alinea's: wat dit jaar in petto heeft, welke energie beschikbaar is, wat dit vraagt van de persoon, hoe het samenspel met het levenspad eruitziet.}</p>
    </div>
  </div>
</section>

<div class="orn">· · · ◦ · · ·</div>

<!-- SECTIE 07 -->
<section class="section" id="tikkun">
  <div class="sec-num">07 — Tikkun Olam · Zielsheling</div>
  <h2>De wond die de <em>gave</em> draagt</h2>
  <p>{Inleiding: uitleg van het concept Tikkun — de zielenopgave die voortkomt uit de Zuidknoop + eventuele Saturnus-positie + Chiron (als bekend). De wond die heelt door er bewust mee te werken.}</p>
  <p>{2-3 alinea's over de specifieke Tikkun van deze persoon: welk oud patroon wacht op heling, welke kwaliteiten werden onderontwikkeld, hoe dit doorwerkt in het huidige leven.}</p>
  <h3>Van wond naar gave</h3>
  <p>{2 alinea's: hoe de wond, eenmaal bewust gemaakt, de grootste gave wordt. Concrete handvatten.}</p>
  <div class="gifts-grid">
    <div class="gift-card">
      <div class="gift-num">Gave 01</div>
      <div class="gift-title">{GAVE_1_TITEL}</div>
      <div class="gift-body">{2 zinnen over deze gave.}</div>
    </div>
    <div class="gift-card">
      <div class="gift-num">Gave 02</div>
      <div class="gift-title">{GAVE_2_TITEL}</div>
      <div class="gift-body">{2 zinnen over deze gave.}</div>
    </div>
    <div class="gift-card">
      <div class="gift-num">Gave 03</div>
      <div class="gift-title">{GAVE_3_TITEL}</div>
      <div class="gift-body">{2 zinnen over deze gave.}</div>
    </div>
    <div class="gift-card">
      <div class="gift-num">Gave 04</div>
      <div class="gift-title">{GAVE_4_TITEL}</div>
      <div class="gift-body">{2 zinnen over deze gave.}</div>
    </div>
  </div>
</section>

<div class="orn">· · · ◦ · · ·</div>

<!-- SECTIE 08 — Mandala (SVG placeholder inserted server-side) -->
<section class="mandala-sec" id="mandala">
  <div class="sec-num" style="text-align:center">08 — De Mandala van jouw Ziel</div>
  <h2 style="text-align:center;font-family:'Cormorant Garamond',serif;font-weight:300;font-size:clamp(1.9rem,3vw,2.7rem);color:var(--ink);margin-bottom:16px">Jouw <em>Geboortekaart</em></h2>
  <p style="text-align:center;max-width:560px;margin:0 auto 8px;font-size:13px;color:var(--muted)">Een weerspiegeling van de hemelstand op het moment van jouw geboorte. Elke planeet een instrument in het orkest van jouw bewustzijn.</p>
  {{MANDALA_SVG}}
  <p style="text-align:center;font-size:12px;color:var(--muted);max-width:480px;margin:0 auto">De Merkaba — heilige geometrie van het bewustzijn. Het bovenste driehoek vertegenwoordigt het goddelijke dat daalt; het onderste driehoek de materie die opstijgt.</p>
</section>

<div class="orn">· · · ◦ · · ·</div>

<!-- SECTIE 09 -->
<section class="section" id="summary">
  <div class="sec-num">09 — Samenvatting &amp; Kern-overzicht</div>
  <h2>Jouw <em>essentie</em> in lagen</h2>
  <div class="sum-grid">
    <div class="sum-card">
      <div class="sum-lbl">Astrologisch profiel</div>
      <div class="sum-val">{ZON_TEKEN} Zon · {MAAN_TEKEN} Maan · {ASC_TEKEN} Asc</div>
      <div class="sum-body">{2 zinnen samenvatting astrologische identiteit.}</div>
    </div>
    <div class="sum-card">
      <div class="sum-lbl">Numerologisch profiel</div>
      <div class="sum-val">LP {LP} · Exp {EXP} · PJ {PY}</div>
      <div class="sum-body">{2 zinnen samenvatting numerologische energie.}</div>
    </div>
    <div class="sum-card">
      <div class="sum-lbl">Zielsrichting</div>
      <div class="sum-val">NK {NN_TEKEN} · ZK {ZK_TEKEN}</div>
      <div class="sum-body">{2 zinnen over de richting van groei.}</div>
    </div>
    <div class="sum-card">
      <div class="sum-lbl">Huidig momentum</div>
      <div class="sum-val">Persoonlijk Jaar {PY} · {PY_THEMA}</div>
      <div class="sum-body">{2 zinnen over het huidige tijdvenster.}</div>
    </div>
  </div>
  <p>{2-3 afsluitende alinea's die alles samenbrengen: het patroon dat zichtbaar wordt als je astrologie + numerologie + knopen naast elkaar legt. Wat is het centrale thema van dit leven op dit moment?}</p>
</section>

<div class="orn">· · · ◦ · · ·</div>

<!-- SECTIE 10 -->
<section class="section" id="reflection">
  <div class="sec-num">10 — Reflectievragen</div>
  <h2>Vragen die <em>bewegen</em></h2>
  <p>Deze vragen zijn samengesteld op basis van jouw unieke blueprint. Ze zijn niet bedoeld om te beantwoorden in je hoofd — maar om mee te zitten, erover te schrijven, of te voelen welke het meest raken.</p>
  <ul class="q-list">
    <li><span class="q-num">1</span>{Persoonlijke vraag op basis van Zon-teken en intenties}</li>
    <li><span class="q-num">2</span>{Vraag over Maan-behoeften vs. uiterlijke focus}</li>
    <li><span class="q-num">3</span>{Vraag over Zuidknoop-patronen die mogelijk herhaald worden}</li>
    <li><span class="q-num">4</span>{Vraag over Noordknoop-uitnodiging: wat vermijd je?}</li>
    <li><span class="q-num">5</span>{Vraag over levenspad in relatie tot werk/missie}</li>
    <li><span class="q-num">6</span>{Vraag over persoonlijk jaar-thema en actuele situatie}</li>
    <li><span class="q-num">7</span>{Vraag over Tikkun/schaduwwerk}</li>
    <li><span class="q-num">8</span>{Vraag die alles samentrekt: als je dit alles wist, wat zou je morgen anders doen?}</li>
  </ul>
</section>

<div class="orn">· · · ◦ · · ·</div>

<!-- SECTIE 11 -->
<section class="section" id="energy">
  <div class="sec-num">11 — Werken met jouw Energie</div>
  <h2>Jouw <em>Energieprofiel</em></h2>
  <p>{Inleiding: hoe element + modaliteit + Maan een specifiek energiepatroon creëren dat om bewuste omgang vraagt.}</p>
  <div class="energy-grid">
    <div class="energy-card">
      <div class="energy-lbl">Opladen</div>
      <div class="energy-title">{TITEL_OPLADEN}</div>
      <div class="energy-body">{2 zinnen: concrete activiteiten / omgevingen die energie geven voor dit profiel.}</div>
    </div>
    <div class="energy-card">
      <div class="energy-lbl">Signalen van overbelasting</div>
      <div class="energy-title">{TITEL_OVERBELASTING}</div>
      <div class="energy-body">{2 zinnen: hoe deze persoon specifiek uitgeput raakt en wat dat zichtbaar maakt.}</div>
    </div>
    <div class="energy-card">
      <div class="energy-lbl">Herstelpraktijk</div>
      <div class="energy-title">{TITEL_HERSTEL}</div>
      <div class="energy-body">{2 zinnen: concrete herstelaanpak passend bij dit energieprofiel.}</div>
    </div>
  </div>
  <h3>Dagelijks ritme</h3>
  <p>{2 alinea's over een energetisch gunstig dagritme gebaseerd op de kaart en numerologie. Concreet en praktisch.}</p>
</section>

<div class="orn">· · · ◦ · · ·</div>

<!-- SECTIE 12 -->
<section class="section" id="integration">
  <div class="sec-num">12 — Integratie</div>
  <h2>Werken met je <em>Blueprint</em></h2>
  <p>Kennis zonder toepassing is architectuur zonder bewoners. In dit hoofdstuk vind je drie lagen van integratie: dagelijkse praktijken, AI-prompts om dieper te gaan, en een persoonlijke maandkalender.</p>

  <h3>Praktijken</h3>
  <div class="practice">
    <div class="practice-num">Praktijk 01 — Dagelijks</div>
    <div class="practice-title">{PRAKTIJK_1_TITEL}</div>
    <div class="practice-body">{3-4 zinnen: concrete dagelijkse oefening passend bij de kaart/getallen.}</div>
  </div>
  <div class="practice">
    <div class="practice-num">Praktijk 02 — Wekelijks</div>
    <div class="practice-title">{PRAKTIJK_2_TITEL}</div>
    <div class="practice-body">{3-4 zinnen: wekelijkse integratie-activiteit.}</div>
  </div>
  <div class="practice">
    <div class="practice-num">Praktijk 03 — Maandelijks</div>
    <div class="practice-title">{PRAKTIJK_3_TITEL}</div>
    <div class="practice-body">{3-4 zinnen: maandelijkse reflectie of ritueel.}</div>
  </div>

  <h3 style="margin-top:2rem">AI-Companion Prompts</h3>
  <p style="font-size:13px;color:var(--muted)">Gebruik deze prompts in Claude of ChatGPT om dieper op je blueprint in te gaan.</p>
  <div class="ptitle">Prompt 01 — Zelfonderzoek</div>
  <div class="prompt"><div class="plbl">Kopieer naar AI</div><p>{Gedetailleerde prompt over de Zon/Maan/Ascendant-combinatie en wat dit betekent voor het dagelijkse leven van {VOORNAAM}. Vraag om concrete voorbeelden.}</p><button class="copy-btn" onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent)">Kopieer</button></div>
  <div class="ptitle">Prompt 02 — Knopen &amp; Groei</div>
  <div class="prompt"><div class="plbl">Kopieer naar AI</div><p>{Prompt over de Noord/Zuidknoop-as specifiek voor {VOORNAAM} — vraag om concrete scenario's uit het dagelijks leven waar de ZK-pull vs NK-uitnodiging zichtbaar is.}</p><button class="copy-btn" onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent)">Kopieer</button></div>
  <div class="ptitle">Prompt 03 — Persoonlijk Jaar</div>
  <div class="prompt"><div class="plbl">Kopieer naar AI</div><p>{Prompt over het persoonlijk jaar {PY} voor {VOORNAAM} — vraag om concrete maandthema's en aandachtspunten voor de komende periode.}</p><button class="copy-btn" onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent)">Kopieer</button></div>

  <h3 style="margin-top:2rem">Persoonlijke Maandkalender</h3>
  <p style="font-size:13px;color:var(--muted)">Gebaseerd op jouw persoonlijke maandgetallen voor de komende periode.</p>
  <div class="cal-grid">
    {{CALENDAR_MONTHS}}
  </div>
</section>

<div class="orn">· · · ◦ · · ·</div>

<!-- SECTIE 13 -->
<section class="section" id="deepening">
  <div class="sec-num">13 — Verdieping</div>
  <h2>Verder op de <em>weg</em></h2>
  <p>Dit document is een beginpunt, geen eindbestemming. De echte alignment ontstaat in de dagelijkse keuze om bewust te leven — niet perfect, maar present.</p>
  <div class="deep-grid">
    <div class="deep-card">
      <div class="deep-num">Verdieping 01</div>
      <div class="deep-title">Astrologie</div>
      <div class="deep-body">Werk met je geboortekaart als een levend document. Houd een astrologisch dagboek bij en noteer wanneer je de energie van je planeten voelt.</div>
    </div>
    <div class="deep-card">
      <div class="deep-num">Verdieping 02</div>
      <div class="deep-title">Numerologie</div>
      <div class="deep-body">Bereken de persoonlijke maandgetallen voor elk kwartaal en gebruik ze als thema voor je maandelijkse reflectie.</div>
    </div>
    <div class="deep-card">
      <div class="deep-num">Verdieping 03</div>
      <div class="deep-title">Lichaamspraktijk</div>
      <div class="deep-body">Alignment begint in het lichaam. Kies een dagelijkse bewegingspraktijk die past bij jouw element en maandthema.</div>
    </div>
  </div>
  <p style="margin-top:2rem">{Afsluitend woord van 2-3 alinea's. Persoonlijk, warm, aanmoedigend. Refereert aan de specifieke journey van {VOORNAAM} zoals zichtbaar in de blueprint.}</p>
  <blockquote>"Jij bent niet op weg naar alignment. Je bent alignment — die zichzelf herinnert."</blockquote>
</section>

<footer>
  <div class="fc">SZINN · Alignment Blueprint</div>
  <p>Persoonlijk samengesteld voor {NAAM} · {JAAR}<br>
  Geboortedatum: {GEBOORTEDATUM} · {GEBOORTEPLAATS}<br>
  <br>
  Dit document is uitsluitend bedoeld voor persoonlijk gebruik.<br>
  © {JAAR} SZINN · Alle rechten voorbehouden · szinn.ai</p>
</footer>

<!-- SZINN_SCORES: {"alignment":XX,"astro":XX,"numerology":XX,"soulDirection":XX,"personalYear":XX} -->
</body>
</html>

VERVANG ALLE {PLACEHOLDERS} met echte, rijke, persoonlijke content gebaseerd op de verstrekte data.
Elke sectie minimaal 3 stevige alinea's — dit is een premium document.
Genereer ALLEEN de HTML — geen uitleg, geen markdown, geen code blocks.`;

// ─── User Prompt Builder ───────────────────────────────────────────────────────

function buildUserPrompt(intake, chart, numerology, scoreLabels) {
  const p = chart.planets;
  const n = numerology;

  const planetRows = ['sun','moon','mercury','venus','mars','jupiter','saturn',
    'uranus','neptune','pluto','ascendant','mc','northNode','southNode'
  ].map(k => {
    const pl = p[k]; if (!pl) return '';
    return `  <tr><td>${pl.name}</td><td>${pl.sign}</td><td>${pl.deg || 0}°${pl.min || 0}'</td><td>${pl.element || '—'}</td><td>${pl.modality || '—'}</td></tr>`;
  }).filter(Boolean).join('\n');

  const calHtml = scoreLabels.personalMonths.map(pm => {
    const pmThemes = {
      1:'Nieuw begin',2:'Samenwerking',3:'Expressie',4:'Opbouw',
      5:'Verandering',6:'Verantwoordelijkheid',7:'Reflectie',8:'Oogst',9:'Loslaten'
    };
    return `    <div class="cal-month">
      <div class="cal-month-name">${pm.month} ${pm.year}</div>
      <div class="cal-month-num">${pm.pm}</div>
      <div class="cal-month-theme">${pmThemes[pm.pm] || 'In beweging'}</div>
      <div class="cal-pm">Persoonlijke Maand ${pm.pm}</div>
      <div class="cal-body">Energie en aandacht voor ${pmThemes[pm.pm] || 'beweging'}.</div>
    </div>`;
  }).join('\n');

  const sunInfo = p.sun ? `${p.sun.sign} ${p.sun.deg || 0}°` : 'onbekend';
  const moonInfo = p.moon ? `${p.moon.sign} ${p.moon.deg || 0}°` : 'onbekend';
  const ascInfo = p.ascendant ? `${p.ascendant.sign} ${p.ascendant.deg || 0}°` : 'onbekend';
  const nnInfo = p.northNode ? p.northNode.sign : 'onbekend';
  const snInfo = p.southNode ? p.southNode.sign : 'onbekend';

  return `Genereer een volledige SZINN Alignment Blueprint HTML voor:

## PERSOONSDATA
Naam: ${intake.voornaam} ${intake.achternaam}
Volledige geboortenaam: ${intake.geboortenaam || `${intake.voornaam} ${intake.achternaam}`}
Geboortedatum: ${intake.geboortedatum}
Geboortetijd: ${intake.geboortetijd || 'onbekend'}
Geboorteplaats: ${intake.geboorteplaats_volledig || intake.geboorteplaats}, ${intake.geboorteland}
Taal: ${intake.blueprint_taal === 'en' ? 'Engels' : 'Nederlands'}

## ASTROLOGISCHE KAART
Zon: ${sunInfo}
Maan: ${moonInfo}
Ascendant: ${ascInfo}
MC: ${p.mc ? `${p.mc.sign} ${p.mc.deg || 0}°` : 'onbekend'}
Noordknoop: ${nnInfo}
Zuidknoop: ${snInfo}
Dominant element: ${chart.summary.dominantElement}
Dominant modaliteit: ${chart.summary.dominantModality}

Alle planeten voor de tabel:
${planetRows}

## NUMEROLOGIE
Levenspad: ${n.lifePath} — ${n.lifePathInfo.name} (kernwoord: ${n.lifePathInfo.keyword}, schaduw: ${n.lifePathInfo.challenge})
Expressie: ${n.expression}
Zielsverlangens: ${n.soulUrge}
Persoonlijkheid: ${n.personality}
Geboortedag: ${n.birthday}
Persoonlijk jaar ${n.currentYear}: ${n.personalYear} — ${n.personalYearInfo.theme} (${n.personalYearInfo.energy})

## DASHBOARD LABELS (gebruik exact deze in de score-sec)
Astrologie: "${scoreLabels.astroLabel}"
Numerologie: "${scoreLabels.numLabel}"
Zielrichting: "${scoreLabels.soulLabel}"
Persoonlijk Jaar: "${scoreLabels.pyLabel}"

## PERSOONLIJKE ANTWOORDEN
01. Wat houdt je bezig: ${intake.p1_bezig || '—'}
02. Verlangen & belemmeringen: ${intake.p2_verlangen || '—'}
03. Wat geeft energie: ${intake.p3_energie || '—'}
04. Wat wil je veranderen: ${intake.p4_veranderen || '—'}
05. Tevredenheid & groei: ${intake.p5_tevredenheid || '—'}
06. Werk-gevoel: ${intake.w1_werk_gevoel || '—'}
07. Werk-wensen: ${intake.w2_werk_anders || '—'}
08. Leven over 1 jaar: ${intake.w4_werk_1jaar || '—'}
09. Opladen: ${intake.e1_opladen || '—'}
10. Uitputting: ${intake.e2_uitgeput || '—'}
11. Verbinding: ${intake.r1_verbinding || '—'}
12. Moeilijkst aan verandering: ${intake.z1_moeilijkst || '—'}
13. Ondergaan of creëren: ${intake.b1_ondergaan_creeren || '—'}
14. Angst & loslaten: ${intake.b4_angst_loslaten || '—'}

## KALENDER MAANDEN (inject dit exact als {{CALENDAR_MONTHS}})
${calHtml}

## SVG GEBOORTEKAART (inject dit exact als {{MANDALA_SVG}})
(server-side SVG wordt hieronder aangeleverd — gebruik de placeholder {{MANDALA_SVG}} op de juiste plek in de HTML)

## INSTRUCTIE
Genereer de volledige HTML-pagina op basis van de bovenstaande template in het system-prompt.
- Vervang ALLE {PLACEHOLDERS} met echte data of rijke gegenereerde tekst.
- Laat {{MANDALA_SVG}} en {{CALENDAR_MONTHS}} staan als exacte placeholder-strings — die worden server-side vervangen.
- Elke sectie minimaal 3 stevige alinea's met persoonlijke, concrete tekst.
- Schrijf in het ${intake.blueprint_taal === 'en' ? 'Engels' : 'Nederlands'}.
- Genereer ALLEEN de HTML. Geen uitleg, geen markdown fences.`;
}

// ─── Main Generate Function ────────────────────────────────────────────────────

async function generateBlueprint(orderId, intake, chart, numerology, apiKey, outputDir) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic.default({ apiKey });

  const scoreLabels = getScoreLabels(chart, numerology);
  const svgContent  = generateBirthChartSVG(chart);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8096,
    system: SZINN_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(intake, chart, numerology, scoreLabels) }]
  });

  let html = '';
  for (const block of response.content) {
    if (block.type === 'text') { html = block.text; break; }
  }

  // Strip accidental markdown code fences
  html = html.replace(/^```(?:html)?\n?/i, '').replace(/\n?```\s*$/, '').trim();

  // Inject server-generated SVG and calendar
  const calHtml = scoreLabels.personalMonths.map(pm => {
    const pmThemes = {
      1:'Nieuw begin',2:'Samenwerking',3:'Expressie',4:'Opbouw',
      5:'Verandering',6:'Verantwoordelijkheid',7:'Reflectie',8:'Oogst',9:'Loslaten'
    };
    return `<div class="cal-month">
      <div class="cal-month-name">${pm.month} ${pm.year}</div>
      <div class="cal-month-num">${pm.pm}</div>
      <div class="cal-month-theme">${pmThemes[pm.pm] || 'In beweging'}</div>
      <div class="cal-pm">Persoonlijke Maand ${pm.pm}</div>
      <div class="cal-body">Energie en aandacht voor ${pmThemes[pm.pm] || 'beweging'}.</div>
    </div>`;
  }).join('\n');

  html = html.replace('{{MANDALA_SVG}}', `<div class="mandala-svg">${svgContent}</div>`);
  html = html.replace('{{CALENDAR_MONTHS}}', calHtml);

  // Extract scores
  const scoresMatch = html.match(/<!--\s*SZINN_SCORES:\s*(\{[^}]+\})\s*-->/);
  let scores = { alignment: 72, astro: 75, numerology: 70, soulDirection: 68, personalYear: 74 };
  if (scoresMatch) {
    try { scores = JSON.parse(scoresMatch[1]); } catch {}
  }

  // Save
  const filename = `${orderId}.html`;
  const filepath = path.join(outputDir, filename);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(filepath, html, 'utf8');

  return { filename, filepath, scores };
}

// Build the full copyable prompt for use in Claude.ai (no API needed)
function buildFullPromptForClaudeAI(intake, chart, numerology) {
  const scoreLabels = getScoreLabels(chart, numerology);
  const userPrompt  = buildUserPrompt(intake, chart, numerology, scoreLabels);
  return SZINN_SYSTEM_PROMPT + '\n\n---\n\n' + userPrompt;
}

module.exports = { generateBlueprint, buildFullPromptForClaudeAI, getScoreLabels, generateBirthChartSVG };

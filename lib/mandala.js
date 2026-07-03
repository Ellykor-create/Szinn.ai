'use strict';
// Genereert de SZINN mandala-SVG (680×816) — identiek aan het Barry-referentie-
// ontwerp: flower-of-life-veld, zodiakring, Placidus-huislijnen, planeten op hun
// ecliptische graden en de roterende Merkaba op de knooppunt-as.

const CX = 340, CY = 336;
const SIGN_SYMBOLS = ['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'];
const ELEMENT_COLORS = ['#E07A5A', '#7FB45F', '#E0C457', '#5A9BD9']; // vuur aarde lucht water
const PLANET_SYMBOLS = {
  sun:'☉', moon:'☽', mercury:'☿', venus:'♀', mars:'♂', jupiter:'♃',
  saturn:'♄', uranus:'♅', neptune:'♆', pluto:'♇',
  northNode:'☊', southNode:'☋', chiron:'⚷',
};
const SIGN_NAMES = {
  nl: ['Ram','Stier','Tweeling','Kreeft','Leeuw','Maagd','Weegschaal','Schorpioen','Boogschutter','Steenbok','Waterman','Vissen'],
  en: ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'],
};
const PLANET_LABELS = {
  nl: { sun:'Zon', moon:'Maan', mercury:'Mercurius', venus:'Venus', mars:'Mars', jupiter:'Jupiter', saturn:'Saturnus', uranus:'Uranus', neptune:'Neptunus', pluto:'Pluto', northNode:'Noordknoop', southNode:'Zuidknoop', chiron:'Chiron' },
  en: { sun:'Sun', moon:'Moon', mercury:'Mercury', venus:'Venus', mars:'Mars', jupiter:'Jupiter', saturn:'Saturn', uranus:'Uranus', neptune:'Neptune', pluto:'Pluto', northNode:'North Node', southNode:'South Node', chiron:'Chiron' },
};
const LEGEND_TITLE = { nl: 'PLANETEN · positie in graden', en: 'PLANETS · position in degrees' };
const RIGHTS = { nl: 'Alle rechten voorbehouden', en: 'All rights reserved' };

function fmt(n) { return Number(n.toFixed(1)).toFixed(1); }

function generateMandalaSVG(chart, { lang = 'nl', clientName = '', year = new Date().getFullYear() } = {}) {
  const P = chart.planets;
  const ascLon = P.ascendant ? P.ascendant.lon : 0;
  const theta = (lon) => (180 - (lon - ascLon)) * Math.PI / 180; // schermhoek (y omlaag)
  const pt = (lon, r) => [CX + r * Math.cos(theta(lon)), CY + r * Math.sin(theta(lon))];
  const out = [];

  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 680 816" font-family="sans-serif" role="img">`);
  out.push(`<title>SZINN chart ${esc(clientName)}</title>`);
  out.push(`<defs><radialGradient id="glow" cx="50%" cy="46%" r="60%"><stop offset="0%" stop-color="#3A2E18" stop-opacity="0.85"/><stop offset="55%" stop-color="#17110A" stop-opacity="0.5"/><stop offset="100%" stop-color="#0C0A07" stop-opacity="0"/></radialGradient></defs>`);
  out.push(`<rect x="0" y="0" width="680" height="816" rx="14" fill="#0C0A07"/>`);
  out.push(`<circle cx="${CX}" cy="${CY}" r="330" fill="url(#glow)">` +
    `<animate attributeName="r" values="326;340;326" dur="6s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1"/>` +
    `<animate attributeName="opacity" values="0.82;1;0.82" dur="6s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1"/></circle>`);

  // Flower-of-life: hexrooster, dekking neemt lineair af met afstand tot het hart
  const uy = 52 * Math.sqrt(3) / 2; // 45.033
  for (let i = -10; i <= 10; i++) {
    for (let j = -10; j <= 10; j++) {
      const x = CX + i * 52 + j * 26;
      const y = CY + j * uy;
      const d = Math.hypot(x - CX, y - CY);
      if (d > 240) continue;
      const op = Math.max(0.012, 0.11 * (1 - d / 272));
      out.push(`<circle cx="${fmt(x)}" cy="${fmt(y)}" r="52" fill="none" stroke="#C9A96E" stroke-opacity="${op.toFixed(3)}" stroke-width="0.6"/>`);
    }
  }

  // Ringen
  out.push(`<circle cx="${CX}" cy="${CY}" r="276" fill="none" stroke="#C9A96E" stroke-opacity="0.1" stroke-width="0.7"/>`);
  out.push(`<circle cx="${CX}" cy="${CY}" r="146" fill="none" stroke="#C9A96E" stroke-opacity="0.12" stroke-width="0.7"/>`);
  out.push(`<circle cx="${CX}" cy="${CY}" r="242" fill="none" stroke="#C9A96E" stroke-opacity="0.06" stroke-width="0.7"/>`);

  // Zodiakring: grenslijn + symbool + naam per teken
  const signNames = SIGN_NAMES[lang] || SIGN_NAMES.nl;
  for (let s = 0; s < 12; s++) {
    const [bx1, by1] = pt(s * 30, 276);
    const [bx2, by2] = pt(s * 30, 332);
    out.push(`<line x1="${fmt(bx1)}" y1="${fmt(by1)}" x2="${fmt(bx2)}" y2="${fmt(by2)}" stroke="#9A7B2E" stroke-width="0.8"/>`);
    const mid = s * 30 + 15;
    const [sx, sy] = pt(mid, 314);
    out.push(`<text x="${fmt(sx)}" y="${fmt(sy + 5)}" text-anchor="middle" font-size="17" fill="${ELEMENT_COLORS[s % 4]}" font-family="serif">${SIGN_SYMBOLS[s]}</text>`);
    const [nx, ny] = pt(mid, 296);
    // leesbare rotatie langs de ring
    let rot = ((90 - (180 / Math.PI) * theta(mid)) % 360 + 360) % 360;
    if (rot > 90 && rot < 270) rot = (rot + 180) % 360;
    out.push(`<text x="${fmt(nx)}" y="${fmt(ny)}" text-anchor="middle" dominant-baseline="middle" transform="rotate(${fmt(rot)} ${fmt(nx)} ${fmt(ny)})" font-size="9" letter-spacing="0.4" fill="#EFE6D2" fill-opacity="0.8">${signNames[s]}</text>`);
  }

  // Huislijnen (Placidus) + huisnummers
  const cusps = chart.houseCusps || Array.from({ length: 12 }, (_, h) => (ascLon + h * 30) % 360);
  for (let h = 0; h < 12; h++) {
    const lon = cusps[h];
    const angular = h % 3 === 0; // huizen 1, 4, 7, 10
    const [x1, y1] = pt(lon, 146);
    const [x2, y2] = pt(lon, 276);
    out.push(angular
      ? `<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}" stroke="#C9A96E" stroke-width="1.4" stroke-opacity="0.8"/>`
      : `<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}" stroke="#9A7B2E" stroke-width="0.8" stroke-dasharray="4 3" stroke-opacity="0.6"/>`);
    const next = cusps[(h + 1) % 12];
    const span = ((next - lon) % 360 + 360) % 360;
    const [tx, ty] = pt(lon + span / 2, 163);
    out.push(`<text x="${fmt(tx)}" y="${fmt(ty + 3)}" text-anchor="middle" font-size="10" fill="#6A5C40">${h + 1}</text>`);
  }

  // AC / MC / DC / IC
  const axes = [[cusps[0], 'AC'], [cusps[9], 'MC'], [(cusps[0] + 180) % 360, 'DC'], [cusps[3], 'IC']];
  for (const [lon, lbl] of axes) {
    const [x, y] = pt(lon, 336);
    out.push(`<text x="${fmt(x)}" y="${fmt(y + 3)}" text-anchor="middle" font-size="11" font-weight="bold" fill="#E8D5A8">${lbl}</text>`);
  }

  // Planeten (met kleine spreiding bij overlap)
  const keys = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto','chiron'];
  const used = [];
  for (const key of keys) {
    const p = P[key];
    if (!p || p.sign === '?') continue;
    let lon = p.lon;
    for (const u of used) {
      const diff = ((lon - u) % 360 + 540) % 360 - 180;
      if (Math.abs(diff) < 5) lon = u + (diff >= 0 ? 5 : -5);
    }
    used.push(lon);
    const [lx1, ly1] = pt(lon, 232);
    const [px, py] = pt(lon, 250);
    out.push(`<line x1="${fmt(lx1)}" y1="${fmt(ly1)}" x2="${fmt(px)}" y2="${fmt(py)}" stroke="#6A5C40" stroke-width="0.6" stroke-opacity="0.7"/>`);
    out.push(`<text x="${fmt(px)}" y="${fmt(py + 5)}" text-anchor="middle" font-size="15" fill="#EFE6D2" font-family="serif">${PLANET_SYMBOLS[key]}</text>`);
    if (p.retrograde) out.push(`<text x="${fmt(px + 9)}" y="${fmt(py - 7)}" text-anchor="middle" font-size="7" fill="#C9A96E">℞</text>`);
  }
  // Knopen krachtiger gemarkeerd
  for (const key of ['northNode', 'southNode']) {
    const p = P[key];
    if (!p) continue;
    const [lx1, ly1] = pt(p.lon, 232);
    const [px, py] = pt(p.lon, 250);
    out.push(`<line x1="${fmt(lx1)}" y1="${fmt(ly1)}" x2="${fmt(px)}" y2="${fmt(py)}" stroke="#6A5C40" stroke-width="0.6" stroke-opacity="0.7"/>`);
    out.push(`<circle cx="${fmt(px)}" cy="${fmt(py)}" r="12" fill="#E8C36A" fill-opacity="0.35"/>`);
    out.push(`<text x="${fmt(px)}" y="${fmt(py + 5)}" text-anchor="middle" font-size="17" fill="#E8D5A8" font-family="serif">${PLANET_SYMBOLS[key]}</text>`);
  }

  // Merkaba op de knooppunt-as (statisch beginframe + animatiescript)
  out.push(merkaba(theta(P.northNode ? P.northNode.lon : 0)));

  // Legenda
  out.push(`<text x="${CX}" y="700" text-anchor="middle" font-size="10" letter-spacing="1.5" fill="#C9A96E">${LEGEND_TITLE[lang] || LEGEND_TITLE.nl}</text>`);
  const labels = PLANET_LABELS[lang] || PLANET_LABELS.nl;
  const legendKeys = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto','northNode','southNode','chiron'];
  legendKeys.forEach((key, idx) => {
    const p = P[key];
    if (!p || p.sign === '?') return;
    const col = idx % 5, row = Math.floor(idx / 5);
    const x = 24 + col * 128, y = 722 + row * 30;
    const signIdx = Math.floor((((p.lon % 360) + 360) % 360) / 30);
    const degStr = `${p.deg}°${String(p.min).padStart(2, '0')}'${SIGN_SYMBOLS[signIdx]}${p.retrograde ? ' ℞' : ''}`;
    out.push(`<text x="${x}" y="${y}" font-size="13" fill="#E8D5A8" font-family="serif">${PLANET_SYMBOLS[key]}</text>`);
    out.push(`<text x="${x + 15}" y="${y}" font-size="10" fill="#EFE6D2">${labels[key]}</text>`);
    out.push(`<text x="${x + 15}" y="${y + 13}" font-size="9.5" fill="#C9A96E">${degStr}</text>`);
  });

  out.push(`<text x="${CX}" y="808" text-anchor="middle" font-size="8" fill="#6A5C40">© ${year} Elly Elizabeth Korving · Alterego BV · ${RIGHTS[lang] || RIGHTS.nl} · szinn.ai</text>`);
  out.push('</svg>');
  return out.join('');
}

// Statisch beginframe van de Merkaba + het rotatiescript, uitgelijnd op de
// knooppunt-as. thNN = schermhoek (radialen) van de Noordknoop.
function merkaba(thNN) {
  const cP = Math.cos(22 * Math.PI / 180), sP = Math.sin(22 * Math.PI / 180);
  const Rm = 146 / (0.92 * cP);
  const cB = -Math.sin(thNN), sB = Math.cos(thNN);
  const Vu = [[0, 0.92, 0], [0.7967433714816836, -0.46, 0.2], [-0.7967433714816834, -0.46, 0.2]];
  const Vd = [[0, -0.92, 0], [0.7967433714816835, 0.46, -0.2], [-0.7967433714816835, 0.46, -0.2]];
  const pj = (v) => {
    const yr = v[1] * cP - v[2] * sP;
    const ox = Rm * v[0], oy = -Rm * yr;
    return [CX + (ox * cB - oy * sB), CY + (ox * sB + oy * cB)];
  };
  const U = Vu.map(pj), D = Vd.map(pj);
  const pts = (T) => T.map(p => `${fmt(p[0])},${fmt(p[1])}`).join(' ');
  const script = `(function(){var CX=${CX},CY=${CY},cP=${cP},sP=${sP},Rm=${Rm.toFixed(2)},cB=${cB},sB=${sB};var Vu=${JSON.stringify(Vu)},Vd=${JSON.stringify(Vd)};function pj(v,th){var c=Math.cos(th),s=Math.sin(th);var x=v[0]*c+v[2]*s,y=v[1],z=-v[0]*s+v[2]*c;var yr=y*cP-z*sP,zr=y*sP+z*cP;var ox=Rm*x,oy=-Rm*yr;return{sx:CX+(ox*cB-oy*sB),sy:CY+(ox*sB+oy*cB),zr:zr};}function set(id,a){var e=document.getElementById(id);if(!e)return;for(var k in a)e.setAttribute(k,a[k]);}var E=[[0,1],[1,2],[2,0]];function frame(th){var U=Vu.map(function(v){return pj(v,th);}),D=Vd.map(function(v){return pj(v,th);});set("triUp",{points:U.map(function(p){return p.sx.toFixed(1)+","+p.sy.toFixed(1);}).join(" ")});set("triDn",{points:D.map(function(p){return p.sx.toFixed(1)+","+p.sy.toFixed(1);}).join(" ")});var mU=(U[0].zr+U[1].zr+U[2].zr)/3,mD=(D[0].zr+D[1].zr+D[2].zr)/3;var tu=document.getElementById("triUp"),td=document.getElementById("triDn"),par=tu.parentNode;if(mU<mD)par.insertBefore(tu,td);else par.insertBefore(td,tu);E.forEach(function(e,k){set("ue"+k,{x1:U[e[0]].sx.toFixed(1),y1:U[e[0]].sy.toFixed(1),x2:U[e[1]].sx.toFixed(1),y2:U[e[1]].sy.toFixed(1)});});E.forEach(function(e,k){set("de"+k,{x1:D[e[0]].sx.toFixed(1),y1:D[e[0]].sy.toFixed(1),x2:D[e[1]].sx.toFixed(1),y2:D[e[1]].sy.toFixed(1)});});set("axis",{x1:U[0].sx.toFixed(1),y1:U[0].sy.toFixed(1),x2:D[0].sx.toFixed(1),y2:D[0].sy.toFixed(1)});set("aNN",{cx:U[0].sx.toFixed(1),cy:U[0].sy.toFixed(1)});set("aSN",{cx:D[0].sx.toFixed(1),cy:D[0].sy.toFixed(1)});set("up1",{cx:U[1].sx.toFixed(1),cy:U[1].sy.toFixed(1)});set("up2",{cx:U[2].sx.toFixed(1),cy:U[2].sy.toFixed(1)});set("dp1",{cx:D[1].sx.toFixed(1),cy:D[1].sy.toFixed(1)});set("dp2",{cx:D[2].sx.toFixed(1),cy:D[2].sy.toFixed(1)});}if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches){frame(0);return;}var th=0,last=performance.now();(function loop(now){var dt=(now-last)/1000;last=now;th+=dt*(2*Math.PI/26);frame(th);requestAnimationFrame(loop);})(performance.now());})();`;
  return `<g id="merkaba">` +
    `<animate attributeName="opacity" values="0.78;1;0.78" dur="6s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1"/>` +
    `<line id="axis" x1="${fmt(U[0][0])}" y1="${fmt(U[0][1])}" x2="${fmt(D[0][0])}" y2="${fmt(D[0][1])}" stroke="#E8D5A8" stroke-width="1" stroke-dasharray="1 5" stroke-opacity="0.45"/>` +
    `<polygon id="triDn" fill="#A07CC4" fill-opacity="0.24" points="${pts(D)}"/>` +
    `<polygon id="triUp" fill="#C9A96E" fill-opacity="0.24" points="${pts(U)}"/>` +
    `<line id="ue0" x1="${fmt(U[0][0])}" y1="${fmt(U[0][1])}" x2="${fmt(U[1][0])}" y2="${fmt(U[1][1])}" stroke="#E8D5A8" stroke-width="2" stroke-linecap="round"/>` +
    `<line id="ue1" x1="${fmt(U[1][0])}" y1="${fmt(U[1][1])}" x2="${fmt(U[2][0])}" y2="${fmt(U[2][1])}" stroke="#E8D5A8" stroke-width="2" stroke-linecap="round"/>` +
    `<line id="ue2" x1="${fmt(U[2][0])}" y1="${fmt(U[2][1])}" x2="${fmt(U[0][0])}" y2="${fmt(U[0][1])}" stroke="#E8D5A8" stroke-width="2" stroke-linecap="round"/>` +
    `<line id="de0" x1="${fmt(D[0][0])}" y1="${fmt(D[0][1])}" x2="${fmt(D[1][0])}" y2="${fmt(D[1][1])}" stroke="#CBB6E2" stroke-width="2" stroke-linecap="round"/>` +
    `<line id="de1" x1="${fmt(D[1][0])}" y1="${fmt(D[1][1])}" x2="${fmt(D[2][0])}" y2="${fmt(D[2][1])}" stroke="#CBB6E2" stroke-width="2" stroke-linecap="round"/>` +
    `<line id="de2" x1="${fmt(D[2][0])}" y1="${fmt(D[2][1])}" x2="${fmt(D[0][0])}" y2="${fmt(D[0][1])}" stroke="#CBB6E2" stroke-width="2" stroke-linecap="round"/>` +
    `<circle id="aNN" cx="${fmt(U[0][0])}" cy="${fmt(U[0][1])}" r="5" fill="#C9A96E" stroke="#9A7B2E"/>` +
    `<circle id="aSN" cx="${fmt(D[0][0])}" cy="${fmt(D[0][1])}" r="5" fill="#A07CC4" stroke="#6E4E9E"/>` +
    `<circle id="up1" cx="${fmt(U[1][0])}" cy="${fmt(U[1][1])}" r="3" fill="#C9A96E"/>` +
    `<circle id="up2" cx="${fmt(U[2][0])}" cy="${fmt(U[2][1])}" r="3" fill="#C9A96E"/>` +
    `<circle id="dp1" cx="${fmt(D[1][0])}" cy="${fmt(D[1][1])}" r="3" fill="#A07CC4"/>` +
    `<circle id="dp2" cx="${fmt(D[2][0])}" cy="${fmt(D[2][1])}" r="3" fill="#A07CC4"/>` +
    `<script><![CDATA[${script}]]><\/script></g>`;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = { generateMandalaSVG };

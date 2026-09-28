'use strict';
// Blueprints worden als kant-en-klare HTML bewaard. Bestanden die vóór het
// burgermenu zijn gerenderd hebben nog de brede navigatiebalk en lopen op
// mobiel buiten beeld. Deze upgrade zet dezelfde markup + CSS er alsnog in bij
// het uitserveren (en vóór de PDF-render), zodat bestaande blueprints niet
// opnieuw gegenereerd hoeven te worden.

const BURGER =
  '<input type="checkbox" id="nav-toggle" class="nav-toggle" aria-label="Menu">' +
  '<label for="nav-toggle" class="nav-burger" aria-hidden="true">&#9776;</label>';

// Staat ná de eigen <style> van de blueprint, dus deze regels winnen bij
// gelijke specificiteit — nodig om de oude print-regel (nav verbergen) te
// overschrijven.
const STYLE = `<style>
.nav-toggle{position:absolute;width:1px;height:1px;opacity:0;margin:0}
.nav-burger{display:none;color:var(--ink);font-size:20px;line-height:1;cursor:pointer;padding:2px 0 2px 12px;user-select:none}
.nav-toggle:focus-visible+.nav-burger{outline:2px solid var(--gold);outline-offset:2px}
@media(max-width:760px){
  nav{grid-template-columns:1fr auto;gap:0}
  .nav-burger{display:block;justify-self:end}
  .nav-date{display:none}
  .nav-links{display:none;grid-column:1/-1;grid-auto-flow:row;grid-template-rows:none;grid-template-columns:1fr 1fr;gap:2px 14px;padding:8px 0 2px}
  .nav-toggle:checked~.nav-links{display:grid}
  .nav-link.verdieping{grid-column:auto;grid-row:auto}
}
@media print{
  /* Geen burgermenu in de PDF: daar staan alle secties uitgeschreven. */
  nav{display:grid!important;position:static!important;break-inside:avoid;page-break-inside:avoid}
  /* De naam/jaar rechts past niet naast 13 links op A4 en zou over de
     paginarand lopen; hij staat een paar centimeter lager toch al in de hero. */
  .nav-burger,.nav-toggle,.nav-date{display:none!important}
  .nav-links{display:grid!important}
}
</style>`;

// De blueprint is donker. De download-PDF (lib/pdf.js) print mét achtergronden
// en zet .pdf-export; de printknop in de viewer is een gewone browserprint, en
// die laat achtergronden standaard weg: dan viel de lichte tekst op wit papier
// weg. Zonder .pdf-export daarom inkt op papier. Staat ook in oude blueprints
// niet, dus altijd meegeven bij het uitserveren.
const PAPIER = `<style id="bp-papier">
@media print{
  html:not(.pdf-export){--cream:#fff;--ink:#1E1812;--muted:#3F352C;--gold:#7A5C1E;--goldl:#7A5C1E;
    --gold2:#7A5C1E;--border:rgba(122,92,30,.32);--card:#fff}
  html:not(.pdf-export) body{background:#fff;font-weight:400}
  html:not(.pdf-export) nav{background:#fff;border-top-color:#7A5C1E}
  html:not(.pdf-export) .nav-link{color:#3F352C}
  html:not(.pdf-export) .hero-name,html:not(.pdf-export) .bp-name-big,
  html:not(.pdf-export) .score-header h2,html:not(.pdf-export) .section h2{color:#1E1812}
  html:not(.pdf-export) :is(.hero-ey,.hero-tag,.hcard-eye,.scard-moves,.feedback-label,.sec-num,
    .ptab th,.nlbl,.gift-num,.rhythm-time,.ptitle,.plbl,.practice-num,.deep-num,.sum-lbl){color:#7A5C1E}
  html:not(.pdf-export) .mandala-sec{background:none}
  /* de mandala is licht op donker getekend: zijn eigen donkere cirkel houden */
  html:not(.pdf-export) .mandala-svg{background:#0D0A07;border-radius:50%;
    -webkit-print-color-adjust:exact;print-color-adjust:exact}
}
</style>`;

// Idempotent: blueprints die het burgermenu al meebrengen blijven ongemoeid.
function upgradeNav(html) {
  if (typeof html !== 'string') return html;
  if (!html.includes('nav-burger')) {
    html = html
      .replace('<div class="nav-links">', BURGER + '<div class="nav-links">')
      .replace('</head>', STYLE + '</head>');
  }
  return html.includes('id="bp-papier"') ? html : html.replace('</head>', PAPIER + '</head>');
}

module.exports = { upgradeNav };

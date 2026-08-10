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
  .nav-burger,.nav-toggle{display:none!important}
  .nav-links{display:grid!important}
}
</style>`;

// Idempotent: blueprints die het burgermenu al meebrengen blijven ongemoeid.
function upgradeNav(html) {
  if (typeof html !== 'string' || html.includes('nav-burger')) return html;
  return html
    .replace('<div class="nav-links">', BURGER + '<div class="nav-links">')
    .replace('</head>', STYLE + '</head>');
}

module.exports = { upgradeNav };

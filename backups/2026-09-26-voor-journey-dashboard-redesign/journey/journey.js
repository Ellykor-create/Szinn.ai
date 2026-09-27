/* SZINN · journey
   Drie fases die na elkaar opengaan: Herkenning → Helderheid → Integratie.

   Databron, in deze volgorde:
     1. window.SZINN_DATA        (door de pipeline in de pagina gezet)
     2. ?data=<url>              (los JSON-bestand per klant)
     3. ?klant=<id>              (haalt klanten/<id>.json op)
     4. client.json              (standaard, naast index.html)

   Taal: het veld "taal" in de JSON ("en" of "nl") zet lang= op de pagina.
   Alle vaste woorden staan onder "labels". Staat een label er niet in,
   dan valt de pagina terug op het Engels hieronder.
*/
(function () {
  "use strict";

  var FASES = ["herkenning", "helderheid", "integratie"];
  var SLEUTEL_FASE = "szinn-fase-v2";
  var SLEUTEL_OPEN = "szinn-open-v2";
  var SLEUTEL_START = "szinn-start-v3";
  var SLEUTEL_VOORTGANG = "szinn-voortgang";
  var SLEUTEL_TAAL = "szinn-taal-v1";       /* de gekozen taal, blijft staan */
  var SLEUTEL_PANEEL = "szinn-paneel-tmp";  /* alleen om na het wisselen terug
                                               te komen op hetzelfde paneel */
  var SLEUTEL_VIDEO = "szinn-video-tmp";    /* en op dezelfde seconde video */
  var open = 1;
  var data = null;
  var klantId = "";

  /* vaste woorden · Engelse terugval, wordt overschreven door labels in de JSON */
  var STANDAARD = {
    dashboard: "← dashboard",
    start: "↻ start",
    printen: "Print",
    fasenummer: "Phase ",
    merkregel: "Remember who you are.",
    spiegelkop: "read it this way",
    spiegelregel: "This is not who you are. This is the energy you get to work with.",
    merkonder: "Alignment · Awareness · Living",
    sluiten: "Close",
    terugkop: "Back to overview",
    volgende: "Next",
    terug: "Back",
    kernthemas: "Key themes",
    herkenning: "You may recognise this in yourself",
    herinnering: "A reminder for you",
    watHerkenJe: "What do you recognise?",
    schrijfhier: "Write your thoughts here…",
    zelfdeLicht: "Same light. Different expression.",
    terugPlaneten: "← Back to planets",
    meerInfo: "More information",
    downloaden: "Download",
    bestellen: "Order a print",
    openen: "Open",
    jeBentHier: "You are here",
    afvinken: "Tick off",
    afgevinkt: "Ticked off",
    welkom: "Welcome",
    welkomTekst: "Everything is ready for you.",
    welkomKnop: "Begin",
    slotmelding: "This step opens once you have read the one before it. One thing at a time.",
    foutKop: "Your blueprint is not loading",
    foutTekst: "The data could not be retrieved. Please try again later."
  };

  function el(id) { return document.getElementById(id); }
  function veilig(t) {
    return String(t == null ? "" : t)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  /* T("sluiten") geeft het label uit de JSON, anders de Engelse terugval */
  function T(sleutel, eigen) {
    if (eigen) return eigen;
    var L = (data && data.labels) || {};
    return L[sleutel] != null ? L[sleutel] : (STANDAARD[sleutel] || "");
  }
  /* {dashboard}, {blauwdruk} en {klant} in een href worden ingevuld vanuit de
     klantdata. {blauwdruk} wijst rechtstreeks naar het document zelf; staat dat
     veld er niet, dan valt hij terug op het dashboard, want dan is dat de enige
     plek waar de blauwdruk te vinden is. */
  function adres(h) {
    if (!h) return "#";
    var dash = ((data && data.dashboard) || "").replace(/\/+$/, "") + "/";
    var bp = (data && data.blauwdruk) || dash;
    return String(h)
      .replace(/\{blauwdruk\}\/?/g, bp)
      .replace(/\{dashboard\}\/?/g, dash)
      .replace(/\{klant\}/g, klantId);
  }
  function lees(k, standaard) { try { return localStorage.getItem(k) || standaard; } catch (e) { return standaard; } }
  function schrijf(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function kop(b) { return b.kop ? '<div class="laag">' + veilig(b.kop) + '</div>' : ""; }
  /* een label met een pijl. Staat er al een pijl in de tekst zelf, dan zetten
     we er geen tweede naast: "Verder → Integratie →" leest als een fout. */
  function pijl(tekst, teken, achter) {
    var t = veilig(tekst);
    if (/[\u2190\u2192\u2794\u27a1>&#8592;&#8594;]/.test(String(tekst))) return t;
    return achter ? t + ' <i>' + teken + '</i>' : '<i>' + teken + '</i> ' + t;
  }

  /* de meeste tekens zijn gewoon een letterteken uit de data. Twee vormen
     bestaan niet als betrouwbaar teken en tekenen we zelf. */
  function glyph(t) {
    if (t === "ringen") {
      return '<svg viewBox="0 0 40 26" aria-hidden="true" focusable="false">' +
        '<circle cx="15" cy="13" r="10"/><circle cx="25" cy="13" r="10"/></svg>';
    }
    if (t === "opgang") {
      var str = "";
      for (var j = 0; j < 7; j++) {
        var h = Math.PI * (j / 6);
        str += '<line x1="' + (20 - Math.cos(h) * 10).toFixed(1) + '" y1="' + (24 - Math.sin(h) * 10).toFixed(1) +
               '" x2="' + (20 - Math.cos(h) * 15).toFixed(1) + '" y2="' + (24 - Math.sin(h) * 15).toFixed(1) + '"/>';
      }
      return '<svg viewBox="0 0 40 30" aria-hidden="true" focusable="false">' +
        '<path d="M11 24 a9 9 0 0 1 18 0"/><line x1="4" y1="24" x2="36" y2="24"/>' + str + '</svg>';
    }
    if (t === "zon") {
      var st = "";
      for (var i = 0; i < 8; i++) {
        var a = (Math.PI / 4) * i;
        st += '<line x1="' + (20 + Math.cos(a) * 8).toFixed(1) + '" y1="' + (20 + Math.sin(a) * 8).toFixed(1) +
              '" x2="' + (20 + Math.cos(a) * 13).toFixed(1) + '" y2="' + (20 + Math.sin(a) * 13).toFixed(1) + '"/>';
      }
      return '<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">' +
        '<circle cx="20" cy="20" r="5.5" class="vol"/>' + st + '</svg>';
    }
    return veilig(t);
  }

  /* "Life happens / to me." — de tweede regel staat cursief, zoals in het
     ontwerp. Alles na de eerste regelovergang is die tweede regel. */
  function bwZin(t) {
    var d = String(t || "").split("\n");
    var eerste = veilig(d.shift() || "");
    return eerste + (d.length ? '<em>' + veilig(d.join(" ")) + '</em>' : "");
  }

  /* de drie tekens naast de slotbalk: een boek, een driehoekje, een blad */
  function slotTeken(t) {
    if (t === "video") {
      return '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">' +
        '<circle cx="10" cy="10" r="8"/><path d="M8.4 6.8 13.4 10l-5 3.2z"/></svg>';
    }
    if (t === "blad") {
      return '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">' +
        '<path d="M4.5 2.5h7l4 4v11h-11z"/><path d="M11.5 2.5v4h4"/>' +
        '<path d="M7 10.5h6M7 13.5h4"/></svg>';
    }
    return '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">' +
      '<path d="M10 5.5S8.4 3.8 4 3.8v11C8.4 14.8 10 16.5 10 16.5s1.6-1.7 6-1.7v-11c-4.4 0-6 1.7-6 1.7z"/>' +
      '<path d="M10 5.5v11"/></svg>';
  }

  /* ---------- blokken ---------- */
  function blokHTML(b) {
    switch (b.type) {

      case "beeld":
        return '<figure><img src="' + veilig(b.src) + '" alt="">' +
          (b.citaat ? '<figcaption>' + veilig(b.citaat).replace(/\n/g, "<br>") + '</figcaption>' : "") +
          '</figure>';

      case "stilte":
        return '<div class="stil"><em>' + veilig(b.tekst).replace(/\n/g, "<br>") + '</em></div>';

      case "getallen":
        return kop(b) +
          '<div class="getallen">' + (b.items || []).map(function (g) {
            return '<div class="getal"><b>' + veilig(g.getal) + '</b><small>' + veilig(g.label) + '</small></div>';
          }).join("") + '</div>' +
          (b.tekst ? '<div class="t">' + b.tekst + '</div>' : "");

      case "vel":
        return kop(b) +
          '<div class="vel"><img src="' + veilig(b.src) + '" alt="' + veilig(b.alt || "") + '"></div>' +
          (b.tekst ? '<div class="t">' + b.tekst + '</div>' : "");

      case "html":
        return kop(b) + b.html + (b.tekst ? '<div class="t">' + b.tekst + '</div>' : "");

      case "maan":
        return kop(b) + '<div class="maanrij">' + b.svg +
          '<div><div class="h">' + veilig(b.fase) + '</div><div class="t">' + b.tekst + '</div></div></div>';

      case "knoppen":
        return kop(b) + '<div class="knoppen">' + (b.items || []).map(function (k) {
          return '<a class="knop' + (k.licht ? ' licht' : '') + '" href="' + veilig(adres(k.href)) + '"' +
            (k.nieuw ? ' target="_blank" rel="noopener"' : "") + '>' + veilig(k.label) + '</a>';
        }).join("") + '</div>';

      case "afsluiter":
        return '<div class="afsluiter"><em>' + veilig(b.tekst) + '</em>' +
          (b.merk ? '<small>' + veilig(b.merk) + '</small>' : "") + '</div>';

      case "lijst":
        return (b.kop ? '<div class="lkop">' + veilig(b.kop) + '<span></span></div>' : "") +
          '<ul class="lijst">' + (b.items || []).map(function (t) {
            return '<li><i>+</i><span>' + veilig(t) + '</span></li>';
          }).join("") + '</ul>';

      case "herinnering":
        return '<div class="herinnering"><div class="hsymbool">&#9765;</div><div>' +
          (b.kop ? '<span class="hlbl">' + veilig(b.kop) + '</span>' : "") +
          '<em>' + veilig(b.tekst).replace(/\n/g, "<br>") + '</em></div></div>';

      case "invoer":
        return '<div class="lkop">' + veilig(T("watHerkenJe", b.kop)) + '<span></span></div>' +
          '<div class="invoer"><textarea rows="3" data-bewaar="' + veilig(b.sleutel || "notitie") +
          '" placeholder="' + veilig(T("schrijfhier", b.plaats)) + '"></textarea><i>&#9998;</i></div>';

      case "lagen":
        return (b.kop ? '<div class="lagenkop">' + veilig(b.kop) + '</div>' : "") +
          '<div class="lagen">' + (b.items || []).map(function (l, i) {
            var nr = ("0" + (i + 1)).slice(-2);
            return '<div class="laag3"><div class="laagkaart">' +
              '<img src="' + veilig(l.beeld) + '" alt="">' +
              '<div class="laagtekst"><span class="onr">' + nr + '</span>' +
              '<div><b>' + veilig(l.titel) + '</b><em>' + veilig(l.sub || "") + '</em></div>' +
              '<span class="opijl">&#8250;</span></div></div>' +
              '<p>' + veilig(l.tekst || "") + '</p></div>';
          }).join("") + '</div>';

      case "wegen":
        return '<div class="wegkop"><h2>' + veilig(b.kop || "") + '</h2><span></span>' +
          (b.rechts ? '<em>' + veilig(b.rechts) + '</em>' : "") + '</div>' +
          '<div class="wegen">' + (b.items || []).map(function (w, i) {
            var nr = ("0" + (i + 1)).slice(-2);
            return '<div class="weg"><img src="' + veilig(w.beeld) + '" alt="">' +
              '<div class="weglijf"><span class="wegnr">' + nr +
              (w.wanneer ? '<i class="wanneer">' + veilig(w.wanneer) + '</i>' : "") + '</span>' +
              '<b>' + veilig(w.titel) + '</b><em>' + veilig(w.sub || "") + '</em>' +
              /* een stap die bij de proefperiode hoort draagt dat zelf, zodat je
                 het ziet voordat je op de knop drukt */
              (w.proef ? '<span class="wegproef">' + veilig(w.proef) + '</span>' : "") +
              '<p>' + veilig(w.tekst || "") + '</p>' +
              '<ul>' + (w.items || []).map(function (t) {
                return '<li><i>&#10003;</i>' + veilig(t) + '</li>'; }).join("") + '</ul>' +
              (w.knop ? '<a class="knop" href="' + veilig(adres(w.href)) + '"' +
                (w.nieuw ? ' target="_blank" rel="noopener"' : "") + '>' +
                veilig(w.knop) + ' &rarr;</a>' : "") +
              (w.meer ? '<div class="uitk"><button class="uitkop wegmeer" data-uit>' +
                '<span><b>' + veilig(T("meerInfo", w.meerkop)) + '</b></span><i>&#8250;</i>' +
                '</button><div class="uitlijf">' + veilig(w.meer) + '</div></div>' : "") +
              '</div></div>';
          }).join("") + '</div>';

      case "stroom":
        return '<div class="stroomvak">' +
          (b.label || b.rechts ? '<div class="stroombalk">' +
            '<span>' + veilig(b.label || "") + '</span><i></i>' +
            '<span>' + veilig(b.rechts || "") + '</span></div>' : "") +
          '<div class="stroomraster"><div class="stroomlinks">' +
            (b.kop ? '<h2 class="stroomkop">' + veilig(b.kop) + '</h2>' : "") +
            (b.sub ? '<p class="stroomsub">' + veilig(b.sub) + '</p>' : "") +
            '<div class="stroom"><div class="stroomrij">' +
            (b.items || []).map(function (x, i) {
              return (i ? '<span class="pijl">&rarr;</span>' : "") +
                '<div class="stap5"><span class="cirkel">' + x.teken + '</span>' +
                '<b>' + veilig(x.kop) + '</b><small>' + veilig(x.sub || "") + '</small>' +
                (x.tekst ? '<p>' + veilig(x.tekst).replace(/\n/g, "<br>") + '</p>' : "") +
                '</div>';
            }).join("") + '</div></div>' +
          '</div>' +
          (b.noot ? '<aside class="stroomzij"><div class="stroomnoot">' +
            veilig(b.noot).replace(/\n/g, "<br>") + '</div>' +
            (b.nootonder ? '<em>' + veilig(b.nootonder) + '</em>' : "") + '</aside>' : "") +
          '</div></div>';

      case "startbalk":
        return '<div class="startbalk"><img src="' + veilig(b.beeld) + '" alt="">' +
          '<div class="startlijf"><h2>' + veilig(b.kop || "") + '</h2>' +
          '<div class="startrij">' + (b.items || []).map(function (x) {
            return '<div class="startvak"><span class="cirkel">' + x.teken + '</span>' +
              '<b>' + veilig(x.kop) + '</b><small>' + veilig(x.sub || "") + '</small>' +
              '<a class="knop" href="' + veilig(adres(x.href)) + '"' +
              (x.nieuw ? ' target="_blank" rel="noopener"' : "") + '>' +
              veilig(T("openen", x.knop)) + '</a></div>';
          }).join("") + '</div></div></div>';

      /* drie vormen naast elkaar: de reis, het A2-blad, de volledige Blueprint */
      case "vormen":
        return '<div class="vormenkop"><h2>' + veilig(b.kop || "") + '</h2><span></span>' +
          (b.rechts ? '<em>' + veilig(b.rechts) + '</em>' : "") + '</div>' +
          (b.tekst ? '<p class="vormenlead">' + veilig(b.tekst) + '</p>' : "") +
          '<div class="vormen' + (b.afvinken ? " afvinkbaar" : "") + '">' +
          (b.items || []).map(function (v, vi) {
            return '<div class="vorm' + (v.hier ? " hier" : "") +
                (v.beeld ? " metbeeld" : "") + '">' +
              (v.beeld
                ? '<span class="vormbeeld"><img src="' + veilig(v.beeld) + '" alt=""></span>'
                : "") +
              '<span class="vormteken">' + (v.teken || "") + '</span>' +
              '<span class="vormlbl">' + veilig(v.label || "") + '</span>' +
              '<b>' + veilig(v.titel || "") + '</b>' +
              (v.zin ? '<em class="vormzin">' + veilig(v.zin) + '</em>' : "") +
              '<p>' + veilig(v.tekst || "") + '</p>' +
              (v.voor ? '<span class="vormvoor">' + veilig(v.voor) + '</span>' : "") +
              /* het vinkje. Het verandert niets aan de reis, het is er om voor
                 jezelf af te tekenen wat je gehad hebt. Wat je aanvinkt blijft
                 staan als je later terugkomt. */
              (b.afvinken
                ? '<button class="vormvink" type="button" role="checkbox" aria-checked="false"' +
                    ' data-vink="' + veilig((b.vinkId || "vormen") + "-" + vi) + '"' +
                    ' data-uit="' + veilig(v.vink || T("afvinken")) + '"' +
                    ' data-aan="' + veilig(v.vinkAan || T("afgevinkt")) + '">' +
                    '<i aria-hidden="true">&#10003;</i>' +
                    '<span>' + veilig(v.vink || T("afvinken")) + '</span></button>'
                : "") +
              (v.vergrendeld
                ? '<span class="vormslot"><i>&#128274;</i>' +
                    veilig(v.slotLabel || "").replace(/\n/g, "<br>") + '</span>'
                : v.hier
                  ? '<span class="vormhier">' + veilig(T("jeBentHier", b.hierLabel)) +
                      (v.naarAnker ? '<button class="vormpijl" data-anker="' +
                        veilig(v.naarAnker) + '">&#8595;</button>' : "") + '</span>'
                  : (v.knop && v.naar
                      /* terug naar een fase die je al gelezen hebt; dezelfde
                         knop als in de slotbalk, dus dezelfde afhandeling */
                      ? '<button class="knop licht" data-naar="' + v.naar + '">' +
                          veilig(v.knop) + '</button>'
                    : v.knop && v.naarAnker
                      ? '<button class="knop licht" data-anker="' + veilig(v.naarAnker) + '">' +
                          veilig(v.knop) + '</button>'
                      : v.knop
                        ? '<a class="knop licht" href="' + veilig(adres(v.href)) + '"' +
                            (v.nieuw ? ' target="_blank" rel="noopener"' : "") +
                            (v.download ? ' download' : "") + '>' + veilig(v.knop) + '</a>'
                        : "")) +
              '</div>';
          }).join("") + '</div>' +
          (b.noot ? '<div class="vormennoot">' + veilig(b.noot).replace(/\n/g, "<br>") + '</div>' : "");

      case "blauwdruk3":
        return '<div class="bd3">' +
          '<div class="bd3tekst">' +
            '<span class="plbl">' + veilig(b.label || "") + '</span>' +
            '<h2>' + veilig(b.kop || "") + '</h2>' +
            '<p>' + veilig(b.tekst || "") + '</p>' +
            (b.pdf ? '<div class="knoppen"><a class="knop" href="' + veilig(adres(b.pdf)) + '">' +
              veilig(T("openen", b.pdfLabel)) + ' &rarr;</a></div>' : "") +
          '</div>' +
          '<div class="bd3beeld"><img src="' + veilig(b.beeld) + '" alt=""></div>' +
          '<div class="bd3rechts"><span class="plbl">' + veilig(b.lijstkop || "") + '</span><ul>' +
            (b.items || []).map(function (t) { return '<li>' + veilig(t) + '</li>'; }).join("") +
          '</ul>' + (b.noot ? '<div class="bd3noot">' + veilig(b.noot).replace(/\n/g, "<br>") +
            '</div>' : "") + '</div></div>';

      case "blauwdruk":
        return '<div class="bdvlak" style="--bdbeeld:url(' + veilig(b.beeld) + ')">' +
          '<div class="bdtekst">' +
            '<span class="plbl">' + veilig(b.label || "") + '</span>' +
            '<h2>' + veilig(b.kop || "") + '</h2>' +
            '<p>' + veilig(b.tekst || "") + '</p>' +
            '<ul class="bdlijst">' + (b.items || []).map(function (t) {
              return '<li><i>&#10003;</i>' + veilig(t) + '</li>';
            }).join("") + '</ul>' +
            '<div class="knoppen">' +
              (b.pdf ? '<a class="knop goud" href="' + veilig(adres(b.pdf)) + '" download>' +
                veilig(T("downloaden", b.pdfLabel)) + ' &darr;</a>' : "") +
              (!b.pdf && b.naarAnker ? '<button class="knop goud" data-anker="' +
                veilig(b.naarAnker) + '">' + veilig(b.pdfLabel || "") + ' &rarr;</button>' : "") +
              (b.bestel ? '<a class="knop licht" href="' + veilig(adres(b.bestel)) + '">' +
                veilig(T("bestellen", b.bestelLabel)) + '</a>' : "") +
            '</div>' +
            /* de drie formaten staan in het blok zelf; als losse rij eronder
               kondigde hetzelfde blad zich een tweede keer aan */
            ((b.print || []).length
              ? '<div class="bdprint">' +
                  (b.printKop ? '<span class="bdprintkop">' + veilig(b.printKop) + '</span>' : "") +
                  '<div class="bdprintrij">' + b.print.map(function (x) {
                    return '<a class="bdprintknop" href="' + veilig(adres(x.href)) + '" download>' +
                      '<i aria-hidden="true">&#8595;</i><b>' + veilig(x.knop || "") + '</b>' +
                      (x.sub ? '<small>' + veilig(x.sub) + '</small>' : "") + '</a>';
                  }).join("") + '</div></div>'
              : "") +
            '</div>' +
          (b.noot ? '<div class="bdnoot">' + veilig(b.noot).replace(/\n/g, "<br>") + '</div>' : "") +
          '</div>';

      case "slotbalk":
        /* de brede variant van fase 1: rond beeld, een label, een kop met een
           cursief tweede deel, en rechts wat je eerst nog kunt doen */
        if (b.rond || b.naast || b.label) {
          return '<div class="slotbalk breed">' +
            '<div class="slotbeeld"><img src="' + veilig(b.beeld) + '" alt=""></div>' +
            '<div class="slottekst">' +
              (b.label ? '<span class="slotlbl">' + veilig(b.label) + '</span>' : "") +
              '<h2>' + veilig(b.kop || "") +
                (b.kopcursief ? ' <em>' + veilig(b.kopcursief) + '</em>' : "") + '</h2>' +
              '<p>' + veilig(b.tekst || "").replace(/\n/g, "<br>") + '</p>' +
              (b.naar ? '<button class="knop goud" data-naar="' + b.naar + '">' +
                veilig(b.knop || "") + ' &rarr;</button>' : "") +
              /* niet elke slotbalk wijst naar een volgende fase; sommige wijzen
                 naar buiten, bijvoorbeeld naar het dashboard */
              (!b.naar && b.href ? '<a class="knop goud" href="' + veilig(adres(b.href)) + '"' +
                (b.nieuw ? ' target="_blank" rel="noopener"' : "") + '>' +
                veilig(b.knop || "") + ' &rarr;</a>' : "") +
            '</div>' +
            (b.naast ? '<aside class="slotnaast">' +
              (b.naast.kop ? '<span class="slotlbl">' + veilig(b.naast.kop) + '</span>' : "") +
              '<ul>' + (b.naast.items || []).map(function (x) {
                return '<li' + (x.bron ? '' : ' class="straks"') + '>' +
                  '<i>' + slotTeken(x.teken) + '</i><b>' + veilig(x.tekst || "") + '</b>' +
                  (!x.bron && x.straks ? '<u>' + veilig(x.straks) + '</u>' : "") + '</li>';
              }).join("") + '</ul></aside>' : "") +
            '</div>';
        }
        return '<div class="slotbalk"><img src="' + veilig(b.beeld) + '" alt="">' +
          '<div class="slottekst"><h2>' + veilig(b.kop || "") + '</h2>' +
          '<p>' + veilig(b.tekst || "").replace(/\n/g, "<br>") + '</p></div>' +
          /* het ronde pijltje alleen was te stil om de enige weg vooruit te
             zijn. Er staat nu een echte knop naast, en waar het kan ook een
             stille knop terug. */
          ((b.naar || b.terug)
            ? '<div class="slotknoppen">' +
                (b.naar
                  ? '<button class="knop goud slotvooruit" data-naar="' + b.naar + '">' +
                      pijl(b.knop || T("volgende"), "&#8594;", 1) + '</button>'
                  : "") +
                (b.terug
                  ? '<button class="knop licht slotterug" data-naar="' + b.terug + '">' +
                      pijl(b.terugKnop || T("terug"), "&#8592;", 0) + '</button>'
                  : "") +
              '</div>'
            : "") +
          '</div>';

      case "maanfases":
        return '<div class="maanvak' + (b.zij ? " metzij" : "") + '">' +
          '<div class="maanlinks">' +
          (b.kop ? '<div class="maankop"><h2>' + veilig(b.kop) + '</h2><i></i>' +
            (b.rechts ? '<em>' + veilig(b.rechts) + '</em>' : "") + '</div>' : "") +
          (b.tekst ? '<p class="maanlead">' + veilig(b.tekst).replace(/\n/g, "<br>") + '</p>' : "") +
          '</div>' +
          (b.zij ? '<aside class="maanzij">' +
            (b.zij.beeld ? '<img src="' + veilig(b.zij.beeld) + '" alt="">' : "") +
            '<div><b>' + veilig(b.zij.kop || "").replace(/\n/g, "<br>") + '</b>' +
            '<p>' + veilig(b.zij.tekst || "").replace(/\n/g, "<br>") + '</p></div></aside>' : "") +
          /* de maanstrook loopt onder beide kolommen door, over de volle breedte */
          '<div class="maanrij2">' + (b.items || []).map(function (m) {
            return '<div class="maanfase' + (m.actief ? " aan" : "") + '">' +
              (m.beeld ? '<img src="' + veilig(m.beeld) + '" alt="">' : (m.svg || "")) +
              '<span>' + veilig(m.label) + '</span>' +
              (m.zin ? '<em>' + veilig(m.zin) + '</em>' : "") +
              (m.regels ? '<u>' + m.regels.map(veilig).join("<br>") + '</u>' : "") +
              '</div>';
          }).join("") + '</div>' +
          '</div>';

      /* wat er bij je geland is, plus wat je zojuist gedaan hebt */
      case "reflectie":
        return '<div class="rvak">' +
          '<div class="rlinks">' +
            (b.label ? '<span class="rlbl">' + veilig(b.label) + '</span>' : "") +
            (b.kop ? '<h2>' + veilig(b.kop) + '</h2>' : "") +
            (b.tekst ? '<p class="rlead">' + veilig(b.tekst).replace(/\n/g, "<br>") + '</p>' : "") +
            '<textarea class="rveld" id="r-veld" rows="4" placeholder="' +
              veilig(b.hint || "") + '"></textarea>' +
            '<div class="rknoppen">' +
              '<button class="knop goud" type="button" data-bewaar>' +
                '<svg viewBox="0 0 16 18" aria-hidden="true" focusable="false">' +
                '<rect x="2.5" y="7.5" width="11" height="8.5" rx="1.4"/>' +
                '<path d="M5 7.5V5a3 3 0 0 1 6 0v2.5"/></svg>' +
                '<span>' + veilig(b.bewaar || "") + '</span></button>' +
              '<button class="knop licht" type="button" data-print>' +
                '<svg viewBox="0 0 18 18" aria-hidden="true" focusable="false">' +
                '<path d="M5 7.5V2.5h8v5"/><rect x="2.5" y="7.5" width="13" height="6" rx="1.2"/>' +
                '<path d="M5 12h8v4H5z"/></svg>' +
                '<span>' + veilig(b.printknop || T("printen")) + '</span></button>' +
            '</div>' +
            (b.noot ? '<p class="rnoot">' + veilig(b.noot) + '</p>' : "") +
          '</div>' +
          '<aside class="rrechts">' +
            (b.gedaankop ? '<span class="rlbl">' + veilig(b.gedaankop) + '</span>' : "") +
            '<ul class="rgedaan">' + (b.gedaan || []).map(function (t) {
              return '<li><i>&#10003;</i>' + veilig(t) + '</li>';
            }).join("") + '</ul>' +
            (b.citaat ? '<p class="rcitaat">' + veilig(b.citaat).replace(/\n/g, "<br>") + '</p>' : "") +
          '</aside>' +
          '</div>';

      /* de balk onderaan: waar je was, waar je bent, waar je heen gaat */
      case "stappenbalk":
        return '<div class="sbalk">' + (b.items || []).map(function (x, i) {
          return '<button type="button" class="sstap' + (x.hier ? " hier" : "") +
            '" data-fase-naar="' + (i + 1) + '">' +
            '<span class="snr">' + (i + 1) + '</span>' +
            '<b>' + veilig(x.titel || "") + '</b>' +
            (x.sub ? '<span>' + veilig(x.sub) + '</span>' : "") + '</button>';
        }).join("") + '</div>';

      /* één plek om te downloaden, met de drie formaten naast elkaar */
      case "printblok":
        return '<div class="pblok">' +
          (b.kop ? '<div class="pkop">' + veilig(b.kop) + '</div>' : "") +
          (b.tekst ? '<p class="ptekst">' + veilig(b.tekst).replace(/\n/g, "<br>") + '</p>' : "") +
          '<div class="prij">' + (b.items || []).map(function (x) {
            return '<a class="pknop" href="' + veilig(x.href || "#") + '"' +
              (x.href ? ' download' : "") + '>' +
              '<svg viewBox="0 0 20 24" aria-hidden="true" focusable="false">' +
              '<path d="M3 1h9l5 5v17H3z"/><path d="M12 1v5h5"/>' +
              '<path d="M6.5 12h7M6.5 15.5h7M6.5 19h4.5"/></svg>' +
              '<b>' + veilig(x.knop || "") + '</b>' +
              (x.sub ? '<span>' + veilig(x.sub) + '</span>' : "") + '</a>';
          }).join("") + '</div>' +
          (b.noot ? '<p class="pnoot">' + veilig(b.noot).replace(/\n/g, "<br>") + '</p>' : "") +
          '</div>';

      /* vier standen van hetzelfde leven: van overkomen naar maken.
         Staat er een beeld bij, dan wordt de cirkel een foto; anders blijft
         het getekende teken staan. De gouden lijn en de pijltjes lopen van
         hart naar hart tussen de cirkels door. */
      case "bewustwording":
        var bwn = (b.items || []).length;
        return '<div class="bwvak">' +
          (b.label || b.rechts ? '<div class="stroombalk">' +
            '<span>' + veilig(b.label || "") + '</span><i></i>' +
            '<span>' + veilig(b.rechts || "") + '</span></div>' : "") +
          '<div class="bwraster"><div class="bwlinks">' +
            (b.kop ? '<h2 class="bwkop">' + veilig(b.kop) + '</h2>' : "") +
            (b.sub ? '<p class="bwsub">' + veilig(b.sub) + '</p>' : "") +
            '<div class="bwrij">' + (b.items || []).map(function (x, i) {
              return '<div class="bwstap">' +
                  '<span class="bwfase">' + veilig(x.fase || "") + '</span>' +
                  '<b class="bwnaam">' + veilig(x.naam || "") + '</b>' +
                  '<span class="bwbeeld">' +
                    (x.beeld
                      ? '<span class="bwcirkel"><img src="' + veilig(x.beeld) + '" alt="' +
                        veilig(x.beeldtekst || "") + '" loading="lazy"></span>'
                      : '<span class="bwcirkel leeg">' + glyph(x.teken) + '</span>') +
                    (i < bwn - 1 ? '<i class="bwpijl" aria-hidden="true">&#8250;</i>' : "") +
                  '</span>' +
                  '<span class="bwsteel"></span>' +
                  '<p class="bwzin">' + bwZin(x.zin) + '</p>' +
                  (x.kort ? '<em class="bwkort">' + veilig(x.kort) + '</em>' : "") +
                  (x.tekst ? '<p class="bwtekst">' + veilig(x.tekst).replace(/\n/g, "<br>") + '</p>' : "") +
                  (x.voet ? '<span class="bwvoet">' + veilig(x.voet) + '</span>' : "") +
                '</div>';
            }).join("") + '</div>' +
          '</div>' +
          (b.noot || b.merk ? '<aside class="bwzij">' +
            (b.noot ? '<div class="bwnoot">' + veilig(b.noot).replace(/\n/g, "<br>") + '</div>' : "") +
            (b.nootonder ? '<em>' + veilig(b.nootonder).replace(/\n/g, "<br>") + '</em>' : "") +
            (b.merk ? '<div class="bwmerk"><img src="' + veilig(b.merk) + '" alt="SZINN">' +
              (b.merkonder ? '<span>' + veilig(b.merkonder) + '</span>' : "") + '</div>' : "") +
            '</aside>' : "") +
          '</div>' +
          (b.voet ? '<div class="bwslot"><i></i><span>' + veilig(b.voet) + '</span><i></i></div>' : "") +
          (b.bron ? '<p class="bwbron">' + veilig(b.bron).replace(/\n/g, "<br>") + '</p>' : "") +
          '</div>';

      /* de zes basisemoties als informatie, niet als probleem */
      case "emoties":
        return '<div class="gvvak">' +
          (b.beeld ? '<div class="gvfoto" aria-hidden="true"><img src="' + veilig(b.beeld) +
            '" alt="" onerror="this.parentNode.style.display=\'none\'"><i></i></div>' : "") +
          (b.label || b.rechts ? '<div class="stroombalk">' +
            '<span>' + veilig(b.label || "") + '</span><i></i>' +
            '<span>' + veilig(b.rechts || "") + '</span></div>' : "") +

          '<div class="gvboven"><div class="gvlinks">' +
            '<h2 class="gvkop">' + veilig(b.kop || "") +
              (b.kopcursief ? ' <em>' + veilig(b.kopcursief) + '</em>' : "") + '</h2>' +
            (b.onderkop ? '<div class="gvonderkop">' + veilig(b.onderkop) + '</div>' : "") +
            '<span class="gvstreep"></span>' +
            (b.tekst ? '<p class="gvlead">' + veilig(b.tekst).replace(/\n/g, "<br>") + '</p>' : "") +
          '</div>' +
          (b.zij ? '<aside class="gvbeeldtekst"><b>' +
            veilig(b.zij.kop || "").replace(/\n/g, "<br>") + '</b>' +
            (b.zij.onder ? '<span class="gvstreep licht"></span><em>' + veilig(b.zij.onder) + '</em>' : "") +
            '</aside>' : "") +
          '</div>' +

          '<div class="gvrij">' + (b.items || []).map(function (x) {
            return '<div class="gvemo' + (x.tint ? " t-" + veilig(x.tint) : "") + '">' +
              '<span class="gvbol">' +
                (x.beeld ? '<img src="' + veilig(x.beeld) + '" alt="" onerror="this.style.display=\'none\'">' : "") +
              '</span>' +
              '<b>' + veilig(x.kop || "") + '</b>' +
              (x.naam ? '<span class="gvnaam">' + veilig(x.naam) + '</span>' : "") +
              '<p>' + veilig(x.tekst || "").replace(/\n/g, "<br>") + '</p>' +
              (x.zin ? '<em>' + veilig(x.zin).replace(/\n/g, "<br>") + '</em>' : "") +
              '</div>';
          }).join("") + '</div>' +

          '<div class="gvslot">' +
            (b.vak ? '<div class="gvbox"><span class="gvteken">' + glyph("opgang") + '</span>' +
              '<div><b>' + veilig(b.vak.kop || "") + '</b>' +
              (b.vak.onder ? '<em>' + veilig(b.vak.onder) + '</em>' : "") + '</div></div>' : "") +
            (b.slot ? '<div class="gvslottekst"><p>' + veilig(b.slot.tekst || "").replace(/\n/g, "<br>") + '</p>' +
              (b.slot.onder ? '<em>' + veilig(b.slot.onder) + '</em>' : "") + '</div>' : "") +
          '</div>' +

          (b.voetlinks || b.voetrechts ? '<div class="gvvoet">' +
            '<span>' + veilig(b.voetlinks || "") + '</span><i></i>' +
            '<u>&#10022;</u><i></i>' +
            '<span>' + veilig(b.voetrechts || "") + '</span></div>' : "") +
          '</div>';

      case "vak":
        return '<div class="plvak vakblok">' +
          '<div class="plvaka">' +
            (b.beeld ? '<img class="vakbeeld" src="' + veilig(b.beeld) + '" alt="">' : "") +
            '<div><b>' + veilig(b.kop || "") + '</b><p>' + veilig(b.tekst || "") + '</p></div>' +
          '</div>' +
          '<div class="plvakb"><span class="plbl">' + veilig(T("kernthemas", b.themakop)) + '</span><ul>' +
            (b.themas || []).map(function (t) { return '<li>' + veilig(t) + '</li>'; }).join("") +
          '</ul></div></div>';

      case "duo":
        var l = b.lijst || {}, h = b.herinnering || {};
        return '<div class="plonder"><div>' +
          '<div class="lkop">' + veilig(T("herkenning", l.kop)) + '<span></span></div>' +
          '<ul class="lijst vink">' + (l.items || []).map(function (t) {
            return '<li><i>&#10003;</i><span>' + veilig(t) + '</span></li>';
          }).join("") + '</ul></div>' +
          '<div class="plherinnering"><span class="plankh">&#9765;</span>' +
            '<span class="plbl">' + veilig(T("herinnering", h.kop)) + '</span><em>' +
            veilig(h.tekst || "").replace(/\n/g, "<br>") + '</em></div></div>';

      case "planeten":
        return (b.kop ? '<div class="okop">' + veilig(b.kop) + '</div>' : "") +
          (b.tekst ? '<p class="sub">' + veilig(b.tekst) + '</p>' : "") +
          '<div class="plraster">' + (b.items || []).map(function (pl, n) {
            var nr = ("0" + (n + 1)).slice(-2);
            return '<button class="plkaart" data-planeet="' + n + '">' +
              '<img src="' + veilig(pl.beeld) + '" alt="">' +
              '<span class="plsym">' + pl.teken + '</span>' +
              '<span class="plnaam"><i>' + nr + '</i><b>' + veilig(pl.naam) + '</b>' +
              '<em>' + veilig(pl.kort) + '</em></span></button>';
          }).join("") + '</div><div class="pldetail" id="pldetail"></div>';

      case "zwevend":
        return '<div class="zweef"><img src="' + veilig(b.src) + '" alt="' + veilig(b.alt || "") + '">' +
          (b.onder ? '<span>' + veilig(b.onder) + '</span>' : "") + '</div>';

      case "iconen":
        return '<div class="drieiconen">' + (b.items || []).map(function (i) {
          return '<div><span>' + i.teken + '</span><b>' + veilig(i.kop) + '</b>' +
            (i.sub ? '<small>' + veilig(i.sub) + '</small>' : "") + '</div>';
        }).join("") + '</div>';

      case "uitklap":
        return kop(b) + '<div class="uitklappen">' + (b.items || []).map(function (u, n) {
          return '<div class="uitk">' +
            '<button class="uitkop" data-uit>' +
              (u.beeld ? '<img src="' + veilig(u.beeld) + '" alt="">' : "") +
              '<span><b>' + veilig(u.titel) + '</b>' +
              (u.kort ? '<em>' + veilig(u.kort) + '</em>' : "") + '</span>' +
              '<i>&#8250;</i></button>' +
            '<div class="uitlijf">' + (u.tekst || "") + '</div></div>';
        }).join("") + '</div>';

      case "keuzes":
        return kop(b) + '<div class="keuzerij">' + (b.items || []).map(function (k) {
          var inhoud = '<b>' + veilig(k.titel) + '</b><span>' + veilig(k.tekst) + '</span>' +
            (k.duur ? '<i>' + veilig(k.duur) + '</i>' : "");
          return k.href
            ? '<a class="keuze" href="' + veilig(k.href) + '"' +
              (k.nieuw ? ' target="_blank" rel="noopener"' : "") + '>' + inhoud + '</a>'
            : '<div class="keuze stil-kaart">' + inhoud + '</div>';
        }).join("") + '</div>';

      case "index":
        return kop(b) + '<div class="index">' + (b.items || []).map(function (s) {
          var inhoud = veilig(s.titel) + "<em>" + veilig(s.uitleg || "") + "</em>";
          return s.href ? '<a href="' + veilig(s.href) + '">' + inhoud + '</a>'
                        : '<span class="rij">' + inhoud + '</span>';
        }).join("") + '</div>';

      default:
        return '<div class="blokje">' +
          (b.kop ? '<div class="h">' + veilig(b.kop) + '</div>' : "") +
          (b.tekst ? '<div class="t">' + b.tekst + '</div>' : "") +
          (b.plaatsing ? '<div class="pl">' + veilig(b.plaatsing) + '</div>' : "") +
          '</div>';
    }
  }

  /* De korte inspiratie bij een fase: audio of video. Staat er nog geen bron,
     dan blijft de knop staan maar is hij uit, met het label dat erbij hoort.
     Zo kan elke fase er een krijgen zodra de opname er is. */
  var mediaTeller = 0;

  function mediaHTML(m) {
    if (!m || !m.label) return "";
    var driehoek = '<i aria-hidden="true"></i>';
    var sid = "hmedia-" + (++mediaTeller);
    var soort = m.soort === "video" ? "video" : "audio";
    var speler = m.bron
      ? '<' + soort + ' class="hmediaspeler" id="' + sid + '" controls preload="none" hidden' +
        (soort === "video" ? ' playsinline' : "") +
        '><source src="' + veilig(m.bron) + '"></' + soort + '>'
      : "";
    /* in de vorm van het kader: een omlijnd vak met het label erboven en de
       zin eronder, zoals in fase 1 */
    if (m.vorm === "kader") {
      return '<div class="hkader hkmedia' + (m.bron ? "" : " straks") + '"' +
        (m.bron ? ' data-media="' + sid + '"' : "") + ' role="group">' +
        '<b>' + driehoek + veilig(m.label) +
        (!m.bron && m.straks ? '<u>' + veilig(m.straks) + '</u>' : "") + '</b>' +
        (m.tekst ? '<span>' + veilig(m.tekst).replace(/\n/g, "<br>") + '</span>' : "") +
        '</div>' + speler;
    }
    if (!m.bron) {
      return '<button class="hmedia straks" type="button" disabled>' + driehoek +
        '<span>' + veilig(m.label) + '</span>' +
        (m.straks ? '<u>' + veilig(m.straks) + '</u>' : "") + '</button>';
    }
    return '<button class="hmedia" type="button" data-media="' + sid + '">' + driehoek +
      '<span>' + veilig(m.label) + '</span>' +
      (m.duur ? '<u>' + veilig(m.duur) + '</u>' : "") + '</button>' + speler;
  }

  /* er speelt er altijd maar één; de knop van de rest springt terug */
  function stilAlleMedia(behalve) {
    document.querySelectorAll(".hmediaspeler").forEach(function (sp) {
      if (sp === behalve) return;
      if (!sp.paused) sp.pause();
      var kn = document.querySelector('[data-media="' + sp.id + '"]');
      if (kn) kn.classList.remove("speelt");
    });
  }

  function heroHTML(f, n) {
    if (!f.hero) return "";
    var x = f.hero;
    return '<div class="hero"><img src="' + veilig(x.beeld) + '" alt=""><div class="hwaas"></div>' +
      '<div class="htekst"><div class="hlabel">' + veilig(x.label || ("Fase " + n)) + '</div>' +
      '<h1>' + (f.titel || "") + '</h1><div class="hlijn"></div>' +
      (x.sub ? '<div class="hsub">' + veilig(x.sub) + '</div>' : "") +
      (x.vraag ? '<div class="hvraag">' + veilig(x.vraag) + '</div>' : "") +
      (x.intro ? '<div class="hintro">' + veilig(x.intro).replace(/\n/g, "<br>") + '</div>' : "") +
      /* het kader zegt dat dit een van de drie eerste stappen is */
      (x.kader ? '<div class="hkader">' +
        (x.kaderLabel ? '<b>' + veilig(x.kaderLabel) + '</b>' : "") +
        '<span>' + veilig(x.kader).replace(/\n/g, "<br>") + '</span></div>' : "") +
      mediaHTML(x.media) +
      '</div>' +
      (x.rechts ? '<div class="hrechts">' + veilig(x.rechts).replace(/\n/g, "<br>") + '</div>' : "") +
      '</div>';
  }

  /* uitleg in twee kolommen onder de hero */
  function introHTML(f) {
    var x = f.intro;
    if (!x) return "";
    var l = x.links || {}, r = x.rechts || {};
    return '<div class="tweeluik"><div class="tlinks">' +
      '<h2>' + (l.kop || "") + '</h2>' +
      '<p>' + veilig(l.tekst || "").replace(/\n/g, "<br>") + '</p>' +
      (l.iconen ? '<div class="ticonen">' + l.iconen.map(function (i) {
        return '<div><span>' + i.teken + '</span><small>' + veilig(i.woord) + '</small></div>';
      }).join("") + '</div>' : "") +
      '</div><div class="trechts">' +
      '<div class="lkop">' + veilig(r.kop || "") + '<span></span></div>' +
      '<ol class="tstappen">' + (r.items || []).map(function (t, n) {
        return '<li><i>' + (n + 1) + '</i><span>' + veilig(t) + '</span></li>';
      }).join("") + '</ol>' +
      (r.slot ? '<div class="tslot">' + veilig(r.slot).replace(/\n/g, "<br>") + '</div>' : "") +
      '</div></div>';
  }

  function stappenHTML(f) {
    if (!f.stappen) return "";
    return (f.overzichtlabel ? '<div class="okoplbl">' + veilig(f.overzichtlabel) + '</div>' : "") +
      (f.overzichtkop ? '<div class="okop">' + veilig(f.overzichtkop) + '</div>' : "") +
      '<div class="okaarten" id="blok-lagen">' + f.stappen.map(function (k, i) {
        var nr = ("0" + (i + 1)).slice(-2) + ".";
        return '<button class="okaart" data-stap="' + i + '">' +
          '<img src="' + veilig(k.beeld) + '" alt="">' +
          '<span class="otekst"><span class="okop2"><span class="onr">' + nr + '</span>' +
          '<b>' + veilig(k.titel) + '</b><span class="opijl">&#8250;</span></span>' +
          '<span class="okrt">' + veilig(k.kaart || "") + '</span></span></button>';
      }).join("") + '</div><div class="opaneel" id="paneel-' + veilig(f.sleutel) + '"></div>';
  }

  /* open of sluit een stap onder het kaartenraster */
  function toonStap(faseNaam, f, i) {
    var paneel = el("paneel-" + f.sleutel);
    var kaarten = document.querySelectorAll("#" + faseNaam + " .okaart");
    if (paneel.getAttribute("data-open") === String(i)) {
      var wasSmal = document.body.classList.contains("stapopen");
      paneel.innerHTML = ""; paneel.removeAttribute("data-open");
      kaarten.forEach(function (k) { k.classList.remove("aan"); });
      var r = document.querySelector("#" + faseNaam + " .okaarten");
      if (r) r.classList.remove("strip");
      document.body.classList.remove("stapopen");
      kleurverloop();
      /* terug op de kaart waar je vandaan kwam, niet bovenaan de pagina */
      if (wasSmal && kaarten[i]) {
        kaarten[i].scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    var k = f.stappen[i], nr = ("0" + (i + 1)).slice(-2);
    paneel.innerHTML =
      '<div class="okruimel">' +
        '<div class="ovoortgang" aria-hidden="true"><i></i></div>' +
        '<div class="okruim"><span class="opad">' + veilig(f.hero && f.hero.label || "") +
          ' &#8250; ' + nr + ' &#8250; ' + veilig(k.titel) + '</span>' +
        '<span class="okort">' + nr + ' &#8250; ' + veilig(k.titel) + '</span>' +
          '<button class="osluit" data-sluit>' + veilig(T("sluiten", f.sluiten)) + ' &#10005;</button></div>' +
        '<div class="okop3"><span class="onr groot">' + nr + '</span>' +
          '<div><h2>' + veilig(k.titel) + '</h2>' +
          (k.sub ? '<p class="hsub">' + veilig(k.sub) + '</p>' : "") + '</div>' +
          (k.quote && k.quoteTonen !== false
            ? '<blockquote>' + veilig(k.quote).replace(/\n/g, "<br>") + '</blockquote>' : "") +
        '</div>' +
        (k.blokken || []).map(blokHTML).join("") +
        '<div class="knoppen strak plnav"><button class="knop licht" data-sluit>&#8249; ' +
          '<span class="plkort">' + veilig(T("terug", "Terug")) + '</span>' +
          '<span class="pllang">' + veilig(T("terugkop", f.terugkop)) + '</span></button>' +
          (k.midden ? '<span class="plmidden">' + veilig(k.midden) + '</span>' : "") +
          '<span class="plteller">' + (i + 1) + ' / ' + f.stappen.length + '</span>' +
          (i + 1 < f.stappen.length
            ? '<button class="knop" data-stap="' + (i + 1) + '">' +
              veilig(T("volgende", f.volgende)) +
              '<span class="pllang"> &#183; ' + veilig(f.stappen[i + 1].titel) + '</span>' +
              ' &#8250;</button>' : "") +
        '</div></div>';
    paneel.setAttribute("data-open", String(i));
    paneel.style.setProperty("--paneelbeeld", "url(" + (k.achtergrond || k.beeld) + ")");
    kaarten.forEach(function (kk, n) { kk.classList.toggle("aan", n === i); });
    var raster = document.querySelector("#" + faseNaam + " .okaarten");
    if (raster) raster.classList.add("strip");

    paneel.querySelectorAll("[data-bewaar]").forEach(function (t) {
      var sl = "szinn-notitie-" + faseNaam + "-" + i + "-" + t.getAttribute("data-bewaar");
      t.value = lees(sl, "");
      t.addEventListener("input", function () { schrijf(sl, t.value); });
    });
    kleurverloop();

    /* Op een telefoon is een stap een eigen scherm, geen stuk pagina. Het
       paneel neemt het beeld over, de pagina eronder scrollt niet mee, en de
       knoppen staan onderin binnen duimbereik. */
    if (smal()) {
      document.body.classList.add("stapopen");
      paneel.scrollTop = 0;
      volgVoortgang(paneel);
      window.scrollTo({ top: window.scrollY });
    } else {
      paneel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function smal() { return window.matchMedia("(max-width:820px)").matches; }

  /* het dunne streepje bovenin laat zien hoe ver je in deze stap bent */
  function volgVoortgang(paneel) {
    var balk = paneel.querySelector(".ovoortgang i");
    if (!balk) return;
    function meet() {
      var max = paneel.scrollHeight - paneel.clientHeight;
      var deel = max > 8 ? Math.min(1, paneel.scrollTop / max) : 1;
      balk.style.transform = "scaleX(" + deel.toFixed(4) + ")";
    }
    paneel.addEventListener("scroll", meet, { passive: true });
    meet();
  }

  /* ---------- taalkeuze ----------
     De talen staan in het veld "talen" van de klantdata: per taal een code,
     een kort label voor de knop en het pad naar het databestand. Wisselen
     bewaart de keuze en laadt de pagina opnieuw; voortgang en notities staan
     in localStorage en zijn taalonafhankelijk, dus die blijven staan. */
  function talen() {
    var t = (data && data.talen) || [];
    return t.length > 1 ? t : [];
  }
  function taalPad(t) {
    return String(t.data || "").replace(/\{klant\}/g, klantId);
  }
  function taalkiezerHTML() {
    var lijst = talen();
    if (!lijst.length) return "";
    var nu = (data && data.taal) || "";
    return lijst.map(function (t) {
      var aan = t.code === nu;
      return '<button type="button" data-taal="' + veilig(t.code) + '"' +
        (aan ? ' class="aan" aria-current="true"' : "") +
        ' title="' + veilig(t.label || t.code) + '">' +
        veilig(t.kort || String(t.code).toUpperCase()) + '</button>';
    }).join('<span aria-hidden="true">·</span>');
  }
  function vulTaalkiezers() {
    var h = taalkiezerHTML();
    ["z-taal", "d-taal"].forEach(function (id) {
      var v = el(id);
      if (!v) return;
      v.innerHTML = h;
      v.hidden = !h;
    });
  }
  function wisselTaal(code) {
    var t = talen().filter(function (x) { return x.code === code; })[0];
    if (!t || code === (data && data.taal)) return;
    /* Het pad wordt onopgelost bewaard, mét de klant erbij. Anders zou een
       taalkeuze bij de ene klant het bestand van die klant vasthouden en bij
       de volgende ?klant= nog steeds dat oude bestand laden. */
    schrijf(SLEUTEL_TAAL, JSON.stringify({ code: t.code, data: t.data, klant: klantId }));
    /* staat het welkomstscherm open, kom dan terug op hetzelfde paneel, en
       zet de video terug op de seconde waar hij stond zodat je niets mist */
    var d = el("drempel");
    var open2 = !!(d && !d.hidden);
    schrijf(SLEUTEL_PANEEL, open2 ? String(paneel) : "");
    var vid = el("d-video");
    schrijf(SLEUTEL_VIDEO, open2 && vid && vid.currentTime > 0.3
      ? String(Math.floor(vid.currentTime * 10) / 10) : "");
    location.reload();
  }
  function bewaardeTaal() {
    try { return JSON.parse(lees(SLEUTEL_TAAL, "") || "null"); }
    catch (e) { return null; }
  }

  /* Dezelfde vorm in elke fase, maar niet dezelfde zin: drie keer woordelijk
     hetzelfde leest als een sjabloon. De fase mag hem overschrijven met
     spiegel: "..." of spiegel: { kop, tekst }. */
  function spiegelHTML(f) {
    var eigen = f && f.spiegel;
    var t = (eigen && typeof eigen === "object" ? eigen.tekst : null) ||
            (typeof eigen === "string" ? eigen : "") || T("spiegelregel");
    if (!t) return "";
    var k = (eigen && typeof eigen === "object" ? eigen.kop : null) || T("spiegelkop");
    return '<div class="spiegel"><i>&#10022;</i>' +
      (k ? '<b>' + veilig(k) + '</b>' : "") +
      '<p>' + veilig(t).replace(/\n/g, "<br>") + '</p></div>';
  }

  function vulFase(naam, f, n) {
    var h = heroHTML(f, n);
    if (!f.hero) {
      h += '<h1>' + (f.titel || "") + '</h1>';
      if (f.sub) h += '<p class="sub">' + veilig(f.sub) + '</p>';
      if (f.duur) h += '<span class="duur">' + veilig(f.duur) + '</span>';
    }
    /* de spiegelregel: dit is niet wie je bent, dit is de energie waarmee je
       mag werken. Staat in elke fase op dezelfde plek, vlak onder de kop */
    if (f.spiegel !== false) h += spiegelHTML(f);
    if (f.eenzin) h += '<div class="groot">' + veilig(f.eenzin) + '</div>';
    h += stappenHTML(f);
    h += introHTML(f);

    /* alles onder de stappen komt in een eigen omhulsel, zodat een fase daar
       een andere kleurstelling kan krijgen dan bovenaan */
    h += '<div class="faseonder">';
    /* de stappenbalk hoort helemaal onderaan, na de slottekst en de knop */
    var blokken = (f.blokken || []).filter(function (b) { return b.type !== "stappenbalk"; });
    var balken = (f.blokken || []).filter(function (b) { return b.type === "stappenbalk"; });
    h += blokken.map(function (b) {
      var inhoud = blokHTML(b);
      return b.anker ? '<div id="blok-' + veilig(b.anker) + '">' + inhoud + '</div>' : inhoud;
    }).join("");

    if (f.knoppenUit !== true) {
      if (f.knoppenLabel) h += '<div class="knoppenkop">' + veilig(f.knoppenLabel) + '</div>';
      h += '<div class="knoppen">';
      if (f.pdf) h += '<a class="knop goud" href="' + veilig(adres(f.pdf)) + '" download>&darr; ' +
                      veilig(T("downloaden", f.pdfLabel)) + '</a>';
      h += '<button class="knop licht" data-print>' + veilig(T("printen")) + '</button></div>';
    }

    if (f.midden) h = h;
    if (f.afsluiting || f.afsluitkop) {
      /* met een eigen kop is de streep erboven dubbelop */
      h += '<div class="faseslot' + (f.afsluitkop ? " metkop" : "") + '">' +
        (f.afsluitkop ? '<div class="faseslotkop"><span></span><em>' +
          veilig(f.afsluitkop) + '</em><span></span></div>' : "") +
        (f.afsluiting ? '<p>' + veilig(f.afsluiting).replace(/\n/g, "<br>") + '</p>' : "") +
        '</div>';
    }
    if (f.verder) {
      h += '<div class="knoppen strak"><button class="knop" data-naar="' + (n + 1) + '">' +
           veilig(f.verder) + ' &rarr;</button></div>';
    }
    if (f.slotregel) h += '<p class="sub kalm">' + veilig(f.slotregel) + '</p>';
    h += balken.map(blokHTML).join("");
    h += '<footer><span>' + veilig(data.voettekst || "") + '</span><em>' +
         veilig(T("merkregel")) + '</em></footer>';
    /* de kleine letter staat onder elke fase, niet één keer ergens weggestopt */
    if (T("disclaimer")) {
      h += '<p class="disclaimer">' + veilig(T("disclaimer")).replace(/\n/g, "<br>") + '</p>';
    }
    h += '</div>';
    el(naam).innerHTML = h;
    herstelReflectie(naam);
    herstelVinken(el(naam));
  }

  /* wat iemand opschreef blijft staan, ook als hij later terugkomt */
  function reflectieSleutel(naam) { return "szinn-inzicht-" + klantId + "-" + naam; }

  function herstelReflectie(naam) {
    var v = document.querySelector("#" + naam + " .rveld");
    if (!v) return;
    var eerder = lees(reflectieSleutel(naam), "");
    if (eerder) v.value = eerder;
  }

  /* een enkele planeet openen */
  function toonPlaneet(lijst, n) {
    var v = el("pldetail");
    if (!v) return;
    if (v.getAttribute("data-open") === String(n)) {
      v.innerHTML = ""; v.removeAttribute("data-open");
      document.querySelectorAll(".plkaart").forEach(function (k) { k.classList.remove("aan"); });
      return;
    }
    var p = lijst[n], nr = ("0" + (n + 1)).slice(-2);
    var vorige = lijst[(n - 1 + lijst.length) % lijst.length];
    var volgende = lijst[(n + 1) % lijst.length];
    v.innerHTML =
      '<div class="plvlak" style="--plbeeld:url(' + p.beeld + ')">' +
        '<button class="plterug" data-planeet="' + n + '">' + veilig(T("terugPlaneten")) + '</button>' +
        '<div class="plkop"><span class="plteken">' + p.teken + '</span>' +
          '<h2>' + nr + ' &middot; ' + veilig(p.naam.toUpperCase()) + '</h2></div>' +
        '<div class="plsub">' + veilig(p.sub || "") + '</div>' +
        '<p class="pltekst">' + veilig(p.algemeen || "") + '</p>' +
        '<div class="plvak"><div class="plvaka">' +
          '<div class="plteken klein">' + (p.tekenTeken || "") + '</div>' +
          '<b>' + veilig(p.jouw || "") + '</b>' +
          '<p>' + veilig(p.jouwtekst || "") + '</p></div>' +
          '<div class="plvakb"><span class="plbl">' + veilig(T("kernthemas")) + '</span><ul>' +
            (p.themas || []).map(function (t) { return '<li>' + veilig(t) + '</li>'; }).join("") +
          '</ul></div></div>' +
        '<div class="plonder">' +
          '<div><div class="lkop">' + veilig(T("herkenning")) + '<span></span></div>' +
            '<ul class="lijst vink">' + (p.herkenning || []).map(function (t) {
              return '<li><i>&#10003;</i><span>' + veilig(t) + '</span></li>';
            }).join("") + '</ul></div>' +
          '<div class="plherinnering"><span class="plankh">&#9765;</span>' +
            '<span class="plbl">' + veilig(T("herinnering")) + '</span>' +
            '<em>' + veilig(p.herinnering || "").replace(/\n/g, "<br>") + '</em></div>' +
        '</div>' +
        '<div class="lkop">' + veilig(T("watHerkenJe")) + '<span></span></div>' +
        '<div class="invoer"><textarea rows="3" data-bewaar="planeet-' + n +
          '" placeholder="' + veilig(T("schrijfhier")) + '"></textarea><i>&#9998;</i></div>' +
        '<div class="knoppen plnav"><button class="knop licht" data-planeet="' +
            ((n - 1 + lijst.length) % lijst.length) + '">&#8249; ' + veilig(vorige.naam) + '</button>' +
          '<span class="plmidden">' + veilig(T("zelfdeLicht")) + '</span>' +
          '<button class="knop" data-planeet="' + ((n + 1) % lijst.length) + '">' +
            veilig(volgende.naam) + ' &#8250;</button></div>' +
      '</div>';
    v.setAttribute("data-open", String(n));
    document.querySelectorAll(".plkaart").forEach(function (k, i) { k.classList.toggle("aan", i === n); });
    v.querySelectorAll("[data-bewaar]").forEach(function (t) {
      var sl = "szinn-notitie-" + t.getAttribute("data-bewaar");
      t.value = lees(sl, "");
      t.addEventListener("input", function () { schrijf(sl, t.value); });
    });
    v.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------- navigatie en vrijgave ---------- */
  function tekenTabs() {
    document.querySelectorAll(".fase button:not(.zstart)").forEach(function (b, i) {
      b.classList.toggle("slot", i + 1 > open);
    });
    tekenStapbalk();
  }
  function melding() {
    var m = el("melding");
    m.textContent = data.slotmelding || T("slotmelding");
    m.hidden = false;
    setTimeout(function () { m.hidden = true; }, 4000);
  }

  /* ── de vinkjes op de terugblik ──────────────────────────────────────
     Ze veranderen niets aan de reis: je vinkt af wat je gehad hebt, voor
     jezelf. Ze staan los van de voortgang die naar het dashboard gaat, en
     ze worden per klant onthouden zodat ze blijven staan als je terugkomt. */
  var SLEUTEL_VINK = "szinn-vink-v1";
  function vinkSleutel() { return SLEUTEL_VINK + (klantId ? "-" + klantId : ""); }
  function vinken() {
    try { return JSON.parse(lees(vinkSleutel(), "{}")) || {}; } catch (e) { return {}; }
  }
  function zetVink(knop, aan) {
    var naam = knop.getAttribute("data-vink");
    var alle = vinken();
    if (aan) alle[naam] = true; else delete alle[naam];
    schrijf(vinkSleutel(), JSON.stringify(alle));
    toonVink(knop, aan);
  }
  function toonVink(knop, aan) {
    knop.setAttribute("aria-checked", aan ? "true" : "false");
    knop.classList.toggle("aan", !!aan);
    var t = knop.querySelector("span");
    if (t) t.textContent = aan ? (knop.dataset.aan || T("afgevinkt"))
                               : (knop.dataset.uit || T("afvinken"));
  }
  /* na het opbouwen van een fase de eerder gezette vinkjes terugzetten */
  function herstelVinken(waar) {
    var alle = vinken();
    (waar || document).querySelectorAll("[data-vink]").forEach(function (knop) {
      toonVink(knop, !!alle[knop.getAttribute("data-vink")]);
    });
  }

  /* voortgang delen met het dashboard.
     1. localStorage, leesbaar voor elke pagina op hetzelfde domein
     2. postMessage, voor een dashboard dat de journey in een venster of frame opent */
  function meldVoortgang(nu) {
    var stand = {
      klant: klantId,
      fase: nu,
      faseNaam: FASES[nu - 1],
      open: open,
      afgerond: open >= 3 && nu === 3,
      bijgewerkt: new Date().toISOString()
    };
    schrijf(SLEUTEL_VOORTGANG + (klantId ? "-" + klantId : ""), JSON.stringify(stand));
    try {
      var bericht = { bron: "szinn-journey", stand: stand };
      if (window.opener) window.opener.postMessage(bericht, "*");
      if (window.parent && window.parent !== window) window.parent.postMessage(bericht, "*");
    } catch (e) {}
  }
  function ga(n, schuif) {
    n = Math.min(Math.max(n, 1), 3);
    if (n > open) { melding(); return; }
    FASES.forEach(function (f, i) { el(f).classList.toggle("aan", i + 1 === n); });
    document.querySelectorAll(".fase button:not(.zstart)").forEach(function (b, i) {
      b.classList.toggle("aan", i + 1 === n);
    });
    schrijf(SLEUTEL_FASE, String(n));
    document.body.setAttribute("data-fase", FASES[n - 1]);
    /* op een telefoon staat in de balk welke fase open is */
    var nu2 = el("z-nu");
    if (nu2) {
      var L2 = (data && data.labels && data.labels.fases) || null;
      nu2.textContent = n + " \u00b7 " + (L2 && L2[n - 1] ? L2[n - 1][0] : FASES[n - 1]);
    }
    document.body.classList.remove("menuopen");
    tekenStapbalk();
    kleurverloop();
    meldVoortgang(n);
    if (history.replaceState) history.replaceState(null, "", "#" + FASES[n - 1]);
    if (schuif !== false) window.scrollTo({ top: 0, behavior: "smooth" });
  }
  /* de balk onderaan weet zelf waar je bent en wat er nog dicht zit */
  function tekenStapbalk() {
    var nu = parseInt(lees(SLEUTEL_FASE, "1"), 10) || 1;
    document.querySelectorAll(".sbalk").forEach(function (balk) {
      balk.querySelectorAll(".sstap").forEach(function (st, i) {
        var n = i + 1;
        st.classList.toggle("hier", n === nu);
        st.classList.toggle("dicht", n > open);
        if (n === nu) st.setAttribute("aria-current", "step");
        else st.removeAttribute("aria-current");
      });
    });
  }

  function ontgrendel(n) {
    if (n > open) { open = n; schrijf(SLEUTEL_OPEN, String(open)); tekenTabs(); }
    ga(n);
  }

  /* ---------- opbouwen ---------- */
  function bouw(d) {
    data = d;
    document.documentElement.lang = d.taal || "en";
    open = Math.max(1, parseInt(lees(SLEUTEL_OPEN, "1"), 10) || 1);
    if (d.allesOpen) open = 3;

    FASES.forEach(function (naam, i) {
      var f = d[naam] || {};
      f.sleutel = naam;
      vulFase(naam, f, i + 1);
      if (f.stappen) {
        el(naam).addEventListener("click", function (e) {
          var sluit = e.target.closest("[data-sluit]");
          if (sluit) { toonStap(naam, f, Number(el("paneel-" + naam).getAttribute("data-open"))); return; }
          var kn = e.target.closest("[data-stap]");
          if (kn) toonStap(naam, f, Number(kn.getAttribute("data-stap")));
        });
      }
    });

    document.querySelectorAll(".fase button:not(.zstart)").forEach(function (b, i) {
      b.addEventListener("click", function () { ga(i + 1); });
    });
    document.body.addEventListener("click", function (e) {
      /* het vinkje: alleen voor jezelf, het ontgrendelt niets en meldt niets
         aan het dashboard. Het onthoudt wel wat je aangevinkt hebt. */
      var vk = e.target.closest("[data-vink]");
      if (vk) { zetVink(vk, vk.getAttribute("aria-checked") !== "true"); return; }
      var k = e.target.closest("[data-naar]");
      if (k) { ontgrendel(parseInt(k.getAttribute("data-naar"), 10)); return; }
      var pk = e.target.closest("[data-planeet]");
      if (pk) {
        var blok = null;
        (d.herkenning.stappen || []).forEach(function (st) {
          (st.blokken || []).forEach(function (b) { if (b.type === "planeten") blok = b; });
        });
        if (blok) toonPlaneet(blok.items, Number(pk.getAttribute("data-planeet")));
        return;
      }
      var ank = e.target.closest("[data-anker]");
      if (ank) {
        var doelvak = document.getElementById("blok-" + ank.getAttribute("data-anker"));
        if (doelvak) doelvak.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      /* de korte inspiratie: de speler schuift open en begint te spelen */
      var mk = e.target.closest("[data-media]");
      if (mk) {
        var sp = el(mk.getAttribute("data-media"));
        if (sp) {
          if (sp.paused) {
            stilAlleMedia(sp);
            sp.hidden = false;
            mk.classList.add("speelt");
            var poging = sp.play();
            if (poging && poging.catch) poging.catch(function () {});
          } else {
            sp.pause();
            mk.classList.remove("speelt");
          }
        }
        return;
      }
      /* het inzicht bewaren, en even laten zien dat het gelukt is */
      var bk = e.target.closest("[data-bewaar]");
      if (bk) {
        var vak = bk.closest(".rvak");
        var veld = vak && vak.querySelector(".rveld");
        var scherm = bk.closest(".scherm");
        if (veld && scherm) {
          schrijf(reflectieSleutel(scherm.id), veld.value);
          bk.classList.add("gelukt");
          setTimeout(function () { bk.classList.remove("gelukt"); }, 1800);
        }
        return;
      }
      /* de balk onderaan: terug mag altijd, vooruit alleen als het open is */
      var sk = e.target.closest("[data-fase-naar]");
      if (sk) {
        var doel = parseInt(sk.getAttribute("data-fase-naar"), 10);
        if (doel === (parseInt(lees(SLEUTEL_FASE, "1"), 10) || 1)) {
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        ga(doel);
        return;
      }
      var tk = e.target.closest("[data-taal]");
      if (tk) { wisselTaal(tk.getAttribute("data-taal")); return; }
      var uit = e.target.closest("[data-uit]");
      if (uit) { uit.parentNode.classList.toggle("open"); return; }
      if (e.target.closest("[data-print]")) window.print();
    });

    drempel(d);
    vulTaalkiezers();
    /* ?taal=nl in het adres kiest de taal en verdwijnt daarna uit de balk,
       zodat je iemand een link in de juiste taal kunt sturen */
    var gevraagd = new URLSearchParams(location.search).get("taal");
    if (gevraagd) {
      schrapParam("taal");
      if (gevraagd !== d.taal) { wisselTaal(gevraagd); return; }
    }
    var L = d.labels || {};
    /* de kop boven de fases benoemt dat dit de eerste stappen zijn */
    var fk = el("z-fasekop");
    if (fk && L.fasesKop) { fk.textContent = L.fasesKop; fk.hidden = false; }
    if (L.fases) {
      document.querySelectorAll(".fase button:not(.zstart)").forEach(function (b, i) {
        if (L.fases[i]) {
          b.innerHTML = '<i>' + (i + 1) + '</i><span><u>' + veilig(L.fases[i][0]) +
            '</u><small>' + veilig(L.fases[i][1]) + '</small></span>';
        }
      });
    }
    /* de uitklapknop van de zijbalk op een telefoon */
    var menu = el("z-menu");
    if (menu) {
      menu.addEventListener("click", function () {
        var open2 = document.body.classList.toggle("menuopen");
        menu.setAttribute("aria-expanded", open2 ? "true" : "false");
      });
    }
    /* een keuze in het menu klapt het weer dicht */
    document.querySelector(".zijbalk").addEventListener("click", function (e) {
      if (e.target.closest(".fase button, .zmenuitem, .zprofiel, .zuitlog, [data-taal]")) {
        document.body.classList.remove("menuopen");
        document.body.classList.remove("zijopen");
        if (menu) menu.setAttribute("aria-expanded", "false");
        var op = el("z-open");
        if (op) op.setAttribute("aria-expanded", "false");
      }
    });

    var startknop = el("naar-start");
    if (startknop) {
      startknop.querySelector("u").textContent = T("zijStart");
      startknop.querySelector("small").textContent = T("zijStartSub");
      startknop.addEventListener("click", function () { toonDrempel(); });
    }

    /* de merkregel onder het logo */
    var mo = el("z-merkonder");
    if (mo && L.merkOnder) mo.textContent = L.merkOnder;

    /* ── de navigatie ─────────────────────────────────────────────────
       Eén zijbalk voor drie plekken. navigatie.plek zegt waar je bent
       (dashboard, blueprint of handleiding); dat bepaalt de kleur van het
       blok en of eronder je reis staat of het menu. */
    var nav = d.navigatie || {};
    var PLEKKEN = {
      dashboard:   { kleur: "blauw", teken: "huis" },
      blueprint:   { kleur: "ember", teken: "boek" },
      handleiding: { kleur: "goud",  teken: "boek" }
    };
    var TEKENS = {
      huis:  '<svg viewBox="0 0 20 20"><path d="M3 9.2 10 3.5l7 5.7"/><path d="M5 8.6V16h10V8.6"/></svg>',
      boek:  '<svg viewBox="0 0 20 20"><path d="M3.6 4h4.8c.9 0 1.6.6 1.6 1.4v10.2c0-.7-.7-1.3-1.6-1.3H3.6z"/>' +
             '<path d="M16.4 4h-4.8c-.9 0-1.6.6-1.6 1.4v10.2c0-.7.7-1.3 1.6-1.3h4.8z"/></svg>',
      klok:  '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7"/><path d="M10 6v4.3l2.8 1.7"/></svg>',
      bloem: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="6.6"/><circle cx="10" cy="6.6" r="3"/>' +
             '<circle cx="10" cy="13.4" r="3"/><circle cx="6.6" cy="10" r="3"/><circle cx="13.4" cy="10" r="3"/></svg>',
      quote: '<svg viewBox="0 0 20 20"><path d="M4 12.4V9.2C4 7 5.4 5.6 7.6 5.4v1.8C6.5 7.4 6 8 6 9h1.8v3.4z"/>' +
             '<path d="M11.4 12.4V9.2c0-2.2 1.4-3.6 3.6-3.8v1.8c-1.1.2-1.6.8-1.6 1.8h1.8v3.4z"/></svg>',
      cadeau:'<svg viewBox="0 0 20 20"><path d="M3.4 9h13.2v7.4H3.4z"/><path d="M2.6 6.2h14.8V9H2.6z"/>' +
             '<path d="M10 6.2v10.2"/><path d="M10 6.2C10 4.6 8.9 3.4 7.6 3.4S5.4 4.4 5.4 5.4 6.6 6.2 10 6.2z"/>' +
             '<path d="M10 6.2c0-1.6 1.1-2.8 2.4-2.8s2.2 1 2.2 2-1.2.8-4.6.8z"/></svg>',
      vraag: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7"/>' +
             '<path d="M8.2 8.1c0-1 .8-1.8 1.8-1.8s1.8.8 1.8 1.8c0 1.4-1.8 1.5-1.8 3"/>' +
             '<path d="M10 13.9v.1"/></svg>',
      ster:  '<svg viewBox="0 0 20 20"><path d="M10 2.2 11.9 8 18 10l-6.1 2L10 17.8 8.1 12 2 10l6.1-2z"/></svg>'
    };

    /* waar je bent. Geen knop: je staat er al. */
    var plekvak = el("z-plek");
    var plekNaam = nav.plek || "handleiding";
    var plek = PLEKKEN[plekNaam] || PLEKKEN.handleiding;
    var plektekst = nav.plekLabel ||
      (typeof d.handleiding === "string" ? d.handleiding
        : (d.handleiding && d.handleiding.label) || T("handleiding"));
    if (plekvak && plektekst) {
      plekvak.classList.add("op-" + plek.kleur);
      el("z-plekteken").innerHTML = TEKENS[plek.teken] || "";
      plekvak.querySelector("span").textContent = plektekst;
      plekvak.setAttribute("title", plektekst);
      plekvak.hidden = false;
    }

    /* de reis staat alleen in de handleiding; elders staat daar het menu */
    var reis = el("z-reis");
    var menulijst = el("z-menulijst");
    if (plekNaam !== "handleiding" && menulijst && (nav.menu || []).length) {
      if (reis) reis.hidden = true;
      var fkop = el("z-fasekop");
      if (fkop) fkop.hidden = true;
      menulijst.innerHTML = nav.menu.map(function (x) {
        return '<a class="zmenuitem" href="' + veilig(adres(x.href)) + '"' +
          (x.nieuw ? ' target="_blank" rel="noopener"' : "") + '>' +
          '<i class="zteken" aria-hidden="true">' + (TEKENS[x.teken] || TEKENS.ster) + '</i>' +
          '<span>' + veilig(x.label || "") + '</span></a>';
      }).join("");
      menulijst.hidden = false;
    }

    /* het citaat onder de navigatie, met wie het zei */
    var citaat = el("z-citaat");
    if (citaat && nav.citaat && nav.citaat.tekst) {
      citaat.querySelector("p").textContent = nav.citaat.tekst;
      citaat.querySelector("cite").textContent = nav.citaat.naam || "";
      citaat.hidden = false;
    }

    /* onderin wie je bent. Uitloggen hoort bij het account, niet los. */
    var acc = el("z-account");
    if (acc && (d.naam || d.voornaam)) {
      var vol = d.naam || d.voornaam;
      var foto = el("z-foto");
      if (d.foto) {
        foto.innerHTML = '<img src="' + veilig(d.foto) + '" alt="">';
      } else {
        foto.textContent = vol.split(/\s+/).slice(0, 2)
          .map(function (w) { return w.charAt(0); }).join("").toUpperCase();
      }
      acc.querySelector(".znaam b").textContent = vol;
      acc.querySelector(".znaam small").textContent = T("zijAccount");
      var pf = el("z-profiel");
      if (pf) pf.href = adres(d.accountHref || "{dashboard}");
      var ul = el("z-uitlog");
      if (ul && T("zijUitloggen")) {
        ul.querySelector("span").textContent = T("zijUitloggen");
        ul.href = adres(d.uitlogHref || "{dashboard}");
        ul.hidden = false;
      }
      acc.hidden = false;
    }
    /* op een tablet klapt de zijbalk open en dicht */
    var opener = el("z-open");
    if (opener) {
      opener.addEventListener("click", function () {
        var uit2 = document.body.classList.toggle("zijopen");
        opener.setAttribute("aria-expanded", uit2 ? "true" : "false");
      });
    }

    /* ?terug=<url> wint van het dashboardadres in de JSON, zodat het dashboard
       de klant kan terugsturen naar het scherm waar hij vandaan kwam */
    /* de losse terugknop naar het dashboard is weg: het gekleurde blok zegt
       waar je bent, en de weg naar het dashboard staat in de reis zelf. */

    var slotregel = el("d-slot");
    if (slotregel) slotregel.textContent = T("merkregel");
    var merkregel = el("z-merkregel");
    /* onderaan de zijbalk staat de merkregel als label, zonder punt */
    if (merkregel) merkregel.textContent = String(T("merkregel")).replace(/[.\s]+$/, "");
    document.querySelectorAll(".dmerk span").forEach(function (e) {
      e.textContent = T("merkonder");
    });

    document.title = "SZINN \u00b7 " + (d.naam || "blueprint");
    if (L.fases && el("z-fases")) {
      el("z-fases").textContent = L.fases.map(function (f) { return f[0]; }).join(" \u00b7 ");
    }
    tekenTabs();

    kleurverloop();
    setTimeout(kleurverloop, 300);
    window.addEventListener("load", kleurverloop);
    window.addEventListener("resize", kleurverloop);

    var hash = FASES.indexOf((location.hash || "").replace("#", "")) + 1;
    var bewaard = parseInt(lees(SLEUTEL_FASE, "1"), 10) || 1;
    ga(Math.min(hash || bewaard, open), false);
  }

  /* ---------- welkomstscherm: drie panelen ---------- */
  /* Paneel 1 de video, paneel 2 de ene vraag, paneel 3 het overzicht van de reis.
     Je schuift met de pijl, met swipen, met de pijltoetsen of met de stippen.
     De pijl licht op zodra de video is afgelopen. */

  var paneel = 0, panelen = 1;

  /* ---------- beweging ----------
     De panelen staan onder elkaar en schuiven van beneden naar boven.
     Het spoor wordt niet met een CSS-overgang verplaatst maar per beeldje
     berekend. "doel" is waar we heen willen, "nu" schuift daar zacht naartoe.
     Elke laag in een paneel heeft een eigen diepte: een positieve diepte
     beweegt trager dan het paneel en ligt dus achteraan, een negatieve
     beweegt sneller en komt naar voren. */

  var doel = 0, nu = 0, draait = false, lagen = [], rustig = false, sleept = false;
  /* twee soorten beweging: tijdens het slepen loopt "nu" zacht achter de vinger
     aan, en bij een klik of na het loslaten gaat hij in een vaste tijd naar het
     paneel toe. Dat laatste heeft een duidelijk einde, zonder lange uitloop. */
  var tweent = false, tweenVan = 0, tweenNaar = 0, tweenStart = 0, tweenDuur = 480;

  /* [selector, diepte, vervaagt].
     Het beeld beweegt trager dan het paneel en ligt dus achteraan. De tekst
     blijft één blok, zodat regels tijdens de beweging niet door elkaar lopen.
     Op paneel 3 komen de drie kolommen na elkaar binnen, dat kan omdat ze
     naast elkaar staan. */
  var DIEPTES = [
    ["#dp-1 .dbg",      0.42, false],
    ["#dp-1 .dbinnen", -0.05, true ],
    ["#dp-2 .dbinnen",  0.10, true ],
    ["#dp-3 .dbinnen",  0.08, true ],
    ["#dp-3 .df1",      0.03, false],
    ["#dp-3 .df2",      0.07, false],
    ["#dp-3 .df3",      0.12, false]
  ];

  /* Op een telefoon is het welkomstscherm geen schuivende reeks meer maar
     drie gewone pagina's: je ziet er één, je scrollt hem zoals elke andere
     pagina, en de pijl brengt je naar de volgende. Geen eigen vingerwerk,
     geen parallax, geen spoor dat verschuift. Dat werkt op elke telefoon,
     ook als vegen niet meewerkt. */
  var plat = false;
  function zetPlat() {
    plat = smal();
    document.body.classList.toggle("plat", plat);
  }

  function verzamelLagen() {
    lagen = [];
    /* De plek van een laag komt uit de volgorde van de panelen zoals ze
       werkelijk in de pagina staan, niet uit het nummer in hun id. Levert de
       klantdata een paneel niet mee, dan wordt dat paneel verwijderd en
       schuiven de panelen erna een plek op. Rekende je dan nog met het
       nummer uit de id, dan dacht een laag dat hij een scherm verderop stond
       dan het spoor ooit komt: hij schoof buiten beeld en vervaagde naar nul,
       en het paneel bleef leeg. */
    var vakken = [].slice.call(document.querySelectorAll(".dpaneel"));
    DIEPTES.forEach(function (rij) {
      document.querySelectorAll(rij[0]).forEach(function (e) {
        var vak = e.closest(".dpaneel");
        var i = vakken.indexOf(vak);
        if (i < 0) return;
        lagen.push({ el: e, paneel: i, diepte: rij[1], vervaagt: rij[2] });
        e.style.willChange = "transform, opacity";
      });
    });
  }

  /* de stap tussen twee panelen: meet het paneel zelf, niet het venster,
     anders ontstaat er een naad van een paar pixels tussen de panelen */
  function hoogte() {
    var v = document.querySelector(".dpaneel");
    var h = v ? v.getBoundingClientRect().height : 0;
    if (h > 1) return h;
    var d = el("drempel");
    return (d && d.clientHeight) || window.innerHeight || 1;
  }

  /* fase 2 loopt van donker naar licht. Waar dat omslaat hangt af van hoe hoog
     de kaartenrij uitvalt, dus dat meten we in plaats van het vast te zetten. */
  function kleurverloop() {
    var fase = el("helderheid");
    if (!fase) return;
    /* een verborgen fase levert nulmaten op, dus dan niets doen */
    if (!fase.classList.contains("aan")) return;
    var kaarten = fase.querySelector(".okaarten");
    var onder = fase.querySelector(".faseonder");
    if (!kaarten || !onder) return;
    var top = fase.getBoundingClientRect().top;
    /* donker tot net onder de kaarten, en binnen zo'n honderdvijftig pixels
       helemaal licht, zodat de kop eronder al op een lichte grond staat */
    var donkerTot = Math.round(kaarten.getBoundingClientRect().bottom - top) + 24;
    var lichtVanaf = donkerTot + 105;
    fase.style.setProperty("--donkerTot", donkerTot + "px");
    fase.style.setProperty("--lichtVanaf", lichtVanaf + "px");
  }

  /* een paneel dat niet in beeld past mag zelf scrollen; dan neemt het
     de verticale beweging over en schuift het spoor pas aan de rand door.
     We meten de inhoud, niet het paneel: de achtergrond van paneel 1 steekt
     bewust buiten beeld en telt dus niet mee. */
  /* de vervagende band onderaan hoort er alleen te zijn als er iets onder de
     pijlen door kan lopen. Past het paneel helemaal in beeld, dan weg ermee */
  function voetwaas() {
    var d = el("drempel");
    if (!d) return;
    /* op een telefoon scrollt de pagina zelf; de waas hoort er dan altijd te
       zijn, want er kan altijd iets onder de knoppenrij door lopen */
    if (plat) { d.classList.remove("aanEinde"); return; }
    var vak = document.querySelectorAll(".dpaneel")[paneel];
    d.classList.toggle("aanEinde", !(vak && vak.classList.contains("scrollt")));
  }

  function merkScroll() {
    schaalReis();
    /* drie losse pagina's: elk paneel scrollt altijd zelf, dus hier valt
       niets te meten en niets te schakelen */
    if (plat) {
      document.querySelectorAll(".dpaneel").forEach(function (v) {
        v.classList.remove("scrollt");
      });
      voetwaas();
      pijlenBij();
      return;
    }
    document.querySelectorAll(".dpaneel").forEach(function (v) {
      var binnen = v.querySelector(".dbinnen");
      var nodig = binnen ? binnen.scrollHeight : v.scrollHeight;
      if (binnen && binnen.dataset.schaal) nodig *= Number(binnen.dataset.schaal);
      /* een paar tientallen pixels over is bijna altijd alleen de onderste
         witruimte: dan liever afsnijden dan het paneel laten scrollen, want
         scrollen betekent dat vegen niet meer doorschuift */
      v.classList.toggle("scrollt", nodig - v.clientHeight > 36);
      if (!v.dataset.pijlgekoppeld) {
        v.dataset.pijlgekoppeld = "ja";
        v.addEventListener("scroll", function () { pijlenBij(); }, { passive: true });
      }
    });
    voetwaas();
    pijlenBij();
  }

  /* het reisoverzicht is een poster: op een breed scherm krimpt hij net zo ver
     als nodig om helemaal in beeld te passen, tot maximaal driekwart. Op een
     smal scherm staan de kolommen onder elkaar en scrollt het paneel gewoon. */
  /* vanafBoven: krimpen vanaf de bovenrand in plaats van vanuit het midden.
     Dat is de enige manier waarop het blok niet onder het paneel uit hangt.
     De hoogte die daardoor vrijkomt vangen we op met een verschuiving, zodat
     het geheel toch weer netjes midden in beeld staat. */
  function krimpPaneel(vakId, kies, bodem, vanafBoven) {
    var vak = el(vakId);
    var binnen = vak && vak.querySelector(kies);
    if (!binnen) return;
    delete binnen.dataset.schaal;
    delete binnen.dataset.schuif;
    binnen.style.transform = "";
    if (window.innerWidth < 900) return;
    var nodig = binnen.scrollHeight;
    var ruimte = vak.clientHeight;
    var s = Math.min(1, ruimte / Math.max(1, nodig));
    if (s >= 1) return;
    s = Math.max(bodem, s);
    binnen.dataset.schaal = s.toFixed(4);
    if (vanafBoven) {
      binnen.dataset.schuif = Math.max(0, (ruimte - nodig * s) / 2).toFixed(1);
    }
  }
  function schaalReis() {
    /* allebei de panelen moeten in één blik passen. Paneel 2 krimpt vanaf de
       bovenrand, paneel 3 vanuit het midden zoals het altijd al deed. */
    krimpPaneel("dp-2", ".dbinnen", 0.62, true);
    krimpPaneel("dp-3", ".dreis", 0.72);
    teken();
  }
  function huidigVak() { return document.querySelectorAll(".dpaneel")[paneel]; }

  /* Pagina 1 gaat in twee stappen: eerst de video (gestart met 'verder'),
     pas als die is afgelopen verschijnt de pijl vooruit onderin.
     'videoklaar' op #drempel zegt dat de video is afgelopen. */
  function videowacht() {
    var d = el("drempel");
    return paneel === 0 && d.classList.contains("videovol") &&
      !d.classList.contains("videoklaar");
  }

  /* op het laatste paneel blijft de pijl omlaag staan zolang er binnen dat
     paneel nog iets onder de vouw zit */
  function pijlenBij() {
    var v = el("d-volgende"), vak = huidigVak();
    if (!v) return;
    if (plat) {
      v.hidden = paneel >= panelen - 1 || videowacht();
      var vr = el("d-vorige");
      if (vr) vr.hidden = paneel === 0;
      return;
    }
    if (!vak) return;
    var rest = vak.classList.contains("scrollt") &&
      vak.scrollTop < vak.scrollHeight - vak.clientHeight - 4;
    v.hidden = (paneel >= panelen - 1 && !rest) || videowacht();
    var t = el("d-vorige");
    if (t) t.hidden = paneel === 0 && (!vak.classList.contains("scrollt") || vak.scrollTop <= 4);
  }

  function teken() {
    /* drie losse pagina's: niets schuift, niets ligt in lagen */
    if (plat) {
      var sp0 = el("d-spoor");
      if (sp0) sp0.style.transform = "";
      for (var j = 0; j < lagen.length; j++) {
        lagen[j].el.style.transform = "";
        lagen[j].el.style.opacity = "";
      }
      return;
    }
    var h = hoogte();
    var sp = el("d-spoor");
    if (sp) sp.style.transform = "translate3d(0," + (-nu * h) + "px,0)";
    if (rustig) return;
    for (var i = 0; i < lagen.length; i++) {
      var l = lagen[i];
      var afstand = l.paneel - nu;                /* 0 = midden in beeld */
      var abs = Math.abs(afstand);
      var dset = l.el.dataset || {};
      var sch = dset.schaal ? " scale(" + dset.schaal + ")" : "";
      var extra = dset.schuif ? Number(dset.schuif) : 0;
      l.el.style.transform =
        "translate3d(0," + (afstand * l.diepte * h + extra) + "px,0)" + sch;
      /* het beeld blijft staan, het tekstblok vervaagt als het paneel wegdraait */
      /* sneller weg dan het paneel zelf, zodat je bij het overschuiven niet
         de hele tekst van het vorige paneel mee ziet reizen */
      if (l.vervaagt) l.el.style.opacity = String(Math.max(0, 1 - abs * 1.3));
    }
  }

  function tweenNaarPaneel(n) {
    tweenVan = nu;
    tweenNaar = n;
    tweenStart = (window.performance || Date).now();
    /* twee panelen ver duurt iets langer dan een, maar nooit lang */
    tweenDuur = 380 + Math.min(1, Math.abs(n - nu)) * 180;
    tweent = true;
    doel = n;
    loopt();
  }

  function beweeg() {
    if (tweent) {
      var p = Math.min(1, ((window.performance || Date).now() - tweenStart) / tweenDuur);
      var e = 1 - Math.pow(1 - p, 3);          /* zacht uitlopend, met een einde */
      nu = tweenVan + (tweenNaar - tweenVan) * e;
      teken();
      if (p >= 1) { nu = tweenNaar; teken(); tweent = false; draait = false; return; }
      requestAnimationFrame(beweeg);
      return;
    }
    var verschil = doel - nu;
    /* de grens ligt in beeldpunten, niet in paneelbreuken: zo blijft er nooit
       een naad van een paar pixels tussen twee panelen staan */
    if (Math.abs(verschil) * hoogte() < 0.4) {
      nu = doel;
      teken();
      draait = false;
      return;
    }
    nu += verschil * 0.32;                     /* volgt de vinger tijdens het slepen */
    teken();
    requestAnimationFrame(beweeg);
  }

  function loopt() {
    if (draait) return;
    draait = true;
    requestAnimationFrame(beweeg);
  }

  /* de video kan nog niet ver genoeg geladen zijn om te kunnen springen;
     dan wachten we op het eerste moment dat het wel kan */
  function zetVideoTijd(sec) {
    var vid = el("d-video");
    if (!vid) return;
    function zet() {
      try { vid.currentTime = sec; } catch (e) {}
      vid.removeEventListener("loadedmetadata", zet);
    }
    if (vid.readyState >= 1) zet();
    else vid.addEventListener("loadedmetadata", zet);
  }

  function toonDrempel() {
    el("drempel").hidden = false;
    document.body.classList.add("drempelopen");
    /* net van taal gewisseld? kom dan terug op het paneel waar je stond,
       en zet de video terug op de seconde waar je was */
    var terug = parseInt(lees(SLEUTEL_PANEEL, ""), 10);
    var sec = parseFloat(lees(SLEUTEL_VIDEO, ""));
    schrijf(SLEUTEL_PANEEL, "");
    schrijf(SLEUTEL_VIDEO, "");
    if (sec > 0) zetVideoTijd(sec);
    var p = (terug >= 0 && terug <= 2) ? terug : 0;
    nu = doel = p;
    naarPaneel(p);
    teken();
    window.scrollTo({ top: 0 });
  }

  function naarPaneel(n) {
    if (typeof stilAlleMedia === "function") stilAlleMedia(null);
    n = Math.min(Math.max(n, 0), panelen - 1);
    paneel = n;
    if (plat || rustig) { doel = nu = n; tweent = false; teken(); }
    else tweenNaarPaneel(n);

    var t = el("d-teller");
    if (t) t.textContent = (n + 1) + " / " + panelen;
    el("d-vorige").hidden = n === 0;
    el("d-volgende").hidden = n >= panelen - 1 || videowacht();
    setTimeout(pijlenBij, 60);
    /* op het laatste paneel komt de startknop in de balk, zodat je de reis
       altijd kunt openen zonder eerst naar beneden te hoeven scrollen */
    var startbalk = el("d-startbalk");
    if (startbalk) startbalk.hidden = (data && data.blueprintKlaar === false) ||
      !(panelen > 1 && n === panelen - 1);
    document.querySelectorAll("#d-stippen button").forEach(function (b, i) {
      b.classList.toggle("aan", i === n);
      b.setAttribute("aria-current", i === n ? "true" : "false");
    });
    document.querySelectorAll(".dpaneel").forEach(function (v, i) {
      v.classList.toggle("aan", i === n);
      /* een nieuwe pagina begint bovenaan */
      if (i !== n || plat) v.scrollTop = 0;
      /* panelen buiten beeld uit de tabvolgorde halen */
      v.querySelectorAll("a, button, video, [tabindex]").forEach(function (k) {
        if (i === n) k.removeAttribute("tabindex"); else k.setAttribute("tabindex", "-1");
      });
    });
    var vid = el("d-video");
    if (vid && n !== 0 && !vid.paused) vid.pause();
    /* paneel 1 is donker, de andere zijn licht: teller, pijlen en stippen mee laten kleuren */
    el("drempel").classList.toggle("licht", n > 0);
    voetwaas();
  }

  function sluitDrempel() {
    /* de reis gaat pas open als de blueprint er is */
    if (data && data.blueprintKlaar === false) return;
    document.body.classList.remove("drempelopen");
    schrijf(SLEUTEL_START, "ja");
    var vid = el("d-video");
    if (vid && !vid.paused) vid.pause();
    el("drempel").hidden = true;
    /* na het overzicht begint de reis altijd bij fase 1, Herkenning */
    ga(1, false);
    window.scrollTo({ top: 0 });
  }

  /* paneel 2: de ene vraag */
  function paneelVraag(v) {
    return '<div class="dbinnen dlicht">' +
      '<div class="dmerk licht"><img src="assets/logo_goud.png" alt=""><b>SZINN</b></div>' +
      (v.label ? '<span class="dlabel">' + veilig(v.label) + '</span>' : "") +
      '<div class="dstreep"></div>' +
      '<h1>' + veilig(v.kop || "") + '</h1>' +
      mediaHTML(v.audio) +
      '<div class="dtekst">' + (v.tekst || "") + '</div>' +
      (v.spiegel === false ? "" : spiegelHTML()) +
      '<button class="knop dknop" data-schuif="volgende">' +
        veilig(T("volgende", v.knop)) + ' <i>&#8594;</i></button>' +
      (v.onder ? '<small class="donder">' + veilig(v.onder) + '</small>' : "") +
      '</div>';
  }

  /* paneel 3: het overzicht van de hele reis */
  function paneelReis(r) {
    var fases = (r.fases || []).map(function (f, i) {
      var nr = i + 1;
      return '<div class="dfase df' + nr + '">' +
        '<span class="dfasenr">' + nr + '</span>' +
        '<span class="dfaselbl">' + veilig(f.label || "") + '</span>' +
        '<h2>' + veilig(f.titel || "") + '</h2>' +
        '<em class="dfasezin">' + veilig(f.zin || "") + '</em>' +
        '<p class="dfaseuit">' + veilig(f.tekst || "") + '</p>' +
        (f.raster ? '<div class="dkaartjes">' + f.raster.map(function (k) {
            return '<div class="dkaartje">' +
              (k.beeld ? '<img src="' + veilig(k.beeld) + '" alt="">' :
                         '<span class="dkgetal">' + veilig(k.getal || "") + '</span>') +
              '<b>' + veilig(k.titel) + '</b>' +
              '<small>' + veilig(k.sub || "") + '</small></div>';
          }).join("") + '</div>' : "") +
        (f.rijen ? '<div class="drijen">' + f.rijen.map(function (x, n) {
            return '<div class="drij">' +
              '<span class="drijnr">' + ("0" + (n + 1)).slice(-2) + '</span>' +
              (x.beeld ? '<img src="' + veilig(x.beeld) + '" alt="">' : "") +
              '<span class="drijtekst"><b>' + veilig(x.titel) + '</b>' +
              (x.sub ? '<em>' + veilig(x.sub) + '</em>' : "") + '</span></div>';
          }).join("") + '</div>' : "") +
        (f.uitgelicht ? '<div class="duitgelicht">' +
            (f.uitgelicht.beeld ? '<img src="' + veilig(f.uitgelicht.beeld) + '" alt="">' : "") +
            '<span><b>' + veilig(f.uitgelicht.titel) + '</b>' +
            '<small>' + veilig(f.uitgelicht.sub || "") + '</small></span></div>' : "") +
        (f.slot ? '<em class="dfaseslot">' + veilig(f.slot) + '</em>' : "") +
        (f.resultaat ? '<span class="dfaseres">' + veilig(f.resultaat) + '</span>' : "") +
        (f.band ? '<div class="dband"><img src="' + veilig(f.band.beeld) + '" alt="">' +
            '<span>' + veilig(f.band.tekst || "").replace(/\n/g, "<br>") + '</span></div>' : "") +
        '</div>';
    }).join('<span class="dpijltje">&rarr;</span>');

    return '<div class="dbinnen dlicht dreis">' +
      '<div class="dmerk licht"><img src="assets/logo_goud.png" alt=""><b>SZINN</b></div>' +
      (r.rechts ? '<em class="dreisrechts">' + veilig(r.rechts) + '</em>' : "") +
      '<h1>' + veilig(r.kop || "") + '</h1>' +
      (r.sub ? '<div class="dreissub">' + veilig(r.sub) + '</div>' : "") +
      (r.uitleg ? '<p class="dreisuitleg">' + veilig(r.uitleg).replace(/\n/g, "<br>") + '</p>' : "") +
      mediaHTML(r.audio) +
      '<div class="dfasen">' + fases + '</div>' +
      /* zonder voltooide blueprint is er nog niets om te openen: in plaats
         van de startknop staat er wat er gebeurt en dat er een mail komt */
      (data && data.blueprintKlaar === false
        ? '<div class="dslotwacht"><i>&#10022;</i><span>' +
            veilig(data.slotKlaar || "").replace(/\n/g, "<br>") + '</span></div>'
        : '<button class="knop dknop groot" data-start>' +
            veilig(r.knop || T("welkomKnop")) + ' <i>&#8594;</i></button>') +
      (r.voet ? '<div class="dreisvoet">' + r.voet.map(function (t) {
          return '<span>' + veilig(t).replace(/\n/g, "<br>") + '</span>';
        }).join("") + '</div>' : "") +
      (T("disclaimer") ? '<p class="disclaimer dreisklein">' +
        veilig(T("disclaimer")).replace(/\n/g, "<br>") + '</p>' : "") +
      '</div>';
  }

  function drempel(d) {
    var w = d.welkom || {};
    if (w.uit) return;
    rustig = !!(window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    el("d-titel").innerHTML = w.titel || (T("welkom") + ", " + veilig(d.voornaam || ""));
    el("d-tekst").innerHTML = w.tekst || T("welkomTekst");
    if (w.audio) el("d-tekst").insertAdjacentHTML("afterend", mediaHTML(w.audio));

    /* paneel 2 en 3 alleen als de klantdata ze meelevert */
    var sb = el("d-startbalk");
    if (sb) sb.setAttribute("aria-label", (w.reis && w.reis.knop) || T("welkomKnop"));
    if (w.vraag) el("dp-2").innerHTML = paneelVraag(w.vraag);
    if (w.reis) el("dp-3").innerHTML = paneelReis(w.reis);
    if (!w.vraag) el("dp-2").remove();
    if (!w.reis) el("dp-3").remove();
    panelen = document.querySelectorAll(".dpaneel").length;

    /* zonder extra panelen blijft het oude welkomstscherm met zijn knop staan */
    var startknop = el("d-start");
    if (panelen === 1) {
      startknop.hidden = false;
      startknop.textContent = w.knop || T("welkomKnop");
    }
    /* zijn er wel meer panelen, dan hoort er op het eerste paneel een
       duidelijke knop vooruit te staan. De ronde pijl onderin blijft, maar die
       ziet niet iedereen. */
    var verder = el("d-verder");
    if (verder && panelen > 1) {
      verder.innerHTML = veilig(w.verder || T("volgende")) + ' <i>&#8594;</i>';
      verder.hidden = false;
    }

    if (w.video !== false) {
      var v = el("d-video");
      if (w.video && typeof w.video === "string") v.querySelector("source").src = w.video;
      /* Pagina 1 in drie stappen: eerst het gewone welkomstscherm met de
         knop 'start nu'; de video blijft verborgen tot die klik en vult dan
         schermvullend het beeld (eigen bedieningsknoppen uit). Na afloop
         schuift het vanzelf door naar het reis-paneel. */
      if (panelen > 1) {
        el("drempel").classList.add("videovol");
        v.controls = false;
        v.load();
        if (!el("drempel").classList.contains("speelt"))
          verder.innerHTML = veilig(w.startnu || "Start nu") + ' <i>&#8594;</i>';
      } else {
        v.hidden = false;
        v.load();
      }
      /* zonder eigen bedieningsknoppen is een tik op het beeld pauze/verder */
      v.addEventListener("click", function () {
        if (v.controls) return;
        if (v.paused) { var sp = v.play(); if (sp && sp.catch) sp.catch(function () {}); }
        else v.pause();
      });
      v.addEventListener("ended", function () {
        var dr = el("drempel");
        dr.classList.add("videoklaar");
        dr.classList.remove("speelt");
        /* terug naar het gewone welkomstscherm voor wie later terugbladert */
        v.hidden = true;
        verder.hidden = false;
        verder.innerHTML = veilig(w.verder || T("welkomKnop")) + ' <i>&#8594;</i>';
        if (paneel === 0 && panelen > 1) naarPaneel(paneel + 1);
        pijlenBij();
      });
    }

    /* de rij fasenamen stond rechtsboven op het welkomstscherm en is daar
       weggehaald; het element hoeft er dus niet meer te zijn */
    var lf = (d.labels || {}).fases;
    var fasenrij = el("d-fases");
    if (lf && fasenrij) fasenrij.textContent = lf.map(function (f) { return f[0]; }).join(" · ");

    /* stippen */
    /* de stippen zijn maanstanden: wassend, vol, afnemend */
    var manen = ["\u263d", "\u25cf", "\u263e"];
    var stippen = "";
    for (var i = 0; i < panelen; i++) {
      stippen += '<button data-paneel="' + i + '" aria-label="' + (i + 1) + '">' +
        '<span>' + (manen[i] || "\u25cf") + '</span></button>';
    }
    el("d-stippen").innerHTML = panelen > 1 ? stippen : "";

    el("drempel").addEventListener("click", function (e) {
      if (e.target.closest("[data-start]") || e.target.closest("#d-start")) { sluitDrempel(); return; }
      /* stap 2 van pagina 1: 'start nu' verbergt het welkomstscherm en laat
         de video schermvullend afspelen op zacht volume; na afloop schuift
         het vanzelf door naar het reis-paneel */
      if (e.target.closest("#d-verder") && videowacht() &&
          !el("drempel").classList.contains("speelt")) {
        var vd = el("d-video");
        vd.hidden = false;
        vd.volume = 0.35;
        var sp = vd.play();
        if (sp && sp.catch) sp.catch(function () {});
        el("drempel").classList.add("speelt");
        /* de knop blijft onderin over de video hangen om door te kunnen */
        el("d-verder").innerHTML = veilig(w.verder || "Verder") + ' <i>&#8594;</i>';
        return;
      }
      var sch = e.target.closest("[data-schuif]");
      if (sch) { naarPaneel(paneel + (sch.getAttribute("data-schuif") === "vorige" ? -1 : 1)); return; }
      var st = e.target.closest("[data-paneel]");
      if (st) naarPaneel(Number(st.getAttribute("data-paneel")));
    });
    /* Past een paneel niet in beeld, dan brengt de pijl je eerst een scherm
       verder binnen dat paneel. Pas onderaan schuift hij door naar het
       volgende. Zo kom je er altijd doorheen, ook als vegen niet meewerkt. */
    function pijl(richting) {
      var vak = huidigVak();
      /* Op een telefoon scrollt de bezoeker met zijn duim. De pijl deed er
         eerst nog een schermhoogte bij voordat hij doorging naar het volgende
         paneel, en dan lijkt het alsof er niets gebeurt. Op een klein scherm
         gaat de pijl daarom meteen door. */
      if (vak && vak.classList.contains("scrollt") && !smal()) {
        var max = vak.scrollHeight - vak.clientHeight;
        var stap = Math.round(vak.clientHeight * 0.82);
        var top = vak.scrollTop;
        if (richting > 0 && top < max - 4) {
          stopUitloop();
          vak.scrollTo({ top: Math.min(max, top + stap), behavior: "smooth" });
          return;
        }
        if (richting < 0 && top > 4) {
          stopUitloop();
          vak.scrollTo({ top: Math.max(0, top - stap), behavior: "smooth" });
          return;
        }
      }
      naarPaneel(paneel + richting);
    }
    el("d-volgende").addEventListener("click", function () { pijl(1); });
    el("d-vorige").addEventListener("click", function () { pijl(-1); });

    document.addEventListener("keydown", function (e) {
      if (el("drempel").hidden) return;
      if (e.key === "ArrowRight") naarPaneel(paneel + 1);
      if (e.key === "ArrowLeft") naarPaneel(paneel - 1);
      if (e.key === "Escape" && paneel === panelen - 1) sluitDrempel();
    });

    /* slepen: het spoor volgt de muis of de vinger en klikt vast bij loslaten.
       Pas na tien pixels wordt bepaald of de beweging verticaal of horizontaal is.
       Past een paneel niet in beeld, dan scrollt dat paneel eerst zelf en pakt het
       spoor de beweging pas op zodra je aan de boven- of onderrand bent. */
    var xStart = 0, yStart = 0, richting = "", vanaf = 0, tijdStart = 0, laatsteDy = 0;
    var spoor = el("d-spoor");

    /* mag het wiel naar het volgende paneel, of moet het paneel eerst scrollen? */
    function magSchuiven(dy) {
      var vak = huidigVak();
      if (!vak || !vak.classList.contains("scrollt")) return true;
      var boven = vak.scrollTop <= 1;
      var onder = vak.scrollTop >= vak.scrollHeight - vak.clientHeight - 1;
      return dy < 0 ? onder : boven;   /* omhoog vegen gaat vooruit */
    }

    var scrollVanaf = 0, vorigeScroll = 0, vaart = 0, vaartTijd = 0, uitloop = null;
  var paneelGescrold = false;   /* dit gebaar heeft het paneel zelf gescrold */

    /* het paneel rolt na het loslaten nog even door, zoals een gewone pagina */
    function stopUitloop() {
      if (uitloop) { cancelAnimationFrame(uitloop); uitloop = null; }
      vaart = 0;
    }
    function rolUit(vak, v) {
      stopUitloop();
      var laatste = (window.performance || Date).now();
      var max = vak.scrollHeight - vak.clientHeight;
      (function stap(t) {
        var dt = Math.min(34, t - laatste);
        laatste = t;
        v *= Math.pow(0.94, dt / 16);
        var nieuwTop = vak.scrollTop + v * dt;
        vak.scrollTop = Math.min(Math.max(nieuwTop, 0), max);
        if (Math.abs(v) > 0.02 && vak.scrollTop > 0 && vak.scrollTop < max) {
          uitloop = requestAnimationFrame(stap);
        } else {
          uitloop = null;
        }
      })(laatste);
    }

    /* Een paneel dat langer is dan het scherm liet de browser eerst niet zelf
       scrollen: alles liep via onze eigen vingerafhandeling. Op een telefoon
       is dat kwetsbaar, en dan lijkt het scherm te blijven hangen. Op een
       aanraakscherm scrollt de browser zo'n paneel nu zelf, en gaan de pijlen
       en de stippen over het wisselen van paneel. */
    function browserScrollt(e) {
      if (plat) return true;          /* drie losse pagina's: browser doet alles */
      if (e.pointerType === "mouse") return false;
      var vak = huidigVak();
      return !!(vak && vak.classList.contains("scrollt"));
    }

    spoor.addEventListener("pointerdown", function (e) {
      if (e.target.closest("video") || e.target.closest("button") || e.target.closest("a")) return;
      if (browserScrollt(e)) { yStart = 0; return; }
      var vak = huidigVak();
      stopUitloop();
      xStart = e.clientX; yStart = e.clientY;
      richting = ""; sleept = false; laatsteDy = 0;
      paneelGescrold = false;
      vanaf = nu;
      scrollVanaf = vak ? vak.scrollTop : 0;
      vorigeScroll = scrollVanaf; vaart = 0; vaartTijd = 0;
      tijdStart = Date.now();
    });

    spoor.addEventListener("pointermove", function (e) {
      if (!yStart) return;
      if (browserScrollt(e)) { yStart = 0; return; }
      var dx = e.clientX - xStart, dy = e.clientY - yStart;
      if (!richting) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        richting = Math.abs(dy) > Math.abs(dx) ? "y" : "x";
        if (richting === "y") {
          spoor.classList.add("sleept");
          try { spoor.setPointerCapture(e.pointerId); } catch (er) {}
        }
      }
      if (richting !== "y") return;
      e.preventDefault();

      /* eerst het paneel zelf, en wat er overschiet gaat naar het spoor */
      var vak = huidigVak();
      var kan = vak && vak.classList.contains("scrollt");
      var effDy = dy;
      if (kan) {
        var max = vak.scrollHeight - vak.clientHeight;
        var gewenst = scrollVanaf - dy;
        var geklemd = Math.min(Math.max(gewenst, 0), max);
        vak.scrollTop = geklemd;
        effDy = -(gewenst - geklemd);
        /* snelheid onthouden, zodat het paneel na het loslaten nog uitrolt */
        var tNu = Date.now();
        if (vaartTijd) {
          var dt = Math.max(1, tNu - vaartTijd);
          vaart = 0.7 * ((geklemd - vorigeScroll) / dt) + 0.3 * vaart;
        }
        vaartTijd = tNu;
        if (geklemd !== vorigeScroll) paneelGescrold = true;
        vorigeScroll = geklemd;
        /* heeft dit gebaar het paneel laten scrollen, dan blijft het bij dit
           paneel. Doorschuiven naar het volgende vraagt een nieuwe veeg, zodat
           je niet per ongeluk over de laatste regels heen klapt */
        if (paneelGescrold) effDy = 0;
      }
      laatsteDy = effDy;
      sleept = Math.abs(effDy) > 0;
      tweent = false;

      var v = vanaf - effDy / hoogte();
      /* buiten het eerste en laatste paneel loopt het zwaar, zodat je de rand voelt */
      if (v < 0) v *= 0.32;
      if (v > panelen - 1) v = (panelen - 1) + (v - (panelen - 1)) * 0.32;
      doel = v;
      loopt();
    });

    function laatLos(e) {
      if (!yStart) return;
      var dy = laatsteDy;
      var snel = Math.abs(dy) / Math.max(1, Date.now() - tijdStart);
      spoor.classList.remove("sleept");
      try { spoor.releasePointerCapture(e.pointerId); } catch (er) {}
      xStart = 0; yStart = 0; richting = "";
      var vak2 = huidigVak();
      if (vak2 && vak2.classList.contains("scrollt") && Math.abs(vaart) > 0.05) {
        rolUit(vak2, vaart);
      }
      if (!sleept) return;
      sleept = false;
      /* een vijfde van de hoogte, of een duidelijke snelle veeg, schuift door */
      var h = hoogte();
      if (Math.abs(dy) > h * 0.2 || (snel > 0.6 && Math.abs(dy) > 60)) {
        naarPaneel(paneel + (dy < 0 ? 1 : -1));
      } else {
        naarPaneel(paneel);   /* te kort: veert terug */
      }
    }
    spoor.addEventListener("pointerup", laatLos);
    spoor.addEventListener("pointercancel", laatLos);
    spoor.addEventListener("dragstart", function (e) { e.preventDefault(); });

    /* scrollen met een muiswiel of trackpad.
       Past het paneel niet in beeld, dan scrollt het eerst zichzelf. */
    var wielKlaar = null;
    el("drempel").addEventListener("wheel", function (e) {
      if (plat) return;                      /* de pagina scrollt zelf */
      var d = e.deltaY || e.deltaX;
      if (!d) return;
      if (!magSchuiven(-d)) return;          /* laat het paneel zelf scrollen */
      e.preventDefault();
      tweent = false;
      var v = nu + d / (hoogte() * 0.75);
      if (v < 0) v *= 0.32;
      if (v > panelen - 1) v = (panelen - 1) + (v - (panelen - 1)) * 0.32;
      doel = v;
      loopt();
      clearTimeout(wielKlaar);
      wielKlaar = setTimeout(function () { naarPaneel(Math.round(doel)); }, 100);
    }, { passive: false });

    /* bij het draaien van een telefoon of het slepen van een venster opnieuw uitmeten */
    window.addEventListener("resize", function () {
      if (el("drempel").hidden) return;
      zetPlat();
      merkScroll();
      nu = doel = paneel;
      teken();
    });

    zetPlat();
    verzamelLagen();
    merkScroll();
    teken();
    /* lettertypes en beelden komen later binnen, dus nog een keer nameten */
    setTimeout(merkScroll, 400);
    window.addEventListener("load", merkScroll);

    /* Het welkomstscherm komt terug als je het nog niet gezien hebt, en ook
       als je er net van taal wisselde: dan hoor je te blijven waar je stond.
       Staat welkom.altijd op true, dan begint elk bezoek bij het begin; de
       voortgang blijft wel bewaard, dus de fases die open waren blijven open
       en je bent er met één tik weer. */
    var altijdWelkom = !!(data.welkom && data.welkom.altijd);
    if (altijdWelkom || lees(SLEUTEL_START, "") !== "ja" ||
        lees(SLEUTEL_PANEEL, "") !== "") toonDrempel();
    else naarPaneel(0);
  }

  /* ?opnieuw achter het adres wist de voortgang en start weer bij het welkomstscherm.
     De andere parameters, zoals ?data= en ?klant=, blijven staan. */
  /* haalt één parameter uit de adresbalk zonder de pagina te herladen */
  function schrapParam(naam) {
    if (!history.replaceState) return;
    var q = new URLSearchParams(location.search);
    q.delete(naam);
    var rest = q.toString();
    history.replaceState(null, "", location.pathname + (rest ? "?" + rest : "") + location.hash);
  }

  function reset() {
    if (!/[?&]opnieuw/.test(location.search)) return;
    [SLEUTEL_FASE, SLEUTEL_OPEN, SLEUTEL_START].forEach(function (k) {
      try { localStorage.removeItem(k); } catch (e) {}
    });
    var q = new URLSearchParams(location.search);
    q.delete("opnieuw");
    var rest = q.toString();
    if (history.replaceState) {
      history.replaceState(null, "", location.pathname + (rest ? "?" + rest : ""));
    }
  }

  function laad() {
    reset();

    /* klant-id uit het adres: gebruikt in het voortgangsbericht naar het dashboard
       en, als er geen ?data= is meegegeven, om klanten/<id>.json op te halen */
    var q = new URLSearchParams(location.search);
    klantId = (q.get("klant") || "").replace(/[^A-Za-z0-9_-]/g, "");

    if (window.SZINN_DATA) { bouw(window.SZINN_DATA); return; }

    /* een eerder gekozen taal wint van het standaardbestand, maar niet van een
       ?data= in het adres: die is expliciet meegegeven en gaat altijd voor */
    var gekozen = null;
    try { gekozen = JSON.parse(lees(SLEUTEL_TAAL, "") || "null"); } catch (e) { gekozen = null; }
    /* een bewaarde taal geldt alleen voor de klant waarbij hij gekozen is */
    var taalbron = "";
    if (gekozen && gekozen.data && (gekozen.klant || "") === klantId) {
      taalbron = String(gekozen.data).replace(/\{klant\}/g, klantId);
    }
    var bron = q.get("data") || taalbron ||
      (klantId ? "klanten/" + klantId + ".json" : "client.json?v=" + Date.now());
    fetch(bron, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(bouw)
      .catch(function (e) {
        console.error("SZINN journey: klantdata niet geladen", e);
        el("herkenning").innerHTML =
          '<h1>' + veilig(T("foutKop")) + '</h1><p class="sub">' + veilig(T("foutTekst")) + '</p>';
        el("herkenning").classList.add("aan");
      });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", laad);
  else laad();
})();

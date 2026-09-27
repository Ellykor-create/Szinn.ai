# SZINN ALIGNMENT BLUEPRINT · MASTERPROMPT v4.0

**Versie:** 4.0 · 25 september 2026 · geldt voor alle talen (NL / EN / overige)  
**Voor:** Danillo Frederik (pipeline) en iedereen die een Blueprint genereert  
**Vervangt:** STANDARD v3.0, addendum 02 (data en taal) en de losse besluiten van september 2026. Bij tegenstrijdigheid met oudere documenten geldt dit document.  
**Referentie-oplevering:** Marc Ference Pieplenbosch (map `voorbeeld_marc/`), gebouwd en geaudit met de scripts in deze kit.

---

## DE FORMULE: WAT EEN BLUEPRINT IS

Dit is de finale opbouw van de SZINN Alignment Blueprint. Elke Blueprint bestaat uit precies drie bronnen, samengebracht in één document:

| Bron | Wat | Waar het vandaan komt | Per klant |
|---|---|---|---|
| **1. De basistekst** | De vaste teksten van de 13 secties (visie en missie, uitleg per sectie, Sin · Sinn · Zin, spiegeltekst, maanfasen, bronnen) | `szinn_vast.py` (Basisdocument DEF), verbatim | **Altijd gelijk.** Nooit aanpassen, samenvatten of herschrijven |
| **2. De berekening** | Geboortekaart, huizen, aspecten, knopen, mandala, kalender en alle getallen | Geboortedatum, exacte geboortetijd, geboorteplaats en de **volledige geboortenaam** (zoals op de geboorteakte), via `chart.py`, `transits.py` en `szinn_numerologie.py` | **Altijd nieuw berekend** |
| **3. De intake** | De antwoorden van de klant op de intakevragen: citaten, namen, situatie, verlangens | Het intakeformulier, letterlijk | **Altijd van deze klant** |

**Basistekst + berekening + intake = de Blueprint.**

Wat dit betekent:

- **Alleen de basistekst is gedeeld.** Al het andere (elke persoonlijke alinea, elke duiding, elk kaartje, elke reflectievraag, elke praktijk, elke AI-prompt, elke kalendermaand, de quotepagina's en het "Tot slot") wordt voor elke klant opnieuw geschreven vanuit zijn eigen berekening en zijn eigen intake.
- **Niets overnemen uit een andere Blueprint.** Ook niet uit de referentie van Marc. Marc laat zien hoe de opbouw, de opmaak en de controle eruitzien; zijn persoonlijke teksten zijn van hem en komen nergens anders terug.
- **Niets verzinnen.** Wat niet uit de berekening of de intake komt, staat er niet in.
- **Alles controleren.** Elke Blueprint wordt drie keer volledig gecontroleerd (sectie 9) voordat hij wordt opgeleverd: klopt elke berekening, is er niets overgenomen, is er niets verzonnen.
- **Eerdere Blueprints bijwerken.** Blueprints die vóór deze finale versie zijn gemaakt en nog gedrukt of verstuurd worden, worden opnieuw opgebouwd volgens deze formule: de basistekst wordt vervangen door de huidige versie, de berekening wordt opnieuw gedraaid, en de persoonlijke tekst wordt gecontroleerd en waar nodig herschreven. Daarna volgt de volledige drievoudige controle.

---

## 0. WAT NIEUW IS IN v4.0

1. **Eén rekenregel voor het Persoonlijk Jaar**: geboortedag + geboortemaand + het huidige jaar, elk eerst apart gereduceerd, dan opgeteld (sectie 3). Voorbeeld Marc, 24 juli, in 2026: 6 + 7 + 1 = 14 → 5. De oude formule "Levenspad + Universeel Jaar" is geschrapt.
2. **Returning numbers volgens de gangbare methode**: het samengestelde getal vlak vóór de laatste reductie van elk kerngetal (sectie 3.4). Tussensommen van losse naamdelen tellen niet mee.
3. **Groeigetallen in gewone taal**: kop "Jouw groeigetallen · wat je meedraagt", met per soort een eigen uitlegblok en per returning number wat het thema is.
4. **Mandala**: tekens als echte dierenriemsymbolen (vectorpaden, geen emoji), niet als Nederlandse afkortingen. Het wiel volgt de standaard van astro.com: Ascendant links, tekens tegen de klok in.
5. **Nieuwe cover (main visual)**: de highres piramidefoto vol in beeld, zonder donkere laag; onderaan een donkere band met de naam.
6. **Drukversie voor Print&Bind**: gelijmd A4-boek met een apart binnenwerk en een omslag als spread (sectie 8).
7. **Drievoudige controle** (sectie 9): drie rondes (berekeningen, niets overgenomen, niets verzonnen), elke ronde drie keer doorlopen. `audit.py` draait ronde 1 t/m 3 automatisch; faalt er iets, dan wordt er niet opgeleverd.

---

## ⚠️ DE GOUDEN REGEL: ELKE KEER OPNIEUW CONTROLEREN

**Elke Blueprint, elke keer, volledig opnieuw.** Een eerdere "OK" geldt nooit voor een nieuwe versie.

- **Na elke wijziging opnieuw**, hoe klein ook: een woord in de tekst, een andere coverfoto, een rugbreedte, een correctie van Elly. Het document is dan een nieuwe versie en de hele drievoudige controle (sectie 9) begint weer bij het begin.
- **Drie keer per versie.** Het controlescript houdt per versie een logboek bij (`*_controlelog.txt`, met datum en een vingerafdruk van het bestand). Opleveren mag pas als die exacte versie drie keer "OK" heeft.
- **Nooit vertrouwen op eerder werk.** Ook niet als het vorige document van dezelfde klant klopte, als de kaart op een eerdere lijkt, of als er haast is. Haast is geen reden om een ronde over te slaan.
- **Elke opgeleverde Blueprint gaat in de vergelijkingsmap**, zodat de volgende klant ertegen gecontroleerd wordt.
- **Wijzigt een regel in deze masterprompt**, dan worden eerder opgeleverde Blueprints die nog gedrukt of verstuurd moeten worden opnieuw gecontroleerd volgens de nieuwe regel.
- **Twijfel = niet opleveren.** Vraag het na bij Elly.

---

## 1. ROL EN UITGANGSPUNT

Je genereert een **SZINN Alignment Blueprint**: een persoonlijk navigatiedocument dat astrologie (tropisch, Placidus, Swiss Ephemeris), numerologie (Pythagoras) en Kabbalah/Tikkun samenbrengt tot één spiegel voor zelfherkenning en richting.

- De Blueprint is een **startpunt en een spiegel**, geen waarheid, voorspelling of oordeel.
- **Tweede persoon enkelvoud**: jij/jouw (NL), you/your (EN). Nooit u/uw.
- **Herkenning vóór techniek**: de lezer ontmoet eerst zichzelf (wie ben je, in balans en uit balans), daarna waar dat vandaan komt, daarna hoe je het leeft.
- **Niets verzinnen.** Alles is óf berekend en narekenbaar, óf een symbolische duiding die als zodanig herkenbaar is, óf een letterlijk citaat uit de intake. Feiten over het leven van de klant die niet uit de intake komen, horen er niet in.
- **Niets overnemen.** Persoonlijke tekst uit een andere Blueprint wordt nooit hergebruikt. Elke klant krijgt eigen zinnen, geschreven vanuit zijn eigen datalaag.
- **Alles drie keer controleren** (sectie 9) voordat er iets wordt opgeleverd.
- **Vaste teksten** komen verbatim uit `szinn_vast.py` (Basisdocument DEF). Nooit samenvatten of parafraseren.
- **Rolverhouding:** Elly is de facilitator. De berekeningen en de synthese worden toegeschreven aan het SZINN-systeem.

---

## 2. DE VIER LAGEN

1. **Datalaag.** `chart.py` berekent de geboortekaart en schrijft een bevroren `klant_chart.json`. `szinn_numerologie.py` berekent alle getallen. `transits.py` berekent de kalender.
2. **Schrijflaag.** Het bouwscript per klant (model: `build_voorbeeld_marc.py`). **De schrijflaag berekent niets.** Elke graad, elk teken, elk huis en elke orb in de tekst komt letterlijk uit de datalaag.
3. **Opmaaklaag.** `szinn_common.py` (CSS, cover, helpers), `szinn_vast.py` (vaste teksten), `mandala.py` (SVG), `book.py` (drukversie).
4. **Controlelaag.** `audit.py` leest het document terug en vergelijkt elke bewering met de datalaag.

---

## 3. REKENREGELS (bindend)

### 3.1 Astrologie

- **Dierenriem:** tropisch. **Huizen:** Placidus. **Knoop:** altijd de ware knoop (True Node). Zuidknoop = Noordknoop + 180°.
- **Geboorteplaats:** altijd de werkelijke stad met coördinaten. Nooit een landnaam of een landmidden: dat verschuift de Ascendant.
- **Tijdzone:** de UTC-offset die op de geboortedatum gold, inclusief zomertijd zoals die toen gold. Nederland vóór 1977: geen zomertijd, dus altijd UTC+1.
- **Precisie:** intern volle precisie; in het document graden en boogminuten, **afgekapt, niet afgerond**.
- **Huisplaatsing:** per planeet de cusp-range waarin de graad valt, met wrap-around bij 0°. `chart.py` markeert planeten binnen 1° van een cusp met "⚠ grens".
- **Geboortetijd-gevoeligheid:** `chart.py` geeft de marge in minuten tot de Ascendant van teken wisselt. Staat een planeet binnen ongeveer een kwart graad van een cusp, of de Ascendant binnen twee graden van een tekengrens, dan komt er een korte geboortetijdnoot in sectie 04 die beide lezingen benoemt.
- **Elementen en modaliteiten:** geteld over **tien planeten** (Zon t/m Pluto). Ascendant, MC, Chiron en knopen tellen niet mee.
- **Aspecten:** conjunctie, sextiel, vierkant, driehoek, oppositie; orb ≤ 6°, kortste hoek. In de tabel tot 5°, de nauwste eerst. Aspecten over een tekengrens heen mogen, met die vermelding.
- **Retrograde:** alleen planeten (en Chiron) krijgen "Rx". De knopen zijn vrijwel altijd retrograde en worden nooit als bijzonderheid genoemd.
- **Transits (kalender):** Jupiter t/m Pluto en Chiron op alle natale planeten, Asc en MC. "Exact" alleen bij een orb onder 0,5°. Plus nieuwe en volle maan met graad, natale huis en eventuele conjunctie (< 3°) met een natale planeet. Data in lokale tijd.

### 3.2 Numerologie (Pythagoras, methode Decoz)

- Letterwaarden A=1 … I=9, J=1 … R=9, S=1 … Z=8. **Meestergetallen 11, 22 en 33 worden op geen enkele stap gereduceerd.**
- **Levenspad:** dag, maand en jaar elk apart reduceren, optellen, reduceren. Levert de vlakke som van alle cijfers een verborgen meestergetal op, dan wordt dat één keer in goudtekst als ondertoon benoemd ("Onder je 2 klinkt een 11").
- **Geboortedag:** de dag, gereduceerd.
- **Persoonlijk Jaar:** geboortedag + geboortemaand + het huidige jaar. Elk deel eerst apart reduceren (24 → 6, juli → 7, 2026 → 10 → 1), dan optellen en reduceren (6 + 7 + 1 = 14 → 5). Het Levenspad en het geboortejaar spelen hier geen rol. Altijd het lopende én het volgende jaar tonen, met de berekening. Een meesterjaar wordt benoemd.
- **Persoonlijke Maand:** Persoonlijk Jaar + kalendermaandnummer (1 t/m 12), reduceren. Vanaf januari rekenen met het nieuwe Persoonlijk Jaar.
- **Naamgetallen:** op de volledige naam zoals op de geboorteakte, nooit de roepnaam of getrouwde naam. Uitdrukking = alle letters, Zielenurge = klinkers, Persoonlijkheid = medeklinkers. Per naamdeel reduceren en optellen. Y is klinker tenzij hij aan een klinker grenst; tussenvoegsels horen bij de achternaam; diakrieten naar de basisletter.
- **Geen bevestigde geboortenaam:** de naamgetallen, keynote en untrained muscles worden weggelaten, met een neutrale zin dat ze worden toegevoegd zodra de naam bekend is.
- In het document wordt elke berekening als stappenreeks getoond.

### 3.3 Groeigetallen (vast onderdeel van sectie 06, na de naamgetallen)

- **Kop:** "Jouw groeigetallen · wat je meedraagt". De vaste uitleg (`GROEI_INTRO` in `szinn_vast.py`) legt in gewone taal uit wat karmagetallen zijn: geen straf, maar huiswerk dat je meeneemt.
- **Drie blokken:** returning numbers (wat steeds terugkomt), keynote (je grondtoon), untrained muscles (wat je nog mag oefenen).
- **Daarna "Wat dit voor jou betekent":** drie kaartjes met de persoonlijke uitkomst en een alinea in gewone woorden die de groeigetallen aan de kaart en aan het lopende jaar koppelt.
- **Terminologie:** returning numbers, keynote, untrained muscles. In de lopende tekst mag uitgelegd worden dat ze vroeger karmagetallen heetten.

### 3.4 Returning numbers: de regel
Bij elk kerngetal wordt gekeken naar het **samengestelde getal vlak vóór de laatste reductie**:

- geboortedag: de dag zelf (13, 14, 16 of 19);
- Levenspad: de som van de drie gereduceerde delen;
- Uitdrukking, Zielenurge, Persoonlijkheid: de som van de gereduceerde naamdelen.

Is dat 13, 14, 16 of 19, dan is het een returning number bij dat kerngetal. Tussensommen van één los naamdeel tellen **niet** mee. De functie `groeigetallen()` in `szinn_numerologie.py` doet dit.

| Getal | Thema, in gewone taal |
|---|---|
| 13 | de les van doorzetten: afmaken, ook als het zwaar of saai wordt |
| 14 | de les van maat houden: vrijheid zonder jezelf te verliezen in te veel of te snel |
| 16 | de les van het ego loslaten: plannen die omvallen, zodat iets echters kan ontstaan |
| 19 | de les van zelfstandigheid in balans: zelf kunnen, en toch hulp leren vragen |

**Keynote:** de letterwaarde die het vaakst voorkomt in de volledige naam, met de letters genoemd. **Untrained muscles:** de cijfers 1 t/m 9 die in de naam ontbreken; "Geen" als alle negen voorkomen.

### 3.5 Mandala (sectie 08)

- Standaardwiel zoals astro.com: **Ascendant links, tekens tegen de klok in**. Hoek φ = 180° + (λ − Asc), x = cx + r·cos φ, y = cy − r·sin φ. (De oude formule x = r·sin, y = −r·cos gaf een gespiegeld wiel en wordt niet gebruikt.)
- Tekens als dierenriemsymbolen, getekend als vectorpaden uit DejaVu Sans (`zodiac_paths.json`), in goud. Nooit als tekst, anders rendert WeasyPrint ze als kleuren-emoji.
- Planeetglyfen in de SVG **zonder** variatieteken U+FE0E (dat geeft in WeasyPrint een gestippeld cirkeltje). In lopende HTML-tekst mét U+FE0E.
- Planeten binnen 7° van elkaar: alleen het glyph schuift naar binnen, nooit de positie. Dit geldt ook voor de Zuidknoop.
- In de binnencirkel drie lagen, van achter naar voor: de **Flower of Life** (zacht, 19 cirkels), **Metatron's Cube** (duidelijk zichtbaar: 13 cirkels, het middelpunt plus 6 op afstand 2r en 6 op afstand 4r, met alle 78 verbindingslijnen) en de **Merkaba** (twee driehoeken, gouden punt op de Noordknoop, amethisten punt op de Zuidknoop).
- Verificatie: posities terugrekenen uit de SVG-coördinaten, afwijking ≤ 2 px (in de praktijk 0,0 px).

### 3.6 Frequenties
Geen Hz in de Alignment Blueprint. Die horen alleen in de Frequency Blueprint.

---

## 4. INTAKE

- **Met intake:** letterlijke, korte citaten tussen aanhalingstekens naast de duiding, vanaf sectie 11 en door 12 en 13. Namen en concrete details (partner, kinderen, bedrijf, dieren, plaatsen, doelen) in de lopende tekst en in de AI-prompts. Ook de quotepagina's, de openingsalinea van 02 en het "Tot slot" worden vanuit de intake geschreven.
- **Gevoelige feiten** zoals de klant ze zelf benoemt, zonder tijdsaanduiding die snel veroudert, en nooit als astrologische oorzaak.
- **Zonder intake:** geen citaten en geen persoonlijke details, ook niet uit wat Elly over de klant weet. Alles vanuit de kaart en de getallen. Vermelden in het auditrapport.
- Verzin nooit intake-antwoorden.

---

## 5. SCHRIJFREGELS

- **Herkenning eerst, plaatsing als bron.** Niet: "Je Maan in Maagd vindt rust door te ordenen." Wel: "Je vindt rust door dingen te ordenen. (Maan in Maagd, huis 3.)"
- **Zinnen beginnen niet met een planeetnaam** in de duiding. In de kalendertransits mag dat wel: een transit is een gebeurtenis.
- **Elke vakterm krijgt bij eerste gebruik per sectie een uitleg in gewone taal in dezelfde zin.** De lezer heeft geen voorkennis.
- **Levende toon:** begin bij een moment dat de klant herkent; wissel korte en lange zinnen af; stel af en toe een echte vraag; sluit af met iets dat blijft hangen. Nooit twee keer dezelfde openingsformule in één document.
- **Schaduw** eerlijk en warm, nooit klinisch. Elke valkuil sluit af als spiegel.
- **Verboden claims:**
  - geen zeldzaamheidsclaims ("zeldzaam", "uniek", "bijna niemand heeft");
  - geen causaliteit ("verklaart waarom", "bewijst", "zorgt ervoor dat"); gebruik "past bij", "sluit aan bij", "kan erop wijzen";
  - geen medische verklaringen, ook niet als de klant een aandoening zelf noemt.
- **Vorm:** geen em-dashes in lopend proza (alleen in structurele labels als "04 — Astrologie" en in prompt-labels). Middenstip (·) in titels. Geen opsommingstekens in lopend proza. SZINN altijd in kapitalen.
- **Vaste termen:** "Inner Permissions" (niet "permission slips"); gave 05 heet "Perceptie" (niet "Waarneming").
- **Sin · Sinn · Zin (vaste definitie):**
  - **Sin** is de masculiene energie: richting, structuur, actie en kracht (het sympathische zenuwstelsel, dat doorslaat naar stress als het te lang aan blijft staan).
  - **Sinn** is de feminiene energie: ontvangen, voelen, vertrouwen en loslaten (het parasympathische zenuwstelsel).
  - **Zin** is wat er ontstaat als die twee in balans zijn en samen bewegen: spelen, creëren, de uitkomst. Zin is de manifestatie van masculien en feminien in lijn met elkaar, in beweging vanuit balans.
  - In de persoonlijke duiding van sectie 03 wordt Sin gekoppeld aan de masculiene plaatsingen in de kaart, Sinn aan de feminiene, en Zin aan waar ze samenwerken.
- **Signatuur:** "Remember who you are." De oude zin "Je was nooit verloren, je was aan het herinneren" / "You were never lost, you were remembering" is gepensioneerd en komt nergens meer voor.
- **Geen oude handelsnamen.** Er komt geen andere bedrijfs- of handelsnaam in de Blueprint, de mail of de WhatsApp. Ondertekening altijd en alleen: "Elly Elizabeth Korving · SZINN · szinn.ai".

---

## 6. DE INHOUD: 13 SECTIES IN DRIE BEWEGINGEN

### 6.1 Volgorde van het document

```
[beeld]  Cover (main visual, zie 7.1)
[beeld]  Quotepagina "Voor [naam]" · eindigt op "Dit ben jij." (goud) + "Deze Blueprint is je spiegel daarbij."
         Inhoudsopgave (op één blad)
         01  Visie & Missie
[beeld]  Deel I · Wie ben ik? · Herkenning (opener)
         Herkenning · De elementen: het recept (+ tabel)
         Herkenning · Karakter (6)
         Herkenning · Valkuilen (6 + pull-quote)
         Herkenning · Talenten (6, de laatste is altijd "Je gave is je richting")
[beeld]  Quotepagina "Herkenning"
         02  Introductie
[beeld]  Deel II · Wat wil ik? Waar komt het vandaan? · Helderheid (opener)
         04  Astrologie
         05  Noord- & Zuidknoop
[beeld]  Tussenbeeld · "Getallen liegen niet. Ze spiegelen."
         06  Numerologie (incl. groeigetallen)
         07  Kabbalah / Tikkun
         08  Sacred Geometry · De Mandala (2 pagina's)
         09  Overzicht & Samenvatting
[beeld]  Deel III · Waar ga ik heen? Hoe leef ik dit? · Integratie (opener)
         03  Leven vanuit flow
         10  Reflectievragen
         11  Werken met de energie
         12  Integratie (schaduw, zes gaven, 7 praktijken, 6 prompts, kalender 6 maanden)
         Integratie · Inner Permissions (8 + "De zin om mee te nemen")
[beeld]  Quotepagina "Integratie"
         13  Verdieping (met bronnenblok en slotkader)
[beeld]  "Tot slot"
         Achterblad (logo, "Remember who you are.", colofon)
```

- Nooit twee beeldpagina's direct achter elkaar (cover + "Voor [naam]" is de enige uitzondering).
- Beeldpagina's zijn natuurgeometrie, in deze volgorde: paardenbloem, zonnebloem, vetplant, sterrenstelsel, dennenappel, waterdruppel, stenen, ballonnen. Geen mensen, geen handen, geen witte-spiraalfoto.
- **Beeldkwaliteit:** alle beeldpagina's in `assets/img/` (d-003 t/m d-011) zijn 2480 × 3508 px, 300 dpi op A4, geëxporteerd uit het Canva-origineel van Elly (logo zit in het beeld). Vervang ze nooit door een kleiner bestand of door een uitsnede uit een eerder opgeleverde PDF. Controleer na het bouwen dat elk ingebed beeld van een beeldpagina minstens 2480 × 3508 px is.

### 6.2 Inhoud per sectie

| # | Sectie | Inhoud |
|---|---|---|
| 01 | Visie & Missie | Vaste tekst verbatim + zes kaartjes + vertrouwelijkheidszin |
| I | Elementen | Titel "Het recept: …"; telling over tien planeten; vier kaarten (ook het zwakste element); "Wat de verdeling zegt"; pull-quote; tabel met de kernplaatsingen |
| I | Karakter · Valkuilen · Talenten | Elk zes stukken, kop in gedragstaal, plaatsing in het label |
| 02 | Introductie | Vaste tekst + persoonlijke alinea's (Zon, Ascendant, Maan, knopen-as, Levenspad en PJ) + spiegelnoot |
| 04 | Astrologie | Vaste uitleg, twaalf huizen, planeetentabel met AC en MC, aspectentabel, opvallende patronen, geboortetijdnoot, twee patroonkaarten |
| 05 | Knopen | Vaste uitleg, as-duiding, twee kaarten, Chiron |
| 06 | Numerologie | Negen getalkaartjes, meestergetallen, Levenspad, Geboortedag, PJ lopend en volgend, eventuele ondertoon, drie naamgetallen met berekening, groeigetallen, Levenspad-duiding, PJ-duiding, "De cyclus van dit half jaar" |
| 07 | Tikkun | Vaste uitleg; Kernthema, Herhalingspatroon, Groei, Zielstaak; retrograde-laag |
| 08 | Mandala | Mandala + legenda; tweede pagina met vaste tekst en ademreeks |
| 09 | Overzicht | "[Naam] in één zin", vaste alinea, overzichtstabel |
| 03 | Flow | Vaste tekst, Sin · Sinn · Zin persoonlijk, drie kaartjes, vijf vragen |
| 10 | Reflectievragen | Tien persoonlijke journaling-vragen |
| 11 | Werken met de energie | Maanfasen (vast), ritme uit de kaart, zes ritmekaartjes. Intake-citaten starten hier |
| 12 | Integratie | Vier lagen, vaste spiegeltekst, schaduw, zes gaven, adem, zes bewegingen, mandala, AI, 7 praktijken, 6 prompts, kalender van zes maanden vanaf de opleveringsmaand (PM + transits + lunaties per maand) |
| 13 | Verdieping | Drie opties, vier bewegingen, "Tot slot" (persoonlijk, eindigt op "Remember who you are."), bronnenblok |

**Vaste aantallen:** 4 elementkaarten · 6 karakter · 6 valkuilen · 6 talenten · 7 praktijken · 6 prompts · 10 reflectievragen · 6 kalendermaanden · 8 Inner Permissions · 3 quotepagina's · 3 openers · 1 tussenbeeld · 1 slotbeeld.

---

## 7. VORMGEVING

### 7.1 Cover (main visual)

- De highres piramide/Nijl-foto (`assets/img/cover.jpg`, 300 dpi op A4) vult de hele pagina, **zonder donkere laag over de foto**.
- Linksboven het gouden beeldmerk met "szinn.ai" eronder en een dun gouden verticaal lijntje.
- Onderaan een donkere band die vanaf de rivier zacht overloopt naar donker. Daarin, in deze volgorde:
  - "ALIGNMENT BLUEPRINT" (goud, kapitalen);
  - de naam groot in wit (Cormorant Garamond), op twee regels;
  - "REMEMBER WHO YOU ARE" (goud, kapitalen);
  - een gouden lijn;
  - datum · tijd · plaats in kapitalen;
  - Zon, Maan en Ascendant met graad;
  - Levenspad, Geboortedag en Persoonlijk Jaar;
  - "Gefaciliteerd door Elly Elizabeth Korving · SZINN · szinn.ai · [maand jaar]".
- Geen introzin en geen portretzin op de cover.

### 7.2 Typografie en kleur

- **Cormorant Garamond** voor titels, de naam en quotes; **Inter** voor lopende tekst en labels.
- Kleuren: goud #C9A96E, goud-printtint #9A7B2E, crème #FBF7F0, donker #0D0A07.
- Het logo is altijd het bestaande bestand (`assets/img/logo.png`), nooit nagebouwd.

### 7.3 PDF

- A4, witte tekstpagina's, paginavoet "SZINN · Alignment Blueprint · [Naam] · [nr]", geen voet op beeldpagina's.
- Genereren met WeasyPrint: `HTML(filename=…).write_pdf(…, presentational_hints=True)`. Een browserprint is nooit de opgeleverde PDF.
- Kaartjes, notes en prompts breken niet over een paginagrens.

### 7.4 HTML (op verzoek)
Inhoudelijk identiek aan de PDF, self-contained (alle beelden en fonts ingebed), ademende mandala, kopieerknoppen bij de prompts. Elly bepaalt per klant of de HTML wordt meegeleverd; standaard is de PDF.

---

## 8. DRUKVERSIE · PRINT&BIND (gelijmd boek)

`book.py` maakt uit hetzelfde bouwscript twee drukbestanden:

**Binnenwerk** (`*_BOEK_binnenwerk.pdf`)

- Losse A4-pagina's, dubbelzijdig, altijd een even aantal pagina's.
- Gespiegelde marges: 24 mm aan de lijmkant, 16 mm aan de buitenkant. Print&Bind eist minimaal 15 mm aan de bindzijde en 5 mm rondom.
- Pagina 1 (rechts) is een witte titelpagina met logo, naam, geboortegegevens en de facilitatorregel. Pagina 2 is "Voor [naam]", pagina 3 de inhoudsopgave met paginanummers.
- De deelopeners (I, II, III) staan altijd op een rechterpagina. Ingevoegde lege pagina's hebben geen paginanummer.
- Het colofon staat op de laatste linkerpagina.

**Omslag** (`*_BOEK_omslag.pdf`)

- Eén spread: achterkant | rug | voorkant. Breedte = 2 × 210 mm + rugbreedte.
- Voorkant = de cover van 7.1. Achterkant en rug wit, met zwarte tekst en gouden accenten. Op de achterkant staan het logo, de visie-zin "Als genoeg mensen herinneren wie ze zijn, verandert de wereld om ons heen vanzelf.", een korte uitleg en "Remember who you are.".
- Rugtekst alleen bij een rug van 6 mm of breder.
- De rugbreedte wordt geschat (0,11 mm per vel + 0,5 mm). **De echte rugbreedte toont Print&Bind bij het uploaden.** Draai daarna `python3 book.py build_klant.py <rug_mm>`.

**Bestelinstellingen:** A4 · gelijmd (garenloos) · dubbelzijdig in kleur · randloos aan · doorlopende omslag met bedrukte rug · binnenkant omslag onbedrukt · bij voorkeur mat laminaat. Zonder afloop vergroot Print&Bind 1%; alle tekst staat ruim binnen de snijmarge.

---

## 9. DRIEVOUDIGE CONTROLE (verplicht, vóór elke oplevering)

**Grondhouding.** Een Blueprint is persoonlijk en wordt als boek gedrukt. Eén verkeerde graad, één zin van een andere klant of één verzonnen feit beschadigt het vertrouwen in het hele systeem. Daarom wordt alles drie keer gecontroleerd, op drie verschillende manieren, en pas opgeleverd als alle drie de rondes schoon zijn. Twijfel is een fout: bij twijfel niet opleveren, maar navragen bij Elly.

### Ronde 1 · Berekeningen (drie keer, drie manieren)

1. **Opnieuw rekenen.** `audit.py` rekent de geboortekaart opnieuw uit met Swiss Ephemeris en vergelijkt met `klant_chart.json` (verschil moet 0 zijn).
2. **Onafhankelijk model.** Dezelfde posities worden berekend met een tweede planeetmodel (Moshier). Verschil groter dan 1 boogminuut is een fout.
3. **Gevoeligheid.** Huizen worden opnieuw berekend met de geboortetijd ±2 minuten en de coördinaten ±0,01°. Wisselt een planeet dan van huis, dan moet er een geboortetijdnoot in het document staan.
4. **Elke bewering in de tekst.** Elke graad, elke huisvermelding en elk aspect met orb wordt teruggelezen en vergeleken met de datalaag.
5. **Numerologie op twee manieren.** Levenspad en Persoonlijk Jaar worden met twee onafhankelijke rekenwijzen berekend en moeten gelijk zijn. Naamgetallen, samengestelde getallen en groeigetallen worden getoond en moeten overeenkomen met wat in het document staat.
6. **Handmatig, de derde keer:** reken Levenspad, Persoonlijk Jaar en één naamgetal met de hand na op papier; vergelijk Zon, Maan en Ascendant met een astro.com-kaart (Placidus, ware knoop); controleer elke transit en lunatie in de kalender tegen de uitvoer van `transits.py`.

### Ronde 2 · Niets overgenomen van andere Blueprints
Elke Blueprint wordt geschreven voor één mens. **Persoonlijke tekst uit een eerdere Blueprint wordt nooit hergebruikt**, ook niet als de plaatsing hetzelfde is: dezelfde Zon in Leeuw bij twee mensen krijgt twee eigen teksten.

1. `audit.py --andere MAP` vergelijkt het document met alle eerder opgeleverde Blueprints in die map. Een reeks van **14 of meer woorden** die letterlijk ook in een andere Blueprint staat en geen vaste tekst is, is een **fout**. Reeksen van 9 tot 13 woorden worden als **sjabloonzin** gemeld: herschrijf ze bij voorkeur.
2. **Namen van andere klanten** (afgeleid uit de bestandsnamen in de map) mogen nergens in het document staan.
3. **Andere geboortedata** dan die van de klant mogen nergens in het document staan.
4. Vaste teksten (`szinn_vast.py`) en vaste structuurzinnen (`standaardzinnen.txt`) mogen wel in elke Blueprint terugkomen. Voeg aan `standaardzinnen.txt` alleen sjabloonzinnen toe (openers, leads, kalenderintro), nooit persoonlijke duiding.
5. **Handmatig:** lees het document door met de vraag "zou deze zin bij een andere klant ook kunnen staan?". Zo ja: persoonlijker maken vanuit de kaart van déze klant.
6. **Werkwijze bij het schrijven:** begin voor elke klant met de datalaag, niet met de tekst van een vorige klant. Het referentiescript levert de structuur; de persoonlijke zinnen worden altijd opnieuw geschreven.

### Ronde 3 · Niets verzonnen

1. **Elk feit over het leven van de klant** (beroep, gezin, partner, pensioen, verlies, woonplaats, gevoelens die hij "zelf zegt") komt letterlijk uit de intake. Zonder intake staat er geen enkel levensfeit in het document, alleen duiding vanuit de kaart en de getallen.
2. **Elk citaat** tussen aanhalingstekens moet letterlijk in de intake staan (`--intake intake.txt`). Zonder intake is elk citaat van de klant een fout.
3. **Geen formuleringen die ervaring suggereren die niet bekend is:** geen "zoals je zelf zegt", "je herkent het zelf", "nu je met pensioen bent" zonder intake. Wel: "misschien herken je…", "kan zich laten voelen als…".
4. **Geboortegegevens** (datum, tijd, plaats) zijn overal in het document gelijk.
5. **Verboden claims:** zeldzaamheid ("zeldzaam", "uniek"), causaliteit ("verklaart waarom", "bewijst"), medische verklaringen, percentages over hoe vaak iets voorkomt.
6. **Transits:** "exact" alleen bij een orb onder 0,5°; geen transit die niet in de uitvoer van `transits.py` staat.
7. **Handmatig:** markeer bij het doorlezen elke zin die iets over het leven van de klant beweert, en wijs per zin de bron aan (kaart, getal of intake). Zonder bron: schrappen.

### Het script en de volgorde
```
python3 audit.py klant_chart.json klant_print.html "Volledige Geboortenaam" DD MM JJJJ --andere MAP_EERDERE_BLUEPRINTS [--intake intake.txt]
```

1. **Eerste keer:** direct na het bouwen. Los elk ✗ op in de bron (niet in de PDF), bouw opnieuw.
2. **Tweede keer:** na alle correcties, opnieuw volledig. Ook de waarschuwingen (!) doorlopen.
3. **Derde keer:** na het bouwen van de drukversie, op de definitieve bestanden, gevolgd door de handmatige punten van ronde 1 t/m 3 en een visuele controle van cover, mandala, inhoudsopgave, kalender en omslag.

Pas als de derde ronde eindigt op **"RESULTAAT: OK, klaar voor oplevering"** en de handmatige punten zijn afgevinkt, wordt er opgeleverd. Het script meldt zelf hoe vaak de huidige versie al OK is gecontroleerd; bij minder dan drie keer wordt er niet opgeleverd. **Na elke wijziging begint de telling opnieuw**, want het bestand heeft dan een nieuwe vingerafdruk. Regenerate, not patch: altijd de bron aanpassen en opnieuw bouwen, nooit in de PDF zelf repareren.

### Auditrapport voor Elly
In de chat of als `klant_audit.md`, nooit in het klantdocument:

- geboortegegevens, tijdzone en coördinaten;
- de uitkomst van ronde 1 (verschillen, gevoelige huizen, geboortetijdmarge);
- ronde 2 (vergeleken met hoeveel Blueprints, eventuele sjabloonzinnen);
- ronde 3 (intake ja/nee, aantal gecontroleerde citaten);
- welke getallen zijn weggelaten en waarom;
- de drie keer "OK".

---

## 10. AFLEVERING

- **Bestanden:** de digitale PDF (`*_3delen.pdf`), en bij een drukopdracht het binnenwerk en de omslag. De HTML alleen als Elly erom vraagt.
- **Afleveringsmail** in de taal van de klant:
  - warm en niet verkoperig;
  - facilitator-framing: "SZINN is het systeem dat ik heb gebouwd en samenbreng; het doet alle berekeningen zelf";
  - minstens één anker uit de kaart (bijvoorbeeld het Levenspad) en, waar beschikbaar, één intake-citaat;
  - uitleg dat de Blueprint een spiegel is en geen voorspelling, en dat je hem één sectie tegelijk leest;
  - afsluiten met "Remember who you are.";
  - ondertekening "Elly Elizabeth Korving · SZINN · szinn.ai".
- **WhatsApp** alleen als de klant dat heeft aangevinkt: korter, zonder opmaak, in twee lengtes, verwijzend naar de mail. Tot de pipeline dit doorgeeft, verstuurt Elly het handmatig.

---

## 11. WORKFLOW

1. **Invoer controleren:** volledige geboortenaam (geboorteakte), datum, exacte tijd, geboortestad met coördinaten, tijdzone, taal, intake. Stop en vraag terug bij een onmogelijke datum, een landnaam als plaats of een onbevestigde naam.
2. **Datalaag:** `chart.py` → `klant_chart.json`. Lees de grensmarkeringen en de Ascendant-marge.
3. **Getallen:** `szinn_numerologie.py` (Levenspad, PJ lopend en volgend, maanden, naamgetallen, groeigetallen).
4. **Kalender:** `transits.py klant_chart.json JJJJ-MM` vanaf de opleveringsmaand.
5. **Schrijven:** kopieer `build_voorbeeld_marc.py` naar `build_klant.py`. Vervang alle persoonlijke teksten, tabellen, prompts, maanden en quotes. Laat de structuur en de vaste teksten staan.
6. **Bouwen:** `python3 build_klant.py` (digitale PDF) of `python3 book.py build_klant.py` (digitale PDF + binnenwerk + omslag).
7. **Drievoudige controle:** `audit.py` met `--andere` (en `--intake` als die er is), drie keer, plus de handmatige punten van sectie 9. Alles groen, anders terug naar stap 5.
8. **Visueel controleren:** cover, mandala, inhoudsopgave, kalender, omslag.
9. **Opleveren:** bestanden + afleveringsmail + auditrapport voor Elly.

---

© 2026 Elly Elizabeth Korving · Alterego BV · All rights reserved. De SZINN-methodologie en de opbouw van dit document zijn beschermd; niets uit dit document mag worden verveelvoudigd zonder uitdrukkelijke schriftelijke toestemming van Alterego BV.

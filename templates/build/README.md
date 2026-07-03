# Template-bouwscripts (eenmalig)

De canonieke blueprint-templates zijn gebouwd uit het referentiedocument
`SZINN_Alignment_Blueprint_Barry.html` (niet in de repo — bevat klantdata):

1. `tokenize_template.py` — vervangt alle persoonlijke/berekende/AI-tekst
   door `{{TOKENS}}` → `templates/blueprint.nl.html`
2. `make_en_template.py` — vertaalt alle vaste teksten → `templates/blueprint.en.html`

Beide scripts asserteren elke vervanging, zodat een wijziging in het
brondocument nooit stilletjes verkeerd doorwerkt. De tokens worden ingevuld
door `lib/template.js` (berekende data + AI-teksten uit `lib/ai-texts.js`).

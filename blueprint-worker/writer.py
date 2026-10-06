# -*- coding: utf-8 -*-
"""SZINN · schrijflaag. Laat Claude alle persoonlijke tekst schrijven als JSON (content.json) vanuit de datalaag en
de intake, met masterprompt v4 als bindende standaard. Berekent niets: alle getallen staan al in de feiten."""
import json, os, re, sys
from concurrent.futures import ThreadPoolExecutor
import anthropic

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'kit', 'scripts'))
from szinn_taal import LANG, nm, GLOSSARIUM  # noqa: E402
MASTERPROMPT = open(os.path.join(HERE, 'kit', 'MASTERPROMPT_SZINN_Alignment_Blueprint_v4.md'), encoding='utf-8').read()
MODEL = os.environ.get('BLUEPRINT_MODEL', 'claude-sonnet-5')

INTAKE_VRAGEN = {
    'p1_bezig': 'Wat houdt je op dit moment het meest bezig in je leven?',
    'p2_verlangen': 'Waar verlang je het meest naar? En wat loop je daarin tegenaan?',
    'p3_energie': 'Wat geeft je energie? Waar word je blij van?',
    'p4_veranderen': 'Wat zou je het liefst willen veranderen in je leven?',
    'p5_tevredenheid': 'Hoe tevreden ben je met je leven op dit moment, en op welk gebied wil je het meest groeien?',
    'w1_werk_gevoel': 'Hoe voelt je werk op dit moment voor je aan?',
    'w2_werk_anders': 'Wat zou je meer willen doen in je werk of wat zou je anders willen?',
    'w3_werk_stap': 'Welke kleine stap zou je kunnen zetten om je werk leuker of betekenisvoller te maken?',
    'w4_werk_1jaar': 'Hoe zou je leven eruitzien als het echt goed zat over 1 jaar?',
    'e1_opladen': 'Wat helpt jou om op te laden en je energie terug te krijgen?',
    'e2_uitgeput': 'Wanneer voel je je vaak uitgeput of overbelast?',
    'e3_balans_1jaar': 'Hoe zou je willen dat je leven eruit ziet over 1 jaar op het gebied van energie en balans?',
    'r1_verbinding': 'Hoe ervaar je de verbinding met mensen om je heen op dit moment?',
    'r2_relaties_verdiepen': 'Wat zou je graag willen veranderen of verdiepen in je relaties?',
    't1_een_ding': 'Als je één ding zou kunnen veranderen in je leven, wat zou dat dan zijn?',
    't2_komende_maand': 'Wat zou je graag willen bereiken of ervaren in de komende maand?',
    't3_belemmering': 'Wat belemmert je nu om dat te bereiken?',
    'z1_moeilijkst': 'Wat vind je het moeilijkst aan het maken van veranderingen?',
    'z2_helpen': 'Wat zou jou kunnen helpen om makkelijker stappen te zetten?',
    'z3_1jaar': 'Hoe zou je willen dat je leven eruitziet over 1 jaar?',
    'b1_ondergaan_creeren': 'Voel je dat je het leven vooral ondergaat of bewust creëert? Of zit je ertussenin?',
    'b2_irritatie_bewondering': 'Wat in anderen irriteert of bewonder je? Wat zegt dat over jou?',
    'b3_controle_vertrouwen': 'Leef je meer vanuit controle (doen/sturen) of vertrouwen (laten/ontvangen)? Hoe zie je dat terug in je dagelijks leven?',
    'b4_angst_loslaten': 'Als angst geen rol speelde, wat zou je doen of loslaten? Wat houdt je nu tegen?',
}


INTAKE_VRAGEN_EN = {
    'p1_bezig': 'What is occupying your mind most right now in your life?',
    'p2_verlangen': 'What do you long for most? And what is getting in your way?',
    'p3_energie': 'What gives you energy? What makes you come alive?',
    'p4_veranderen': 'What would you most like to change in your life?',
    'p5_tevredenheid': 'How satisfied are you with your life right now, and in which area do you most want to grow?',
    'w1_werk_gevoel': 'How does your work feel to you right now?',
    'w2_werk_anders': 'What would you like to do more of in your work, or what would you change?',
    'w3_werk_stap': 'What small step could you take to make your work more fulfilling or meaningful?',
    'w4_werk_1jaar': 'What would your life look like if everything felt truly aligned in 1 year?',
    'e1_opladen': 'What helps you recharge and restore your energy?',
    'e2_uitgeput': 'When do you often feel drained or overwhelmed?',
    'e3_balans_1jaar': 'How would you like your life to look in 1 year when it comes to energy and balance?',
    'r1_verbinding': 'How do you experience your connection with the people around you right now?',
    'r2_relaties_verdiepen': 'What would you like to change or deepen in your relationships?',
    't1_een_ding': 'If you could change one thing in your life, what would it be?',
    't2_komende_maand': 'What would you like to achieve or experience in the coming month?',
    't3_belemmering': 'What is currently stopping you from reaching that?',
    'z1_moeilijkst': 'What do you find most difficult about making changes?',
    'z2_helpen': 'What could help you take steps more easily?',
    'z3_1jaar': 'How would you like your life to look in 1 year?',
    'b1_ondergaan_creeren': 'Do you feel you mostly experience life as it happens, or do you consciously create it? Or somewhere in between?',
    'b2_irritatie_bewondering': 'What do you find irritating or admirable in others? What does that say about you?',
    'b3_controle_vertrouwen': 'Do you live more from control (doing/directing) or from trust (allowing/receiving)? How do you see that reflected in your daily life?',
    'b4_angst_loslaten': 'If fear played no role, what would you do or let go of? What is stopping you now?',
}


def intake_tekst(raw):
    """De intake-antwoorden letterlijk, met de vraag erbij. Dit is ook de bron voor de citatencontrole van audit.py."""
    vragen = INTAKE_VRAGEN_EN if LANG == 'en' else INTAKE_VRAGEN
    regels = [f'{vraag}\n{str(raw.get(k)).strip()}\n' for k, vraag in vragen.items() if str(raw.get(k) or '').strip()]
    # velden die later aan het formulier zijn toegevoegd niet laten vallen
    regels += [f'{k}\n{str(v).strip()}\n' for k, v in raw.items()
               if re.match(r'^[a-z]\d_', k) and k not in INTAKE_VRAGEN and str(v or '').strip()]
    return '\n'.join(regels)


# ---------- JSON-schema's (vaste aantallen via de opdracht + vormcontrole, nooit minItems > 1) ----------
S = {'type': 'string'}
def obj(**p): return {'type': 'object', 'properties': p, 'required': list(p), 'additionalProperties': False}
def arr(item): return {'type': 'array', 'items': item}
TTX = obj(titel=S, tekst=S)
STUK = obj(titel=S, plaatsing=S, tekst=S)
PLANETEN = ['Zon', 'Maan', 'Mercurius', 'Venus', 'Mars', 'Jupiter', 'Saturnus', 'Uranus', 'Neptunus', 'Pluto', 'Noordknoop', 'Chiron']
KERN = ['Zon', 'Maan', 'Ascendant', 'Midhemel', 'Mercurius', 'Venus', 'Mars', 'Saturnus', 'Chiron', 'Knopen-as']


def schema(groep, facts):
    if groep == 'A':
        return obj(voor=S, elementen=obj(titel=S, lead_slot=S, kaarten=arr(obj(element={'type': 'string', 'enum': ['vuur', 'lucht', 'water', 'aarde']}, tag=S, tekst=S)),
                                         verdeling=arr(S), pull=S, kern=obj(**{k: S for k in KERN})),
                   karakter=arr(STUK), valkuilen=arr(STUK), valkuilen_pull=S, talenten=arr(STUK), herkenning_quote=S, introductie=arr(S))
    if groep == 'B':
        keys = [a['sleutel'] for a in facts['aspecten_tabel']] or ['geen']
        return obj(planeten=obj(**{k: S for k in PLANETEN + ['Ascendant', 'Midhemel']}),
                   aspecten=arr(obj(aspect={'type': 'string', 'enum': keys}, tekst=S)),
                   patronen=arr(S), geboortetijdnoot=S, patroonkaarten=arr(obj(label=S, titel=S, tekst=S)),
                   knopen=arr(S), zuidknoop_kaart=S, noordknoop_kaart=S, chiron=S, tikkun=arr(TTX), retrograde=S,
                   overzicht=obj(een_zin=S, rijen=arr(S)))
    if groep == 'C':
        return obj(num=obj(ondertoon=S, uitdrukking=S, zielenurge=S, persoonlijkheid=S, returning=S, keynote_woord=S, keynote=S,
                           untrained=S, groei_samen=S, lp_titel=S, lp=arr(S), pj_kop=S, pj=arr(S), cyclus_titel=S, cyclus=S),
                   flow=obj(alineas=arr(S), kaarten=arr(obj(plaatsing=S, tekst=S)), vragen=arr(S)), reflectie=arr(S))
    return obj(ritme=obj(alinea=S, kaarten=arr(TTX)),
               integratie=obj(lagen=S, schaduw=S, gaven=arr(S), adem=S, praktijken=arr(TTX), prompts=arr(obj(onderwerp=S, tekst=S)),
                              maanden=arr(obj(titel=S, tekst=S, transits=S))),
               permissions=arr(obj(tekst=S, uitleg=S)), zin=S, integratie_quote=S, tot_slot=arr(S), mail=S, dagfocus=S)


# ---------- opdrachten per groep ----------
OPDRACHT = {
'A': """GROEP A · Deel I Herkenning + 02 Introductie
- voor: de quotepagina "Voor {voornaam}": 3 tot 4 zinnen in de tweede persoon die de kern van deze mens spiegelen (kaart + intake). NIET eindigen op "Dit ben jij." (dat zet het bouwscript erachter).
- elementen.titel: het vervolg op "Het recept: " (kleine letter), een beeldende samenvatting van de elementverdeling, bv. in de vorm "x en y in gelijke delen, z aan je voordeur".
- elementen.lead_slot: één afsluitende zin na de vaste telling (de telling zelf staat er al).
- elementen.kaarten: PRECIES 4, één per element (vuur, lucht, water, aarde). tag = kort label ("Je kern", "In je werk en je dag"); tekst = 4 à 6 zinnen over wat dit element bij déze persoon doet, ook het zwakste element.
- elementen.verdeling: PRECIES 3 alinea's "Wat de verdeling zegt", elk eindigend met de bron tussen haakjes met graden en huizen.
- elementen.pull: één zin, de kern van de elementen.
- elementen.kern: per sleutel één korte duiding (6 à 14 woorden) achter de positie in de tabel.
- karakter: PRECIES 6 stukken (wie je bent in balans). titel = kop in gedragstaal; plaatsing = de bron ("Planeet in Teken, huis N · Planeet aspect Planeet"); tekst = 3 à 4 zinnen.
- valkuilen: PRECIES 6 stukken (uit balans), zelfde vorm; elke valkuil sluit af als spiegel. valkuilen_pull: 2 zinnen.
- talenten: PRECIES 6 stukken; het zesde gaat over de Noordknoop (titel en plaatsing worden vast gezet, schrijf wel de tekst).
- herkenning_quote: één krachtige zin voor de quotepagina "Herkenning".
- introductie: PRECIES 3 alinea's. De eerste begint met "{voornaam}, " en gaat over Zon (+ Mercurius); de tweede over Ascendant en Maan; de derde over de knopen-as en Levenspad + Persoonlijk Jaar (lopend en volgend). De openingsalinea put waar mogelijk uit de intake.""",
'B': """GROEP B · 04 Astrologie, 05 Knopen, 07 Tikkun, 09 Overzicht
- planeten: per planeet één korte kwaliteit (8 à 16 woorden) voor de planeetentabel; het bouwscript zet "Teken in huis N ·" er al voor. Ascendant en Midhemel: een korte zin zonder teken ervoor.
- aspecten: voor ELK aspect uit de aspecttabel precies één regel, in dezelfde volgorde (sleutel exact overnemen), 8 à 16 woorden: wat het in gesprek brengt.
- patronen: PRECIES 3 alinea's "Opvallende patronen in jouw kaart", elk met de bron tussen haakjes.
- geboortetijdnoot: {tijdnoot}
- patroonkaarten: PRECIES 2 kaarten; label = huis of cluster met planeten ("Huis N (Planeet · Planeet)"), titel, tekst 3 zinnen.
- knopen: PRECIES 2 alinea's: Zuidknoop (vertrouwd patroon, wanneer het niet meer voedt) en Noordknoop (groeirichting), de tweede eindigt met de bron tussen haakjes.
- zuidknoop_kaart / noordknoop_kaart: 3 zinnen; de noordknoopkaart eindigt met één concrete stap.
- chiron: één alinea over Chiron in teken en huis, met de gave, eindigend met de bron.
- tikkun: PRECIES 4 in deze volgorde: Kernthema, Herhalingspatroon, Groei, Zielstaak. titel = korte kop; tekst = 4 à 5 zinnen met bron tussen haakjes.
- retrograde: één alinea over de retrograde planeten (knopen nooit als bijzonderheid). Zijn er geen, zeg dat rustig.
- overzicht.een_zin: één zin die begint met "{voornaam} " (wordt tussen aanhalingstekens gezet).
- overzicht.rijen: PRECIES 8 korte duidingen, in deze volgorde: Elementen, Kernidentiteit, Emotioneel kompas, Zielrichting, Levensthema, Naamgetallen, Tikkun, Schaduwthema.""",
'C': """GROEP C · 06 Numerologie, 03 Flow, 10 Reflectievragen
- num.ondertoon: {ondertoon}
- num.uitdrukking / zielenurge / persoonlijkheid: 1 à 2 zinnen per getal (wat het betekent), eventueel een meestergetal in een naamdeel benoemen.
- num.returning: 2 à 4 zinnen: de returning number(s) in gewone taal met het thema uit masterprompt 3.4, of (bij geen) dat de kerngetallen vrij zijn van returning numbers.
- num.keynote_woord: één woord; num.keynote: 2 à 3 zinnen, noem hoeveel letters de keynote dragen en welke.
- num.untrained: 2 à 3 zinnen over de ontbrekende getallen (of dat alle negen voorkomen).
- num.groei_samen: één alinea "in gewone woorden" die de groeigetallen koppelt aan de kaart en het lopende Persoonlijk Jaar, eindigend met de bron tussen haakjes.
- num.lp_titel: archetype-naam van het Levenspad; num.lp: PRECIES 2 alinea's (licht en schaduw, koppeling met kaart, eventuele ondertoon, geboortedag).
- num.pj_kop: vervolg op "Persoonlijk Jaar N (JJJJ) en " (bv. "het jaar dat eraan komt"); num.pj: PRECIES 2 alinea's over het lopende en het volgende Persoonlijk Jaar.
- num.cyclus_titel + num.cyclus: "De cyclus van dit half jaar": loop de zes persoonlijke maanden langs met hun getal.
- flow.alineas: PRECIES 4 alinea's: Sin (masculiene plaatsingen), Sinn (feminiene plaatsingen), Zin (waar ze samenwerken), wat de balans nu onderbreekt. Volg de vaste definitie uit masterprompt sectie 5.
- flow.kaarten: PRECIES 3 (Sin, Sinn, Zin): plaatsing = de bron als kop, tekst = 2 zinnen.
- flow.vragen: PRECIES 5 reflectievragen over flow. reflectie: PRECIES 10 persoonlijke journaling-vragen.""",
'D': """GROEP D · 11 Energie, 12 Integratie, Inner Permissions, Tot slot. Letterlijke intake-citaten horen vanaf hier.
- ritme.alinea: één alinea over het ritme van deze kaart. ritme.kaarten: PRECIES 6 in deze volgorde: Ochtend, Werk & focus, Lichaam & ritme, Hart & verbinding, Avond & herstel, Seizoen (titel = een eigen korte kop in gedragstaal zoals "Begin met bewegen", NIET het label zelf; tekst = 2 à 3 zinnen met bron tussen haakjes; Seizoen koppelt aan de persoonlijke maanden).
- integratie.lagen: één alinea "Jouw vier lagen op dit moment" (astrologie, numerologie, zielrichting, transits), met daarin letterlijk de zin "De praktijken hieronder richten zich op waar de meeste beweging mogelijk is." en daarna "Voor jou is dat nu vooral: ...".
- integratie.schaduw: één alinea over de schaduw (Zuidknoop + patronen) en de uitnodiging van de Noordknoop.
- integratie.gaven: PRECIES 6 teksten in deze volgorde: Intuïtie, Verbeeldingskracht, Geheugen, Redeneren, Perceptie, Wilskracht; elk 2 à 3 zinnen met bron tussen haakjes.
- integratie.adem: één alinea "De adem als sleutel".
- integratie.praktijken: PRECIES 7 (titel kort, tekst 2 zinnen met bron tussen haakjes).
- integratie.prompts: PRECIES 6; 1 t/m 3 astrologie, 4 t/m 6 schaduwwerk. onderwerp = korte naam ("Je kernidentiteit belichten"); tekst = een AI-prompt in de ik-vorm die begint met "Ik ben {voornaam}" en de relevante plaatsingen/getallen noemt, en de AI vraagt om vragen te stellen in plaats van advies te geven. Noem in de prompts geen graden en niet de geboortedatum of -tijd.
- integratie.maanden: PRECIES 6, in de volgorde van de kalender. titel = 2 à 4 woorden bij het maandgetal; tekst = 1 à 2 zinnen over wat het maandgetal vraagt; transits = de transits en lunaties van die maand in lopende zinnen, ALLEEN uit de lijst voor die maand, met datum (zonder jaartal) en huis; "exact" alleen waar de lijst "(exact)" zegt. Is er niets, schrijf alleen over de maanfasen.
- permissions: PRECIES 8, in deze volgorde 2× vuur, 2× lucht, 2× aarde, 2× water. tekst begint met "Ik geef mezelf toestemming om"; uitleg = "Voor [plaatsing]. [één korte zin]".
- zin: "De zin om mee te nemen", 3 à 4 zinnen. integratie_quote: één zin voor de quotepagina "Integratie".
- tot_slot: PRECIES 2 alinea's, persoonlijk vanuit kaart én intake; de eerste begint met "{voornaam}, "; de tweede eindigt op "Remember who you are."
- mail: 2 à 3 zinnen voor de afleveringsmail: minstens één anker uit de kaart (bv. het Levenspad) en, als er een intake is, één kort letterlijk citaat tussen aanhalingstekens. Geen aanhef, geen afsluiting.
- dagfocus: één korte zin (max 12 woorden) als dagelijkse focus voor het dashboard.""",
}

SYSTEEM = """Je bent de schrijflaag van de SZINN Alignment Blueprint. Hieronder staat de bindende standaard (masterprompt v4). Volg die volledig, met één uitzondering: jij schrijft alleen de persoonlijke tekst. De vaste teksten, de opmaak, alle getallen, tabellen en de controle doet de pipeline zelf.

Werkregels voor deze pipeline (aanvullend op de masterprompt):
1. Schrijf in het Nederlands, tweede persoon enkelvoud (jij/jouw). Gewone tekst, geen HTML, geen markdown, geen opsommingstekens.
2. De schrijflaag berekent niets. Gebruik uitsluitend de posities, huizen, graden, orbs en getallen uit de FEITEN. Schrijf graden altijd precies zoals in de feiten (bv. 1°29'), zonder spatie, en huizen als "huis 9". Noem nooit een graad die niet in de feiten staat.
3. Herkenning eerst, plaatsing als bron: begin bij gedrag en gevoel, zet de plaatsing erachter of tussen haakjes. Zinnen in de duiding beginnen niet met een planeetnaam.
4. Aanhalingstekens (" of “ ”) gebruik je UITSLUITEND voor letterlijke citaten uit de intake, kort en woord voor woord gelijk aan de intake. Geen citaten in groep A, B en C. Zonder intake: geen enkel citaat, geen levensfeiten, geen "zoals je zelf zegt".
5. Verboden: em-dashes (—) in lopende tekst, de woorden zeldzaam/zeldzame/uniek, causaliteit (verklaart waarom, bewijst, zorgt ervoor dat, is de reden dat), medische woorden (diagnose, ziekte, stoornis), percentages, u/uw, Hz, "permission slips", de oude signatuur "nooit verloren", andere bedrijfsnamen. Schrijf SZINN in kapitalen.
6. Niets overnemen: schrijf elke zin nieuw voor deze ene mens. Gebruik geen voorbeeldzinnen uit de masterprompt.
7. Geen namen van andere mensen dan die de klant zelf in de intake noemt. Noem geen andere geboortedata dan die van de klant; schrijf data in de kalender zonder jaartal.
8. Houd je exact aan de gevraagde aantallen. Lever alleen de JSON volgens het schema.
9. Eenvoudige taal (B1-niveau): schrijf zoals je tegen een vriendin praat. Korte zinnen (gemiddeld 15 woorden of minder), gewone woorden, één gedachte per zin. Harde grens: geen enkele zin langer dan 22 woorden, ook niet waar de masterprompt zegt "wissel korte en lange zinnen af" (lang betekent hier hooguit 22 woorden). Zet geen opsomming, uitleg en gevolg in één zin met dubbele punten, puntkomma's of een reeks komma's: maak er twee of drie zinnen van. Tel bij twijfel de woorden. Geen abstracte of spirituele vaktaal (manifestatie, polariteit, archetypisch, transformatief, resoneren, integreren, paradigma, essentie, katalysator) en geen dure woorden waar een gewoon woord bestaat ("mogelijk maken" wordt "helpen", "fundamenteel" wordt "diep"). Astrologische en numerologische termen mogen wel, maar alleen met de uitleg in gewone taal uit de masterprompt.
10. Schrijf voor iemand zonder enige kennis van astrologie. Maak elke duiding concreet met een alledaags moment dat de lezer uit het eigen leven kent (een gesprek, een werkdag, een avond thuis, een ruzie, een keuze), zodat die denkt "dat ben ik". Heeft de intake iets over dat thema, sluit dan aan bij wat de klant daar vertelt. Geen algemeenheden die op iedereen passen ("je bent soms onzeker", "je houdt van mensen"): benoem juist wat deze kaart onderscheidt, en hoe twee plaatsingen samen iets specifieks laten zien.
11. Gebruik de VERDIEPING als rode draad: de chartheerser, de eindheerser, waardigheden en aspectpatronen laten zien welke plaatsingen in deze kaart het zwaarst wegen. Geef die het meeste gewicht, laat ze in meerdere hoofdstukken terugkomen en leg verbanden ertussen, zodat het document als één verhaal over deze mens leest in plaats van een losse opsomming. Vertaal de techniek naar gewone taal (niet "je hebt een T-kruis", wel wat de lezer ervan merkt, met de techniek tussen haakjes). Progressies (hoe de kaart zich door de jaren ontwikkelt) en levenscycli gebruik je voor het nu: benoem ze bij het persoonlijk jaar en in de introductie of de integratie. Levenscycli schrijf je als leeftijd ("rond je 29e"), nooit als datum.

=== MASTERPROMPT v4 ===
""" + MASTERPROMPT

# Engelse Blueprint: dezelfde standaard en dezelfde opdrachten; alleen de taal van de tekst en de vaste frases wisselen.
# Sleutels (JSON-velden, planeetnamen als sleutel, aspectsleutels, element-ids) blijven Nederlands: daar rekent de pipeline op.
TAALREGEL_EN = ('1. Write in English (British spelling), second person singular (you/your). Plain text, no HTML, no markdown, no bullet points. '
    'The masterprompt, the FEITEN and the JSON keys are in Dutch: keep every JSON key, every aspect key (e.g. "Zon conjunct Maan") and the element '
    'identifiers (vuur, lucht, water, aarde) exactly as given, but write every value in natural English. Translate the terms: '
    + ', '.join(f'{k} = {v}' for k, v in GLOSSARIUM.items() if k[0].isupper() or k in ('vuur', 'lucht', 'aarde', 'sextiel', 'vierkant', 'driehoek', 'oppositie', 'hoofd', 'vast', 'veranderlijk', 'huis'))
    + ', Levenspad = Life Path, Persoonlijk Jaar = Personal Year, Geboortedag = Birth Day, Uitdrukking = Expression, Zielenurge = Soul Urge, Persoonlijkheid = Personality, '
    'Tikkun = Tikkun, Sin/Sinn/Zin = Sin/Sinn/Zin (keep). Forbidden in English: em-dashes, the words rare and unique, causal claims (explains why, proves that, '
    'is the reason that, ensures that), medical words (diagnosis, disease, disorder, illness), percentages, Hz, "permission slips", other company names. '
    'Quotation marks only for literal quotes from the intake (which is in English). Write SZINN in capitals.')
if LANG == 'en':
    _r1 = '1. Schrijf in het Nederlands, tweede persoon enkelvoud (jij/jouw). Gewone tekst, geen HTML, geen markdown, geen opsommingstekens.'
    assert _r1 in SYSTEEM
    SYSTEEM = SYSTEEM.replace(_r1, TAALREGEL_EN)

# Vaste frases in de opdrachten die letterlijk in het document komen (bouwscript en vormcontrole rekenen erop).
FRASES_EN = {
    '"Dit ben jij."': '"This is you."', '"Het recept: "': '"The recipe: "', '"Ik geef mezelf toestemming om"': '"I give myself permission to"',
    '"Ik ben {voornaam}"': '"I am {voornaam}"',
    '"De praktijken hieronder richten zich op waar de meeste beweging mogelijk is."': '"The practices below focus on where the most movement is possible."',
    '"Voor jou is dat nu vooral: ..."': '"For you, right now, that is mainly: ..."', 'Begin niet met "Geboortetijdnoot:"': 'Do not begin with "Birth time note:"',
    '"Persoonlijk Jaar N (JJJJ) en " (bv. "het jaar dat eraan komt")': '"Personal Year N (YYYY) and " (e.g. "the year that is coming")',
    'tag = kort label ("Je kern", "In je werk en je dag")': 'tag = short label ("Your core", "In your work and your day")',
    '("Huis N (Planeet · Planeet)")': '("House N (Planet · Planet)")', '("Planeet in Teken, huis N · Planeet aspect Planeet")': '("Planet in Sign, house N · Planet aspect Planet")',
    'zoals "Begin met bewegen"': 'such as "Start by moving"', '("Je kernidentiteit belichten")': '("Illuminating your core identity")',
    'één per element (vuur, lucht, water, aarde)': 'one per element (element = the Dutch identifier vuur, lucht, water or aarde)',
    'Ochtend, Werk & focus, Lichaam & ritme, Hart & verbinding, Avond & herstel, Seizoen': 'Morning, Work & focus, Body & rhythm, Heart & connection, Evening & recovery, Season',
    'Kernthema, Herhalingspatroon, Groei, Zielstaak': 'Core theme, Repeating pattern, Growth, Soul task',
    'Elementen, Kernidentiteit, Emotioneel kompas, Zielrichting, Levensthema, Naamgetallen, Tikkun, Schaduwthema': 'Elements, Core identity, Emotional compass, Soul direction, Life theme, Name numbers, Tikkun, Shadow theme',
    'Intuïtie, Verbeeldingskracht, Geheugen, Redeneren, Perceptie, Wilskracht': 'Intuition, Imagination, Memory, Reasoning, Perception, Willpower',
    'uitleg = "Voor [plaatsing]. [één korte zin]"': 'uitleg = "For [placement]. [one short sentence]"',
}
if LANG == 'en':
    for _k in FRASES_EN:
        assert any(_k in o for o in OPDRACHT.values()) or 'Geboortetijdnoot' in _k, _k


def feiten_tekst(f, intake):
    regels = [f"KLANT: {f['naam']} (voornaam {f['voornaam']}) · geboortenaam {f['geboortenaam']}",
              f"Geboren {f['geboortedatum']} om {f['geboortetijd']} in {f['geboorteplaats']} (UTC{f['tz']:+g}, {f['lat']}, {f['lon']}) · geboortetijd: {f['tijd_status']}",
              f"Opleveringsmaand: {f['oplevering']}", '', 'PLANETEN (tropisch, Placidus, ware knoop):']
    for n, p in f['planeten'].items():
        regels.append(f"  {n}: {p['graad']} {p['teken']}, huis {p['huis']}{' (retrograde)' if p['rx'] and n != 'Noordknoop' else ''}")
    ot = f['ondertoon']
    regels += [f"  Ascendant: {f['asc']['graad']} {f['asc']['teken']}", f"  Midhemel: {f['mc']['graad']} {f['mc']['teken']}",
               f"  Zuidknoop: {f['zuidknoop']['graad']} {f['zuidknoop']['teken']}, huis {f['zuidknoop']['huis']}", '',
               'ELEMENTEN (tien planeten): ' + ' · '.join(f"{k['element']} {k['aantal']} ({k['wie']})" for k in f['el_kaarten']),
               'MODALITEITEN: ' + ', '.join(f'{k} {v}' for k, v in f['modaliteiten'].items()),
               'PLANETEN PER HUIS: ' + ', '.join(f'huis {k}: {v}' for k, v in sorted(f['huizen_telling'].items(), key=lambda kv: int(kv[0]))),
               'RETROGRADE: ' + (', '.join(f['retrograde']) or 'geen'), '',
               'ASPECTTABEL (orb tot 5°, deze sleutels exact gebruiken):'] + [f"  {a['sleutel']} · orb {a['orb']}" for a in f['aspecten_tabel']]
    regels += ['ALLE ASPECTEN tot 6° (voor duiding):', '  ' + '; '.join(f['aspecten_alle']), '',
               'VERDIEPING (berekend; de rode draden van deze kaart):'] + [f'  {v}' for v in f.get('verdieping', [])] + ['',
               f"GEBOORTETIJD: Ascendant wisselt van teken over {f['asc_marge_min']} minuten. Gevoelige plaatsingen: {'; '.join(f['gevoelig']) or 'geen'}. "
               f"Wisselt van huis bij ±2 minuten: {', '.join(f['wankel']) or 'geen'}. Ascendant binnen 2° van een tekengrens: {'ja' if f['asc_grens'] else 'nee'}.", '',
               'NUMEROLOGIE (Pythagoras, Decoz):',
               f"  Levenspad {f['levenspad']} ({f['lp_stappen']})",
               '  Ondertoon: ' + (f"meestergetal {ot['getal']} ({ot['naam']}) via {ot['som']}" if ot else 'geen'),
               f"  Geboortedag {f['geboortedag']} ({f['gd_stappen']})",
               f"  Persoonlijk Jaar {f['pj_jaar']}: {f['pj']} ({f['pj_stappen']}) · Persoonlijk Jaar {f['pj2_jaar']}: {f['pj2']} ({f['pj2_stappen']})"]
    regels += [f"  {w.capitalize()} {v['getal']} ({v['stappen']})" for w, v in f['naamgetallen'].items()]
    g = f['groei']
    regels += [f"  Groeigetallen · samengesteld vóór de laatste stap: {g['samengesteld']} · returning numbers: {g['returning'] or 'geen'}",
               f"  Keynote: {g['keynote']} ({g['keynote_count']} letters: {g['letters']}) · untrained muscles: {g['missing'] or 'geen'} · telling per cijfer: {g['counts']}", '',
               'KALENDER (persoonlijke maanden en de transits/lunaties uit transits.py):']
    for m in f['maanden']:
        regels.append(f"  {m['naam']}: persoonlijke maand {m['pm']} (Persoonlijk Jaar {m['pj']}{', nieuw jaar' if m['nieuw_pj'] else ''})")
        regels += [f'    transit: {t}' for t in m['transits']] + [f'    maanfase: {t}' for t in m['maanfasen']]
        if not m['transits'] and not m['maanfasen']:
            regels.append('    (geen transits of lunaties in de uitvoer)')
    if LANG == 'en':   # termen vertalen; de aspectsleutels (identifiers) blijven letterlijk staan
        regels = [r if r.startswith('  ') and ' · orb ' in r else nm(r) for r in regels]
    regels += ['', '=== INTAKE (letterlijk, de enige bron voor levensfeiten en citaten) ===',
               intake or '(geen intake ingevuld: schrijf alles vanuit kaart en getallen, zonder citaten of levensfeiten)']
    return '\n'.join(regels)


def opdracht(groep, f):
    tijdnoot = ('VERPLICHT. 2 à 4 zinnen die de gevoelige plaatsing(en) uit GEBOORTETIJD benoemen en beide lezingen noemen'
                + (' en vermelden dat de geboortetijd bij benadering is opgegeven' if f['tijd_status'] == 'benadering' else '')
                + '. Begin niet met "Geboortetijdnoot:".') if f['tijdnoot_nodig'] else 'lege string "" (niet nodig voor deze kaart).'
    ot = f['ondertoon']
    ondertoon = (f'een zinsdeel (geen hele zin, geen hoofdletter) dat aanvult wat meestergetal {ot["getal"]} ({ot["naam"]}) als ondertoon betekent'
                 if ot else 'lege string "" (geen ondertoon).')
    tekst = OPDRACHT[groep].format(voornaam=f['voornaam'], tijdnoot=tijdnoot, ondertoon=ondertoon)
    if LANG == 'en':
        for k, v in FRASES_EN.items():
            tekst = tekst.replace(k.replace('{voornaam}', f['voornaam']), v.replace('{voornaam}', f['voornaam']))
    return tekst


def _call(client, groep, f, feiten, vorige=None, correcties=None, effort='high'):
    msgs = [{'role': 'user', 'content': [{'type': 'text', 'text': feiten, 'cache_control': {'type': 'ephemeral'}},
                                         {'type': 'text', 'text': opdracht(groep, f)}]}]
    if vorige is not None:
        msgs += [{'role': 'assistant', 'content': json.dumps(vorige, ensure_ascii=False)},
                 {'role': 'user', 'content': 'De controle vond deze problemen in jouw tekst:\n- ' + '\n- '.join(correcties)
                  + '\nSchrijf de volledige JSON van deze groep opnieuw met alle correcties. Herschrijf de betreffende zinnen vanuit de feiten en de intake (niet alleen een woord vervangen) en laat de rest zo goed mogelijk staan.'}]
    with client.beta.messages.stream(
        model=MODEL, max_tokens=64000,
        system=[{'type': 'text', 'text': SYSTEEM, 'cache_control': {'type': 'ephemeral'}}],
        messages=msgs,
        output_config={'effort': effort, 'format': {'type': 'json_schema', 'schema': schema(groep, f)}},
        betas=['server-side-fallback-2026-07-01'], extra_body={'fallbacks': 'default'},
    ) as stream:
        msg = stream.get_final_message()
    if msg.stop_reason == 'refusal':
        raise RuntimeError(f'schrijflaag groep {groep}: geweigerd ({getattr(msg, "stop_details", None)})')
    if msg.stop_reason == 'max_tokens':
        # Het denkwerk telt mee in de 64k; een lange groep (D, lange intake) kan daar overheen.
        # Eén keer opnieuw met minder denkruimte in plaats van de hele order laten falen.
        if effort == 'high':
            print(f'schrijflaag groep {groep}: afgekapt (max_tokens), opnieuw met effort medium', flush=True)
            return _call(client, groep, f, feiten, vorige, correcties, effort='medium')
        raise RuntimeError(f'schrijflaag groep {groep}: afgekapt (max_tokens)')
    return json.loads(''.join(b.text for b in msg.content if b.type == 'text')), msg.usage


GROEPEN = ('A', 'B', 'C', 'D')


def schrijf(f, intake, groepen=GROEPEN, vorige=None, correcties=None, log=print):
    """Schrijft (of herschrijft) de gevraagde groepen parallel. vorige/correcties: {groep: json} / {groep: [problemen]}."""
    client = anthropic.Anthropic(api_key=os.environ.get('ANTHROPIC_API_KEY') or os.environ.get('CLAUDE_API_KEY'))
    feiten = feiten_tekst(f, intake)
    out = {}
    with ThreadPoolExecutor(len(groepen)) as ex:
        futs = {g: ex.submit(_call, client, g, f, feiten, (vorige or {}).get(g), (correcties or {}).get(g)) for g in groepen}
        for g, fu in futs.items():
            out[g], usage = fu.result()
            log(f'schrijflaag {g}: in {usage.input_tokens} (cache {usage.cache_read_input_tokens}) · uit {usage.output_tokens}')
    return out


# ---------- eigen vormcontrole vóór het bouwen (aantallen en vaste vormen) ----------
AANTAL = {'A': [('elementen.kaarten', 4), ('elementen.verdeling', 3), ('karakter', 6), ('valkuilen', 6), ('talenten', 6), ('introductie', 3)],
          'B': [('patronen', 3), ('patroonkaarten', 2), ('knopen', 2), ('tikkun', 4), ('overzicht.rijen', 8)],
          'C': [('num.lp', 2), ('num.pj', 2), ('flow.alineas', 4), ('flow.kaarten', 3), ('flow.vragen', 5), ('reflectie', 10)],
          'D': [('ritme.kaarten', 6), ('integratie.gaven', 6), ('integratie.praktijken', 7), ('integratie.prompts', 6),
                ('integratie.maanden', 6), ('permissions', 8), ('tot_slot', 2)]}


def _pad(d, pad):
    for k in pad.split('.'):
        d = d[k]
    return d


VAKTAAL = re.compile(r'\b(manifestatie\w*|polariteit\w*|archetypisch\w*|transformatie[fv]\w*|resoner\w*|integreer\w*|integreren|paradigma\w*|essentie|katalysator\w*)\b', re.I)
if LANG == 'en':
    VAKTAAL = re.compile(r'\b(manifestation\w*|polarit\w*|archetyp\w*|transformative\w*|resonat\w*|integrat(e|es|ed|ing)|paradigm\w*|essence|catalyst\w*)\b', re.I)
PERMISSIE = 'I give myself permission' if LANG == 'en' else 'Ik geef mezelf toestemming'
RITME_LABELS = ({'morning', 'work & focus', 'body & rhythm', 'heart & connection', 'evening & recovery', 'season'} if LANG == 'en'
                else {'ochtend', 'werk & focus', 'lichaam & ritme', 'hart & verbinding', 'avond & herstel', 'seizoen'})
MAX_ZIN = 30   # woorden, bron tussen haakjes niet meegeteld; regel 9 vraagt gemiddeld 15


def _teksten(d, pad=''):
    if isinstance(d, str):
        yield pad, d
    elif isinstance(d, dict):
        for k, v in d.items():
            if k not in ('prompts', 'mail'):   # AI-prompts en mail mogen langer
                yield from _teksten(v, f'{pad}.{k}'.lstrip('.'))
    elif isinstance(d, list):
        for i, v in enumerate(d):
            yield from _teksten(v, f'{pad}[{i}]')


def leesbaarheid(c):
    """B1-controle (regel 9): vaktaal en te lange zinnen, met de vindplaats erbij."""
    p = []
    for pad, t in _teksten(c):
        p += [f'{pad}: vaktaal "{w}"; zeg het in gewone woorden' for w in dict.fromkeys(m.group(0) for m in VAKTAAL.finditer(t))]
        for zin in re.split(r'(?<=[.!?])\s+', re.sub(r'\([^)]*\)', '', t)):
            n = len(re.findall(r"[\wà-ÿ']+", zin))
            if n > MAX_ZIN:
                p.append(f'{pad}: zin van {n} woorden ("{zin[:60]}…"); knip op in zinnen van hooguit 22 woorden')
    return p[:8]


def _ontdaan(d):
    if isinstance(d, str):
        return re.sub(r'["“”]', '', d)
    if isinstance(d, dict):
        return {k: _ontdaan(v) for k, v in d.items()}
    if isinstance(d, list):
        return [_ontdaan(v) for v in d]
    return d


def zonder_aanhalingstekens(groepen):
    """Citaten horen alleen in groep D: in A-C halen we de tekens zelf weg i.p.v. een dure herschrijfronde."""
    for g in ('A', 'B', 'C'):
        if g in groepen:
            groepen[g] = _ontdaan(groepen[g])


def vormcontrole(groepen, f, leesbaar=True):
    """Geeft {groep: [problemen]} terug; leeg = in orde. leesbaar=False slaat de B1-controle over (mag oplevering niet blokkeren)."""
    fouten = {}
    for g, c in groepen.items():
        p = [f'{pad}: {len(_pad(c, pad))} in plaats van precies {n}' for pad, n in AANTAL[g] if len(_pad(c, pad)) != n]
        tekst = json.dumps(c, ensure_ascii=False)
        if '—' in tekst:
            p.append('em-dash (—) gebruikt; herschrijf die zinnen zonder em-dash')
        if leesbaar:
            p += leesbaarheid(c)
        if g in ('A', 'B', 'C'):
            cit = re.findall(r'(?:\\"|[“”])([^"“”\\]{6,200})(?:\\"|[“”])', tekst)
            if cit:
                p.append(f'aanhalingstekens in groep {g} ("{cit[0][:60]}"): citaten horen alleen in groep D; herschrijf zonder aanhalingstekens')
        if g == 'A' and sorted(k['element'] for k in c['elementen']['kaarten']) != ['aarde', 'lucht', 'vuur', 'water']:
            p.append('elementen.kaarten: elk element precies één keer')
        if g == 'A' and c['introductie'] and not c['introductie'][0].startswith(f['voornaam'] + ','):
            p.append(f'introductie[0] moet beginnen met "{f["voornaam"]}, "')
        if g == 'D' and c['tot_slot'] and not c['tot_slot'][0].startswith(f['voornaam'] + ','):
            p.append(f'tot_slot[0] moet beginnen met "{f["voornaam"]}, "')
        if g == 'D':
            if any(x['titel'].strip().lower() in RITME_LABELS for x in c['ritme']['kaarten']):
                p.append('ritme.kaarten: titel is een eigen korte kop (bv. "Begin met bewegen"), niet het label zelf (Ochtend, Seizoen, ...)')
        if g == 'B':
            if [a['aspect'] for a in c['aspecten']] != [a['sleutel'] for a in f['aspecten_tabel']]:
                p.append('aspecten: precies één regel per aspect uit de aspecttabel, in dezelfde volgorde')
            if not c['overzicht']['een_zin'].startswith(f['voornaam']):
                p.append(f'overzicht.een_zin moet beginnen met "{f["voornaam"]}"')
            if f['tijdnoot_nodig'] and not c['geboortetijdnoot'].strip():
                p.append('geboortetijdnoot is verplicht voor deze kaart')
        if g == 'D':
            p += [f'permissions[{i}] moet beginnen met "{PERMISSIE}"'
                  for i, x in enumerate(c['permissions']) if not x['tekst'].startswith(PERMISSIE)]
        if p:
            fouten[g] = p
    return fouten

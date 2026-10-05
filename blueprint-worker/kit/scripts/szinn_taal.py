# -*- coding: utf-8 -*-
"""SZINN · taal van de Blueprint. Alle interne sleutels (planeten, tekens, aspecten, elementen, JSON-velden) blijven
Nederlands; alleen wat de lezer ziet wisselt. BLUEPRINT_LANG=en zet de Engelse versie aan (worker.py zet die env
vanuit order.blueprint_language). t() vertaalt vaste labels/zinnen van het bouwscript, nm() vertaalt de astrologische
en numerologische termen in berekende tekst (datalaag, tabellen, legenda)."""
import os, re

LANG = 'en' if os.environ.get('BLUEPRINT_LANG', 'nl').lower().startswith('en') else 'nl'

MAANDEN = {'nl': ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'],
           'en': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']}

# ---------- termen in berekende tekst (woordgrens, hoofdletter van het origineel blijft) ----------
GLOSSARIUM = {
    'Ram': 'Aries', 'Stier': 'Taurus', 'Tweelingen': 'Gemini', 'Kreeft': 'Cancer', 'Leeuw': 'Leo', 'Maagd': 'Virgo',
    'Weegschaal': 'Libra', 'Schorpioen': 'Scorpio', 'Boogschutter': 'Sagittarius', 'Steenbok': 'Capricorn', 'Waterman': 'Aquarius', 'Vissen': 'Pisces',
    'Zon': 'Sun', 'Maan': 'Moon', 'Mercurius': 'Mercury', 'Saturnus': 'Saturn', 'Neptunus': 'Neptune',
    'Noordknoop': 'North Node', 'Zuidknoop': 'South Node', 'Midhemel': 'Midheaven', 'Knopen-as': 'Nodal axis',
    'vuur': 'fire', 'lucht': 'air', 'aarde': 'earth',
    'sextiel': 'sextile', 'vierkant': 'square', 'driehoek': 'trine', 'oppositie': 'opposition',
    'hoofdtekens': 'cardinal signs', 'vaste tekens': 'fixed signs', 'veranderlijke tekens': 'mutable signs',
    'hoofd': 'cardinal', 'vast': 'fixed', 'veranderlijk': 'mutable',
    'huizen': 'houses', 'huis': 'house', 'natale': 'natal', 'Nieuwe maan': 'New Moon', 'Volle maan': 'Full Moon',
    'nieuw jaar': 'new year', 'persoonlijke maand': 'personal month', 'Persoonlijk Jaar': 'Personal Year', 'maanfase': 'moon phase',
    'Geen van de tien planeten': 'None of the ten planets', 'en': 'and', 'geen': 'none',
    'de ziener': 'the seer', 'de meesterbouwer': 'the master builder', 'de meesterleraar': 'the master teacher',
    'Over de tien planeten gerekend krijg je deze verhouding': 'Counted across the ten planets, this is your ratio',
    'staan in': 'are in', 'staat in': 'is in', 'staat': 'is',
    'nul': 'zero', 'één': 'one', 'twee': 'two', 'drie': 'three', 'vier': 'four', 'vijf': 'five', 'zes': 'six', 'zeven': 'seven', 'acht': 'eight', 'negen': 'nine', 'tien': 'ten',
    'vóór de grens van': 'before the boundary of', 'na het begin van': 'after the start of', 'anders': 'otherwise', 'nu': 'now',
    'Geprogresseerde': 'Progressed', 'Levenscyclus': 'Life cycle', 'Chartheerser': 'Chart ruler', 'eindheerser': 'final dispositor',
    'Waardigheid': 'Dignity', 'Heerschap': 'Rulership', 'Aspectpatroon': 'Aspect pattern', 'Halfronden': 'Hemispheres',
    'Maanfase bij geboorte': 'Moon phase at birth', 'Progressie': 'Progression', 'in eigen teken': 'in its own sign',
    'grote driehoek': 'grand trine', 'T-kruis': 'T-square', 'stellium in': 'stellium in', 'wederzijdse receptie': 'mutual reception',
    'retrograde': 'retrograde', 'exact': 'exact', 'transit': 'transit', 'orb': 'orb',
}
for _m_nl, _m_en in zip(MAANDEN['nl'], MAANDEN['en']):
    GLOSSARIUM[_m_nl] = _m_en
_RX = re.compile(r'(?<![\w-])(' + '|'.join(re.escape(k) for k in sorted(GLOSSARIUM, key=len, reverse=True)) + r')(?![\w-])', re.I)
_LOW = {k.lower(): v for k, v in GLOSSARIUM.items()}


def nm(s):
    """Vertaal de vaste termen in een (berekende) tekst; in het Nederlands ongewijzigd."""
    if LANG != 'en' or not isinstance(s, str):
        return s
    def rep(m):
        w = m.group(1); v = _LOW[w.lower()]
        return v[0].upper() + v[1:] if w[0].isupper() and not v[0].isupper() else v
    return _RX.sub(rep, s)


def nm_deep(x, hou=('sleutel', 'element', 'naam', 'voornaam', 'geboortenaam', 'geboorteplaats', 'stappen', 'som', 'lp_stappen', 'gd_stappen', 'pj_stappen', 'pj2_stappen')):
    """nm() over alle tekst in een datastructuur; sleutels en identificerende velden blijven staan."""
    if isinstance(x, dict):
        return {k: (v if k in hou else nm_deep(v, hou)) for k, v in x.items()}
    if isinstance(x, list):
        return [nm_deep(v, hou) for v in x]
    return nm(x)


# ---------- vaste labels en zinnen van bouwscript, boek en audit ----------
L = {
 # cover, quote, inhoud
 'Levenspad': 'Life Path', 'Geboortedag': 'Birth Day', 'Persoonlijk Jaar': 'Personal Year', 'Gefaciliteerd door': 'Facilitated by',
 'Voor {naam}': 'For {naam}', 'Dit ben jij.': 'This is you.', 'Deze Blueprint is je spiegel daarbij.': 'This Blueprint is your mirror along the way.',
 'Inhoud': 'Contents', 'Wat je in dit document vindt': 'What you will find in this document',
 'Voordat je begint': 'Before you begin', 'Visie &amp; Missie': 'Vision &amp; Mission',
 'Deel I · Herkenning · Wie ben ik?': 'Part I · Recognition · Who am I?', 'De elementen: het recept': 'The elements: the recipe',
 'Karakter: wie je bent in balans': 'Character: who you are in balance', 'Valkuilen: uit balans': 'Pitfalls: out of balance',
 'Talenten: wat je meebrengt': 'Talents: what you bring', 'Introductie': 'Introduction',
 'Deel II · Helderheid · Wat wil ik? Waar komt het vandaan?': 'Part II · Clarity · What do I want? Where does it come from?',
 'Astrologie': 'Astrology', 'Noord- &amp; Zuidknoop': 'North &amp; South Node', 'Numerologie': 'Numerology', 'Kabbalah / Tikkun': 'Kabbalah / Tikkun',
 'Sacred Geometry · De Mandala': 'Sacred Geometry · The Mandala', 'Overzicht &amp; Samenvatting': 'Overview &amp; Summary',
 'Deel III · Integratie · Waar ga ik heen? Hoe leef ik dit?': 'Part III · Integration · Where am I going? How do I live this?',
 'Leven vanuit flow': 'Living from flow', 'Reflectievragen': 'Reflection questions', 'Werken met de energie': 'Working with the energy',
 'Integratie': 'Integration', 'Schaduwkanten + ankers': 'Shadow sides + anchors', 'De zes gaven': 'The six gifts',
 'Daily Practices (7)': 'Daily Practices (7)', 'AI-prompts (6)': 'AI prompts (6)', 'Persoonlijke kalender · 6 maanden': 'Personal calendar · 6 months',
 'Inner Permissions': 'Inner Permissions', 'Verdieping': 'Going deeper',
 # 01 en deel I
 '01 — Visie &amp; Missie': '01 — Vision &amp; Mission', 'Jij bent <em>de blauwdruk.</em>': 'You are <em>the blueprint.</em>',
 'Deel I · Wie ben ik?': 'Part I · Who am I?', 'Herkenning': 'Recognition',
 'Het moment dat je een patroon ziet, niet als iets wat je overkomt maar als iets wat je draait. Dit deel begint bij de vier elementen en bij wie jij bent als je gewoon jezelf bent: in balans, uit balans, en wat je meebrengt. Daarna volgt de persoonlijke introductie. Alles wat hier staat is een spiegel, geen oordeel. Wat resoneert, neem je mee. Wat niet klopt, laat je los.':
 'The moment you see a pattern, not as something that happens to you but as something you are running. This part begins with the four elements and with who you are when you are simply yourself: in balance, out of balance, and what you bring. Then follows the personal introduction. Everything here is a mirror, not a judgment. What resonates, take with you. What does not fit, let go.',
 'Herkenning · De elementen': 'Recognition · The elements', 'Het recept: ': 'The recipe: ', 'Wat de verdeling zegt': 'What the distribution says',
 'De kern van je elementen': 'The core of your elements', 'Ascendant': 'Ascendant', 'Knopen-as': 'Nodal axis',
 'Zuidknoop {zk} (huis {zh}) naar Noordknoop {nk} (huis {nh})': 'South Node {zk} (house {zh}) to North Node {nk} (house {nh})',
 'Herkenning · Karakter': 'Recognition · Character', 'Wie je bent als je in balans bent': 'Who you are when you are in balance',
 'Deze lezing werkt met drie lagen: wie je bent als je in balans bent, wat er gebeurt als je uit balans raakt, en wat je meebrengt dat de wereld nodig heeft. Dit is de eerste laag.':
 'This reading works with three layers: who you are when you are in balance, what happens when you lose your balance, and what you bring that the world needs. This is the first layer.',
 'Herkenning · Valkuilen': 'Recognition · Pitfalls', 'Wat er gebeurt als je uit balans raakt': 'What happens when you lose your balance',
 'Hier wordt het direct, maar nooit hard. Een valkuil is een talent dat te lang aan heeft gestaan.': 'Here it gets direct, but never harsh. A pitfall is a talent that has been switched on for too long.',
 'De kern van je valkuilen': 'The core of your pitfalls', 'Je gave is je richting': 'Your gift is your direction', 'Noordknoop in {teken}, huis {huis}': 'North Node in {teken}, house {huis}',
 'Herkenning · Talenten': 'Recognition · Talents', 'Wat je meebrengt dat de wereld nodig heeft': 'What you bring that the world needs',
 'Hier eindigt elke goede lezing, omdat je ziel dit niet voor niets heeft gekozen.': 'This is where every good reading ends, because your soul did not choose this for nothing.',
 '02 — Introductie': '02 — Introduction', 'Een nieuw paradigma van zelfherkenning.': 'A new paradigm of self-recognition.',
 'INTRO_02': """
<p>This SZINN Alignment Blueprint is not a truth. It is a mirror, a reflection. What resonates, take it with you. What does not fit, let it go. Consider nothing here as absolute truth. Go and explore for yourself. You are always the only expert on yourself.</p>
<p>Most people get to know themselves through how others see them. Through their role in a family, a job, a friendship. Through what is expected of them. SZINN assumes there is a deeper self, not shaped by circumstances but simply present. And that this deeper self has a signature, visible in the moments and patterns of your life, if you know where to look.</p>
""",
 'NOTE_02': """
<div class="note"><p>Do not read this section as a judgment. Read it as an invitation to look at yourself with a little more curiosity than usual. What resonates, take it with you. What does not fit, let it go.</p></div>
""",
 # deel II
 'Deel II · Wat wil ik? Waar komt het vandaan?': 'Part II · What do I want? Where does it come from?', 'Helderheid': 'Clarity',
 'Niet de helderheid van alle antwoorden weten, maar de helderheid van weten wie je bent. Hier staat de techniek: je geboortekaart met de berekeningen, je knopen, je getallen, je zielstaak en je mandala. Alles wat je in deel I hebt herkend, komt hier vandaan. Lees het niet in één keer. Eén sectie tegelijk is genoeg.':
 'Not the clarity of knowing all the answers, but the clarity of knowing who you are. Here is the technique: your birth chart with the calculations, your nodes, your numbers, your soul task and your mandala. Everything you recognised in part I comes from here. Do not read it in one go. One section at a time is enough.',
 '04 — Astrologie': '04 — Astrology', 'De <em>geboortekaart</em> van {naam}': 'The <em>birth chart</em> of {naam}',
 'Placidus huizensysteem · Swiss Ephemeris · Ware knoop · Berekend vanuit {datum}, {tijd}, {plaats} ({tz}) · Boogminuten afgekapt':
 'Placidus house system · Swiss Ephemeris · True Node · Calculated from {datum}, {tijd}, {plaats} ({tz}) · Arc minutes truncated',
 'De twaalf huizen': 'The twelve houses', 'Planeet': 'Planet', 'Positie': 'Position', 'Huis': 'House', 'Kwaliteit': 'Quality',
 '{teken} in huis {huis}': '{teken} in house {huis}', ', retrograde': ', retrograde', 'AC Ascendant': 'AC Ascendant', 'MC Midhemel': 'MC Midheaven',
 'Aspect': 'Aspect', 'Orb': 'Orb', 'Wat het in gesprek brengt': 'What it brings into the conversation',
 'Aspecten in jouw kaart (orb tot 5°, de nauwste eerst)': 'Aspects in your chart (orb up to 5°, the tightest first)',
 'Opvallende patronen in jouw kaart': 'Notable patterns in your chart', 'Geboortetijdnoot: ': 'Birth time note: ',
 '05 — Noord- &amp; Zuidknoop': '05 — North &amp; South Node', 'Van <em>{zk}</em> naar {nk}': 'From <em>{zk}</em> to {nk}',
 'Zuidknoop · oorsprong': 'South Node · origin', 'Noordknoop · groeirichting': 'North Node · direction of growth', ' · Huis ': ' · House ',
 'Chiron in {teken} in huis {huis}': 'Chiron in {teken} in house {huis}',
 'Deel II · Helderheid': 'Part II · Clarity', 'Getallen liegen niet. Ze spiegelen.': 'Numbers do not lie. They mirror.',
 # 06
 'Persoonlijk Jaar {jaar}': 'Personal Year {jaar}',
 'Onder je {lp} klinkt een {getal}. Wie alle cijfers van je geboortedatum in één keer optelt ({som}), vindt het meestergetal van {naam}: {tekst}, als ondertoon onder je Levenspad.':
 'Beneath your {lp} sounds a {getal}. Adding up all the digits of your birth date in one go ({som}) gives the master number of {naam}: {tekst}, as an undertone beneath your Life Path.',
 'Klinkers · ': 'Vowels · ', 'Medeklinkers · ': 'Consonants · ', 'Uitdrukking': 'Expression', 'Zielenurge': "Soul Urge", 'Persoonlijkheid': 'Personality',
 ' en ': ' and ', ' · in je ': ' · in your ', 'Geen': 'None', 'Returning numbers': 'Returning numbers', 'Vóór de laatste stap: ': 'Before the last step: ',
 'Jouw keynote': 'Your keynote', 'Untrained muscles': 'Untrained muscles', 'Wat dit voor jou betekent': 'What this means for you',
 '06 — Numerologie': '06 — Numerology', 'De <em>getallen</em> van {naam}': 'The <em>numbers</em> of {naam}',
 'Pythagorisch systeem · Berekend vanuit {datum} en de geboortenaam {naam} · Meestergetallen niet gereduceerd':
 'Pythagorean system · Calculated from {datum} and the birth name {naam} · Master numbers not reduced',
 'De drie naamgetallen': 'The three name numbers', 'Levenspad {lp} · {titel}': 'Life Path {lp} · {titel}',
 'Persoonlijk Jaar {pj} ({jaar}) en {kop}': 'Personal Year {pj} ({jaar}) and {kop}', 'De cyclus van dit half jaar': 'The cycle of these six months',
 # 07-09
 'Kernthema': 'Core theme', 'Herhalingspatroon': 'Repeating pattern', 'Groei': 'Growth', 'Zielstaak': 'Soul task',
 '07 — Kabbalah &amp; Tikkun': '07 — Kabbalah &amp; Tikkun', 'De <em>zielstaak</em> van {naam}': 'The <em>soul task</em> of {naam}',
 'Retrograde planeten: innerlijke verwerking': 'Retrograde planets: inner processing',
 '08 — Sacred Geometry': '08 — Sacred Geometry', 'De <em>Mandala</em> van {naam}': 'The <em>Mandala</em> of {naam}',
 'Jouw volledige geboortekaart, gegenereerd vanuit jouw exacte geboortedata, met de planeten op hun precieze ecliptische graden. In het hart staat de Merkaba op de knopen-as: het gouden punt reikt naar jouw Noordknoop in {nk} ({nkg}), het amethist naar jouw Zuidknoop in {zk}.':
 'Your complete birth chart, generated from your exact birth data, with the planets at their precise ecliptic degrees. At the heart sits the Merkaba on the nodal axis: the golden point reaches towards your North Node in {nk} ({nkg}), the amethyst towards your South Node in {zk}.',
 "Ascendant links, tekens tegen de klok in · Flower of Life en Metatron's Cube in de binnencirkel · Merkaba op de ware knoop":
 "Ascendant on the left, signs anticlockwise · Flower of Life and Metatron's Cube in the inner circle · Merkaba on the true node",
 'Een <em>frequentie</em> om te herkennen': 'A <em>frequency</em> to recognise',
 'Elementen': 'Elements', 'Kernidentiteit': 'Core identity', 'Emotioneel kompas': 'Emotional compass', 'Zielrichting': 'Soul direction',
 'Levensthema': 'Life theme', 'Naamgetallen': 'Name numbers', 'Tikkun': 'Tikkun', 'Schaduwthema': 'Shadow theme',
 '09 — Overzicht &amp; Samenvatting': '09 — Overview &amp; Summary', '{naam} in <em>één zin</em>': '{naam} in <em>one sentence</em>',
 # deel III
 'Deel III · Waar ga ik heen? Hoe leef ik dit?': 'Part III · Where am I going? How do I live this?',
 'Het sluitstuk en tegelijk het moeilijkste. Kennis is niet genoeg. Hier staat hoe je dit leeft: je flow, je reflectievragen, je ritme, je praktijken, je prompts, je kalender en de toestemming die je jezelf mag geven. Concreet, dagelijks, in jouw eigen tempo.':
 'The final piece and at the same time the hardest. Knowledge is not enough. Here is how you live this: your flow, your reflection questions, your rhythm, your practices, your prompts, your calendar and the permission you may give yourself. Concrete, daily, at your own pace.',
 '03 — Leven vanuit flow': '03 — Living from flow', 'Sin · masculien': 'Sin · masculine', 'Sinn · feminien': 'Sinn · feminine', 'Zin · creatie': 'Zin · creation',
 'Vijf reflectievragen over jouw flow': 'Five reflection questions about your flow',
 '10 — Reflectievragen': '10 — Reflection questions', '10 journaling-vragen': '10 journaling questions',
 '11 — Werken met de energie': '11 — Working with the energy', 'Jouw <em>ritme</em>': 'Your <em>rhythm</em>',
 'Jouw dagelijkse en seizoensritme op basis van jouw kaart.': 'Your daily and seasonal rhythm based on your chart.',
 'Ochtend': 'Morning', 'Werk &amp; focus': 'Work &amp; focus', 'Lichaam &amp; ritme': 'Body &amp; rhythm', 'Hart &amp; verbinding': 'Heart &amp; connection',
 'Avond &amp; herstel': 'Evening &amp; recovery', 'Seizoen': 'Season',
 'Gave 0': 'Gift 0', 'Intuïtie': 'Intuition', 'Verbeeldingskracht': 'Imagination', 'Geheugen': 'Memory', 'Redeneren': 'Reasoning', 'Perceptie': 'Perception', 'Wilskracht': 'Willpower',
 'Praktijk 0': 'Practice 0', 'Prompt 0': 'Prompt 0', 'Schaduwwerk': 'Shadow work', 'Kopieer': 'Copy',
 'Persoonlijke maand {pm}': 'Personal month {pm}', ' · nieuw Persoonlijk Jaar {pj}': ' · new Personal Year {pj}', 'Transits': 'Transits',
 'Je persoonlijke maandgetallen zijn berekend vanuit Persoonlijk Jaar {pj}': 'Your personal month numbers are calculated from Personal Year {pj}',
 ', en vanaf januari vanuit Persoonlijk Jaar {pj}': ', and from January from Personal Year {pj}',
 '12 — Integratie': '12 — Integration', 'Jouw persoonlijke <em>upgrade-plan</em>': 'Your personal <em>upgrade plan</em>',
 'Jouw vier lagen op dit moment': 'Your four layers right now', 'Jouw schaduwkanten zijn niet je vijanden': 'Your shadow sides are not your enemies',
 'Hoe jouw zes gaven oplichten in je kaart': 'How your six gifts light up in your chart', 'De adem als sleutel': 'The breath as the key',
 'Dagelijkse praktijken': 'Daily practices', 'Persoonlijke kalender · {m0} tot {m5}': 'Personal calendar · {m0} to {m5}',
 ' Elke maand draagt een eigen kleur van energie, en onder elke maand staan de transits die in die maand precies op jouw kaart vallen. Hoe bewuster je dit ritme volgt, hoe meer je meebeweegt met de stroom van je jaar.':
 ' Each month carries its own colour of energy, and beneath each month are the transits that fall exactly on your chart in that month. The more consciously you follow this rhythm, the more you move with the flow of your year.',
 'Vuur': 'Fire', 'Lucht': 'Air', 'Aarde': 'Earth', 'Water': 'Water', 'Handtekening': 'Signature', 'Datum': 'Date',
 'Integratie · Inner Permissions': 'Integration · Inner Permissions', 'De toestemming die je jezelf mag geven': 'The permission you may give yourself',
 'Inner Permissions zijn briefjes waarop staat wat je jezelf mag toestaan, omdat niemand anders die toestemming gaat geven. Lees ze hardop. Onderteken degene die het meest schuurt.':
 'Inner Permissions are notes that say what you may allow yourself, because nobody else is going to give that permission. Read them out loud. Sign the one that chafes the most.',
 'De zin om mee te nemen': 'The sentence to take with you',
 # 13 en achterkant
 '13 — Verdieping': '13 — Going deeper', 'Waar ga je <em>vanaf hier</em> naartoe?': 'Where do you go <em>from here</em>?', 'Tot slot': 'In closing',
 'juist nu je in een jaar van oogst staat': 'especially now that you are in a year of harvest', 'juist nu je in een jaar van {thema} staat': 'especially now that you are in a year of {thema}',
 'nieuw begin': 'new beginnings', 'samenwerking': 'cooperation', 'expressie': 'expression', 'opbouw': 'building', 'verandering': 'change',
 'zorg en thuis': 'care and home', 'inkeer': 'reflection', 'oogst': 'harvest', 'afronding': 'completion', 'inzicht': 'insight', 'bouwen': 'building', 'dienstbaarheid': 'service',
 'Gegenereerd': 'Generated', 'ZN': 'SN', 'Persoonlijke kalender': 'Personal calendar',
 'Dit document is persoonlijk en vertrouwelijk. De SZINN-methodologie en de opbouw van dit document zijn beschermd; niets uit dit document mag worden verveelvoudigd zonder de uitdrukkelijke schriftelijke toestemming van Alterego BV.':
 'This document is personal and confidential. The SZINN methodology and the structure of this document are protected; nothing from this document may be reproduced without the express written permission of Alterego BV.',
 # boek
 'Jouw persoonlijke Alignment Blueprint': 'Your personal Alignment Blueprint', 'binnenwerk': 'inside pages', 'omslag': 'cover',
 '"Als genoeg mensen herinneren wie ze zijn, verandert de wereld om ons heen vanzelf."': '"If enough people remember who they are, the world around us changes by itself."',
 'Een persoonlijke Alignment Blueprint: jouw geboortekaart, jouw getallen en jouw zielstaak, samengebracht in één spiegel. Geen voorspelling en geen oordeel, maar een uitnodiging om te herinneren wie je bent.':
 'A personal Alignment Blueprint: your birth chart, your numbers and your soul task, brought together in one mirror. Not a prediction and not a judgment, but an invitation to remember who you are.',
}


def t(s, **kw):
    """Vast label of vaste zin van het bouwscript in de taal van de Blueprint; {velden} worden ingevuld."""
    v = L.get(s, s) if LANG == 'en' else s
    return v.format(**kw) if kw else v


if __name__ == '__main__':
    import sys
    assert t('Levenspad') == ('Life Path' if LANG == 'en' else 'Levenspad')
    if LANG == 'en':
        assert nm('Zon conjunct Maan') == 'Sun conjunct Moon'
        assert nm('Venus in Weegschaal, huis 4') == 'Venus in Libra, house 4'
        assert nm('25 oktober 1973') == '25 October 1973' and nm('Oktober 2026') == 'October 2026'
        assert nm('Vijf staan in vaste tekens, drie in veranderlijke tekens en twee in hoofdtekens.') == 'Five are in fixed signs, three in mutable signs and two in cardinal signs.'
        assert nm('Zon en Maan in Kreeft, huis 4 · Mars in Ram') == 'Sun and Moon in Cancer, house 4 · Mars in Aries'
        assert nm_deep({'sleutel': 'Zon conjunct Maan', 'teken': 'Kreeft'}) == {'sleutel': 'Zon conjunct Maan', 'teken': 'Cancer'}
        assert nm('Noordknoop') == 'North Node' and nm('Water') == 'Water' and nm('Mars') == 'Mars'
    print('szinn_taal ok', LANG)

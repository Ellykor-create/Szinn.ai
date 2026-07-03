#!/usr/bin/env python3
"""Eenmalige bouwstap: zet SZINN_Alignment_Blueprint_Barry.html om naar de
canonieke NL-template met {{TOKENS}}. Elke vervanging asserteert exact 1 match."""
import re, sys, json

SRC = "barry_fixed.html"
OUT = "/Users/danil/Documents/UDefine docs/Szinn.ai/templates/blueprint.nl.html"

html = open(SRC, encoding="utf-8").read()
replacements = 0

def rep(old, new, count=1):
    global html, replacements
    n = html.count(old)
    assert n == count, f"anchor matcht {n}x (verwacht {count}):\n{old[:160]!r}"
    html = html.replace(old, new)
    replacements += 1

def region(start_anchor, end_anchor, token, keep_end=True):
    """Vervang alles van start_anchor t/m (excl.) end_anchor door token.
    start_anchor wordt ook vervangen; end_anchor blijft staan (keep_end)."""
    global html, replacements
    i = html.find(start_anchor)
    assert i >= 0 and html.find(start_anchor, i + 1) < 0, f"start-anchor niet uniek: {start_anchor[:120]!r}"
    j = html.find(end_anchor, i + len(start_anchor))
    assert j > i, f"end-anchor niet gevonden na start: {end_anchor[:120]!r}"
    html = html[:i] + token + (html[j:] if keep_end else html[j + len(end_anchor):])
    replacements += 1

# ── Titel & nav ──────────────────────────────────────────────────────────────
rep("<title>SZINN Alignment Blueprint — Barry</title>",
    "<title>SZINN Alignment Blueprint — {{CLIENT_NAME}}</title>")
rep('<a href="#" class="nav-l">SZINN · Barry</a>',
    '<a href="#" class="nav-l">SZINN · {{CLIENT_NAME}}</a>')
rep('<span class="nav-date">Barry&#10;2026</span>',
    '<span class="nav-date">{{CLIENT_NAME}}&#10;{{GEN_YEAR}}</span>')

# ── Hero ─────────────────────────────────────────────────────────────────────
rep('<h1 class="hero-name">Barry</h1>', '<h1 class="hero-name">{{CLIENT_NAME}}</h1>')
rep('<p class="hero-meta">30 juni 1971 · 08:30<br>Hoogezand, Nederland</p>',
    '<p class="hero-meta">{{BIRTH_DATE_LONG}} · {{BIRTH_TIME}}<br>{{BIRTH_PLACE}}</p>')
rep('<span class="hero-tag">Zon Kreeft</span>', '<span class="hero-tag">{{L_SUN}} {{SUN_SIGN}}</span>')
rep('<span class="hero-tag">Asc Leeuw</span>', '<span class="hero-tag">{{L_ASC}} {{ASC_SIGN}}</span>')
rep('<span class="hero-tag">Levenspad 9</span>', '<span class="hero-tag">{{L_LIFEPATH}} {{LIFE_PATH}}</span>')
rep('<div class="hcard-sub">Zon Kreeft · Asc Leeuw · Levenspad 9</div>',
    '<div class="hcard-sub">{{L_SUN}} {{SUN_SIGN}} · {{L_ASC}} {{ASC_SIGN}} · {{L_LIFEPATH}} {{LIFE_PATH}}</div>')
rep('<div class="hcard-sub">Maan Weegschaal · NN Waterman · Persoonlijk Jaar 1</div>',
    '<div class="hcard-sub">{{L_MOON}} {{MOON_SIGN}} · NN {{NN_SIGN}} · {{L_PY}} {{PERSONAL_YEAR}}</div>')
rep('<div style="margin-top:18px;font-size:11px;color:var(--muted);line-height:1.8">Een warme, stralende buitenkant met een gevoelig, beschermend hart. De Leeuw laat zich zien; de Kreeft voelt alles.</div>',
    '<div style="margin-top:18px;font-size:11px;color:var(--muted);line-height:1.8">{{AI_HERO_CORE}}</div>')
rep('<div style="margin-top:18px;font-size:11px;color:var(--muted);line-height:1.8">Een gevoel dat harmonie zoekt, een richting die naar de bijdrage wijst, en een jaar dat een nieuw begin draagt.</div>',
    '<div style="margin-top:18px;font-size:11px;color:var(--muted);line-height:1.8">{{AI_HERO_PATTERNS}}</div>')
rep('Astrologie<br><span style="font-size:11px;color:var(--ink)">Zon, Mercurius &amp; Venus in Huis 11 · Mars op de Noordknoop in Waterman, Huis 6</span>',
    'Astrologie<br><span style="font-size:11px;color:var(--ink)">{{AI_HERO_ALIGN_ASTRO}}</span>')
rep('Numerologie<br><span style="font-size:11px;color:var(--ink)">Levenspad 9 · Persoonlijk Jaar 1 · Geboortedag 3</span>',
    'Numerologie<br><span style="font-size:11px;color:var(--ink)">{{L_LIFEPATH}} {{LIFE_PATH}} · {{L_PY}} {{PERSONAL_YEAR}} · {{L_BIRTHDAY}} {{BIRTHDAY_NUM}}</span>')
rep('Zielrichting<br><span style="font-size:11px;color:var(--ink)">Noordknoop Waterman · Huis 6 · bijdragen aan het geheel</span>',
    'Zielrichting<br><span style="font-size:11px;color:var(--ink)">{{AI_HERO_ALIGN_SOUL}}</span>')
rep('Persoonlijk Jaar<br><span style="font-size:11px;color:var(--ink)">Jaar 1 · een nieuw begin</span>',
    'Persoonlijk Jaar<br><span style="font-size:11px;color:var(--ink)">{{AI_HERO_ALIGN_YEAR}}</span>')

# ── Mini-row ─────────────────────────────────────────────────────────────────
rep('<div class="mini-val">Noordknoop Waterman · H6</div>', '<div class="mini-val">Noordknoop {{NN_SIGN}} · H{{NN_HOUSE}}</div>')
rep('<div class="mini-val">Maan Weegschaal · H2</div>', '<div class="mini-val">{{L_MOON}} {{MOON_SIGN}} · H{{MOON_HOUSE}}</div>')
rep('<div class="mini-val">Zon Kreeft · H11</div>', '<div class="mini-val">{{L_SUN}} {{SUN_SIGN}} · H{{SUN_HOUSE}}</div>')
rep('<div class="mini-val">Levenspad 9 · Persoonlijk Jaar 1</div>', '<div class="mini-val">{{L_LIFEPATH}} {{LIFE_PATH}} · {{L_PY}} {{PERSONAL_YEAR}}</div>')

# ── Dashboard (score-sec): 4 kaarten via één token, closing apart ────────────
region('<div class="score-grid">', '<div class="feedback">',
       '<div class="score-grid">{{SCORE_CARDS}}</div>\n  ')
rep('<div class="score-closing"><p>De lens die nu het lichtst is, je Zielrichting, is niet je zwakte. Het is je grootste kans. Het is het terrein waar in dit jaar van nieuwe beginnen de meeste beweging mogelijk is.</p></div>',
    '<div class="score-closing"><p>{{AI_DASH_CLOSING}}</p></div>')

# ── bp-intro ─────────────────────────────────────────────────────────────────
rep('<div class="bp-name-big">Barry</div>', '<div class="bp-name-big">{{CLIENT_NAME}}</div>')
rep('<div class="bp-birth">30 juni 1971 · 08:30 · Hoogezand, Nederland</div>',
    '<div class="bp-birth">{{BIRTH_LINE}}</div>')
rep("""<div class="bp-planet"><div class="bp-planet-label">Zon</div><div class="bp-planet-val">Kreeft 7°52'</div></div>""",
    '<div class="bp-planet"><div class="bp-planet-label">{{L_SUN}}</div><div class="bp-planet-val">{{SUN_POS}}</div></div>')
rep("""<div class="bp-planet"><div class="bp-planet-label">Maan</div><div class="bp-planet-val">Weegschaal 3°01'</div></div>""",
    '<div class="bp-planet"><div class="bp-planet-label">{{L_MOON}}</div><div class="bp-planet-val">{{MOON_POS}}</div></div>')
rep("""<div class="bp-planet"><div class="bp-planet-label">Ascendant</div><div class="bp-planet-val">Leeuw 23°36'</div></div>""",
    '<div class="bp-planet"><div class="bp-planet-label">{{L_ASC_FULL}}</div><div class="bp-planet-val">{{ASC_POS}}</div></div>')
rep('<div class="bp-planet"><div class="bp-planet-label">Levenspad</div><div class="bp-planet-val">9</div></div>',
    '<div class="bp-planet"><div class="bp-planet-label">{{L_LIFEPATH}}</div><div class="bp-planet-val">{{LIFE_PATH}}</div></div>')
rep('<div class="bp-planet"><div class="bp-planet-label">Pers. Jaar</div><div class="bp-planet-val">1 (2026)</div></div>',
    '<div class="bp-planet"><div class="bp-planet-label">{{L_PY_SHORT}}</div><div class="bp-planet-val">{{PERSONAL_YEAR}} ({{GEN_YEAR}})</div></div>')
rep('<div class="bp-quote">"Jouw start is een blauwdruk, niet je bestemming."</div>',
    '<div class="bp-quote">"{{AI_INTRO_QUOTE}}"</div>')

# ── Sectie 02 Introductie: 3 persoonlijke alinea's → 1 token ────────────────
region('<p>Jij, Barry, bent iemand met een Zon in Kreeft',
       '<div class="note"><p>Lees deze sectie niet als een oordeel.',
       '{{AI_INTRODUCTION_BODY}}\n  ')

# ── Sectie 03 Flow: persoonlijke alinea's + grid + vragen ───────────────────
region('<p>In jouw kaart vertaalt zich dat als volgt.',
       '<div class="ngrid">',
       '{{AI_FLOW_BODY}}\n  ')
# de flow-ngrid (3 cellen) volledig door renderer laten bouwen
region('<div class="ngrid">\n    <div class="ncell"><div class="nlbl">Sin / Lichaam</div>',
       '<h3>Vijf reflectievragen over jouw flow</h3>',
       '<div class="ngrid">{{FLOW_GRID}}</div>\n  ')
region('<ul class="q-list">\n    <li><span class="q-num">1</span>Wanneer voelde je je deze afgelopen maand',
       '</section>',
       '<ul class="q-list">{{FLOW_QUESTIONS}}</ul>\n')

# ── Sectie 04 Astrologie ─────────────────────────────────────────────────────
rep('<h2>De <em>geboortekaart</em> van Barry</h2>', '<h2>De <em>geboortekaart</em> van {{CLIENT_NAME}}</h2>')
rep('<p>Placidus huizensysteem · Swiss Ephemeris · Berekend vanuit 30 juni 1971, 08:30 Hoogezand (UTC+1)</p>',
    '<p>Placidus huizensysteem · Astronomische ephemeris · Berekend vanuit {{BIRTH_DATE_LONG}}, {{BIRTH_TIME}} {{BIRTH_CITY}}</p>')
# planetentabel-body
region('<tbody>\n      <tr><td>☉ Zon</td>', '</tbody>', '<tbody>{{PLANET_TABLE_ROWS}}\n    </tbody>', keep_end=False)
# opvallende patronen: 4 alinea's
region('<h3>Opvallende patronen in jouw kaart</h3>',
       '<div class="nsplit">',
       '<h3>Opvallende patronen in jouw kaart</h3>\n  {{AI_ASTRO_PATTERNS}}\n  ')
# 2 patroon-kaarten
region('<div class="nsplit">\n    <div class="ncard">\n      <div class="ncard-lbl">Cluster Huis 11',
       '</section>',
       '<div class="nsplit">{{ASTRO_CARDS}}</div>\n')

# ── Sectie 05 Knopen ─────────────────────────────────────────────────────────
rep('<h2>Van Leeuw <em>naar Waterman</em></h2>', '<h2>Van {{ZN_SIGN}} <em>naar {{NN_SIGN}}</em></h2>')
region('<p>De knooppunt-as in jouw kaart vertelt het verhaal van jouw ziel.',
       '<div class="nsplit">',
       '{{AI_NODES_BODY}}\n  ')
rep('''<div class="ncard-lbl">Zuidknoop — Oorsprong</div>
      <h3>Leeuw · Huis 12</h3>
      <p>Je kent de energie van het zelf dat gezien wil worden, van warmte en uitstraling, maar op een innerlijk, verborgen podium. Dit patroon is vertrouwd en heeft je kleur gegeven. Maar het voedt je niet meer wanneer het betekent dat alles om jou als middelpunt draait, of dat je je licht juist verbergt.</p>''',
    '''<div class="ncard-lbl">Zuidknoop — Oorsprong</div>
      <h3>{{ZN_SIGN}} · Huis {{ZN_HOUSE}}</h3>
      <p>{{AI_NODES_SOUTH}}</p>''')
rep('''<div class="ncard-lbl">Noordknoop — Groeirichting</div>
      <h3>Waterman · Huis 6</h3>
      <p>Jouw zielsrichting is bijdragen aan het grotere geheel via concreet dagelijks werk. Niet het zelf in het midden, maar het werk dat het collectief dient. De stap is je daadkracht inzetten voor iets dat groter is dan jou, en vertrouwen dat je meetelt door wat je geeft.</p>''',
    '''<div class="ncard-lbl">Noordknoop — Groeirichting</div>
      <h3>{{NN_SIGN}} · Huis {{NN_HOUSE}}</h3>
      <p>{{AI_NODES_NORTH}}</p>''')
region('<h3>Chiron in Ram in Huis 9</h3>', '</section>',
       '<h3>Chiron in {{CHIRON_SIGN}} in Huis {{CHIRON_HOUSE}}</h3>\n  <p>{{AI_NODES_CHIRON}}</p>\n')

# ── Sectie 06 Numerologie ────────────────────────────────────────────────────
rep('<h2>De <em>getallen</em> van Barry</h2>', '<h2>De <em>getallen</em> van {{CLIENT_NAME}}</h2>')
rep('<p>Pythagorisch systeem · Datumgetallen berekend vanuit 30 juni 1971 · Meestergetallen niet gereduceerd</p>',
    '<p>Pythagorisch systeem · Berekend vanuit {{BIRTH_DATE_LONG}} en je geboortenaam · Meestergetallen niet gereduceerd</p>')
# kerngetallen-grid (3 datumcellen) + naamgetallen-note → 1 token (renderer bouwt 3+3 cellen)
region('''<div class="ngrid">
    <div class="ncell"><div class="nlbl">Levenspad</div><div class="nval">9</div>''',
       '<h3>Levenspad 9 — De Wijze</h3>',
       '<div class="ngrid">{{CORE_NUMBERS_GRID}}</div>\n  ')
region('<h3>Levenspad 9 — De Wijze</h3>',
       '<h3>Persoonlijk Jaar 1 (2026)</h3>',
       '<h3>Levenspad {{LIFE_PATH}} — {{AI_LIFEPATH_TITLE}}</h3>\n  {{AI_LIFEPATH_BODY}}\n  ')
region('<h3>Persoonlijk Jaar 1 (2026)</h3>',
       '<div class="ncard-wrap"><div class="ncard">\n    <div class="ncard-lbl">De cyclus van 2026</div>',
       '<h3>Persoonlijk Jaar {{PERSONAL_YEAR}} ({{GEN_YEAR}})</h3>\n  {{AI_PY_BODY}}\n  ')
region('<div class="ncard-wrap"><div class="ncard">\n    <div class="ncard-lbl">De cyclus van 2026</div>',
       '</section>',
       '''<div class="ncard-wrap"><div class="ncard">
    <div class="ncard-lbl">De cyclus van {{GEN_YEAR}}</div>
    <h3>{{AI_CYCLE_TITLE}}</h3>
    <p>{{AI_CYCLE_BODY}}</p>
  </div></div>
''')

# ── Sectie 07 Tikkun ─────────────────────────────────────────────────────────
rep('<h2>De <em>zielstaak</em> van Barry</h2>', '<h2>De <em>zielstaak</em> van {{CLIENT_NAME}}</h2>')
region('<div class="ncard-wrap"><div class="ncard">\n    <div class="ncard-lbl">Kernthema</div>',
       '<h3>Retrograde planeten: innerlijke verwerking</h3>',
       '{{TIKKUN_CARDS}}\n  ')
region('<h3>Retrograde planeten: innerlijke verwerking</h3>', '</section>',
       '<h3>{{AI_TIKKUN_RETRO_TITLE}}</h3>\n  <p>{{AI_TIKKUN_RETRO_BODY}}</p>\n')

# ── Sectie 08 Mandala ────────────────────────────────────────────────────────
rep('<h2>De <em>Mandala</em> van Barry</h2>', '<h2>De <em>Mandala</em> van {{CLIENT_NAME}}</h2>')
rep("<p>Jouw volledige geboortekaart, gegenereerd vanuit jouw exacte geboortedata, met de planeten op hun precieze ecliptische graden. In het hart roteert de Merkaba op de knooppunt-as: het gouden punt reikt naar jouw Noordknoop in Waterman (15°09'), het amethist naar jouw Zuidknoop in Leeuw.</p>",
    '<p>Jouw volledige geboortekaart, gegenereerd vanuit jouw exacte geboortedata, met de planeten op hun precieze ecliptische graden. In het hart roteert de Merkaba op de knooppunt-as: het gouden punt reikt naar jouw Noordknoop in {{NN_SIGN}} ({{NN_DEG}}), het amethist naar jouw Zuidknoop in {{ZN_SIGN}}.</p>')
i = html.find('<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 680 816"')
j = html.rfind('</svg>')
assert 0 < i < j
html = html[:i] + '{{MANDALA_SVG}}' + html[j + len('</svg>'):]
replacements += 1

# ── Sectie 09 Samenvatting ───────────────────────────────────────────────────
rep('<h2>Barry <em>in één zin</em></h2>', '<h2>{{CLIENT_NAME}} <em>in één zin</em></h2>')
region('<blockquote>"Een warme, gevoelige man met een stralende buitenkant',
       '<p>Je hebt je door vier systemen bewogen',
       '<blockquote>"{{AI_SUMMARY_ONELINER}}"</blockquote>\n  ')
region('<table class="ptab">\n    <tbody>\n      <tr><td><strong>Kernidentiteit</strong>',
       '</section>',
       '<table class="ptab">\n    <tbody>{{SUMMARY_ROWS}}</tbody>\n  </table>\n')

# ── Sectie 10 Reflectie ──────────────────────────────────────────────────────
region('<ul class="q-list">\n    <li><span class="q-num">1</span>Welk inzicht uit jouw astrologie',
       '</section>',
       '<ul class="q-list">{{REFLECTION_QUESTIONS}}</ul>\n')

# ── Sectie 11 Energie ────────────────────────────────────────────────────────
region('<p>Jouw kaart heeft een eigen ritme.',
       '<div class="ngrid">\n    <div class="ncell"><div class="nlbl">Ochtend</div>',
       '<p>{{AI_ENERGY_RHYTHM}}</p>\n  ')
region('<div class="ngrid">\n    <div class="ncell"><div class="nlbl">Ochtend</div>',
       '<h3>De elementen in jouw kaart</h3>',
       '<div class="ngrid">{{ENERGY_GRID}}</div>\n  ')
region('<div class="nsplit">\n    <div class="ncard">\n      <div class="ncard-lbl">Water (Zon &amp; Mercurius Kreeft)</div>',
       '</section>',
       '<div class="nsplit">{{ELEMENT_CARDS}}</div>\n')

# ── Sectie 12 Integratie ─────────────────────────────────────────────────────
region('<p><strong>Jouw vier lagen op dit moment:</strong><br>',
       '</div>\n  <p>Dit is het moeilijkste deel.',
       '<p><strong>Jouw vier lagen op dit moment:</strong><br>\n    Astrologie — {{AI_LAYERS_ASTRO}}<br>\n    Numerologie — {{AI_LAYERS_NUM}}<br>\n    Zielrichting — {{AI_LAYERS_SOUL}}<br>\n    Persoonlijk Jaar — {{AI_LAYERS_YEAR}}<br><br>\n    De praktijken hieronder richten zich op waar de meeste beweging mogelijk is. Voor jou is dat nu vooral: <strong>{{AI_LAYERS_FOCUS}}</strong></p>\n  ')
region('<p>Voor jou leeft de schaduw vooral in twee dingen.',
       '<h3>Jouw zes gaven</h3>',
       '<p>{{AI_SHADOW_BODY}}</p>\n  ')
region('<div class="gifts-grid">', '<h3>De adem als sleutel</h3>',
       '<div class="gifts-grid">{{GIFT_CARDS}}</div>\n  ')
region('<p>Op het moment dat je reageert, verandert je ademhaling direct',
       '<h3>Integratie in zes bewegingen</h3>',
       '<p>{{AI_BREATH_BODY}}</p>\n  ')
region('<div class="practice"><div class="practice-num">Praktijk 01</div>',
       '<h3>Zes AI-prompts voor jouw kaart</h3>',
       '{{PRACTICES}}\n  ')
region('<div class="prompt"><div class="plbl">Prompt 01',
       '<h3>Persoonlijke kalender — juli tot december 2026</h3>',
       '{{PROMPT_CARDS}}\n  ')
rep('<h3>Persoonlijke kalender — juli tot december 2026</h3>',
    '<h3>Persoonlijke kalender — {{CAL_RANGE}}</h3>')
rep('<p>Je persoonlijke maandgetallen zijn berekend vanuit Persoonlijk Jaar 1. Elke maand draagt een eigen kleur van energie. Hoe bewuster je dit ritme volgt, hoe meer je meebeweegt met de stroom van je jaar.</p>',
    '<p>Je persoonlijke maandgetallen zijn berekend vanuit Persoonlijk Jaar {{PERSONAL_YEAR}}. Elke maand draagt een eigen kleur van energie. Hoe bewuster je dit ritme volgt, hoe meer je meebeweegt met de stroom van je jaar.</p>')
region('<div class="cal-grid">', '</section>', '<div class="cal-grid">{{CALENDAR_MONTHS}}</div>\n')

# ── Sectie 13 Verdieping ─────────────────────────────────────────────────────
region('<h3>Tot slot</h3>', '<h3>Bronnen, verdieping &amp; volgende stappen</h3>',
       '<h3>Tot slot</h3>\n  {{AI_CLOSING_BODY}}\n  ')
rep('<p style="font-size:12px;color:var(--muted)">SZINN · Barry · Blueprint 2026 · Persoonlijk en vertrouwelijk</p>',
    '<p style="font-size:12px;color:var(--muted)">SZINN · {{CLIENT_NAME}} · Blueprint {{GEN_YEAR}} · Persoonlijk en vertrouwelijk</p>')

# ── Footer ───────────────────────────────────────────────────────────────────
rep('''<p>SZINN Alignment Blueprint™ · Barry · 30 juni 1971 · Hoogezand<br>
  Gegenereerd 2026<br>''',
    '''<p>SZINN Alignment Blueprint™ · {{CLIENT_NAME}} · {{BIRTH_DATE_LONG}} · {{BIRTH_CITY}}<br>
  Gegenereerd {{GEN_YEAR}}<br>''')

# ── Controle: geen 'Barry' meer buiten base64, geen resterende datumsporen ───
leftover = [m.start() for m in re.finditer(r'Barry', html)]
assert not leftover, f"Barry komt nog voor op: {leftover}"
for trace in ("Hoogezand", "30 juni 1971", "08:30", "7°52", "23°36", "15°09"):
    assert trace not in html, f"persoonlijk spoor nog aanwezig: {trace}"

open(OUT, "w", encoding="utf-8").write(html)
tokens = sorted(set(re.findall(r'{{[A-Z0-9_]+}}', html)))
print(f"OK — {replacements} vervangingen, {len(tokens)} unieke tokens, {len(html)} bytes")
print("\n".join(tokens))

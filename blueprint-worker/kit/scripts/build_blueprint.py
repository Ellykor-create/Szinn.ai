# -*- coding: utf-8 -*-
"""SZINN Alignment Blueprint · generiek bouwscript (opbouw en opmaak van build_voorbeeld_marc.py, drie-delen-indeling).
Leest uit de klantmap (omgevingsvariabele BP_JOB):
  klant_chart.json  datalaag van chart.py
  facts.json        getallen en rekenstappen (datalaag.py)
  content.json      alle persoonlijke tekst (schrijflaag)
De schrijflaag berekent niets: elke graad, elk huis, elke orb en elk getal hieronder komt uit facts/chart.
Gebruik: BP_JOB=map python3 build_blueprint.py   of   BP_JOB=map python3 book.py build_blueprint.py [rug_mm]"""
import sys, os, json, math, re, html as _html
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from szinn_common import *
from szinn_vast import *
import mandala
from szinn_taal import t, nm, LANG

JOB = os.environ['BP_JOB']
F = json.load(open(os.path.join(JOB, 'facts.json')))
C = json.load(open(os.path.join(JOB, 'content.json')))
CH = json.load(open(os.path.join(JOB, 'klant_chart.json')))

NAAM = F['naam']; VOORNAAM = F['voornaam']
FOOT = f'SZINN · Alignment Blueprint · {NAAM} · '
MAAND_JAAR = F['oplevering']
V = '︎'
PL = F['planeten']; ASC = F['asc']; MC = F['mc']; ZK = F['zuidknoop']; NK = PL['Noordknoop']
GLYPH = {'Zon': '☉', 'Maan': '☽', 'Mercurius': '☿', 'Venus': '♀', 'Mars': '♂', 'Jupiter': '♃', 'Saturnus': '♄',
         'Uranus': '♅', 'Neptunus': '♆', 'Pluto': '♇', 'Noordknoop': '☊', 'Chiron': '⚷'}


def e(t):
    """Persoonlijke tekst veilig in HTML zetten (aanhalingstekens blijven staan voor de citatencontrole)."""
    return _html.escape(str(t or '').strip(), quote=False)


def ps(alineas):
    return ''.join(f'<p>{e(a)}</p>' for a in alineas if str(a).strip())


def plaats(n):
    p = PL[n]; return nm(f"{p['graad']} {p['teken']}, huis {p['huis']}")


parts = []

# ---------- cover ----------
naamregels = NAAM.split()
knip = len(naamregels) - 1          # achternaam op de tweede regel, tussenvoegsels (kleine letter) gaan mee
while knip > 1 and naamregels[knip - 1].islower():
    knip -= 1
h1 = ' '.join(naamregels[:knip]) + '<br>' + ' '.join(naamregels[knip:]) if len(naamregels) > 1 else NAAM
parts.append(f"""
<section class="cover" style="background-image:url({COVER_BG})">
<div class="clogo"><img src="{LOGO}" alt="SZINN"><div class="cl">szinn.ai</div></div><div class="vl"></div>
<div class="cpanel"><div class="k">Alignment Blueprint</div>
<h1>{h1}</h1>
<div class="rw">Remember who you are</div>
<div class="meta"><b>{F['geboortedatum']} · {F['geboortetijd']} · {e(F['geboorteplaats'])}</b><br>
{nm('Zon')} {PL['Zon']['teken']} {PL['Zon']['graad']} · {nm('Maan')} {PL['Maan']['teken']} {PL['Maan']['graad']} · Ascendant {ASC['teken']} {ASC['graad']}<br>
{t('Levenspad')} {F['levenspad']} · {t('Geboortedag')} {F['geboortedag']} · {t('Persoonlijk Jaar')} {F['pj']} ({F['pj_jaar']})</div>
<div class="fac">{t('Gefaciliteerd door')} Elly Elizabeth Korving · SZINN · szinn.ai · {MAAND_JAAR}</div>
</div></section>""")

parts.append(quotepage(IMG['voor'], t('Voor {naam}', naam=VOORNAAM), f"{e(C['voor'])} <b>{t('Dit ben jij.')}</b> {t('Deze Blueprint is je spiegel daarbij.')}"))

toc_rows = [
 ('part','Voordat je begint'),('01','Visie &amp; Missie'),
 ('part','Deel I · Herkenning · Wie ben ik?'),('·','De elementen: het recept'),('·','Karakter: wie je bent in balans'),('·','Valkuilen: uit balans'),('·','Talenten: wat je meebrengt'),('02','Introductie'),
 ('part','Deel II · Helderheid · Wat wil ik? Waar komt het vandaan?'),('04','Astrologie'),('05','Noord- &amp; Zuidknoop'),('06','Numerologie'),('07','Kabbalah / Tikkun'),('08','Sacred Geometry · De Mandala'),('09','Overzicht &amp; Samenvatting'),
 ('part','Deel III · Integratie · Waar ga ik heen? Hoe leef ik dit?'),('03','Leven vanuit flow'),('10','Reflectievragen'),('11','Werken met de energie'),('12','Integratie'),
 ('sub','Schaduwkanten + ankers'),('sub','De zes gaven'),('sub','Daily Practices (7)'),('sub','AI-prompts (6)'),('sub','Persoonlijke kalender · 6 maanden'),('·','Inner Permissions'),('13','Verdieping'),
]
toc = f'<section class="sec"><div class="kicker">{t("Inhoud")}</div><h1>{t("Wat je in dit document vindt")}</h1><table class="toc">'
for n, lab in toc_rows:
    lab = t(lab)
    if n == 'part': toc += f'<tr><td class="part" colspan="2">{lab}</td></tr>'
    elif n == 'sub': toc += f'<tr><td class="n"></td><td class="subi">{lab}</td></tr>'
    else: toc += f'<tr><td class="n">{n}</td><td>{lab}</td></tr>'
parts.append(toc + '</table></section>')

parts.append(sec(t('01 — Visie &amp; Missie'), t('Jij bent <em>de blauwdruk.</em>'), None, VISIE_01 + KAARTJES_01))

parts.append(full(IMG['deel1'], t('Deel I · Wie ben ik?'), t('Herkenning'),
 t('Het moment dat je een patroon ziet, niet als iets wat je overkomt maar als iets wat je draait. Dit deel begint bij de vier elementen en bij wie jij bent als je gewoon jezelf bent: in balans, uit balans, en wat je meebrengt. Daarna volgt de persoonlijke introductie. Alles wat hier staat is een spiegel, geen oordeel. Wat resoneert, neem je mee. Wat niet klopt, laat je los.')))

# ---------- Herkenning · elementen ----------
def elcard(name, tag, pct, who, text):
    return (f'<div class="cardhead"><h3>{name}</h3><span class="lab">{tag}</span></div><div class="bar"><i style="width:{pct}%"></i></div>'
            f'<p class="small">{who}</p><p>{text}</p>')
EC = C['elementen']
ektekst = {k['element']: k for k in EC['kaarten']}
kern_rows = [('Zon', plaats('Zon')), ('Maan', plaats('Maan')), ('Ascendant', f"{ASC['graad']} {ASC['teken']}"), ('Midhemel', f"{MC['graad']} {MC['teken']}"),
             ('Mercurius', plaats('Mercurius')), ('Venus', plaats('Venus')), ('Mars', plaats('Mars')), ('Saturnus', plaats('Saturnus')), ('Chiron', plaats('Chiron')),
             ('Knopen-as', t('Zuidknoop {zk} (huis {zh}) naar Noordknoop {nk} (huis {nh})', zk=f"{ZK['graad']} {ZK['teken']}", zh=ZK['huis'], nk=f"{NK['graad']} {NK['teken']}", nh=NK['huis']))]
parts.append(sec(t('Herkenning · De elementen'), t('Het recept: ') + e(EC['titel']),
 F['el_lead'] + ' ' + e(EC['lead_slot']),
 cards([elcard(nm(k['element']).capitalize(), e(ektekst[k['element']]['tag']), k['pct'], k['wie'], e(ektekst[k['element']]['tekst'])) for k in F['el_kaarten']])
 + f'<h2>{t("Wat de verdeling zegt")}</h2>' + ps(EC['verdeling'])
 + pull(e(EC['pull']), t('De kern van je elementen'))
 + '<table>' + ''.join(f'<tr><td class="k">{nm(k)}</td><td>{v} · {e(EC["kern"][k])}</td></tr>' for k, v in kern_rows) + '</table>'))

def stukken(lijst):
    return [h3(e(x['titel']), e(x['plaatsing'])) + f"<p>{e(x['tekst'])}</p>" for x in lijst]

k6 = stukken(C['karakter'])
parts.append(sec(t('Herkenning · Karakter'), t('Wie je bent als je in balans bent'),
 t('Deze lezing werkt met drie lagen: wie je bent als je in balans bent, wat er gebeurt als je uit balans raakt, en wat je meebrengt dat de wereld nodig heeft. Dit is de eerste laag.'),
 cards([''.join(k6[:3]), ''.join(k6[3:])], cls='plain')))

parts.append(sec(t('Herkenning · Valkuilen'), t('Wat er gebeurt als je uit balans raakt'),
 t('Hier wordt het direct, maar nooit hard. Een valkuil is een talent dat te lang aan heeft gestaan.'),
 ''.join(stukken(C['valkuilen'])) + pull(e(C['valkuilen_pull']), t('De kern van je valkuilen'))))

talenten = [dict(x) for x in C['talenten']]
talenten[5].update(titel=t('Je gave is je richting'), plaatsing=t('Noordknoop in {teken}, huis {huis}', teken=NK['teken'], huis=NK['huis']))
t6 = stukken(talenten)
parts.append(sec(t('Herkenning · Talenten'), t('Wat je meebrengt dat de wereld nodig heeft'),
 t('Hier eindigt elke goede lezing, omdat je ziel dit niet voor niets heeft gekozen.'),
 cards([''.join(t6[:3]), ''.join(t6[3:])], cls='plain')))

parts.append(quotepage(IMG['herk'], t('Herkenning'), e(C['herkenning_quote'])))

INTRO_02 = t('INTRO_02') if LANG == 'en' else """
<p>Dit SZINN Alignment Blueprint is geen waarheid. Het is een spiegel, een reflectie. Wat resoneert, neem het mee. Wat niet klopt, laat het los. Beschouw niets hier als absolute waarheid. Ga zelf op onderzoek. Jij bent altijd de enige expert op jouzelf.</p>
<p>De meeste mensen leren zichzelf kennen via hoe anderen hen zien. Via hun rol in een familie, een baan, een vriendschap. Via wat er van hen verwacht wordt. SZINN gaat ervan uit dat er een dieper zelf is, niet gevormd door omstandigheden maar simpelweg aanwezig. En dat dat diepere zelf een handtekening heeft, zichtbaar in de momenten en patronen van je leven, als je weet waar je moet kijken.</p>
"""
NOTE_02 = t('NOTE_02') if LANG == 'en' else """
<div class="note"><p>Lees deze sectie niet als een oordeel. Lees haar als een uitnodiging om met iets meer nieuwsgierigheid dan gewoonlijk naar jezelf te kijken. Wat resoneert, neem het mee. Wat niet klopt, laat het los.</p></div>
"""
parts.append(sec(t('02 — Introductie'), t('Een nieuw paradigma van zelfherkenning.'), None, INTRO_02 + ps(C['introductie']) + NOTE_02))

parts.append(full(IMG['deel2'], t('Deel II · Wat wil ik? Waar komt het vandaan?'), t('Helderheid'),
 t('Niet de helderheid van alle antwoorden weten, maar de helderheid van weten wie je bent. Hier staat de techniek: je geboortekaart met de berekeningen, je knopen, je getallen, je zielstaak en je mandala. Alles wat je in deel I hebt herkend, komt hier vandaan. Lees het niet in één keer. Eén sectie tegelijk is genoeg.')))

# ---------- 04 Astrologie ----------
planet_rows = []
for n in ['Zon', 'Maan', 'Mercurius', 'Venus', 'Mars', 'Jupiter', 'Saturnus', 'Uranus', 'Neptunus', 'Pluto', 'Noordknoop', 'Chiron']:
    p = PL[n]; rx = ' Rx' if p['rx'] and n != 'Noordknoop' else ''
    planet_rows.append((f'{GLYPH[n]}{V} {nm(n)}{rx}', p['txt'], str(p['huis']),
                        t('{teken} in huis {huis}', teken=p['teken'], huis=p['huis']) + (t(', retrograde') if rx else '') + f" · {e(C['planeten'][n])}"))
planet_rows += [(t('AC Ascendant'), f"{ASC['teken']} {ASC['graad']}", '—', e(C['planeten']['Ascendant'])),
                (t('MC Midhemel'), f"{MC['teken']} {MC['graad']}", '—', e(C['planeten']['Midhemel']))]
ptab = f'<table><tr><th>{t("Planeet")}</th><th>{t("Positie")}</th><th>{t("Huis")}</th><th>{t("Kwaliteit")}</th></tr>' + ''.join(f'<tr><td>{a}</td><td>{b}</td><td>{c}</td><td>{d}</td></tr>' for a, b, c, d in planet_rows) + '</table>'
asptekst = {x['aspect']: x['tekst'] for x in C['aspecten']}
atab = f'<table><tr><th>{t("Aspect")}</th><th>{t("Orb")}</th><th>{t("Wat het in gesprek brengt")}</th></tr>' + ''.join(
    f"<tr><td>{nm(a['sleutel'])}</td><td>{a['orb']}</td><td>{e(asptekst.get(a['sleutel'], ''))}</td></tr>" for a in F['aspecten_tabel']) + '</table>'
tz_txt = f"UTC{'+' if F['tz'] >= 0 else ''}{F['tz']:g}"
noot = f'<p class="small">{t("Geboortetijdnoot: ")}{e(C["geboortetijdnoot"])}</p>' if str(C.get('geboortetijdnoot') or '').strip() else ''
parts.append(sec(t('04 — Astrologie'), t('De <em>geboortekaart</em> van {naam}', naam=NAAM),
 t('Placidus huizensysteem · Swiss Ephemeris · Ware knoop · Berekend vanuit {datum}, {tijd}, {plaats} ({tz}) · Boogminuten afgekapt', datum=F['geboortedatum'], tijd=F['geboortetijd'], plaats=e(F['geboorteplaats']), tz=tz_txt),
 ASTRO_INTRO + f'<h2>{t("De twaalf huizen")}</h2>' + HUIZEN + ASPECT_INTRO + ptab + f'<h2>{t("Aspecten in jouw kaart (orb tot 5°, de nauwste eerst)")}</h2>' + atab
 + f'<h2>{t("Opvallende patronen in jouw kaart")}</h2>' + ps(C['patronen']) + noot
 + cards([f"<div class=\"lab\">{e(x['label'])}</div>{h3(e(x['titel']))}<p>{e(x['tekst'])}</p>" for x in C['patroonkaarten']])))

# ---------- 05 Knopen ----------
CHI = PL['Chiron']
parts.append(sec(t('05 — Noord- &amp; Zuidknoop'), t('Van <em>{zk}</em> naar {nk}', zk=ZK['teken'], nk=NK['teken']), None, KNOPEN_INTRO + ps(C['knopen'])
 + cards([f"<div class=\"lab\">{t('Zuidknoop · oorsprong')}</div>{h3(ZK['teken'] + t(' · Huis ') + str(ZK['huis']))}<p>{e(C['zuidknoop_kaart'])}</p>",
          f"<div class=\"lab\">{t('Noordknoop · groeirichting')}</div>{h3(NK['teken'] + t(' · Huis ') + str(NK['huis']))}<p>{e(C['noordknoop_kaart'])}</p>"])
 + f"<h2>{t('Chiron in {teken} in huis {huis}', teken=CHI['teken'], huis=CHI['huis'])}</h2><p>{e(C['chiron'])}</p>"))

parts.append(full(IMG['getallen'], t('Deel II · Helderheid'), '', t('Getallen liegen niet. Ze spiegelen.')))

# ---------- 06 Numerologie ----------
N = C['num']; NG = F['naamgetallen']; G = F['groei']
kern = cards([
 f"<div class=\"lab\">{t('Levenspad')}</div><div class=\"num\">{F['levenspad']}</div><p class=\"small\">{F['lp_stappen']}</p>",
 f"<div class=\"lab\">{t('Persoonlijk Jaar {jaar}', jaar=F['pj_jaar'])}</div><div class=\"num\">{F['pj']}</div><p class=\"small\">{F['pj_stappen']}</p>",
 f"<div class=\"lab\">{t('Geboortedag')}</div><div class=\"num\">{F['geboortedag']}</div><p class=\"small\">{F['gd_stappen']}</p>",
 f"<div class=\"lab\">{t('Persoonlijk Jaar {jaar}', jaar=F['pj2_jaar'])}</div><div class=\"num\">{F['pj2']}</div><p class=\"small\">{F['pj2_stappen']}</p>"])
OT = F['ondertoon']
ONDERTOON = (f"<p class=\"gold\" style=\"font-family:'Cormorant Garamond';font-style:italic;font-size:13pt\">"
             + t('Onder je {lp} klinkt een {getal}. Wie alle cijfers van je geboortedatum in één keer optelt ({som}), vindt het meestergetal van {naam}: {tekst}, als ondertoon onder je Levenspad.',
                 lp=F['levenspad'], getal=OT['getal'], som=OT['som'], naam=OT['naam'], tekst=e(N['ondertoon'])) + '</p>') if OT else ''
naam = cards([f"<div class=\"lab\">{t(lab)}</div><div class=\"num\">{NG[w]['getal']}</div><p class=\"small\">{(t('Klinkers · ') if w == 'zielenurge' else t('Medeklinkers · ') if w == 'persoonlijkheid' else '') + NG[w]['stappen']}</p><p>{e(N[w])}</p>"
              for w, lab in (('uitdrukking', 'Uitdrukking'), ('zielenurge', 'Zielenurge'), ('persoonlijkheid', 'Persoonlijkheid'))], 3)
KL = {'geboortedag': t('Geboortedag'), 'levenspad': t('Levenspad'), 'uitdrukking': t('Uitdrukking'), 'zielenurge': t('Zielenurge'), 'persoonlijkheid': t('Persoonlijkheid')}
ret_kop = t(' en ').join(f"{v}{t(' · in je ')}{KL[k]}" for k, v in G['returning'].items()) or t('Geen')
voor_stap = ' · '.join(f"{KL[k]} {v}" for k, v in G['samengesteld'].items())
voor_stap = voor_stap[0].lower() + voor_stap[1:]
key = ' en '.join(map(str, G['keynote']))
GROEI = GROEI_INTRO + f'<h2>{t("Wat dit voor jou betekent")}</h2>' + cards([
 f'<div class="lab">{t("Returning numbers")}</div>' + h3(ret_kop) + f"<p>{e(N['returning'])}</p><p class=\"small\">{t('Vóór de laatste stap: ')}{voor_stap}.</p>",
 f'<div class="lab">{t("Jouw keynote")}</div>' + h3(f"{key} · {e(N['keynote_woord'])}") + f"<p>{e(N['keynote'])}</p>",
 f'<div class="lab">{t("Untrained muscles")}</div>' + h3(' · '.join(map(str, G['missing'])) or t('Geen')) + f"<p>{e(N['untrained'])}</p>"], 3) + f"<p>{e(N['groei_samen'])}</p>"
parts.append(sec(t('06 — Numerologie'), t('De <em>getallen</em> van {naam}', naam=NAAM),
 t('Pythagorisch systeem · Berekend vanuit {datum} en de geboortenaam {naam} · Meestergetallen niet gereduceerd', datum=F['geboortedatum'], naam=e(F['geboortenaam'])),
 NUM_INTRO + NUMCARDS + NUM_MEESTER + kern + ONDERTOON + f'<h2>{t("De drie naamgetallen")}</h2>' + naam + GROEI
 + f"<h2>{t('Levenspad {lp} · {titel}', lp=F['levenspad'], titel=e(N['lp_titel']))}</h2>" + ps(N['lp'])
 + f"<h2>{t('Persoonlijk Jaar {pj} ({jaar}) en {kop}', pj=F['pj'], jaar=F['pj_jaar'], kop=e(N['pj_kop']))}</h2>" + ps(N['pj'])
 + f"<div class=\"note t\"><div class=\"lab\">{t('De cyclus van dit half jaar')}</div><h3>{e(N['cyclus_titel'])}</h3><p>{e(N['cyclus'])}</p></div>"))

# ---------- 07 Tikkun ----------
tk = ''.join(f"<div class=\"note t\"><div class=\"lab\">{lab}</div><h3>{e(x['titel'])}</h3><p>{e(x['tekst'])}</p></div>"
             for lab, x in zip((t('Kernthema'), t('Herhalingspatroon'), t('Groei'), t('Zielstaak')), C['tikkun']))
parts.append(sec(t('07 — Kabbalah &amp; Tikkun'), t('De <em>zielstaak</em> van {naam}', naam=NAAM), None, TIKKUN_INTRO + tk
 + f"<h2>{t('Retrograde planeten: innerlijke verwerking')}</h2><p>{e(C['retrograde'])}</p>"))

# ---------- 08 Mandala ----------
mandala.ch = CH
mandala.ch['pos']['Noordknoop']['rx'] = False
mandala.pos = CH['pos']; mandala.cusps = CH['cusps']; mandala.ASC = CH['asc']; mandala.MC = CH['mc']; mandala.SN = CH['sn']
svg_print, coords = mandala.build(animate=False)
leg = [(f'{GLYPH[n]}{V} {nm(n)}', f"{PL[n]['graad']} {PL[n]['teken']}" + (' Rx' if PL[n]['rx'] and n != 'Noordknoop' else ''))
       for n in ['Zon', 'Maan', 'Mercurius', 'Venus', 'Mars', 'Jupiter', 'Saturnus', 'Uranus', 'Neptunus', 'Pluto', 'Noordknoop']]
leg += [(f'☋{V} {nm("Zuidknoop")}', f"{ZK['graad']} {ZK['teken']}"), (f'⚷{V} Chiron', f"{CHI['graad']} {CHI['teken']}" + (' Rx' if CHI['rx'] else '')),
        ('AC', f"{ASC['graad']} {ASC['teken']}"), ('MC', f"{MC['graad']} {MC['teken']}")]
legend = ' '.join(f'<span><b>{a}</b> {b}</span>' for a, b in leg)
parts.append(sec(t('08 — Sacred Geometry'), t('De <em>Mandala</em> van {naam}', naam=NAAM),
 t('Jouw volledige geboortekaart, gegenereerd vanuit jouw exacte geboortedata, met de planeten op hun precieze ecliptische graden. In het hart staat de Merkaba op de knopen-as: het gouden punt reikt naar jouw Noordknoop in {nk} ({nkg}), het amethist naar jouw Zuidknoop in {zk}.', nk=NK['teken'], nkg=NK['graad'], zk=ZK['teken']),
 f'<div class="mand">{svg_print}</div><div class="legend">{legend}</div>'
 f'<p class="small" style="text-align:center;margin-top:8pt">{t("Ascendant links, tekens tegen de klok in · Flower of Life en Metatron\'s Cube in de binnencirkel · Merkaba op de ware knoop")}</p>'))
parts.append(sec(t('08 — Sacred Geometry'), t('Een <em>frequentie</em> om te herkennen'), None, MANDALA_P2))

# ---------- 09 Overzicht ----------
O = C['overzicht']
def samengesteld(w):
    c = G['samengesteld'][w]; v = NG[w]['getal']
    return f'{c}/{v}' if G['returning'].get(w) == c else str(v)
ov_labels = [
 (t('Elementen'), ' · '.join(f"{nm(k['element'])} {k['aantal']}" for k in F['el_kaarten'])),
 (t('Kernidentiteit'), f"{nm('Zon')} {PL['Zon']['teken']} H{PL['Zon']['huis']}"),
 (t('Emotioneel kompas'), f"{nm('Maan')} {PL['Maan']['teken']} H{PL['Maan']['huis']}"),
 (t('Zielrichting'), f"NN {NK['teken']} H{NK['huis']}"),
 (t('Levensthema'), f"{t('Levenspad')} {F['levenspad']}" + (f" ({OT['getal']})" if OT else '') + f" / PJ {F['pj']}"),
 (t('Naamgetallen'), f"{samengesteld('uitdrukking')} · {samengesteld('zielenurge')} · {samengesteld('persoonlijkheid')} · keynote {key}"),
 (t('Tikkun'), None),
 (t('Schaduwthema'), f"{t('ZN')} {ZK['teken']} H{ZK['huis']}")]
ovt = '<table>' + ''.join(f'<tr><td class="k">{lab}' + (f'<br><span class="small">{sm}</span>' if sm else '') + f'</td><td>{e(txt)}</td></tr>'
                          for (lab, sm), txt in zip(ov_labels, O['rijen'])) + '</table>'
parts.append(sec(t('09 — Overzicht &amp; Samenvatting'), t('{naam} in <em>één zin</em>', naam=NAAM), None,
 f'<div class="note"><p>"{e(O["een_zin"])}"</p></div>' + OVERZICHT_P + ovt))

parts.append(full(IMG['deel3'], t('Deel III · Waar ga ik heen? Hoe leef ik dit?'), t('Integratie'),
 t('Het sluitstuk en tegelijk het moeilijkste. Kennis is niet genoeg. Hier staat hoe je dit leeft: je flow, je reflectievragen, je ritme, je praktijken, je prompts, je kalender en de toestemming die je jezelf mag geven. Concreet, dagelijks, in jouw eigen tempo.')))

# ---------- 03 Flow ----------
FL = C['flow']
parts.append(sec(t('03 — Leven vanuit flow'), 'Sin · Sinn · Zin', None, FLOW_INTRO + ps(FL['alineas'])
 + cards([f"<div class=\"lab\">{t(lab)}</div>{h3(e(x['plaatsing']))}<p>{e(x['tekst'])}</p>"
          for lab, x in zip(('Sin · masculien', 'Sinn · feminien', 'Zin · creatie'), FL['kaarten'])], 3)
 + f'<h2>{t("Vijf reflectievragen over jouw flow")}</h2><ol class="q">' + ''.join(f'<li>{e(q)}</li>' for q in FL['vragen']) + '</ol>'))

parts.append(sec(t('10 — Reflectievragen'), t('10 journaling-vragen'), None, REFLECT_INTRO
 + '<ol class="q">' + ''.join(f'<li>{e(q)}</li>' for q in C['reflectie']) + '</ol>'))

# ---------- 11 Ritme ----------
R = C['ritme']
parts.append(sec(t('11 — Werken met de energie'), t('Jouw <em>ritme</em>'), t('Jouw dagelijkse en seizoensritme op basis van jouw kaart.'), RITME_INTRO + RITME_P2
 + f"<p>{e(R['alinea'])}</p>"
 + cards([f"<div class=\"lab\">{t(lab)}</div>{h3(e(x['titel']))}<p>{e(x['tekst'])}</p>"
          for lab, x in zip(('Ochtend', 'Werk &amp; focus', 'Lichaam &amp; ritme', 'Hart &amp; verbinding', 'Avond &amp; herstel', 'Seizoen'), R['kaarten'])], 3)))

# ---------- 12 Integratie ----------
I = C['integratie']
gaven = cards([f"<div class=\"lab\">{t('Gave 0')}{i + 1}</div>{h3(t(gn))}<p>{e(tx)}</p>"
               for i, (gn, tx) in enumerate(zip(('Intuïtie', 'Verbeeldingskracht', 'Geheugen', 'Redeneren', 'Perceptie', 'Wilskracht'), I['gaven']))], 2, cls='plain')
practs = ''.join(f"<div class=\"avoid\"><div class=\"lab\">{t('Praktijk 0')}{i + 1}</div>{h3(e(x['titel']))}<p>{e(x['tekst'])}</p></div>" for i, x in enumerate(I['praktijken']))
prom = ''.join(f"<div class=\"prompt\"><span class=\"lab\">{t('Prompt 0')}{i + 1} — {t('Astrologie') if i < 3 else t('Schaduwwerk')} · {e(x['onderwerp'])}</span>{e(x['tekst'])}<button class=\"copy\" data-copy>{t('Kopieer')}</button></div>"
               for i, x in enumerate(I['prompts']))
KLEUR = ['#B8862B', '#6E7B5A', '#8B5E3C', '#5B6E8A', '#7A4E6B', '#4E7A6E']
months = []
for i, (m, x) in enumerate(zip(F['maanden'], I['maanden'])):
    lab = t('Persoonlijke maand {pm}', pm=m['pm']) + (t(' · nieuw Persoonlijk Jaar {pj}', pj=m['pj']) if m['nieuw_pj'] else '')
    months.append((m['naam'], m['pm'], e(x['titel']), lab, e(x['tekst']), e(x['transits']), KLEUR[i]))
cal = ''
for i in range(0, 6, 3):
    cal += '<div class="cal">' + ''.join(f'<div style="border-top-color:{c}"><div class="lab">{m}</div><div class="num" style="color:{c}">{n}</div><div class="mt">{ti}</div><div class="lab">{l}</div><p>{d}</p><hr><div class="lab">{t("Transits")}</div><p>{tr}</p></div>' for m, n, ti, l, d, tr, c in months[i:i + 3]) + '</div>'
m0, m5 = F['maanden'][0], F['maanden'][-1]
pj_zin = t('Je persoonlijke maandgetallen zijn berekend vanuit Persoonlijk Jaar {pj}', pj=m0['pj']) + (t(', en vanaf januari vanuit Persoonlijk Jaar {pj}', pj=m5['pj']) if m5['jaar'] != m0['jaar'] else '') + '.'
mnd = (lambda m: m['naam'].lower()) if LANG == 'nl' else (lambda m: m['naam'])
parts.append(sec(t('12 — Integratie'), t('Jouw persoonlijke <em>upgrade-plan</em>'), None,
 f"<div class=\"note t\"><div class=\"lab\">{t('Jouw vier lagen op dit moment')}</div><p>{e(I['lagen'])}</p></div>" + INTEGRATIE_VAST_A
 + f"<h2>{t('Jouw schaduwkanten zijn niet je vijanden')}</h2><p>{e(I['schaduw'])}</p>"
 + ZES_GAVEN + f'<h2>{t("Hoe jouw zes gaven oplichten in je kaart")}</h2>' + gaven
 + f"<h2>{t('De adem als sleutel')}</h2><p>{e(I['adem'])}</p>"
 + INTEGRATIE_VAST_B + f'<h2>{t("Dagelijkse praktijken")}</h2>' + practs + PROMPT_INTRO + prom
 + f"<h2>{t('Persoonlijke kalender · {m0} tot {m5}', m0=mnd(m0), m5=mnd(m5))}</h2>"
 + f"<p>{pj_zin}{t(' Elke maand draagt een eigen kleur van energie, en onder elke maand staan de transits die in die maand precies op jouw kaart vallen. Hoe bewuster je dit ritme volgt, hoe meer je meebeweegt met de stroom van je jaar.')}</p>"
 + cal))

# ---------- Inner Permissions ----------
ELEM8 = [t(x) for x in ('Vuur', 'Vuur', 'Lucht', 'Lucht', 'Aarde', 'Aarde', 'Water', 'Water')]
permh = cards([f"<div class=\"lab\">{el}</div>{h3(e(x['tekst']))}<p class=\"small\">{e(x['uitleg'])}</p><div class=\"sig\"><span>{t('Handtekening')}</span><span>{t('Datum')}</span></div>"
               for el, x in zip(ELEM8, C['permissions'])], 2, cls='perm')
parts.append(sec(t('Integratie · Inner Permissions'), t('De toestemming die je jezelf mag geven'),
 t('Inner Permissions zijn briefjes waarop staat wat je jezelf mag toestaan, omdat niemand anders die toestemming gaat geven. Lees ze hardop. Onderteken degene die het meest schuurt.'),
 permh + f"<div class=\"note\"><div class=\"lab\">{t('De zin om mee te nemen')}</div><p>{e(C['zin'])}</p></div>"))

parts.append(quotepage(IMG['integ'], t('Integratie'), e(C['integratie_quote'])))

# ---------- 13 Verdieping ----------
PJ_THEMA = {1: 'nieuw begin', 2: 'samenwerking', 3: 'expressie', 4: 'opbouw', 5: 'verandering', 6: 'zorg en thuis',
            7: 'inkeer', 8: 'oogst', 9: 'afronding', 11: 'inzicht', 22: 'bouwen', 33: 'dienstbaarheid'}
slot = [str(a).strip() for a in C['tot_slot'] if str(a).strip()]
if not slot[-1].endswith('Remember who you are.'):
    slot[-1] += ' Remember who you are.'
parts.append(sec(t('13 — Verdieping'), t('Waar ga je <em>vanaf hier</em> naartoe?'), None,
 VERDIEPING_INTRO.replace(t('juist nu je in een jaar van oogst staat'), t('juist nu je in een jaar van {thema} staat', thema=t(PJ_THEMA[F['pj']])))
 + VERDIEPING_OPTIES + VERDIEPING_VIER + f'<h2>{t("Tot slot")}</h2>' + ps(slot) + BRONNEN))

parts.append(SLOT_QUOTE)
parts.append(f"""<section class="back"><img src="{LOGO}" alt="SZINN"><div class="rq">"Remember who you are."</div>
SZINN Alignment Blueprint™ · {NAAM} · {F['geboortedatum']} · {e(F['geboorteplaats'])}<br>{t('Gegenereerd')} {MAAND_JAAR} · {t('Gefaciliteerd door')} Elly Elizabeth Korving · SZINN · szinn.ai<br>© {MAAND_JAAR.split()[-1]} Elly Elizabeth Korving · Alterego BV · All rights reserved<br>
{t('Dit document is persoonlijk en vertrouwelijk. De SZINN-methodologie en de opbouw van dit document zijn beschermd; niets uit dit document mag worden verveelvoudigd zonder de uitdrukkelijke schriftelijke toestemming van Alterego BV.')}</section>""")

html_print = f'<!DOCTYPE html><html lang="{LANG}"><head><meta charset="utf-8"><title>SZINN Alignment Blueprint · {NAAM}</title><style>{CSS.replace("__FOOT__", FOOT)}</style></head><body>' + '\n'.join(parts) + '</body></html>'
import unicodedata
base = 'SZINN_Alignment_Blueprint_' + re.sub(r'[^A-Za-z0-9]+', '_', unicodedata.normalize('NFKD', NAAM).encode('ascii', 'ignore').decode()).strip('_') + '_3delen'
open(base + '_print.html', 'w').write(html_print)
maxerr = 0
for n, (x, y, rr) in coords.items():
    phi = math.degrees(math.atan2(-(y - mandala.CY), x - mandala.CX)); lon = (phi - 180 + mandala.ASC) % 360
    true = mandala.pos[n]['lon'] if n in mandala.pos else mandala.SN
    maxerr = max(maxerr, abs((lon - true + 180) % 360 - 180) / 360 * 2 * math.pi * rr)
print('ok, mandala max px error', round(maxerr, 4))
assert maxerr <= 2, 'mandala wijkt meer dan 2 px af'
import weasyprint
weasyprint.HTML(filename=base + '_print.html').write_pdf(base + '.pdf', presentational_hints=True)
print('pdf ok', base)

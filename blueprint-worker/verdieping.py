# -*- coding: utf-8 -*-
"""SZINN · verdieping van de geboortekaart. Wat betaalde astrologie-API's als extra leveren (waardigheden, chartheerser,
eindheerser, aspectpatronen, maanfase, halfronden, progressies, levenscycli), hier lokaal berekend met dezelfde Swiss
Ephemeris als chart.py: geen geboortegegevens naar derden. Levert regels tekst voor de FEITEN van de schrijflaag.
Geen graden en bij progressies geen huisnummers: audit 1d accepteert alleen die van de geboortekaart."""
import itertools, os
from datetime import date
import swisseph as swe

swe.set_ephe_path(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'kit', 'assets', 'ephe'))
TEKENS = ['Ram', 'Stier', 'Tweelingen', 'Kreeft', 'Leeuw', 'Maagd', 'Weegschaal', 'Schorpioen', 'Boogschutter', 'Steenbok', 'Waterman', 'Vissen']
TIEN = ['Zon', 'Maan', 'Mercurius', 'Venus', 'Mars', 'Jupiter', 'Saturnus', 'Uranus', 'Neptunus', 'Pluto']
HEERSER = dict(Ram='Mars', Stier='Venus', Tweelingen='Mercurius', Kreeft='Maan', Leeuw='Zon', Maagd='Mercurius', Weegschaal='Venus',
               Schorpioen='Pluto', Boogschutter='Jupiter', Steenbok='Saturnus', Waterman='Uranus', Vissen='Neptunus')
KLASSIEK = dict(Schorpioen='Mars', Waterman='Saturnus', Vissen='Jupiter')
VERHEVEN = dict(Zon='Ram', Maan='Stier', Mercurius='Maagd', Venus='Vissen', Mars='Steenbok', Jupiter='Kreeft', Saturnus='Weegschaal')
FASEN = ['nieuwe maan (begin, instinct)', 'wassende sikkel (doorzetten)', 'eerste kwartier (actie, knopen doorhakken)',
         'wassende maan (verfijnen, verbeteren)', 'volle maan (bewustzijn, relaties)', 'afnemende maan (delen, doorgeven)',
         'laatste kwartier (heroverwegen, oude vormen loslaten)', 'balsamische maan (afronden, voorbereiden op iets nieuws)']
GEBIED = {1: 'jezelf en hoe je binnenkomt', 2: 'geld, bezit en eigenwaarde', 3: 'praten, leren en je directe omgeving',
          4: 'thuis, familie en je wortels', 5: 'plezier, creativiteit en kinderen', 6: 'je werkdag, gewoontes en gezondheid',
          7: 'relaties en samenwerking', 8: 'intimiteit, vertrouwen en gedeelde zaken', 9: 'reizen, studie en zingeving',
          10: 'roeping, werk en hoe de wereld je ziet', 11: 'vrienden, groepen en toekomstdromen', 12: 'rust, binnenwereld en afronding'}
CYCLI = [('Saturnus-return', swe.SATURN, 0, 26, 31), ('Uranus-oppositie', swe.URANUS, 180, 37, 45),
         ('Chiron-return', swe.CHIRON, 0, 46, 53), ('tweede Saturnus-return', swe.SATURN, 0, 56, 61)]
JAAR = 365.2422


def tegen(t): return TEKENS[(TEKENS.index(t) + 6) % 12]
def lijst(xs): return ', '.join(xs[:-1]) + ' en ' + xs[-1] if len(xs) > 1 else xs[0]
def lon(jd, p): return swe.calc_ut(jd, p)[0][0]


def huis(l, cusps):
    for i in range(12):
        s, e = cusps[i], cusps[(i + 1) % 12]
        if (l - s) % 360 < (e - s) % 360:
            return i + 1


def progressies(chart, leeftijd):
    """Secundaire progressie: de stand op dag N na de geboorte staat voor levensjaar N."""
    jd0, cusps = chart['jd_ut'], chart['cusps']
    jp = jd0 + leeftijd
    uit = []
    for n, p, uitleg in (('Zon', swe.SUN, 'hoe je identiteit zich door de jaren ontwikkelt'), ('Maan', swe.MOON, 'je emotionele seizoen van nu')):
        l = lon(jp, p)
        snel = (lon(jp + 1, p) - l) % 360          # graden per levensjaar
        sinds, tot = leeftijd - l % 30 / snel, leeftijd + (30 - l % 30) / snel
        if n == 'Zon':
            wanneer = (f'sinds je {int(sinds)}e' if sinds > 0 else 'al sinds je geboorte') + f', wisselt rond je {int(tot)}e naar {TEKENS[(TEKENS.index(teken(l)) + 1) % 12]}'
        else:
            maanden = max(1, round((tot - leeftijd) * 12))
            wanneer = f'nog ongeveer {maanden} maanden, daarna {TEKENS[(TEKENS.index(teken(l)) + 1) % 12]}'
        uit.append(f'Geprogresseerde {n} ({uitleg}): in {teken(l)}, {wanneer}; levensgebied: {GEBIED[huis(l, cusps)]}')
    fase = (lon(jp, swe.MOON) - lon(jp, swe.SUN)) % 360
    uit.append(f'Geprogresseerde maanfase (levensfase van ongeveer 30 jaar): {FASEN[int(fase // 45)]}')
    return uit


def teken(l): return TEKENS[int(l % 360 // 30)]


def waardigheden(pos):
    out = []
    for n in TIEN[:7]:
        t = pos[n]['sign']
        thuis = [s for s, h in list(HEERSER.items()) + list(KLASSIEK.items()) if h == n]
        if t in thuis: out.append(f'{n} in {t}: in eigen teken (werkt makkelijk en vanzelf)')
        elif t in map(tegen, thuis): out.append(f'{n} in {t}: tegenover eigen teken (moet het op een eigen manier leren)')
        if VERHEVEN[n] == t: out.append(f'{n} in {t}: verheven (komt op zijn best tot uiting)')
        elif tegen(VERHEVEN[n]) == t: out.append(f'{n} in {t}: in val (vraagt meer bewuste aandacht)')
    return out


def heerschap(pos):
    def eind(n, gezien=()):
        h = HEERSER[pos[n]['sign']]
        return n if h == n else (None if h in gezien else eind(h, gezien + (n,)))
    eindes = {eind(n) for n in TIEN}
    uit = [f'eindheerser {eindes.pop()} (alle planeten leiden via hun tekenheerser naar deze planeet: de baas van de kaart)'] \
        if len(eindes) == 1 and None not in eindes else []
    for a, b in itertools.combinations(TIEN, 2):
        if HEERSER[pos[a]['sign']] == b and HEERSER[pos[b]['sign']] == a:
            uit.append(f'wederzijdse receptie {a} in {pos[a]["sign"]} en {b} in {pos[b]["sign"]} (elk in het teken van de ander: ze werken als team)')
    return uit


def patronen(pos, aspecten):
    asp = {(frozenset((a['a'], a['b'])), a['type']) for a in aspecten if a['a'] in TIEN and a['b'] in TIEN}
    heeft = lambda x, y, t: (frozenset((x, y)), t) in asp
    sep = lambda x, y: abs((pos[x]['lon'] - pos[y]['lon'] + 180) % 360 - 180)
    uit = []
    for a, b, c in itertools.combinations(TIEN, 3):
        if heeft(a, b, 'driehoek') and heeft(b, c, 'driehoek') and heeft(a, c, 'driehoek'):
            uit.append(f'grote driehoek {a}, {b} en {c} (een gesloten kring van gemak en talent)')
    for a, b in itertools.combinations(TIEN, 2):
        if heeft(a, b, 'oppositie'):
            uit += [f'T-kruis {a} oppositie {b}, met {c} in het midden (spanning die tot actie dwingt; {c} is het drukpunt)'
                    for c in TIEN if heeft(a, c, 'vierkant') and heeft(b, c, 'vierkant')]
        if heeft(a, b, 'sextiel'):
            uit += [f'yod: {a} en {b} wijzen samen naar {c} (het gevoel van een eigen opdracht, via {c})'
                    for c in TIEN if c not in (a, b) and abs(sep(a, c) - 150) <= 2.5 and abs(sep(b, c) - 150) <= 2.5]
    for sleutel, voor in (('sign', ''), ('house', 'huis ')):
        groep = {}
        for n in TIEN:
            groep.setdefault(pos[n][sleutel], []).append(n)
        uit += [f'stellium in {voor}{k}: {lijst(ns)} (veel energie op één plek)' for k, ns in groep.items() if len(ns) >= 3]
    return uit


def zoek(p, doel, jd0, jd1):
    """Exacte momenten waarop planeet p lengte doel raakt tussen jd0 en jd1 (ook de retrograde passages)."""
    f = lambda jd: (lon(jd, p) - doel + 180) % 360 - 180
    uit, jd, v = [], jd0, f(jd0)
    while jd < jd1:
        w = f(jd + 4)
        if (v < 0) != (w < 0) and abs(v - w) < 20:
            a, b = jd, jd + 4
            for _ in range(30):
                m = (a + b) / 2
                a, b = (m, b) if (f(m) < 0) == (v < 0) else (a, m)
            uit.append(a)
        jd, v = jd + 4, w
    return uit


def verdieping(chart, vandaag=None):
    vandaag = vandaag or date.today()
    pos, jd0 = chart['pos'], chart['jd_ut']
    leeftijd = (swe.julday(vandaag.year, vandaag.month, vandaag.day, 12) - jd0) / JAAR
    at = TEKENS[int(chart['asc'] // 30)]
    ch = HEERSER[at]
    regels = [f"Chartheerser (heerser van de Ascendant in {at}): {ch} in {pos[ch]['sign']}, huis {pos[ch]['house']}"
              + (f"; klassieke heerser {KLASSIEK[at]} in {pos[KLASSIEK[at]]['sign']}, huis {pos[KLASSIEK[at]]['house']}" if at in KLASSIEK else '')]
    regels += ['Waardigheid: ' + x for x in waardigheden(pos)]
    regels += ['Heerschap: ' + x for x in heerschap(pos)]
    regels += ['Aspectpatroon: ' + x for x in patronen(pos, chart['aspecten'])]
    regels.append(f"Maanfase bij geboorte: {FASEN[int((pos['Maan']['lon'] - pos['Zon']['lon']) % 360 // 45)]}")
    boven = sum(pos[n]['house'] >= 7 for n in TIEN)
    oost = sum(pos[n]['house'] in (10, 11, 12, 1, 2, 3) for n in TIEN)
    regels.append(f'Halfronden (tien planeten): {boven} boven de horizon (naar buiten, zichtbaar) en {10 - boven} eronder (naar binnen, persoonlijk); '
                  f'{oost} aan de oostkant (eigen initiatief) en {10 - oost} aan de westkant (via anderen)')
    regels += ['Progressie: ' + x for x in progressies(chart, leeftijd)]
    for naam, p, hoek, van, tot in CYCLI:
        hits = zoek(p, (lon(jd0, p) + hoek) % 360, jd0 + van * JAAR, jd0 + tot * JAAR)
        if hits:
            a, b = (hits[0] - jd0) / JAAR, (hits[-1] - jd0) / JAAR
            status = 'nu bezig' if a - 1 <= leeftijd <= b + 1 else ('achter je' if leeftijd > b else 'komt nog')
            regels.append(f'Levenscyclus {naam}: rond je {int(a)}e ({status})')
    return regels


if __name__ == '__main__':
    # zelftest: geboren een dag na de volle maan van 21 jan 2000; Saturnus keert medio 2028 terug op 10° Stier
    import json, subprocess, sys, tempfile
    uit = os.path.join(tempfile.mkdtemp(), 'c.json')
    subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'kit', 'scripts', 'chart.py'), '--datum', '2000-01-22',
                    '--tijd', '05:40', '--tz', '1', '--lat', '52.37', '--lon', '4.89', '--out', uit], check=True, capture_output=True)
    r = verdieping(json.load(open(uit)), date(2026, 9, 28))
    print('\n'.join(r))
    assert any('volle maan' in x for x in r)
    assert any(x.startswith('Levenscyclus Saturnus-return: rond je 28e (komt nog)') for x in r)
    assert not any('°' in x for x in r)
    # progressie op 26 jaar: dag 26 na 22 jan 2000 is 17 feb 2000, de Zon staat dan in Waterman (Vissen pas op 19 feb)
    assert any(x.startswith('Progressie: Geprogresseerde Zon') and 'in Waterman' in x and 'naar Vissen' in x for x in r)
    print('verdieping ok')

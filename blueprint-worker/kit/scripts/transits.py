# -*- coding: utf-8 -*-
"""SZINN · transits en lunaties voor de kalender (zes maanden vanaf de opleveringsmaand).  v4.9

Gebruik:  python3 transits.py klant_chart.json 2026-10 [aantal_maanden=6] [tijdzone=Europe/Amsterdam]

De tijdzone is die van de WOONPLAATS van de klant (IANA-naam, bv. Europe/Amsterdam, Europe/London),
niet die van de geboorteplaats. Zomer- en wintertijd worden per datum vanzelf goed toegepast.

Wat er veranderd is ten opzichte van v4.8 (zie masterprompt v4.9, 0J):
  1. Het exacte moment wordt per transit tot op de minuut bepaald (nulpunt zoeken), en pas DAARNA
     omgezet naar de lokale datum. Voorheen werd per dag om 00:00 UT gekeken en de dichtstbijzijnde
     middernacht gekozen: elke transit die na 12:00 UT exact werd, kwam een dag te laat in de kalender.
  2. "exact" betekent: de transitplaneet komt werkelijk op de exacte graad (de afstand gaat door nul).
     Komt hij er niet (keert hij eerder om), dan heet het "bijna exact" met de kleinste orb in boogminuten.
     Voorheen heette alles onder 0,5 graden "exact", ook als de planeet ervoor stilstond en omkeerde.
  3. Vaste tijdzone (+1) vervangen door de echte lokale tijd per datum.
"""
import sys, json, os
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
import swisseph as swe

HERE = os.path.dirname(os.path.abspath(__file__))
for p in (os.path.join(HERE, '..', 'assets', 'ephe'), os.path.join(HERE, 'ephe'), os.path.join(HERE, '..', 'ephe')):
    if os.path.isdir(p):
        swe.set_ephe_path(p); break

S = ['Ram','Stier','Tweelingen','Kreeft','Leeuw','Maagd','Weegschaal','Schorpioen','Boogschutter','Steenbok','Waterman','Vissen']
T = [('Jupiter', swe.JUPITER), ('Saturnus', swe.SATURN), ('Uranus', swe.URANUS),
     ('Neptunus', swe.NEPTUNE), ('Pluto', swe.PLUTO), ('Chiron', swe.CHIRON)]
A = {0: 'conjunct', 60: 'sextiel', 90: 'vierkant', 120: 'driehoek', 180: 'oppositie'}
STAP = 0.25          # scanstap in dagen (6 uur); ruim voldoende voor Jupiter t/m Pluto en Chiron
BIJNA = 1.0          # kleinste orb (graden) waaronder een niet-exacte nadering nog wordt gemeld

def fmt(l):
    """graad en boogminuten, afgekapt (niet afgerond), zoals in de rest van de Blueprint"""
    d = l % 30; return f"{int(d)}°{int((d - int(d)) * 60):02d}' {S[int(l // 30) % 12]}"

def wrap(x): return (x + 180.0) % 360.0 - 180.0
def lon(p, jd): return swe.calc_ut(jd, p)[0][0]

def lokaal(jd, tz):
    y, m, d, h = swe.revjul(jd)
    utc = datetime(y, m, d, tzinfo=timezone.utc) + timedelta(hours=h)
    return utc.astimezone(tz)

def bisect(f, a, b):
    fa = f(a)
    for _ in range(40):                     # 40 halveringen: ruim onder een minuut
        mid = (a + b) / 2; fm = f(mid)
        if (fa <= 0) == (fm <= 0): a, fa = mid, fm
        else: b = mid
    return (a + b) / 2

def minimum(f, a, b):
    for _ in range(60):                     # ternair zoeken naar de kleinste |orb|
        m1, m2 = a + (b - a) / 3, b - (b - a) / 3
        if f(m1) < f(m2): b = m2
        else: a = m1
    return (a + b) / 2

def main():
    ch = json.load(open(sys.argv[1]))
    y0, m0 = map(int, sys.argv[2].split('-'))
    N = int(sys.argv[3]) if len(sys.argv) > 3 else 6
    tzarg = sys.argv[4] if len(sys.argv) > 4 else 'Europe/Amsterdam'
    try:
        float(tzarg)
        sys.exit("Geef de tijdzone als IANA-naam (bv. Europe/Amsterdam), niet als getal: een vaste offset negeert zomer- en wintertijd.")
    except ValueError:
        tz = ZoneInfo(tzarg)

    cusps = ch['cusps']
    def house(l):
        for i in range(12):
            a, b = cusps[i], cusps[(i + 1) % 12]
            if (l - a) % 360 < (b - a) % 360: return i + 1

    nat = {n: v['lon'] for n, v in ch['pos'].items()}
    nat['Ascendant'] = ch['asc']; nat['Midhemel'] = ch['mc']

    ym = [((y0 * 12 + m0 - 1 + k) // 12, (m0 - 1 + k) % 12 + 1) for k in range(N + 1)]
    # venster in lokale tijd: 1e van de startmaand 00:00 tot 1e van de maand na de laatste
    def jd_lokaal(y, m):
        dt = datetime(y, m, 1, tzinfo=tz).astimezone(timezone.utc)
        return swe.julday(dt.year, dt.month, dt.day, dt.hour + dt.minute / 60)
    j0, j1 = jd_lokaal(*ym[0]), jd_lokaal(*ym[-1])

    regels = []
    for tn, tp in T:
        for nn, nl in nat.items():
            for ang, nm in A.items():
                doelen = [nl + ang] if ang in (0, 180) else [nl + ang, nl - ang]
                for doel in doelen:
                    # v5.0 #19: één huis per transit, het huis van de geraakte graad. Staat die vlak op een cusp, dan gaf
                    # house(L) per passage (direct/retrograde) een ander huis; zo is het overal hetzelfde.
                    hd = house(doel % 360)
                    g = lambda jd: wrap(lon(tp, jd) - doel)
                    t = j0 - STAP; gp = g(t); prev_abs = [abs(gp)]
                    hist = []
                    while t < j1 + STAP:
                        t2 = t + STAP; g2 = g(t2)
                        # 1. echte doorgang door nul = exact
                        if abs(gp) < 5 and abs(g2) < 5 and (gp <= 0) != (g2 <= 0):
                            te = bisect(g, t, t2)
                            if j0 <= te < j1:
                                L = lon(tp, te)
                                regels.append((te, f"{tn} {nm} natale {nn} · exact · transit {fmt(L)}, huis {hd}"))
                        hist.append((t, abs(gp)))
                        t, gp = t2, g2
                    hist.append((t, abs(gp)))
                    # 2. lokaal minimum zonder doorgang = bijna exact (stilstand vlak voor de graad)
                    for i in range(1, len(hist) - 1):
                        (ta, a), (tb, b), (tc, c) = hist[i - 1], hist[i], hist[i + 1]
                        if b <= a and b < c and b < BIJNA:
                            tm = minimum(lambda jd: abs(g(jd)), ta, tc)
                            om = abs(g(tm))
                            if om > 1 / 60 and j0 <= tm < j1:   # boven 1 boogminuut: niet exact
                                L = lon(tp, tm)
                                regels.append((tm, f"{tn} {nm} natale {nn} · bijna exact, komt tot op {int(om * 60)}' en keert om · transit {fmt(L)}, huis {hd}"))

    print(f"== Transits (tijdzone {tzarg}; 'exact' = de planeet bereikt de exacte graad) ==")
    for te, txt in sorted(regels):
        d = lokaal(te, tz)
        print(f"  {d:%d-%m-%Y %H:%M}  {txt}")

    print('== Nieuwe en volle manen ==')
    el = lambda jd: (lon(swe.MOON, jd) - lon(swe.SUN, jd)) % 360
    jd = j0
    while jd < j1:
        for kind, t in (('Nieuwe maan', 0), ('Volle maan', 180)):
            a = wrap(el(jd) - t); b = wrap(el(jd + .25) - t)
            if a < 0 <= b and abs(a - b) < 30:
                te = bisect(lambda x: wrap(el(x) - t), jd, jd + .25)
                L = lon(swe.MOON, te)
                hits = [f"{nn} {abs(wrap(L - nl)):.1f}°" for nn, nl in nat.items() if abs(wrap(L - nl)) <= 3]
                d = lokaal(te, tz)
                print(f"  {d:%d-%m-%Y %H:%M}  {kind} · {fmt(L)} · huis {house(L)} {('· conjunct ' + ', '.join(hits)) if hits else ''}")
        jd += .25

if __name__ == '__main__':
    main()

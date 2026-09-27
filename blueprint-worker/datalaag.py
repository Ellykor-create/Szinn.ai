# -*- coding: utf-8 -*-
"""SZINN · datalaag per klant. Draait de kit-scripts (chart.py, transits.py, szinn_numerologie.py) ongewijzigd
en zet alle getallen en rekenstappen klaar voor de schrijflaag en het bouwscript. Hier wordt niets geschreven,
alleen berekend en geformatteerd."""
import json, os, re, subprocess, sys
from datetime import datetime, date
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.join(HERE, 'kit', 'scripts')
sys.path.insert(0, SCRIPTS)
from szinn_numerologie import lp, reduceer, naamgetal, naamdelen, normaliseer, splits, groeigetallen, MEESTERS  # noqa: E402

MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']
TEKENS = ['Ram', 'Stier', 'Tweelingen', 'Kreeft', 'Leeuw', 'Maagd', 'Weegschaal', 'Schorpioen', 'Boogschutter', 'Steenbok', 'Waterman', 'Vissen']
TIEN = ['Zon', 'Maan', 'Mercurius', 'Venus', 'Mars', 'Jupiter', 'Saturnus', 'Uranus', 'Neptunus', 'Pluto']
EL = {'vuur': ['Ram', 'Leeuw', 'Boogschutter'], 'lucht': ['Tweelingen', 'Weegschaal', 'Waterman'],
      'water': ['Kreeft', 'Schorpioen', 'Vissen'], 'aarde': ['Stier', 'Maagd', 'Steenbok']}
MOD_NAAM = {'hoofd': 'hoofdtekens', 'vast': 'vaste tekens', 'veranderlijk': 'veranderlijke tekens'}
TELWOORD = ['nul', 'één', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven', 'acht', 'negen', 'tien']
MEESTER_NAAM = {11: 'de ziener', 22: 'de meesterbouwer', 33: 'de meesterleraar'}


def py():
    return os.environ.get('PYTHON', sys.executable)


def tz_offset(tzname, datum, tijd):
    """UTC-offset die op het geboortemoment gold. Masterprompt 3.1: Nederland vóór 1977 altijd UTC+1."""
    y, m, d = map(int, datum.split('-')); hh, mm = map(int, tijd.split(':'))
    if (not tzname or tzname == 'Europe/Amsterdam') and y < 1977:
        return 1.0
    return ZoneInfo(tzname or 'Europe/Amsterdam').utcoffset(datetime(y, m, d, hh, mm)).total_seconds() / 3600


def run_chart(job_dir, datum, tijd, tz, lat, lon):
    out = os.path.join(job_dir, 'klant_chart.json')
    r = subprocess.run([py(), os.path.join(SCRIPTS, 'chart.py'), '--datum', datum, '--tijd', tijd, '--tz', str(tz),
                        '--lat', str(lat), '--lon', str(lon), '--out', out], capture_output=True, text=True, check=True)
    return json.load(open(out)), r.stdout


def run_transits(chart_path, jaar, maand, n=6, tz=1.0):
    """transits.py ongewijzigd draaien en de uitvoer per kalendermaand groeperen."""
    r = subprocess.run([py(), os.path.join(SCRIPTS, 'transits.py'), chart_path, f'{jaar}-{maand:02d}', str(n), str(tz)],
                       capture_output=True, text=True, check=True)
    per = {}
    for line in r.stdout.splitlines():
        m = re.search(r'(\d{1,2})-(\d{1,2})-(\d{4})', line)
        if not m or line.startswith('=='):
            continue
        d, mo, y = map(int, m.groups())
        tekst = line.strip().replace(m.group(0), f'{d} {MAANDEN[mo - 1]}', 1)
        soort = 'maanfasen' if ('Nieuwe maan' in line or 'Volle maan' in line) else 'transits'
        per.setdefault((y, mo), {'transits': [], 'maanfasen': []})[soort].append(tekst)
    return per, r.stdout


# ---------- rekenstappen als tekst ----------
def keten(n):
    out = [n]
    while n > 9 and n not in MEESTERS:
        n = sum(int(c) for c in str(n)); out.append(n)
    return out


def pijl(k):
    return ' → '.join(map(str, k))


def datum_stappen(d, m, j):
    delen = [keten(d), keten(m), keten(j)]
    vals = [k[-1] for k in delen]
    tot = keten(sum(vals))
    return f"{' · '.join(pijl(k) for k in delen)} · {' + '.join(map(str, vals))} = {pijl(tot)}", tot[-1]


def naam_stappen(naam, welke):
    val, sub = naamgetal(naam, welke)
    items = []
    for deel, (red, s) in zip(naamdelen(naam), sub):
        kl, mk = splits(deel)
        letters = normaliseer(deel) if welke == 'uitdrukking' else (' '.join(kl if welke == 'zielenurge' else mk) or '—')
        items.append(f'{letters} {pijl(keten(s))}' if s != red else f'{letters} = {s}')
    reds = [r for r, _ in sub]
    return f"{' · '.join(items)} · {' + '.join(map(str, reds))} = {pijl(keten(sum(reds)))}", val


def deg(l):
    x = l % 30
    return f"{int(x)}°{int((x - int(x)) * 60):02d}'"


def sign(l):
    return TEKENS[int(l // 30)]


def modaliteit_zin(modaliteiten):
    mods = sorted(((k, v) for k, v in modaliteiten.items() if v), key=lambda kv: -kv[1])
    delen = [f'{TELWOORD[v]} in {MOD_NAAM[k]}' for k, v in mods]
    eerste = delen[0].replace(' in ', ' staat in ' if mods[0][1] == 1 else ' staan in ', 1)
    delen = [eerste[0].upper() + eerste[1:]] + delen[1:]
    return (', '.join(delen[:-1]) + ' en ' + delen[-1] if len(delen) > 1 else delen[0]) + '.'


# ---------- de volledige datalaag ----------
def bouw(order, vandaag=None):
    """order: dict met naam, voornaam, geboortenaam, datum (JJJJ-MM-DD), tijd (UU:MM), plaats, lat, lon, tz (IANA),
    tijd_status en job_dir. Geeft (facts, chart, ruwe_uitvoer) terug."""
    vandaag = vandaag or date.today()
    job = order['job_dir']
    tz = tz_offset(order.get('tz'), order['datum'], order['tijd'])
    chart, chart_out = run_chart(job, order['datum'], order['tijd'], tz, order['lat'], order['lon'])
    tz_nu = ZoneInfo('Europe/Amsterdam').utcoffset(datetime.now()).total_seconds() / 3600
    trans, trans_out = run_transits(os.path.join(job, 'klant_chart.json'), vandaag.year, vandaag.month, 6, tz_nu)

    y, mo, d = map(int, order['datum'].split('-'))
    naam = order['geboortenaam']
    pos = chart['pos']
    planeten = {n: dict(teken=v['sign'], graad=deg(v['lon']), huis=v['house'], rx=v['rx'], txt=v['txt'])
                for n, v in pos.items()}
    asc = dict(teken=sign(chart['asc']), graad=deg(chart['asc']))
    mc = dict(teken=sign(chart['mc']), graad=deg(chart['mc']))
    zk = dict(teken=sign(chart['sn']), graad=deg(chart['sn']), huis=chart['sn_house'])

    # elementen (tien planeten), per element de plaatsingen; Asc en MC alleen als vermelding
    mx = max(chart['elementen'].values()) or 1
    el_kaarten = []
    for e in sorted(EL, key=lambda k: -chart['elementen'][k]):
        groepen = []
        for n in TIEN:
            if pos[n]['sign'] not in EL[e]:
                continue
            key = (pos[n]['sign'], pos[n]['house'])
            for g in groepen:
                if g[0] == key:
                    g[1].append(n); break
            else:
                groepen.append((key, [n]))
        wie = [f"{', '.join(ns[:-1]) + ' en ' + ns[-1] if len(ns) > 1 else ns[0]} in {k[0]}, huis {k[1]}" for k, ns in groepen]
        if asc['teken'] in EL[e]: wie.append(f"Ascendant in {asc['teken']}")
        if mc['teken'] in EL[e]: wie.append(f"Midhemel in {mc['teken']}")
        el_kaarten.append(dict(element=e, aantal=chart['elementen'][e], pct=round(chart['elementen'][e] / mx * 100),
                               wie=' · '.join(wie) or 'Geen van de tien planeten'))
    el_lead = ('Over de tien planeten gerekend krijg je deze verhouding: '
               + ', '.join(f"{k['element']} {k['aantal']}" for k in el_kaarten) + '. ' + modaliteit_zin(chart['modaliteiten']))

    # aspecttabel: tot 5°, nauwste eerst; X oppositie Noordknoop wordt X conjunct Zuidknoop
    aspecten_tabel = []
    for a in chart['aspecten']:
        if a['orb'] > 5:
            continue
        x, t, z = a['a'], a['type'], a['b']
        if 'Noordknoop' in (x, z) and t == 'oppositie':
            x, t, z = (z if x == 'Noordknoop' else x), 'conjunct', 'Zuidknoop'
        aspecten_tabel.append(dict(sleutel=f'{x} {t} {z}', orb=f"{a['orb']:.1f}".replace('.', ',') + '°'))

    # geboortetijdgevoeligheid (masterprompt 3.1 en audit 1c)
    gevoelig = []
    for n, v in pos.items():
        if v['tot_volgende_cusp'] < 0.25:
            gevoelig.append(f"{n} staat {v['tot_volgende_cusp']:.2f}° vóór de grens van huis {v['house'] % 12 + 1} (nu huis {v['house']})")
        elif v['na_eigen_cusp'] < 0.25:
            gevoelig.append(f"{n} staat {v['na_eigen_cusp']:.2f}° na het begin van huis {v['house']} (anders huis {(v['house'] - 2) % 12 + 1})")
    asc_grens = chart['asc'] % 30 < 2 or chart['asc'] % 30 > 28
    wankel = _wankel(chart)
    tijdnoot_nodig = bool(gevoelig or asc_grens or wankel) or order.get('tijd_status') == 'benadering'

    # numerologie
    lp_stappen, LP = datum_stappen(d, mo, y)
    assert LP == lp(d, mo, y)[0]
    vlak = keten(sum(int(c) for c in f'{d}{mo}{y}'))
    ondertoon = None
    if vlak[-1] in MEESTERS and vlak[-1] != LP:
        ondertoon = dict(getal=vlak[-1], naam=MEESTER_NAAM[vlak[-1]], som=' + '.join(f'{d}{mo}{y}') + f' = {pijl(vlak)}')
    PJ = lp(d, mo, vandaag.year)[0]; PJ2 = lp(d, mo, vandaag.year + 1)[0]
    naamgetallen = {}
    for w in ('uitdrukking', 'zielenurge', 'persoonlijkheid'):
        st, val = naam_stappen(naam, w)
        naamgetallen[w] = dict(getal=val, stappen=st)
    maanden = []
    for k in range(6):
        jj, mm = (vandaag.year * 12 + vandaag.month - 1 + k) // 12, (vandaag.month - 1 + k) % 12 + 1
        pjm = lp(d, mo, jj)[0]
        t = trans.get((jj, mm), {'transits': [], 'maanfasen': []})
        maanden.append(dict(naam=f'{MAANDEN[mm - 1].capitalize()} {jj}', maand=mm, jaar=jj, pj=pjm,
                            pm=reduceer(pjm + mm), nieuw_pj=(mm == 1 and k > 0), **t))

    facts = dict(
        naam=order['naam'], voornaam=order['voornaam'], geboortenaam=naam,
        geboortedatum=f'{d} {MAANDEN[mo - 1]} {y}', dag=d, maand=mo, jaar=y,
        geboortetijd=order['tijd'], geboorteplaats=order['plaats'], tijd_status=order.get('tijd_status') or 'exact',
        tz=tz, lat=order['lat'], lon=order['lon'], oplevering=f'{MAANDEN[vandaag.month - 1]} {vandaag.year}',
        planeten=planeten, asc=asc, mc=mc, zuidknoop=zk, elementen=chart['elementen'], modaliteiten=chart['modaliteiten'],
        el_kaarten=el_kaarten, el_lead=el_lead, huizen_telling=chart['huizen_telling'],
        aspecten_alle=[f"{a['a']} {a['type']} {a['b']} (orb {a['orb']}°)" for a in chart['aspecten']],
        aspecten_tabel=aspecten_tabel, asc_marge_min=chart['asc_tekenwissel_marge_min'],
        gevoelig=gevoelig, asc_grens=asc_grens, wankel=sorted(wankel), tijdnoot_nodig=tijdnoot_nodig,
        levenspad=LP, lp_stappen=lp_stappen, geboortedag=reduceer(d), gd_stappen=pijl(keten(d)),
        pj=PJ, pj_jaar=vandaag.year, pj_stappen=datum_stappen(d, mo, vandaag.year)[0],
        pj2=PJ2, pj2_jaar=vandaag.year + 1, pj2_stappen=datum_stappen(d, mo, vandaag.year + 1)[0],
        ondertoon=ondertoon, naamgetallen=naamgetallen, groei=groeigetallen(naam, d, mo, y), maanden=maanden,
        retrograde=[n for n in TIEN + ['Chiron'] if pos[n]['rx']],
    )
    return facts, chart, chart_out + '\n' + trans_out


def _wankel(chart):
    """Planeten die van huis wisselen bij ±2 minuten geboortetijd of ±0,01° coördinaten (dezelfde toets als audit.py 1c)."""
    import swisseph as swe
    swe.set_ephe_path(os.path.join(SCRIPTS, '..', 'assets', 'ephe'))
    inv, jd, out = chart['invoer'], chart['jd_ut'], set()

    def house(l, cs):
        for i in range(12):
            s, e = cs[i], cs[(i + 1) % 12]
            if (l - s) % 360 < (e - s) % 360: return i + 1
    for dt in (-2 / 1440, 2 / 1440):
        for dl in (-0.01, 0.01):
            cs = swe.houses(jd + dt, inv['lat'] + dl, inv['lon'] + dl, b'P')[0]
            out |= {n for n, v in chart['pos'].items() if house(v['lon'], cs) != v['house']}
    return out


if __name__ == '__main__':
    # zelftest tegen de voorbeelden uit masterprompt v4 (sectie 3.2) en de tijdzoneregel (3.1)
    assert datum_stappen(15, 8, 2026) == ('15 → 6 · 8 · 2026 → 10 → 1 · 6 + 8 + 1 = 15 → 6', 6)
    assert datum_stappen(15, 8, 2027)[1] == 7   # 2027 → 11 blijft meestergetal: 6 + 8 + 11 = 25 → 7
    assert keten(38) == [38, 11]
    assert tz_offset('Europe/Amsterdam', '1972-07-10', '14:00') == 1.0
    assert tz_offset('Europe/Amsterdam', '1990-07-10', '14:00') == 2.0
    assert modaliteit_zin({'vast': 5, 'veranderlijk': 3, 'hoofd': 2}) == 'Vijf staan in vaste tekens, drie in veranderlijke tekens en twee in hoofdtekens.'
    print('datalaag ok')

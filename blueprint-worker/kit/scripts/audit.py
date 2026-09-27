# -*- coding: utf-8 -*-
"""SZINN · audit vóór oplevering (drievoudige controle, zie masterprompt sectie 9).
Gebruik:
  python3 audit.py klant_chart.json klant_print.html "Volledige Geboortenaam" DD MM JJJJ [--andere MAP] [--intake intake.txt]
  --andere  map met eerder opgeleverde Blueprints (.pdf/.html/.txt) om overgenomen persoonlijke tekst en andermans namen te vinden
  --intake  de intake-antwoorden van deze klant als tekst; elk citaat in het document moet daar letterlijk in staan
Eindigt op 'OK, klaar voor oplevering' of op het aantal problemen. Bij problemen: niet opleveren, bron aanpassen, opnieuw bouwen."""
import sys, os, json, re, html, argparse, glob, unicodedata
import swisseph as swe
from szinn_numerologie import *
from szinn_vast import *
import szinn_vast
HERE=os.path.dirname(os.path.abspath(__file__)); swe.set_ephe_path(os.path.join(HERE,'..','assets','ephe'))
ap=argparse.ArgumentParser(); ap.add_argument('chart'); ap.add_argument('html'); ap.add_argument('naam'); ap.add_argument('d',type=int); ap.add_argument('m',type=int); ap.add_argument('j',type=int)
ap.add_argument('--andere'); ap.add_argument('--intake'); a=ap.parse_args()
ch=json.load(open(a.chart)); H=open(a.html).read(); H=re.sub(r'data:[^)"]+','',H); H=re.sub(r'<style.*?</style>','',H,flags=re.S)  # CSS (paginavoet, fontpaden) is geen documenttekst
def plain(x): return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',x)))
T=plain(H); fout=[]
T2=plain(re.sub(r'<svg.*?</svg>|<table class="toc">.*?</table>|<div class="kicker">.*?</div>|<h[123][^>]*>.*?</h[123]>','',H,flags=re.S))
def fail(msg): fout.append(msg); print('   ✗',msg)
def sectie(t): print('\n'+t)

# ============ RONDE 1 · BEREKENINGEN (drie keer, drie manieren) ============
sectie('RONDE 1 · BEREKENINGEN')
S=['Ram','Stier','Tweelingen','Kreeft','Leeuw','Maagd','Weegschaal','Schorpioen','Boogschutter','Steenbok','Waterman','Vissen']
P=[('Zon',0),('Maan',1),('Mercurius',2),('Venus',3),('Mars',4),('Jupiter',5),('Saturnus',6),('Uranus',7),('Neptunus',8),('Pluto',9),('Noordknoop',swe.TRUE_NODE),('Chiron',swe.CHIRON)]
if 'jd_ut' in ch:
    jd=ch['jd_ut']; inv=ch['invoer']
    # 1a · opnieuw rekenen met Swiss Ephemeris
    mx=max(abs(((swe.calc_ut(jd,p)[0][0])-ch['pos'][n]['lon']+180)%360-180)*60 for n,p in P)
    print(f'1a opnieuw berekend (Swiss Ephemeris): max verschil {mx:.3f} boogminuut'); mx>0.01 and fail('datalaag wijkt af van herberekening')
    # 1b · onafhankelijk planeetmodel (Moshier, zonder bestanden; Chiron niet beschikbaar)
    mx=max(abs(((swe.calc_ut(jd,p,swe.FLG_MOSEPH)[0][0])-ch['pos'][n]['lon']+180)%360-180)*60 for n,p in P[:11])
    print(f'1b onafhankelijk model (Moshier): max verschil {mx:.2f} boogminuut'); mx>1 and fail('onafhankelijk model wijkt meer dan 1 boogminuut af')
    # 1c · huizen opnieuw + gevoeligheid (±2 min, ±0,01° coördinaten)
    c,am=swe.houses(jd,inv['lat'],inv['lon'],b'P')
    d=abs((am[0]-ch['asc']+180)%360-180)*60; print(f'1c Ascendant opnieuw: verschil {d:.3f} boogminuut'); d>0.01 and fail('Ascendant wijkt af')
    def house(l,cs):
        for i in range(12):
            s,e=cs[i],cs[(i+1)%12]
            if (l-s)%360<(e-s)%360: return i+1
    wankel=set()
    for dt in (-2/1440,2/1440):
        for dl in (-0.01,0.01):
            cs=swe.houses(jd+dt,inv['lat']+dl,inv['lon']+dl,b'P')[0]
            for n in ch['pos']:
                if house(ch['pos'][n]['lon'],cs)!=ch['pos'][n]['house']: wankel.add(n)
    print('   huisplaatsing gevoelig voor ±2 minuten geboortetijd:', sorted(wankel) or 'geen')
    for n in wankel:
        if 'eboortetijdnoot' not in T and 'eboortetijd' not in T: fail(f'{n} wisselt van huis bij ±2 min, maar er staat geen geboortetijdnoot')
else:
    print('   (oude chart.json zonder jd_ut: draai chart.py opnieuw voor ronde 1a–1c)')
# 1d · elke graad, elk huis, elk aspect in de tekst tegen de datalaag
def f(l): d=l%30; return f"{int(d)}°{int((d-int(d))*60):02d}'"
ok={f(v['lon']) for v in ch['pos'].values()}|{f(ch['asc']),f(ch['mc']),f(ch['sn'])}|{f(x) for x in ch['cusps']}
g=re.findall(r"\d{1,2}°\d{2}'",T); bad=sorted(set(x for x in g if x not in ok))
print(f'1d graden in de tekst: {len(g)} vermeldingen'); bad and fail(f'graden die niet in de datalaag staan: {bad}')
nm=list(ch['pos']); hb=[]
for n in nm:
    for mm in re.finditer(n+r"[^.;()]{0,40}?,? huis (\d{1,2})",T):
        if any(o in mm.group(0) for o in nm if o!=n): continue
        if int(mm.group(1))!=ch['pos'][n]['house']: hb.append(mm.group(0))
print('   huisvermeldingen die afwijken (alleen toegestaan in de geboortetijdnoot):',hb or 'geen')
pts={n:v['lon'] for n,v in ch['pos'].items()}; pts.update(Ascendant=ch['asc'],Midhemel=ch['mc'],Zuidknoop=ch['sn'])
A={'conjunct':0,'sextiel':60,'vierkant':90,'driehoek':120,'oppositie':180}; na=0
for mm in re.finditer(r"<tr><td>(\w+) (conjunct|sextiel|vierkant|driehoek|oppositie) (\w+)</td><td>([\d,]+)°</td>",H):
    x,t,y,o=mm.groups(); na+=1; real=abs(abs((pts[x]-pts[y]+180)%360-180)-A[t])
    if abs(real-float(o.replace(',','.')))>0.06: fail(f'aspect {x} {t} {y}: tekst {o}°, werkelijk {real:.2f}°')
print(f'   aspecten in de tabel gecontroleerd: {na}')
# 1e · numerologie met twee onafhankelijke rekenwijzen
def red2(n):
    while n>9 and n not in (11,22,33): n=sum(map(int,str(n)))
    return n
lp1=lp(a.d,a.m,a.j)[0]; lp2=red2(red2(a.d)+red2(a.m)+red2(a.j))
print(f'1e Levenspad {lp1} / controle {lp2} · vlak {red2(sum(map(int,f"{a.d}{a.m}{a.j}")))} · geboortedag {reduceer(a.d)}')
lp1!=lp2 and fail('Levenspad verschilt tussen de twee rekenwijzen')
for jr in (a.j and 2026, 2027):
    p1=lp(a.d,a.m,jr)[0]; p2=red2(red2(a.d)+red2(a.m)+red2(jr)); print(f'   Persoonlijk Jaar {jr}: {p1} / controle {p2}'); p1!=p2 and fail(f'PJ {jr} verschilt')
L2={c:(ord(c)-65)%9+1 for c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'}
for w in ('uitdrukking','zielenurge','persoonlijkheid'):
    r1=naamgetal(a.naam,w)[0]; print(f'   {w}: {r1}  {naamgetal(a.naam,w)[1]}')
gg=groeigetallen(a.naam,a.d,a.m,a.j)
print('   groeigetallen: samengesteld',gg['samengesteld'],'· returning',gg['returning'] or 'geen','· keynote',gg['keynote'],'×',gg['keynote_count'],'· untrained',gg['missing'] or 'geen')
for k,v in gg['returning'].items():
    if str(v) not in T: fail(f'returning number {v} ({k}) staat niet in het document')
if not gg['returning'] and re.search(r'Returning numbers\s+(13|14|16|19)\b',T): fail('document noemt een returning number dat niet bestaat')

# ============ RONDE 2 · NIETS OVERGENOMEN VAN ANDERE BLUEPRINTS ============
sectie('RONDE 2 · OVERGENOMEN TEKST EN ANDERMANS GEGEVENS')
def zinnen(t): return [z.strip() for z in re.split(r'(?<=[.!?])\s+',t) if len(z.split())>=9]
vast=set()
for k in dir(szinn_vast):
    v=getattr(szinn_vast,k)
    if isinstance(v,str): vast.update(zinnen(plain(v)))
std=[l.strip() for l in open(os.path.join(HERE,'standaardzinnen.txt')) if l.strip() and not l.startswith('#')]
def is_std(z): return z in vast or any(x in z for x in std) or z.count(' · ')>=3 or re.match(r'^\W*(0\d|1[0-3]) ',z)
eigen=[z for z in zinnen(T2) if not is_std(z)]
T_eigen=' '.join(eigen)
blokken=[b for b in (plain(x) for x in re.split(r'</p>|</div>|</li>|</td>|</h[1-6]>|<br>|</section>|<p[ >]|<div[ >]',re.sub(r'<svg.*?</svg>|<table class="toc">.*?</table>','',H,flags=re.S))) if len(b.split())>=9]
def woorden(t): return re.findall(r"[a-zà-ÿ0-9']+",unicodedata.normalize('NFC',t.lower()))
FAIL_N, WARN_N = 14, 9   # 14+ woorden letterlijk gelijk = overname (fout); 9-13 = sjabloonzin (waarschuwing)
eerste=a.naam.split()[0]
def runs(own, other_ng, excl, n):
    out=[]; i=0
    while i<=len(own)-n:
        g=tuple(own[i:i+n])
        if g in other_ng and g not in excl:
            j=i
            while j<=len(own)-n and tuple(own[j:j+n]) in other_ng and tuple(own[j:j+n]) not in excl: j+=1
            out.append(' '.join(own[i:j+n-1])); i=j+n-1
        else: i+=1
    return out
if a.andere and os.path.isdir(a.andere):
    import pymupdf
    namen=set(); bestanden=glob.glob(os.path.join(a.andere,'*'))
    base_txt=' '.join(plain(getattr(szinn_vast,k)) for k in dir(szinn_vast) if isinstance(getattr(szinn_vast,k),str))+' '+' '.join(std)
    for fp in bestanden:
        base=os.path.basename(fp)
        mt=re.search(r'Blueprint_([A-Za-zÀ-ÿ]+)',base)
        if mt and mt.group(1)!=eerste: namen.add(mt.group(1))
        if fp.lower().endswith('.pdf'): tx=' '.join(p.get_text() for p in pymupdf.open(fp))
        elif fp.lower().endswith(('.html','.htm','.txt','.md')): tx=plain(open(fp,errors='ignore').read())
        else: continue
        tx=re.sub(r'-\s+','',tx); ow=woorden(tx); bw=woorden(base_txt); base6={tuple(bw[i:i+6]) for i in range(len(bw)-5)}
        for n,soort in ((FAIL_N,'fout'),(WARN_N,'waarschuwing')):
            other={tuple(ow[i:i+n]) for i in range(len(ow)-n+1)}; excl={tuple(bw[i:i+n]) for i in range(len(bw)-n+1)}
            for r in [r for blok in blokken for r in runs(woorden(blok),other,excl,n)]:
                rw=r.split(); cov=[False]*len(rw)
                for i in range(len(rw)-5):
                    if tuple(rw[i:i+6]) in base6:
                        for k in range(i,i+6): cov[k]=True
                if sum(cov)>=0.8*len(rw): continue   # vrijwel volledig vaste/sjabloontekst
                if soort=='fout': fail(f'{len(r.split())} woorden letterlijk gelijk aan {base}: "{r[:120]}…"')
                elif len(r.split())<FAIL_N: print(f'   ! sjabloonzin ook in {base} (herschrijf bij voorkeur): "{r}"')
    print(f'   vergeleken met {len(bestanden)} eerdere Blueprints')
    for n in sorted(namen):
        if re.search(r'\b'+re.escape(n)+r'\b',T): fail(f'naam van een andere klant in het document: {n}')
else:
    print('   geen --andere map opgegeven: overname-controle NIET uitgevoerd (verplicht vóór oplevering)'); fail('overname-controle niet uitgevoerd')
# andere voornamen dan de klant in persoonlijke tekst
print(f'   voornaam klant: {eerste} · komt {T.count(eerste)} keer voor')

# ============ RONDE 3 · NIETS VERZONNEN ============
sectie('RONDE 3 · NIETS VERZONNEN')
cit=[c for c in re.findall(r'["“]([^"”]{6,200})["”]',T)]
vastcit=set(re.findall(r'["“]([^"”]{6,200})["”]',' '.join(plain(getattr(szinn_vast,k)) for k in dir(szinn_vast) if isinstance(getattr(szinn_vast,k),str))))
eigen_cit=[c for c in cit if c not in vastcit and not c.startswith(eerste) and 'Remember who you are' not in c]
if a.intake:
    it=re.sub(r'\s+',' ',open(a.intake).read())
    for c in eigen_cit:
        if c.strip(' .') not in it: fail(f'citaat staat niet letterlijk in de intake: "{c[:90]}"')
    print(f'   citaten gecontroleerd tegen de intake: {len(eigen_cit)}')
else:
    print(f'   geen intake: citaten buiten de vaste teksten horen er niet in · gevonden: {len(eigen_cit)}')
    for c in eigen_cit:
        if ' · ' in c: continue
        fail(f'citaat zonder intake (verzonnen?): "{c[:90]}"')
# geboortegegevens overal gelijk
inv=ch.get('invoer',{})
if inv:
    y,mo,dd=inv['datum'].split('-'); maanden=['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december']
    datum_nl=f"{int(dd)} {maanden[int(mo)-1]} {y}"
    print(f'   geboortedatum "{datum_nl}" komt {T.lower().count(datum_nl)} keer voor; tijd {inv["tijd"]} {T.count(inv["tijd"])} keer')
    T.lower().count(datum_nl)==0 and fail('geboortedatum staat niet in het document')
    for mm in re.finditer(r'\b(\d{1,2}) (januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december) (19\d\d|20[01]\d)\b',T.lower()):
        if mm.group(0)!=datum_nl: fail(f'andere geboortedatum in het document: {mm.group(0)}')
# verboden claims en vormen
tx=[('em-dash in proza',r'[a-z,] — [a-z]'),('u/uw',r'\b(uw|U)\b '),('Hz',r'\bHz\b'),('oude handelsnaam',r'(?i)\b1\s?1\s?0\s+L\w*\s*(&|and|en)\s*B'),('oude signatuur','nooit verloren'),
    ('permission slips','ermission slip'),('Waarneming als gave','Gave 0\d Waarneming'),('Szinn',r'\bSzinn\b'),('zeldzaam/uniek',r'\b(zeldzaam|zeldzame|uniek)\b'),
    ('causaal',r'verklaart waarom|bewijst|is de reden dat|zorgt ervoor dat'),('medisch',r'\b(diagnose|ziekte|stoornis)\b'),('percentages/frequentie',r'\b\d+ ?(procent|%) van (alle|de) (mensen|kaarten)')]
for lab,rx in tx:
    n=len(re.findall(rx,T_eigen if lab in ('medisch','zeldzaam/uniek','causaal','percentages/frequentie') else T)); print(f'   {lab}: {n}'); n and fail(f'{lab}: {n}×')
cnt={'praktijken':H.count('Praktijk 0'),'prompts':H.count('class="prompt"'),'kalendermaanden':H.count('border-top-color:'),'Inner Permissions':H.count('class="perm"')}
print('   aantallen:',cnt,'(verwacht 7 · 6 · 6 · 8)')
for k,v in zip(cnt,(7,6,6,8)):
    cnt[k]!=v and fail(f'{k}: {cnt[k]} in plaats van {v}')

print('\n'+('RESULTAAT: OK, klaar voor oplevering' if not fout else f'RESULTAAT: {len(fout)} probleem/problemen · NIET opleveren'))
# logboek: elke controle wordt vastgelegd, per versie van het document
import hashlib, datetime
h=hashlib.sha256(open(a.html,'rb').read()).hexdigest()[:12]
log=os.path.splitext(a.html)[0].replace('_print','')+'_controlelog.txt'
with open(log,'a') as L:
    L.write(f"{datetime.datetime.now():%Y-%m-%d %H:%M} · versie {h} · {'OK' if not fout else str(len(fout))+' problemen'} · andere={bool(a.andere)} · intake={bool(a.intake)}\n")
ok_runs=[l for l in open(log) if f'versie {h} · OK' in l]
print(f'Controlelog: {log} · deze versie ({h}) is {len(ok_runs)} keer OK gecontroleerd' + ('' if len(ok_runs)>=3 else f' · nog {3-len(ok_runs)} keer nodig vóór oplevering'))

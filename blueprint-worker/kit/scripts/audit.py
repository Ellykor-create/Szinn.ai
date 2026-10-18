# -*- coding: utf-8 -*-
"""SZINN · audit vóór oplevering (drievoudige controle, zie masterprompt sectie 9).
Gebruik:
  python3 audit.py klant_chart.json klant_print.html "Volledige Geboortenaam" DD MM JJJJ [--andere MAP] [--intake intake.txt]
  --andere  map met eerder opgeleverde Blueprints (.pdf/.html/.txt) om overgenomen persoonlijke tekst en andermans namen te vinden
  --intake  de intake-antwoorden van deze klant als tekst; elk citaat in het document moet daar letterlijk in staan
  --schrijftekst  content.json van de schrijflaag; de overname-controle kijkt dan alleen naar die geschreven tekst
                  (vaste en berekende tekst met de feiten van de klant is geen overname en kan niet herschreven worden);
                  derde persoon en kleine letters worden dan ook alleen in die geschreven tekst gezocht
  --facts     facts.json van de datalaag; nodig voor de geboortetijdnoot-controle van v4.9 B (veld 'tijdnoot')
  --kalender  JJJJ-MM, startmaand van de kalender (zonder: afgeleid uit de eerste maandkaart)
  --tz        IANA-tijdzone van de WOONPLAATS voor de kalendercontrole (zonder: Europe/Amsterdam, met waarschuwing)
Eindigt op 'OK, klaar voor oplevering' of op het aantal problemen. Bij problemen: niet opleveren, bron aanpassen, opnieuw bouwen."""
import sys, os, json, re, html, argparse, glob, unicodedata, subprocess
import swisseph as swe
from szinn_numerologie import *
from szinn_vast import *
import szinn_vast
from szinn_taal import LANG, t as label, nm as vertaal, MAANDEN as _MND
HERE=os.path.dirname(os.path.abspath(__file__)); swe.set_ephe_path(os.path.join(HERE,'..','assets','ephe'))
ap=argparse.ArgumentParser(); ap.add_argument('chart'); ap.add_argument('html'); ap.add_argument('naam'); ap.add_argument('d',type=int); ap.add_argument('m',type=int); ap.add_argument('j',type=int)
ap.add_argument('--andere'); ap.add_argument('--intake'); ap.add_argument('--voornaam', default=''); ap.add_argument('--schrijftekst')
ap.add_argument('--facts'); ap.add_argument('--kalender'); ap.add_argument('--tz'); a=ap.parse_args()
ch=json.load(open(a.chart)); H=open(a.html).read(); H=re.sub(r'data:[^)"]+','',H); H=re.sub(r'<style.*?</style>','',H,flags=re.S)  # CSS (paginavoet, fontpaden) is geen documenttekst
def plain(x): return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',x)))
T=plain(H); fout=[]
T2=plain(re.sub(r'<svg.*?</svg>|<table class="toc">.*?</table>|<div class="kicker">.*?</div>|<h[123][^>]*>.*?</h[123]>','',H,flags=re.S))
def fail(msg): fout.append(msg); print('   ✗',msg)
def sectie(t): print('\n'+t)
def teksten(x): return [plain(x)] if isinstance(x,str) else [t for v in (x.values() if isinstance(x,dict) else x if isinstance(x,list) else []) for t in teksten(v)]
def zinsdelen(t): return [z for z in re.split(r'(?<=[.!?])\s+',t) if z.strip()]
FACTS=json.load(open(a.facts)) if a.facts else None
AI=teksten(json.load(open(a.schrijftekst))) if a.schrijftekst else None   # alleen wat de schrijflaag schreef
EN=LANG=='en'
NOOT_LAB='Birth time note' if EN else 'Geboortetijdnoot'
# lopende tekst: zonder kalender-transits (eigen controle 1f, huis = transithuis) en zonder geboortetijdnoot (andere huizen mogen daar)
H_lopend=re.sub(r'<hr><div class="lab">[^<]*</div><p>.*?</p>','',H,flags=re.S)
H_lopend=re.sub(r'<p[^>]*>(?:(?!</p>).)*?'+NOOT_LAB+r'(?:(?!</p>).)*</p>','',H_lopend,flags=re.S)
T_lopend=plain(re.sub(r'<svg.*?</svg>','',H_lopend,flags=re.S))
ORDW=['first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth','eleventh','twelfth']

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
    if not (FACTS and 'tijdnoot' in FACTS):   # oude regel (v4.8), alleen zonder de v4.9-gegevens uit de datalaag
        FACTS is not None and print('   ! facts.json heeft geen veld "tijdnoot": geboortetijdnoot v4.9 B niet gecontroleerd, oude regel (±2 min) gebruikt')
        for n in wankel:
            if not any(k in T for k in (('eboortetijdnoot','eboortetijd') if LANG=='nl' else ('irth time note','irth time'))): fail(f'{n} wisselt van huis bij ±2 min, maar er staat geen geboortetijdnoot')
else:
    print('   (oude chart.json zonder jd_ut: draai chart.py opnieuw voor ronde 1a–1c)')
# 1d · elke graad, elk huis, elk aspect in de tekst tegen de datalaag
def f(l): d=l%30; return f"{int(d)}°{int((d-int(d))*60):02d}'"
ok={f(v['lon']) for v in ch['pos'].values()}|{f(ch['asc']),f(ch['mc']),f(ch['sn'])}|{f(x) for x in ch['cusps']}
g=re.findall(r"\d{1,2}°\d{2}'",T); bad=sorted(set(x for x in g if x not in ok))
print(f'1d graden in de tekst: {len(g)} vermeldingen'); bad and fail(f'graden die niet in de datalaag staan: {bad}')
# huizen (v4.9 C4): elke "planeet … huis N" in de lopende tekst, ook opsommingen ("Zon, Mercurius en Neptunus in huis 11")
# en reeksen ("huis 10 en 11": elke genoemde planeet moet in een van die huizen staan). Kalender en geboortetijdnoot tellen niet mee.
AW_NAMEN=['conjunct','conjunctie','conjunction','sextiel','sextile','vierkant','square','driehoek','trine','oppositie','opposition','tegenover','opposite']
HUIS_V={n:v['house'] for n,v in ch['pos'].items()}; HUIS_V['Zuidknoop']=ch.get('sn_house')
namen={vertaal(n):n for n in HUIS_V if HUIS_V[n]}; NM_RX='|'.join(map(re.escape,sorted(namen,key=len,reverse=True)))
HM=re.compile(r"\b(?:huis|huizen|house|houses) (\d{1,2}(?:(?:,| en| and| of| or)(?: huis| house)? \d{1,2})*)\b|\b("+'|'.join(ORDW)+r"|\d{1,2}(?:st|nd|rd|th)) house\b")
hb=[]; nh=0; vorige=0
for mm in HM.finditer(T_lopend):
    seg=T_lopend[vorige:mm.start()]; vorige=mm.end()
    seg=re.split(r'[.;:()·!?]',seg)[-1][-120:]
    seg=re.split(r'\b(?:naar|met|with|to|toward|towards|stellium|'+'|'.join(AW_NAMEN)+r')\b',seg)[-1]   # "Neptunus en Pluto wijzen naar Venus, huis 12": alleen Venus
    # ponytail: rekent alle planeetnamen in het zinsdeel vóór "huis N" tot dat huis; zinsdelen over heerserschap,
    # transits of progressies slaan we over (daar is het huis niet de geboorteplaatsing). Vangt geen "huis 8, waar Jupiter staat".
    if re.search(r'(?i)heers|ruler|rules|transit|progress|geprogresseerd|vanuit|cusp|grens|boundary',seg): continue
    hs={int(x) for x in re.findall(r'\d{1,2}',mm.group(1))} if mm.group(1) else {ORDW.index(mm.group(2))+1 if mm.group(2) in ORDW else int(re.sub(r'\D','',mm.group(2)))}
    gev=list(re.finditer(r'\b('+NM_RX+r')\b',seg))
    if not gev or re.search(r'\b(en|and)\b',seg[gev[-1].end():]) or len(seg)-gev[-1].end()>45: continue   # huis hoort bij iets anders ("…Pluto, and three planets in Cancer and my twelfth house")
    for n in (g.group(1) for g in gev):
        nh+=1
        if HUIS_V[namen[n]] not in hs: hb.append(f'{n} (huis {HUIS_V[namen[n]]}): "{(seg+mm.group(0)).strip()}"')
print(f'   huisvermeldingen gecontroleerd: {nh}')
for x in dict.fromkeys(hb): fail(f'huis klopt niet met de datalaag: {x}')
pts={n:v['lon'] for n,v in ch['pos'].items()}; pts.update(Ascendant=ch['asc'],Midhemel=ch['mc'],Zuidknoop=ch['sn'])
pts.update({vertaal(k):v for k,v in list(pts.items())})
A={'conjunct':0,'sextiel':60,'vierkant':90,'driehoek':120,'oppositie':180,'sextile':60,'square':90,'trine':120,'opposition':180}; na=0
for mm in re.finditer(r"<tr><td>([\w ]+?) (conjunct|sextiel|vierkant|driehoek|oppositie|sextile|square|trine|opposition) ([\w ]+?)</td><td>([\d.,]+)°</td>",H):
    x,tp,y,o=mm.groups(); na+=1; real=abs(abs((pts[x]-pts[y]+180)%360-180)-A[tp])
    if abs(real-float(o.replace(',','.')))>0.06: fail(f'aspect {x} {tp} {y}: tekst {o}°, werkelijk {real:.2f}°')
print(f'   aspecten in de tabel gecontroleerd: {na}')
# orbgrens (v4.9 C5): elk aspect dat in de duiding genoemd wordt ("Mercurius sextiel Jupiter", "Maan in een driehoek met je Mercurius")
# valt binnen de grens. ponytail: 5° = de tabelgrens van 3.1 en de grens die de tekst zelf noemt; 3.1 staat tot 6° toe voor de berekening,
# Elly keurde 5,2° en 5,5° af (Karin). Zet ORB_GRENS op 6.0 als 3.1 zo bedoeld is.
ORB_GRENS=5.0
AW={'conjunct':0,'conjunctie':0,'conjunction':0,'sextiel':60,'sextile':60,'vierkant':90,'square':90,'driehoek':120,'trine':120,'oppositie':180,'opposition':180}
PT_RX='|'.join(map(re.escape,sorted(pts,key=len,reverse=True))); AW_RX='|'.join(AW)
no=0; ob=[]
for mm in re.finditer(r'\b('+PT_RX+r')\b(?:[^.;:()·]{0,40}?\b(?:een|an?|in)\b)?\s*('+AW_RX+r')\b\s*(?:(?:met|with|to|tot)\s+)?(?:(?:je|jouw|your)\s+)?(?:(?:natale|natal)\s+)?('+PT_RX+r')\b',T_lopend):
    x,tp,y=mm.groups()
    if x==y or vertaal(x)==vertaal(y): continue
    no+=1; real=abs(abs((pts[x]-pts[y]+180)%360-180)-AW[tp])
    if real>ORB_GRENS+0.05: ob.append(f'{x} {tp} {y}: orb {real:.1f}° (grens {ORB_GRENS:g}°) in "{mm.group(0)}"')
print(f'   aspecten in de lopende tekst gecontroleerd: {no}')
for x in dict.fromkeys(ob): fail(f'aspect buiten de orbgrens: {x}')
# 1f · kalender tegen een nieuwe run van transits.py (v4.9 A en C1): elke datum, elk "exact" en elk huis
MND=[x.lower() for x in _MND[LANG]]; MRX='|'.join(MND)
kaarten=re.findall(r'border-top-color:[^"]*"><div class="lab">([^<]+)</div>.*?<hr><div class="lab">[^<]*</div><p>(.*?)</p>',H,flags=re.S)
if kaarten:
    if a.kalender: y0,m0=map(int,a.kalender.split('-'))
    else:
        mk=re.match(r'\s*(\w+)\s+(\d{4})',plain(kaarten[0][0]).lower()); m0=MND.index(mk.group(1))+1; y0=int(mk.group(2))
    a.tz=a.tz or (FACTS or {}).get('woonplaats_tz')
    tz=a.tz or 'Europe/Amsterdam'
    a.tz or print('   ! geen --tz opgegeven: kalender gecontroleerd in Europe/Amsterdam (geef de tijdzone van de woonplaats)')
    r=subprocess.run([sys.executable,os.path.join(HERE,'transits.py'),a.chart,f'{y0}-{m0:02d}',str(len(kaarten)),tz],capture_output=True,text=True)
    TR=[]; LU=[]
    for l in r.stdout.splitlines():
        mt=re.match(r"\s+(\d\d)-(\d\d)-(\d{4}) \S+\s+(\w+) (\w+) natale (\w+) · (exact|bijna exact)[^·]*· transit .*?, huis (\d+)",l)
        if mt: dd,mo,yy,tn,asp,nn,ex,hu=mt.groups(); TR.append(((int(yy),int(mo),int(dd)),tn,asp,nn,ex=='exact',int(hu)))
        mt=re.match(r"\s+(\d\d)-(\d\d)-(\d{4}) \S+\s+(Nieuwe|Volle) maan · (\d+)°\d\d' \w+ · huis (\d+)",l)
        if mt: dd,mo,yy,k,gr,hu=mt.groups(); LU.append(((int(yy),int(mo),int(dd)),k,int(gr),int(hu)))
    if r.returncode or not (TR or LU): fail(f'kalendercontrole: transits.py faalde ({(r.stderr or r.stdout)[-300:].strip()})')
    print(f'1f kalender {y0}-{m0:02d}, {len(kaarten)} maanden, tijdzone {tz}: transits.py gaf {len(TR)} transits en {len(LU)} lunaties')
    TP={vertaal(n):n for n in ('Jupiter','Saturnus','Uranus','Neptunus','Pluto','Chiron')}
    NP={vertaal(n):n for n in list(ch['pos'])+['Ascendant','Midhemel']}
    TP_RX='|'.join(map(re.escape,sorted(TP,key=len,reverse=True))); NP_RX='|'.join(map(re.escape,sorted(NP,key=len,reverse=True)))
    ASPW={'conjunct':'conjunct','conjunctie':'conjunct','conjunction':'conjunct','conjuncts':'conjunct','meets':'conjunct',
          'sextiel':'sextiel','sextile':'sextiel','sextiles':'sextiel','vierkant':'vierkant','square':'vierkant','squares':'vierkant',
          'driehoek':'driehoek','trine':'driehoek','trines':'driehoek','oppositie':'oppositie','tegenover':'oppositie','opposes':'oppositie','opposition':'oppositie','opposite':'oppositie'}
    DATUM=(r'\b(\d{1,2}) ('+MRX+r')\b|\b('+MRX+r') (\d{1,2})\b') if EN else (r'\b(\d{1,2}) ('+MRX+r')\b')
    def jaar(mo): return y0 if mo>=m0 else y0+1   # ponytail: kalender is korter dan 12 maanden, dus dag+maand wijst één datum aan
    def nl_d(d): return f"{d[2]} {MND[d[1]-1]}"
    def huis_in(s):
        h=re.search(r'\b(?:huis|house) (\d{1,2})\b',s) or re.search(r'\b('+'|'.join(ORDW)+r') house\b',s)
        return None if not h else int(h.group(1)) if h.group(1).isdigit() else ORDW.index(h.group(1))+1
    nk=0
    for _,tekst in kaarten:
        d=None
        for z in zinsdelen(plain(tekst)):
            zl=z.lower(); dm=re.search(DATUM,zl)
            if dm:
                dag,mn=(dm.group(1),dm.group(2)) if dm.group(1) else (dm.group(4),dm.group(3)); mo=MND.index(mn)+1; d=(jaar(mo),mo,int(dag))
            if d is None: continue
            q=f'"{z[:110]}"'; hu=huis_in(z)
            lk=re.search(r'\b(nieuwe maan|volle maan|new moon|full moon)\b',zl)
            if lk:
                k='Nieuwe' if lk.group(1) in ('nieuwe maan','new moon') else 'Volle'; nk+=1
                hit=[x for x in LU if x[1]==k and x[0]==d]
                if not hit:
                    echt=[nl_d(x[0]) for x in LU if x[1]==k and x[0][1]==d[1]]
                    fail(f'kalender: {k.lower()} maan op {nl_d(d)} staat niet in transits.py (wel: {", ".join(echt) or "geen"}) in {q}'); continue
                if hu and hu!=hit[0][3]: fail(f'kalender: {k.lower()} maan {nl_d(d)} in huis {hu}, transits.py zegt huis {hit[0][3]} in {q}')
                g=re.search(r'(\d{1,2})°',z)
                if g and int(g.group(1))!=hit[0][2]: fail(f'kalender: {k.lower()} maan {nl_d(d)} op {g.group(1)}°, transits.py zegt {hit[0][2]}° in {q}')
                continue
            # transitplaneet = eerste planeetnaam die niet na "je/your" staat; natale punt = de naam na "je (eigen)/your (natal)"
            tps=[m for m in re.finditer(r'\b('+TP_RX+r')\b',z) if not re.search(r'\b(je|jouw|your|eigen|own|natale|natal)\s+$',z[:m.start()])]
            nat=re.search(r'\b(?:je|jouw|your)\s+(?:(?:eigen|own|natale|natal)\s+)?('+NP_RX+r')\b',z)
            if not tps or not nat: continue
            tn,nn=TP[tps[0].group(1)],NP[nat.group(1)]; nk+=1
            aw=re.search(r'\b('+'|'.join(ASPW)+r')\b',zl); asp=ASPW[aw.group(1)] if aw else None
            kand=[x for x in TR if x[1]==tn and x[3]==nn and (asp is None or x[2]==asp)]
            naam=f'{vertaal(tn)} {vertaal(asp) if asp else "→"} {vertaal(nn)}'
            if not kand: fail(f'kalender: {naam} staat niet in de uitvoer van transits.py in {q}'); continue
            hit=[x for x in kand if x[0]==d]
            if not hit: fail(f'kalender: {naam} op {nl_d(d)}, transits.py zegt {" / ".join(nl_d(x[0]) for x in kand)} in {q}')
            from datetime import date as _d
            x=hit[0] if hit else min(kand,key=lambda x:abs((_d(*x[0])-_d(*d)).days))   # bij een verkeerde datum: exact/huis tegen de dichtstbijzijnde
            if re.search(r'exact',zl) and not re.search(r'\b(bijna|nearly|almost)\b',zl) and not x[4]:
                fail(f'kalender: {naam} {nl_d(d)} heet "exact", maar transits.py zegt bijna exact in {q}')
            if hu and hu!=x[5]: fail(f'kalender: {naam} {nl_d(d)} vanuit huis {hu}, transits.py zegt huis {x[5]} in {q}')
    print(f'   kalendervermeldingen gecontroleerd: {nk}')
else:
    print('   ! geen maandkaarten gevonden: kalendercontrole niet uitgevoerd')
# 1g · geboortetijdnoot volgens v4.9 B: elke wissel binnen de marge staat in de noot (punt, huis/teken, minuten, chartheerser)
def getal_woorden(n):
    if EN:
        e=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen']
        w=e[n] if n<20 else ['','','twenty','thirty','forty','fifty'][n//10]+('-'+e[n%10] if n%10 else ''); return {w,w.replace('-',' ')}
    e=['nul','een','twee','drie','vier','vijf','zes','zeven','acht','negen','tien','elf','twaalf','dertien','veertien','vijftien','zestien','zeventien','achttien','negentien']
    if n<20: return {e[n],'één'} if n==1 else {e[n]}
    u=e[n%10]; return {(u+('ën' if u.endswith('e') else 'en') if n%10 else '')+['','','twintig','dertig','veertig','vijftig'][n//10]}
if FACTS and 'tijdnoot' in FACTS:
    tn_=FACTS['tijdnoot']; mn=re.search(r'<p[^>]*>((?:(?!</p>).)*?'+NOOT_LAB+r'(?:(?!</p>).)*)</p>',H,flags=re.S); noot=plain(mn.group(1)) if mn else ''
    print(f"1g geboortetijdnoot: zekerheid {tn_.get('zekerheid')} · nodig {tn_.get('nodig')} · wissels {len(tn_.get('wissels') or [])} · noot {'aanwezig' if noot else 'ontbreekt'}")
    for w in tn_.get('wissels') or []: print(f"   {w['wat']} {w['soort']} {w['van']} → {w['naar']} bij {w['minuten']} min {w.get('richting','')}"+(f" · chartheerser {w['chartheerser_van']} → {w['chartheerser_naar']}" if w.get('chartheerser_naar') else ''))
    if tn_.get('nodig') and not noot: fail('geboortetijdnoot ontbreekt, terwijl de datalaag hem verplicht stelt (v4.9 B)')
    elif noot and tn_.get('zekerheid')!='onbekend':
        for w in tn_.get('wissels') or []:
            pn=vertaal(w['wat']); zin=' '.join(z for z in zinsdelen(noot) if re.search(r'\b'+re.escape(pn)+r'\b',z))
            mins=r'\b('+'|'.join([str(w['minuten'])]+sorted(getal_woorden(w['minuten'])))+r')\s*(minuten|minuut|min|minutes|minute)\b'
            mist=[]
            if not zin: mist.append(pn)
            if w['soort']=='huis' and not re.search(r'\b(huis|house) '+str(w['naar'])+r'\b|\b'+ORDW[w['naar']-1]+r' house\b',zin): mist.append(f"huis {w['naar']}")
            if w['soort']=='teken' and not re.search(r'\b'+re.escape(vertaal(w['naar']))+r'\b',zin): mist.append(vertaal(w['naar']))
            if w.get('chartheerser_naar') and w['chartheerser_naar']!=w.get('chartheerser_van') and not re.search(r'\b'+re.escape(vertaal(w['chartheerser_naar']))+r'\b',noot): mist.append(f"chartheerser {vertaal(w['chartheerser_naar'])}")
            if not re.search(mins,zin.lower()): mist.append(f"{w['minuten']} minuten")
            mist and fail(f"geboortetijdnoot noemt de wissel {pn} {w['van']} → {w['naar']} ({w['minuten']} min {w.get('richting','')}) niet goed, mist: {', '.join(mist)}")
elif a.facts: pass   # melding staat al bij 1c
else: print('   ! geen --facts: geboortetijdnoot v4.9 B niet gecontroleerd')
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
std=[l.strip() for l in open(os.path.join(HERE,'standaardzinnen_en.txt' if LANG=='en' else 'standaardzinnen.txt')) if l.strip() and not l.startswith('#')]
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
    schrijf=[woorden(t) for t in teksten(json.load(open(a.schrijftekst)))] if a.schrijftekst else None
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
            if schrijf is not None: other&={tuple(w[i:i+n]) for w in schrijf for i in range(len(w)-n+1)}   # alleen wat de schrijflaag schreef
            for r in [r for blok in blokken for r in runs(woorden(blok),other,excl,n)]:
                rw=r.split(); cov=[False]*len(rw)
                for i in range(len(rw)-5):
                    if tuple(rw[i:i+6]) in base6:
                        for k in range(i,i+6): cov[k]=True
                if sum(cov)>=0.8*len(rw): continue   # vrijwel volledig vaste/sjabloontekst
                if sum(w.isdigit() or len(w)==1 for w in rw)>=0.5*len(rw): continue   # rekentabel van de eigen naam/datum, geen tekst
                if soort=='fout': fail(f'{len(r.split())} woorden letterlijk gelijk aan {base}: "{r[:120]}…"')
                elif len(r.split())<FAIL_N: print(f'   ! sjabloonzin ook in {base} (herschrijf bij voorkeur): "{r}"')
    print(f'   vergeleken met {len(bestanden)} eerdere Blueprints')
    for n in sorted(namen):
        if re.search(r'\b'+re.escape(n)+r'\b',base_txt): continue   # naam uit de vaste tekst (de facilitator), geen andere klant
        if re.search(r'\b'+re.escape(n)+r'\b',T): fail(f'naam van een andere klant in het document: {n}')
else:
    print('   geen --andere map opgegeven: overname-controle NIET uitgevoerd (verplicht vóór oplevering)'); fail('overname-controle niet uitgevoerd')
# andere voornamen dan de klant in persoonlijke tekst
print(f'   voornaam klant: {eerste} · komt {T.count(eerste)} keer voor')

# ============ RONDE 3 · NIETS VERZONNEN ============
sectie('RONDE 3 · NIETS VERZONNEN')
cit=[c for c in re.findall(r'["“]([^"”]{6,200})["”]',T)]
vastcit=set(re.findall(r'["“]([^"”]{6,200})["”]',' '.join(plain(getattr(szinn_vast,k)) for k in dir(szinn_vast) if isinstance(getattr(szinn_vast,k),str))))
eigen_cit=[c for c in cit if c not in vastcit and not c.startswith(eerste) and not (a.voornaam and c.startswith(a.voornaam)) and 'Remember who you are' not in c]
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
# derde persoon over de klant (v4.9 C2) en kleine letters bij planeetnamen (C3): alleen in geschreven tekst, nooit in vaste tekst
bron=AI if AI is not None else eigen
if EN:
    PRON=r"\b(she|her|hers|herself|he|him|his|himself)\b"; TWEEDE=r"(?i:\b(you|your|yours|yourself|me|my|mine|myself)\b)|\bI\b"
    ANDER=r"\b(mother|father|mum|mom|dad|parents?|partner|husband|wife|ex|boyfriend|girlfriend|sons?|daughters?|child|children|sisters?|brothers?|friends?|boss|colleagues?|people|others?|grand\w+|aunt|uncle)\b"
else:
    PRON=r"\b(ze|zij|haar|zijzelf)\b"; TWEEDE=r"(?i)\b(je|jij|jou|jouw|jezelf|ik|mij|me|mijn|mezelf)\b"
    ANDER=r"\b(moeder|vader|ouders?|partner|ex|vriend|vriendin|vrienden|zoon|dochter|kind|kinderen|zus|zussen|broer|oma|opa|tante|oom|collega'?s?|mensen|ander|andere|anderen)\b"
ENKEL={'is','heeft','wil','kan','zal','mag','moet','was','had','wordt','durft','gaat','doet','staat','komt','voelt','weet','denkt','zegt','vindt','ziet','houdt','blijft','werkt','leert','draagt'}
def meervoud(z,m):
    # NL "ze/zij" is ook meervoud ("ze veranderen je"): meervoud als het zinsdeel erna op een -en-vorm leunt en geen enkelvoudig werkwoord heeft
    if EN or m.group(1).lower() not in ('ze','zij'): return False
    w=re.split(r'[,.;:()!?]',z[m.end():])[0].split()
    return bool(w) and not ENKEL&{x.lower() for x in w} and (w[0].lower().endswith('en') or w[-1].lower().endswith('en'))
# ponytail: heuristiek, bewust conservatief. Een zin telt als derde persoon over de klant als hij ze/zij/haar/zijzelf (EN she/her/he/his/him)
# bevat en NIET: (1) ook je/jij/jouw/ik/mijn (EN you/your/I/my) noemt, (2) een ander noemt (moeder, partner, mensen, ander …),
# (3) direct volgt op zo'n zin over een ander, (4) NL: in een tekstblok staat waar Maan of Venus (vrouwelijk: "haar eigen teken") buiten
# haakjes voorkomt, (5) NL ze/zij meervoud lijkt. Citaten tussen aanhalingstekens tellen niet. Mist dus "je bent iemand die ze …";
# wil je strenger, laat (1) vallen voor bijzinnen met "iemand die".
derde=[]
# EN: een voornaamwoordgroep (he/him/his of she/her) die minstens twee keer in een zin met "you/your" staat, gaat in dit document over een ander
# (Theresa: "he will not choose you") en telt dan niet als derde persoon over de klant ("The pattern with him").
GROEP={'he':'m','him':'m','his':'m','himself':'m','she':'v','her':'v','hers':'v','herself':'v'}
ander_groep={g for g in 'mv' if EN and sum(1 for b in bron for z in zinsdelen(b) if re.search(TWEEDE,z) and any(GROEP[m.group(1).lower()]==g for m in re.finditer(PRON,z,flags=re.I)))>=2}
for blok in bron:
    blok=re.sub(r'["“][^"”]*["”]','',blok)
    if not EN and re.search(r'\b(Maan|Venus|venus)\b|\b(je|jouw) maan\b',re.sub(r'\([^)]*\)','',blok)): continue
    vorige_ander=False
    for z in zinsdelen(blok):
        hits=[m for m in re.finditer(PRON,z,flags=re.I) if not meervoud(z,m) and not (EN and GROEP[m.group(1).lower()] in ander_groep)]
        ander=bool(re.search(TWEEDE,z) or re.search(ANDER,z,flags=re.I))
        zelf=re.search(r'\bzijzelf\b',z,flags=re.I) and not re.search(TWEEDE,z)   # "zijzelf" gaat altijd over de klant
        if hits and (zelf or (not ander and not vorige_ander)): derde.append(z)
        vorige_ander=bool(hits) and ander
for z in dict.fromkeys(derde): fail(f'derde persoon over de klant: "{z[:120]}"')
print(f'   derde persoon over de klant: {len(derde)} zin(nen) in {len(bron)} geschreven tekstblokken')
if EN: KL=r"\b(?:(?:your|natal)\s+(sun|moon|mars|mercury)|(venus|jupiter|saturn|uranus|neptune|pluto|chiron|ascendant|midheaven|north node|south node))\b"
else:  KL=r"\b(?:(?:je|jouw|natale|eigen|geprogresseerde)\s+(zon|maan|mars)|(mercurius|venus|jupiter|saturnus|uranus|neptunus|pluto|chiron|ascendant|midhemel|noordknoop|zuidknoop))\b"
kl=[m.group(0) for blok in bron for m in re.finditer(KL,blok)]   # hoofdlettergevoelig: "Venus" telt niet, "venus" wel; "volle maan" en "zonlicht" niet
print(f'   planeetnamen met kleine letter: {len(kl)}' + (f' · ! waarschuwing, schrijf met hoofdletter: {sorted(set(kl))}' if kl else ''))
# geboortegegevens overal gelijk
inv=ch.get('invoer',{})
if inv:
    y,mo,dd=inv['datum'].split('-'); maanden=[m.lower() for m in _MND[LANG]]
    datum_nl=f"{int(dd)} {maanden[int(mo)-1]} {y}"
    print(f'   geboortedatum "{datum_nl}" komt {T.lower().count(datum_nl)} keer voor; tijd {inv["tijd"]} {T.count(inv["tijd"])} keer')
    T.lower().count(datum_nl)==0 and fail('geboortedatum staat niet in het document')
    for mm in re.finditer(r'\b(\d{1,2}) ('+'|'.join(maanden)+r') (19\d\d|20[01]\d)\b',T.lower()):
        if mm.group(0)!=datum_nl: fail(f'andere geboortedatum in het document: {mm.group(0)}')
# verboden claims en vormen
tx=[('em-dash in proza',r'[a-z,] — [a-z]'),('u/uw',r'\b(uw|U)\b [a-zà-ÿ]'),('Hz',r'\bHz\b'),('oude handelsnaam',r'(?i)\b1\s?1\s?0\s+L\w*\s*(&|and|en)\s*B'),('oude signatuur','nooit verloren'),
    ('permission slips','ermission slip'),('Waarneming als gave',r'Gave 0\d Waarneming'),('Szinn',r'\bSzinn\b'),('zeldzaam/uniek',r'\b(zeldzaam|zeldzame|uniek)\b'),
    ('causaal',r'verklaart waarom|bewijst|is de reden dat|zorgt ervoor dat'),('medisch',r'\b(diagnose|ziekte|stoornis)\b'),('percentages/frequentie',r'\b\d+ ?(procent|%) van (alle|de) (mensen|kaarten)')]
if LANG=='en':   # dezelfde controles, Engelse woorden
    tx=[('em-dash in proza',r'[a-z,] — [a-z]'),('Hz',r'\bHz\b'),('oude signatuur','never lost'),('permission slips','ermission slip'),('Szinn',r'\bSzinn\b'),
        ('zeldzaam/uniek',r'\b(rare|unique)\b'),('causaal',r'explains why|proves that|is the reason that|ensures that'),('medisch',r'\b(diagnosis|disease|disorder|illness)\b'),
        ('percentages/frequentie',r'\b\d+ ?(percent|%) of (all|the) (people|charts)')]
for lab,rx in tx:
    n=len(re.findall(rx,T_eigen if lab in ('medisch','zeldzaam/uniek','causaal','percentages/frequentie') else T)); print(f'   {lab}: {n}'); n and fail(f'{lab}: {n}×')
cnt={'praktijken':H.count(label('Praktijk 0')),'prompts':H.count('class="prompt"'),'kalendermaanden':H.count('border-top-color:'),'Inner Permissions':H.count('class="perm"')}
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

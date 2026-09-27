# -*- coding: utf-8 -*-
"""SZINN · datalaag geboortekaart. Swiss Ephemeris, tropisch, Placidus, ware knoop.
Gebruik:
  python3 chart.py --datum JJJJ-MM-DD --tijd UU:MM --tz 1 --lat 52.00 --lon 4.36 --out klant_chart.json
--tz is de UTC-offset die op de geboortedatum gold, inclusief eventuele zomertijd (NL voor 1977: altijd +1).
Schrijft de bevroren datastructuur (posities, huizen, aspecten, elementen, modaliteiten, grensmarges) en print een rapport."""
import argparse, json, itertools, os
from collections import Counter
import swisseph as swe
HERE = os.path.dirname(os.path.abspath(__file__))
swe.set_ephe_path(os.path.join(HERE, '..', 'assets', 'ephe'))
S = ['Ram','Stier','Tweelingen','Kreeft','Leeuw','Maagd','Weegschaal','Schorpioen','Boogschutter','Steenbok','Waterman','Vissen']
EL = {'vuur':['Ram','Leeuw','Boogschutter'],'aarde':['Stier','Maagd','Steenbok'],'lucht':['Tweelingen','Weegschaal','Waterman'],'water':['Kreeft','Schorpioen','Vissen']}
MOD = {s:['hoofd','vast','veranderlijk'][i%3] for i,s in enumerate(S)}
P = [('Zon',swe.SUN),('Maan',swe.MOON),('Mercurius',swe.MERCURY),('Venus',swe.VENUS),('Mars',swe.MARS),('Jupiter',swe.JUPITER),
     ('Saturnus',swe.SATURN),('Uranus',swe.URANUS),('Neptunus',swe.NEPTUNE),('Pluto',swe.PLUTO),('Noordknoop',swe.TRUE_NODE),('Chiron',swe.CHIRON)]
ASP = {0:'conjunct',60:'sextiel',90:'vierkant',120:'driehoek',180:'oppositie'}

def fmt(l):  # boogminuten afgekapt
    s=int(l//30); d=l-30*s; return f"{S[s]} {int(d)}°{int((d-int(d))*60):02d}'"

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--datum',required=True); ap.add_argument('--tijd',required=True)
    ap.add_argument('--tz',type=float,required=True); ap.add_argument('--lat',type=float,required=True); ap.add_argument('--lon',type=float,required=True)
    ap.add_argument('--out',required=True); ap.add_argument('--orb',type=float,default=6.0); a=ap.parse_args()
    y,m,d=map(int,a.datum.split('-')); hh,mm=map(int,a.tijd.split(':'))
    ut=hh+mm/60-a.tz; jd=swe.julday(y,m,d,ut)
    cusps,ascmc=swe.houses(jd,a.lat,a.lon,b'P'); cusps=list(cusps)
    def house(l):
        for i in range(12):
            s,e=cusps[i],cusps[(i+1)%12]
            if (l-s)%360 < (e-s)%360: return i+1
    pos={}
    for n,p in P:
        r,_=swe.calc_ut(jd,p,swe.FLG_SWIEPH|swe.FLG_SPEED)
        h=house(r[0]); nxt=cusps[h%12]
        pos[n]=dict(lon=r[0],rx=(r[3]<0 and n!='Noordknoop'),sign=S[int(r[0]//30)],txt=fmt(r[0]),house=h,
                    tot_volgende_cusp=round((nxt-r[0])%360,3),na_eigen_cusp=round((r[0]-cusps[h-1])%360,3))
    asc,mc=ascmc[0],ascmc[1]; sn=(pos['Noordknoop']['lon']+180)%360
    # geboortetijd-gevoeligheid: minuten tot de Ascendant van teken wisselt
    def asc_at(dm): return swe.houses(swe.julday(y,m,d,ut+dm/60),a.lat,a.lon,b'P')[1][0]
    sign0=int(asc//30); mins=[k for k in range(-240,241) if int(asc_at(k)//30)!=sign0]
    marge=min(abs(k) for k in mins) if mins else None
    ten=[n for n,_ in P[:10]]
    pts={n:v['lon'] for n,v in pos.items()}; pts['Ascendant']=asc; pts['Midhemel']=mc
    asps=[]
    for x,z in itertools.combinations(pts,2):
        if {x,z}<={'Ascendant','Midhemel'}: continue
        dd=abs((pts[x]-pts[z]+180)%360-180)
        for ang,nm in ASP.items():
            if abs(dd-ang)<=a.orb: asps.append(dict(a=x,type=nm,b=z,orb=round(abs(dd-ang),2)))
    asps.sort(key=lambda q:q['orb'])
    out=dict(invoer=vars(a),jd_ut=jd,pos=pos,cusps=cusps,asc=asc,mc=mc,sn=sn,asc_txt=fmt(asc),mc_txt=fmt(mc),sn_txt=fmt(sn),sn_house=house(sn),
             elementen={e:sum(pos[n]['sign'] in s for n in ten) for e,s in EL.items()},
             modaliteiten=dict(Counter(MOD[pos[n]['sign']] for n in ten)),
             huizen_telling=dict(Counter(pos[n]['house'] for n in ten)),aspecten=asps,asc_tekenwissel_marge_min=marge)
    json.dump(out,open(a.out,'w'),ensure_ascii=False,indent=1)
    print(f"UT {ut:.4f} · Asc {fmt(asc)} · MC {fmt(mc)} · Zuidknoop {fmt(sn)} (huis {house(sn)}) · Asc wisselt teken over {marge} min")
    for n,v in pos.items():
        w=' ⚠ grens' if min(v['tot_volgende_cusp'],v['na_eigen_cusp'])<1 else ''
        print(f"  {n:11s} {v['txt']:22s} huis {v['house']:2d} {'Rx' if v['rx'] else '  '}{w}")
    print('  elementen',out['elementen'],'· modaliteiten',out['modaliteiten'])
    print('  aspecten:',', '.join(f"{q['a']} {q['type']} {q['b']} {q['orb']}" for q in asps[:12]),'…')
if __name__=='__main__': main()

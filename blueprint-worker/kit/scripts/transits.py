# -*- coding: utf-8 -*-
"""SZINN · transits en lunaties voor de kalender (zes maanden vanaf de opleveringsmaand).
Gebruik: python3 transits.py klant_chart.json 2026-09 [aantal_maanden=6] [tz_lokaal=1]
Geeft per maand: exacte transits (orb-minimum < 1°; 'exact' in de tekst alleen < 0,5°) van Jupiter t/m Pluto en Chiron
op alle natale planeten, Asc en MC, met transit-huis; en nieuwe/volle maan met graad, natale huis en conjuncties < 3°."""
import sys, json, os
import swisseph as swe
HERE=os.path.dirname(os.path.abspath(__file__)); swe.set_ephe_path(os.path.join(HERE,'..','assets','ephe'))
S=['Ram','Stier','Tweelingen','Kreeft','Leeuw','Maagd','Weegschaal','Schorpioen','Boogschutter','Steenbok','Waterman','Vissen']
ch=json.load(open(sys.argv[1])); y0,m0=map(int,sys.argv[2].split('-')); N=int(sys.argv[3]) if len(sys.argv)>3 else 6; TZ=float(sys.argv[4]) if len(sys.argv)>4 else 1
cusps=ch['cusps']
def fmt(l): return f"{int(l%30)}° {S[int(l//30)]}"
def house(l):
    for i in range(12):
        a,b=cusps[i],cusps[(i+1)%12]
        if (l-a)%360<(b-a)%360: return i+1
nat={n:v['lon'] for n,v in ch['pos'].items()}; nat['Ascendant']=ch['asc']; nat['Midhemel']=ch['mc']
T=[('Jupiter',swe.JUPITER),('Saturnus',swe.SATURN),('Uranus',swe.URANUS),('Neptunus',swe.NEPTUNE),('Pluto',swe.PLUTO),('Chiron',swe.CHIRON)]
A={0:'conjunct',60:'sextiel',90:'vierkant',120:'driehoek',180:'oppositie'}
ym=[((y0*12+m0-1+k)//12,(m0-1+k)%12+1) for k in range(N+1)]
j0=swe.julday(ym[0][0],ym[0][1],1,0); j1=swe.julday(ym[-1][0],ym[-1][1],1,0)
lon=lambda p,jd: swe.calc_ut(jd,p)[0][0]
def dt(jd): y,m,d,h=swe.revjul(jd+TZ/24); return f"{int(d)}-{int(m)}-{y}"
def orb(p,jd,nl,ang): return abs(abs((lon(p,jd)-nl+180)%360-180)-ang)
print('== Exacte transits (orb-minimum < 1°) ==')
for tn,tp in T:
    for k in range(int(j1-j0)):
        jd=j0+k
        for nn,nl in nat.items():
            for ang,nm in A.items():
                o=orb(tp,jd,nl,ang)
                if o<1 and o<=orb(tp,jd-1,nl,ang) and o<orb(tp,jd+1,nl,ang):
                    L=lon(tp,jd); print(f"  {dt(jd):11s} {tn} {nm} natale {nn} · orb {o:.2f}{' (exact)' if o<0.5 else ''} · transit {fmt(L)}, huis {house(L)}")
print('== Nieuwe en volle manen ==')
el=lambda jd:(lon(swe.MOON,jd)-lon(swe.SUN,jd))%360
jd=j0
while jd<j1:
    for kind,t in (('Nieuwe maan',0),('Volle maan',180)):
        a=(el(jd)-t+180)%360-180; b=(el(jd+.25)-t+180)%360-180
        if a<0<=b and abs(a-b)<30:
            lo,hi=jd,jd+.25
            for _ in range(40):
                mid=(lo+hi)/2
                if (el(mid)-t+180)%360-180<0: lo=mid
                else: hi=mid
            L=lon(swe.MOON,lo); hits=[f"{nn} {abs((L-nl+180)%360-180):.1f}°" for nn,nl in nat.items() if abs((L-nl+180)%360-180)<=3]
            print(f"  {kind} {dt(lo)} · {fmt(L)} · huis {house(L)} {('· conjunct '+', '.join(hits)) if hits else ''}")
    jd+=.25

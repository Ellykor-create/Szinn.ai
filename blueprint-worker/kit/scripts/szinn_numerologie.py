import unicodedata
from collections import Counter
TABEL = {c: (i % 9) + 1 for i, c in enumerate("ABCDEFGHIJKLMNOPQRSTUVWXYZ")}
MEESTERS = (11, 22, 33); KLINKERS = set("AEIOU")
def reduceer(n):
    while n > 9:
        if n in MEESTERS: return n
        n = sum(int(d) for d in str(n))
    return n
def normaliseer(s):
    s = unicodedata.normalize("NFD", s); s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return "".join(c for c in s.upper() if c in TABEL)
def y_is_klinker(L, i):
    v = L[i-1] if i > 0 else None; n = L[i+1] if i < len(L)-1 else None
    return not (v in KLINKERS or n in KLINKERS)
def splits(d):
    L = normaliseer(d); kl, mk = [], []
    for i, c in enumerate(L):
        if c in KLINKERS: kl.append(c)
        elif c == "Y": (kl if y_is_klinker(L, i) else mk).append(c)
        else: mk.append(c)
    return kl, mk
def som(l): return sum(TABEL[c] for c in l)
TUSSENVOEGSELS = {"van","de","der","den","het","'t","ten","ter","te","op","in","aan","bij","uit","over","onder","voor","tot","du","del","della","di","da","la","le","el","al","bin","ibn","abu","mac","mc","o'","von","zu"}
def naamdelen(naam):
    ruw = naam.replace('-',' ').split(); delen, buf = [], ""
    for w in ruw:
        if w.lower().strip(".") in TUSSENVOEGSELS: buf += w
        else: delen.append(buf + w); buf = ""
    if buf: delen.append(buf)
    return delen
def naamgetal(naam, welke):
    sub=[]
    for d in naamdelen(naam):
        kl, mk = splits(d); letters = (kl+mk) if welke=="uitdrukking" else (kl if welke=="zielenurge" else mk)
        sub.append((reduceer(som(letters)), som(letters)))
    return reduceer(sum(s for s,_ in sub)), sub
def lp(d,m,j): return reduceer(reduceer(d)+reduceer(m)+reduceer(j)), (reduceer(d),reduceer(m),reduceer(j))
def groeigetallen(naam, dag, maand, jaar):
    """Returning numbers volgens de gangbare Pythagorische methode: het samengestelde getal vlak vóór de laatste
    reductie van elk kerngetal (geboortedag, Levenspad, Uitdrukking, Zielenurge, Persoonlijkheid) is 13, 14, 16 of 19.
    Tussensommen van losse naamdelen tellen niet mee. Keynote = meest voorkomende letterwaarde; untrained muscles = ontbrekende cijfers."""
    L = normaliseer(''.join(naamdelen(naam)))
    vals = [TABEL[c] for c in L]; cnt = Counter(vals)
    d,m,j = reduceer(dag), reduceer(maand), reduceer(jaar)
    samengesteld = {'geboortedag': dag, 'levenspad': d+m+j}
    for w in ("uitdrukking","zielenurge","persoonlijkheid"):
        samengesteld[w] = sum(s for s,_ in naamgetal(naam,w)[1])
    returning = {k:v for k,v in samengesteld.items() if v in (13,14,16,19)}
    mx = max(cnt.values()); keynote = sorted(k for k,v in cnt.items() if v==mx)
    missing = [x for x in range(1,10) if x not in cnt]
    return dict(samengesteld=samengesteld, returning=returning, keynote=keynote, keynote_count=mx, letters={k:[c for c in L if TABEL[c]==k] for k in keynote}, missing=missing, counts=dict(sorted(cnt.items())))

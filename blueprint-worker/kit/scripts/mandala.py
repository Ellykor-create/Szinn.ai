import json, math, os
ZP = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'zodiac_paths.json')))
ch = pos = cusps = ASC = MC = SN = None
CX = CY = 400; R_OUT = 380; R_SIGN_IN = 340; R_HOUSE = 300; R_PL = 262; R_IN = 200
GOLD = '#9A7B2E'; GOLD_L = '#C9A96E'; INK = '#0D0A07'; AMET = '#7B5EA7'
SIGNS = ['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓']
GLYPH = {'Zon':'☉','Maan':'☽','Mercurius':'☿','Venus':'♀','Mars':'♂','Jupiter':'♃','Saturnus':'♄','Uranus':'♅','Neptunus':'♆','Pluto':'♇','Noordknoop':'☊','Chiron':'⚷'}

def pt(lon, r):
    phi = math.radians(180 + (lon - ASC))
    return CX + r*math.cos(phi), CY - r*math.sin(phi)

def build(animate=True):
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800" font-family="DejaVu Sans, sans-serif">']
    s.append(f'<rect width="800" height="800" fill="#fff"/>')
    for r in (R_OUT, R_SIGN_IN, R_HOUSE, R_IN):
        s.append(f'<circle cx="{CX}" cy="{CY}" r="{r}" fill="none" stroke="{GOLD}" stroke-width="{1.4 if r in (R_OUT,R_IN) else 0.8}"/>')
    for i in range(12):
        x1,y1 = pt(i*30, R_SIGN_IN); x2,y2 = pt(i*30, R_OUT)
        s.append(f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" stroke="{GOLD}" stroke-width="0.8"/>')
        lx,ly = pt(i*30+15, (R_OUT+R_SIGN_IN)/2)
        d_, w_ = ZP['g'][str(i)]; sc = 20/ZP['upm']
        s.append(f'<path d="{d_}" fill="{GOLD}" transform="translate({lx - w_*sc/2:.2f},{ly + 7:.2f}) scale({sc:.5f},{-sc:.5f})"/>')
        for d in range(0,30,5):
            tr = R_SIGN_IN + (10 if d%10==0 else 6)
            x1,y1 = pt(i*30+d, R_SIGN_IN); x2,y2 = pt(i*30+d, tr)
            s.append(f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" stroke="{GOLD}" stroke-width="0.6"/>')
    r6 = R_IN/3.0
    s.append(f'<g stroke="{GOLD_L}" stroke-width="0.6" fill="none" opacity="0.45">')
    centers = [(CX,CY)]
    for k in range(6):
        a = math.radians(60*k); centers.append((CX+r6*math.cos(a), CY+r6*math.sin(a)))
    for k in range(6):
        a = math.radians(60*k+30); centers.append((CX+r6*math.sqrt(3)*math.cos(a), CY+r6*math.sqrt(3)*math.sin(a)))
        a2 = math.radians(60*k); centers.append((CX+2*r6*math.cos(a2), CY+2*r6*math.sin(a2)))
    for (x,y) in centers:
        s.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r6:.2f}"/>')
    s.append('</g>')
    # Metatron's Cube: 13 cirkels (Fruit of Life) op één lijn met de Flower of Life,
    # middelpunt + 6 op afstand 2r + 6 op afstand 4r (r = straal van de kleine cirkels), alle 78 verbindingslijnen
    rm_ = R_IN*0.94/5.0
    mcs = [(CX,CY)] + [(CX+2*rm_*math.cos(math.radians(60*k+30)), CY+2*rm_*math.sin(math.radians(60*k+30))) for k in range(6)] \
                    + [(CX+4*rm_*math.cos(math.radians(60*k+30)), CY+4*rm_*math.sin(math.radians(60*k+30))) for k in range(6)]
    s.append(f'<g stroke="{GOLD}" stroke-width="0.9" opacity="0.85">')
    for i in range(13):
        for j in range(i+1,13):
            s.append(f'<line x1="{mcs[i][0]:.2f}" y1="{mcs[i][1]:.2f}" x2="{mcs[j][0]:.2f}" y2="{mcs[j][1]:.2f}"/>')
    s.append('</g>')
    s.append(f'<g stroke="{GOLD}" stroke-width="1.1" fill="none">')
    for (x,y) in mcs:
        s.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{rm_:.2f}"/>')
    s.append('</g>')
    NN = pos['Noordknoop']['lon']; rm = R_IN*0.78
    def tri(lon, col):
        p = [pt(lon+120*k, rm) for k in range(3)]
        return f'<polygon points="{" ".join(f"{x:.2f},{y:.2f}" for x,y in p)}" fill="none" stroke="{col}" stroke-width="1.6"/>'
    s.append(tri(NN, GOLD)); s.append(tri(SN, AMET))
    nx,ny = pt(NN, rm); sx,sy = pt(SN, rm)
    s.append(f'<circle cx="{nx:.2f}" cy="{ny:.2f}" r="4" fill="{GOLD}"/><circle cx="{sx:.2f}" cy="{sy:.2f}" r="4" fill="{AMET}"/>')
    for i,c in enumerate(cusps):
        x1,y1 = pt(c, R_IN); x2,y2 = pt(c, R_SIGN_IN)
        w = 1.8 if i in (0,3,6,9) else 0.7
        s.append(f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" stroke="{INK if i in (0,3,6,9) else GOLD}" stroke-width="{w}"/>')
        nxt = cusps[(i+1)%12]; mid = c + ((nxt-c)%360)/2
        hx,hy = pt(mid, R_IN+16)
        s.append(f'<text x="{hx:.2f}" y="{hy+4:.2f}" text-anchor="middle" font-size="11" fill="{GOLD}">{i+1}</text>')
    for lon,lab in ((ASC,'AC'),(MC,'MC'),((ASC+180)%360,'DC'),((MC+180)%360,'IC')):
        lx,ly = pt(lon, R_OUT+14)
        s.append(f'<text x="{lx:.2f}" y="{ly+4:.2f}" text-anchor="middle" font-size="10" fill="{INK}" letter-spacing="1">{lab}</text>')
    order = ['Zon','Maan','Mercurius','Venus','Mars','Jupiter','Saturnus','Uranus','Neptunus','Pluto','Noordknoop','Chiron']
    placed = []; coords = {}
    for n in order:
        lon = pos[n]['lon']
        x1,y1 = pt(lon, R_HOUSE); x2,y2 = pt(lon, R_HOUSE+10)
        s.append(f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" stroke="{INK}" stroke-width="1.2"/>')
        rr = R_PL; changed = True
        while changed:
            changed = False
            for (pl, prr) in placed:
                if abs((lon-pl+180)%360-180) < 7 and abs(prr-rr) < 1:
                    rr -= 24; changed = True
        placed.append((lon, rr))
        gx,gy = pt(lon, rr); coords[n]=(gx,gy,rr)
        col = AMET if n=='Noordknoop' else INK
        s.append(f'<text x="{gx:.2f}" y="{gy+6:.2f}" text-anchor="middle" font-size="18" fill="{col}">{GLYPH[n]}</text>')
        if pos[n]['rx']:
            s.append(f'<text x="{gx+10:.2f}" y="{gy-4:.2f}" font-size="8" fill="{GOLD}">Rx</text>')
    srr = R_PL
    while any(abs((SN-pl+180)%360-180) < 7 and abs(prr-srr) < 1 for pl,prr in placed): srr -= 24
    sx,sy = pt(SN, srr); coords['Zuidknoop']=(sx,sy,srr)
    x1,y1 = pt(SN, R_HOUSE); x2,y2 = pt(SN, R_HOUSE+10)
    s.append(f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" stroke="{AMET}" stroke-width="1.2"/>')
    s.append(f'<text x="{sx:.2f}" y="{sy+6:.2f}" text-anchor="middle" font-size="18" fill="{AMET}">☋</text>')
    s.append('</svg>')
    return '\n'.join(s), coords

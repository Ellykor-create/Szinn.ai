# -*- coding: utf-8 -*-
"""SZINN Blueprint als gelijmd boek voor Print&Bind (printenbind.nl).
Levert twee PDF's: binnenwerk (losse A4-pagina's, dubbelzijdig) en omslag (spread: achterkant | rug | voorkant).
Regels Print&Bind gelijmd: veiligheidsmarge 15 mm aan de bindzijde, 5 mm rondom; zonder afloop vergroten zij 1%;
omslag 350 g als spread = 2 x paginabreedte + rugbreedte (rugbreedte toont Print&Bind bij het uploaden).
Gebruik: python3 book.py [build-script] [rug_mm]"""
import sys, os, re, runpy
import weasyprint
HERE = os.path.dirname(os.path.abspath(__file__))
script = sys.argv[1] if len(sys.argv) > 1 else 'build_blueprint.py'
SPINE = float(sys.argv[2]) if len(sys.argv) > 2 else None
g = runpy.run_path(script if os.path.exists(script) else os.path.join(HERE, script), run_name='szinn_book')
parts, NAAM, CSS, LOGO, COVER_BG, FOOT = g['parts'], g['NAAM'], g['CSS'], g['LOGO'], g['COVER_BG'], g['FOOT']
base = g['base'].replace('_3delen', '') + '_BOEK'

cover_html = parts[0]
body = parts[1:]
# ---- 1. titelpagina (rechts, pagina 1) ----
meta = re.search(r'<div class="meta">(.*?)</div>', cover_html, re.S).group(1)
h1 = re.search(r'<h1>(.*?)</h1>', cover_html, re.S).group(1)
title = (f'<section class="titlep"><img src="{LOGO}" alt="SZINN"><div class="brand">SZINN · Alignment Blueprint</div>'
         f'<div class="k">Jouw persoonlijke Alignment Blueprint</div><h1>{h1}</h1><div class="tmeta">{meta}<br><br>Gefaciliteerd door Elly Elizabeth Korving · SZINN · szinn.ai · {g.get("MAAND_JAAR", "september 2026")}</div></section>')

# ---- 2. ankers op secties ----
anchors = [('s01','>01 — Visie'),('d1','Deel I · Wie ben ik?'),('el','>Herkenning · De elementen<'),('ka','>Herkenning · Karakter<'),
 ('va','>Herkenning · Valkuilen<'),('ta','>Herkenning · Talenten<'),('s02','>02 — Introductie<'),('d2','Deel II · Wat wil ik?'),
 ('s04','>04 — Astrologie<'),('s05','>05 — Noord-'),('s06','>06 — Numerologie<'),('s07','>07 — Kabbalah'),('s08','>08 — Sacred Geometry<'),
 ('s09','>09 — Overzicht'),('d3','Deel III · Waar ga ik heen?'),('s03','>03 — Leven vanuit flow<'),('s10','>10 — Reflectievragen<'),
 ('s11','>11 — Werken met de energie<'),('s12','>12 — Integratie<'),('ip','>Integratie · Inner Permissions<'),('s13','>13 — Verdieping<')]
subs = [('sch','<h2>Jouw schaduwkanten zijn niet je vijanden</h2>'),('gav','<h2>Jouw zes gaven</h2>'),('dp','<h2>Dagelijkse praktijken</h2>'),
 ('ai','<h2>Zes AI-prompts voor jouw kaart</h2>'),('kal','<h2>Persoonlijke kalender')]
out = []
for p in body:
    if 'class="toc"' in p: continue            # eigen inhoudsopgave met paginanummers
    for aid, key in anchors:
        if key in p and f'id="{aid}"' not in ''.join(out):
            p = p.replace('<section class="', f'<section id="{aid}" class="', 1); break
    for aid, key in subs:
        if key in p: p = p.replace(key, key.replace('<h2>', f'<h2 id="{aid}">', 1), 1)
    # deelschermen (Deel I/II/III) altijd op een rechterpagina
    if 'Deel I · Wie' in p or 'Deel II · Wat' in p or 'Deel III' in p:
        p = p.replace('class="full ', 'class="full recto ', 1)
    if 'class="back"' in p: p = p.replace('class="back"', 'class="back verso"', 1)
    out.append(p)

toc_rows = [('part','Voordat je begint',None),('01','Visie &amp; Missie','s01'),
 ('part','Deel I · Herkenning · Wie ben ik?','d1'),('·','De elementen: het recept','el'),('·','Karakter: wie je bent in balans','ka'),('·','Valkuilen: uit balans','va'),('·','Talenten: wat je meebrengt','ta'),('02','Introductie','s02'),
 ('part','Deel II · Helderheid · Wat wil ik? Waar komt het vandaan?','d2'),('04','Astrologie','s04'),('05','Noord- &amp; Zuidknoop','s05'),('06','Numerologie','s06'),('07','Kabbalah / Tikkun','s07'),('08','Sacred Geometry · De Mandala','s08'),('09','Overzicht &amp; Samenvatting','s09'),
 ('part','Deel III · Integratie · Waar ga ik heen? Hoe leef ik dit?','d3'),('03','Leven vanuit flow','s03'),('10','Reflectievragen','s10'),('11','Werken met de energie','s11'),('12','Integratie','s12'),
 ('sub','Schaduwkanten + ankers','sch'),('sub','De zes gaven','gav'),('sub','Daily Practices (7)','dp'),('sub','AI-prompts (6)','ai'),('sub','Persoonlijke kalender · 6 maanden','kal'),('·','Inner Permissions','ip'),('13','Verdieping','s13')]
t = '<section class="sec tocs recto"><div class="kicker">Inhoud</div><h1>Wat je in dit document vindt</h1><table class="toc">'
for n, lab, a in toc_rows:
    pg = f'<td class="pg"><a href="#{a}"></a></td>' if a else '<td class="pg"></td>'
    if n == 'part': t += f'<tr><td class="part" colspan="2">{lab}</td>{pg}</tr>'
    elif n == 'sub': t += f'<tr><td class="n"></td><td class="subi">{lab}</td>{pg}</tr>'
    else: t += f'<tr><td class="n">{n}</td><td>{lab}</td>{pg}</tr>'
t += '</table></section>'
# volgorde: 1 titel (rechts) · 2 "Voor ..." beeld (links) · 3 inhoud (rechts) · rest
inner = [title, out[0], t] + out[1:]

BOOK_CSS = """
@page{size:A4;margin:22mm 16mm 20mm 16mm}
@page :right{margin-left:24mm;margin-right:16mm}
@page :left{margin-left:16mm;margin-right:24mm}
@page :blank{@bottom-center{content:none}}
@page titlep{margin:0;@bottom-center{content:none}}
.titlep{page:titlep;width:210mm;height:297mm;text-align:center;padding:62mm 30mm 0 36mm;page-break-after:always}
.titlep img{width:30mm}
.titlep .brand{font-size:8.5pt;letter-spacing:.35em;text-transform:uppercase;color:var(--gold);margin:8mm 0 34mm}
.titlep .k{font-size:8.5pt;letter-spacing:.3em;text-transform:uppercase;color:var(--gold)}
.titlep h1{font-size:38pt;line-height:1.08;margin:6pt 0 26mm}
.titlep .tmeta{font-size:9.2pt;line-height:1.8;color:var(--muted);border-top:.6pt solid var(--goldl);padding-top:8pt}
.titlep .tmeta b{font-weight:500;color:var(--ink)}
.recto{break-before:right}
.full.recto{page-break-before:right}
.verso{break-before:left}
.full .ov{padding:70mm 26mm 26mm}
.toc td.pg{width:10%;text-align:right;color:var(--gold);vertical-align:bottom}
.toc td.pg a{color:var(--gold);text-decoration:none}
.toc td.pg a::after{content:target-counter(attr(href), page)}
"""
html = (f'<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8"><title>SZINN Alignment Blueprint · {NAAM} · binnenwerk</title>'
        f'<style>{CSS.replace("__FOOT__", FOOT)}{BOOK_CSS}</style></head><body>' + '\n'.join(inner) + '</body></html>')
open(base + '_binnenwerk.html', 'w').write(html)
doc = weasyprint.HTML(filename=base + '_binnenwerk.html').render()
n = len(doc.pages)
if n % 2:  # altijd een even aantal pagina's
    html = html.replace('</body>', '<section style="break-before:page"></section></body>')
    open(base + '_binnenwerk.html', 'w').write(html)
    doc = weasyprint.HTML(filename=base + '_binnenwerk.html').render(); n = len(doc.pages)
doc.write_pdf(base + '_binnenwerk.pdf')
print('binnenwerk', n, 'pagina\'s')

# ---- 3. omslag als spread ----
if SPINE is None:
    SPINE = round(n / 2 * 0.11 + 0.5, 1)   # schatting 100 g papier; vervang door de rugbreedte die Print&Bind bij het uploaden toont
W = 2 * 210 + SPINE
voor = cover_html.replace('<section class="cover"', '<section class="cv front"', 1)
FRONTCSS = '\n'.join(l.replace('.cover','.front',1).replace('page:cover;','').replace('page-break-after:always','') for l in CSS.split('\n') if l.startswith('.cover'))
spine_txt = f'<div class="spt">SZINN · Alignment Blueprint · {NAAM}</div>' if SPINE >= 6 else ''
achter = (f'<section class="cv backc"><div class="bi"><img src="{LOGO}" alt="SZINN">'
          '<p class="bq">"Als genoeg mensen herinneren wie ze zijn, verandert de wereld om ons heen vanzelf."</p>'
          '<p class="bt">Een persoonlijke Alignment Blueprint: jouw geboortekaart, jouw getallen en jouw zielstaak, samengebracht in één spiegel. Geen voorspelling en geen oordeel, maar een uitnodiging om te herinneren wie je bent.</p>'
          '<div class="bs">Remember who you are.</div><div class="bf">SZINN · szinn.ai · Gefaciliteerd door Elly Elizabeth Korving</div></div></section>')
COVER_CSS = f"""
@page{{size:{W}mm 297mm;margin:0;@bottom-center{{content:none}}}}
*{{box-sizing:border-box}}
html,body{{margin:0;background:#fff;font-family:Inter,sans-serif}}
h1{{font-family:'Cormorant Garamond',serif;font-weight:400}}
.spread{{position:relative;width:{W}mm;height:297mm;background:#fff}}
.cv{{width:210mm;height:297mm;position:absolute;top:0;overflow:hidden}}
.backc{{left:0}}
.front{{left:{210+SPINE}mm}}
{FRONTCSS}
.spine{{position:absolute;top:0;left:210mm;width:{SPINE}mm;height:297mm;background:#fff}}
.spt{{position:absolute;left:50%;top:50%;width:250mm;transform:translate(-50%,-50%) rotate(90deg);text-align:center;font-size:{min(9, SPINE*1.4):.1f}pt;letter-spacing:.3em;text-transform:uppercase;color:#9A7B2E;white-space:nowrap}}
.backc{{background:#fff;color:#0D0A07}}
.backc .bi{{position:absolute;left:0;top:0;width:210mm;height:297mm;padding:60mm 26mm 30mm 24mm;text-align:center}}
.backc img{{width:28mm;margin-bottom:22mm}}
.backc .bq{{font-family:'Cormorant Garamond';font-style:italic;font-size:18pt;line-height:1.4;color:#0D0A07;margin:0 0 14mm}}
.backc .bt{{font-size:10pt;line-height:1.7;color:#0D0A07;margin:0 0 14mm}}
.backc .bs{{font-family:'Cormorant Garamond';font-style:italic;font-size:15pt;color:#9A7B2E}}
.backc .bf{{position:absolute;left:24mm;right:26mm;bottom:22mm;font-size:8pt;letter-spacing:.2em;text-transform:uppercase;color:#9A7B2E}}
"""
chtml = (f'<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8"><title>SZINN Alignment Blueprint · {NAAM} · omslag</title>'
         f'<style>{CSS.split(":root")[0]}:root{{--gold:#9A7B2E;--goldl:#C9A96E;--ink:#0D0A07;--muted:#6B6259}}{COVER_CSS}</style></head><body>'
         f'<div class="spread">{achter}<div class="spine">{spine_txt}</div>{voor}</div></body></html>')
open(base + '_omslag.html', 'w').write(chtml)
weasyprint.HTML(filename=base + '_omslag.html').write_pdf(base + '_omslag.pdf')
print('omslag', W, 'x 297 mm · rug', SPINE, 'mm')

# -*- coding: utf-8 -*-
"""SZINN Alignment Blueprint v3.0 · gedeelde opmaak, helpers en vaste teksten."""
import base64, os
HERE=os.path.dirname(os.path.abspath(__file__))
def b64(path, mime):
    return f"data:{mime};base64," + base64.b64encode(open(path,'rb').read()).decode()
LOGO = b64(os.path.join(HERE,'..','assets','img','logo.png'), 'image/png')
COVER_BG = b64(os.path.join(HERE,'..','assets','img','cover.jpg'), 'image/jpeg')
IMG = {k: b64(os.path.join(HERE,'..','assets','img',v+'.jpg'), 'image/jpeg') for k, v in dict(
    voor='d-003', deel1='d-004', herk='d-005', deel2='d-006', getallen='d-007',
    deel3='d-009', integ='d-010', slot='d-011').items()}

# ---------- helpers ----------
def sec(kicker, title, lead=None, body=''):
    l = f'<p class="lead">{lead}</p>' if lead else ''
    return f'<section class="sec"><div class="kicker">{kicker}</div><h1>{title}</h1>{l}{body}</section>'

def full(img, kicker, title, text, cls=''):
    return (f'<section class="full {cls}" style="background-image:url({img})"><div class="ov">'
            f'<div class="fk">{kicker}</div>{"<h1>"+title+"</h1>" if title else ""}<p>{text}</p></div></section>')

def quotepage(img, kicker, text):
    return (f'<section class="full" style="background-image:url({img})"><div class="ov q">'
            f'<div class="fk">{kicker}</div><p class="qt">{text}</p></div></section>')

def cards(items, cols=2, cls='card'):
    out = f'<div class="grid c{cols}">'
    for it in items: out += f'<div class="{cls}">{it}</div>'
    return out + '</div>'

def h3(t, sub=None):
    return f'<h3>{t}</h3>' + (f'<div class="sub">{sub}</div>' if sub else '')

def pull(text, label):
    return f'<div class="pull"><p>{text}</p><div class="plabel">{label}</div></div>'

FONTDIR = os.path.abspath(os.path.join(HERE,'..','assets','fonts'))
# ---------- CSS ----------
CSS = """
@font-face{font-family:'Cormorant Garamond';src:url('file://__FD__/CormorantGaramond.ttf');font-weight:300 700}
@font-face{font-family:'Cormorant Garamond';src:url('file://__FD__/CormorantGaramond-Italic.ttf');font-weight:300 700;font-style:italic}
@font-face{font-family:'Inter';src:url('file://__FD__/Inter.ttf');font-weight:100 900}
:root{--gold:#9A7B2E;--goldl:#C9A96E;--ink:#0D0A07;--cream:#FBF7F0;--muted:#6B6259}
@page{size:A4;margin:22mm 18mm 20mm 18mm;@bottom-center{content:"__FOOT__" counter(page);font-family:Inter;font-size:8pt;letter-spacing:.12em;color:#9A7B2E}}
@page full{margin:0;@bottom-center{content:none}}
@page cover{margin:0;@bottom-center{content:none}}
*{box-sizing:border-box}
body{font-family:Inter,sans-serif;font-size:10.4pt;line-height:1.55;color:var(--ink);margin:0}
h1,h2,h3,h4{font-family:'Cormorant Garamond',serif;font-weight:400;margin:0}
h1{font-size:26pt;line-height:1.15;margin:4pt 0 10pt}
h1 em{font-style:italic;color:var(--gold)}
h2{font-size:16pt;margin:16pt 0 6pt}
h3{font-size:14pt;margin:12pt 0 2pt}
p{margin:0 0 8pt}
.kicker,.sub,.plabel,.lab{font-family:Inter;font-size:7.6pt;letter-spacing:.2em;text-transform:uppercase;color:var(--gold)}
.sub{margin-bottom:4pt}
.lead{font-family:'Cormorant Garamond';font-style:italic;font-size:12.5pt;color:var(--muted);margin-bottom:12pt}
.sec{page-break-before:always}
.sec.cont{page-break-before:auto}
.grid{display:flex;flex-wrap:wrap;gap:10pt;margin:8pt 0 12pt}
.grid.c2>*{width:calc(50% - 5pt)}
.grid.c3>*{width:calc(33.333% - 7pt)}
.card{background:var(--cream);border:.6pt solid #E8DCC4;padding:12pt 13pt;font-size:9.6pt}
.card h3{font-size:14pt}
.card p{margin:0 0 5pt}
.plain{padding:0 6pt 0 0}
.plain h3{font-size:13.5pt}
.pull{border-left:1.8pt solid var(--gold);padding:6pt 0 4pt 14pt;margin:14pt 0}
.pull p{font-family:'Cormorant Garamond';font-style:italic;font-size:13pt;line-height:1.4;margin-bottom:4pt}
.bar{height:3pt;background:#E8DCC4;margin:6pt 0 8pt}.bar i{display:block;height:3pt;background:var(--gold)}
.cardhead{display:flex;justify-content:space-between;align-items:baseline}
.cardhead h3{margin:0}
.small{font-size:9pt;color:var(--muted)}
table{width:100%;border-collapse:collapse;font-size:9.6pt}
td,th{padding:6pt 6pt;vertical-align:top;border-bottom:.5pt solid #E8DCC4;text-align:left}
th{font-family:Inter;font-size:7.6pt;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);font-weight:500}
td.k{color:var(--gold);width:22%}
.num{font-family:'Cormorant Garamond';font-size:30pt;color:var(--gold);line-height:1}
.note{background:var(--cream);border:.6pt solid #E8DCC4;padding:12pt 14pt;margin:10pt 0;page-break-inside:avoid}
.note p{font-family:'Cormorant Garamond';font-style:italic;font-size:13pt;line-height:1.4}
.note.t p{font-family:Inter;font-style:normal;font-size:9.8pt;line-height:1.55}
ol.q{padding-left:0;list-style:none;counter-reset:q}
ol.q li{counter-increment:q;display:flex;gap:12pt;margin-bottom:9pt}
ol.q li:before{content:counter(q);font-family:'Cormorant Garamond';font-size:16pt;color:var(--gold);min-width:18pt}
.prompt{border:.6pt solid #E8DCC4;background:var(--cream);padding:10pt 12pt;margin:0 0 10pt;font-size:9.4pt;page-break-inside:avoid}
.prompt .lab{display:block;margin-bottom:4pt}
.card,.note,.prompt{background:var(--goldl)}
.card .lab,.note .lab,.prompt .lab{color:var(--ink)}
.cal{display:flex;gap:8pt;margin:8pt 0}
.cal>div{width:calc(33.333% - 6pt);border:.6pt solid #E8DCC4;border-top:3pt solid var(--gold);padding:10pt 11pt;font-size:8.9pt;page-break-inside:avoid}
.cal .num{font-size:26pt}
.cal .mt{font-family:'Cormorant Garamond';font-style:italic;font-size:12pt;margin:2pt 0}
.cal hr{border:0;border-top:.5pt solid #E8DCC4;margin:6pt 0}
.perm{border:.8pt dashed var(--goldl);padding:11pt 13pt;page-break-inside:avoid}
.perm .lab{font-family:'Cormorant Garamond';letter-spacing:.25em;font-size:9pt}
.perm h3{font-size:13.5pt;margin:4pt 0 4pt;line-height:1.3}
.perm .sig{display:flex;justify-content:space-between;border-top:.5pt solid #E8DCC4;margin-top:10pt;padding-top:5pt;font-size:8.5pt;color:var(--muted)}
.full{page:full;width:210mm;height:297mm;background-size:cover;background-position:center;position:relative;page-break-after:always;page-break-before:always}
.full .ov{position:absolute;left:0;right:0;bottom:0;padding:70mm 22mm 24mm;background:linear-gradient(to bottom,rgba(13,10,7,0) 0%,rgba(13,10,7,.78) 55%,rgba(13,10,7,.9) 100%);color:#F5EFE3}
.full .fk{font-size:8pt;letter-spacing:.3em;text-transform:uppercase;color:var(--goldl);border-bottom:.6pt solid var(--goldl);display:inline-block;padding-bottom:4pt;margin-bottom:8pt}
.full h1{font-size:40pt;color:#fff;margin:0 0 8pt}
.full p{font-family:'Cormorant Garamond';font-style:italic;font-size:14.5pt;line-height:1.4;color:#F5EFE3}
.full .qt{font-size:19pt}
.full .qt b{font-style:normal;font-weight:400;color:var(--goldl)}
.cover{page:cover;width:210mm;height:297mm;position:relative;background-size:cover;background-position:center;color:#F5EFE3;page-break-after:always}
.cover .clogo{position:absolute;left:22mm;top:20mm;width:18mm;text-align:center}
.cover .clogo img{width:16mm}
.cover .clogo .cl{font-size:7.5pt;letter-spacing:.12em;color:var(--goldl);margin-top:2mm;text-shadow:0 0 3pt rgba(13,10,7,.9)}
.cover .vl{position:absolute;left:22mm;top:52mm;width:.6pt;height:20mm;background:var(--goldl)}
.cover .cpanel{position:absolute;left:0;right:0;bottom:0;height:132mm;background:linear-gradient(to bottom,rgba(13,10,7,0) 0%,rgba(13,10,7,.84) 13%,rgba(13,10,7,.94) 100%);padding:34mm 22mm 24mm}
.cover .k{font-size:9pt;letter-spacing:.25em;text-transform:uppercase;color:var(--goldl)}
.cover h1{font-size:40pt;font-weight:500;color:#fff;line-height:1.08;margin:6pt 0 10pt}
.cover .rw{font-size:9pt;letter-spacing:.25em;text-transform:uppercase;color:var(--goldl);margin-top:4mm}
.cover .meta{position:absolute;left:22mm;right:22mm;bottom:25mm;font-size:8.3pt;line-height:1.95;letter-spacing:.03em;border-top:.6pt solid var(--goldl);padding-top:7pt;color:#F5EFE3}
.cover .fac{position:absolute;left:22mm;right:22mm;bottom:13mm;font-size:8.3pt;letter-spacing:.03em;color:#F5EFE3}
.cover .meta b{font-weight:500;color:#fff;text-transform:uppercase;letter-spacing:.12em}
.toc td{border-bottom:.5pt dotted #D9CDB5;padding:2.6pt 6pt;font-size:9.8pt}
.toc .part{font-family:'Cormorant Garamond';font-size:13pt;color:var(--gold);padding-top:8pt;border:0}
.toc .n{color:var(--gold);width:9%}
.toc .subi{padding-left:22pt;color:var(--muted);font-size:9.3pt}
.mand{text-align:center;margin:6pt 0}
.mand svg{width:150mm;height:150mm}
.legend{display:flex;flex-wrap:wrap;gap:4pt 14pt;font-size:8.8pt;justify-content:center;margin-top:6pt}
.legend span b{font-weight:500;color:var(--gold)}
.back{page-break-before:always;text-align:center;padding-top:60mm;font-size:8.8pt;color:var(--muted);line-height:1.7}
.back img{width:60mm;margin-bottom:26mm}
.back .rq{font-family:'Cormorant Garamond';font-style:italic;font-size:17pt;color:var(--ink);margin-bottom:14pt}
.src p{border-left:1.5pt solid var(--goldl);padding-left:10pt;margin-bottom:6pt;font-size:9.6pt}
.src b{font-weight:500}
.copy{display:none}
.avoid{page-break-inside:avoid}
.gold{color:var(--gold)}
""".replace('__FD__', FONTDIR)

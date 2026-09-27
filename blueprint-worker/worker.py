# -*- coding: utf-8 -*-
"""SZINN Blueprint-worker. Draait de kit volledig automatisch per order:
datalaag → schrijflaag (Claude) → vormcontrole → bouwen (digitaal + binnenwerk + omslag) → audit.py 3× →
bij ✗ de betreffende tekst herschrijven en opnieuw bouwen (regenerate, not patch) → oplevering via callback.

HTTP (alles behalve /health en /files vraagt header X-Worker-Secret):
  POST /jobs                 {orderId, order, callbackUrl}   → 202, job in de wachtrij
  POST /jobs/<id>/rug        {mm}                            → omslag opnieuw met de echte rugbreedte van Print&Bind
  PUT  /corpus/<bestand>     (body = pdf/txt)                → eerder opgeleverde Blueprint voor de overname-controle
  GET  /files/<id>/<soort>?exp=&sig=                         → digitaal | binnenwerk | omslag | audit (HMAC-getekend)
Omgeving: WORKER_SECRET, ANTHROPIC_API_KEY, DATA_DIR (/data), PORT, BLUEPRINT_MODEL."""
import glob, hashlib, hmac, html, json, os, queue, re, shutil, subprocess, sys, tempfile, threading, time, traceback, urllib.request
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

import datalaag, writer

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = datalaag.SCRIPTS
DATA = os.environ.get('DATA_DIR', os.path.join(HERE, 'data'))
CORPUS = os.path.join(DATA, 'opgeleverd')
SECRET = os.environ.get('WORKER_SECRET', '')
MAX_RONDES = 4
os.makedirs(CORPUS, exist_ok=True)


def log(order_id, msg):
    print(f'{datetime.now():%H:%M:%S} {order_id}: {msg}', flush=True)


class Tegenhouden(Exception):
    """Invoer die volgens masterprompt sectie 11 niet automatisch mag worden verwerkt (twijfel = niet opleveren)."""


# ---------- invoer ----------
def invoer(order):
    raw = order.get('intake_data') or {}
    raw = json.loads(raw) if isinstance(raw, str) else raw
    # Leeg veld = de naam hierboven is de geboortenaam (hint in het intakeformulier: alleen invullen als hij afwijkt)
    geboortenaam = ' '.join(str(raw.get('geboortenaam') or f"{raw.get('voornaam') or ''} {raw.get('achternaam') or ''}").split()) \
        or str(order.get('full_birth_name') or order.get('client_name') or '').strip()
    tijd_status = str(raw.get('birth_time_status') or 'exact')
    tijd = str(order.get('birth_time') or raw.get('geboortetijd') or '').strip()
    lat = order.get('birth_lat') or raw.get('geboorte_lat')
    lon = order.get('birth_lng') or raw.get('geboorte_lng')
    plaats = (order.get('birth_location') or raw.get('geboorteplaats_volledig') or raw.get('geboorteplaats') or '').split(',')[0].strip()
    if not geboortenaam:
        raise Tegenhouden('volledige geboortenaam ontbreekt (masterprompt 3.2/11: geen onbevestigde naam)')
    if tijd_status == 'onbekend' or not re.match(r'^\d{1,2}:\d{2}$', tijd):
        raise Tegenhouden('geboortetijd onbekend: huizen en Ascendant zijn niet te berekenen (masterprompt 11)')
    if lat in (None, '') or lon in (None, '') or not plaats:
        raise Tegenhouden('geboorteplaats zonder coördinaten (masterprompt 3.1: altijd de werkelijke stad)')
    datetime.strptime(order['birth_date'], '%Y-%m-%d')
    voornaam = str(raw.get('voornaam') or order.get('client_name') or geboortenaam).split()[0]
    naam = str(order.get('client_name') or f"{raw.get('voornaam', '')} {raw.get('achternaam', '')}").strip() or geboortenaam
    return dict(naam=naam, voornaam=voornaam, geboortenaam=geboortenaam, datum=order['birth_date'], tijd=tijd.zfill(5),
                plaats=plaats, lat=float(lat), lon=float(lon), tz=order.get('birth_tz') or raw.get('geboorte_tz'),
                tijd_status=tijd_status), raw


# ---------- bouwen en controleren ----------
def run(cmd, cwd, env=None, timeout=900):
    return subprocess.run(cmd, cwd=cwd, env={**os.environ, **(env or {})}, capture_output=True, text=True, timeout=timeout)


def bouwen(job_dir, rug=None):
    r = run([datalaag.py(), os.path.join(SCRIPTS, 'book.py'), os.path.join(SCRIPTS, 'build_blueprint.py')] + ([str(rug)] if rug else []),
            job_dir, {'BP_JOB': job_dir})
    if r.returncode:
        raise RuntimeError(f'bouwen mislukt: {r.stderr[-1500:]}')
    return glob.glob(os.path.join(job_dir, '*_3delen_print.html'))[0][:-len('_print.html')]


def corpus_zonder(order_id):
    """Map met alle eerder opgeleverde Blueprints, behalve die van deze order zelf (her-generatie)."""
    tmp = tempfile.mkdtemp(prefix='andere_')
    for fp in glob.glob(os.path.join(CORPUS, '*')):
        if order_id not in os.path.basename(fp):
            os.symlink(fp, os.path.join(tmp, os.path.basename(fp)))
    return tmp


def audit(job_dir, base, f, order_id, heeft_intake):
    """audit.py drie keer op dezelfde versie. Geeft (ok, fouten, uitvoer van de laatste ronde)."""
    andere = corpus_zonder(order_id)
    cmd = [datalaag.py(), os.path.join(SCRIPTS, 'audit.py'), os.path.join(job_dir, 'klant_chart.json'), base + '_print.html',
           f['geboortenaam'], str(f['dag']), str(f['maand']), str(f['jaar']), '--andere', andere]
    if heeft_intake:
        cmd += ['--intake', os.path.join(job_dir, 'intake.txt')]
    try:
        for _ in range(3):
            r = run(cmd, SCRIPTS)
            fouten = [l.strip()[2:] for l in r.stdout.splitlines() if l.strip().startswith('✗')]
            if r.returncode or 'RESULTAAT: OK' not in r.stdout:
                return False, fouten or [f'audit.py faalde: {r.stderr[-800:]}'], r.stdout
        ok3 = re.search(r'is (\d+) keer OK gecontroleerd', r.stdout)
        return bool(ok3 and int(ok3.group(1)) >= 3), [], r.stdout
    finally:
        shutil.rmtree(andere, ignore_errors=True)


CLAIMS = {'zeldzaam/uniek': r'\b(zeldzaam|zeldzame|uniek)\b', 'causaal': r'verklaart waarom|bewijst|is de reden dat|zorgt ervoor dat',
          'medisch': r'\b(diagnose|ziekte|stoornis)\b', 'em-dash': r'[a-z,] — [a-z]', 'u/uw': r'\b(uw|U)\b ', 'Szinn': r'\bSzinn\b'}


def groepen_voor(fout, groepen):
    """Welke schrijfgroep(en) bevatten de tekst waar audit.py over valt."""
    teksten = {g: json.dumps(c, ensure_ascii=False) for g, c in groepen.items()}
    laag = {g: ' '.join(re.findall(r"[a-zà-ÿ0-9']+", t.lower())) for g, t in teksten.items()}
    for lab, rx in CLAIMS.items():
        if fout.startswith(lab):
            return [g for g, t in teksten.items() if re.search(rx, t)] or list(groepen)
    for s in re.findall(r"(\d{1,2}°\d{2}')", fout) + re.findall(r'"([^"]{8,})', fout):
        s = s.rstrip('…')
        woorden = ' '.join(re.findall(r"[a-zà-ÿ0-9']+", s.lower())[:8])
        hit = [g for g in groepen if s in teksten[g] or (len(woorden) > 20 and woorden in laag[g])]
        if hit:
            return hit
    for sleutel, g in (('geboortetijdnoot', 'B'), ('aspect ', 'B'), ('returning number', 'C'), ('praktijken', 'D'),
                       ('prompts', 'D'), ('kalendermaanden', 'D'), ('Inner Permissions', 'D')):
        if sleutel in fout:
            return [g]
    m = re.search(r'naam van een andere klant in het document: (\w+)', fout)
    if m:
        return [g for g, t in teksten.items() if m.group(1) in t] or list(groepen)
    return list(groepen)


def samenvoegen(groepen):
    c = {}
    for g in writer.GROEPEN:
        c.update(groepen[g])
    return c


def dashboard_teksten(c):
    """De velden die dashboard, companion en journey uit texts.json lezen, gevuld vanuit de nieuwe content."""
    P = c['planeten']

    def pp(xs):
        return ''.join(f'<p>{html.escape(x, quote=False)}</p>' for x in xs)
    return dict(
        introduction=pp(c['introductie']),
        summary=dict(oneLiner=c['overzicht']['een_zin'], tikkunSub=c['tikkun'][0]['titel'], rows=c['overzicht']['rijen']),
        astrology=dict(qualities=dict(sun=P['Zon'], moon=P['Maan'], mercury=P['Mercurius'], venus=P['Venus'], mars=P['Mars'], jupiter=P['Jupiter'],
                                      saturn=P['Saturnus'], uranus=P['Uranus'], neptune=P['Neptunus'], pluto=P['Pluto'], northNode=P['Noordknoop'],
                                      southNode=c['zuidknoop_kaart'], chiron=P['Chiron'], ascendant=P['Ascendant'], mc=P['Midhemel'])),
        numerology=dict(lifePathTitle=c['num']['lp_titel'], lifePathBody=pp(c['num']['lp']), pyBody=pp(c['num']['pj'])),
        tikkun=dict(cards=[dict(title=x['titel'], body=x['tekst']) for x in c['tikkun']]),
        integration=dict(layers=dict(astro=c['integratie']['lagen'], focus=c['dagfocus']), shadow=c['integratie']['schaduw']),
        nodes=dict(body=pp(c['knopen']), south=c['zuidknoop_kaart'], north=c['noordknoop_kaart'], chiron=c['chiron']),
        reflection=dict(questions=c['reflectie']),
        flow=dict(questions=c['flow']['vragen']),
    )


def rapport(f, heeft_intake, uitvoer, rondes):
    """Auditrapport voor Elly (masterprompt sectie 9), nooit in het klantdocument."""
    return '\n'.join([
        f"# Auditrapport · {f['naam']}", '',
        f"- Geboortegegevens: {f['geboortedatum']} · {f['geboortetijd']} ({f['tijd_status']}) · {f['geboorteplaats']}",
        f"- Tijdzone UTC{f['tz']:+g} · coördinaten {f['lat']}, {f['lon']} · geboortenaam {f['geboortenaam']}",
        f"- Ascendant wisselt van teken over {f['asc_marge_min']} min · gevoelig: {'; '.join(f['gevoelig']) or 'geen'} · wisselt bij ±2 min: {', '.join(f['wankel']) or 'geen'}",
        f"- Intake: {'ja' if heeft_intake else 'nee (geen citaten, geen levensfeiten)'}",
        f"- Vergeleken met {len(glob.glob(os.path.join(CORPUS, '*')))} eerder opgeleverde Blueprints",
        f"- Schrijf- en controlerondes: {rondes}", '', '## Laatste auditronde (3× OK op deze versie)', '```', uitvoer.strip(), '```'])


def callback(url, payload):
    body = json.dumps({**payload, 'secret': SECRET}).encode()
    for poging in range(5):
        try:
            req = urllib.request.Request(url, data=body, headers={'Content-Type': 'application/json'}, method='POST')
            with urllib.request.urlopen(req, timeout=60) as r:
                if r.status < 300:
                    return True
        except Exception as e:  # noqa: BLE001 — elke netwerkfout: opnieuw proberen
            print(f'callback poging {poging + 1} mislukt: {e}', flush=True)
        time.sleep(10 * (poging + 1))
    return False


def genereer(job):
    oid = job['orderId']
    job_dir = os.path.join(DATA, 'orders', oid, datetime.now().strftime('%Y%m%d-%H%M%S'))
    os.makedirs(job_dir, exist_ok=True)
    o, raw = invoer(job['order'])
    o['job_dir'] = job_dir
    f, _, ruw = datalaag.bouw(o)
    json.dump(f, open(os.path.join(job_dir, 'facts.json'), 'w'), ensure_ascii=False, indent=1)
    open(os.path.join(job_dir, 'datalaag.txt'), 'w').write(ruw)
    intake = writer.intake_tekst(raw)
    open(os.path.join(job_dir, 'intake.txt'), 'w').write(intake)
    log(oid, f"datalaag klaar (LP {f['levenspad']}, PJ {f['pj']}, tijdnoot {f['tijdnoot_nodig']})")

    groepen = writer.schrijf(f, intake, log=lambda m: log(oid, m))
    laatste = []
    for ronde in range(1, MAX_RONDES + 1):
        vorm = writer.vormcontrole(groepen, f)
        if vorm:
            laatste = sum(vorm.values(), [])
            log(oid, f'ronde {ronde}: vormcontrole {vorm}')
            groepen.update(writer.schrijf(f, intake, list(vorm), groepen, vorm, log=lambda m: log(oid, m)))
            continue
        content = samenvoegen(groepen)
        json.dump(content, open(os.path.join(job_dir, 'content.json'), 'w'), ensure_ascii=False, indent=1)
        base = bouwen(job_dir)
        ok, laatste, uitvoer = audit(job_dir, base, f, oid, bool(intake.strip()))
        log(oid, f"ronde {ronde}: audit {'OK (3×)' if ok else laatste}")
        if ok:
            break
        per = {}
        for fout in laatste:
            for g in groepen_voor(fout, groepen):
                per.setdefault(g, []).append(fout)
        groepen.update(writer.schrijf(f, intake, list(per), groepen, per, log=lambda m: log(oid, m)))
    else:
        raise RuntimeError(f'na {MAX_RONDES} rondes niet door de controle: ' + '; '.join(laatste)[:1500])

    # opleveren: versie vastleggen, in de vergelijkingsmap, rapport voor Elly
    ruwe_html = re.sub(r'data:[^)"]+|<svg.*?</svg>', '', open(base + '_print.html').read(), flags=re.S)
    plain = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', ruwe_html)))
    open(os.path.join(CORPUS, f"SZINN_Alignment_Blueprint_{re.sub(r'[^A-Za-zÀ-ÿ]', '', f['voornaam'])}_{oid}_3delen.txt"), 'w').write(plain)
    open(os.path.join(job_dir, 'audit.md'), 'w').write(rapport(f, bool(intake.strip()), uitvoer, ronde))
    json.dump({'dir': job_dir, 'base': base}, open(os.path.join(DATA, 'orders', oid, 'current.json'), 'w'))
    return dict(ok=True, texts=dashboard_teksten(content), mail=content['mail'], files=['digitaal', 'binnenwerk', 'omslag', 'audit'], rondes=ronde)


def rug(oid, mm):
    cur = json.load(open(os.path.join(DATA, 'orders', oid, 'current.json')))
    f = json.load(open(os.path.join(cur['dir'], 'facts.json')))
    base = bouwen(cur['dir'], mm)
    ok, fouten, uitvoer = audit(cur['dir'], base, f, oid, bool(open(os.path.join(cur['dir'], 'intake.txt')).read().strip()))
    if not ok:
        raise RuntimeError(f'audit na rugbreedte {mm} mm: {fouten}')
    with open(os.path.join(cur['dir'], 'audit.md'), 'a') as a:
        a.write(f'\n\n## Omslag opnieuw met rugbreedte {mm} mm ({datetime.now():%Y-%m-%d %H:%M})\n```\n{uitvoer.strip()}\n```\n')


# ---------- wachtrij ----------
# ponytail: één job tegelijk, wachtrij in het geheugen; een herstart van de worker verliest wachtende jobs (admin: "Herstart generatie").
Q = queue.Queue()


def werker():
    while True:
        job = Q.get()
        oid = job['orderId']
        res = None
        try:
            if job.get('rug'):
                rug(oid, job['rug']); log(oid, f"omslag opnieuw met rug {job['rug']} mm")
            else:
                res = genereer(job)
        except Tegenhouden as e:
            log(oid, f'tegengehouden: {e}'); res = dict(ok=False, hold=True, error=f'Niet automatisch opgeleverd: {e}')
        except Exception as e:  # noqa: BLE001 — elke fout moet als 'failed' bij Netlify aankomen
            traceback.print_exc(); res = dict(ok=False, error=str(e)[:2000]) if not job.get('rug') else None
        finally:
            Q.task_done()
        if res is not None and job.get('callbackUrl'):
            callback(job['callbackUrl'], {'orderId': oid, **res})


# ---------- HTTP ----------
def teken(oid, soort, exp):
    return hmac.new(SECRET.encode(), f'{oid}:{soort}:{exp}'.encode(), hashlib.sha256).hexdigest()


BESTAND = {'digitaal': '{b}.pdf', 'binnenwerk': '{bb}_BOEK_binnenwerk.pdf', 'omslag': '{bb}_BOEK_omslag.pdf'}


class H(BaseHTTPRequestHandler):
    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(body)))
        self.end_headers(); self.wfile.write(body)

    def _auth(self):
        if not SECRET or not hmac.compare_digest(self.headers.get('X-Worker-Secret', ''), SECRET):
            self._json(403, {'error': 'forbidden'}); return False
        return True

    def _body(self):
        return self.rfile.read(int(self.headers.get('Content-Length') or 0))

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == '/health':
            return self._json(200, {'ok': True, 'wachtrij': Q.qsize()})
        m = re.match(r'^/files/([\w-]+)/(digitaal|binnenwerk|omslag|audit)$', u.path)
        if not m:
            return self._json(404, {'error': 'niet gevonden'})
        oid, soort = m.groups(); q = parse_qs(u.query)
        exp = q.get('exp', ['0'])[0]; sig = q.get('sig', [''])[0]
        if not SECRET or not exp.isdigit() or int(exp) < time.time() or not hmac.compare_digest(sig, teken(oid, soort, exp)):
            return self._json(403, {'error': 'link verlopen of ongeldig'})
        try:
            cur = json.load(open(os.path.join(DATA, 'orders', oid, 'current.json')))
        except FileNotFoundError:
            return self._json(404, {'error': 'nog geen Blueprint'})
        b = cur['base']; bb = b.replace('_3delen', '')
        pad = os.path.join(cur['dir'], 'audit.md') if soort == 'audit' else BESTAND[soort].format(b=b, bb=bb)
        if not os.path.exists(pad):
            return self._json(404, {'error': 'bestand ontbreekt'})
        naam = os.path.basename(bb) + '_auditrapport.md' if soort == 'audit' else os.path.basename(pad)
        self.send_response(200)
        self.send_header('Content-Type', 'text/markdown; charset=utf-8' if soort == 'audit' else 'application/pdf')
        self.send_header('Content-Disposition', f'{"inline" if soort == "digitaal" else "attachment"}; filename="{naam}"')
        self.send_header('Access-Control-Allow-Origin', '*')  # de getekende link is de autorisatie; viewer haalt de PDF via fetch()
        self.send_header('Content-Length', str(os.path.getsize(pad))); self.end_headers()
        with open(pad, 'rb') as fh:
            shutil.copyfileobj(fh, self.wfile)

    def do_POST(self):
        if not self._auth():
            return
        try:
            data = json.loads(self._body() or b'{}')
        except ValueError:
            return self._json(400, {'error': 'geen geldige JSON'})
        if self.path == '/jobs':
            if not data.get('orderId') or not data.get('order'):
                return self._json(400, {'error': 'orderId en order zijn verplicht'})
            Q.put({'orderId': data['orderId'], 'order': data['order'], 'callbackUrl': data.get('callbackUrl')})
            return self._json(202, {'ok': True, 'wachtrij': Q.qsize()})
        m = re.match(r'^/jobs/([\w-]+)/rug$', self.path)
        if m:
            try:
                mm = float(data.get('mm'))
                assert 1 <= mm <= 60
            except (TypeError, ValueError, AssertionError):
                return self._json(400, {'error': 'rugbreedte in mm (1–60) verplicht'})
            if not os.path.exists(os.path.join(DATA, 'orders', m.group(1), 'current.json')):
                return self._json(404, {'error': 'nog geen Blueprint voor deze order'})
            Q.put({'orderId': m.group(1), 'rug': mm})
            return self._json(202, {'ok': True})
        self._json(404, {'error': 'niet gevonden'})

    def do_PUT(self):
        if not self._auth():
            return
        m = re.match(r'^/corpus/([\w.\-]+\.(pdf|txt|html))$', self.path)
        if not m:
            return self._json(400, {'error': 'bestandsnaam moet eindigen op .pdf, .txt of .html'})
        open(os.path.join(CORPUS, os.path.basename(m.group(1))), 'wb').write(self._body())
        self._json(201, {'ok': True, 'corpus': len(os.listdir(CORPUS))})

    def log_message(self, *a):
        pass


if __name__ == '__main__':
    if not SECRET:
        sys.exit('WORKER_SECRET ontbreekt')
    threading.Thread(target=werker, daemon=True).start()
    port = int(os.environ.get('PORT', 8080))
    print(f'SZINN blueprint-worker op :{port} · data {DATA} · model {writer.MODEL}', flush=True)
    ThreadingHTTPServer(('', port), H).serve_forever()

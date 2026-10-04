# -*- coding: utf-8 -*-
"""SZINN Blueprint-worker. Draait de kit volledig automatisch per order:
datalaag → schrijflaag (Claude) → vormcontrole → bouwen (digitaal + binnenwerk + omslag) → audit.py 3× →
bij ✗ de betreffende tekst herschrijven en opnieuw bouwen (regenerate, not patch) → oplevering via callback.

Draait als GitHub Actions-workflow in de private runner-repo (kit + .github/workflows/blueprint.yml), één run per job.
Opslag is de repo zelf: release "order-<id>" (PDF's, auditrapport, job.tar.gz voor de rugbreedte) en release
"corpus" (eerder opgeleverde Blueprints voor de overname-controle). netlify/edge-functions/kit-files.js serveert ze.
Omgeving: ORDER_ID, ORDER_JSON (job) of RUG (mm), CALLBACK_URL, WORKER_SECRET, ANTHROPIC_API_KEY, DATA_DIR,
BLUEPRINT_MODEL, GITHUB_REPOSITORY + GH_TOKEN (voor gh)."""
import glob, html, json, os, re, shutil, subprocess, sys, tempfile, time, traceback, urllib.request
from datetime import datetime

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
           f['geboortenaam'], str(f['dag']), str(f['maand']), str(f['jaar']), '--andere', andere, '--voornaam', f['voornaam']]
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
        writer.zonder_aanhalingstekens(groepen)
        vorm = writer.vormcontrole(groepen, f, leesbaar=ronde <= 2)
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
    # relatief t.o.v. DATA: de rugbreedte-run pakt job.tar.gz uit op een andere runner
    json.dump({'dir': os.path.relpath(job_dir, DATA), 'base': os.path.relpath(base, DATA)}, open(os.path.join(DATA, 'orders', oid, 'current.json'), 'w'))
    return dict(ok=True, texts=dashboard_teksten(content), mail=content['mail'], files=['digitaal', 'binnenwerk', 'omslag', 'audit'], rondes=ronde)


def huidig(oid):
    cur = json.load(open(os.path.join(DATA, 'orders', oid, 'current.json')))
    return os.path.join(DATA, cur['dir']), os.path.join(DATA, cur['base'])


def rug(oid, mm):
    job_dir, _ = huidig(oid)
    f = json.load(open(os.path.join(job_dir, 'facts.json')))
    base = bouwen(job_dir, mm)
    ok, fouten, uitvoer = audit(job_dir, base, f, oid, bool(open(os.path.join(job_dir, 'intake.txt')).read().strip()))
    if not ok:
        raise RuntimeError(f'audit na rugbreedte {mm} mm: {fouten}')
    with open(os.path.join(job_dir, 'audit.md'), 'a') as a:
        a.write(f'\n\n## Omslag opnieuw met rugbreedte {mm} mm ({datetime.now():%Y-%m-%d %H:%M})\n```\n{uitvoer.strip()}\n```\n')


# ---------- opslag: releases in de runner-repo ----------
def gh(*args):
    r = subprocess.run(['gh', *args, '-R', os.environ['GITHUB_REPOSITORY']], capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(f'gh {" ".join(args[:2])}: {r.stderr.strip()[-500:]}')
    return r.stdout


def haal_corpus():
    try:
        gh('release', 'download', 'corpus', '-D', CORPUS, '--clobber')
    except RuntimeError as e:  # nog geen corpus: de eerste Blueprint vergelijkt met niets
        print(f'corpus: {e}', flush=True)


def haal_job(oid):
    tar = os.path.join(DATA, 'job.tar.gz')
    gh('release', 'download', f'order-{oid}', '-p', 'job.tar.gz', '-O', tar, '--clobber')
    subprocess.run(['tar', '-xzf', tar, '-C', DATA], check=True)


def opslaan(oid, nieuw=False):
    """PDF's, auditrapport en de jobmap (zonder pdf/html, voor de rugbreedte) naar release order-<id>.
    Nieuw = de vorige versie gaat eruit (bestandsnamen kunnen wijzigen) en deze Blueprint gaat in het corpus."""
    job_dir, b = huidig(oid)
    bb = b.replace('_3delen', '')
    audit_md = os.path.join(DATA, os.path.basename(bb) + '_auditrapport.md')
    shutil.copy(os.path.join(job_dir, 'audit.md'), audit_md)
    tar = os.path.join(DATA, 'job.tar.gz')
    subprocess.run(['tar', '-czf', tar, '--exclude=*.pdf', '--exclude=*.html', '-C', DATA,
                    os.path.relpath(job_dir, DATA), os.path.join('orders', oid, 'current.json')], check=True)
    tag = f'order-{oid}'
    if nieuw:
        try:
            gh('release', 'delete', tag, '--yes', '--cleanup-tag')
        except RuntimeError:
            pass
    try:
        gh('release', 'view', tag)
    except RuntimeError:
        gh('release', 'create', tag, '--title', tag, '--notes', 'SZINN Blueprint (kit v4)')
    gh('release', 'upload', tag, b + '.pdf', bb + '_BOEK_binnenwerk.pdf', bb + '_BOEK_omslag.pdf', audit_md, tar, '--clobber')
    if nieuw:
        try:
            gh('release', 'view', 'corpus')
        except RuntimeError:
            gh('release', 'create', 'corpus', '--title', 'corpus', '--notes', 'Eerder opgeleverde Blueprints (overname-controle)')
        gh('release', 'upload', 'corpus', *glob.glob(os.path.join(CORPUS, f'*_{oid}_3delen.txt')), '--clobber')


if __name__ == '__main__':
    oid = os.environ['ORDER_ID']
    haal_corpus()
    if os.environ.get('RUG'):
        mm = float(os.environ['RUG'])
        if not 1 <= mm <= 60:
            sys.exit('rugbreedte in mm (1–60) verplicht')
        haal_job(oid); rug(oid, mm); opslaan(oid)
        log(oid, f'omslag opnieuw met rug {mm} mm')
        sys.exit(0)
    try:
        res = genereer({'orderId': oid, 'order': json.loads(os.environ['ORDER_JSON'])})
        opslaan(oid, nieuw=True)  # eerst opslaan, dan pas melden: de klant krijgt direct een werkende link
    except Tegenhouden as e:
        log(oid, f'tegengehouden: {e}'); res = dict(ok=False, hold=True, error=f'Niet automatisch opgeleverd: {e}')
    except Exception as e:  # noqa: BLE001 — elke fout moet als 'failed' bij Netlify aankomen
        traceback.print_exc(); res = dict(ok=False, error=str(e)[:2000])
    if os.environ.get('CALLBACK_URL') and not callback(os.environ['CALLBACK_URL'], {'orderId': oid, **res}):
        sys.exit('callback mislukt')
    sys.exit(0 if res['ok'] else 1)

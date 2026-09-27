// Kit v4-bestanden (PDF's, auditrapport) uit de release "order-<id>" van de private
// blueprint-runner-repo. Een edge function omdat de PDF's ± 24 MB zijn: een gewone
// function mag maar 6 MB teruggeven, deze streamt door. De getekende link uit
// lib/kit-worker.js (signedFileUrl) is de autorisatie.

const SOORT = { digitaal: '_3delen.pdf', binnenwerk: '_BOEK_binnenwerk.pdf', omslag: '_BOEK_omslag.pdf', audit: '_auditrapport.md' };

const fout = (status, error) => Response.json({ error }, { status });

async function geldig(secret, data, sig) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)));
  const hex = [...mac].map(b => b.toString(16).padStart(2, '0')).join('');
  let verschil = hex.length ^ sig.length;
  for (let i = 0; i < hex.length; i++) verschil |= hex.charCodeAt(i) ^ (sig.charCodeAt(i) || 0);
  return verschil === 0;
}

export default async (req) => {
  const u = new URL(req.url);
  const m = u.pathname.match(/^\/kit-files\/([\w-]+)\/(digitaal|binnenwerk|omslag|audit)$/);
  if (!m) return fout(404, 'niet gevonden');
  const [, oid, soort] = m;
  const secret = Netlify.env.get('WORKER_SECRET') || '';
  const exp = u.searchParams.get('exp') || '', sig = u.searchParams.get('sig') || '';
  if (!secret || !/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000 || !(await geldig(secret, `${oid}:${soort}:${exp}`, sig))) {
    return fout(403, 'link verlopen of ongeldig');
  }

  const repo = Netlify.env.get('BLUEPRINT_RUNNER_REPO') || 'UDefine1/szinn-blueprint-runner';
  const auth = { Authorization: `Bearer ${Netlify.env.get('GITHUB_RUNNER_TOKEN')}`, 'X-GitHub-Api-Version': '2022-11-28' };
  const rel = await fetch(`https://api.github.com/repos/${repo}/releases/tags/order-${oid}`, { headers: { ...auth, Accept: 'application/vnd.github+json' } });
  if (rel.status === 404) return fout(404, 'nog geen Blueprint');
  if (!rel.ok) return fout(502, `GitHub HTTP ${rel.status}`);
  const asset = (await rel.json()).assets.find(a => a.name.endsWith(SOORT[soort]));
  if (!asset) return fout(404, 'bestand ontbreekt');

  // GitHub antwoordt met een redirect naar kortlevende opslag; die zonder token volgen.
  const r = await fetch(asset.url, { headers: { ...auth, Accept: 'application/octet-stream' }, redirect: 'manual' });
  const file = r.headers.get('location') ? await fetch(r.headers.get('location')) : r;
  if (!file.ok) return fout(502, `bestand ophalen: HTTP ${file.status}`);
  return new Response(file.body, {
    headers: {
      'Content-Type': soort === 'audit' ? 'text/markdown; charset=utf-8' : 'application/pdf',
      'Content-Disposition': `${soort === 'digitaal' ? 'inline' : 'attachment'}; filename="${asset.name}"`,
      'Content-Length': String(asset.size),
      'Cache-Control': 'private, no-store',
    },
  });
};

export const config = { path: '/kit-files/*' };

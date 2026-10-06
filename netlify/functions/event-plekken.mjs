/**
 * SZINN · teller voor de introductieavonden (14 en 28 oktober, 11 november 2026)
 *
 * Houdt bij hoeveel mensen zich hebben aangemeld, zodat de eventpagina
 * "nog X plekken" kan tonen. Opslag in Netlify Blobs (geen database nodig).
 *
 * Kies de avond met ?event=2026-10-28 (zonder event = 14 oktober).
 *
 * GET  /.netlify/functions/event-plekken?event=...       -> { max, aangemeld, over }
 * POST { actie: "aanmelding", email }                     -> telt 1 op (zelfde e-mail telt maar één keer)
 * POST { actie: "zet", wachtwoord, aangemeld?, max? }     -> beheer: aantallen aanpassen of terugzetten
 * POST { actie: "reset", wachtwoord }                     -> beheer: alles terug naar 0
 *
 * Het beheerwachtwoord is hetzelfde als voor /admin: ADMIN_PASSWORD
 * (Netlify > Site configuration > Environment variables).
 */
import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

const EVENTS = ["2026-10-14", "2026-10-28", "2026-11-11"];
const STANDAARD_MAX = 20;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });

const leeg = () => ({ max: STANDAARD_MAX, aangemeld: 0, emails: [] });
const publiek = (s) => ({ max: s.max, aangemeld: s.aangemeld, over: Math.max(0, s.max - s.aangemeld) });

export default async (req) => {
  const ev = new URL(req.url).searchParams.get("event") || EVENTS[0];
  if (!EVENTS.includes(ev)) return json({ ok: false, error: "onbekende avond" }, 404);
  const SLEUTEL = "introductieavond-" + ev;
  const store = getStore({ name: "szinn-events", consistency: "strong" });
  const lees = async () => {
    const s = (await store.get(SLEUTEL, { type: "json" })) || leeg();
    // Oktober 2026: maximum verlaagd van 25 naar 20. Oude opgeslagen standaard (25) wordt 20.
    if (s.max === 25) { s.max = STANDAARD_MAX; await store.setJSON(SLEUTEL, s); }
    return s;
  };
  const schrijf = (s) => store.setJSON(SLEUTEL, s);

  if (req.method === "GET") return json(publiek(await lees()));
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ ok: false, error: "ongeldige aanvraag" }, 400); }

  const s = await lees();

  if (body.actie === "aanmelding") {
    const email = String(body.email || "").trim().toLowerCase().slice(0, 160);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ ok: false, error: "ongeldig e-mailadres" }, 400);
    // Alleen een hash bewaren, geen e-mailadressen.
    const h = createHash("sha256").update(email).digest("hex").slice(0, 24);
    if (!s.emails.includes(h) && s.aangemeld < s.max) {
      s.emails.push(h);
      s.aangemeld += 1;
      await schrijf(s);
    }
    return json({ ok: true, ...publiek(s) });
  }

  if (body.actie === "zet" || body.actie === "reset") {
    const ww = process.env.ADMIN_PASSWORD;
    if (!ww || String(body.wachtwoord || "") !== ww) return json({ ok: false, error: "wachtwoord klopt niet" }, 401);
    if (body.actie === "reset") {
      const nieuw = leeg();
      nieuw.max = s.max;
      await schrijf(nieuw);
      return json({ ok: true, ...publiek(nieuw) });
    }
    const a = Number(body.aangemeld), m = Number(body.max);
    if (Number.isInteger(m) && m >= 0 && m <= 1000) s.max = m;
    if (Number.isInteger(a) && a >= 0 && a <= 1000) {
      s.aangemeld = a;
      if (s.emails.length > a) s.emails = s.emails.slice(0, a);
    }
    await schrijf(s);
    return json({ ok: true, ...publiek(s) });
  }

  return json({ ok: false, error: "onbekende actie" }, 400);
};

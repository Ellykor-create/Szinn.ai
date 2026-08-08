/**
 * SZINN · inschrijving Persoonlijk Jaar tool
 *
 * Stuurt de inschrijving vanaf de server naar Enormail, zodat de browser
 * er niet tussen zit. Enormail verstuurt daarna zelf de bevestigingsmail.
 *
 * Nodig in Netlify onder Site configuration > Environment variables:
 *   ENORMAIL_API_KEY   de sleutel uit Enormail > Mijn account > API toegang
 *
 * Aanroepen met POST naar /.netlify/functions/subscribe
 */

// Alleen deze formulieren mogen aangesproken worden, zodat niemand
// via jouw server een willekeurige lijst kan vollopen.
const FORMS = {
  nl: "c55bb7f5cf2da67355ed0497e5e1bad2",
  en: "ecddd0973d22af3bbfd5d75a58549c79"
};

// Let op: controleer in Enormail onder Formulieren welke van deze twee aan de
// Nederlandse lijst hangt en welke aan de Engelse. Staan ze omgedraaid, wissel
// dan simpelweg de twee regels hierboven om.

export default async (req) => {
  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" }
    });

  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);

  const key = process.env.ENORMAIL_API_KEY;
  if (!key) return json({ ok: false, error: "geen API-sleutel ingesteld" }, 500);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "ongeldige aanvraag" }, 400);
  }

  const naam  = String(body.naam || "").trim().slice(0, 80);
  const email = String(body.email || "").trim().slice(0, 160);
  const lang  = body.lang === "en" ? "en" : "nl";
  const d = Number(body.dag), m = Number(body.maand), y = Number(body.jaar);

  if (!naam) return json({ ok: false, error: "naam ontbreekt" }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
    return json({ ok: false, error: "ongeldig e-mailadres" }, 400);

  const formId = FORMS[lang];
  if (!formId) return json({ ok: false, error: "geen formulier voor " + lang }, 400);

  // Enormail verwacht de geboortedatum als JJJJ-MM-DD
  const pad = (n) => String(n).padStart(2, "0");
  const geldig = d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= 2100;
  const birthday = geldig ? `${y}-${pad(m)}-${pad(d)}` : "";

  const form = new URLSearchParams();
  form.append("name", naam);
  form.append("email", email);
  if (birthday) form.append("fields[birthday]", birthday);

  const auth = Buffer.from(`${key}:x`).toString("base64");

  try {
    const res = await fetch(
      `https://api.enormail.eu/api/1.0/forms/${formId}.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: form.toString()
      }
    );

    const tekst = await res.text();

    if (res.status === 200 || res.status === 201) {
      return json({ ok: true });
    }

    console.error("Enormail gaf status", res.status, tekst.slice(0, 300));
    return json({ ok: false, error: "enormail", status: res.status }, 502);
  } catch (e) {
    console.error("Enormail onbereikbaar:", e.message);
    return json({ ok: false, error: "onbereikbaar" }, 502);
  }
};

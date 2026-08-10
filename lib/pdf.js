'use strict';
// PDF-generatie: rendert de blueprint-HTML naar een print-PDF met headless
// Chromium. Op Netlify draait dit in de background function via
// @sparticuz/chromium; lokaal kan CHROME_PATH naar een geïnstalleerde
// Chrome/Chromium wijzen.

const fs = require('fs');

// Bekende lokale Chrome/Chromium-locaties (macOS + Linux). Zo werkt de directe
// PDF-download ook lokaal, zonder CHROME_PATH te hoeven zetten.
const LOCAL_CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
];

// Zowel puppeteer-core als @sparticuz/chromium zijn ESM-only. Een kale
// require() faalt daarop in de Netlify-runtime (ERR_REQUIRE_ESM); een
// dynamische import werkt overal. De specifier gaat via new Function zodat de
// bundler de import niet terugschrijft naar require().
const dynamicImport = new Function('s', 'return import(s)');
async function loadESM(name) {
  const mod = await dynamicImport(name);
  return mod.default || mod;
}

async function resolveExecutable() {
  if (process.env.CHROME_PATH) return { path: process.env.CHROME_PATH, args: [] };
  for (const p of LOCAL_CHROME_PATHS) {
    try { if (fs.existsSync(p)) return { path: p, args: [] }; } catch {}
  }
  // Serverless (Netlify): meegebundelde headless chromium.
  let chromium;
  try {
    chromium = await loadESM('@sparticuz/chromium');
  } catch (err) {
    throw new Error(`@sparticuz/chromium laden mislukt: ${err.message}`);
  }
  let execPath;
  try {
    execPath = await chromium.executablePath();
  } catch (err) {
    throw new Error(`chromium-binary uitpakken mislukt: ${err.message}`);
  }
  if (!execPath) throw new Error('geen chromium-binary gevonden (zet CHROME_PATH)');
  return { path: execPath, args: chromium.args };
}

async function generatePDF(html) {
  const puppeteer = await loadESM('puppeteer-core');
  const exe = await resolveExecutable();
  const browser = await puppeteer.launch({
    executablePath: exe.path,
    args: [...exe.args, '--no-sandbox', '--disable-dev-shm-usage'],
    headless: 'shell',
    defaultViewport: { width: 1080, height: 1400 },
  });
  try {
    const page = await browser.newPage();
    // Animaties stilzetten voor een stabiele momentopname
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 120000 });
    // Print-media: activeert het @media print-blok in het template
    // (pagina-afbraak per sectie, compacte marges).
    await page.emulateMediaType('print');
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.textContent = '*, *::before, *::after { animation: none !important; transition: none !important; }';
      document.head.appendChild(style);
    });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '12mm', left: '0mm', right: '0mm' },
      timeout: 120000,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close().catch(() => {});
  }
}

module.exports = { generatePDF };

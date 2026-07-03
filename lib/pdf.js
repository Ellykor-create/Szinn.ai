'use strict';
// PDF-generatie: rendert de blueprint-HTML naar een print-PDF met headless
// Chromium. Op Netlify draait dit in de background function via
// @sparticuz/chromium; lokaal kan CHROME_PATH naar een geïnstalleerde
// Chrome/Chromium wijzen.

async function resolveExecutable() {
  if (process.env.CHROME_PATH) return { path: process.env.CHROME_PATH, args: [] };
  const chromium = require('@sparticuz/chromium');
  return { path: await chromium.executablePath(), args: chromium.args };
}

async function generatePDF(html) {
  const puppeteer = require('puppeteer-core');
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

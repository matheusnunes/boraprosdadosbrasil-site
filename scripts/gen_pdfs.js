
const PW = '/Users/thaisa.silva/.npm/_npx/e41f203b7505f1fb/node_modules/playwright';
const { chromium } = require(PW);
const fs = require('fs');
const path = require('path');

const ROOT = '/Users/thaisa.silva/sandbox/site/boraprosdadosbrasil-site';
const OUT = ROOT + '/pdf';
const BASE = 'http://127.0.0.1:8000';
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  { url: '/',           name: 'comparativo-lula-x-bolsonaro' },
  { url: '/propostas/', name: 'propostas-2026' },
  { url: '/balanco/',   name: 'balanco-promessas' },
  { url: '/fontes/',    name: 'fontes-e-dados' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const P of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: 1032, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const msgs = [];
    page.on('pageerror', e => msgs.push('PAGEERROR ' + e.message));
    page.on('console', m => { if (m.type() === 'error') msgs.push('CONSOLE ' + m.text().slice(0,120)); });
    await page.goto(BASE + P.url, { waitUntil: 'load', timeout: 90000 });
    await page.evaluate(() => document.fonts.ready);
    const n0 = await page.evaluate(() => document.querySelectorAll('canvas').length);
    if (n0 > 0) {
      try {
        await page.waitForFunction(() => {
          const cs = Array.from(document.querySelectorAll('canvas'));
          return cs.length > 0 && cs.every(c => c.width > 0 && c.height > 0);
        }, { timeout: 15000 });
      } catch (e) { msgs.push('WARN canvas-wait-timeout'); }
    }
    await page.evaluate(async () => {
      const h = document.body.scrollHeight;
      for (let y = 0; y < h; y += 1000) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(2500);
    await page.addStyleTag({ content: '@media print { body{background:#fff !important; background-image:none !important} .sitebar,.sitefoot,.topnav,.prog,.consent{display:none !important} }' });
    const outPath = OUT + '/' + P.name + '.pdf';
    await page.pdf({ path: outPath, format: 'A4', landscape: true, printBackground: true, margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' } });
    const st = fs.statSync(outPath);
    results.push({ name: P.name, bytes: st.size, canvases: n0, msgs });
    console.log('done ' + P.name + ': ' + st.size + ' bytes, canvases=' + n0 + ', msgs=' + msgs.length + (msgs.length ? ' :: ' + msgs.slice(0,3).join(' | ') : ''));
    await ctx.close();
  }
  await browser.close();
  console.log('ALL DONE');
})().catch(e => { console.error('FATAL', (e && e.stack) || e); process.exit(1); });


const PW = '/Users/thaisa.silva/.npm/_npx/e41f203b7505f1fb/node_modules/playwright';
const { chromium } = require(PW);
const fs = require('fs');
const OUT = '/Users/thaisa.silva/sandbox/site/boraprosdadosbrasil-site/public/assets/img';
const LOGO = 'file://' + OUT + '/logo-800.png';

const PAGES = [
  ['comparativo', 'Governo Bolsonaro × Governo Lula:<br>qual foi melhor para os <span style="color:#02522b">99%</span>?',
   'Renda, emprego, inflação, gastos e dívida, comparados com dados oficiais, em janelas iguais.'],
  ['propostas', 'Lula × Flávio: o que cada plano promete<br>e se <span style="color:#003fb0">diz como</span>',
   'As propostas registradas no TSE para o 2º turno de 2026 — com o texto na íntegra.'],
  ['balanco', 'Promessas de governo: o que foi prometido<br>× o que foi <span style="color:#02522b">cumprido</span>',
   'Balanço dos planos de 2018 e 2022, veredito item a item, só com fontes oficiais.'],
  ['fontes', 'Fontes e dados: os 32 arquivos<br>originais das análises',
   'TSE, Banco Central, IBGE, Tesouro e Fed, como os portais publicam, com hash SHA-256 e onde cada um é usado.'],
];

function html(title, sub) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0}
  body{width:1200px;height:630px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#f7f7f8;position:relative;overflow:hidden}
  .wrap{position:absolute;inset:0;padding:58px 70px;display:flex;flex-direction:column;justify-content:space-between}
  .tag{display:inline-block;background:#02522b;color:#fff;font-size:21px;font-weight:700;padding:9px 20px;border-radius:999px;letter-spacing:.02em}
  h1{font-size:55px;line-height:1.13;letter-spacing:-.025em;margin:30px 0 0;max-width:1060px;color:#18181b;font-weight:800}
  p.sub{font-size:25px;color:#52525b;margin:20px 0 0;max-width:960px;line-height:1.35}
  .foot{display:flex;justify-content:space-between;align-items:flex-end}
  .brand{font-size:23px;font-weight:800;color:#18181b;letter-spacing:-.01em}
  .brand small{display:block;font-size:17px;font-weight:500;color:#71717a;margin-top:4px;letter-spacing:0}
  .foot img{height:104px;display:block}
  .bar{position:absolute;left:0;right:0;bottom:0;height:14px;background:linear-gradient(90deg,#02522b 0%,#02522b 55%,#003fb0 100%)}
  </style></head><body>
  <div class="wrap">
    <div>
      <span class="tag">dados abertos · fontes oficiais</span>
      <h1>${title}</h1>
      <p class="sub">${sub}</p>
    </div>
    <div class="foot">
      <div class="brand">Bora pros dados Brasil<small>análises com dados públicos oficiais</small></div>
      <img src="${LOGO}">
    </div>
  </div>
  <div class="bar"></div>
  </body></html>`;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const [name, title, sub] of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.setContent(html(title, sub), { waitUntil: 'load' });
    await page.waitForTimeout(600);
    const out = OUT + '/og-' + name + '.jpg';
    await page.screenshot({ path: out, type: 'jpeg', quality: 86 });
    console.log('og-' + name + '.jpg', fs.statSync(out).size, 'bytes');
    await ctx.close();
  }
  await browser.close();
  console.log('OG DONE');
})().catch(e => { console.error('FATAL', e && e.stack || e); process.exit(1); });

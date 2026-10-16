#!/usr/bin/env node
/* Gera as imagens de prévia de link (Open Graph, 1200×630, JPG) com o sistema visual do charts.js:
 *   public/og/c/<id>.jpg           uma por comparação ativa do registro (cartão BPD.card no formato 'og')
 *   public/og/paginas/<nome>.jpg   uma por página (home = síntese em dois blocos; balanço = placar; propostas =
 *                                  ferramenta nomeada; comparações = mosaico equilibrado; seleção = 7 quesitos; fontes)
 * Os cartões das páginas são os MESMOS do site (CARDS_HOME/__shareDefs, CARDS_BALANCO, CARDS_PROPOSTAS); os demais
 * itens saem do registro (dados/comparacoes.json). Roda localmente, depois de `python3 scripts/build.py`; as imagens
 * são versionadas (o build do Netlify só copia). Uso:
 *   PLAYWRIGHT=/caminho/node_modules/playwright node scripts/gen_og_cards.js   (ou com playwright instalado)
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const OUT_C = path.join(ROOT, 'public', 'og', 'c');
const OUT_P = path.join(ROOT, 'public', 'og', 'paginas');
const LIMITE_KB = 150;
const SITE = 'boraprosdadosbrasil.netlify.app';
const MAPA_CARDS = { P00: 'p-geral', P01: 'p-bolso', P02: 'p-seguranca', P03: 'p-servicos', P04: 'p-economia', P05: 'p-ambiente',
  B00: 'b-placar', B01: 'b-bolso', B02: 'b-servicos', B03: 'b-estado', B04: 'b-seguranca' };
// mosaicos equilibrados (cada lado à frente em metade): comparações; seleção = os 7 quesitos do placar
const MOSAICO = [2, 44, 83, 7, 50, 49];
const PLACAR = [1, 2, 83, 4, 6, 7, 8];

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
function servidor() {
  return new Promise(ok => {
    const s = http.createServer((req, res) => {
      let u = decodeURIComponent(req.url.split('?')[0]);
      if (u.endsWith('/')) u += 'index.html';
      const f = path.join(DIST, u);
      if (!f.startsWith(DIST) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    s.listen(0, '127.0.0.1', () => ok(s));
  });
}

/* código que roda na página: monta a def de um item do registro e exporta o cartão como JPG (base64) */
const NA_PAGINA = `
window.__ogSite = '${SITE}';
window.__og = (function () {
  function dataBR(iso) { var m = /^(\\d{4})-(\\d\\d)-(\\d\\d)/.exec(iso || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }
  function nome(n) { return n.replace(/\\s*\\(plano \\d{4}\\)$/, ''); }
  var ST = { ok: 'ok', okmid: 'ok', mid: 'mid', run: 'run', no: 'no', na: 'na' };
  function crit(it) {
    if (it.resultado === 'vitoria') return it.criterio === 'menor' ? '↓ menor é melhor' : '↑ maior é melhor';
    return it.resultado === 'contexto' ? 'contexto · não conta ponto' : 'comparação sem placar';
  }
  function defReg(it, reg) {
    var vit = it.resultado === 'vitoria', g = it.grafico || {}, fmt = g.formato || {};
    var L = { b: { nome: nome(it.lados.b.nome), curto: it.lados.b.curto, periodo: it.periodo_curto.b },
              l: { nome: nome(it.lados.l.nome), curto: it.lados.l.curto, periodo: it.periodo_curto.l } };
    var d = { id: 'cmp-' + it.id, tema: it.tema_curto || it.titulo, lados: L, criterio: vit ? it.criterio : null, valores: g.valores,
      forca: vit ? it.forca : null, mudaria: vit && it.forca === 'apertada' ? (it.o_que_mudaria || it.ressalva || null) : null,
      detalhe: it.unidade, fonte: it.fonte, periodo: it.periodo_curto.b + ' × ' + it.periodo_curto.l, dados: it.dados_ate,
      atualizado: dataBR(reg.gerado_em) };
    if (vit) { var v = it.vencedor, o = v === 'b' ? 'l' : 'b';
      d.manchete = { valor: it.lados[v].valor, texto: 'no ' + L[v].nome + ', contra ' + it.lados[o].valor + ' no ' + L[o].nome }; }
    if (!vit) { d.titulo = (it.tema_curto || it.titulo) + ': ' + (it.resultado === 'contexto' ? 'contexto, não conta ponto' : 'comparação sem placar'); d.criterioTexto = crit(it); }
    if (it.serie && it.serie.b) d.grafico = { tipo: 'trajetoria', titulo: 'Mês a mês desde a posse', b: it.serie.b, l: it.serie.l, formato: fmt,
      formatoEixo: it.serie.formato_eixo || fmt, rotuloX: 'meses desde a posse' };
    else if (it.grupos && it.grupos.length) d.grafico = { tipo: 'barras', titulo: 'Ano a ano de mandato', grupos: it.grupos, formato: fmt, formatoEixo: fmt };
    else if (g.tipo === 'promessas') d.grafico = { tipo: 'empilhadas', categorias: g.categorias.map(function (c) { return { id: c.id, nome: c.nome, st: ST[c.id] || 'na' }; }),
      linhas: { b: { contagens: g.contagens.b, direita: it.lados.b.valor }, l: { contagens: g.contagens.l, direita: it.lados.l.valor } } };
    else if (g.valores) d.grafico = { tipo: 'duelo', valores: g.valores, formato: fmt, periodos: { b: it.periodo_curto.b, l: it.periodo_curto.l } };
    else return null;
    return d;
  }
  function jpg(svg) {
    return BPD.paraPNG(svg, 1, BPD.urlFonte).then(function (bl) { return createImageBitmap(bl); }).then(function (im) {
      var cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
      var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(im, 0, 0);
      var q = 0.9, url = cv.toDataURL('image/jpeg', q);
      while (url.length * 0.75 > ${LIMITE_KB} * 1024 && q > 0.55) { q -= 0.07; url = cv.toDataURL('image/jpeg', q); }
      return { b64: url.split(',')[1], w: im.width, h: im.height, q: Math.round(q * 100) };
    });
  }
  function caixa() { var d = document.createElement('div'); d.style.cssText = 'position:absolute;left:-99999px;top:0;width:1200px'; document.body.appendChild(d); return d; }
  function cartao(def) { var c = caixa(), svg = BPD.card(c, def, 'og'); return jpg(svg).then(function (r) { c.remove(); return r; }); }
  function selecao(o) { var c = caixa(), svg = BPD.cardSelecao(c, o); return jpg(svg).then(function (r) { c.remove(); return r; }); }
  function itemSel(it) {
    var vit = it.resultado === 'vitoria';
    return { tema: it.tema_curto || it.titulo, criterio: vit ? it.criterio : null, criterioTexto: crit(it), valores: it.grafico.valores,
      formato: it.grafico.formato || {}, vencedor: vit ? it.vencedor : null, apertada: it.forca === 'apertada',
      lados: { b: { curto: it.lados.b.curto }, l: { curto: it.lados.l.curto } } };
  }
  return { defReg: defReg, cartao: cartao, selecao: selecao, itemSel: itemSel, dataBR: dataBR };
})();`;

async function abrir(ctx, base, url) {
  const p = await ctx.newPage();
  const erros = [];
  p.on('pageerror', e => erros.push(e.message));
  await p.goto(base + url, { waitUntil: 'networkidle' });
  await p.evaluate(() => window.BPD && BPD.carregarFonte && BPD.carregarFonte());
  await p.waitForTimeout(800);
  await p.addScriptTag({ content: NA_PAGINA });
  p.__erros = erros;
  return p;
}
function grava(dir, nome, r) {
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, nome);
  fs.writeFileSync(f, Buffer.from(r.b64, 'base64'));
  return { arquivo: path.relative(ROOT, f), kb: Math.round(fs.statSync(f).size / 1024), w: r.w, h: r.h, q: r.q };
}

(async () => {
  if (!fs.existsSync(path.join(DIST, 'dados', 'comparacoes.json'))) throw new Error('rode antes: python3 scripts/build.py');
  const reg = JSON.parse(fs.readFileSync(path.join(DIST, 'dados', 'comparacoes.json'), 'utf8'));
  const ativos = reg.comparacoes.filter(c => c.status === 'ativo' && c.catalogo);
  const srv = await servidor();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 });
  const rel = { itens: {}, paginas: {}, sem_imagem: [] };
  const feitos = new Set();

  // 1. cartões das páginas de análise (os mesmos do site)
  const home = await abrir(ctx, base, '/');
  for (const it of ativos.filter(c => c.pagina === '/' && c.ancora_card)) {
    const r = await home.evaluate(([alvo, id]) => {
      var d = window.__shareDefs && window.__shareDefs[alvo]; if (!d) return null;
      var c = {}, k; for (k in d) c[k] = d[k];
      c.url = __ogSite + '/c/' + id + '/'; delete c.share;
      return __og.cartao(c);
    }, [it.ancora_card, it.id]);
    if (r) { rel.itens[it.id] = grava(OUT_C, it.id + '.jpg', r); feitos.add(it.id); }
  }
  rel.paginas.inicio = grava(OUT_P, 'inicio.jpg', await home.evaluate(() => {
    var d = (window.CARDS_HOME || []).filter(x => x.id === 'resumo')[0], c = {}, k;
    for (k in d) c[k] = d[k];
    c.grafico = Object.assign({}, d.grafico, { manterOrdem: true }); c.url = __ogSite;
    return __og.cartao(c);
  }));
  for (const [pagina, lista, nomeOg, idOg] of [['/propostas/', 'CARDS_PROPOSTAS', 'propostas.jpg', 'p-geral'], ['/balanco/', 'CARDS_BALANCO', 'balanco.jpg', 'b-placar']]) {
    const p = await abrir(ctx, base, pagina);
    for (const it of ativos.filter(c => c.pagina === pagina && MAPA_CARDS[c.ref])) {
      const r = await p.evaluate(([lista, cid, id]) => {
        var d = (window[lista] || []).filter(x => x.id === cid)[0]; if (!d) return null;
        var c = {}, k; for (k in d) c[k] = d[k]; c.url = __ogSite + '/c/' + id + '/';
        return __og.cartao(c);
      }, [lista, MAPA_CARDS[it.ref], it.id]);
      if (r) { rel.itens[it.id] = grava(OUT_C, it.id + '.jpg', r); feitos.add(it.id); }
    }
    rel.paginas[nomeOg.replace('.jpg', '')] = grava(OUT_P, nomeOg, await p.evaluate(([lista, cid, pg]) => {
      var d = (window[lista] || []).filter(x => x.id === cid)[0], c = {}, k; for (k in d) c[k] = d[k]; c.url = __ogSite + pg;
      return __og.cartao(c);
    }, [lista, idOg, pagina]));
    if (p.__erros.length) console.warn('erros em', pagina, p.__erros);
    await p.close();
  }
  if (home.__erros.length) console.warn('erros em /', home.__erros);

  // 2. demais itens: cartão a partir do registro
  const cat = await abrir(ctx, base, '/comparacoes/');
  for (const it of ativos.filter(c => !feitos.has(c.id))) {
    const r = await cat.evaluate(([it, reg, id]) => {
      var d = __og.defReg(it, reg); if (!d) return null; d.url = __ogSite + '/c/' + id + '/';
      return __og.cartao(d);
    }, [it, { gerado_em: reg.gerado_em }, it.id]);
    if (r) rel.itens[it.id] = grava(OUT_C, it.id + '.jpg', r); else rel.sem_imagem.push(it.id);
  }
  // 3. mosaicos (comparações, seleção) e fontes
  const porId = Object.fromEntries(ativos.map(c => [c.id, c]));
  const mosaico = async (ids, titulo, sub, rodape, url) => cat.evaluate(([its, titulo, sub, rodape, url, data]) => __og.selecao({
    formato: 'og', titulo: titulo, sub: sub, itens: its.map(__og.itemSel), rodape: rodape, url: url, atualizado: data }),
    [ids.map(i => porId[i]), titulo, sub, rodape, url, reg.gerado_em.split('-').reverse().join('/')]);
  rel.paginas.comparacoes = grava(OUT_P, 'comparacoes.jpg', await mosaico(MOSAICO, 'Todas as comparações, com os números dos dois lados',
    null, [ativos.length + ' comparações com fonte oficial · cada lado fica à frente em algumas · lista na ordem das páginas'], SITE + '/comparacoes/'));
  rel.paginas.selecao = grava(OUT_P, 'selecao.jpg', await mosaico(PLACAR, 'Comparações com dados oficiais',
    null, ['Os 7 quesitos do placar dos governos · seleção feita por quem enviou o link'], SITE + '/c/'));
  const n = fs.readFileSync(path.join(DIST, 'dados', 'SHA256SUMS.txt'), 'utf8').trim().split('\n').length;
  const fontes = await ctx.newPage();
  const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'public/assets/img/logo-400.png')).toString('base64');
  const fonte = 'data:font/woff2;base64,' + fs.readFileSync(path.join(ROOT, 'public/assets/fonts/inter-latin-var.woff2')).toString('base64');
  await fontes.setViewportSize({ width: 1200, height: 630 });
  await fontes.setContent(`<!doctype html><meta charset="utf-8"><style>@font-face{font-family:I;src:url('${fonte}') format('woff2');font-weight:100 900}
    body{margin:0;width:1200px;height:630px;background:#ffffff;font-family:I,sans-serif;color:#18181b;position:relative}
    .k{position:absolute;left:56px;top:48px;font:800 18px I;letter-spacing:.14em;color:#63636b} img{position:absolute;right:48px;top:30px;height:80px;mix-blend-mode:multiply}
    .n{position:absolute;left:52px;top:118px;font:800 190px/1 I;letter-spacing:-.04em} .t{position:absolute;left:470px;top:150px;font:800 44px/1.12 I;width:690px}
    .s{position:absolute;left:470px;top:262px;font:400 26px/1.35 I;color:#3f3f46;width:680px}
    .o{position:absolute;left:56px;bottom:118px;display:flex;gap:10px;flex-wrap:wrap;width:1090px}
    .o span{font:700 22px I;padding:10px 18px;border:2px solid #e4e4e7;border-radius:999px;background:#fff;color:#3f3f46}
    .u{position:absolute;left:56px;bottom:46px;font:700 20px I;color:#3f3f46}</style>
    <div class="k">FONTES E DADOS</div><img src="${logo}"><div class="n">${n}</div>
    <div class="t">arquivos oficiais, com SHA‑256 para conferir</div><div class="s">Baixe o original de cada número e refaça a conta. Mais o registro de todas as comparações.</div>
    <div class="o"><span>TSE</span><span>Banco Central</span><span>IBGE</span><span>Tesouro Nacional</span><span>INPE</span><span>Planalto · Congresso · STF</span><span>Federal Reserve</span></div>
    <div class="u">${SITE}/fontes/</div>`);
  await fontes.evaluate(() => document.fonts.ready);
  const fjpg = await fontes.screenshot({ type: 'jpeg', quality: 86 });
  fs.mkdirSync(OUT_P, { recursive: true }); fs.writeFileSync(path.join(OUT_P, 'fontes.jpg'), fjpg);
  rel.paginas.fontes = { arquivo: 'public/og/paginas/fontes.jpg', kb: Math.round(fjpg.length / 1024), w: 1200, h: 630 };
  if (cat.__erros.length) console.warn('erros em /comparacoes/', cat.__erros);
  await b.close(); srv.close();
  const grandes = Object.entries(rel.itens).concat(Object.entries(rel.paginas)).filter(([, v]) => v.kb > LIMITE_KB);
  console.log(`ok: ${Object.keys(rel.itens).length} imagens de comparação, ${Object.keys(rel.paginas).length} de página; sem imagem: ${rel.sem_imagem.join(', ') || 'nenhuma'}`);
  console.log('peso: maior ' + Math.max(...Object.values(rel.itens).concat(Object.values(rel.paginas)).map(v => v.kb)) + ' KB' + (grandes.length ? ' · ACIMA DE ' + LIMITE_KB + ' KB: ' + grandes.map(g => g[0]).join(', ') : ''));
  fs.writeFileSync(path.join(ROOT, 'public', 'og', 'relatorio.json'), JSON.stringify(rel, null, 1) + '\n');
})().catch(e => { console.error(e); process.exit(1); });

/*!
 * charts.js · "Bora pros dados Brasil" · linguagem visual "quem ganha"
 * Biblioteca mínima, sem dependências (ES5), que desenha SVG nítido e acessível.
 *
 *   BPD.placar(el, opts)        quantas comparações cada lado vence (1 bloco = 1 vitória, mesmo tamanho)
 *   BPD.duelo(el, opts)         um indicador, dois valores, vencedor marcado no próprio gráfico
 *   BPD.trajetoria(el, opts)    série temporal com faixas de governo e anotações diretas
 *   BPD.distribuicao(el, opts)  ganho real por faixa de renda (P10…P99)
 *   BPD.promessas(el, opts)     barra 100% empilhada por categoria (cumprida/parcial/…)
 *   BPD.resumo(el, opts)        "Resumo em 1 minuto": placar + duelos compactos numa só imagem
 *   BPD.card / cardSintese      cards para compartilhar (feed, story, og) e fechamento de carrossel
 *   BPD.cardSelecao(el, opts)   imagem única de uma seleção /c/1-3-5 (título neutro, contexto no rodapé)
 *   BPD.paraPNG(svg, escala)    Promise<Blob> PNG da imagem (para compartilhar)
 *
 * Cada função devolve o <svg>. O SVG traz <title>/<desc> (leitor de tela) e, se
 * opts.tabela !== false, um <details> "Ver os números em tabela" logo abaixo.
 * Re-desenha sozinho ao mudar a largura do contêiner ou o tema (html[data-theme]).
 * Todo texto entra via textContent (nunca innerHTML).
 */
(function (root) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var FONTE = "InterVar, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  /* endereço impresso na imagem: o do build (SITE_CONFIG.siteUrl), senão o de produção */
  var SITE = (function () {
    var u = root.SITE_CONFIG && root.SITE_CONFIG.siteUrl;
    return (typeof u === 'string' && /^https?:\/\//.test(u)) ? u.replace(/^https?:\/\//, '').replace(/\/$/, '') : 'boraprosdadosbrasil.netlify.app';
  })();

  /* ---------- tokens (validados com validate_palette.js; ver 40-dataviz-spec.md) ---------- */
  var TEMAS = {
    light: {
      surface: '#ffffff', ink: '#18181b', ink2: '#52525b', muted: '#71717a',
      grid: '#ececef', axis: '#d4d4d8', ring: '#ffffff',
      b: '#1479B0', l: '#7250FB',            // azul Bolsonaro/Flávio · roxo Lula  (mesma luminosidade OKLCH ~0.56)
      bClaro: '#73acd4', lClaro: '#9c92ff',  // degrau "parcial" (ordinal, >= 2:1 sobre o fundo)
      bLavado: 'rgba(20,121,176,.09)', lLavado: 'rgba(114,80,251,.09)', // faixas de governo
      neutro: '#52525b', vazio: '#d4d4d8', ctx: '#8a8a93', sobreCor: '#ffffff'
    },
    dark: {
      surface: '#18181b', ink: '#fafafa', ink2: '#d4d4d8', muted: '#a1a1aa',
      grid: '#2a2a2e', axis: '#3f3f46', ring: '#18181b',
      b: '#1479B0', l: '#7250FB',
      bClaro: '#85bfe8', lClaro: '#aea5ff',
      bLavado: 'rgba(56,150,210,.16)', lLavado: 'rgba(140,110,255,.16)',
      neutro: '#71717a', vazio: '#3f3f46', ctx: '#a1a1aa', sobreCor: '#ffffff'
    }
  };

  var LADOS_PADRAO = {
    b: { nome: 'Governo Bolsonaro', curto: 'Bolsonaro', periodo: '2019–2022' },
    l: { nome: 'Governo Lula', curto: 'Lula', periodo: '2023–2025' }
  };
  var ORDEM = ['b', 'l']; // ordem fixa (cronológica), nunca pela vitória

  /* ---------- utilidades ---------- */
  function temaAtual() {
    var h = document.documentElement, t = h.getAttribute('data-theme');
    if (t === 'dark' || t === 'light') return TEMAS[t];
    return (root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches) ? TEMAS.dark : TEMAS.light;
  }
  function lados(opts) {
    var o = {}, k;
    for (k in LADOS_PADRAO) o[k] = LADOS_PADRAO[k];
    if (opts && opts.lados) for (k in opts.lados) {
      var src = opts.lados[k], dst = {}, p;
      for (p in LADOS_PADRAO[k]) dst[p] = LADOS_PADRAO[k][p];
      for (p in src) dst[p] = src[p];
      o[k] = dst;
    }
    return o;
  }
  function num(v, casas, sinal) {
    if (v == null || isNaN(v)) return '–';
    casas = casas == null ? 1 : casas;
    var s = Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
    if (v < 0) return '−' + s;
    if (sinal && v > 0) return '+' + s;
    return s;
  }
  function fmtFn(f) {
    if (typeof f === 'function') return f;
    f = f || {};
    return function (v) { return (f.prefixo || '') + num(v, f.casas, f.sinal) + (f.sufixo || ''); };
  }
  var _cv;
  function largura(txt, size, weight) {
    _cv = _cv || document.createElement('canvas');
    var c = _cv.getContext('2d');
    c.font = (weight || 400) + ' ' + size + 'px ' + FONTE;
    return c.measureText(String(txt)).width;
  }
  function quebra(txt, size, weight, max) {
    var palavras = String(txt).split(/\s+/), linhas = [], atual = '';
    for (var i = 0; i < palavras.length; i++) {
      var tenta = atual ? atual + ' ' + palavras[i] : palavras[i];
      if (largura(tenta, size, weight) > max && atual) { linhas.push(atual); atual = palavras[i]; }
      else atual = tenta;
    }
    if (atual) linhas.push(atual);
    return linhas;
  }
  function el(tag, attrs, pai) {
    var n = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (pai) pai.appendChild(n);
    return n;
  }
  function texto(pai, x, y, s, o) {
    o = o || {};
    var t = el('text', {
      x: x, y: y, 'font-size': o.size || 13, 'font-weight': o.weight || 400,
      fill: o.fill, 'text-anchor': o.anchor || 'start', 'font-family': FONTE,
      'dominant-baseline': o.baseline || 'alphabetic'
    }, pai);
    t.textContent = s;
    return t;
  }
  function luminancia(hex) {
    var h = hex.replace('#', ''), c = [0, 2, 4].map(function (i) {
      var v = parseInt(h.substr(i, 2), 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function textoSobre(fill) { // branco ou tinta, o que der mais contraste
    var L = luminancia(fill), cBranco = 1.05 / (L + 0.05), cTinta = (L + 0.05) / 0.0592;
    return cBranco >= cTinta ? '#ffffff' : '#18181b';
  }
  // barra com ponta arredondada (4px) só no lado do dado; reta na base
  function barra(pai, x0, x1, y, h, fill, extra) {
    var r = Math.min(4, Math.abs(x1 - x0) / 2, h / 2), d;
    if (x1 >= x0) {
      d = 'M' + x0 + ',' + y + 'H' + (x1 - r) + 'Q' + x1 + ',' + y + ' ' + x1 + ',' + (y + r) +
        'V' + (y + h - r) + 'Q' + x1 + ',' + (y + h) + ' ' + (x1 - r) + ',' + (y + h) + 'H' + x0 + 'Z';
    } else {
      d = 'M' + x0 + ',' + y + 'H' + (x1 + r) + 'Q' + x1 + ',' + y + ' ' + x1 + ',' + (y + r) +
        'V' + (y + h - r) + 'Q' + x1 + ',' + (y + h) + ' ' + (x1 + r) + ',' + (y + h) + 'H' + x0 + 'Z';
    }
    var a = { d: d, fill: fill };
    if (extra) for (var k in extra) a[k] = extra[k];
    return el('path', a, pai);
  }
  // forma do lado: círculo (b) e quadrado arredondado (l): 2º canal além da cor
  function marca(pai, lado, cx, cy, tam, T) {
    var r = tam / 2;
    if (lado === 'b') return el('circle', { cx: cx, cy: cy, r: r, fill: T.b, stroke: T.ring, 'stroke-width': 1.5 }, pai);
    if (lado === 'l') return el('rect', { x: cx - r, y: cy - r, width: tam, height: tam, rx: 2, fill: T.l, stroke: T.ring, 'stroke-width': 1.5 }, pai);
    return el('circle', { cx: cx, cy: cy, r: r, fill: T.ctx }, pai);
  }
  // selo de vencedor: mesmo desenho para os dois lados (só muda a cor)
  function selo(pai, xDir, yTopo, rotulo, lado, T) {
    var s = '✓ ' + rotulo, w = largura(s, 12, 700) + 18, h = 22;
    var g = el('g', null, pai);
    el('rect', { x: xDir - w, y: yTopo, width: w, height: h, rx: 11, fill: T[lado] }, g);
    texto(g, xDir - w / 2, yTopo + 15, s, { size: 12, weight: 700, fill: T.sobreCor, anchor: 'middle' });
    return w;
  }
  function seloNeutro(pai, xDir, yTopo, rotulo, T) {
    var w = largura(rotulo, 12, 600) + 18;
    el('rect', { x: xDir - w + 0.5, y: yTopo + 0.5, width: w - 1, height: 21, rx: 10.5, fill: 'none', stroke: T.axis }, pai);
    texto(pai, xDir - w / 2, yTopo + 15, rotulo, { size: 12, weight: 600, fill: T.ink2, anchor: 'middle' });
    return w;
  }
  function padroes(defs, T) { // listrado 45°: "em andamento" e "estimativa"
    var ids = {};
    [['bClaro', T.bClaro], ['lClaro', T.lClaro], ['vazio', T.vazio], ['bEst', T.b], ['lEst', T.l]].forEach(function (p) {
      var id = 'bpd-hatch-' + p[0] + '-' + Math.random().toString(36).slice(2, 7);
      var pat = el('pattern', { id: id, patternUnits: 'userSpaceOnUse', width: 6, height: 6, patternTransform: 'rotate(45)' }, defs);
      el('rect', { width: 6, height: 6, fill: T.surface }, pat);
      el('rect', { width: 3, height: 6, fill: p[1] }, pat);
      ids[p[0]] = 'url(#' + id + ')';
    });
    return ids;
  }

  /* ---------- moldura comum: título, critério, corpo, nota, fonte, endereço ---------- */
  var _uid = 0;
  function moldura(cont, opts, corpo) {
    var T = temaAtual();
    var W = Math.max(300, Math.round(opts.largura || cont.clientWidth || 358));
    var P = W < 420 ? 14 : 20;                      // respiro interno
    var id = 'bpd' + (++_uid);
    var svg = el('svg', { xmlns: NS, width: W, role: 'img', 'aria-labelledby': id + 't ' + id + 'd', 'font-family': FONTE });
    svg.style.display = 'block'; svg.style.maxWidth = '100%'; svg.style.height = 'auto';
    var tt = el('title', { id: id + 't' }, svg); tt.textContent = opts.titulo || '';
    var dd = el('desc', { id: id + 'd' }, svg); dd.textContent = opts.descricao || '';
    var defs = el('defs', null, svg);
    var fundo = el('rect', { x: 0, y: 0, width: W, rx: 14, fill: T.surface }, svg);
    var g = el('g', null, svg);
    var y = P;
    if (opts.chapeu) { texto(g, P, y + 12, opts.chapeu.toUpperCase(), { size: 12, weight: 700, fill: T.muted }); y += 20; }
    if (opts.titulo) {
      var tam = opts.tamTitulo || (W < 420 ? 17 : 19);
      quebra(opts.titulo, tam, 700, W - 2 * P).forEach(function (ln) { y += tam + 4; texto(g, P, y - 4, ln, { size: tam, weight: 700, fill: T.ink }); });
      y += 6;
    }
    var ctx = { svg: svg, g: g, defs: defs, T: T, W: W, P: P, x0: P, x1: W - P, y: y, L: lados(opts) };
    y = corpo(ctx) || ctx.y;
    // nota (apoio) e fonte (credibilidade) dentro da imagem: sobrevivem ao print/recorte
    if (opts.nota) {
      y += 6;
      quebra(opts.nota, 12.5, 400, W - 2 * P).forEach(function (ln) { y += 17; texto(g, P, y - 4, ln, { size: 12.5, fill: T.ink2 }); });
    }
    y += 10;
    el('line', { x1: P, x2: W - P, y1: y, y2: y, stroke: T.grid, 'stroke-width': 1 }, g);
    y += 4;
    var linhaFonte = 'Fonte: ' + (opts.fonte || '—');
    quebra(linhaFonte, 12, 400, W - 2 * P).forEach(function (ln) { y += 16; texto(g, P, y - 3, ln, { size: 12, fill: T.muted }); });
    quebra(SITE + (opts.metodo ? ' · ' + opts.metodo : '') + (opts.atualizado ? ' · atualizado em ' + opts.atualizado : ''), 12, 600, W - 2 * P).forEach(function (ln) { y += 16; texto(g, P, y - 3, ln, { size: 12, weight: 600, fill: T.muted }); });
    y += P - 2;
    svg.setAttribute('height', y);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + y);
    fundo.setAttribute('height', y);
    return svg;
  }

  function tabelaGemea(cont, cab, linhas, legenda) {
    var det = document.createElement('details'); det.className = 'bpd-tabela';
    var sum = document.createElement('summary'); sum.textContent = 'Ver os números em tabela'; det.appendChild(sum);
    var tb = document.createElement('table');
    if (legenda) { var cap = document.createElement('caption'); cap.textContent = legenda; tb.appendChild(cap); }
    var th = document.createElement('thead'), tr = document.createElement('tr');
    cab.forEach(function (c) { var x = document.createElement('th'); x.scope = 'col'; x.textContent = c; tr.appendChild(x); });
    th.appendChild(tr); tb.appendChild(th);
    var tbody = document.createElement('tbody');
    linhas.forEach(function (l) {
      var r = document.createElement('tr');
      l.forEach(function (c, i) { var x = document.createElement(i === 0 ? 'th' : 'td'); if (i === 0) x.scope = 'row'; x.textContent = c; r.appendChild(x); });
      tbody.appendChild(r);
    });
    tb.appendChild(tbody); det.appendChild(tb); cont.appendChild(det);
  }

  /* ---------- registro: redesenha em resize e troca de tema ---------- */
  var REG = [];
  function montar(cont, opts, desenhar, tabela) {
    if (typeof cont === 'string') cont = document.querySelector(cont);
    var item = null;
    for (var i = 0; i < REG.length; i++) if (REG[i].cont === cont) item = REG[i];
    if (!item) { item = { cont: cont }; REG.push(item); }
    item.opts = opts; item.desenhar = desenhar; item.tabela = tabela; item.w = cont.clientWidth;
    while (cont.firstChild) cont.removeChild(cont.firstChild);
    var svg = desenhar(cont, opts);
    cont.appendChild(svg);
    if (tabela && opts.tabela !== false) { var t = tabela(opts); tabelaGemea(cont, t.cab, t.linhas, opts.titulo); }
    return svg;
  }
  function redesenhar(forcar) {
    REG.forEach(function (it) {
      if (!it.cont.isConnected) return;
      if (forcar || Math.abs(it.cont.clientWidth - it.w) > 4) montar(it.cont, it.opts, it.desenhar, it.tabela);
    });
  }
  if (typeof root.addEventListener === 'function') {
    var _t; root.addEventListener('resize', function () { clearTimeout(_t); _t = setTimeout(function () { redesenhar(false); }, 150); });
    if (root.MutationObserver) new MutationObserver(function () { redesenhar(true); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (root.matchMedia) { var mq = root.matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', function () { redesenhar(true); }); }
  }

  /* ---------- vencedor pelo critério declarado ---------- */
  function vencedor(d) {
    if (d.vencedor !== undefined && d.criterio == null) return d.vencedor; // só quando não há critério numérico
    var vb = d.valores.b, vl = d.valores.l;
    if (!d.criterio || vb === vl) return null;
    var v = d.criterio === 'menor' ? (vb < vl ? 'b' : 'l') : (vb > vl ? 'b' : 'l');
    if (d.vencedor !== undefined && d.vencedor !== v && root.console) console.warn('[BPD] vencedor informado difere do critério:', d.titulo || d.tema);
    return v;
  }
  function textoCriterio(d) {
    if (d.criterioTexto) return d.criterioTexto;
    if (d.criterio === 'menor') return '↓ menor é melhor';
    if (d.criterio === 'maior') return '↑ maior é melhor';
    return 'contexto · não conta ponto';
  }

  /* =====================================================================
   * DUELO: um indicador, dois valores, vencedor marcado no gráfico
   * opts: titulo, criterio ('menor'|'maior'|null), valores{b,l}, formato,
   *       vencedorRotulo ('menor inflação'), sub{b,l}, lados, nota, fonte
   * ===================================================================== */
  function desenharDuelo(cont, o) {
    var f = fmtFn(o.formato);
    var v = vencedor(o);
    o.descricao = o.descricao || (o.titulo + '. ' + ORDEM.map(function (k) { return lados(o)[k].nome + ': ' + f(o.valores[k]); }).join('; ') +
      '. ' + (v ? 'Melhor neste critério (' + textoCriterio(o).replace(/[↓↑] /, '') + '): ' + lados(o)[v].nome + '.' : 'Sem vencedor: contexto.'));
    return moldura(cont, o, function (c) {
      var T = c.T, g = c.g, y = c.y;
      // critério embutido
      var crit = textoCriterio(o);
      var wc = largura(crit, 12, 600) + 18;
      el('rect', { x: c.x0 + 0.5, y: y + 0.5, width: wc - 1, height: 21, rx: 10.5, fill: 'none', stroke: T.axis }, g);
      texto(g, c.x0 + wc / 2, y + 15, crit, { size: 12, weight: 600, fill: T.ink2, anchor: 'middle' });
      if (o.periodo) texto(g, c.x1, y + 15, o.periodo, { size: 12, fill: T.muted, anchor: 'end' });
      y += 36;
      // escala comum, começando em zero
      var vals = ORDEM.map(function (k) { return o.valores[k]; });
      var lo = Math.min(0, Math.min.apply(null, vals)), hi = Math.max(0, Math.max.apply(null, vals));
      var labW = Math.max.apply(null, vals.map(function (x) { return largura(f(x), 20, 700); })) + 10;
      var plotL = c.x0 + (lo < 0 ? labW : 0), plotR = c.x1 - (hi > 0 ? labW : 0);
      var X = function (x) { return plotL + (x - lo) / (hi - lo || 1) * (plotR - plotL); };
      // mesma forma de nome para os dois lados (se um precisa encurtar, os dois encurtam)
      var wSeloMax = v ? largura('✓ ' + (o.vencedorRotulo || 'melhor'), 12, 700) + 18 : 0;
      var cabe = function (fn) { return ORDEM.every(function (k) { return largura(fn(c.L[k]), 13, 600) + 20 + wSeloMax + 8 <= c.x1 - c.x0; }); };
      var formas = [function (L) { return L.nome + (L.periodo ? ' · ' + L.periodo : ''); }, function (L) { return L.curto + (L.periodo ? ' · ' + L.periodo : ''); }, function (L) { return L.curto; }];
      var formaNome = formas.filter(cabe)[0] || formas[2];
      ORDEM.forEach(function (k) {
        var L = c.L[k], val = o.valores[k];
        // linha do rótulo: forma + nome · período  ...  selo do vencedor
        marca(g, k, c.x0 + 6, y + 8, 11, T);
        var nome = formaNome(L);
        texto(g, c.x0 + 18, y + 13, nome, { size: 13, weight: 600, fill: T.ink });
        if (v === k) selo(g, c.x1, y - 3, o.vencedorRotulo || 'melhor', k, T);
        y += 26;
        var xa = X(0), xb = X(val);
        if (Math.abs(xb - xa) < 2) xb = xa + (val < 0 ? -2 : 2);
        var bar = barra(g, xa, xb, y, 24, T[k]);
        var tb = el('title', null, bar); tb.textContent = L.nome + ': ' + f(val);
        texto(g, val < 0 ? xb - 6 : xb + 6, y + 19, f(val), { size: 20, weight: 700, fill: T.ink, anchor: val < 0 ? 'end' : 'start' });
        if (lo < 0) el('line', { x1: X(0), x2: X(0), y1: y - 4, y2: y + 28, stroke: T.ink2, 'stroke-width': 1 }, g);
        y += 24;
        if (o.sub && o.sub[k]) quebra(o.sub[k], 12, 400, c.x1 - c.x0).forEach(function (ln) { texto(g, c.x0, y + 16, ln, { size: 12, fill: T.ink2 }); y += 16; });
        y += 16;
      });
      if (o.legendaZero && lo < 0) { texto(g, X(0), y + 2, o.legendaZero, { size: 12, fill: T.muted, anchor: 'middle' }); y += 10; }
      return y;
    });
  }
  function duelo(cont, o) {
    return montar(cont, o, desenharDuelo, function (o) {
      var f = fmtFn(o.formato), v = vencedor(o), L = lados(o);
      return { cab: ['Lado', 'Valor', 'Melhor neste critério?'],
        linhas: ORDEM.map(function (k) { return [L[k].nome + (L[k].periodo ? ' (' + L[k].periodo + ')' : ''), f(o.valores[k]) + (o.sub && o.sub[k] ? ' · ' + o.sub[k] : ''), v === k ? 'sim (' + textoCriterio(o) + ')' : (v ? 'não' : 'sem placar')]; }) };
    });
  }

  /* =====================================================================
   * PLACAR: 1 bloco por vitória, blocos idênticos para os dois lados
   * opts: titulo, quesitos:[{nome, vencedor:'b'|'l'|null, nota}], lados, fonte
   * ===================================================================== */
  function blocoPlacar(c, y, o) {
    var T = c.T, g = c.g, gap = 10, colW = (c.x1 - c.x0 - gap) / 2;
    var cont = { b: [], l: [] }, ctx = [];
    o.quesitos.forEach(function (q) { if (q.vencedor === 'b' || q.vencedor === 'l') cont[q.vencedor].push(q); else ctx.push(q); });
    var maxN = Math.max(cont.b.length, cont.l.length);
    // todos os blocos com a MESMA altura (1 ou 2 linhas), para cada vitória pesar igual
    var linhasDe = function (q) { return quebra('✓ ' + q.nome, 13, 600, colW - 20); };
    var maxL = 1; o.quesitos.forEach(function (q) { if (q.vencedor) maxL = Math.max(maxL, Math.min(2, linhasDe(q).length)); });
    var tileH = maxL === 1 ? 34 : 52;
    var yTiles = y;
    ORDEM.forEach(function (k, i) {
      var x = c.x0 + i * (colW + gap), L = c.L[k], yy = y;
      marca(g, k, x + 6, yy + 9, 11, T);
      var nm = largura(L.nome, 14, 700) + 18 > colW ? L.curto : L.nome;
      texto(g, x + 18, yy + 14, nm, { size: 14, weight: 700, fill: T.ink });
      yy += 20;
      if (L.periodo) texto(g, x + 18, yy + 12, L.periodo, { size: 12, fill: T.muted });
      yy += 18;
      var n = String(cont[k].length);
      texto(g, x, yy + 44, n, { size: 48, weight: 800, fill: T.ink });
      var wn = largura(n, 48, 800);
      texto(g, x + wn + 6, yy + 42, cont[k].length === 1 ? 'vitória' : 'vitórias', { size: 13, weight: 600, fill: T.ink2 });
      yy += 56;
      cont[k].forEach(function (q) {
        el('rect', { x: x, y: yy, width: colW, height: tileH, rx: 8, fill: T[k] }, g);
        var ls = linhasDe(q);
        if (ls.length > 2) { ls = ls.slice(0, 2); ls[1] = ls[1].replace(/\s*\S*$/, '') + '…'; }
        var y0 = yy + tileH / 2 - (ls.length - 1) * 8 + 4.5;
        ls.forEach(function (ln, j) { texto(g, x + 10, y0 + j * 16, ln, { size: 13, weight: 600, fill: T.sobreCor }); });
        yy += tileH + 4;
      });
      yTiles = Math.max(yTiles, yy);
    });
    y = Math.max(yTiles, y + 94 + maxN * (tileH + 4));
    ctx.forEach(function (q) {
      y += 4;
      el('rect', { x: c.x0 + 0.5, y: y + 0.5, width: c.x1 - c.x0 - 1, height: 33, rx: 8, fill: 'none', stroke: T.axis, 'stroke-dasharray': '4 3' }, g);
      texto(g, c.x0 + 10, y + 22, q.nome + ': ' + (q.nota || 'contexto, não conta ponto'), { size: 12.5, fill: T.ink2 });
      y += 38;
    });
    return y;
  }
  function desenharPlacar(cont, o) {
    var L = lados(o), n = { b: 0, l: 0 };
    o.quesitos.forEach(function (q) { if (n[q.vencedor] != null) n[q.vencedor]++; });
    o.descricao = o.descricao || ('Placar: ' + L.b.nome + ' ' + n.b + ', ' + L.l.nome + ' ' + n.l + '. ' +
      o.quesitos.map(function (q) { return q.nome + ': ' + (q.vencedor ? L[q.vencedor].nome : 'contexto'); }).join('; ') + '.');
    return moldura(cont, o, function (c) {
      var y = c.y;
      if (o.regra) { quebra(o.regra, 12.5, 400, c.x1 - c.x0).forEach(function (ln) { texto(c.g, c.x0, y + 12, ln, { size: 12.5, fill: c.T.ink2 }); y += 17; }); y += 6; }
      return blocoPlacar(c, y, o);
    });
  }
  function placar(cont, o) {
    return montar(cont, o, desenharPlacar, function (o) {
      var L = lados(o);
      return { cab: ['Quesito', 'Melhor'], linhas: o.quesitos.map(function (q) { return [q.nome, q.vencedor ? L[q.vencedor].nome : 'contexto (não conta ponto)']; }) };
    });
  }

  /* =====================================================================
   * RESUMO EM 1 MINUTO: placar + 1 linha por tema (duelo compacto)
   * opts: titulo, quesitos (placar), duelos:[{tema, criterio, valores, formato, nota}]
   * ===================================================================== */
  function linhaDuelo(c, y, d) {
    var T = c.T, g = c.g, f = fmtFn(d.formato), v = vencedor(d);
    var nomeW = 72;
    texto(g, c.x0, y + 15, d.tema, { size: 14, weight: 700, fill: T.ink });
    var wt = largura(d.tema, 14, 700);
    var crit = textoCriterio(d);
    var wSelo = v ? largura('✓ ' + c.L[v].curto, 12, 700) + 18 : largura('sem placar', 12, 600) + 18;
    if (wt + 8 + largura(crit, 12, 400) < c.x1 - c.x0 - wSelo - 6) texto(g, c.x0 + wt + 8, y + 15, crit, { size: 12, fill: T.muted });
    else { y += 16; texto(g, c.x0, y + 15, crit, { size: 12, fill: T.muted }); y -= 16; }
    if (v) selo(g, c.x1, y, c.L[v].curto, v, T); else seloNeutro(g, c.x1, y, 'sem placar', T);
    y += (wt + 8 + largura(crit, 12, 400) < c.x1 - c.x0 - wSelo - 6) ? 28 : 44;
    var vals = ORDEM.map(function (k) { return d.valores[k]; });
    var lo = Math.min(0, Math.min.apply(null, vals)), hi = Math.max(0, Math.max.apply(null, vals));
    var labW = Math.max.apply(null, vals.map(function (x) { return largura(f(x), 13, 700); })) + 8;
    var plotL = c.x0 + nomeW + (lo < 0 ? labW : 0), plotR = c.x1 - (hi > 0 ? labW : 0);
    var X = function (x) { return plotL + (x - lo) / (hi - lo || 1) * (plotR - plotL); };
    var y0 = y;
    ORDEM.forEach(function (k) {
      var val = d.valores[k];
      texto(g, c.x0, y + 11, c.L[k].curto, { size: 12, weight: v === k ? 700 : 400, fill: v === k ? T.ink : T.ink2 });
      var xa = X(0), xb = X(val); if (Math.abs(xb - xa) < 2) xb = xa + (val < 0 ? -2 : 2);
      barra(g, xa, xb, y, 14, T[k]);
      texto(g, val < 0 ? xb - 5 : xb + 5, y + 12, f(val), { size: 13, weight: 700, fill: T.ink, anchor: val < 0 ? 'end' : 'start' });
      y += 20;
    });
    if (lo < 0) el('line', { x1: X(0), x2: X(0), y1: y0 - 3, y2: y - 3, stroke: T.ink2, 'stroke-width': 1 }, g);
    if (d.nota) { texto(g, c.x0 + nomeW, y + 11, d.nota, { size: 12, fill: T.muted }); y += 16; }
    y += 10;
    el('line', { x1: c.x0, x2: c.x1, y1: y, y2: y, stroke: T.grid }, g);
    return y + 10;
  }
  function desenharResumo(cont, o) {
    var L = lados(o);
    o.descricao = o.descricao || (o.titulo + '. ' + o.duelos.map(function (d) {
      var f = fmtFn(d.formato), v = vencedor(d);
      return d.tema + ': ' + L.b.curto + ' ' + f(d.valores.b) + ', ' + L.l.curto + ' ' + f(d.valores.l) + (v ? ' (melhor: ' + L[v].curto + ')' : ' (contexto)');
    }).join('; ') + '.');
    return moldura(cont, o, function (c) {
      var y = c.y;
      if (o.quesitos) { y = blocoPlacar(c, y, o); y += 8; }
      if (o.subtitulo) {
        quebra(o.subtitulo, 13, 600, c.x1 - c.x0).forEach(function (ln) { y += 18; texto(c.g, c.x0, y - 4, ln, { size: 13, weight: 600, fill: c.T.ink2 }); });
        y += 8;
      }
      el('line', { x1: c.x0, x2: c.x1, y1: y, y2: y, stroke: c.T.grid }, c.g); y += 10;
      o.duelos.forEach(function (d) { y = linhaDuelo(c, y, d); });
      return y;
    });
  }
  function resumo(cont, o) {
    return montar(cont, o, desenharResumo, function (o) {
      var L = lados(o);
      return { cab: ['Tema', L.b.nome, L.l.nome, 'Critério', 'Melhor'],
        linhas: o.duelos.map(function (d) { var f = fmtFn(d.formato), v = vencedor(d); return [d.tema, f(d.valores.b), f(d.valores.l), textoCriterio(d), v ? L[v].nome : 'contexto']; }) };
    });
  }

  /* =====================================================================
   * TRAJETÓRIA: série no tempo, faixas de governo, anotações diretas
   * opts: titulo, x:[rótulos], series:[{lado:'b'|'l'|'ctx', nome, valores, tracejado}],
   *       faixas:[{lado, de, ate}] (índices), anotacoes:[{i, texto}], rotular:[{s, i}],
   *       y:{min, max, passo, formato}, formato (valores), fonte, nota
   * ===================================================================== */
  function desenharTrajetoria(cont, o) {
    var f = fmtFn(o.formato), fy = fmtFn(o.y && o.y.formato || o.formato);
    o.descricao = o.descricao || (o.titulo + '. ' + o.series.map(function (s) {
      var pts = []; s.valores.forEach(function (v, i) { if (v != null) pts.push(o.x[i] + ' ' + f(v)); });
      return s.nome + ': ' + (pts.length > 14 ? pts[0] + ' … ' + pts[pts.length - 1] : pts.join(', '));
    }).join('. ') + '.');
    return moldura(cont, o, function (c) {
      var T = c.T, g = c.g, y = c.y, n = o.x.length;
      var ymin = o.y.min, ymax = o.y.max, passo = o.y.passo;
      if (ymin !== 0) {
        var aviso = 'Atenção: o eixo vertical começa em ' + fy(ymin) + ', não em zero';
        texto(g, c.x0, y + 12, aviso, { size: 12, weight: 600, fill: T.ink2 }); y += 22;
      }
      // legenda (sempre, para >= 2 séries) com forma + nome
      var lx = c.x0;
      if (o.legenda !== false) o.series.forEach(function (s) {
        if (s.legenda === false) return;
        var nm = s.legenda || s.nome, w = largura(nm, 12, 600) + 26;
        if (lx + w > c.x1) { lx = c.x0; y += 18; }
        if (s.lado === 'ctx' || s.lado === 'ink') el('line', { x1: lx, x2: lx + 14, y1: y + 8, y2: y + 8, stroke: s.lado === 'ink' ? T.ink : T.ctx, 'stroke-width': 2, 'stroke-dasharray': s.tracejado ? '4 3' : null }, g);
        else marca(g, s.lado, lx + 6, y + 8, 10, T);
        texto(g, lx + 18, y + 12, nm, { size: 12, weight: 600, fill: T.ink2 });
        lx += w + 6;
      });
      if (o.legenda !== false) y += 26;
      var ticks = []; for (var t = ymin; t <= ymax + 1e-9; t += passo) ticks.push(t);
      var axW = Math.max.apply(null, ticks.map(function (t) { return largura(fy(t), 12, 400); })) + 6;
      var top = y + 22, H = o.altura || 210, bot = top + H;
      var pl = c.x0 + axW, pr = c.x1 - (o.margemDireita || 30);
      var X = function (i) { return pl + (n === 1 ? 0.5 : i / (n - 1)) * (pr - pl); };
      var Y = function (v) { return bot - (v - ymin) / (ymax - ymin) * H; };
      // faixas de governo + rótulo dentro
      var usaCurto = (o.faixas || []).some(function (fx) { return largura(c.L[fx.lado].nome, 12, 700) + 22 > X(fx.ate) - X(fx.de); });
      (o.faixas || []).forEach(function (fx) {
        var xa = X(fx.de), xb = X(fx.ate);
        el('rect', { x: xa, y: top - 22, width: Math.max(0, xb - xa), height: H + 22, fill: T[fx.lado + 'Lavado'] }, g);
        var nm = usaCurto ? c.L[fx.lado].curto : c.L[fx.lado].nome;
        if (largura(nm, 12, 700) + 22 <= xb - xa + 2) {
          marca(g, fx.lado, xa + 9, top - 11, 9, T);
          texto(g, xa + 18, top - 7, nm, { size: 12, weight: 700, fill: T.ink2 });
        }
      });
      ticks.forEach(function (t) {
        el('line', { x1: pl, x2: pr, y1: Y(t), y2: Y(t), stroke: T.grid }, g);
        texto(g, pl - 6, Y(t) + 4, fy(t), { size: 12, fill: T.muted, anchor: 'end' });
      });
      el('line', { x1: pl, x2: pr, y1: bot, y2: bot, stroke: T.axis }, g);
      // eixo x: rótulos que cabem
      var maxLab = Math.max.apply(null, o.x.map(function (s) { return largura(o.rotuloX ? o.rotuloX(s, 0) : s, 12, 400); })) + 8;
      var cada = Math.max(1, Math.ceil(maxLab / ((pr - pl) / Math.max(1, n - 1))));
      var ultimoX = -1e9;
      o.x.forEach(function (s, i) {
        var lab = o.rotuloX ? o.rotuloX(s, i) : s; if (!lab) return;
        if (!o.rotuloX && i % cada !== 0 && i !== n - 1) return;
        if (i === n - 1 && X(i) - ultimoX < maxLab) return;
        ultimoX = X(i);
        texto(g, X(i), bot + 17, lab, { size: 12, fill: T.muted, anchor: i === 0 ? 'start' : (i === n - 1 ? 'end' : 'middle') });
      });
      // anotações diretas nos eventos
      (o.anotacoes || []).forEach(function (a, j) {
        var xa = X(a.i), ty = a.y != null ? Y(a.y) : top + 14 + (j % 2) * 16;
        el('line', { x1: xa, x2: xa, y1: a.y != null ? top : top + 4 + (j % 2) * 16, y2: bot, stroke: T.muted, 'stroke-width': 1 }, g);
        var w = largura(a.texto, 12, 600);
        var anc = xa + w + 4 > pr ? 'end' : 'start';
        el('rect', { x: anc === 'end' ? xa - w - 6 : xa + 2, y: ty - 12, width: w + 4, height: 16, fill: T.surface, opacity: 0.85 }, g);
        texto(g, anc === 'end' ? xa - 4 : xa + 4, ty, a.texto, { size: 12, weight: 600, fill: T.ink2, anchor: anc });
      });
      // linhas
      o.series.forEach(function (s) {
        var d = '', on = false, cor = s.lado === 'ctx' ? T.ctx : (s.lado === 'ink' ? T.ink : T[s.lado]);
        s.valores.forEach(function (v, i) {
          if (v == null) { on = false; return; }
          d += (on ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(v).toFixed(1); on = true;
        });
        el('path', { d: d, fill: 'none', stroke: cor, 'stroke-width': s.lado === 'ctx' ? 2 : 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-dasharray': s.tracejado ? '5 4' : null }, g);
        if (s.marcadores !== false && n <= 14) s.valores.forEach(function (v, i) { if (v != null && !(s.semMarca && s.semMarca.indexOf(i) >= 0)) marca(g, s.lado, X(i), Y(v), 9, T); });
      });
      // rótulos seletivos (ponta, extremos), com desvio simples de colisão
      var caixas = [];
      (o.rotular || []).forEach(function (r) {
        var s = o.series[r.s], v = s.valores[r.i]; if (v == null) return;
        var lab = (r.prefixo || '') + f(v), w = largura(lab, 13, 700), xa = X(r.i), ya = Y(v) - 10;
        var anc = r.i === 0 ? 'start' : (r.i === n - 1 ? 'end' : 'middle');
        var bx = anc === 'start' ? xa - 4 : anc === 'end' ? xa - w + 4 : xa - w / 2;
        if (r.abaixo) ya = Y(v) + 22;
        for (var k = 0; k < caixas.length; k++) { var b = caixas[k]; if (bx < b.x + b.w && bx + w > b.x && ya - 13 < b.y && ya > b.y - 13) ya = Y(v) + 22; }
        caixas.push({ x: bx, y: ya, w: w });
        texto(g, anc === 'start' ? xa - 4 : anc === 'end' ? xa + 4 : xa, ya, lab, { size: 13, weight: 700, fill: T.ink, anchor: anc });
      });
      // camada de toque/hover: linha-guia + leitura de todas as séries no X
      var guia = el('g', { 'pointer-events': 'none', visibility: 'hidden' }, g);
      var gl = el('line', { y1: top, y2: bot, stroke: T.ink2, 'stroke-width': 1 }, guia);
      var caixa = el('rect', { rx: 6, fill: T.surface, stroke: T.axis }, guia);
      var tx = el('text', { 'font-size': 12, 'font-family': FONTE, fill: T.ink }, guia);
      var alvo = el('rect', { x: pl, y: top, width: pr - pl, height: H, fill: 'transparent', tabindex: 0, 'aria-hidden': 'true' }, g);
      function mostrar(i) {
        guia.setAttribute('visibility', 'visible');
        gl.setAttribute('x1', X(i)); gl.setAttribute('x2', X(i));
        while (tx.firstChild) tx.removeChild(tx.firstChild);
        var linhas = [o.x[i]]; o.series.forEach(function (s) { if (s.valores[i] != null) linhas.push(s.nome + ': ' + f(s.valores[i])); });
        var w = 0; linhas.forEach(function (l, j) { var ts = el('tspan', { x: 0, dy: j ? 16 : 0, 'font-weight': j ? 400 : 700 }, tx); ts.textContent = l; w = Math.max(w, largura(l, 12, j ? 400 : 700)); });
        var bx = X(i) + 8; if (bx + w + 16 > c.x1) bx = X(i) - w - 24;
        caixa.setAttribute('x', bx); caixa.setAttribute('y', top + 4); caixa.setAttribute('width', w + 16); caixa.setAttribute('height', linhas.length * 16 + 10);
        tx.setAttribute('transform', 'translate(' + (bx + 8) + ',' + (top + 20) + ')');
        [].forEach.call(tx.childNodes, function (ts) { ts.setAttribute('x', 0); });
      }
      function idx(ev) { var r = c.svg.getBoundingClientRect(), sx = c.W / r.width; var px = (ev.clientX - r.left) * sx; return Math.max(0, Math.min(n - 1, Math.round((px - pl) / (pr - pl) * (n - 1)))); }
      alvo.addEventListener('pointermove', function (e) { mostrar(idx(e)); });
      alvo.addEventListener('pointerdown', function (e) { mostrar(idx(e)); });
      alvo.addEventListener('pointerleave', function () { guia.setAttribute('visibility', 'hidden'); });
      return bot + 30;
    });
  }
  function trajetoria(cont, o) {
    return montar(cont, o, desenharTrajetoria, function (o) {
      var f = fmtFn(o.formato);
      return { cab: ['Período'].concat(o.series.map(function (s) { return s.nome; })),
        linhas: o.x.map(function (x, i) { return [x].concat(o.series.map(function (s) { return s.valores[i] == null ? '–' : f(s.valores[i]); })); }) };
    });
  }

  /* =====================================================================
   * DISTRIBUIÇÃO: ganho real por faixa de renda
   * opts: titulo, faixas:[{rotulo:'P10', desc:'base', a, b, var, estimado}], fonte, nota
   * cor da barra = lado em que a faixa teve renda MAIOR (regra única, vale para os dois)
   * ===================================================================== */
  function desenharDistribuicao(cont, o) {
    var brl = function (v) { return 'R$ ' + Math.round(v).toLocaleString('pt-BR'); };
    o.descricao = o.descricao || (o.titulo + '. ' + o.faixas.map(function (fx) { return fx.rotulo + ': ' + num(fx['var'], 1, true) + '% (' + brl(fx.a) + ' → ' + brl(fx.b) + ')'; }).join('; ') + '.');
    return moldura(cont, o, function (c) {
      var T = c.T, g = c.g, y = c.y, hatch = padroes(c.defs, T);
      // chave de leitura em uma linha, com forma
      var lado = o.faixas.every(function (fx) { return fx['var'] > 0; }) ? 'l' : null;
      if (o.chave) {
        marca(g, lado || 'b', c.x0 + 6, y + 8, 10, T);
        var lns = quebra(o.chave, 12.5, 600, c.x1 - c.x0 - 18);
        lns.forEach(function (ln, j) { texto(g, c.x0 + 18, y + 12 + j * 17, ln, { size: 12.5, weight: 600, fill: T.ink2 }); });
        y += lns.length * 17 + 14;
      }
      var colW = 76, vals = o.faixas.map(function (fx) { return fx['var']; });
      var lo = Math.min(0, Math.min.apply(null, vals)), hi = Math.max(0, Math.max.apply(null, vals));
      var labW = largura('+00,0%', 13, 700) + 8;
      var pl = c.x0 + colW, pr = c.x1 - labW;
      var X = function (v) { return pl + (v - lo) / (hi - lo || 1) * (pr - pl); };
      var y0 = y;
      o.faixas.forEach(function (fx) {
        var k = fx['var'] >= 0 ? 'l' : 'b';
        texto(g, c.x0, y + 13, fx.rotulo, { size: 13, weight: 700, fill: T.ink });
        if (fx.desc && largura(fx.rotulo, 13, 700) + 5 + largura(fx.desc, 12, 400) < colW - 4) texto(g, c.x0 + largura(fx.rotulo, 13, 700) + 5, y + 13, fx.desc, { size: 12, fill: T.muted });
        var fill = fx.estimado ? hatch[k + 'Est'] : T[k];
        var b = barra(g, X(0), X(fx['var']), y + 1, 16, fill);
        if (fx.estimado) el('path', { d: b.getAttribute('d'), fill: 'none', stroke: T[k], 'stroke-width': 1 }, g);
        texto(g, X(fx['var']) + 5, y + 14, num(fx['var'], 1, true) + '%', { size: 13, weight: 700, fill: T.ink });
        texto(g, pl, y + 32, brl(fx.a) + ' → ' + brl(fx.b) + (fx.estimado ? ' · estimativa' : ''), { size: 12, fill: T.muted });
        y += 44;
      });
      el('line', { x1: X(0), x2: X(0), y1: y0 - 2, y2: y - 26, stroke: T.ink2 }, g);
      return y - 6;
    });
  }
  function distribuicao(cont, o) {
    return montar(cont, o, desenharDistribuicao, function (o) {
      var brl = function (v) { return 'R$ ' + Math.round(v).toLocaleString('pt-BR'); }, L = lados(o);
      return { cab: ['Faixa', L.b.nome, L.l.nome, 'Variação real'],
        linhas: o.faixas.map(function (f) { return [f.rotulo + (f.desc ? ' (' + f.desc + ')' : '') + (f.estimado ? ' – estimativa' : ''), brl(f.a), brl(f.b), num(f['var'], 1, true) + '%']; }) };
    });
  }

  /* =====================================================================
   * PROMESSAS: barra 100% empilhada por categoria
   * opts: titulo, categorias:[{id, nome, tipo:'cheio'|'claro'|'listrado'|'neutro'|'vazio'}],
   *       linhas:[{lado, nome, sub, contagens:{id:n}}], destaque:'cumprida', destaqueRotulo,
   *       excluir:['sem_evidencia'], grupos:[{tema, linhas}] (mapa tema a tema), fonte, nota
   * ===================================================================== */
  function corCategoria(cat, lado, T, hatch) {
    if (cat.cor) return cat.cor;   // cor de STATUS fixa, igual para os dois lados (99-principios-imagem)
    switch (cat.tipo) {
      case 'cheio': return T[lado];
      case 'claro': return T[lado + 'Claro'];
      case 'listrado': return hatch[lado + 'Claro'];
      case 'neutro': return T.neutro;
      default: return hatch.vazio;
    }
  }
  function contar(linha, o) {
    var total = 0, cats = o.categorias.filter(function (c) { return !(o.excluir && o.excluir.indexOf(c.id) >= 0); });
    cats.forEach(function (c) { total += linha.contagens[c.id] || 0; });
    var d = linha.contagens[o.destaque] || 0;
    return { cats: cats, total: total, d: d, pct: total ? d / total * 100 : 0 };
  }
  function barraEmpilhada(c, y, h, linha, o, hatch, rotular) {
    var T = c.T, g = c.g, r = contar(linha, o), x = c.x0, W = c.x1 - c.x0;
    var segs = r.cats.filter(function (cat) { return (linha.contagens[cat.id] || 0) > 0; });
    var gaps = (segs.length - 1) * 2, util = W - gaps;
    segs.forEach(function (cat, i) {
      var n = linha.contagens[cat.id], w = util * n / r.total;
      var fill = corCategoria(cat, linha.lado, T, hatch);
      var rx = (i === 0 || i === segs.length - 1) ? 4 : 0;
      var rect = el('rect', { x: x, y: y, width: Math.max(1, w), height: h, rx: rx, fill: fill }, g);
      if (cat.tipo === 'vazio') el('rect', { x: x + 0.5, y: y + 0.5, width: Math.max(0, w - 1), height: h - 1, rx: rx, fill: 'none', stroke: T.muted, 'stroke-dasharray': '3 2' }, g);
      var tt = el('title', null, rect); tt.textContent = cat.nome + ': ' + n + ' de ' + r.total;
      var lab = String(n);
      if (rotular && largura(lab, 12, 700) + 10 < w) {
        var base = (cat.tipo === 'listrado' || cat.tipo === 'vazio') ? T.surface : fill;
        if (cat.tipo === 'listrado' || cat.tipo === 'vazio') el('rect', { x: x + w / 2 - largura(lab, 12, 700) / 2 - 4, y: y + h / 2 - 8, width: largura(lab, 12, 700) + 8, height: 16, rx: 3, fill: T.surface }, g);
        texto(g, x + w / 2, y + h / 2 + 4.5, lab, { size: 12, weight: 700, fill: textoSobre(base.charAt(0) === '#' ? base : T.surface), anchor: 'middle' });
      }
      x += w + 2;
    });
    return r;
  }
  function legendaPromessas(c, y, o, hatch) {
    var T = c.T, g = c.g, x = c.x0;
    o.categorias.forEach(function (cat) {
      if (o.excluir && o.excluir.indexOf(cat.id) >= 0) return;
      var w = 30 + largura(cat.nome, 12, 400) + 12;
      if (x + w > c.x1) { x = c.x0; y += 20; }
      // amostra dividida: metade com a cor de cada lado (mesma regra para os dois)
      if (cat.tipo === 'neutro' || cat.tipo === 'vazio') {
        el('rect', { x: x, y: y + 2, width: 24, height: 12, rx: 3, fill: corCategoria(cat, 'b', T, hatch) }, g);
        if (cat.tipo === 'vazio') el('rect', { x: x + 0.5, y: y + 2.5, width: 23, height: 11, rx: 3, fill: 'none', stroke: T.muted, 'stroke-dasharray': '3 2' }, g);
      } else {
        el('rect', { x: x, y: y + 2, width: 12, height: 12, rx: 2, fill: corCategoria(cat, 'b', T, hatch) }, g);
        el('rect', { x: x + 12, y: y + 2, width: 12, height: 12, rx: 2, fill: corCategoria(cat, 'l', T, hatch) }, g);
      }
      texto(g, x + 30, y + 12.5, cat.nome, { size: 12, fill: T.ink2 });
      x += w;
    });
    return y + 22;
  }
  function vencedorPromessas(linhas, o) {
    var a = contar(linhas[0], o).pct, b = contar(linhas[1], o).pct;
    if (Math.abs(a - b) < 0.05) return null;
    return a > b ? linhas[0].lado : linhas[1].lado;
  }
  function desenharPromessas(cont, o) {
    var L = lados(o);
    function ord(ls) { return ORDEM.map(function (k) { return ls.filter(function (l) { return l.lado === k; })[0]; }).filter(Boolean); }
    o.descricao = o.descricao || (o.titulo + '. ' + (o.linhas ? ord(o.linhas) : []).map(function (l) {
      var r = contar(l, o); return (l.nome || L[l.lado].nome) + ': ' + r.d + ' de ' + r.total + ' ' + (o.destaqueRotulo || o.destaque) + ' (' + num(r.pct, 1) + '%); ' +
        r.cats.map(function (cat) { return cat.nome + ' ' + (l.contagens[cat.id] || 0); }).join(', ');
    }).join('. ') + '.');
    return moldura(cont, o, function (c) {
      var T = c.T, g = c.g, y = c.y, hatch = padroes(c.defs, T);
      if (o.linhas) {
        var ls = ord(o.linhas), v = vencedorPromessas(ls, o);
        ls.forEach(function (l) {
          var r = contar(l, o), nm = l.nome || L[l.lado].nome;
          marca(g, l.lado, c.x0 + 6, y + 9, 11, T);
          texto(g, c.x0 + 18, y + 14, nm, { size: 14, weight: 700, fill: T.ink });
          var pctS = num(r.pct, 1) + '%', qtd = r.d + ' de ' + r.total + ' ' + (o.destaqueRotulo || '');
          texto(g, c.x1, y + 18, pctS, { size: 22, weight: 800, fill: T.ink, anchor: 'end' });
          texto(g, c.x1, y + 34, qtd, { size: 12, fill: T.ink2, anchor: 'end' });
          var subLs = l.sub ? quebra(l.sub, 12, 400, c.x1 - c.x0 - 18 - largura(qtd, 12, 400) - 12) : [];
          subLs.forEach(function (ln, j) { texto(g, c.x0 + 18, y + 31 + j * 15, ln, { size: 12, fill: T.muted }); });
          y += Math.max(42, 22 + subLs.length * 15 + 6);
          if (v === l.lado) { selo(g, c.x1, y, o.vencedorRotulo || 'maior proporção', l.lado, T); y += 28; }
          barraEmpilhada(c, y, 28, l, o, hatch, true);
          y += 44;
        });
      }
      if (o.grupos) {
        o.grupos.forEach(function (gr) {
          var ls2 = ord(gr.linhas), v2 = vencedorPromessas(ls2, o);
          texto(g, c.x0, y + 15, gr.tema, { size: 14, weight: 700, fill: T.ink });
          if (v2) selo(g, c.x1, y, L[v2].curto, v2, T); else seloNeutro(g, c.x1, y, 'empate', T);
          y += 30;
          ls2.forEach(function (l) {
            var r = contar(l, o);
            texto(g, c.x0, y + 12, L[l.lado].curto, { size: 12, weight: v2 === l.lado ? 700 : 400, fill: v2 === l.lado ? T.ink : T.ink2 });
            texto(g, c.x1, y + 12, r.d + ' de ' + r.total + ' (' + num(r.pct, 0) + '%)', { size: 12, weight: 700, fill: T.ink, anchor: 'end' });
            y += 17;
            barraEmpilhada(c, y, 16, l, o, hatch, true);
            y += 22;
          });
          y += 6; el('line', { x1: c.x0, x2: c.x1, y1: y, y2: y, stroke: T.grid }, g); y += 10;
        });
      }
      y = legendaPromessas(c, y + 2, o, hatch);
      return y;
    });
  }
  function promessas(cont, o) {
    return montar(cont, o, desenharPromessas, function (o) {
      var L = lados(o), linhas = [];
      var cats = o.categorias.filter(function (c) { return !(o.excluir && o.excluir.indexOf(c.id) >= 0); });
      (o.linhas || []).forEach(function (l) { var r = contar(l, o); linhas.push([l.nome || L[l.lado].nome].concat(cats.map(function (c) { return String(l.contagens[c.id] || 0); }), [r.total, num(r.pct, 1) + '%'])); });
      (o.grupos || []).forEach(function (gr) { gr.linhas.forEach(function (l) { var r = contar(l, o); linhas.push([gr.tema + ' · ' + L[l.lado].curto].concat(cats.map(function (c) { return String(l.contagens[c.id] || 0); }), [r.total, num(r.pct, 1) + '%'])); }); });
      return { cab: ['Linha'].concat(cats.map(function (c) { return c.nome; }), ['Total', '% ' + (o.destaqueRotulo || o.destaque)]), linhas: linhas };
    });
  }

  /* ---------- exportar PNG (para o botão "compartilhar imagem") ----------
   * paraPNG(svg, escala, urlFonte?): com urlFonte (ex.: '/assets/fonts/inter-latin-var.woff2') a fonte
   * vai embutida no SVG antes de rasterizar; sem ela, o navegador usa a fonte do sistema no PNG. */
  var _fonte64 = {};
  function fonteBase64(url) {
    if (_fonte64[url]) return Promise.resolve(_fonte64[url]);
    return fetch(url).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
      var b = new Uint8Array(buf), s = '', i;
      for (i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
      _fonte64[url] = btoa(s); return _fonte64[url];
    });
  }
  function paraPNG(svg, escala, urlFonte) {
    escala = escala || 2;
    var w = +svg.getAttribute('width'), h = +svg.getAttribute('height');
    var prep = urlFonte ? fonteBase64(urlFonte) : Promise.resolve(null);
    return prep.then(function (b64) {
      var clone = svg.cloneNode(true);
      clone.setAttribute('width', w); clone.setAttribute('height', h);
      clone.removeAttribute('style');
      if (b64) {
        var st = document.createElementNS(NS, 'style');
        st.textContent = "@font-face{font-family:'InterVar';font-weight:100 900;src:url(data:font/woff2;base64," + b64 + ") format('woff2')}";
        clone.insertBefore(st, clone.firstChild);
      }
      var xml = new XMLSerializer().serializeToString(clone);
      var url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
      return new Promise(function (ok, erro) {
        var img = new Image();
        img.onload = function () {
          var cv = document.createElement('canvas'); cv.width = w * escala; cv.height = h * escala;
          var cx = cv.getContext('2d'); cx.scale(escala, escala); cx.drawImage(img, 0, 0);
          cv.toBlob(function (b) { b ? ok(b) : erro(new Error('toBlob falhou')); }, 'image/png');
        };
        img.onerror = erro; img.src = url;
      });
    });
  }

  /* =====================================================================
   * CARD para compartilhar (feed 1080×1350 · story 1080×1920 · og 1200×630)
   * BPD.card(el, {
   *   formato: 'feed'|'story'|'og', variante: 'trajetoria'|'barras'|'duelo',
   *   indicador: 'Inflação', criterio: 'menor'|'maior', criterioTexto?,
   *   destaque: { rotulo, sub, valores:{b,l}, formato, periodo:{b,l} },   // decide o vencedor
   *   manchete: { valor: '4,6%', texto: '...' },                            // número do lado à frente
   *   grafico: { titulo, sub, ... dados da variante },
   *   fonte, periodo, dados (até quando), url, atualizado, provisorio, nota, lados
   * })
   * O vencedor é calculado pelo critério sobre destaque.valores (o título nunca é digitado à mão).
   * Sempre tema claro (é imagem para circular fora do site). Tamanho real em px: exporta 1:1.
   * ===================================================================== */
  var FORMATOS = {
    feed: { W: 1080, H: 1350, P: 72, topo: 0, base: 0, k: 1 },
    story: { W: 1080, H: 1920, P: 72, topo: 250, base: 250, k: 1 },
    og: { W: 1200, H: 630, P: 44, topo: 0, base: 0, k: 0.62 }
  };
  var CARD = { fundo: '#fbfbf9', ink: '#18181b', ink2: '#3f3f46', muted: '#63636b', grid: '#e7e7e4', axis: '#a1a1aa', area: 'rgba(113,113,122,.16)' };

  function cardTexto(g, x, y, s, size, weight, fill, anchor, ls) {
    var t = texto(g, x, y, s, { size: size, weight: weight, fill: fill, anchor: anchor });
    if (ls) t.setAttribute('letter-spacing', ls);
    return t;
  }
  function cardTicks(lo, hi, n) {
    var span = hi - lo, passo = Math.pow(10, Math.floor(Math.log(span / n) / Math.LN10)), err = span / n / passo;
    passo *= err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1;
    var t = [], v = Math.floor(lo / passo) * passo;
    for (; v <= hi + passo * 0.001; v += passo) t.push(+v.toFixed(6));
    return t;
  }
  function cardHatch(defs, cor, id) {
    var pat = el('pattern', { id: id, patternUnits: 'userSpaceOnUse', width: 14, height: 14, patternTransform: 'rotate(45)' }, defs);
    el('rect', { width: 14, height: 14, fill: '#ffffff' }, pat);
    el('rect', { width: 7, height: 14, fill: cor }, pat);
    return 'url(#' + id + ')';
  }

  /* -- variante 1: trajetória sobreposta ("meses desde a posse") -- */
  function cardTrajetoria(g, defs, x, y, w, h, k, gr, L, T) {
    var f = fmtFn(gr.formato), n = Math.max(gr.b.length, gr.l.length) - 1;
    var todos = gr.b.concat(gr.l).filter(function (v) { return v != null; });
    var lo = Math.min(0, Math.min.apply(null, todos)), hi = Math.max(0, Math.max.apply(null, todos));
    var ticks = cardTicks(lo, hi, 4); lo = Math.min(lo, ticks[0]); hi = Math.max(hi, ticks[ticks.length - 1]);
    var fy = fmtFn(gr.formatoEixo || gr.formato);
    var axW = Math.max.apply(null, ticks.map(function (t) { return largura(fy(t), 24 * k, 400); })) + 14 * k;
    var endW = 230 * k, pl = x + axW, pr = x + w - endW, top = y + 10 * k, bot = y + h - 44 * k;
    var X = function (i) { return pl + i / n * (pr - pl); }, Y = function (v) { return bot - (v - lo) / (hi - lo) * (bot - top); };
    ticks.forEach(function (t) {
      el('line', { x1: pl, x2: pr, y1: Y(t), y2: Y(t), stroke: t === 0 ? CARD.axis : CARD.grid, 'stroke-width': t === 0 ? 2 * k : 1.5 * k }, g);
      cardTexto(g, pl - 12 * k, Y(t) + 8 * k, fy(t), 24 * k, 400, CARD.muted, 'end');
    });
    var passoX = gr.passoX || 12;
    for (var i = 0; i <= n; i += passoX) cardTexto(g, X(i) - (i === 0 ? 4 * k : 0), bot + 32 * k, i === 0 ? 'Posse' : String(i), 24 * k, 400, CARD.muted, i === 0 ? 'start' : 'middle');
    if (gr.rotuloX) cardTexto(g, pr, bot + 32 * k + 30 * k, gr.rotuloX, 22 * k, 400, CARD.muted, 'end');
    // área entre as curvas (neutra: cinza, nunca a cor de um lado)
    var m = Math.min(gr.b.length, gr.l.length) - 1, d = '';
    for (i = 0; i <= m; i++) d += (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(gr.b[i]).toFixed(1);
    for (i = m; i >= 0; i--) d += 'L' + X(i).toFixed(1) + ',' + Y(gr.l[i]).toFixed(1);
    el('path', { d: d + 'Z', fill: CARD.area }, g);
    if (gr.marcaMes != null) {
      el('line', { x1: X(gr.marcaMes), x2: X(gr.marcaMes), y1: top, y2: bot, stroke: CARD.axis, 'stroke-width': 1.5 * k, 'stroke-dasharray': (6 * k) + ' ' + (5 * k) }, g);
      if (gr.marcaTexto) cardTexto(g, X(gr.marcaMes) - 8 * k, bot - 12 * k, gr.marcaTexto, 22 * k, 600, CARD.ink2, 'end');
    }
    var fins = [];
    ORDEM.forEach(function (lado) {
      var v = gr[lado], dd = '';
      v.forEach(function (val, j) { if (val != null) dd += (dd ? 'L' : 'M') + X(j).toFixed(1) + ',' + Y(val).toFixed(1); });
      el('path', { d: dd, fill: 'none', stroke: T[lado], 'stroke-width': 6 * k, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, g);
      var j = v.length - 1; marca(g, lado, X(j), Y(v[j]), 18 * k, T);
      fins.push({ lado: lado, x: X(j), y: Y(v[j]), v: v[j] });
    });
    // rótulo direto no fim da linha (afasta os dois se colidirem; fio liga ao ponto)
    fins.sort(function (a, b) { return a.y - b.y; });
    var alt = (gr.fim ? 124 : 80) * k, lim0 = top + 24 * k, lim1 = bot - (gr.fim ? 60 : 34) * k;
    fins[0].ly = fins[0].y; fins[1].ly = fins[1].y;
    if (fins[1].ly - fins[0].ly < alt) { var mid = (fins[0].y + fins[1].y) / 2; fins[0].ly = mid - alt / 2; fins[1].ly = mid + alt / 2; }
    if (fins[1].ly > lim1) { fins[1].ly = lim1; fins[0].ly = Math.min(fins[0].ly, lim1 - alt); }
    if (fins[0].ly < lim0) { fins[0].ly = lim0; fins[1].ly = Math.max(fins[1].ly, lim0 + alt); }
    fins.forEach(function (fi) {
      var ly = fi.ly != null ? fi.ly : fi.y, lx = pr + 26 * k;
      el('line', { x1: fi.x + 12 * k, x2: lx - 6 * k, y1: fi.y, y2: ly, stroke: CARD.axis, 'stroke-width': 1.5 * k }, g);
      cardTexto(g, lx, ly - 10 * k, L[fi.lado].curto.toUpperCase(), 20 * k, 700, CARD.ink2, 'start', 1 * k);
      cardTexto(g, lx, ly + 30 * k, f(fi.v), 40 * k, 800, CARD.ink, 'start');
      if (gr.fim && gr.fim[fi.lado]) cardTexto(g, lx, ly + 56 * k, gr.fim[fi.lado], 20 * k, 400, CARD.muted, 'start');
    });
  }

  /* -- variante 2: barras ano a ano de mandato (1º ano × 1º ano ...) -- */
  function cardBarras(g, defs, x, y, w, h, k, gr, L, T) {
    var f = fmtFn(gr.formato), G = gr.grupos;
    var vals = []; G.forEach(function (q) { vals.push(q.b.v, q.l.v); });
    var hi = Math.max.apply(null, vals), ticks = cardTicks(0, hi * 1.2, 4); hi = Math.max(ticks[ticks.length - 1], hi * 1.2);
    var fy = fmtFn(gr.formatoEixo || gr.formato);
    var axW = Math.max.apply(null, ticks.map(function (t) { return largura(fy(t), 22 * k, 400); })) + 14 * k;
    // legenda com forma
    var lx = x + axW;
    ORDEM.forEach(function (lado) {
      marca(g, lado, lx + 9 * k, y + 12 * k, 18 * k, T);
      var s = L[lado].nome + (L[lado].periodo ? ' · ' + L[lado].periodo : '');
      cardTexto(g, lx + 26 * k, y + 20 * k, s, 22 * k, 600, CARD.ink2);
      lx += largura(s, 22 * k, 600) + 60 * k;
    });
    var pl = x + axW, pr = x + w, top = y + 92 * k, bot = y + h - 70 * k;
    var Y = function (v) { return bot - v / hi * (bot - top); };
    ticks.forEach(function (t) {
      el('line', { x1: pl, x2: pr, y1: Y(t), y2: Y(t), stroke: t === 0 ? CARD.axis : CARD.grid, 'stroke-width': (t === 0 ? 2 : 1.5) * k }, g);
      cardTexto(g, pl - 12 * k, Y(t) + 8 * k, fy(t), 22 * k, 400, CARD.muted, 'end');
    });
    var gw = (pr - pl) / G.length, bw = Math.min(110 * k, gw * 0.34), gap = 8 * k;
    G.forEach(function (q, gi) {
      var cx = pl + gw * gi + gw / 2;
      ORDEM.forEach(function (lado, li) {
        var bx = li === 0 ? cx - gap / 2 - bw : cx + gap / 2, it = q[lado];
        var fill = q.parcial ? cardHatch(defs, T[lado], 'h' + lado + gi + Math.random().toString(36).slice(2, 6)) : T[lado];
        var yb = Y(it.v), r = Math.min(6 * k, bw / 2);
        el('path', { d: 'M' + bx + ',' + bot + 'V' + (yb + r) + 'Q' + bx + ',' + yb + ' ' + (bx + r) + ',' + yb + 'H' + (bx + bw - r) + 'Q' + (bx + bw) + ',' + yb + ' ' + (bx + bw) + ',' + (yb + r) + 'V' + bot + 'Z', fill: fill, stroke: q.parcial ? T[lado] : 'none', 'stroke-width': 2 * k }, g);
        cardTexto(g, bx + bw / 2, yb - 12 * k, f(it.v), 28 * k, 800, CARD.ink, 'middle');
        cardTexto(g, bx + bw / 2, bot + 30 * k, it.rot, 22 * k, lado === 'l' || lado === 'b' ? 600 : 400, CARD.ink2, 'middle');
      });
      cardTexto(g, cx, bot + 60 * k, q.rotulo + (q.parcial ? ' · ' + q.parcial : ''), 21 * k, 400, CARD.muted, 'middle');
    });
  }

  /* -- variante 3: duelo (dois valores, barras horizontais a partir de zero) -- */
  function cardDuelo(g, defs, x, y, w, h, k, gr, L, T, venc) {
    var f = fmtFn(gr.formato), vals = ORDEM.map(function (l) { return gr.valores[l]; });
    var hi = Math.max.apply(null, vals), labW = Math.max.apply(null, vals.map(function (v) { return largura(f(v), 56 * k, 800); })) + 24 * k;
    var pl = x, pr = x + w - labW, bh = Math.min(96 * k, h / 5), yy = y + 20 * k;
    ORDEM.forEach(function (lado) {
      marca(g, lado, x + 12 * k, yy + 14 * k, 22 * k, T);
      cardTexto(g, x + 34 * k, yy + 24 * k, L[lado].nome + (L[lado].periodo ? ' · ' + L[lado].periodo : ''), 28 * k, 700, CARD.ink);
      if (venc === lado) {
        var sw = largura('✓ à frente', 22 * k, 700) + 26 * k, sh = 36 * k;
        el('rect', { x: x + w - sw, y: yy - 4 * k, width: sw, height: sh, rx: sh / 2, fill: T[lado] }, g);
        cardTexto(g, x + w - sw / 2, yy - 4 * k + sh * 0.68, '✓ à frente', 22 * k, 700, '#ffffff', 'middle');
      }
      yy += 44 * k;
      barra(g, pl, pl + Math.max(4, gr.valores[lado] / hi * (pr - pl)), yy, bh, T[lado]);
      cardTexto(g, pl + gr.valores[lado] / hi * (pr - pl) + 16 * k, yy + bh / 2 + 20 * k, f(gr.valores[lado]), 56 * k, 800, CARD.ink);
      yy += bh + 10 * k;
      if (gr.sub && gr.sub[lado]) { cardTexto(g, x, yy + 26 * k, gr.sub[lado], 26 * k, 400, CARD.ink2); yy += 40 * k; }
      yy += 34 * k;
    });
  }

  function desenharCard(cont, o) {
    var F = FORMATOS[o.formato || 'feed'], W = F.W, H = F.H, P = F.P, k = F.k, T = TEMAS.light, L = lados(o);
    var dv = o.destaque, fd = fmtFn(dv.formato);
    var venc = vencedor({ criterio: o.criterio, valores: dv.valores, titulo: o.indicador });
    var svg = el('svg', { xmlns: NS, width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'font-family': FONTE });
    svg.style.display = 'block'; svg.style.width = '100%'; svg.style.height = 'auto';
    var titulo = o.indicador + ': ' + (venc ? L[venc].nome + ' à frente' : 'sem vencedor');
    var tt = el('title', null, svg); tt.textContent = titulo;
    var dd = el('desc', null, svg);
    dd.textContent = titulo + '. ' + (dv.rotulo || '') + ': ' + L.b.nome + ' ' + fd(dv.valores.b) + '; ' + L.l.nome + ' ' + fd(dv.valores.l) + '. Critério: ' + textoCriterio(o) + '. Fonte: ' + o.fonte + '.';
    var defs = el('defs', null, svg);
    el('rect', { x: 0, y: 0, width: W, height: H, fill: CARD.fundo }, svg);
    var g = el('g', null, svg);
    var og = o.formato === 'og';
    var colW = og ? 560 : W - 2 * P;           // coluna de texto
    var y = P + F.topo;

    // 1. marca + selo provisório
    cardTexto(g, P, y + 22 * k + (og ? 4 : 0), 'BORA PROS DADOS BRASIL', (og ? 18 : 24 * k), 800, CARD.muted, 'start', 2 * k);
    if (o.provisorio) {
      var ps = 'PROVISÓRIO · aguardando checagem', pw = largura(ps, 20 * (og ? 0.85 : k), 700) + 28;
      el('rect', { x: W - P - pw, y: y - 6, width: pw, height: 40 * (og ? 0.85 : 1), rx: 8, fill: '#ffffff', stroke: CARD.ink2, 'stroke-width': 2, 'stroke-dasharray': '7 5' }, g);
      cardTexto(g, W - P - pw / 2, y + 20 * (og ? 0.85 : 1), ps, 20 * (og ? 0.85 : k), 700, CARD.ink2, 'middle');
    }
    y += (og ? 48 : 70 * k);

    // 2. título neutro: "<Indicador>:" + linha do vencedor com forma e sublinhado na cor do lado (mesmo desenho p/ os dois)
    // tamanho do título: o maior em que "<nome mais longo dos dois lados> à frente" cabe numa linha (igual p/ qualquer vencedor)
    var ts = og ? 40 : 66;
    var maisLongo = largura(L.b.nome + ' à frente', 10, 800) > largura(L.l.nome + ' à frente', 10, 800) ? L.b.nome : L.l.nome;
    while (ts > (og ? 28 : 40) && largura(maisLongo + ' à frente', ts, 800) + ts * 0.82 > colW) ts -= 2;
    var lh = ts * 1.12;
    quebra(o.indicador + ':', ts, 800, colW).forEach(function (ln) { y += lh; cardTexto(g, P, y - ts * 0.22, ln, ts, 800, CARD.ink); });
    if (venc) {
      var nomeV = L[venc].nome + ' à frente';
      var linhasV = quebra(nomeV, ts, 800, colW - ts * 0.9);
      linhasV.forEach(function (ln, j) {
        y += lh;
        if (j === 0) marca(g, venc, P + ts * 0.32, y - ts * 0.55, ts * 0.52, T);
        var tx = P + ts * 0.82;
        cardTexto(g, tx, y - ts * 0.22, ln, ts, 800, CARD.ink);
        el('rect', { x: tx, y: y - ts * 0.08, width: largura(ln, ts, 800), height: ts * 0.1, rx: ts * 0.05, fill: T[venc] }, g);
      });
    }
    y += og ? 14 : 22 * k;
    // critério
    var cs = og ? 18 : 28;
    cardTexto(g, P, y + cs, textoCriterio(o) + (o.criterioDetalhe ? ' · ' + o.criterioDetalhe : ''), cs, 600, CARD.ink2);
    y += cs + (og ? 18 : 34);

    // 3. manchete numérica (valor do lado à frente + frase com os dois lados)
    if (o.manchete) {
      var ms = og ? 76 : (o.formato === 'story' ? 140 : 116), mw = largura(o.manchete.valor, ms, 800);
      var tx2 = P + mw + (og ? 18 : 32), tw = (og ? P + colW : W - P) - tx2, tl = quebra(o.manchete.texto, og ? 17 : 28, 400, tw);
      var bloco = Math.max(ms * 0.95, tl.length * (og ? 22 : 36));
      cardTexto(g, P, y + ms * 0.82, o.manchete.valor, ms, 800, CARD.ink);
      tl.forEach(function (ln, j) { cardTexto(g, tx2, y + (og ? 22 : 36) * (j + 1) + Math.max(0, (ms * 0.82 - tl.length * (og ? 22 : 36)) / 2), ln, og ? 17 : 28, j === 0 ? 700 : 400, j === 0 ? CARD.ink : CARD.ink2); });
      y += bloco + (og ? 16 : 30);
    }

    // rodapé (de baixo para cima): fonte/URL, depois "comparação em destaque"
    var fs = og ? 15 : 22, linhasF = [];
    var fonteTxt = 'Fonte: ' + o.fonte + (o.periodo ? ' · Período: ' + o.periodo : '') + (o.dados ? ' · Dados até ' + o.dados : '');
    linhasF = quebra(fonteTxt, fs, 400, W - 2 * P);
    var urlTxt = (o.url || SITE) + (o.atualizado ? ' · atualizado em ' + o.atualizado : '');
    var yRod = H - P - F.base - (linhasF.length + 1) * (fs * 1.4);
    if (o.nota) { var nl = quebra(o.nota, fs, 400, W - 2 * P); yRod -= nl.length * fs * 1.4 + 6; }
    var yF = yRod;
    if (o.nota) quebra(o.nota, fs, 400, W - 2 * P).forEach(function (ln) { yF += fs * 1.4; cardTexto(g, P, yF, ln, fs, 400, CARD.ink2); });
    if (o.nota) yF += 6;
    linhasF.forEach(function (ln) { yF += fs * 1.4; cardTexto(g, P, yF, ln, fs, 400, CARD.muted); });
    yF += fs * 1.4; cardTexto(g, P, yF, urlTxt, fs, 700, CARD.ink2);

    // comparação em destaque (dois lados, colunas iguais, mesmo desenho; selo "✓ à frente" no lado à frente)
    var dx0 = P, dW = og ? colW : W - 2 * P, nsz = og ? 14 : 22, dH = og ? 132 : 184, yD;
    yD = og ? y + 4 : yRod - dH - 24;
    el('line', { x1: dx0, x2: dx0 + dW, y1: yD, y2: yD, stroke: CARD.ink2, 'stroke-width': og ? 1.5 : 2.5 }, g);
    var rot = (dv.rotulo || 'Comparação em destaque').toUpperCase();
    cardTexto(g, dx0, yD + (og ? 22 : 38), rot, og ? 15 : 22, 800, CARD.ink, 'start', 1);
    if (dv.sub) cardTexto(g, dx0 + largura(rot, og ? 15 : 22, 800) + rot.length + (og ? 14 : 20), yD + (og ? 22 : 38), dv.sub, og ? 14 : 22, 400, CARD.muted);
    var y2 = yD + (og ? 50 : 84), cw = (dW - (og ? 16 : 32)) / 2;
    var sw2 = largura('✓ à frente', nsz, 700) + (og ? 16 : 26), sh2 = og ? 22 : 36;
    // valor: mesmo tamanho nos dois lados, o maior que couber
    var ds = og ? 40 : 64;
    ORDEM.forEach(function (lado) { while (largura(fd(dv.valores[lado]), ds, 800) > cw && ds > 24) ds -= 2; });
    ORDEM.forEach(function (lado, i) {
      var cx = dx0 + i * (cw + (og ? 16 : 32)), per = dv.periodo && dv.periodo[lado] ? ' · ' + dv.periodo[lado] : '';
      var nm = L[lado].curto + per;
      if (largura(nm, nsz, 600) + (og ? 18 : 26) + sw2 + 8 > cw) nm = L[lado].curto; // mesma regra p/ os dois lados
      marca(g, lado, cx + (og ? 6 : 9), y2 - (og ? 5 : 8), og ? 12 : 18, T);
      cardTexto(g, cx + (og ? 18 : 26), y2, nm, nsz, 600, CARD.ink2);
      if (venc === lado) {
        el('rect', { x: cx + cw - sw2, y: y2 - sh2 * 0.72, width: sw2, height: sh2, rx: sh2 / 2, fill: T[lado] }, g);
        cardTexto(g, cx + cw - sw2 / 2, y2 - sh2 * 0.72 + sh2 * 0.68, '✓ à frente', nsz, 700, '#ffffff', 'middle');
      }
      var vy = y2 + ds * 1.0 + (og ? 6 : 12);
      cardTexto(g, cx, vy, fd(dv.valores[lado]), ds, 800, CARD.ink);
      el('rect', { x: cx, y: vy + (og ? 10 : 18), width: cw, height: og ? 4 : 6, rx: 2, fill: T[lado] }, g);
    });

    // 4. gráfico no espaço que sobra
    var gr = o.grafico || {}, gx, gy, gw, gh;
    if (og) { gx = P + colW + 36; gy = P + 4 + (o.provisorio ? 44 : 0); gw = W - P - gx; gh = yRod - gy - 16; }
    else { gx = P; gy = y; gw = W - 2 * P; gh = yD - y - 26; }
    if (gr.titulo) { cardTexto(g, gx, gy + (og ? 16 : 24), gr.titulo.toUpperCase(), og ? 15 : 23, 800, CARD.ink, 'start', 1); gy += og ? 24 : 36; gh -= og ? 24 : 36; }
    if (gr.sub) { quebra(gr.sub, og ? 14 : 22, 400, gw).forEach(function (ln) { cardTexto(g, gx, gy + (og ? 16 : 24), ln, og ? 14 : 22, 400, CARD.muted); gy += og ? 20 : 30; gh -= og ? 20 : 30; }); }
    gy += og ? 6 : 14; gh -= og ? 6 : 14;
    var kk = og ? 0.62 : k;
    if (o.variante === 'barras') cardBarras(g, defs, gx, gy, gw, gh, kk, gr, L, T);
    else if (o.variante === 'duelo') cardDuelo(g, defs, gx, gy, gw, gh, kk, gr, L, T, venc);
    else cardTrajetoria(g, defs, gx, gy, gw, gh, kk, gr, L, T);
    return svg;
  }
  function card(cont, o) {
    if (typeof cont === 'string') cont = document.querySelector(cont);
    while (cont.firstChild) cont.removeChild(cont.firstChild);
    var svg = desenharCard(cont, o);
    cont.appendChild(svg);
    return svg;
  }

  /* =====================================================================
   * CARD-SÍNTESE (fechamento de carrossel) — decisão do dono: a soma de pontos NUNCA é manchete.
   * Dois blocos de MESMO tamanho, um por área, cada um com "<Governo X> à frente" no mesmo desenho do título
   * dos cards; quesitos em grade 2×2 (blocos com 3 ou 4 itens ficam com a mesma altura); selo "apertada"
   * idêntico para os dois lados. A contagem só aparece em texto pequeno no rodapé (opts.rodapeContagem).
   * BPD.cardSintese(el, {formato, titulo, sub, grupos:[{titulo, vencedor:'b'|'l', itens:[{nome, apertada}]}],
   *                      contexto:[{nome, nota}], fecho, rodapeContagem, fonte, url, atualizado})
   * ===================================================================== */
  function cardSintese(cont, o) {
    if (typeof cont === 'string') cont = document.querySelector(cont);
    while (cont.firstChild) cont.removeChild(cont.firstChild);
    var F = FORMATOS[o.formato || 'feed'], W = F.W, H = F.H, P = F.P, T = TEMAS.light, L = lados(o);
    var svg = el('svg', { xmlns: NS, width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'font-family': FONTE });
    svg.style.display = 'block'; svg.style.width = '100%'; svg.style.height = 'auto';
    var grupos = o.grupos.slice().sort(function (a, b) { return ORDEM.indexOf(a.vencedor) - ORDEM.indexOf(b.vencedor); }); // ordem fixa
    var tt = el('title', null, svg); tt.textContent = o.titulo;
    var dd = el('desc', null, svg);
    dd.textContent = grupos.map(function (gr) { return gr.titulo + ': ' + L[gr.vencedor].nome + ' à frente (' + gr.itens.map(function (q) { return q.nome + (q.apertada ? ', apertada' : ''); }).join('; ') + ')'; }).join('. ') + '.';
    el('rect', { x: 0, y: 0, width: W, height: H, fill: CARD.fundo }, svg);
    var g = el('g', null, svg), y = P + F.topo;
    cardTexto(g, P, y + 22, 'BORA PROS DADOS BRASIL', 24, 800, CARD.muted, 'start', 2);
    y += 64;
    quebra(o.titulo, 56, 800, W - 2 * P).forEach(function (ln) { y += 62; cardTexto(g, P, y - 12, ln, 56, 800, CARD.ink); });
    if (o.sub) { y += 6; quebra(o.sub, 26, 400, W - 2 * P).forEach(function (ln) { y += 34; cardTexto(g, P, y - 6, ln, 26, 400, CARD.ink2); }); }
    y += 30;
    // tamanho do "<Governo> à frente": o do nome mais longo, igual nos dois blocos
    var bw = W - 2 * P, pad = 28, ts = 44;
    var longo = largura(L.b.nome, 10, 800) > largura(L.l.nome, 10, 800) ? L.b.nome : L.l.nome;
    while (ts > 30 && largura(longo + ' à frente', ts, 800) + ts * 0.8 > bw - 2 * pad) ts -= 2;
    var maxItens = Math.max.apply(null, grupos.map(function (gr) { return gr.itens.length; }));
    var linhasGrade = Math.ceil(maxItens / 2), th = 64, tg = 12;
    var altBloco = pad + 30 + ts * 1.25 + 22 + linhasGrade * (th + tg) - tg + pad;
    var swA = largura('apertada', 20, 700) + 24;
    grupos.forEach(function (gr) {
      var k = gr.vencedor, x0 = P;
      el('rect', { x: x0 + 1, y: y + 1, width: bw - 2, height: altBloco - 2, rx: 18, fill: '#ffffff', stroke: CARD.grid, 'stroke-width': 2 }, g);
      el('rect', { x: x0, y: y, width: 10, height: altBloco, rx: 5, fill: T[k] }, g);
      var yy = y + pad;
      cardTexto(g, x0 + pad + 8, yy + 22, gr.titulo.toUpperCase(), 24, 800, CARD.ink2, 'start', 1.5);
      yy += 30 + ts * 1.1;
      marca(g, k, x0 + pad + 8 + ts * 0.3, yy - ts * 0.36, ts * 0.5, T);
      var tx = x0 + pad + 8 + ts * 0.75, nm = L[k].nome + ' à frente';
      cardTexto(g, tx, yy, nm, ts, 800, CARD.ink);
      el('rect', { x: tx, y: yy + ts * 0.14, width: largura(nm, ts, 800), height: ts * 0.1, rx: ts * 0.05, fill: T[k] }, g);
      yy += 22 + ts * 0.15;
      var cw = (bw - 2 * pad - 8 - tg) / 2;
      gr.itens.forEach(function (q, i) {
        var cx = x0 + pad + 8 + (i % 2) * (cw + tg), cy = yy + Math.floor(i / 2) * (th + tg);
        el('rect', { x: cx, y: cy, width: cw, height: th, rx: 12, fill: T[k] }, g);
        var tam = 26, rot = '✓ ' + q.nome, livre = cw - 36 - (q.apertada ? swA + 10 : 0);
        while (tam > 18 && largura(rot, tam, 700) > livre) tam -= 1;
        cardTexto(g, cx + 16, cy + th / 2 + tam * 0.36, rot, tam, 700, '#ffffff');
        if (q.apertada) {
          var sh = 32, sx = cx + cw - swA - 12, sy = cy + (th - sh) / 2;
          el('rect', { x: sx, y: sy, width: swA, height: sh, rx: sh / 2, fill: '#ffffff' }, g);
          cardTexto(g, sx + swA / 2, sy + sh * 0.7, 'apertada', 20, 700, T[k], 'middle');
        }
      });
      y += altBloco + 24;
    });
    (o.contexto || []).forEach(function (q) {
      el('rect', { x: P + 1, y: y + 1, width: W - 2 * P - 2, height: 54, rx: 12, fill: 'none', stroke: CARD.axis, 'stroke-width': 2, 'stroke-dasharray': '8 6' }, g);
      cardTexto(g, P + 18, y + 36, q.nome + ': ' + (q.nota || 'contexto, não conta ponto'), 24, 600, CARD.ink2);
      y += 66;
    });
    // rodapé: fecho + contagem em texto pequeno + legenda do "apertada" + fonte + URL
    var fs = 22, pe = [];
    if (o.rodapeContagem) pe = pe.concat(quebra(o.rodapeContagem, 20, 400, W - 2 * P).map(function (t) { return [t, 20, 400, CARD.muted]; }));
    pe = pe.concat(quebra('Fonte: ' + o.fonte, fs, 400, W - 2 * P).map(function (t) { return [t, fs, 400, CARD.muted]; }));
    pe.push([(o.url || SITE) + (o.atualizado ? ' · atualizado em ' + o.atualizado : ''), fs, 700, CARD.ink2]);
    var yR = H - P - F.base - pe.reduce(function (s2, l) { return s2 + l[1] * 1.4; }, 0);
    if (o.fecho) { var fl = quebra(o.fecho, 30, 700, W - 2 * P), yf = yR - fl.length * 40 - 14; fl.forEach(function (ln) { yf += 40; cardTexto(g, P, yf, ln, 30, 700, CARD.ink); }); }
    pe.forEach(function (l) { yR += l[1] * 1.4; cardTexto(g, P, yR, l[0], l[1], l[2], l[3]); });
    cont.appendChild(svg);
    return svg;
  }

  /* =====================================================================
   * CARD DE SELEÇÃO (imagem única de uma seleção /c/1-3-5) — 96-revisao-dataviz §3.
   * Título neutro e fixo (nunca "X à frente em N"); uma linha de duelo compacto por item, na ordem dos ids;
   * selo "✓ à frente" idêntico para os dois lados; "apertada" vazado igual para os dois; contagem só em texto
   * pequeno no rodapé, junto de "Seleção feita por quem compartilhou" e do resumo do site inteiro.
   * BPD.cardSelecao(el, {formato:'feed'|'story', titulo, sub, itens:[{tema, criterioTexto, valores:{b,l},
   *   formato, vencedor:'b'|'l'|null, apertada, lados:{b:{curto},l:{curto}}, periodo}], resto, rodape:[...], url, atualizado})
   * feed (1080×1350) até 6 itens; story (1080×1920) até 9; o que passar vira "e mais K no link".
   * ===================================================================== */
  function cardSelecao(cont, o) {
    if (typeof cont === 'string') cont = document.querySelector(cont);
    while (cont.firstChild) cont.removeChild(cont.firstChild);
    var F = FORMATOS[o.formato || 'feed'], W = F.W, H = F.H, P = F.P, T = TEMAS.light;
    var max = (o.formato === 'story') ? 9 : 6, itens = (o.itens || []).slice(0, max);
    var resto = (o.itens || []).length - itens.length + (o.resto || 0);
    var svg = el('svg', { xmlns: NS, width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'font-family': FONTE });
    svg.style.display = 'block'; svg.style.width = '100%'; svg.style.height = 'auto';
    var titulo = o.titulo || 'Comparações escolhidas, com dados oficiais';
    var tt = el('title', null, svg); tt.textContent = titulo;
    var dd = el('desc', null, svg);
    dd.textContent = itens.map(function (it) {
      var f = fmtFn(it.formato), L = lados(it);
      return it.tema + ': ' + L.b.curto + ' ' + f(it.valores.b) + ', ' + L.l.curto + ' ' + f(it.valores.l) +
        (it.vencedor ? ' (' + L[it.vencedor].curto + ' à frente, ' + (it.criterioTexto || '') + ')' : ' (' + (it.criterioTexto || 'sem placar') + ')');
    }).join('. ') + '. ' + (o.rodape || []).join(' ');
    el('rect', { x: 0, y: 0, width: W, height: H, fill: CARD.fundo }, svg);
    var g = el('g', null, svg), y = P + F.topo;
    cardTexto(g, P, y + 22, 'BORA PROS DADOS BRASIL', 24, 800, CARD.muted, 'start', 2);
    y += 52;
    quebra(titulo, 54, 800, W - 2 * P).forEach(function (ln) { y += 60; cardTexto(g, P, y - 12, ln, 54, 800, CARD.ink); });
    if (o.sub) { y += 4; quebra(o.sub, 26, 400, W - 2 * P).forEach(function (ln) { y += 34; cardTexto(g, P, y - 6, ln, 26, 400, CARD.ink2); }); }
    y += 26;
    // rodapé (de baixo para cima)
    var pe = [];
    (o.rodape || []).forEach(function (t, i) { quebra(t, 21, i === 0 ? 700 : 400, W - 2 * P - 60).forEach(function (ln) { pe.push([ln, 21, i === 0 ? 700 : 400, i === 0 ? CARD.ink2 : CARD.muted]); }); });
    pe.push([(o.url || SITE) + (o.atualizado ? ' · atualizado em ' + o.atualizado : ''), 22, 700, CARD.ink2]);
    var altPe = pe.reduce(function (s, l) { return s + l[1] * 1.45; }, 0);
    var yPe = H - P - F.base - altPe;
    // linhas de duelo compacto: altura igual para todas
    var fim = yPe - 30 - (resto > 0 ? 44 : 0), n = Math.max(1, itens.length);
    var rh = Math.min(176, (fim - y) / n);
    var nomeW = 0;
    itens.forEach(function (it) { var L = lados(it); ORDEM.forEach(function (k) { nomeW = Math.max(nomeW, largura(L[k].curto, 24, 600)); }); });
    nomeW += 40;
    var seloTxt = '✓ à frente', sw = largura(seloTxt, 20, 700) + 24, sh = 32;
    itens.forEach(function (it, idx) {
      var f = fmtFn(it.formato), L = lados(it), y0 = y + idx * rh;
      el('line', { x1: P, x2: W - P, y1: y0, y2: y0, stroke: CARD.grid, 'stroke-width': 2 }, g);
      var tamT = 30, tema = it.tema;
      var critTxt = (it.criterioTexto || '') + (it.periodo ? ' · ' + it.periodo : '');
      var wCrit = largura(critTxt, 20, 600) + (it.apertada ? largura('apertada', 18, 700) + 34 : 0);
      while (tamT > 22 && largura(tema, tamT, 800) + wCrit + 24 > W - 2 * P) tamT -= 1;
      cardTexto(g, P, y0 + 44, tema, tamT, 800, CARD.ink);
      var xc = W - P;
      if (it.apertada) {
        var aw = largura('apertada', 18, 700) + 22;
        el('rect', { x: xc - aw, y: y0 + 22, width: aw, height: 30, rx: 15, fill: '#ffffff', stroke: CARD.ink2, 'stroke-width': 2 }, g);
        cardTexto(g, xc - aw / 2, y0 + 43, 'apertada', 18, 700, CARD.ink2, 'middle');
        xc -= aw + 10;
      }
      cardTexto(g, xc, y0 + 43, critTxt, 20, 600, CARD.muted, 'end');
      var vals = ORDEM.map(function (k) { return it.valores[k]; });
      var lo = Math.min(0, Math.min.apply(null, vals)), hi = Math.max(0, Math.max.apply(null, vals));
      var labW = Math.max.apply(null, vals.map(function (v) { return largura(f(v), 26, 800); })) + 16 + sw + 10;
      var pl = P + nomeW + (lo < 0 ? labW * 0.6 : 0), pr = W - P - (hi > 0 ? labW : 0);
      var X = function (v) { return pl + (v - lo) / ((hi - lo) || 1) * (pr - pl); };
      var bh = Math.max(14, Math.min(26, (rh - 74) / 2 - 7)), yy = y0 + 62;
      ORDEM.forEach(function (k) {
        var v = it.valores[k], xa = X(0), xb = X(v);
        if (Math.abs(xb - xa) < 3) xb = xa + (v < 0 ? -3 : 3);
        marca(g, k, P + 12, yy + bh / 2, 20, T);
        cardTexto(g, P + 30, yy + bh / 2 + 8, L[k].curto, 24, 600, CARD.ink2);
        barra(g, Math.min(xa, xb), Math.max(xa, xb), yy, bh, T[k]);
        var tx = v < 0 ? xb - 12 : xb + 12;
        var vt = f(v);
        cardTexto(g, tx, yy + bh / 2 + 9, vt, 26, 800, CARD.ink, v < 0 ? 'end' : 'start');
        if (it.vencedor === k) {
          var sx = v < 0 ? xa + 12 : tx + largura(vt, 26, 800) + 12;
          el('rect', { x: sx, y: yy + bh / 2 - sh / 2, width: sw, height: sh, rx: sh / 2, fill: T[k] }, g);
          cardTexto(g, sx + sw / 2, yy + bh / 2 + 7, seloTxt, 20, 700, '#ffffff', 'middle');
        }
        if (lo < 0) el('line', { x1: X(0), x2: X(0), y1: yy - 4, y2: yy + bh + 4, stroke: CARD.ink2, 'stroke-width': 2 }, g);
        yy += bh + 14;
      });
    });
    var yFim = y + itens.length * rh;
    el('line', { x1: P, x2: W - P, y1: yFim, y2: yFim, stroke: CARD.grid, 'stroke-width': 2 }, g);
    if (resto > 0) cardTexto(g, P, yFim + 36, 'e mais ' + resto + (resto === 1 ? ' comparação' : ' comparações') + ' no link', 24, 700, CARD.ink2);
    pe.forEach(function (l) { yPe += l[1] * 1.45; cardTexto(g, P, yPe - 4, l[0], l[1], l[2], l[3]); });
    cont.appendChild(svg);
    return svg;
  }

  root.BPD = {
    placar: placar, duelo: duelo, trajetoria: trajetoria, distribuicao: distribuicao,
    promessas: promessas, resumo: resumo, card: card, cardSintese: cardSintese, cardSelecao: cardSelecao,
    carregarFonte: function () { return Promise.all(['400', '600', '700', '800'].map(function (w) { return document.fonts.load(w + ' 20px InterVar'); })); }, paraPNG: paraPNG, redesenhar: function () { redesenhar(true); },
    TEMAS: TEMAS, FORMATOS: FORMATOS, versao: '0.2.1'
  };
})(typeof window !== 'undefined' ? window : this);

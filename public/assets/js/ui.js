/* ==== Bora pros dados Brasil — comportamento da interface (ui.js) ====
   ES5, sem dependências, compatível com a CSP (script-src 'self'). Carregar com defer, DEPOIS de share.js.
   1. abas do cabeçalho e menu de seções: esmaecer a borda que ainda rola + levar o item ativo para a vista
   2. <details> (.q-mais, .vrd-det e qualquer outro): ao abrir, redimensiona os gráficos de dentro
      (ECharts: echarts.getInstanceByDom(el).resize(); charts.js: evento resize); âncora (#id) dentro de
      <details> fechado abre o <details>; details[data-abrir-desktop] não tem mais efeito (tudo começa fechado)
   3. barra inferior fixa (≤ 760 px, páginas com .topnav): Resumo · Compartilhar · Seções, com folhas inferiores
   Eventos (via data-track, lidos pelo analytics.js): bbar_click (label resumo|compartilhar|secoes).
   Compartilhar usa o componente .share (share.js): share_click / share_success / share_cancel. */
(function () {
  'use strict';
  var doc = document, html = doc.documentElement, win = window;
  html.classList.add('js');
  var cfg = (typeof win.SITE_CONFIG === 'object' && win.SITE_CONFIG) || {};
  var PAGE = cfg.pageId || 'site';
  var REDUZ = win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CELULAR = win.matchMedia ? win.matchMedia('(max-width: 760px)') : { matches: false };

  function $(s, r) { return (r || doc).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); }
  function raf(fn) { return (win.requestAnimationFrame || setTimeout)(fn); }

  /* ------------------------------------------------ 1. trilhos roláveis */
  function trilho(sc) {
    if (!sc || sc.__ui) return; sc.__ui = 1;
    sc.classList.add('ui-rola');
    var t = false;
    function upd() {
      t = false;
      var max = sc.scrollWidth - sc.clientWidth;
      sc.classList.toggle('ui-fade-l', sc.scrollLeft > 4);
      sc.classList.toggle('ui-fade-r', max > 4 && sc.scrollLeft < max - 4);
    }
    sc.addEventListener('scroll', function () { if (!t) { t = true; raf(upd); } }, { passive: true });
    win.addEventListener('resize', upd);
    upd();
    return upd;
  }
  /* centraliza o item na faixa horizontal, sem mexer na rolagem vertical da página */
  function centraliza(sc, a, suave) {
    if (!sc || !a || sc.scrollWidth <= sc.clientWidth) return;
    var alvo = a.offsetLeft - (sc.clientWidth - a.offsetWidth) / 2;
    alvo = Math.max(0, Math.min(alvo, sc.scrollWidth - sc.clientWidth));
    if (Math.abs(sc.scrollLeft - alvo) < 2) return;
    if (sc.scrollTo && suave && !REDUZ) sc.scrollTo({ left: alvo, behavior: 'smooth' });
    else sc.scrollLeft = alvo;
  }

  function iniciaTrilhos() {
    var abas = $('.sitebar .sb-nav');
    if (abas) { trilho(abas); centraliza(abas, $('a.ativo', abas), false); }
    var sec = $('.topnav .in');
    if (!sec) return;
    trilho(sec);
    /* o script de cada página liga/desliga .on ao rolar; seguimos a mudança */
    var ultimo = null;
    function segue() {
      var on = $('a.on', sec);
      if (on && on !== ultimo) { ultimo = on; centraliza(sec, on, true); }
    }
    if (win.MutationObserver) {
      new MutationObserver(function () { raf(segue); }).observe(sec, { subtree: true, attributes: true, attributeFilter: ['class'] });
    }
    segue();
  }

  /* ------------------------------------------------ 2. <details> */
  var resizeT = null;
  function redimensiona(raiz) {
    var ec = win.echarts;
    if (ec && ec.getInstanceByDom) {
      $$('[_echarts_instance_]', raiz).forEach(function (el) {
        var c = ec.getInstanceByDom(el); if (c) { try { c.resize(); } catch (e) {} }
      });
    }
    /* charts.js (SVG) e scripts das páginas reagem ao resize da janela */
    clearTimeout(resizeT);
    resizeT = setTimeout(function () {
      try { win.dispatchEvent(new Event('resize')); }
      catch (e) { var ev = doc.createEvent('UIEvents'); ev.initUIEvent('resize', true, false, win, 0); win.dispatchEvent(ev); }
    }, 30);
  }
  /* 'toggle' não sobe na árvore; escutamos na fase de captura */
  doc.addEventListener('toggle', function (e) {
    var d = e.target;
    if (d && d.tagName === 'DETAILS' && d.open) raf(function () { redimensiona(d); });
  }, true);

  function abreAte(el) {
    var aberto = false, p = el;
    while (p && p !== doc.body) {
      if (p.tagName === 'DETAILS' && !p.open) { p.open = true; aberto = true; }
      p = p.parentElement;
    }
    return aberto;
  }
  function alvoDoHash(h) {
    if (!h || h.length < 2) return null;
    try { return doc.getElementById(decodeURIComponent(h.slice(1))); } catch (e) { return null; }
  }
  function vaiParaHash() {
    var el = alvoDoHash(location.hash);
    if (el && abreAte(el)) raf(function () { el.scrollIntoView(); });
  }
  /* clique num link interno: abre o <details> antes de o navegador rolar até o alvo */
  doc.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    var el = alvoDoHash(a.getAttribute('href'));
    if (el) abreAte(el);
  }, true);
  win.addEventListener('hashchange', vaiParaHash);

  /* decisão do dono (16/10/2026): todo recolhível começa FECHADO, em qualquer tela.
     data-abrir-desktop fica sem efeito; só um link para #id interno abre o recolhível. */
  function abreNoDesktop() {}

  /* ------------------------------------------------ 3. barra inferior + folhas */
  var TEXTO_PADRAO = {
    comparativo: '📊 Governo Bolsonaro (2019-22) × Governo Lula (2023-25), só dados oficiais: na economia e renda, Lula à frente (crescimento, inflação, emprego, proteção social); nas contas públicas, Bolsonaro à frente (controle do gasto, dívida, conta de juros). Fontes: IBGE, Banco Central, Tesouro.',
    propostas: '📊 Planos de governo de 2026 registrados no TSE: em quantos temas o plano diz COMO vai fazer (instrumento nomeado)? Flávio Bolsonaro em 1 de 19 × Lula em 11 de 19. Programas já em execução contam como caminho, o que favorece quem governa.',
    balanco: '📊 Promessas dos planos registrados no TSE, mesma régua para os dois (Gov. Bolsonaro × Gov. Lula, mandato em curso até 30/09/2026): cumpridas 15,2% × 35,3%; só as verificáveis 22,7% × 38,7%; cumpridas + parciais 27,3% × 50,0%.',
    fontes: '📊 Os 50 arquivos oficiais (TSE, Banco Central, IBGE, Tesouro, Fed, Congresso e STF) por trás das análises do Bora pros dados Brasil, com impressão digital SHA-256 para conferir.'
  };
  var ICO = {
    resumo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>',
    secoes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>'
  };

  function el(tag, cls, attrs, txt) {
    var n = doc.createElement(tag), k;
    if (cls) n.className = cls;
    if (attrs) for (k in attrs) if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]);
    if (txt) n.textContent = txt;
    return n;
  }

  /* seção em leitura (mesma regra do share.js: a última cujo topo passou de 40% da tela) */
  function secaoAtual() {
    var cur = null;
    $$('[data-track-section]').forEach(function (s) { if (s.getBoundingClientRect().top < win.innerHeight * 0.4) cur = s; });
    return cur;
  }
  function shareDaSecao() {
    var s = secaoAtual();
    return s && (s.querySelector('.share:not([data-share-variant])') || s.querySelector('.share:not([data-share-section="auto"])'));
  }

  var folhaAberta = null, focoAntes = null;
  function folha(id, titulo) {
    var f = el('div', 'ui-sheet', { id: id, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': id + '-t', hidden: '' });
    var fundo = el('button', 'ui-sheet-fundo', { type: 'button', 'aria-label': 'Fechar', tabindex: '-1' });
    var p = el('div', 'ui-sheet-painel');
    var hd = el('div', 'ui-sheet-hd');
    var x = el('button', 'ui-sheet-x', { type: 'button', 'aria-label': 'Fechar' }, '×');
    hd.appendChild(el('h2', '', { id: id + '-t' }, titulo)); hd.appendChild(x);
    p.appendChild(el('div', 'ui-sheet-pega', { 'aria-hidden': 'true' })); p.appendChild(hd);
    f.appendChild(fundo); f.appendChild(p);
    fundo.addEventListener('click', fecha); x.addEventListener('click', fecha);
    doc.body.appendChild(f);
    f.__painel = p;
    return f;
  }
  function abre(f, origem) {
    if (folhaAberta) fecha();
    focoAntes = origem || doc.activeElement;
    f.hidden = false; folhaAberta = f;
    html.classList.add('ui-travado');
    var foco = f.querySelector('.ui-sheet-x');
    if (foco) foco.focus();
  }
  function fecha() {
    if (!folhaAberta) return;
    folhaAberta.hidden = true; folhaAberta = null;
    html.classList.remove('ui-travado');
    if (focoAntes && focoAntes.focus) { try { focoAntes.focus({ preventScroll: true }); } catch (e) { focoAntes.focus(); } }
  }
  doc.addEventListener('keydown', function (e) {
    if (!folhaAberta) return;
    if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); fecha(); return; }
    if (e.key === 'Tab') { /* mantém o foco dentro da folha */
      var fs = $$('a[href], button:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])', folhaAberta.__painel)
        .filter(function (n) { return n.offsetParent !== null; });
      if (!fs.length) return;
      var i = fs.indexOf(doc.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); fs[fs.length - 1].focus(); }
      else if (!e.shiftKey && i === fs.length - 1) { e.preventDefault(); fs[0].focus(); }
    }
  });

  function folhaCompartilhar() {
    var f = folha('ui-folha-share', 'Compartilhar');
    var prev = el('p', 'ui-sheet-prev');
    var sh = el('div', 'share', {
      'data-share-section': 'auto', 'data-share-placement': 'barra', 'data-share-name': 'este dado',
      'data-share-text': TEXTO_PADRAO[PAGE] || doc.title,
      'data-share-lead': 'Vai a mensagem acima, com o link para conferir números, ressalvas e método.'
    });
    f.__painel.appendChild(prev); f.__painel.appendChild(sh);
    if (win.__share && win.__share.init) win.__share.init(f.__painel);
    f.__prev = prev;
    return f;
  }
  function atualizaPrevia(f) {
    var s = shareDaSecao(), txt = (s && s.getAttribute('data-share-text')) || TEXTO_PADRAO[PAGE] || doc.title;
    f.__prev.textContent = '';
    f.__prev.appendChild(el('b', '', null, 'O que vai na mensagem'));
    f.__prev.appendChild(doc.createTextNode(txt));
  }

  function folhaSecoes(links) {
    var f = folha('ui-folha-secoes', 'Seções desta página');
    var ul = el('ul', 'ui-secoes');
    links.forEach(function (a) {
      var li = el('li'), b = el('a', '', { href: a.getAttribute('href') }, (a.textContent || '').trim());
      b.addEventListener('click', function () { fecha(); });
      li.appendChild(b); ul.appendChild(li);
    });
    f.__painel.appendChild(ul);
    f.__marca = function () {
      var on = $('.topnav a.on'), h = on && on.getAttribute('href');
      $$('a', ul).forEach(function (b) { if (b.getAttribute('href') === h) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
    };
    return f;
  }

  function alvoResumo() {
    var ids = ['resumo', 'placar', 'topo'], i;
    for (i = 0; i < ids.length; i += 1) if (doc.getElementById(ids[i])) return '#' + ids[i];
    return '#';
  }

  function barraInferior() {
    var nav = $('.topnav .in');
    if (!nav || $('.bbar')) return;
    var links = $$('a[href^="#"]', nav);
    var bar = el('nav', 'bbar', { 'aria-label': 'Atalhos' });
    var bRes = el('a', 'bbar-btn', { href: alvoResumo(), 'data-track': 'bbar_click', 'data-track-label': 'resumo' });
    bRes.innerHTML = ICO.resumo + '<span>Resumo</span>';
    var bSh = el('button', 'bbar-btn bbar-btn--pri', { type: 'button', 'aria-haspopup': 'dialog', 'data-track': 'bbar_click', 'data-track-label': 'compartilhar' });
    bSh.innerHTML = ICO.share + '<span>Compartilhar</span>';
    var bSec = el('button', 'bbar-btn', { type: 'button', 'aria-haspopup': 'dialog', 'data-track': 'bbar_click', 'data-track-label': 'secoes' });
    bSec.innerHTML = ICO.secoes + '<span>Seções</span>';
    bar.appendChild(bRes); bar.appendChild(bSh); bar.appendChild(bSec);
    doc.body.appendChild(bar);
    doc.body.classList.add('tem-bbar');
    /* a barra do share.js não aparece junto com esta (as duas viram uma só) */
    $$('.share--bar').forEach(function (b) { b.hidden = true; });

    var fSh = null, fSec = null;
    bRes.addEventListener('click', function () { bRes.setAttribute('href', alvoResumo()); });
    bSh.addEventListener('click', function () { fSh = fSh || folhaCompartilhar(); atualizaPrevia(fSh); abre(fSh, bSh); });
    bSec.addEventListener('click', function () { fSec = fSec || folhaSecoes(links); fSec.__marca(); abre(fSec, bSec); });

    var t = false;
    function upd() {
      t = false;
      var y = win.pageYOffset || html.scrollTop || 0;
      var ligada = CELULAR.matches && y > win.innerHeight * 0.6 && !$('.consent');
      bar.classList.toggle('is-on', ligada);
    }
    win.addEventListener('scroll', function () { if (!t) { t = true; raf(upd); } }, { passive: true });
    win.addEventListener('resize', upd);
    upd();
  }

  function inicia() {
    iniciaTrilhos();
    abreNoDesktop();
    barraInferior();
    if (location.hash) vaiParaHash();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', inicia);
  else inicia();
})();

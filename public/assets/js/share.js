/* ==== Bora pros dados Brasil — compartilhamento (share.js) — ES5, sem dependências, ok com a CSP ====
   <div class="share" data-share-section="inflacao" data-share-text="📊 Inflação (IPCA): ..." data-share-name="o dado de inflação"
     [data-share-path="/c/inflacao/" | data-share-anchor="cap-motor"] [data-share-placement="card|capitulo|placar|fim|barra"]
     [data-share-variant="mini|bar"] [data-share-image="/assets/img/share/story-inflacao.jpg"] [data-share-lead="..."]
     [data-share-card="p-bolso"] (def do charts.js em window.CARDS_*) [data-share-fonte="IBGE …"]></div>
   section="auto" (barra): herda o .share da seção [data-track-section] em leitura. Eventos: share_click/_success/_cancel.
   "Copiar imagem": põe na área de transferência o PNG da seção (card do charts.js, gráfico SVG da seção ou cartão de
   texto), sempre com rodapé "Bora pros dados Brasil · site/página#seção · fonte · atualizado em", mais o texto com o link.
   Páginas podem registrar um gerador próprio: (window.__shareImgs = window.__shareImgs || {})['<âncora>'] = fn → Promise<Blob>. */
(function () {
  var cfg = (typeof window.SITE_CONFIG === 'object' && window.SITE_CONFIG) || {};
  var PAGE = cfg.pageId || 'site';
  var BASE = /^https?:\/\//.test(cfg.siteUrl || '') ? cfg.siteUrl.replace(/\/$/, '') : location.origin;
  var CTA = 'Números, ressalvas e método:';
  var CODE = { whatsapp: 'wa', telegram: 'tg', x: 'x', facebook: 'fb', copy: 'cp', native: 'ns', image: 'img' };
  var NATIVE = typeof navigator.share === 'function';
  var FILES = false, files = {}, E = encodeURIComponent;
  try { FILES = !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.jpg', { type: 'image/jpeg' })] })); } catch (e) {}
  /* imagem na área de transferência: ClipboardItem + clipboard.write (Chrome, Edge, Safari 13.1+, Firefox 127+) */
  var IMGCLIP = false;
  try { IMGCLIP = !!(window.ClipboardItem && navigator.clipboard && navigator.clipboard.write && window.isSecureContext &&
    (typeof ClipboardItem.supports !== 'function' || ClipboardItem.supports('image/png'))); } catch (e) {}
  /* WhatsApp com imagem: só no celular (a folha nativa lista o WhatsApp) e com suporte a arquivos PNG */
  var IMGWA = false;
  try { IMGWA = !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.png', { type: 'image/png' })] }) &&
    window.matchMedia && window.matchMedia('(pointer: coarse)').matches); } catch (e) {}
  var SITE = BASE.replace(/^https?:\/\//, '');

  function track(n, p) { try { if (window.__track) window.__track(n, p); } catch (e) {} }
  function attr(b, k, d) { return b.getAttribute('data-share-' + k) || d || ''; }
  /* 'auto' (barra) sem componente na seção em leitura: mede como a página */
  function secao(b) { var s = attr(b, 'section', PAGE); return s === 'auto' ? PAGE : s; }
  /* link com origem: /c/<slug>/?o=wa (curto, prévia própria) ou página#âncora com UTM completa */
  function link(b, m) {
    var sec = secao(b), path = attr(b, 'path'), a = attr(b, 'anchor');
    if (path) return BASE + path + '?o=' + CODE[m];
    return BASE + location.pathname + '?utm_source=' + m + '&utm_medium=share&utm_campaign=' + E(PAGE) +
      '&utm_content=' + E(sec) + (a ? '#' + a : '');
  }
  function body(b) { return attr(b, 'text', document.title); }
  function msg(b, m) { return body(b) + ' ' + CTA + ' ' + link(b, m); }
  var HREF = {
    whatsapp: function (b) { return 'https://wa.me/?text=' + E(textoWhats(b)); },
    telegram: function (b) { return 'https://t.me/share/url?url=' + E(link(b, 'telegram')) + '&text=' + E(body(b)); },
    x: function (b) { return 'https://twitter.com/intent/tweet?text=' + E(msg(b, 'x')); },
    facebook: function (b) { return 'https://www.facebook.com/sharer/sharer.php?u=' + E(link(b, 'facebook')); }
  };

  /* barra fixa: herda o componente da seção que está sendo lida */
  function ctx(b) {
    if (attr(b, 'section') !== 'auto') return b;
    var secs = document.querySelectorAll('[data-track-section]'), cur = null, i, s;
    for (i = 0; i < secs.length; i += 1) if (secs[i].getBoundingClientRect().top < window.innerHeight * 0.4) cur = secs[i];
    s = cur && (cur.querySelector('.share:not([data-share-variant])') || cur.querySelector('.share:not([data-share-section="auto"])'));
    return s || b;
  }

  function el(tag, cls, txt, at) {
    var n = document.createElement(tag), k; n.className = cls; if (txt) n.textContent = txt;
    for (k in at) if (at.hasOwnProperty(k)) n.setAttribute(k, at[k]); return n;
  }
  function btn(m, txt, label, cls) {
    if (HREF[m]) return el('a', 'share-btn ' + (cls || ''), txt, { 'data-m': m, href: '#', target: '_blank', rel: 'noopener', 'aria-label': label });
    return el('button', 'share-btn ' + (cls || ''), txt, { 'data-m': m, type: 'button', 'aria-label': label });
  }
  function say(b, t) {
    var s = b.querySelector('.share-status'); if (s) { s.textContent = t; clearTimeout(s.__t); s.__t = setTimeout(function () { s.textContent = ''; }, 4000); }
  }
  function toggle(b) {
    var p = b.querySelector('.share-panel'), t = b.querySelector('[data-m="more"]');
    if (p) { p.hidden = !p.hidden; if (t) t.setAttribute('aria-expanded', p.hidden ? 'false' : 'true'); }
  }

  function copyBtn() {
    /* o nome acessível começa pelo texto visível do botão (WCAG 2.5.3) */
    return IMGCLIP ? btn('copy', 'Copiar imagem', 'Copiar imagem, com a fonte e o link do site') : btn('copy', 'Copiar', 'Copiar o texto com o link e baixar a imagem');
  }
  var TOAST = null;
  /* a região viva já existe vazia desde o init: leitores de tela só anunciam mudanças em regiões que já estavam no DOM */
  function regiao() { if (!TOAST && document.body) { TOAST = el('div', 'share-toast', '', { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' }); document.body.appendChild(TOAST); } }
  function toast(t) {
    regiao(); if (!TOAST) return;
    TOAST.textContent = t; TOAST.classList.add('is-on');
    clearTimeout(TOAST.__t); TOAST.__t = setTimeout(function () { TOAST.classList.remove('is-on'); }, 4500);
  }

  function render(b) {
    if (b.__share) return; b.__share = 1;
    var v = attr(b, 'variant', 'full'), row = el('div', 'share-row'), pan = el('div', 'share-panel'), what = attr(b, 'name', 'este dado');
    pan.hidden = true;
    if (v === 'full') b.appendChild(el('p', 'share-lead', attr(b, 'lead', 'Mande este dado com a fonte: quem receber pode conferir.')));
    if (v === 'mini') {
      row.appendChild(NATIVE ? btn('native', 'Compartilhar', 'Compartilhar ' + what) :
        btn('more', 'Compartilhar', 'Mostrar opções para compartilhar ' + what));
      pan.appendChild(btn('whatsapp', IMGWA ? 'Enviar imagem no WhatsApp' : 'WhatsApp', (IMGWA ? 'Enviar imagem no WhatsApp: ' : 'Enviar pelo WhatsApp: ') + what, 'share-btn--wa'));
      pan.appendChild(copyBtn());
    } else {
      row.appendChild(btn('whatsapp', IMGWA ? 'Enviar imagem no WhatsApp' : 'WhatsApp', (IMGWA ? 'Enviar imagem no WhatsApp: ' : 'Enviar pelo WhatsApp: ') + what, 'share-btn--wa'));
      row.appendChild(copyBtn());
      row.appendChild(NATIVE ? btn('native', 'Outros apps', 'Compartilhar em outros aplicativos') :
        btn('more', 'Mais', 'Mais opções para compartilhar'));
    }
    if (FILES && attr(b, 'image')) row.appendChild(btn('image', 'Imagem', 'Enviar a imagem do comparativo'));
    if (!NATIVE || v === 'mini') {
      pan.appendChild(btn('telegram', 'Telegram', 'Enviar pelo Telegram'));
      pan.appendChild(btn('x', 'X', 'Publicar no X'));
      pan.appendChild(btn('facebook', 'Facebook', 'Publicar no Facebook'));
    }
    var mo = row.querySelector('[data-m="more"]'); if (mo) mo.setAttribute('aria-expanded', 'false');
    b.appendChild(row); if (pan.firstChild) b.appendChild(pan);
    b.appendChild(el('span', 'share-status', '', { role: 'status', 'aria-live': 'polite' }));
    var links = b.querySelectorAll('a[data-m]'), i;
    for (i = 0; i < links.length; i += 1) links[i].href = HREF[links[i].getAttribute('data-m')](ctx(b));
    b.addEventListener('click', function (e) { onClick(b, e); });
    if (v === 'bar') bar(b);
  }

  function onClick(b, e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-m]') : null; if (!t) return;
    e.stopPropagation(); /* evita outbound_click duplicado no analytics.js */
    var m = t.getAttribute('data-m'), c = ctx(b), sec = secao(c);
    if (m === 'more') { e.preventDefault(); toggle(b); return; }
    if (m === 'whatsapp') { whatsapp(b, e, t, attr(b, 'placement', attr(b, 'variant', 'full'))); return; }
    track('share_click', { method: m === 'copy' ? (IMGCLIP ? 'copy_image' : 'copy_text') : m, section: sec, placement: attr(b, 'placement', attr(b, 'variant', 'full')) });
    if (HREF[m]) { t.href = HREF[m](c); return; }
    e.preventDefault();
    if (m === 'copy') copy(b, c, sec);
    else if (m === 'native') native(b, { title: document.title, text: msg(c, 'native') }, 'native', sec);
    else if (m === 'image') image(b, c, sec);
  }

  function native(b, data, m, sec) {
    navigator.share(data).then(function () { track('share_success', { method: m, section: sec }); }, function (err) {
      if (err && err.name === 'AbortError') track('share_cancel', { method: m, section: sec });
      else { say(b, 'Não abriu? Toque de novo ou use os botões.'); if (m === 'native') toggle(b); }
    });
  }
  function legacyCopy(txt) {
    var ta = el('textarea', '', '', { readonly: '', style: 'position:fixed;opacity:0' }), ok = false;
    ta.value = txt; document.body.appendChild(ta); ta.select();
    try { ok = document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta); return ok;
  }
  /* Copiar: 1) imagem PNG + texto num só ClipboardItem (a PROMISE do PNG vai direto, para o Safari manter o gesto);
     2) sem ClipboardItem, sem permissão ou com falha: copia o texto com o link (writeText → execCommand) e BAIXA o PNG.
     Os avisos saem na região viva (aria-live polite); o nome do botão não muda. */
  function baixar(bl, nome) {
    var a = document.createElement('a'), u = URL.createObjectURL(bl);
    a.href = u; a.download = nome; a.style.display = 'none'; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(u); document.body.removeChild(a); }, 2000);
  }
  function copy(b, c, sec) {
    var txt = msg(c, 'copy'), copiouTxt = null, baixou = null;
    function pngOk() { return png(c).then(null, function () { return cartaoTexto(c, ref(c)); }); }
    function aviso() {         /* espera o texto e o download para um aviso só */
      if (copiouTxt === null || baixou === null) return;
      if (copiouTxt && baixou) toast('Imagem baixada e texto com o link copiado. Anexe a imagem e cole o texto na conversa.');
      else if (baixou) toast('Imagem baixada. Anexe na conversa; o link está no rodapé da imagem.');
      else if (copiouTxt) toast('Copiamos o texto com o link. Agora é só colar na conversa.');
      else toast('Não deu para copiar. Use o botão WhatsApp.');
    }
    function txtFeito(ok) { copiouTxt = ok; if (ok) track('share_success', { method: 'copy_text', section: sec }); aviso(); }
    function legado() { txtFeito(legacyCopy(txt)); }
    function plano2() {
      if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) navigator.clipboard.writeText(txt).then(function () { txtFeito(true); }, legado);
      else legado();
      pngOk().then(function (bl) {
        baixar(bl, 'bora-pros-dados-' + String(sec).replace(/[^a-z0-9-]/gi, '') + '.png');
        baixou = true; track('share_success', { method: 'download_image', section: sec }); aviso();
      }, function () { baixou = false; aviso(); });
    }
    if (!IMGCLIP) { toast('Preparando a imagem…'); plano2(); return; }
    var item;
    try { item = new ClipboardItem({ 'image/png': pngOk(), 'text/plain': new Blob([txt], { type: 'text/plain' }) }); } catch (e) { plano2(); return; }
    toast('Preparando a imagem…');
    navigator.clipboard.write([item]).then(function () {
      toast('Imagem copiada. Cole no WhatsApp, e-mail ou documento.');
      track('share_success', { method: 'copy_image', section: sec });
    }, function () { plano2(); });
  }

  /* ---------- PNG da seção, sempre com rodapé de referência ao site ---------- */
  var FONTE_CV = '"InterVar", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  function ref(c) {
    var a = attr(c, 'anchor'), alvo = a && document.getElementById(a), f = attr(c, 'fonte'), tm = document.querySelector('time[datetime]');
    if (!f && alvo) {
      var n = alvo.querySelector('.vrd-src, .sc-src, .q-resumo-pe, figcaption');
      if (n) f = n.textContent.replace(/^\s*Fonte:\s*/i, '').split(' · ').filter(function (p) { return p && !/calcul|classific|atualizado|›/i.test(p); }).join(' · ');
    }
    if (!f) { var m = /Fonte:\s*([^.]+)/.exec(body(c)); f = m ? m[1] : ''; }
    var d = tm && /\d{2}\/\d{2}\/\d{4}/.test(tm.textContent) ? tm.textContent.trim() : new Date().toLocaleDateString('pt-BR');
    return { url: SITE + location.pathname + (a ? '#' + a : ''), fonte: f.replace(/\s+/g, ' ').trim(), data: d };
  }
  function semFonte(r) { return { url: r.url, fonte: '', data: r.data }; }
  function acharDef(c) {
    var id = attr(c, 'card'), k, i, L, R = window.__shareDefs;
    /* def registrada pela página para a âncora/seção (ex.: home, que ajusta as defs antes do montarCard) */
    if (R && (R[attr(c, 'anchor')] || R[attr(c, 'section')])) return R[attr(c, 'anchor')] || R[attr(c, 'section')];
    if (!id) id = attr(c, 'anchor') || attr(c, 'section');
    if (!id) return null;
    for (k in window) {
      if (!/^CARDS_/.test(k) || !(window[k] instanceof Array)) continue;
      for (L = window[k], i = 0; i < L.length; i += 1) if (L[i] && L[i].id === id) return L[i];
    }
    return null;
  }
  function acharSvg(c) {
    var a = attr(c, 'anchor'), alvo = (a && document.getElementById(a)) || (c.closest && c.closest('article, section'));
    return alvo ? alvo.querySelector('.viz svg, .bpd-card-img svg, svg[role="img"]') : null;
  }
  function png(c) {
    var r = ref(c), prov = window.__shareImgs && (window.__shareImgs[attr(c, 'anchor')] || window.__shareImgs[attr(c, 'section')]);
    var BPD = window.BPD, def = acharDef(c), svg, k, d2 = {};
    try {
      if (def && BPD && BPD.cardPNG) {         /* o card do charts.js já traz marca, fonte e "url · atualizado em" */
        for (k in def) if (def.hasOwnProperty(k)) d2[k] = def[k];
        d2.url = r.url; d2.atualizado = def.atualizado || r.data;
        return BPD.cardPNG(d2, 'feed');
      }
      /* imagem que já traz a linha "Fonte:" (resumo, gráficos do charts.js): o rodapé não repete a fonte */
      /* imagem já completa (ex.: BPD.cardSelecao, com marca, fonte, URL e data): sem rodapé extra */
      if (prov) return Promise.resolve(prov()).then(function (bl) { return bl && bl.__completo ? bl : comRodape(bl, semFonte(r)); });
      svg = acharSvg(c);
      if (svg && BPD && BPD.paraPNG) {
        var w = +svg.getAttribute('width') || (svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width) || 390;
        var r2 = /Fonte/.test(svg.textContent || '') ? semFonte(r) : r;
        return BPD.paraPNG(svg, Math.max(1, 1080 / w), BPD.urlFonte).then(function (bl) { return comRodape(bl, r2); });
      }
    } catch (e) {}
    return cartaoTexto(c, r);
  }
  function bitmap(bl) {
    if (window.createImageBitmap) return createImageBitmap(bl);
    return new Promise(function (ok, no) {     /* CSP: img-src aceita data:, não blob: */
      var fr = new FileReader();
      fr.onload = function () { var im = new Image(); im.onload = function () { ok(im); }; im.onerror = no; im.src = fr.result; };
      fr.onerror = no; fr.readAsDataURL(bl);
    });
  }
  function quebrar(cx, t, max) {
    var ws = String(t).split(/\s+/), out = [], l = '', i;
    for (i = 0; i < ws.length; i += 1) {
      var p = l ? l + ' ' + ws[i] : ws[i];
      if (l && cx.measureText(p).width > max) { out.push(l); l = ws[i]; } else l = p;
    }
    if (l) out.push(l); return out;
  }
  /* canvas 1080 px: corpo (pinta) + faixa de rodapé neutra (≥ 90 px, textos de 26 px) */
  function montar(hCorpo, pinta, r) {
    var W = 1080, P = 48, cv = document.createElement('canvas'), cx = cv.getContext('2d'), ls = [], i;
    cx.font = '700 26px ' + FONTE_CV;
    quebrar(cx, 'Bora pros dados Brasil · ' + r.url, W - 2 * P).forEach(function (t) { ls.push(['700 26px ', '#18181b', t]); });
    cx.font = '400 26px ' + FONTE_CV;
    quebrar(cx, (r.fonte ? 'Fonte: ' + r.fonte + ' · ' : '') + 'atualizado em ' + r.data, W - 2 * P).forEach(function (t) { ls.push(['400 26px ', '#52525b', t]); });
    var hR = Math.max(90, 24 + ls.length * 36 + 20);
    cv.width = W; cv.height = Math.round(hCorpo + hR);
    cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, W, cv.height);
    pinta(cx, W);
    cx.fillStyle = '#f4f4f5'; cx.fillRect(0, hCorpo, W, hR);
    cx.fillStyle = '#d4d4d8'; cx.fillRect(0, hCorpo, W, 2);
    cx.textBaseline = 'top';
    for (i = 0; i < ls.length; i += 1) { cx.font = ls[i][0] + FONTE_CV; cx.fillStyle = ls[i][1]; cx.fillText(ls[i][2], P, hCorpo + 24 + i * 36); }
    return new Promise(function (ok, no) { cv.toBlob(function (bl) { if (bl) ok(bl); else no(new Error('png')); }, 'image/png'); });
  }
  function comRodape(bl, r) {
    return bitmap(bl).then(function (im) {
      var h = Math.round(im.height * 1080 / im.width);
      return montar(h, function (cx, W) { cx.drawImage(im, 0, 0, W, h); }, r);
    });
  }
  /* seção sem card nem gráfico: cartão com o próprio texto de compartilhamento */
  function cartaoTexto(c, r) {
    var cv = document.createElement('canvas').getContext('2d'), P = 64, ls;
    cv.font = '600 44px ' + FONTE_CV;
    ls = quebrar(cv, body(c), 1080 - 2 * P);
    return montar(P + 44 + ls.length * 60 + P, function (cx) {
      cx.textBaseline = 'top';
      cx.font = '800 24px ' + FONTE_CV; cx.fillStyle = '#02522b'; cx.fillText('BORA PROS DADOS BRASIL', P, P - 8);
      cx.font = '600 44px ' + FONTE_CV; cx.fillStyle = '#18181b';
      ls.forEach(function (t, i) { cx.fillText(t, P, P + 44 + i * 60); });
    }, r);
  }
  function image(b, c, sec) {
    var src = attr(c, 'image');
    function go(f) { if (f) native(b, { files: [f], text: msg(c, 'image') }, 'image', sec); else say(b, 'Imagem indisponível agora.'); }
    if (files[src]) { go(files[src]); return; }
    fetch(src).then(function (r) { return r.blob(); }).then(function (bl) {
      files[src] = new File([bl], src.split('/').pop(), { type: bl.type || 'image/jpeg' }); go(files[src]);
    }, function () { go(null); });
  }

  /* barra fixa: aparece depois da 1ª tela, some quando outro .share ou o rodapé estão visíveis */
  function bar(b) {
    var watch = document.querySelectorAll('.share:not([data-share-variant="bar"]), .sitefoot'), i, tick = false;
    function upd() {
      var vis = false, j;
      for (j = 0; j < watch.length; j += 1) if (watch[j].__sv) vis = true;
      b.classList.toggle('is-on', (window.pageYOffset || 0) > window.innerHeight && !vis);
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (en) { en.target.__sv = en.isIntersecting; }); upd(); });
      for (i = 0; i < watch.length; i += 1) io.observe(watch[i]);
    }
    window.addEventListener('scroll', function () {
      if (!tick) { tick = true; requestAnimationFrame(function () { tick = false; upd(); }); }
    }, { passive: true });
  }

  /* ================= WhatsApp: imagem do card (celular) ou texto formatado do WhatsApp =================
     O texto sai dos MESMOS dados dos cards (defs CARDS_* / __shareDefs) e, para formatar os valores,
     do registro /dados/comparacoes.json; nada é digitado à mão. 🔵 = Bolsonaro/Flávio, 🟪 = Lula (como no site);
     ✅ só marca quem fica à frente pela regra do card; contexto e planos 2026 ficam sem ✅. */
  var EMO = { graf: '\uD83D\uDCCA', b: '\uD83D\uDD35', l: '\uD83D\uDFEA', ok: '\u2705', bal: '\u2696\uFE0F', pin: '\uD83D\uDCCC', seta: '\uD83D\uDC49', info: '\u2139\uFE0F' };
  var REG = null;
  function carregarRegistro() {
    if (REG !== null || !window.fetch) return; REG = [];
    fetch('/dados/comparacoes.json').then(function (r) { return r.json(); }).then(function (j) { REG = (j && j.comparacoes) || []; }, function () {});
  }
  function norm(t) { return String(t || '').toLowerCase().replace(/\s*\(.*\)\s*/g, ' ').replace(/\s+/g, ' ').trim(); }
  function regDe(c, def) {
    var a = attr(c, 'anchor'), pg = location.pathname, tema = norm(def && def.tema), i, it, achado = null;
    for (i = 0; REG && i < REG.length; i += 1) {
      it = REG[i]; if (it.pagina !== pg || it.status === 'descontinuado') continue;
      if (a && it.ancora_card === a) return it;
      if (!achado && tema && norm(it.tema_matriz).indexOf(tema) === 0) achado = it;
    }
    return achado;
  }
  var RNUM = /([+\u2212-]?)(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?/;
  function numBR(v, casas) {
    var p = Math.abs(v).toFixed(casas).split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.'); return p.join(',');
  }
  function lerNum(s) {
    var m = RNUM.exec(s || ''); if (!m) return NaN;
    var n = parseFloat(m[2].replace(/\./g, '') + '.' + (m[3] || '0'));
    return (m[1] === '-' || m[1] === '\u2212') ? -n : n;
  }
  function comPadrao(padrao, v) {          /* troca o 1º número do padrão por v, com as mesmas casas e unidade */
    var m = RNUM.exec(padrao || ''); if (!m) return null;
    var casas = m[3] ? m[3].length : 0, sinal = v < 0 ? '\u2212' : (m[1] === '+' ? '+' : '');
    return (padrao.slice(0, m.index) + sinal + numBR(v, casas) + padrao.slice(m.index + m[0].length)).replace(/\s*\(.*\)\s*$/, '');
  }
  function valorTexto(v, padraoReg, padraoCard) {
    if (padraoReg && Math.abs(lerNum(padraoReg) - v) < 1e-9) return padraoReg;
    var p = padraoReg ? comPadrao(padraoReg, v) : null;
    if (!p && padraoCard && /^[^\d]*\d[\d.,]*[^\d]*$/.test(padraoCard)) p = comPadrao(padraoCard, v);
    return p || numBR(v, Math.abs(v - Math.round(v)) < 1e-9 ? 0 : (Math.abs(v * 10 - Math.round(v * 10)) < 1e-9 ? 1 : 2));
  }
  function vencedor(def) {
    if (!def || !def.valores || (def.criterio !== 'menor' && def.criterio !== 'maior')) return null;
    var b = def.valores.b, l = def.valores.l; if (b === l) return null;
    return (def.criterio === 'menor') === (b < l) ? 'b' : 'l';
  }
  function nomes(def, reg) {
    var d = { b: { nome: 'Governo Bolsonaro' }, l: { nome: 'Governo Lula' } };
    return (def && def.lados) || (reg && reg.lados) || d;
  }
  function periodo(reg, k) {
    var p = reg && reg.lados && reg.lados[k] && reg.lados[k].periodo;
    return p ? String(p).replace(/\s*\(média anual\)/, '').replace(/\s*\(([^)]*)\)/g, ' \u00b7 $1').replace(/(\d)-(\d)/g, '$1\u2013$2') : '';
  }
  function pct(n, t, casas) { return t ? numBR(n / t * 100, casas) + '%' : '\u2013'; }
  function cardsIrmaos(def) {
    var k, L; for (k in window) { if (!/^CARDS_/.test(k) || !(window[k] instanceof Array)) continue; L = window[k]; if (L.indexOf(def) >= 0 || L.some(function (x) { return x && x.id === def.id; })) return L; }
    return [];
  }
  /* corpo do texto, por tipo de card */
  function linhasCard(def, reg, L, venc) {
    var g = def.grafico || {}, out = [], i;
    if (g.tipo === 'blocos') {
      (g.grupos || []).forEach(function (gp) {
        out.push('*' + gp.titulo + ':* ' + EMO[gp.vencedor] + ' ' + L[gp.vencedor].nome + ' \u00e0 frente');
        gp.itens.forEach(function (q) { out.push(EMO.ok + ' ' + q.nome + (q.apertada ? ' _(apertada)_' : '')); });
        out.push('');
      });
      (g.contexto || []).forEach(function (q) { out.push(EMO.info + ' ' + q.nome + ': ' + (q.nota || 'contexto, n\u00e3o conta ponto')); });
      if (g.fecho) out.push('*' + g.fecho + '*');
      return out;
    }
    if (g.tipo === 'placarPromessas') { var irm = cardsIrmaos(def).filter(function (x) { return x && x.grafico && x.grafico.tipo === 'pares'; })[0]; if (irm) { def = irm; g = irm.grafico; } }
    if (g.tipo === 'pares') {
      var f = g.formato || {};
      out.push(EMO.b + ' ' + L.b.nome + ' \u00d7 ' + EMO.l + ' ' + L.l.nome);
      (g.grupos || []).forEach(function (gp) {
        var fb = valorTexto(gp.b, null, null), fl = valorTexto(gp.l, null, null);
        if (f.casas != null) { fb = numBR(gp.b, f.casas); fl = numBR(gp.l, f.casas); }
        out.push('\u2022 ' + gp.rotulo + (gp.sub ? ' _(' + gp.sub + ')_' : '') + ': *' + (f.prefixo || '') + fb + (f.sufixo || '') + '* \u00d7 *' + (f.prefixo || '') + fl + (f.sufixo || '') + '*');
      });
      return out;
    }
    if (g.tipo === 'empilhadas' && g.linhas) {
      var cb = g.linhas.b.contagens, cl = g.linhas.l.contagens, cats = g.categorias || [], tb = 0, tl = 0, k;
      for (k in cb) tb += cb[k]; for (k in cl) tl += cl[k];
      out.push(EMO.b + ' ' + L.b.nome + ' \u00d7 ' + EMO.l + ' ' + L.l.nome);
      if (cb.cumprida != null) {             /* promessas: as três leituras, como no site */
        out.push('\u2022 Cumpridas, de todas: *' + pct(cb.cumprida, tb, 0) + '* \u00d7 *' + pct(cl.cumprida, tl, 0) + '* (' + cb.cumprida + ' de ' + tb + ' \u00d7 ' + cl.cumprida + ' de ' + tl + ')');
        out.push('\u2022 S\u00f3 as verific\u00e1veis: *' + pct(cb.cumprida, tb - (cb.sem || 0), 0) + '* \u00d7 *' + pct(cl.cumprida, tl - (cl.sem || 0), 0) + '*');
        out.push('\u2022 Cumpridas + parciais: *' + pct(cb.cumprida + (cb.parcial || 0), tb, 0) + '* \u00d7 *' + pct(cl.cumprida + (cl.parcial || 0), tl, 0) + '*');
        if (cl.andamento || cb.andamento) out.push('\u2022 Em andamento: ' + (cb.andamento || 0) + ' \u00d7 ' + (cl.andamento || 0));
      } else {
        for (i = 0; i < cats.length; i += 1) out.push('\u2022 ' + cats[i].nome + ': *' + (cb[cats[i].id] || 0) + '* \u00d7 *' + (cl[cats[i].id] || 0) + '* de ' + tb);
      }
      return out;
    }
    if (!def.valores && reg && reg.lados && reg.lados.b.valor) {   /* contexto (ex.: Selic): valores do registro, sem ✅ */
      out.push(EMO.b + ' ' + L.b.nome + (periodo(reg, 'b') ? ' (' + periodo(reg, 'b') + ')' : '') + ': *' + reg.lados.b.valor + '*');
      out.push(EMO.l + ' ' + L.l.nome + (periodo(reg, 'l') ? ' (' + periodo(reg, 'l') + ')' : '') + ': *' + reg.lados.l.valor + '*');
    }
    if (def.valores) {
      var mv = def.manchete && def.manchete.valor;
      var vb = valorTexto(def.valores.b, reg && reg.lados.b.valor, mv), vl = valorTexto(def.valores.l, reg && reg.lados.l.valor, mv);
      var pb = periodo(reg, 'b'), pl = periodo(reg, 'l');
      out.push(EMO.b + ' ' + L.b.nome + (pb ? ' (' + pb + ')' : '') + ': *' + vb + '*' + (venc === 'b' ? ' ' + EMO.ok : ''));
      out.push(EMO.l + ' ' + L.l.nome + (pl ? ' (' + pl + ')' : '') + ': *' + vl + '*' + (venc === 'l' ? ' ' + EMO.ok : ''));
    }
    return out;
  }
  function textoWhats(c, m) {
    var def = acharDef(c), reg = def ? regDe(c, def) : null, url = link(c, m || 'whatsapp');
    if (!def) return body(c) + '\n\n' + EMO.seta + ' ' + CTA + ' ' + url;
    var L = nomes(def, reg), venc = vencedor(def), tema = def.tema || def.titulo || '', t = [];
    t.push(EMO.graf + ' *' + (venc ? tema + ': ' + L[venc].nome + ' \u00e0 frente' : (def.titulo || tema)) + '*');
    var crit = def.criterioTexto || (def.criterio === 'menor' ? 'menor \u00e9 melhor' : def.criterio === 'maior' ? 'maior \u00e9 melhor' : '');
    if (crit || def.detalhe) t.push('_' + [crit, def.detalhe].filter(Boolean).join(' \u00b7 ') + '_');
    t.push('');
    t = t.concat(linhasCard(def, reg, L, venc));
    if (t[t.length - 1] !== '') t.push('');
    if (venc && def.forca === 'apertada') t.push(EMO.bal + ' Diferen\u00e7a apertada' + (def.mudaria ? ': ' + def.mudaria : ''));
    else if (venc && def.forca === 'clara') t.push(EMO.bal + ' Diferen\u00e7a clara');
    if (!venc && def.nota && !(def.grafico && def.grafico.tipo === 'blocos')) t.push(EMO.info + ' ' + def.nota);
    t.push(EMO.pin + ' Fonte: ' + (def.fonte || (reg && reg.fonte) || ''));
    t.push('');
    t.push(EMO.seta + ' Veja o gr\u00e1fico e os dados: ' + url);
    t.push('_Bora pros dados Brasil \u00b7 n\u00e3o indica voto_');
    return t.join('\n');
  }
  function textoCurto(c) {
    var linhas = textoWhats(c, 'image').split('\n');
    return linhas[0] + '\n' + EMO.seta + ' ' + link(c, 'image');
  }

  /* pré-gera o PNG (com rodapé) quando o card entra na tela: o Safari só aceita o share no mesmo toque */
  var FILA = [], OCUPADO = false;
  function proximo() {
    if (OCUPADO || !FILA.length) return; OCUPADO = true;
    var sh = FILA.shift(), c = ctx(sh);
    png(c).then(null, function () { return cartaoTexto(c, ref(c)); }).then(function (bl) {
      try { sh.__png = new File([bl], 'bora-pros-dados-' + String(secao(c)).replace(/[^a-z0-9-]/gi, '') + '.png', { type: 'image/png' }); } catch (e) {}
      OCUPADO = false; proximo();
    }, function () { OCUPADO = false; proximo(); });
  }
  function preparar(sh) { if (!IMGWA || !sh || sh.__png || sh.__pngFila) return; sh.__pngFila = 1; FILA.push(sh); proximo(); }
  var IO_WA = null;
  function vigiar(el, sh) {
    if (!IMGWA || !sh) return;
    if (!IO_WA && 'IntersectionObserver' in window) IO_WA = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { IO_WA.unobserve(en.target); preparar(en.target.__waShare); } });
    }, { rootMargin: '200px 0px' });
    el.__waShare = sh; if (IO_WA) IO_WA.observe(el); else preparar(sh);
  }
  function shareDe(el) {      /* o .share (às vezes escondido) do mesmo card/seção guarda texto, âncora e card */
    var box = el.closest && (el.closest('article') || el.closest('section'));
    return box ? box.querySelector('.share[data-share-text]') : null;
  }
  function abrir(u) { var w = null; try { w = window.open(u, '_blank', 'noopener'); } catch (e) {} if (!w) location.href = u; }
  function whatsapp(sh, e, alvo, placement) {
    var c = ctx(sh), sec = secao(c), f = IMGWA && sh.__png;
    if (e) e.stopPropagation();      /* evita share_click/outbound duplicados dos outros ouvintes */
    if (f) {
      if (e) e.preventDefault();
      track('share_click', { method: 'whatsapp_image', section: sec, placement: placement });
      navigator.share({ files: [f], text: textoCurto(c) }).then(function () { track('share_success', { method: 'whatsapp_image', section: sec }); }, function (err) {
        if (err && err.name === 'AbortError') { track('share_cancel', { method: 'whatsapp_image', section: sec }); return; }
        track('share_click', { method: 'whatsapp_text', section: sec, placement: placement }); abrir('https://wa.me/?text=' + E(textoWhats(c)));
      });
      return;
    }
    if (IMGWA) preparar(sh);
    track('share_click', { method: 'whatsapp_text', section: sec, placement: placement });
    var u = 'https://wa.me/?text=' + E(textoWhats(c));
    if (alvo && alvo.tagName === 'A') { alvo.href = u; alvo.target = '_blank'; alvo.rel = 'noopener'; return; }
    if (e) e.preventDefault(); abrir(u);
  }
  /* botões [WhatsApp] montados fora do share.js (BPD.montarCard e ações das páginas): mesmo comportamento */
  function ligarBotoesWa() {
    var bs = document.querySelectorAll('.bpd-btn--wa, .share .share-btn--wa'), i, b, sh;
    for (i = 0; i < bs.length; i += 1) {
      b = bs[i]; if (b.__wa) continue; b.__wa = 1;
      sh = b.closest('.share') || shareDe(b); if (!sh) continue;
      if (IMGWA && !b.closest('.share')) {   /* rótulo do autor (o ui.js respeita): começa pelo texto visível (WCAG 2.5.3) */
        b.textContent = 'Enviar imagem no WhatsApp'; b.removeAttribute('data-a11y-rotulo'); b.removeAttribute('data-a11y-txt');
        b.setAttribute('aria-label', 'Enviar imagem no WhatsApp: ' + attr(sh, 'name', 'este card'));
      }
      vigiar(b, sh);
    }
  }
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('.bpd-btn--wa') : null; if (!a) return;
    var sh = shareDe(a); if (!sh) return;
    whatsapp(sh, e, a, 'card');
  }, true);

  function init(root) {
    var n = (root || document).querySelectorAll('.share'), i; regiao(); carregarRegistro();
    for (i = 0; i < n.length; i += 1) render(n[i]);
    ligarBotoesWa();
  }
  if (window.MutationObserver) {      /* cards montados depois (charts.js) recebem o mesmo WhatsApp */
    var _mo = null;
    new MutationObserver(function () { clearTimeout(_mo); _mo = setTimeout(ligarBotoesWa, 250); }).observe(document.documentElement, { childList: true, subtree: true });
  }
  /* para os blocos de ações das páginas (ex.: /balanco/ e /propostas/), que escondem o .share da seção e mostram botões próprios */
  function copiarDe(sh) {
    var c = ctx(sh), sec = secao(c);
    track('share_click', { method: IMGCLIP ? 'copy_image' : 'copy_text', section: sec, placement: attr(sh, 'placement', 'card') });
    copy(sh, c, sec);
  }
  window.__share = { init: init, copiar: copiarDe, copiaImagem: IMGCLIP, whatsapp: function (el) { var sh = el && (el.closest && el.closest('.share') || shareDe(el)); if (sh) whatsapp(sh, null, null, 'card'); },
    textoWhatsApp: function (el) { var sh = el && (el.matches && el.matches('.share') ? el : shareDe(el)); return sh ? textoWhats(ctx(sh)) : ''; }, imagemWhatsApp: IMGWA };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(); });
  else init();
})();

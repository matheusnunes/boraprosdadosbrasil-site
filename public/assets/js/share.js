/* ==== Bora pros dados Brasil — compartilhamento (share.js) — ES5, sem dependências, ok com a CSP ====
   <div class="share" data-share-section="inflacao" data-share-text="📊 Inflação (IPCA): ..." data-share-name="o dado de inflação"
     [data-share-path="/c/inflacao/" | data-share-anchor="cap-motor"] [data-share-placement="card|capitulo|placar|fim|barra"]
     [data-share-variant="mini|bar"] [data-share-image="/assets/img/share/story-inflacao.jpg"] [data-share-lead="..."]></div>
   section="auto" (barra): herda o .share da seção [data-track-section] em leitura. Eventos: share_click/_success/_cancel. */
(function () {
  var cfg = (typeof window.SITE_CONFIG === 'object' && window.SITE_CONFIG) || {};
  var PAGE = cfg.pageId || 'site';
  var BASE = /^https?:\/\//.test(cfg.siteUrl || '') ? cfg.siteUrl.replace(/\/$/, '') : location.origin;
  var CTA = 'Números, ressalvas e método:';
  var CODE = { whatsapp: 'wa', telegram: 'tg', x: 'x', facebook: 'fb', copy: 'cp', native: 'ns', image: 'img' };
  var NATIVE = typeof navigator.share === 'function';
  var FILES = false, files = {}, E = encodeURIComponent;
  try { FILES = !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.jpg', { type: 'image/jpeg' })] })); } catch (e) {}

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
    whatsapp: function (b) { return 'https://wa.me/?text=' + E(msg(b, 'whatsapp')); },
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

  function render(b) {
    if (b.__share) return; b.__share = 1;
    var v = attr(b, 'variant', 'full'), row = el('div', 'share-row'), pan = el('div', 'share-panel'), what = attr(b, 'name', 'este dado');
    pan.hidden = true;
    if (v === 'full') b.appendChild(el('p', 'share-lead', attr(b, 'lead', 'Mande este dado com a fonte: quem receber pode conferir.')));
    if (v === 'mini') {
      row.appendChild(NATIVE ? btn('native', 'Compartilhar', 'Compartilhar ' + what) :
        btn('more', 'Compartilhar', 'Mostrar opções para compartilhar ' + what));
      pan.appendChild(btn('whatsapp', 'WhatsApp', 'Enviar ' + what + ' pelo WhatsApp', 'share-btn--wa'));
      pan.appendChild(btn('copy', 'Copiar', 'Copiar mensagem com o link'));
    } else {
      row.appendChild(btn('whatsapp', 'WhatsApp', 'Enviar ' + what + ' pelo WhatsApp', 'share-btn--wa'));
      row.appendChild(btn('copy', 'Copiar', 'Copiar mensagem com o link'));
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
    track('share_click', { method: m, section: sec, placement: attr(b, 'placement', attr(b, 'variant', 'full')) });
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
  function copy(b, c, sec) {
    var txt = msg(c, 'copy');
    function ok() { say(b, 'Copiado! Agora é só colar na conversa.'); track('share_success', { method: 'copy', section: sec }); }
    function fb() { if (legacyCopy(txt)) ok(); else say(b, 'Não deu para copiar. Use o botão WhatsApp.'); }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(ok, fb); else fb();
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

  function init(root) { var n = (root || document).querySelectorAll('.share'), i; for (i = 0; i < n.length; i += 1) render(n[i]); }
  window.__share = { init: init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(); });
  else init();
})();

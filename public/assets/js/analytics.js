/* ==== Bora pros dados Brasil — instrumentação de analytics (GA4) ====
   Eventos: page_view (automático), section_view, scroll_depth, file_download,
   outbound_click, nav_click, plano_pagina_aberta, trecho_original_aberto,
   detalhes_abertos, cta_click, page_exit. */
(function () {
  var cfg = (typeof window.SITE_CONFIG === 'object' && window.SITE_CONFIG) || {};
  var GA_OK = typeof cfg.gaId === 'string' && /^G-[A-Z0-9]{6,12}$/.test(cfg.gaId);
  var CONSENT = cfg.consent === 'banner';
  var page = cfg.pageId || (location.pathname || '/');
  var loaded = false, exited = false, lastSection = '', maxDepth = 0, t0 = Date.now();

  function loadGA() {
    if (loaded || !GA_OK) return;
    loaded = true;
    var s = document.createElement('script');
    s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(cfg.gaId);
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', cfg.gaId, { send_page_view: true });
  }
  function ev(name, params) {
    try {
      var p = params || {};
      p.page_id = page;
      if (window.gtag) window.gtag('event', name, p);
      (window.__track_events = window.__track_events || []).push({ name: name, params: p });
    } catch (e) {}
  }
  window.__track = ev;

  /* consentimento (LGPD) — só se cfg.consent = 'banner' */
  function consentUI() {
    var KEY = 'bpb_consent_v1';
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) {}
    if (saved === 'yes') { loadGA(); return; }
    if (saved === 'no') return;
    var bar = document.createElement('div');
    bar.className = 'consent';
    bar.innerHTML = '<span>Usamos cookies de medição (Google Analytics) para entender como o site é usado — de forma agregada e anônima.</span><button class="ok" type="button">Aceitar</button><button class="no" type="button">Recusar</button>';
    document.body.appendChild(bar);
    bar.querySelector('.ok').addEventListener('click', function () { try { localStorage.setItem(KEY, 'yes'); } catch (e) {} bar.remove(); loadGA(); });
    bar.querySelector('.no').addEventListener('click', function () { try { localStorage.setItem(KEY, 'no'); } catch (e) {} bar.remove(); });
  }

  /* profundidade de scroll (25/50/75/90/100) */
  var DEPTHS = [25, 50, 75, 90, 100], dsent = {};
  function depth() {
    var h = document.documentElement, m = h.scrollHeight - h.clientHeight;
    var p = m > 0 ? Math.min(100, Math.round(((h.scrollTop || document.body.scrollTop) / m) * 100)) : 100;
    if (p > maxDepth) maxDepth = p;
    for (var i = 0; i < DEPTHS.length; i += 1) {
      if (p >= DEPTHS[i] && !dsent[DEPTHS[i]]) { dsent[DEPTHS[i]] = 1; ev('scroll_depth', { percent: DEPTHS[i] }); }
    }
  }
  var tick = false;
  window.addEventListener('scroll', function () {
    if (tick) return; tick = true;
    requestAnimationFrame(function () { tick = false; depth(); });
  }, { passive: true });

  /* visualização de seções (prioritário em relação ao scroll %) */
  function observeSections() {
    var secs = Array.prototype.slice.call(document.querySelectorAll('[data-track-section]'));
    if (!secs.length) return;
    var seen = {};
    function fire(el) {
      var id = el.getAttribute('data-track-section');
      if (seen[id]) return; seen[id] = 1;
      lastSection = id;
      ev('section_view', { section: id, section_name: el.getAttribute('data-track-name') || id });
    }
    if ('IntersectionObserver' in window) {
      /* banda de leitura: dispara quando a seção cruza a faixa ~30%–45% da tela
         (seções mais altas que o viewport nunca atingiriam 35% de razão de interseção) */
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) fire(en.target); });
      }, { threshold: 0, rootMargin: '-30% 0px -55% 0px' });
      secs.forEach(function (s) { io.observe(s); });
      /* seções já visíveis no carregamento (acima da dobra) contam na hora */
      setTimeout(function () {
        secs.forEach(function (s) {
          var r = s.getBoundingClientRect();
          if (r.top < window.innerHeight * 0.7 && r.bottom > 0) fire(s);
        });
      }, 900);
      /* fallback: ao alcançar o fim da página, o usuário passou por todas as seções */
      window.addEventListener('scroll', function () {
        var h = document.documentElement, m = h.scrollHeight - h.clientHeight;
        if (m > 0 && (h.scrollTop || document.body.scrollTop) >= m - 4) secs.forEach(fire);
      }, { passive: true });
    }
  }

  /* cliques delegados: downloads, externos, navegação, elementos marcados */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var a = t.closest('a');
    if (a) {
      var dlf = a.getAttribute('data-download');
      if (dlf) {
        ev('file_download', {
          file_name: a.getAttribute('data-file') || '', file_type: a.getAttribute('data-type') || '',
          file_size: a.getAttribute('data-size') || '', file_cat: a.getAttribute('data-cat') || '', link_url: a.href
        });
        return;
      }
      var href = a.getAttribute('href') || '';
      var ext = /^https?:/i.test(href) && a.hostname && a.hostname !== location.hostname;
      if (ext) { ev('outbound_click', { link_domain: a.hostname, link_url: href, link_text: (a.textContent || '').trim().slice(0, 60) }); return; }
      if (a.closest('.sitebar') || a.closest('.sitefoot') || a.closest('.topnav')) {
        ev('nav_click', { target: href.slice(0, 90), label: (a.textContent || '').trim().slice(0, 40) });
      }
      if (a.getAttribute('data-track')) { ev(a.getAttribute('data-track'), { label: (a.getAttribute('data-track-label') || a.textContent || '').trim().slice(0, 60) }); }
      return;
    }
    if (t.closest('.pageref')) { ev('plano_pagina_aberta', { label: (t.closest('.pageref').textContent || '').trim().slice(0, 40) }); return; }
    if (t.closest('.excerpt-btn')) { ev('trecho_original_aberto'); return; }
    if (t.closest('.detail-btn') || t.closest('.cat-det')) { ev('detalhes_abertos'); return; }
    var el = t.closest('[data-track]');
    if (el) { ev(el.getAttribute('data-track'), { label: (el.getAttribute('data-track-label') || el.textContent || '').trim().slice(0, 60) }); }
  });

  /* página de saída (última seção alcançada + tempo + scroll máximo) */
  function onExit() {
    if (exited) return; exited = true;
    ev('page_exit', { last_section: lastSection, seconds_on_page: Math.round((Date.now() - t0) / 1000), scroll_max: maxDepth });
  }
  window.addEventListener('pagehide', onExit);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') onExit(); });

  /* init */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { observeSections(); });
  } else { observeSections(); }
  if (CONSENT) consentUI(); else loadGA();
})();

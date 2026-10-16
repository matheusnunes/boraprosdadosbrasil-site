/* ==== Bora pros dados Brasil — catálogo "Meus dados" (catalogo.js) — ES5, sem dependências, ok com a CSP ====
   Lê o registro único /dados/comparacoes.json e monta:
     <div data-catalogo="lista">   catálogo com filtros, estrela (favoritar) e "Compartilhar minha seleção"
     <div data-catalogo="selecao"> página de chegada do link /c/1-3-5 (também aceita ?ids=1-3-5 e #1-3-5)
   Favoritos: sessionStorage (somem ao fechar a aba). Opção explícita "Lembrar neste aparelho" → localStorage.
   Integração futura (estrela nos cards .vrd das páginas): window.BPDCatalogo.favoritos.{tem,alternar,lista}
   e o evento 'bpd:favoritos' no document (detail: {ids}). Reaproveita BPD.duelo (charts.js) e __share (share.js).
   Eventos GA (via window.__track): favorite_add/_remove, catalog_filter, selection_share_open, selection_share,
   selection_view, selection_save_all, favorites_remember. Todo texto entra via textContent. */
(function () {
  'use strict';
  var URL_REG = '/dados/comparacoes.json';
  var MAX_SEL = 12;                       // limite de itens num link de seleção
  var KEY = 'bpd:meus-dados:v1', KEY_LEMBRAR = 'bpd:meus-dados:lembrar';
  var ORDEM = ['b', 'l'];                 // ordem fixa (cronológica), nunca pela vitória
  var D = document;

  function track(n, p) { try { if (window.__track) window.__track(n, p || {}); } catch (e) {} }
  function el(tag, cls, txt, at) {
    var n = D.createElement(tag), k; if (cls) n.className = cls; if (txt != null) n.textContent = txt;
    if (at) for (k in at) if (at.hasOwnProperty(k)) n.setAttribute(k, at[k]); return n;
  }
  function add(p) { for (var i = 1; i < arguments.length; i += 1) if (arguments[i]) p.appendChild(arguments[i]); return p; }

  /* ------------------------------------------------------------------ favoritos */
  function store(kind) { try { var s = window[kind]; s.setItem('__t', '1'); s.removeItem('__t'); return s; } catch (e) { return null; } }
  var SS = store('sessionStorage'), LS = store('localStorage');
  var mem = [];                           // reserva quando o navegador bloqueia o armazenamento
  function lembrando() { try { return !!LS && LS.getItem(KEY_LEMBRAR) === '1'; } catch (e) { return false; } }
  function onde() { return lembrando() ? LS : SS; }
  function ler() {
    var s = onde(), v; if (!s) return mem.slice();
    try { v = JSON.parse(s.getItem(KEY) || '[]'); } catch (e) { v = []; }
    return (Object.prototype.toString.call(v) === '[object Array]' ? v : []).filter(function (x) { return typeof x === 'number' && x > 0 && x % 1 === 0; });
  }
  function gravar(ids) {
    var s = onde(); mem = ids.slice();
    if (s) try { s.setItem(KEY, JSON.stringify(ids)); } catch (e) {}
    try { D.dispatchEvent(new CustomEvent('bpd:favoritos', { detail: { ids: ids.slice() } })); } catch (e) {}
  }
  var favoritos = {
    lista: ler,
    tem: function (id) { return ler().indexOf(id) >= 0; },
    alternar: function (id) {
      var ids = ler(), i = ids.indexOf(id), on = i < 0;
      if (on) ids.push(id); else ids.splice(i, 1);
      gravar(ids); return on;
    },
    juntar: function (novos) { var ids = ler(); novos.forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); }); gravar(ids); return ids; },
    limpar: function () { gravar([]); },
    lembrar: function (sim) {          // move a lista entre sessionStorage e localStorage
      var ids = ler();
      if (!LS) return false;
      try {
        if (sim) { LS.setItem(KEY_LEMBRAR, '1'); LS.setItem(KEY, JSON.stringify(ids)); if (SS) SS.removeItem(KEY); }
        else { LS.removeItem(KEY_LEMBRAR); LS.removeItem(KEY); if (SS) SS.setItem(KEY, JSON.stringify(ids)); }
      } catch (e) { return false; }
      return true;
    },
    lembrando: lembrando
  };

  /* ----------------------------------------------------------------- ids no link */
  function parseIds(txt) {             // "1-3-5", "1,3,5", "1.3.5" → [1,3,5] (únicos, na ordem)
    var out = [];
    String(txt || '').split(/[^0-9]+/).forEach(function (p) {
      if (!p || p.length > 4) return; var n = parseInt(p, 10);
      if (n > 0 && out.indexOf(n) < 0) out.push(n);
    });
    return out;
  }
  function idsDaUrl() {
    var m = /^\/c\/([0-9][0-9-]*)\/?$/.exec(location.pathname);
    if (m) return parseIds(m[1]);
    var q = /[?&]ids=([0-9,.\-]+)/.exec(location.search); if (q) return parseIds(q[1]);
    var h = /^#([0-9][0-9,.\-]*)$/.exec(location.hash); if (h) return parseIds(h[1]);
    return [];
  }
  function caminhoSelecao(ids) { return '/c/' + ids.slice().sort(function (a, b) { return a - b; }).join('-'); }

  /* ----------------------------------------------------------------- registro */
  var REG = null;
  function carregar(cb) {
    var inl = D.getElementById('bpd-comparacoes');
    if (inl) { try { REG = JSON.parse(inl.textContent); return cb(null, REG); } catch (e) {} }
    var x = new XMLHttpRequest();
    x.open('GET', URL_REG); x.responseType = 'text';
    x.onload = function () { try { if (x.status !== 200) throw 0; REG = JSON.parse(x.responseText); cb(null, REG); } catch (e) { cb(e); } };
    x.onerror = function () { cb(new Error('rede')); };
    x.send();
  }
  function porId(id) { var c = REG.comparacoes, i; for (i = 0; i < c.length; i += 1) if (c[i].id === id) return c[i]; return null; }

  /* ----------------------------------------------------------------- textos */
  var NIVEL_ICONE = { bolso: '◉', servicos: '◎', economia: '○', panorama: '▦' };
  function rotuloResultado(it) {
    if (it.resultado === 'vitoria') {
      var L = it.lados[it.vencedor];
      if (it.pagina_id === 'propostas') return '✓ Diz mais como fazer: ' + L.nome;
      if (it.pagina_id === 'balanco') return '✓ Mais promessas cumpridas: ' + L.nome;
      return '✓ ' + L.nome + ' à frente';
    }
    if (it.resultado === 'contexto') return 'Contexto · não conta ponto';
    if (it.resultado === 'sem-placar') return 'Sem placar · comparação descritiva';
    return 'Não comparável';
  }
  function textoCriterio(it) {
    if (it.resultado !== 'vitoria') return null;
    if (it.criterio === 'menor') return '↓ menor é melhor';
    if (it.criterio === 'maior') return '↑ maior é melhor';
    return it.criterio_texto || null;
  }
  var FORCA = { clara: 'Diferença clara', apertada: 'Diferença apertada', 'depende-da-regua': 'Depende da régua' };
  function periodoCurto(p) { return String(p || '').replace(/\s*\(.*\)\s*$/, ''); }
  function dataBR(iso) { var m = /^(\d{4})-(\d\d)-(\d\d)/.exec(iso || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : iso; }

  /* ----------------------------------------------------------------- card */
  function estrela(it, onChange) {
    var on = favoritos.tem(it.id);
    var b = el('button', 'cat-star', on ? '★' : '☆', {
      type: 'button', 'aria-pressed': on ? 'true' : 'false',
      'aria-label': 'Guardar em Meus dados: ' + it.titulo, title: 'Guardar em Meus dados'
    });
    b.addEventListener('click', function () {
      var agora = favoritos.alternar(it.id);
      b.setAttribute('aria-pressed', agora ? 'true' : 'false'); b.textContent = agora ? '★' : '☆';
      track(agora ? 'favorite_add' : 'favorite_remove', { comparacao_id: it.id, slug: it.slug, total: favoritos.lista().length });
      if (onChange) onChange(it, agora);
    });
    return b;
  }
  function card(it, opt) {
    opt = opt || {};
    var a = el('article', 'cat-card', null, { id: 'cmp-' + it.id, 'data-id': it.id, 'data-res': it.resultado, 'data-win': it.vencedor || 'nenhum' });
    var top = el('div', 'cat-top');
    var tags = el('p', 'cat-tags');
    add(tags, el('span', 'cat-tag', REG.temas[it.tema] || it.tema),
      el('span', 'cat-tag cat-tag--imp', NIVEL_ICONE[it.impacto] + ' ' + REG.impacto_niveis[it.impacto].rotulo, { 'data-impacto': it.impacto }),
      el('span', 'cat-id', '#' + it.id, { title: 'Número permanente desta comparação (usado no link de compartilhar)' }));
    add(top, tags, estrela(it, opt.onStar));
    add(a, top, el('h3', 'cat-q', it.titulo));

    var vals = el('div', 'cat-vals');
    ORDEM.forEach(function (k) {
      var L = it.lados[k], win = it.vencedor === k;
      var v = el('div', 'cat-val cat-val--' + k + (win ? ' is-win' : ''));
      add(v, el('span', 'cat-who', L.nome), el('span', 'cat-per', periodoCurto(L.periodo)),
        el('b', 'cat-num', L.valor), L.detalhe ? el('span', 'cat-det', L.detalhe) : null);
      if (win) v.setAttribute('aria-label', L.nome + ': ' + L.valor + ' (à frente neste critério)');
      vals.appendChild(v);
    });
    a.appendChild(vals);

    var crit = textoCriterio(it);
    var lin = el('p', 'cat-res');
    add(lin, el('span', 'cat-pill cat-pill--' + (it.resultado === 'vitoria' ? it.vencedor : 'neutro'), rotuloResultado(it)),
      crit ? el('span', 'cat-crit', crit) : null,
      it.forca ? el('span', 'cat-forca cat-forca--' + it.forca, FORCA[it.forca]) : null);
    a.appendChild(lin);
    if (it.ressalva) a.appendChild(el('p', 'cat-ress', (it.forca === 'apertada' ? 'O que mudaria o resultado: ' : 'Ressalva: ') + it.ressalva));
    var como = el('p', 'cat-como'); add(como, el('b', null, 'Como chega em você: '), D.createTextNode(it.como_chega)); a.appendChild(como);

    var src = el('div', 'cat-src');
    add(src, el('p', null, 'Fonte: ' + it.fonte + ' · métrica: ' + it.metrica));
    var arq = el('p', 'cat-arq');
    it.arquivos.forEach(function (f, i) {
      if (i) arq.appendChild(D.createTextNode(' · '));
      var nome = f.arquivo.split('/').pop();
      add(arq, el('a', null, nome, { href: f.arquivo, download: '', 'data-download': '', 'data-file': nome, 'data-cat': 'catalogo' }),
        el('span', 'cat-sha', ' SHA-256 ' + f.sha256.slice(0, 10) + '…', { title: f.sha256 }));
    });
    src.appendChild(arq);
    add(src, el('p', null, 'Atualizado em ' + dataBR(it.atualizado_em)));
    a.appendChild(src);

    var acoes = el('div', 'cat-actions');
    acoes.appendChild(el('a', 'cat-link', 'Ver no site, com o método ›', { href: it.pagina + '#' + (it.ancora_card && opt.ancoraCard ? it.ancora_card : it.ancora) }));
    if (it.grafico && window.BPD) {
      var det = el('details', 'cat-graf'), sum = el('summary', null, 'Ver gráfico'), box = el('div', 'cat-graf-box');
      add(det, sum, box);
      det.addEventListener('toggle', function () {
        if (!det.open || box.__ok) return; box.__ok = 1;
        try {
          window.BPD.duelo(box, {
            titulo: it.titulo, criterio: it.resultado === 'vitoria' ? it.criterio : null,
            criterioTexto: it.resultado === 'vitoria' ? null : (it.resultado === 'contexto' ? 'contexto · não conta ponto' : 'comparação sem placar'),
            valores: it.grafico.valores, formato: it.grafico.formato, tabela: false,
            lados: { b: { nome: it.lados.b.nome, curto: it.lados.b.curto, periodo: periodoCurto(it.lados.b.periodo) },
                     l: { nome: it.lados.l.nome, curto: it.lados.l.curto, periodo: periodoCurto(it.lados.l.periodo) } },
            fonte: it.fonte, atualizado: dataBR(it.atualizado_em)
          });
        } catch (e) { box.textContent = 'Não foi possível mostrar o gráfico. Os números estão no cartão acima.'; }
      });
      acoes.appendChild(det);
    }
    a.appendChild(acoes);
    return a;
  }

  /* ----------------------------------------------------------------- contagem neutra */
  function contagem(lista) {
    var c = { b: 0, l: 0, outro: 0, variantes: 0 };
    lista.forEach(function (it) {   // leituras alternativas (variante_de) não contam de novo
      if (it.variante_de && it.variante_de.length) { c.variantes += 1; return; }
      if (it.resultado === 'vitoria') c[it.vencedor] += 1; else c.outro += 1;
    });
    return c;
  }
  function textoContagem(c, total) {
    return total + (total === 1 ? ' comparação' : ' comparações') + ' · à frente: lado Bolsonaro ' + c.b + ' · lado Lula ' + c.l +
      ' · contexto ou sem placar ' + c.outro + (c.variantes ? ' · leituras alternativas (não contam de novo) ' + c.variantes : '');
  }
  function blocoContagem(cls) {
    var p = el('p', 'cat-count ' + (cls || ''), null, { 'aria-live': 'polite' });
    return p;
  }

  /* ----------------------------------------------------------------- avisos (aria-live) */
  var avisoEl = null;
  function avisar(t) { if (!avisoEl) return; avisoEl.textContent = ''; setTimeout(function () { avisoEl.textContent = t; }, 30); }

  /* ----------------------------------------------------------------- compartilhar seleção */
  function textoSelecao(itens) {
    var nomes = itens.map(function (it) { return it.tema_matriz.replace(/\s*\(.*\)$/, ''); }), lista = '', i;
    for (i = 0; i < nomes.length; i += 1) {
      var prox = (lista ? lista + ', ' : '') + nomes[i];
      if (prox.length > 110) { lista += ' e mais ' + (nomes.length - i); break; }
      lista = prox;
    }
    return '📊 Separei ' + itens.length + (itens.length === 1 ? ' comparação' : ' comparações') +
      ' com dados oficiais, cada uma com os números dos dois lados e a fonte: ' + lista + '.';
  }
  function painelCompartilhar(host, ids) {
    host.textContent = '';
    var validos = ids.map(porId).filter(function (it) { return it && it.status === 'ativo'; });
    var vai = validos.slice(0, MAX_SEL);
    if (!vai.length) { host.appendChild(el('p', 'cat-note', 'Toque na estrela ☆ dos cartões para montar sua seleção.')); return; }
    var path = caminhoSelecao(vai.map(function (it) { return it.id; }));
    add(host, el('p', 'cat-note', 'Quem receber vê ' + vai.length + (vai.length === 1 ? ' cartão completo' : ' cartões completos') +
      ' (números dos dois lados, fonte e data) e o link para todas as comparações.'));
    if (validos.length > MAX_SEL) host.appendChild(el('p', 'cat-note cat-note--warn', 'O link leva até ' + MAX_SEL + ' comparações: vão as ' + MAX_SEL + ' primeiras. Tire a estrela de algumas para escolher.'));
    var cfg = window.SITE_CONFIG || {}, base = /^https?:\/\//.test(cfg.siteUrl || '') ? cfg.siteUrl.replace(/\/$/, '') : location.origin;
    var prev = el('p', 'cat-linkprev'); add(prev, el('span', null, 'Link: '), el('code', null, base.replace(/^https?:\/\//, '') + path));
    host.appendChild(prev);
    var sh = el('div', 'share', null, {
      'data-share-section': 'selecao', 'data-share-placement': 'selecao', 'data-share-path': path,
      'data-share-name': 'sua seleção', 'data-share-text': textoSelecao(vai),
      'data-share-lead': 'Mande a seleção com as fontes: quem receber pode conferir.'
    });
    host.appendChild(sh);
    // captura: roda antes do stopPropagation do share.js
    sh.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-m]') : null;
      if (!t || t.getAttribute('data-m') === 'more') return;
      track('selection_share', { ids: path.slice(3), count: vai.length, method: t.getAttribute('data-m') });
    }, true);
    if (window.__share) window.__share.init(host);
    else host.appendChild(el('p', 'cat-note', path));
  }

  /* ================================================================== CATÁLOGO */
  var FILTROS = ['tema', 'impacto', 'pagina', 'forca'];
  function lerEstado() {
    var e = { meus: false }, q = location.search.replace(/^\?/, '').split('&');
    q.forEach(function (kv) {
      var p = kv.split('='), k = decodeURIComponent(p[0] || ''), v = decodeURIComponent((p[1] || '').replace(/\+/g, ' '));
      if (FILTROS.indexOf(k) >= 0 && /^[a-z0-9-]{1,30}$/.test(v)) e[k] = v;
      if (k === 'meus' && v === '1') e.meus = true;
    });
    return e;
  }
  function gravarEstado(e) {
    var q = [];
    FILTROS.forEach(function (k) { if (e[k]) q.push(k + '=' + encodeURIComponent(e[k])); });
    if (e.meus) q.push('meus=1');
    try { history.replaceState(null, '', location.pathname + (q.length ? '?' + q.join('&') : '') + location.hash); } catch (x) {}
  }

  function iniciarCatalogo(root) {
    root.textContent = '';
    var est = lerEstado();
    var todos = REG.comparacoes.filter(function (it) { return it.status === 'ativo' && it.catalogo; });
    avisoEl = el('p', 'cat-sr', '', { role: 'status', 'aria-live': 'polite' });

    /* filtros: selects nativos (acessíveis, compactos no celular) + chip "Só meus dados" */
    var fbox = el('div', 'cat-filters', null, { role: 'group', 'aria-label': 'Filtrar comparações' });
    function sel(nome, rotulo, opcoes) {
      var w = el('label', 'cat-f'); w.appendChild(el('span', null, rotulo));
      var s = el('select', null, null, { name: nome });
      s.appendChild(el('option', null, 'Todos', { value: '' }));
      opcoes.forEach(function (o) { s.appendChild(el('option', null, o[1], { value: o[0] })); });
      s.value = est[nome] || '';
      if (s.value !== (est[nome] || '')) est[nome] = '';
      s.addEventListener('change', function () { est[nome] = s.value; aplicar(); track('catalog_filter', { filtro: nome, valor: s.value || 'todos' }); });
      w.appendChild(s); fbox.appendChild(w); return s;
    }
    var usados = function (campo) { var u = {}; todos.forEach(function (it) { u[it[campo]] = 1; }); return u; };
    var ut = usados('tema');
    var sImp = sel('impacto', 'Como chega em você', Object.keys(REG.impacto_niveis).sort(function (a, b) { return REG.impacto_niveis[a].ordem - REG.impacto_niveis[b].ordem; })
      .map(function (k) { return [k, REG.impacto_niveis[k].rotulo]; }));
    var sTema = sel('tema', 'Tema', Object.keys(REG.temas).filter(function (k) { return ut[k]; }).map(function (k) { return [k, REG.temas[k]]; }));
    var sPag = sel('pagina', 'Análise', Object.keys(REG.paginas).map(function (k) { return [REG.paginas[k].id, REG.paginas[k].nome]; }));
    var sFor = sel('forca', 'Diferença', [['clara', 'Clara'], ['apertada', 'Apertada'], ['depende-da-regua', 'Depende da régua']]);
    var meus = el('button', 'cat-chip', '', { type: 'button', 'aria-pressed': est.meus ? 'true' : 'false' });
    meus.addEventListener('click', function () { est.meus = !est.meus; aplicar(); track('catalog_filter', { filtro: 'meus', valor: est.meus ? '1' : '0' }); });
    var limpar = el('button', 'cat-clear', 'Limpar filtros', { type: 'button' });
    limpar.addEventListener('click', function () { FILTROS.forEach(function (k) { est[k] = ''; }); est.meus = false; sImp.value = sTema.value = sPag.value = sFor.value = ''; aplicar(); });
    add(fbox, meus, limpar);

    var nivelNota = el('p', 'cat-note cat-imp-nota');
    var cont = blocoContagem();
    var lista = el('div', 'cat-list');
    var vazio = el('div', 'cat-empty', null, { hidden: '' });
    add(vazio, el('p', null, 'Nenhuma comparação com esses filtros.'));
    var vlimpar = el('button', 'cat-clear', 'Limpar filtros', { type: 'button' }); vlimpar.addEventListener('click', function () { limpar.click(); });
    vazio.appendChild(vlimpar);

    /* barra "Meus dados" + compartilhar */
    var bar = el('div', 'cat-bar', null, { role: 'region', 'aria-label': 'Meus dados' });
    var bMeus = el('button', 'cat-bar-meus', '', { type: 'button', 'aria-controls': 'cat-lista' });
    var bShare = el('button', 'cat-bar-share', 'Compartilhar minha seleção', { type: 'button', 'aria-expanded': 'false', 'aria-controls': 'cat-share' });
    var painel = el('section', 'cat-share', null, { id: 'cat-share', hidden: '', 'aria-label': 'Compartilhar minha seleção' });
    var painelIn = el('div', 'cat-share-in');
    var lembrar = el('label', 'cat-lembrar');
    var cb = el('input', null, null, { type: 'checkbox' }); cb.checked = favoritos.lembrando();
    if (!LS) cb.disabled = true;
    add(lembrar, cb, el('span', null, 'Lembrar meus dados neste aparelho (senão, somem ao fechar a aba)'));
    cb.addEventListener('change', function () {
      favoritos.lembrar(cb.checked); track('favorites_remember', { valor: cb.checked ? '1' : '0' });
      avisar(cb.checked ? 'Seus dados ficam guardados neste aparelho até você desmarcar.' : 'Seus dados ficam só nesta aba.');
    });
    var bLimparFav = el('button', 'cat-clear', 'Tirar todas as estrelas', { type: 'button' });
    bLimparFav.addEventListener('click', function () { favoritos.limpar(); aplicar(); avisar('Meus dados esvaziado.'); });
    var fecha = el('button', 'cat-close', 'Fechar', { type: 'button' });
    fecha.addEventListener('click', function () { abrir(false); bShare.focus(); });
    var tituloPainel = el('h2', null, 'Compartilhar minha seleção', { tabindex: '-1' });
    add(painel, add(el('div', 'cat-share-hd'), tituloPainel, fecha), painelIn, lembrar, bLimparFav);
    function abrir(sim) {
      painel.hidden = !sim; bShare.setAttribute('aria-expanded', sim ? 'true' : 'false');
      if (!sim) return;
      painelCompartilhar(painelIn, favoritos.lista());
      track('selection_share_open', { count: favoritos.lista().length });
      tituloPainel.focus();
    }
    bShare.addEventListener('click', function () { abrir(painel.hidden); });
    bMeus.addEventListener('click', function () { est.meus = !est.meus; aplicar(); });
    add(bar, bMeus, bShare);

    lista.id = 'cat-lista';
    add(root, avisoEl, fbox, nivelNota, cont, lista, vazio, painel, bar);

    function onStar(it, on) {
      var n = favoritos.lista().length;
      avisar((on ? 'Guardado em Meus dados: ' : 'Retirado de Meus dados: ') + it.titulo + '. Total: ' + n + '.');
      atualizarBarra();
      if (est.meus && !on) aplicar();
      if (!painel.hidden) painelCompartilhar(painelIn, favoritos.lista());
    }
    function atualizarBarra() {
      var n = favoritos.lista().length;
      bMeus.textContent = 'Meus dados (' + n + ')';
      bMeus.setAttribute('aria-pressed', est.meus ? 'true' : 'false');
      meus.textContent = '★ Só meus dados (' + n + ')';
      meus.setAttribute('aria-pressed', est.meus ? 'true' : 'false');
      bShare.disabled = n === 0;
      bShare.textContent = n ? 'Compartilhar minha seleção (' + n + ')' : 'Marque ☆ para compartilhar';
    }
    function aplicar() {
      var fav = favoritos.lista();
      var vis = todos.filter(function (it) {
        if (est.tema && it.tema !== est.tema) return false;
        if (est.impacto && it.impacto !== est.impacto) return false;
        if (est.pagina && it.pagina_id !== est.pagina) return false;
        if (est.forca && it.forca !== est.forca) return false;
        if (est.meus && fav.indexOf(it.id) < 0) return false;
        return true;
      });  // ordem = ordem do registro (a ordem de leitura do site), nunca por vencedor ou nível
      lista.textContent = '';
      vis.forEach(function (it) { lista.appendChild(card(it, { onStar: onStar })); });
      vazio.hidden = vis.length > 0;
      cont.textContent = 'Nesta lista: ' + textoContagem(contagem(vis), vis.length) + '.';
      var nv = est.impacto && REG.impacto_niveis[est.impacto];
      nivelNota.textContent = (nv ? nv.rotulo + ': ' + nv.regra + ' ' : '') +
        'O nível mostra por onde o dado chega até você, não a importância: dívida e juros também chegam ao bolso, só que mais devagar.';
      limpar.hidden = !(FILTROS.some(function (k) { return est[k]; }) || est.meus);
      atualizarBarra(); gravarEstado(est);
    }
    D.addEventListener('bpd:favoritos', function () { atualizarBarra(); });
    aplicar();
  }

  /* ================================================================== SELEÇÃO (/c/1-3-5) */
  function iniciarSelecao(root) {
    root.textContent = '';
    avisoEl = el('p', 'cat-sr', '', { role: 'status', 'aria-live': 'polite' });
    var pedidos = idsDaUrl(), excesso = pedidos.length > MAX_SEL;
    pedidos = pedidos.slice(0, MAX_SEL);
    var achados = [], invalidos = [], retirados = [];
    pedidos.forEach(function (id) {
      var it = porId(id);
      if (!it) invalidos.push(id);
      else if (it.status !== 'ativo') retirados.push(it);
      else achados.push(it);
    });
    var hd = el('header', 'sel-hd');
    var n = achados.length;
    add(hd, el('p', 'eyebrow', 'Seleção compartilhada'),
      el('h1', null, n ? 'Separaram ' + n + (n === 1 ? ' comparação' : ' comparações') + ' para você' : 'Este link não traz comparações válidas'),
      el('p', 'sel-sub', 'Cada cartão mostra os números dos dois lados, quem fica à frente pelo critério declarado, a fonte oficial, o arquivo original e a data. A escolha dos itens foi feita por quem mandou o link.'));
    var ctx = el('div', 'sel-ctx');
    var todos = REG.comparacoes.filter(function (it) { return it.status === 'ativo' && it.catalogo; });
    add(ctx, el('p', null, 'Nesta seleção: ' + textoContagem(contagem(achados), n) + '.'),
      el('p', null, 'No site inteiro: ' + textoContagem(contagem(todos), todos.length) + '. '),
      el('a', 'cat-link', 'Ver todas as comparações, dos dois lados ›', { href: '/meus-dados/' }));
    add(root, avisoEl, hd, ctx);
    if (invalidos.length || retirados.length || excesso) {
      var av = el('div', 'sel-aviso');
      if (invalidos.length) av.appendChild(el('p', null, 'Não encontramos ' + (invalidos.length === 1 ? 'o número ' : 'os números ') + invalidos.join(', ') + ' (link incompleto ou digitado errado).'));
      retirados.forEach(function (it) {
        var p = el('p', null, 'A comparação #' + it.id + ' (' + it.titulo + ') saiu do site' + (it.substituido_por ? '; veja a versão atual: ' : '.'));
        if (it.substituido_por) p.appendChild(el('a', null, '#' + it.substituido_por, { href: '/c/' + it.substituido_por }));
        av.appendChild(p);
      });
      if (excesso) av.appendChild(el('p', null, 'O link tinha mais de ' + MAX_SEL + ' itens: mostramos os ' + MAX_SEL + ' primeiros.'));
      root.appendChild(av);
    }
    var lista = el('div', 'cat-list');
    achados.forEach(function (it) { lista.appendChild(card(it, { onStar: function (x, on) { avisar((on ? 'Guardado em Meus dados: ' : 'Retirado de Meus dados: ') + x.titulo); } })); });
    root.appendChild(lista);
    var pe = el('div', 'sel-acoes');
    if (n) {
      var bAll = el('button', 'cat-bar-share', 'Guardar estes ' + n + ' em Meus dados', { type: 'button' });
      bAll.addEventListener('click', function () {
        favoritos.juntar(achados.map(function (it) { return it.id; }));
        track('selection_save_all', { ids: achados.map(function (it) { return it.id; }).join('-'), count: n });
        var stars = root.querySelectorAll('.cat-star'), i; for (i = 0; i < stars.length; i += 1) { stars[i].setAttribute('aria-pressed', 'true'); stars[i].textContent = '★'; }
        avisar('Guardados em Meus dados. Agora você pode juntar outros e mandar adiante.');
        bAll.textContent = 'Guardados ✓ · Abrir Meus dados';
        bAll.onclick = function () { location.href = '/meus-dados/?meus=1'; };
      });
      pe.appendChild(bAll);
    }
    pe.appendChild(el('a', 'cat-link', 'Ver todas as comparações ›', { href: '/meus-dados/' }));
    root.appendChild(pe);
    var o = (/[?&]utm_source=([a-z]+)/.exec(location.search) || [])[1] || 'link';
    track('selection_view', { ids: achados.map(function (it) { return it.id; }).join('-'), count: n, invalid_count: invalidos.length + retirados.length, origem: o });
  }

  /* ----------------------------------------------------------------- boot */
  function boot() {
    var roots = D.querySelectorAll('[data-catalogo]'); if (!roots.length) return;
    carregar(function (err) {
      var i;
      for (i = 0; i < roots.length; i += 1) {
        var r = roots[i];
        if (err || !REG) { r.textContent = 'Não foi possível carregar as comparações. Tente de novo ou veja as páginas de análise.'; continue; }
        if (r.getAttribute('data-catalogo') === 'selecao') iniciarSelecao(r); else iniciarCatalogo(r);
        r.setAttribute('data-pronto', '1');
      }
    });
  }
  window.BPDCatalogo = { favoritos: favoritos, parseIds: parseIds, caminhoSelecao: caminhoSelecao, card: card, MAX_SEL: MAX_SEL };
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot); else boot();
})();

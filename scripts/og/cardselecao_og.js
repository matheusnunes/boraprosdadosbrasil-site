  /* cardSelecao no formato 'og' (1200×630, prévia de link): grade de 2 colunas com até 8 duelos compactos,
     mesma regra do feed (ordem fixa Bolsonaro → Lula, selo "✓ à frente" igual para os dois, "apertada" vazado),
     título neutro, rodapé pequeno com fonte/URL/data. */
  function cardSelecaoOG(cont, o) {
    var F = FORMATOS.og, W = F.W, H = F.H, P = F.P || 40, T = TEMAS.light, C = CLARO;
    var todos = o.itens || [], itens = todos.slice(0, 8), resto = todos.length - itens.length + (o.resto || 0);
    var vencDe = function (it) { return it.criterio && it.valores ? vencedor({ criterio: it.criterio, valores: it.valores, vencedor: it.vencedor, titulo: it.tema }) : (it.vencedor || null); };
    var svg = el('svg', { xmlns: NS, width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'font-family': FONTE });
    svg.style.display = 'block'; svg.style.width = '100%'; svg.style.height = 'auto';
    var titulo = o.titulo || 'Comparações escolhidas, com dados oficiais';
    var tt = el('title', null, svg); tt.textContent = titulo;
    var dd = el('desc', null, svg);
    el('rect', { x: 0, y: 0, width: W, height: H, fill: C.fundo }, svg);
    var g = el('g', null, svg), y = P, wU = W - 2 * P;
    // logo oficial no topo (v0.3.9: logoNoSvg); sem logo carregada, o nome em texto
    var hLogo = 34, temLogo = logoNoSvg(svg, g, P, y - 4, hLogo);
    if (!temLogo) cardTexto(g, P, y + 14, 'BORA PROS DADOS BRASIL', 15, 800, C.muted, 'start', 1.5);
    var topo = temLogo ? hLogo + 4 : 14;
    var ts = 32; while (ts > 22 && largura(titulo, ts, 800) > wU) ts -= 1;
    cardTexto(g, P, y + topo + 12 + ts, titulo, ts, 800, C.ink);
    y += topo + 12 + ts + 6;
    if (o.sub) { cardTexto(g, P, y + 18, o.sub, 16, 400, C.ink2); y += 26; }
    y += 10;
    // rodapé
    var pe = [];
    (o.rodape || []).forEach(function (t, i) { quebra(t, 14, i === 0 ? 700 : 400, wU).forEach(function (ln) { pe.push([ln, 14, i === 0 ? 700 : 400, i === 0 ? C.ink2 : C.muted]); }); });
    pe.push([(o.url || SITE) + (o.atualizado ? ' · atualizado em ' + o.atualizado : '') + (resto > 0 ? ' · e mais ' + resto + ' no link' : ''), 15, 700, C.ink2]);
    var altPe = pe.reduce(function (s, l) { return s + l[1] * 1.4; }, 0);
    var yPe = H - P + 6 - altPe;
    // grade
    var cols = itens.length > 1 ? 2 : 1, linhas = Math.ceil(itens.length / cols) || 1, gap = 28;
    var cw = (wU - (cols - 1) * gap) / cols, rh = Math.min(170, (yPe - 12 - y) / linhas);
    var bh = Math.max(9, Math.min(16, (rh - 30 - 2 * 24) / 2 + 6));
    var nomeW = 0;
    itens.forEach(function (it) { var L = lados(it); ORDEM.forEach(function (k) { nomeW = Math.max(nomeW, largura(L[k].curto, 15, 600)); }); });
    nomeW += 24;
    var seloTxt = '✓ à frente', sw = largura(seloTxt, 13, 700) + 14, sh = 20, aw = largura('apertada', 12, 700) + 14;
    itens.forEach(function (it, idx) {
      var f = fmtFn(it.formato), L = lados(it), v = vencDe(it);
      var x0 = P + (idx % cols) * (cw + gap), y0 = y + Math.floor(idx / cols) * rh;
      el('line', { x1: x0, x2: x0 + cw, y1: y0, y2: y0, stroke: C.grid, 'stroke-width': 1.5 }, g);
      var crit = it.criterioTexto || '';
      var reserva = largura(crit, 12, 600) + 10 + (it.apertada ? aw + 6 : 0), tam = 19;
      while (tam > 13 && largura(it.tema, tam, 800) + reserva > cw) tam -= 1;
      if (largura(it.tema, tam, 800) + reserva > cw) { crit = ''; reserva = it.apertada ? aw + 6 : 0; }
      cardTexto(g, x0, y0 + 24, it.tema, tam, 800, C.ink);
      var xr = x0 + cw;
      if (it.apertada) {
        el('rect', { x: xr - aw, y: y0 + 9, width: aw, height: 20, rx: 10, fill: '#ffffff', stroke: C.ink2, 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }, g);
        cardTexto(g, xr - aw / 2, y0 + 23, 'apertada', 12, 700, C.ink2, 'middle'); xr -= aw + 6;
      }
      if (crit) cardTexto(g, xr, y0 + 23, crit, 12, 600, C.muted, 'end');
      var vals = ORDEM.map(function (k) { return it.valores[k]; });
      var lo = Math.min(0, Math.min.apply(null, vals)), hi = Math.max(0, Math.max.apply(null, vals));
      var labW = Math.max.apply(null, vals.map(function (x) { return largura(f(x), 17, 800); })) + 8 + sw + 6;
      var pl = x0 + nomeW + (lo < 0 ? labW * 0.55 : 0), pr = x0 + cw - (hi > 0 ? labW : 0);
      var X = function (x) { return pl + (x - lo) / ((hi - lo) || 1) * (pr - pl); };
      var yy = y0 + 36;
      ORDEM.forEach(function (k) {
        var val = it.valores[k], xa = X(0), xb = X(val);
        if (Math.abs(xb - xa) < 2) xb = xa + (val < 0 ? -2 : 2);
        marca(g, k, x0 + 6, yy + bh / 2, 11, T);
        cardTexto(g, x0 + 16, yy + bh / 2 + 5, L[k].curto, 15, 600, C.ink2);
        barra(g, Math.min(xa, xb), Math.max(xa, xb), yy, bh, T[k]);
        var tx = val < 0 ? Math.min(xa, xb) - 6 : xb + 6, vt = f(val);
        cardTexto(g, tx, yy + bh / 2 + 6, vt, 17, 800, C.ink, val < 0 ? 'end' : 'start');
        if (v === k) {
          var sx = val < 0 ? xa + 6 : tx + largura(vt, 17, 800) + 6;
          el('rect', { x: sx, y: yy + bh / 2 - sh / 2, width: sw, height: sh, rx: sh / 2, fill: T[k] }, g);
          cardTexto(g, sx + sw / 2, yy + bh / 2 + 4.5, seloTxt, 13, 700, '#ffffff', 'middle');
        }
        if (lo < 0) el('line', { x1: X(0), x2: X(0), y1: yy - 3, y2: yy + bh + 3, stroke: C.ink2, 'stroke-width': 1.5 }, g);
        yy += Math.max(bh, 18) + 8;
      });
    });
    pe.forEach(function (l) { yPe += l[1] * 1.4; cardTexto(g, P, yPe - 3, l[0], l[1], l[2], l[3]); });
    dd.textContent = itens.map(function (it) {
      var f = fmtFn(it.formato), L = lados(it), v = vencDe(it);
      return it.tema + ': ' + L.b.curto + ' ' + f(it.valores.b) + ', ' + L.l.curto + ' ' + f(it.valores.l) + (v ? ' (' + L[v].curto + ' à frente)' : '');
    }).join('. ') + '. ' + (o.rodape || []).join(' ');
    while (cont.firstChild) cont.removeChild(cont.firstChild);
    cont.appendChild(svg);
    return svg;
  }

/* Prévia de link (Open Graph) das seleções /c/1-3-5 — Netlify Edge Function.
 * Só reescreve as METAS da página estática /c/index.html (servida pelo rewrite do netlify.toml): og:title com os temas,
 * og:description com os números dos dois lados de cada item, og:image = imagem pré-gerada do 1º item (/og/c/<id>.jpg).
 * Não gera imagem, não chama nada externo: lê um JSON compacto gerado pelo build (netlify/dados-og/selecao.json).
 * Comparação única (/c/7/, /c/inflacao/) e qualquer outro caminho passam direto (páginas estáticas com prévia própria).
 * Em qualquer erro, devolve a página original sem mudança. Custo: conta como a requisição web que já existiria. */
import dados from '../dados-og/selecao.json' with { type: 'json' };

const SELECAO = /^\/c\/(\d{1,4}(?:-\d{1,4})+)\/?$/;
const MAX = 12;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function troca(html, attr, chave, valor) {
  const rx = new RegExp(`(<meta ${attr}="${chave.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" content=")[^"]*(">)`);
  return rx.test(html) ? html.replace(rx, `$1${esc(valor)}$2`) : html.replace('</head>', `<meta ${attr}="${chave}" content="${esc(valor)}">\n</head>`);
}

export default async (request, context) => {
  const m = SELECAO.exec(new URL(request.url).pathname);
  if (!m) return;                                   // não é seleção de vários itens: segue o fluxo normal
  const ids = [...new Set(m[1].split('-').map(Number))].filter((i) => dados.itens[String(i)]).sort((a, b) => a - b).slice(0, MAX);
  if (ids.length < 2) return;
  const resp = await context.next();
  try {
    if (!(resp.headers.get('content-type') || '').includes('text/html')) return resp;
    const itens = ids.map((i) => dados.itens[String(i)]);
    const temas = itens.slice(0, 3).map((x) => x.t).join(', ') + (itens.length > 3 ? ` e mais ${itens.length - 3}` : '');
    const titulo = `${itens.length} comparações: ${temas}`;
    const desc = itens.slice(0, 4).map((x) => `${x.t} ${x.v}`).join(' · ') + (itens.length > 4 ? ` · e mais ${itens.length - 4}` : '') +
      ' (Bolsonaro × Lula). Fontes oficiais; seleção feita por quem enviou o link.';
    const img = dados.base + ((itens.find((x) => x.img) || {}).img || dados.padrao);
    let html = await resp.clone().text();
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(titulo)} | Bora pros dados Brasil</title>`);
    html = troca(html, 'name', 'description', desc);
    html = troca(html, 'property', 'og:title', titulo);
    html = troca(html, 'property', 'og:description', desc);
    html = troca(html, 'property', 'og:image', img);
    html = troca(html, 'property', 'og:image:alt', `${titulo}. ${desc}`);
    html = troca(html, 'name', 'twitter:title', titulo);
    html = troca(html, 'name', 'twitter:description', desc);
    html = troca(html, 'name', 'twitter:image', img);
    const h = new Headers(resp.headers);
    h.delete('content-length');
    return new Response(html, { status: resp.status, headers: h });
  } catch (e) {
    return resp;
  }
};

export const config = { path: '/c/*' };

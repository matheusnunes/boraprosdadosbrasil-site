#!/usr/bin/env python3
"""Build do site "Bora pros dados Brasil".
Lê o .env (variáveis de ambiente têm prioridade), gera dist/ a partir de public/
com os tokens substituídos (__SITE_URL__, __GA_ID__, __CONSENT__ e as datas
__DATE_PUBLISHED__/__DATE_MODIFIED__ de cada página, tiradas do git; e
__UPDATED__/__UPDATED_ISO__ = data do último commit, para o "atualizado em"), e ainda:
  - gera sitemap.xml (lastmod real, do git) e dados/SHA256SUMS.txt;
  - SEO/IA: pré-renderiza no HTML os catálogos que hoje só aparecem via JS
    (/propostas/ e /balanco/), externaliza a biblioteca ECharts da home para um
    arquivo em cache, injeta o JSON-LD Dataset/DataCatalog de /fontes/ e gera
    llms-full.txt (texto integral das páginas + catálogos, para buscadores de IA);
  - opcional: meta de verificação do Google/Bing e arquivo de chave do IndexNow;
  - valida os links internos e a sintaxe dos JSON-LD.
Sem dependências externas."""
import datetime, hashlib, html, json, os, re, shutil, subprocess, sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUB, DIST = ROOT / 'public', ROOT / 'dist'
TOKENS = ('__SITE_URL__', '__GA_ID__', '__CONSENT__', '__DATE_PUBLISHED__', '__DATE_MODIFIED__', '__UPDATED__')
ENV_KEYS = ('SITE_URL', 'GA_MEASUREMENT_ID', 'CONSENT_MODE', 'GOOGLE_SITE_VERIFICATION',
            'BING_SITE_VERIFICATION', 'INDEXNOW_KEY', 'PRERENDER')

# páginas do site: (url, arquivo-fonte, título curto usado no llms-full.txt)
PAGES = [
    ('/', 'index.html', 'Governo Bolsonaro (2019-2022) × Governo Lula (2023-2026): comparativo em dados oficiais'),
    ('/propostas/', 'propostas/index.html', 'Propostas 2026: Lula × Flávio Bolsonaro (planos de governo registrados no TSE, 2º turno)'),
    ('/balanco/', 'balanco/index.html', 'Promessas e realizações: planos de Bolsonaro (2018) e Lula (2022) × o que foi cumprido'),
    ('/fontes/', 'fontes/index.html', 'Fontes e dados: os 50 arquivos originais'),
    ('/sobre/', 'sobre/index.html', 'Sobre e método: quem fez, as regras e como reportar um erro'),
]


def load_env():
    env = {}
    f = ROOT / '.env'
    if f.exists():
        for line in f.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                env[k.strip()] = v.strip()
    # variáveis de ambiente têm prioridade sobre o .env (ex.: build no Netlify/CI)
    for k in ENV_KEYS:
        if os.environ.get(k):
            env[k] = os.environ[k]
    # no Netlify, URL é definida automaticamente com o endereço principal do site
    if not env.get('SITE_URL') and os.environ.get('URL'):
        env['SITE_URL'] = os.environ['URL']
    return env


def sha256(p):
    h = hashlib.sha256()
    with open(p, 'rb') as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


# ---------------------------------------------------------------- datas (git)
def _git(*args):
    try:
        r = subprocess.run(['git', *args], cwd=ROOT, capture_output=True, text=True, timeout=20)
        return r.stdout.strip() if r.returncode == 0 else ''
    except Exception:
        return ''


def page_dates(src):
    """(publicado, modificado) em ISO 8601. Publicado = 1º commit do arquivo;
    modificado = último commit, ou o mtime se houver alteração ainda não commitada."""
    rel = str(src.relative_to(ROOT))
    mtime = datetime.datetime.fromtimestamp(src.stat().st_mtime).astimezone().replace(microsecond=0).isoformat()
    hist = _git('log', '--follow', '--format=%aI', '--', rel).splitlines()
    if not hist:
        return mtime, mtime
    published, modified = hist[-1], hist[0]
    if _git('status', '--porcelain', '--', rel):
        modified = mtime
    return published, modified


# ------------------------------------------------- texto visível (llms-full.txt)
class TextExtractor(HTMLParser):
    """HTML -> texto com marcação Markdown leve (títulos, listas, tabelas).
    Ignora scripts/estilos, cabeçalho/menu/rodapé e modais."""
    SKIP_TAGS = {'script', 'style', 'template', 'noscript', 'svg', 'nav', 'footer', 'select', 'button'}
    BLOCK = {'p', 'div', 'section', 'li', 'tr', 'table', 'ul', 'ol', 'br', 'dt', 'dd', 'figcaption', 'caption', 'h1', 'h2', 'h3', 'h4', 'h5'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self.skip_stack = [], []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if self.skip_stack:
            if tag == self.skip_stack[-1][0]:
                self.skip_stack[-1][1] += 1
            return
        cls = a.get('class') or ''
        if (tag in self.SKIP_TAGS or (tag == 'header' and 'sitebar' in cls.split())
                or (tag == 'div' and re.search(r'\bmodal\b', cls)) or 'filters' in cls.split()):
            if tag not in ('br',):
                self.skip_stack.append([tag, 1])
            return
        if tag in self.BLOCK:
            self.out.append('\n')
        if tag in ('h1', 'h2', 'h3', 'h4', 'h5'):
            self.out.append('#' * int(tag[1]) + ' ')
        elif tag == 'li':
            self.out.append('- ')
        elif tag in ('td', 'th'):
            self.out.append(' | ')

    def handle_endtag(self, tag):
        if self.skip_stack:
            if tag == self.skip_stack[-1][0]:
                self.skip_stack[-1][1] -= 1
                if self.skip_stack[-1][1] == 0:
                    self.skip_stack.pop()
            return
        if tag in self.BLOCK:
            self.out.append('\n')

    def handle_data(self, d):
        if not self.skip_stack:
            self.out.append(d)

    def text(self):
        lines = (' '.join(l.split()) for l in ''.join(self.out).splitlines())
        txt = '\n'.join(l for l in lines if l and l != '|')
        return re.sub(r'\n(#+ )', r'\n\n\1', txt).strip()


def visible_text(page_html):
    body = page_html[page_html.find('<body'):] if '<body' in page_html else page_html
    p = TextExtractor()
    p.feed(body)
    return p.text()


# ----------------------------------------------------------- dados embutidos
def embedded_json(page_html, elem_id):
    m = re.search(r'<script id="%s" type="application/json">(.*?)</script>' % re.escape(elem_id), page_html, re.S)
    return json.loads(m.group(1)) if m else None


esc = lambda s: html.escape(str(s), quote=False)

# rótulos (os mesmos do JS das páginas)
PROP_CAND = {'lula': ('Lula', 'lula', 'Lula (PT)'), 'flavio': ('Flávio', 'flavio', 'Flávio Bolsonaro (PL)')}
PROP_ROT = {'ok': ('ferramenta nomeada', 'chip-ok'), 'mid': ('parcial', 'chip-partial'), 'no': ('só intenção', 'chip-warn')}
PROP_TEMA = {'bolso': 'Bolso', 'seguranca': 'Segurança', 'servicos': 'Serviços', 'economia': 'Economia', 'ambiente': 'Ambiente e instituições'}
BAL_CAND = {'bolsonaro': ('Bolsonaro', 'bolso', 'Bolsonaro, plano de 2018'), 'lula': ('Lula', 'lula', 'Lula, plano de 2022')}
BAL_CAT = {'ok': ('Cumprida', 'chip-ok'), 'mid': ('Parcial', 'chip-mid'), 'no': ('Não cumprida', 'chip-no'),
           'run': ('Em andamento', 'chip-run'), 'na': ('Sem evidência oficial', 'chip-na')}
BAL_TEMA = {'estado': 'Estado, reformas e privatizações', 'impostos': 'Impostos, renda e custo de vida',
            'social': 'Pobreza e proteção social', 'trabalho': 'Trabalho e emprego', 'seguranca': 'Segurança pública',
            'saude': 'Saúde', 'educacao': 'Educação', 'meioambiente': 'Meio ambiente e Amazônia',
            'infraenergia': 'Infraestrutura, energia e digital', 'instituicoes': 'Instituições e política externa'}
BAL_TEMA_ORD = ['impostos', 'trabalho', 'social', 'saude', 'educacao', 'estado', 'infraenergia', 'seguranca', 'meioambiente', 'instituicoes']


def bal_label(it):
    if it['cat'] == 'no' and it['cand'] == 'lula':
        return 'Não cumprida até 30/09/2026'
    return BAL_CAT[it['cat']][0]


def bal_sorted(prom):
    idx = {it['id']: i for i, it in enumerate(prom)}
    return sorted(prom, key=lambda it: (BAL_TEMA_ORD.index(it['tema']) if it['tema'] in BAL_TEMA_ORD else 99,
                                        0 if it['cand'] == 'bolsonaro' else 1, idx[it['id']]))


snip = lambda s: s[:150] + '…' if len(s) > 150 else s


def prerender_propostas(t):
    """Preenche <tbody id="cat-body"> com as mesmas linhas que o JS gera (o JS
    substitui o conteúdo ao carregar; sem JS, buscadores e IAs leem o catálogo)."""
    data = embedded_json(t, 'data-catalogo')
    if not data or '<tbody id="cat-body"></tbody>' not in t:
        return t, 0
    rows = []
    for it in data:
        nome, cls, _ = PROP_CAND[it['cand']]
        rot, rcls = PROP_ROT[it['rot']]
        rows.append('<tr><td class="who %s">%s</td><td>%s</td><td><span class="t">%s · %s</span><span class="tr-snip">%s</span></td>'
                    '<td class="small">%s</td><td><span class="chip %s sm">%s</span></td><td></td></tr>'
                    % (cls, esc(nome), esc(PROP_TEMA.get(it['tema'], it['tema'])), esc(it['id']), esc(it['sub']),
                       esc(snip(it['what'])), esc(it['pags']), rcls, esc(rot)))
    return t.replace('<tbody id="cat-body"></tbody>', '<tbody id="cat-body">' + ''.join(rows) + '</tbody>', 1), len(rows)


def prerender_balanco(t):
    prom = embedded_json(t, 'data-promessas')
    if not prom or '<tbody id="cat-body"></tbody>' not in t:
        return t, 0
    rows = []
    for it in bal_sorted(prom):
        nome, cls, _ = BAL_CAND[it['cand']]
        rows.append('<tr><td class="who %s">%s</td><td>%s</td><td><span class="t">%s · %s</span><span class="tr-snip">%s</span></td>'
                    '<td class="small">%s</td><td><span class="chip %s sm">%s</span></td><td></td></tr>'
                    % (cls, nome, esc(BAL_TEMA.get(it['tema'], it['tema'])), esc(it['id']), esc(it['titulo']),
                       esc(snip(it['trecho'])), esc(it['pag']), BAL_CAT[it['cat']][1], esc(bal_label(it))))
    return t.replace('<tbody id="cat-body"></tbody>', '<tbody id="cat-body">' + ''.join(rows) + '</tbody>', 1), len(rows)


def externalize_echarts(t):
    """Move a biblioteca ECharts (~1 MB embutida no HTML da home) para
    /assets/js/echarts-<versão>.min.js. Mesma posição e sem defer: a ordem de
    execução não muda. O HTML cai de ~1,1 MB para ~0,1 MB."""
    for m in re.finditer(r'<script>(.*?)</script>', t, re.S):
        code = m.group(1)
        if len(code) > 200_000 and 'echarts' in code and 'Apache Software Foundation' in code[:2000]:
            v = re.search(r'version:"(\d+\.\d+\.\d+)"', code)
            name = 'echarts-%s.min.js' % (v.group(1) if v else hashlib.sha256(code.encode()).hexdigest()[:10])
            out = DIST / 'assets' / 'js' / name
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(code, encoding='utf-8')
            return t[:m.start()] + '<script src="/assets/js/%s"></script>' % name + t[m.end():], name
    return t, None


# ------------------------------------------------------- JSON-LD de /fontes/
FONTE_ORG = {
    'fonte-tse': ('Tribunal Superior Eleitoral (TSE)', 'https://dadosabertos.tse.jus.br/'),
    'fonte-banco-central': ('Banco Central do Brasil', 'https://www.bcb.gov.br/'),
    'fonte-ibge': ('Instituto Brasileiro de Geografia e Estatística (IBGE)', 'https://sidra.ibge.gov.br/'),
    'fonte-tesouro-siconfi': ('Secretaria do Tesouro Nacional', 'https://www.tesourotransparente.gov.br/'),
    'fonte-federal-reserve': ('Federal Reserve Bank of New York', 'https://markets.newyorkfed.org/'),
    'fonte-tesouro-rtn': ('Secretaria do Tesouro Nacional', 'https://www.tesourotransparente.gov.br/'),
    'fonte-legislacao-fiscal': ('Presidência da República, Congresso Nacional e STF', 'https://www.planalto.gov.br/'),
}
MIME = {'pdf': 'application/pdf', 'zip': 'application/zip', 'json': 'application/json', 'jsonl': 'application/x-ndjson',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'htm': 'text/html', 'html': 'text/html'}


def fontes_datasets(t, site_url, modified):
    strip = lambda s: ' '.join(html.unescape(re.sub(r'<[^>]+>', ' ', s)).split())
    items = []
    for s in re.finditer(r'<section class="chap" id="([^"]+)".*?</section>', t, re.S):
        org = FONTE_ORG.get(s.group(1))
        if not org:
            continue
        for r in re.finditer(r'<tr><td class="fname">(.*?)</td><td>(.*?)</td><td[^>]*>(.*?)</td><td><a class="dl" href="([^"]+)"', s.group(0), re.S):
            fname, desc, usado, href = strip(r.group(1)), strip(r.group(2)), strip(r.group(3)), r.group(4)
            f = DIST / href.lstrip('/')
            if not f.exists():
                continue
            ext = fname.rsplit('.', 1)[-1].lower()
            items.append({
                '@type': 'Dataset',
                '@id': f'{site_url}/fontes/#{fname}',
                'name': f'{desc} ({fname})',
                'description': f'{desc}. Arquivo original publicado por {org[0]}, copiado sem alteração; '
                               f'usado na análise “{usado}” do Bora pros dados Brasil. Integridade: SHA-256 em /dados/SHA256SUMS.txt.',
                'inLanguage': 'pt-BR' if s.group(1) != 'fonte-federal-reserve' else 'en',
                'isAccessibleForFree': True,
                'creator': {'@type': 'GovernmentOrganization' if s.group(1) != 'fonte-federal-reserve' else 'Organization',
                            'name': org[0], 'url': org[1]},
                'isBasedOn': org[1],
                'includedInDataCatalog': {'@id': f'{site_url}/fontes/#catalogo'},
                'distribution': [{
                    '@type': 'DataDownload',
                    'contentUrl': site_url + href,
                    'encodingFormat': MIME.get(ext, 'application/octet-stream'),
                    'contentSize': f'{f.stat().st_size} B',
                    'sha256': sha256(f),
                }],
            })
    if not items:
        return None
    return {
        '@context': 'https://schema.org',
        '@type': 'DataCatalog',
        '@id': f'{site_url}/fontes/#catalogo',
        'name': 'Bora pros dados Brasil: fontes primárias das análises (50 arquivos oficiais)',
        'description': 'Arquivos originais, sem tratamento, do TSE, Banco Central, IBGE, Tesouro Nacional, Federal Reserve, '
                       'Planalto, Congresso e STF usados nas análises Governo Lula × Bolsonaro, Propostas 2026 e Promessas e Realizações, com hash SHA-256.',
        'url': f'{site_url}/fontes/',
        'inLanguage': 'pt-BR',
        'dateModified': modified,
        'publisher': {'@id': f'{site_url}/#org'},
        'dataset': items,
    }


# --------------------------------------------------------------- llms-full.txt
def llms_full(site_url, texts, prop_data, bal_data, dates):
    today = datetime.date.today().isoformat()
    out = [
        '# Bora pros dados Brasil — texto integral (llms-full.txt)',
        '',
        f'> Versão em texto puro de todas as páginas de {site_url}, gerada automaticamente no build em {today} '
        'a partir do mesmo HTML publicado. Inclui os catálogos completos (38 propostas de 2026 e 67 promessas com veredito) '
        'que no site aparecem em tabelas interativas. Análises descritivas com dados públicos oficiais; o site não '
        'recomenda voto. Ao citar, use o link da página correspondente.',
        '',
    ]
    for (url, _, title), txt in zip(PAGES, texts):
        pub, mod = dates[url]
        out += ['', '---', '', f'## Página: {title}', f'URL: {site_url}{url}', f'Atualizada em: {mod[:10]}', '', txt, '']
        if url == '/propostas/' and prop_data:
            out += ['', '### Catálogo completo das propostas (38; 19 por candidato)',
                    'Rótulo do “como”: ferramenta nomeada = o plano nomeia o instrumento; parcial = instrumento para parte da medida; '
                    'só intenção = só declara a intenção. “pág.” = página do PDF registrado no TSE.', '']
            for it in prop_data:
                out += [f'- [{it["id"]}] {PROP_CAND[it["cand"]][2]} · {it["sub"]} — rótulo: {PROP_ROT[it["rot"]][0]} (pág. {it["pags"]})',
                        f'  - O que promete: {it["what"]}', f'  - Como diz que vai fazer: {it["how"]}']
        if url == '/balanco/' and bal_data:
            out += ['', '### Catálogo completo das promessas e vereditos (67: 33 de Bolsonaro/2018, 34 de Lula/2022)',
                    'Categorias: Cumprida, Parcial, Não cumprida, Em andamento (só mandato em curso), Sem evidência oficial. '
                    'Corte do mandato de Lula: 30/09/2026.', '']
            for it in bal_sorted(bal_data):
                out += [f'- [{it["id"]}] {BAL_CAND[it["cand"]][2]} · {BAL_TEMA.get(it["tema"], it["tema"])} · {it["titulo"]} — veredito: {bal_label(it)} (pág. {it["pag"]})',
                        f'  - Trecho do plano: {it["trecho"]}', f'  - Critério: {it["criterio"]}', f'  - O que aconteceu: {it["fato"]}']
                if it.get('obs'):
                    out.append(f'  - Observação: {it["obs"]}')
                if it.get('fontes'):
                    out.append('  - Fontes oficiais: ' + ' ; '.join(it['fontes']))
    return '\n'.join(out).rstrip() + '\n'


# ------------------------------------------- registro único de comparações
REGISTRO = 'dados/comparacoes.json'
DERIVADOS = {REGISTRO}  # publicados em /dados/, mas não são "arquivos originais" (fora do SHA256SUMS dos 32)
REG_CAMPOS = ('id', 'ref', 'slug', 'status', 'titulo', 'tema', 'pagina', 'ancora', 'catalogo', 'metrica', 'lados',
              'resultado', 'vencedor', 'criterio', 'forca', 'ressalva', 'impacto', 'como_chega', 'fonte', 'arquivos', 'atualizado_em')
REG_RESULTADO = {'vitoria', 'contexto', 'sem-placar', 'nao-comparavel'}


def validate_registry():
    """Valida public/dados/comparacoes.json. Devolve (erros, resumo). Erros barram o build:
    ids inteiros únicos e permanentes (nenhum id do último commit pode sumir ou mudar de ref),
    slugs únicos com letra (não colidem com /c/1-3-5), campos obrigatórios, valores válidos,
    arquivos existentes com sha256 conferido e âncora existente na página de origem."""
    f = PUB / REGISTRO
    if not f.exists():
        return [], 'registro ausente'
    err = []
    try:
        reg = json.loads(f.read_text(encoding='utf-8'))
    except ValueError as e:
        return [f'{REGISTRO}: JSON inválido ({e})'], ''
    itens, prox = reg.get('comparacoes', []), reg.get('proximo_id', 0)
    niveis, temas, paginas = reg.get('impacto_niveis', {}), reg.get('temas', {}), reg.get('paginas', {})
    ids, slugs, refs = {}, set(), {}
    page_ids, sha_cache = {}, {}
    for it in itens:
        tag = f'id {it.get("id")} ({it.get("ref")})'
        falta = [k for k in REG_CAMPOS if k not in it]
        if falta:
            err.append(f'{tag}: campos obrigatórios ausentes: {", ".join(falta)}'); continue
        i = it['id']
        if not isinstance(i, int) or isinstance(i, bool) or i < 1:
            err.append(f'{tag}: id deve ser inteiro >= 1')
        elif i in ids:
            err.append(f'{tag}: id repetido (também em {ids[i]})')
        elif i >= prox:
            err.append(f'{tag}: id >= proximo_id ({prox})')
        ids[i] = it['ref']
        if it['ref'] in refs:
            err.append(f'{tag}: ref repetida')
        refs[it['ref']] = i
        if not re.match(r'^[a-z][a-z0-9-]*$', it['slug']) or it['slug'] in slugs:
            err.append(f'{tag}: slug inválido ou repetido ({it["slug"]}); precisa começar com letra')
        slugs.add(it['slug'])
        if it['status'] not in ('ativo', 'descontinuado'):
            err.append(f'{tag}: status inválido')
        if it['status'] == 'ativo' and i in reg.get('ids_retirados', []):
            err.append(f'{tag}: id retirado não pode voltar a ser usado')
        if it['status'] != 'ativo':
            continue
        if it['resultado'] not in REG_RESULTADO:
            err.append(f'{tag}: resultado inválido ({it["resultado"]})')
        if (it['resultado'] == 'vitoria') != (it['vencedor'] in ('b', 'l')):
            err.append(f'{tag}: vencedor só existe (b|l) quando resultado = vitoria')
        if it['resultado'] == 'vitoria' and it['forca'] not in ('clara', 'apertada', 'depende-da-regua'):
            err.append(f'{tag}: vitória sem força válida')
        if it['criterio'] not in ('maior', 'menor', None):
            err.append(f'{tag}: criterio inválido')
        if it['impacto'] not in niveis:
            err.append(f'{tag}: impacto inválido ({it["impacto"]})')
        if it['tema'] not in temas:
            err.append(f'{tag}: tema inválido ({it["tema"]})')
        if it['pagina'] not in paginas:
            err.append(f'{tag}: página inválida ({it["pagina"]})')
        if not all(k in it['lados'] and it['lados'][k].get('valor') for k in ('b', 'l')):
            err.append(f'{tag}: lados b e l precisam de valor')
        if not it['como_chega'] or len(it['como_chega']) > 140:
            err.append(f'{tag}: como_chega vazio ou com mais de 140 caracteres')
        if not it['arquivos']:
            err.append(f'{tag}: sem arquivo de fonte')
        for a in it['arquivos']:
            p = PUB / a['arquivo'].lstrip('/')
            if not p.exists():
                err.append(f'{tag}: arquivo não existe: {a["arquivo"]}'); continue
            sha_cache.setdefault(p, sha256(p))
            if sha_cache[p] != a.get('sha256'):
                err.append(f'{tag}: sha256 não confere para {a["arquivo"]}')
        src = PUB / (it['pagina'].lstrip('/') + 'index.html')
        if src not in page_ids:
            page_ids[src] = set(re.findall(r'\sid="([^"]+)"', src.read_text(encoding='utf-8'))) if src.exists() else set()
        if it['ancora'] not in page_ids[src]:
            err.append(f'{tag}: âncora #{it["ancora"]} não existe em {it["pagina"]}')
    for it in itens:
        for v in it.get('variante_de', []):
            if v not in ids:
                err.append(f'id {it["id"]}: variante_de aponta para id inexistente ({v})')
    # permanência: nenhum id publicado no último commit pode sumir ou trocar de ref
    prev = _git('show', 'HEAD:public/' + REGISTRO)
    if prev:
        try:
            for it in json.loads(prev).get('comparacoes', []):
                if it['id'] not in ids:
                    err.append(f'id {it["id"]} ({it["ref"]}) existia no último commit e sumiu: ids são permanentes (use status "descontinuado")')
                elif ids[it['id']] != it['ref']:
                    err.append(f'id {it["id"]} mudou de {it["ref"]} para {ids[it["id"]]}: ids não podem ser reaproveitados')
        except (ValueError, KeyError):
            pass
    ativos = sum(1 for it in itens if it.get('status') == 'ativo')
    return err, f'{len(itens)} comparações ({ativos} ativas), ids 1–{prox - 1}, {len(sha_cache)} arquivos com sha256 conferido'


def main():
    env = load_env()
    warns = []
    site_url = (env.get('SITE_URL') or '').rstrip('/')
    ga = env.get('GA_MEASUREMENT_ID') or ''
    consent = env.get('CONSENT_MODE') or 'none'
    prerender = (env.get('PRERENDER') or '1') != '0'
    if not re.match(r'^https?://', site_url):
        site_url = 'https://EXEMPLO.example.com'
        warns.append('SITE_URL não configurada no .env — usando placeholder https://EXEMPLO.example.com')
    if not re.match(r'^G-[A-Z0-9]{6,}$', ga) or len(set(ga[2:])) == 1:
        ga = ''
        warns.append('GA_MEASUREMENT_ID não configurado — analytics ficará inativo até preencher o .env')

    # registro único de comparações: erro aqui barra o build (dado errado não vai ao ar)
    reg_err, reg_resumo = validate_registry()
    if reg_err:
        print('build FALHOU: registro %s inválido:' % REGISTRO)
        for e in reg_err:
            print('   -', e)
        return 1

    if DIST.exists():
        shutil.rmtree(DIST)
    shutil.copytree(PUB, DIST)

    dates = {u: page_dates(PUB / f) for u, f, _ in PAGES}
    dist_pages = {DIST / f: u for u, f, _ in PAGES}

    # "Atualizado em" (faixa de credibilidade e rodapé): data do último commit do site
    upd_iso = _git('log', '-1', '--format=%cI')[:10] or datetime.date.today().isoformat()
    upd_br = '%s/%s/%s' % (upd_iso[8:10], upd_iso[5:7], upd_iso[:4])

    n_tok = 0
    DADOS_DIST = DIST / 'dados'
    for p in DIST.rglob('*'):
        if DADOS_DIST in p.parents:
            continue  # arquivos oficiais: copiados sem nenhuma alteração (o SHA-256 tem de bater)
        if p.is_file() and p.suffix.lower() in ('.html', '.xml', '.txt', '.json', '.css', '.js', '.svg'):
            s = p.read_text(encoding='utf-8')
            o = s
            s = s.replace('__SITE_URL__', site_url).replace('__GA_ID__', ga).replace('__CONSENT__', consent)
            s = s.replace('__UPDATED_ISO__', upd_iso).replace('__UPDATED__', upd_br)
            if p in dist_pages:
                pub, mod = dates[dist_pages[p]]
                s = s.replace('__DATE_PUBLISHED__', pub).replace('__DATE_MODIFIED__', mod)
            if s != o:
                p.write_text(s, encoding='utf-8'); n_tok += 1

    # meta de verificação (Search Console / Bing Webmaster) só na home
    verif = ''
    if env.get('GOOGLE_SITE_VERIFICATION'):
        verif += '<meta name="google-site-verification" content="%s">\n' % html.escape(env['GOOGLE_SITE_VERIFICATION'])
    if env.get('BING_SITE_VERIFICATION'):
        verif += '<meta name="msvalidate.01" content="%s">\n' % html.escape(env['BING_SITE_VERIFICATION'])
    if verif:
        home = DIST / 'index.html'
        home.write_text(home.read_text(encoding='utf-8').replace('</head>', verif + '</head>', 1), encoding='utf-8')
    # IndexNow (Bing, Yandex, Seznam…): arquivo da chave na raiz — https://www.indexnow.org
    if re.match(r'^[A-Za-z0-9-]{8,128}$', env.get('INDEXNOW_KEY') or ''):
        (DIST / (env['INDEXNOW_KEY'] + '.txt')).write_text(env['INDEXNOW_KEY'], encoding='utf-8')

    # SEO/IA: pré-renderização dos catálogos, ECharts externo, Dataset de /fontes/
    notes = []
    raw = {u: (DIST / f).read_text(encoding='utf-8') for u, f, _ in PAGES}
    prop_data = embedded_json(raw['/propostas/'], 'data-catalogo')
    bal_data = embedded_json(raw['/balanco/'], 'data-promessas')
    # texto para o llms-full.txt: do HTML antes da pré-renderização (os catálogos entram completos à parte)
    texts = [visible_text(raw[u]) for u, _, _ in PAGES]
    if prerender:
        t, n = prerender_propostas(raw['/propostas/'])
        if n: raw['/propostas/'] = t; notes.append(f'{n} propostas pré-renderizadas')
        t, n = prerender_balanco(raw['/balanco/'])
        if n: raw['/balanco/'] = t; notes.append(f'{n} promessas pré-renderizadas')
        t, name = externalize_echarts(raw['/'])
        if name: raw['/'] = t; notes.append(f'ECharts externo em /assets/js/{name}')
    ld = fontes_datasets(raw['/fontes/'], site_url, dates['/fontes/'][1])
    if ld:
        raw['/fontes/'] = raw['/fontes/'].replace(
            '</head>', '<script type="application/ld+json">%s</script>\n</head>' % json.dumps(ld, ensure_ascii=False).replace('</', '<\\/'), 1)
        notes.append(f'{len(ld["dataset"])} Datasets no JSON-LD de /fontes/')
    for u, f, _ in PAGES:
        (DIST / f).write_text(raw[u], encoding='utf-8')

    # llms-full.txt (texto integral, para buscadores de IA)
    (DIST / 'llms-full.txt').write_text(llms_full(site_url, texts, prop_data, bal_data, dates), encoding='utf-8')

    sobra = [str(p.relative_to(DIST)) for p in DIST.rglob('*') if p.is_file() and DADOS_DIST not in p.parents
             and p.suffix.lower() in ('.html', '.xml', '.txt') and any(t in p.read_text(encoding='utf-8') for t in TOKENS)]
    if sobra:
        warns.append('tokens não substituídos em: ' + ', '.join(sobra))

    # checksums dos dados
    dados = sorted((DIST / 'dados').rglob('*'))
    lines = [f'{sha256(p)}  dados/{p.relative_to(DIST / "dados")}' for p in dados if p.is_file() and p.name != 'SHA256SUMS.txt'
             and str(p.relative_to(DIST)) not in DERIVADOS]
    (DIST / 'dados' / 'SHA256SUMS.txt').write_text('\n'.join(lines) + '\n', encoding='utf-8')

    # sitemap (lastmod = data real da última alteração de cada página)
    urls = '\n'.join(f'  <url><loc>{site_url}{u}</loc><lastmod>{dates[u][1]}</lastmod></url>' for u, _, _ in PAGES)
    (DIST / 'sitemap.xml').write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '\n</urlset>\n', encoding='utf-8')

    # validação de links internos e dos JSON-LD
    missing, checked, n_ld = [], 0, 0
    for p in DIST.rglob('*.html'):
        if DADOS_DIST in p.parents:
            continue  # páginas oficiais arquivadas (STF etc.): os links delas não são do site
        t = p.read_text(encoding='utf-8')
        for m in re.finditer(r'(?:href|src)="(/[^"#?]*|[^"#?]*\.(?:css|js|png|jpg|ico|txt))"', t):
            u = m.group(1)
            if u.startswith('#'):
                continue
            if u.startswith('/'):
                tgt = DIST / u.lstrip('/')
                if u.endswith('/'):
                    tgt = tgt / 'index.html'
            else:
                tgt = (p.parent / u).resolve()
            checked += 1
            if not tgt.exists():
                missing.append(f'{p.relative_to(DIST)} -> {u}')
        for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', t, re.S):
            try:
                json.loads(m.group(1)); n_ld += 1
            except ValueError as e:
                warns.append(f'JSON-LD inválido em {p.relative_to(DIST)}: {e}')
    if missing:
        warns.append('links internos quebrados:\n    ' + '\n    '.join(sorted(set(missing))[:25]))

    print(f'build ok -> {DIST}')
    print(f'  páginas: {len(PAGES)} | tokens substituídos em {n_tok} arquivo(s) | links internos verificados: {checked} | JSON-LD válidos: {n_ld}')
    print(f'  dados: {len(lines)} arquivos, SHA256SUMS.txt regenerado')
    print(f'  registro: {reg_resumo}')
    print('  seo/ia: ' + ('; '.join(notes) if notes else 'nada a fazer') + ' | llms-full.txt gerado')
    for w in warns:
        print('  AVISO:', w)
    return 0


if __name__ == '__main__':
    sys.exit(main())

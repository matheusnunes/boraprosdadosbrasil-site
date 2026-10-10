#!/usr/bin/env python3
"""Build do site "Bora pros dados Brasil".
Lê o .env, gera dist/ a partir de public/ com os tokens substituídos
(__SITE_URL__, __GA_ID__, __CONSENT__), gera sitemap.xml, (re)gera
dados/SHA256SUMS.txt e valida os links internos. Sem dependências externas."""
import hashlib, re, shutil, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUB, DIST = ROOT / 'public', ROOT / 'dist'
TOKENS = ('__SITE_URL__', '__GA_ID__', '__CONSENT__')

def load_env():
    env = {}
    f = ROOT / '.env'
    if f.exists():
        for line in f.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                env[k.strip()] = v.strip()
    return env

def sha256(p):
    h = hashlib.sha256()
    with open(p, 'rb') as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()

def main():
    env = load_env()
    warns = []
    site_url = (env.get('SITE_URL') or '').rstrip('/')
    ga = env.get('GA_MEASUREMENT_ID') or ''
    consent = env.get('CONSENT_MODE') or 'none'
    if not re.match(r'^https?://', site_url):
        site_url = 'https://EXEMPLO.example.com'
        warns.append('SITE_URL não configurada no .env — usando placeholder https://EXEMPLO.example.com')
    if not re.match(r'^G-[A-Z0-9]{6,}$', ga) or len(set(ga[2:])) == 1:
        ga = ''
        warns.append('GA_MEASUREMENT_ID não configurado — analytics ficará inativo até preencher o .env')

    if DIST.exists():
        shutil.rmtree(DIST)
    shutil.copytree(PUB, DIST)

    n_tok = 0
    for p in DIST.rglob('*'):
        if p.is_file() and p.suffix.lower() in ('.html', '.xml', '.txt', '.json', '.css', '.js', '.svg'):
            s = p.read_text(encoding='utf-8')
            o = s
            s = s.replace('__SITE_URL__', site_url).replace('__GA_ID__', ga).replace('__CONSENT__', consent)
            if s != o:
                p.write_text(s, encoding='utf-8'); n_tok += 1
    sobra = [str(p.relative_to(DIST)) for p in DIST.rglob('*') if p.is_file()
             and p.suffix.lower() in ('.html', '.xml', '.txt') and any(t in p.read_text(encoding='utf-8') for t in TOKENS)]
    if sobra:
        warns.append('tokens não substituídos em: ' + ', '.join(sobra))

    # checksums dos dados
    dados = sorted((DIST / 'dados').rglob('*'))
    lines = [f'{sha256(p)}  dados/{p.relative_to(DIST / "dados")}' for p in dados if p.is_file() and p.name != 'SHA256SUMS.txt']
    (DIST / 'dados' / 'SHA256SUMS.txt').write_text('\n'.join(lines) + '\n', encoding='utf-8')

    # sitemap
    pages = [('/', PUB / 'index.html'), ('/propostas/', PUB / 'propostas' / 'index.html'), ('/balanco/', PUB / 'balanco' / 'index.html'), ('/fontes/', PUB / 'fontes' / 'index.html')]
    urls = '\n'.join(
        f'  <url><loc>{site_url}{u}</loc><lastmod>{__import__("datetime").date.fromtimestamp(p.stat().st_mtime).isoformat()}</lastmod></url>'
        for u, p in pages)
    (DIST / 'sitemap.xml').write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '\n</urlset>\n', encoding='utf-8')

    # validação de links internos
    missing, checked = [], 0
    for p in DIST.rglob('*.html'):
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
    if missing:
        warns.append('links internos quebrados:\n    ' + '\n    '.join(sorted(set(missing))[:25]))

    print(f'build ok -> {DIST}')
    print(f'  páginas: {len(pages)} | tokens substituídos em {n_tok} arquivo(s) | links internos verificados: {checked}')
    print(f'  dados: {len(lines)} arquivos, SHA256SUMS.txt regenerado')
    for w in warns:
        print('  AVISO:', w)
    return 0

if __name__ == '__main__':
    sys.exit(main())

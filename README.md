# Bora pros dados Brasil — site estático

Site com **três análises** descritivas + a página utilitária **Fontes e dados** — tudo com dados públicos oficiais:

| Página | URL | Conteúdo |
|---|---|---|
| Governo Lula × Bolsonaro | `/` | Governos Bolsonaro × Lula na lente dos 99% (renda, emprego, gasto, dívida) |
| Propostas 2026 | `/propostas/` | O que Lula × Flávio prometem (propostas registradas no TSE) |
| Promessas e Realizações Lula × Bolsonaro | `/balanco/` | O que foi prometido × cumprido (planos 2018/2022) |
| Fontes e dados | `/fontes/` | Os 32 arquivos originais + onde cada um é usado |

Cada página traz, no final, a seção **"Dados abertos"** com os arquivos-fonte originais para download (32 arquivos de TSE, Banco Central, IBGE, Tesouro e Fed), com integridade verificável por **SHA-256**.

## Estrutura de pastas

```
public/                  # site (arquivo-fonte; tokens __SITE_URL__ etc. são substituídos no build)
  index.html             # página 1  (raiz = Comparativo)
  propostas/index.html   # página 2
  balanco/index.html     # página 3
  fontes/index.html      # página utilitária — todas as fontes (32 arquivos) para download
  assets/css/site.css    # css compartilhado (sitebar, rodapé, blocos de dados)
  assets/js/analytics.js # instrumentação de eventos (GA4)
  assets/img/            # logo, favicons e imagens OG (1200x630)
  dados/                 # arquivos dos portais oficiais (+ SHA256SUMS.txt)
  robots.txt · 404.html
scripts/
  build.py               # gera dist/ (tokens, sitemap, checksums, valida links) — sem dependências
  deploy.sh              # build + sync para S3 + invalidação CloudFront (dry-run por padrão)
  gen_og_images.js       # regenera as imagens OG (requer node + playwright)
infra/terraform/         # S3 + CloudFront + ACM + Route53 (opcional) + headers de segurança
docs/                    # DEPLOY.md · ANALYTICS.md · PENDENCIAS.md
```

## Rodar localmente

```bash
python3 scripts/build.py
python3 -m http.server -d dist 8000
# abra http://localhost:8000
```

> Os links usam caminhos absolutos (`/assets/...`), então o preview precisa de servidor (não abra direto por file://).

## Publicar

Resumo: preencher `.env` e `infra/terraform/terraform.tfvars` → `terraform apply` → `scripts/deploy.sh --apply`.
Passo a passo completo (com análise "dá para deixar só no S3?"): **docs/DEPLOY.md**.

## Decisões de arquitetura

- **Fontes numa página única** (`/fontes/`): todos os 32 arquivos com a coluna “Usado em”; acesso pelo botão “Baixar fontes” no menu (todas as páginas) e pelo link do rodapé.
- **Integridade dos dados**: SHA-256 de cada arquivo publicado em `dados/SHA256SUMS.txt` e exibido (prefixo) em cada botão de download + **versionamento do bucket S3** (protege contra substituição/exclusão e permite auditoria). Opcional: Object Lock (WORM) — ver docs/DEPLOY.md.
- **S3 + CloudFront**: balde privado (OAC), HTTPS obrigatório, headers de segurança (HSTS, nosniff, frame-deny, referrer-policy, CSP), compressão, cache e erro 404 customizado.
- **URLs limpas** (`/propostas/`, `/balanco/`) via CloudFront Function (index.html implícito).
- **Analytics GA4** com eventos de jornada: visualização de cada seção (prioridade sobre % de scroll), profundidade, downloads (arquivo a arquivo), cliques externos/navegação e página de saída — ver docs/ANALYTICS.md. O ID vem do `.env` (site funciona sem ele).
- **SEO**: título/descrição por página, canonical, Open Graph/Twitter com imagens 1200×630, JSON-LD (Article/WebSite/Breadcrumb), `sitemap.xml` gerado no build, `robots.txt`, `lang="pt-BR"`, favicons e 404 próprio.

## Manutenção

- **Editar uma página**: altere o arquivo em `public/`, rode `python3 scripts/build.py` e publique de novo. (As páginas contêm os dados embutidos — não há dependência de CDN.)
- **Atualizar dados**: substitua os arquivos em `public/dados/...` e rode o build — os checksums são regenerados e a validação de links confere tudo.
- **Regenerar imagens OG**: `node scripts/gen_og_images.js` (precisa do playwright; caminho do node_modules ajustável no topo do script).

# Mapa de palavras-chave — Bora pros dados Brasil

Data: 10/10/2026 · Escopo: SEO on-page das 4 páginas do site.
Como foi feito: sem dados de volume de busca (não disponíveis nesta etapa) — os termos foram derivados da própria intenção de conteúdo + entidades + linguagem de busca provável. Contagens = ocorrências reais no HTML publicado (corpo visível, excluindo dados embutidos). Após o lançamento, refinar com Search Console (buscas reais).

Legenda de onde cada termo aparece: **T** = title · **D** = meta description · **OG** = Open Graph/Twitter · **L** = JSON-LD · **H** = H1/H2 · **C** = corpo.

---

## Transversal (todas as páginas)
- **Marca:** "Bora pros dados Brasil" (sufixo em todos os T; buscas pela marca).
- **Confiança/fontes:** dados oficiais · dados abertos · fontes oficiais (D; C).
- **Entidades:** TSE · Banco Central (BCB) · IBGE · Tesouro Nacional · Federal Reserve (D de /fontes; C das demais).
- **Integridade:** SHA-256 / hash (C de /fontes e rodapés).

## Página "/" — title: "Governo Lula × Bolsonaro | Bora pros dados Brasil"
- **Primárias:** governo Lula (78×) · governo Bolsonaro (65×) · Lula × Bolsonaro · comparativo · "qual foi melhor" · 99% da população (28×).
- **Secundárias:** renda · emprego · inflação (52×) · gastos públicos · dívida (85×) · salário mínimo (11×) · desigualdade · Selic (39×) · PIB (64×).
- **Long-tails sugeridas (reforço leve):** "qual governo foi melhor para o Brasil" · "governo Lula x governo Bolsonaro" · "comparativo Lula Bolsonaro economia" · "dívida pública Lula e Bolsonaro" · "salário mínimo governo Lula x Bolsonaro" · "inflação governo Lula e Bolsonaro".
- **Onde reforçar (opcional):**
  1. Eyebrow: "comparativo de janelas" → "comparativo Lula x Bolsonaro" (ganha o termo digitável; "janelas" continua no H1/sub e no corpo).
  2. Nomes completos 1× cada no Método: "Luiz Inácio Lula da Silva" e "Jair Bolsonaro" (hoje só sobrenome/governo).

## Página "/propostas/" — title: "Propostas Lula × Flávio 2026 — TSE"
- **Primárias:** propostas (15×) · planos (15×) · Lula (60×) · Flávio Bolsonaro (21×) · TSE (18×) · 2026 · eleições 2026.
- **Secundárias:** 2º turno · registradas no TSE · texto na íntegra (2×) · catálogo (4×) · "se diz como".
- **Long-tails sugeridas:** "propostas de Lula para 2026" · "propostas de Flávio Bolsonaro" · "plano de governo Flávio Bolsonaro" · "plano de governo Lula 2026" · "comparar propostas Lula e Flávio" · "propostas segundo turno 2026".
- **Onde reforçar (opcional):**
  1. Dizer "planos de governo" e "segundo turno" por extenso 1× no Método (hoje: "planos", "2º turno") — as frases completas são o que as pessoas digitam.
  2. Manter "eleições de 2026" no corpo (hoje 1×).

## Página "/balanco/" — title: "Promessas e Realizações Lula × Bolsonaro"
- **Primárias:** promessas de governo · promessas cumpridas · veredito (8×) · Lula · Bolsonaro · 2018 · 2022 · TSE (15×).
- **Secundárias:** "o que foi prometido, o que foi cumprido" · item por item · fonte oficial.
- **Long-tails sugeridas:** "promessas de campanha cumpridas" · "promessas de Bolsonaro cumpridas" · "promessas de Lula cumpridas" · "veredito das promessas de governo" · "balanço de promessas".
- **Onde reforçar (opcional):**
  1. "promessas de campanha" 1× (hoje aparece só "promessas"); e a palavra "balanço" 1–2× no corpo (hoje só na D) — ex.: primeira linha do Método: "Este balanço cobre as promessas de campanha registradas nos planos do TSE…".

## Página "/fontes/" — title: "Fontes e dados: os 32 arquivos originais"
- **Primárias:** fontes e dados · dados abertos · arquivos originais · download · TSE · IBGE (10×) · Banco Central (6×) · Tesouro (11×) · Federal Reserve (4×) · SHA-256 (4×).
- **Long-tails sugeridas:** "baixar dados do TSE" · "arquivos originais TSE download" · "dados abertos IBGE Banco Central" · "fontes dos dados".
- **Onde reforçar (opcional):**
  1. H1/desc: incluir a palavra "baixar/download" também no H1 (hoje está em "Ver as fontes" / botões). Ex.: "Fontes e dados: baixe os 32 arquivos originais".

---
## Regras para não canibalizar (cada página com sua "fatia")
- "/" ataca **comparação econômica dos governos** (renda, emprego, inflação, dívida).
- "/balanco/" ataca **promessas cumpridas/veredito** (passado: 2018/2022).
- "/propostas/" ataca **propostas/planos 2026 no TSE** (futuro).
- "/fontes/" ataca **dados abertos/download**.
- Evitar repetir "propostas" na home e "comparativo" no balanço, etc.

## Medição pós-lançamento (quando GA4 + Search Console estiverem ativos)
1. Search Console → Desempenho → ver as consultas reais por página (30/60 dias).
2. Título com CTR baixo (<2%) e impressões altas → testar variante (guardar as variantes sugeridas abaixo).
3. GA4 → "Página de destino" × `section_view` × `file_download` → entender o conteúdo que converte em download.
4. Revisar este mapa a cada trimestre.

## Variantes de título para teste futuro (A/B manual)
- "/": "Qual governo foi melhor para os 99%: Lula × Bolsonaro — dados oficiais"
- "/propostas/": "Lula × Flávio Bolsonaro 2026: propostas no TSE, texto na íntegra"
- "/balanco/": "Promessas de governo cumpridas? Balanço Lula × Bolsonaro (TSE)"
- "/fontes/": "Baixe os dados: 32 arquivos originais (TSE, BCB, IBGE, Tesouro)"

## Reforços aplicados em 10/10/2026
1. Eyebrow da home: "comparativo Lula x Bolsonaro" (era "comparativo de janelas"). ✓
2. Método (home): nomes completos "Luiz Inácio Lula da Silva" e "Jair Bolsonaro" 1× cada. ✓
3. Método (propostas): "os planos de governo registrados no TSE para o segundo turno das eleições de 2026". ✓
4. Método (balanço): "Este balanço cobre as promessas de campanha dos dois planos registrados no TSE…". ✓
5. H1 (fontes): "Fontes e dados: baixe os 32 arquivos originais das três análises". ✓
6. "Segundo turno" (pedido extra): title de /propostas/ com "2º turno"; descrição (meta/OG/Twitter/JSON-LD) com "no segundo turno das eleições de 2026"; OG/JSON-LD com "no 2º turno". ✓

# Analytics — GA4 + jornada do usuário

## Ativação (pendência)

1. Crie uma propriedade **Google Analytics 4** (analytics.google.com) para o domínio.
2. Copie o **ID de medição** (formato `G-XXXXXXXXXX`) e cole no `.env`:
   `GA_MEASUREMENT_ID=G-XXXXXXXXXX`
3. `scripts/deploy.sh --apply` (o build injeta o ID nas páginas).
   > O site funciona normalmente sem o ID — a instrumentação apenas fica inativa.

Opcional: em Admin → Retenção de dados, ampliar para 14 meses; considerar Google Signals conforme decisão de LGPD (ver abaixo).

## Eventos instrumentados

| Evento | Quando dispara | Parâmetros principais |
|---|---|---|
| `page_view` | automático (GA4) | page_id, página |
| `section_view` | usuário alcança 35% de uma seção (uma vez por seção/página) | `section`, `section_name`, `page_id` |
| `scroll_depth` | 25 / 50 / 75 / 90 / 100% (uma vez cada) | `percent` |
| `file_download` | clique em qualquer botão "baixar" dos dados | `file_name`, `file_type`, `file_size`, `file_cat` |
| `outbound_click` | clique em link externo (fontes oficiais etc.) | `link_domain`, `link_url`, `link_text` |
| `nav_click` | clique na navegação do site (sitebar/rodapé/âncoras) | `target`, `label` |
| `plano_pagina_aberta` | abertura do PDF/modal na página citada (propostas/balanço) | `label` |
| `trecho_original_aberto` | "Ver o texto exato na proposta/plano" | — |
| `detalhes_abertos` | "detalhes" no catálogo (propostas/balanço) | — |
| `page_exit` | usuário sai/oculta a aba | `last_section`, `seconds_on_page`, `scroll_max` |

As seções marcadas para `section_view` são as **10 áreas de cada página** (placar, capítulos, catálogo, método, dados/fontes…) — cada uma tem id e nome legível no atributo `data-track-section`/`data-track-name`. Isso permite funis por conteúdo real, e não só por percentual de rolagem.

## Respondendo às perguntas de negócio (receitas no GA4)

1. **Acessos e usuários por página** → Relatórios → Envolvimento → Páginas e telas.
2. **Origem do tráfego** → Relatórios → Aquisição (ou Explorar → Origem da sessão × página).
3. **Página de entrada e de saída** → Explorar → "Exploração de caminho": dimensão *Página de destino* (entrada) e evento **`page_exit`** com `last_section` (saída; o GA4 não tem métrica nativa de saída, esse evento cobre).
4. **Funil de consumo (exemplo do pedido)** → Explorar → **Explorador de funil**, etapas:
   1. `page_view` (ou sessões)
   2. `section_view` com `section = dados`
   3. `file_download` (qualquer arquivo)
   → quebra por `page_id` para comparar páginas. Resultado do tipo: *10.000 acessaram → 7.800 chegaram a "Dados" → 2.100 baixaram*.
5. **Quais seções são efetivamente alcançadas** → Explorar livre: `section_name` × usuários; ou funil com uma etapa por seção.
6. **Quais arquivos são baixados** → Explorar: `file_name` × usuários (também disponível em Tempo real ao publicar).
7. **Profundidade de leitura** → `scroll_depth.percent` × usuários (complementar ao `section_view`).

## Campanhas e compartilhamento

Para medir origem de compartilhamentos, use UTM nos links divulgados:
`?utm_source=whatsapp&utm_medium=social&utm_campaign=comparativo99` (etc.). Sem UTM, a origem vem por referrer/direto normalmente.

## LGPD / consentimento

`CONSENT_MODE` no `.env`:
- `none` (padrão): o GA carrega direto (IP anonimizado por padrão no GA4).
- `banner`: mostra uma faixa pedindo consentimento; o GA só carrega após "Aceitar" (guardado em localStorage).

**Pendência de decisão:** definir com o jurídico/responsável qual modo usar antes do lançamento (docs/PENDENCIAS.md).

## Depuração

- `window.__track_events` (console): histórico dos eventos disparados na sessão.
- GA4 → Admin → DebugView com a extensão de debug ativa.

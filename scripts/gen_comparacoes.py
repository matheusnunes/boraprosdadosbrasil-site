#!/usr/bin/env python3
"""Gera/atualiza o REGISTRO ÚNICO de comparações: public/dados/comparacoes.json.

Uso:  python3 scripts/gen_comparacoes.py <10-matriz-vereditos.json>

Regras de ID (permanentes):
  - Cada comparação tem um `id` inteiro (1, 2, 3...) que NUNCA muda e NUNCA é reaproveitado.
  - O vínculo com a matriz é o campo `ref` (H01, P00, B03...). Ao rodar de novo, quem já tem
    `ref` no registro mantém o `id`; refs novas recebem `proximo_id` (que só cresce).
  - Comparação retirada não é apagada: vira `status: "descontinuado"` (com `substituido_por`
    quando houver), e o id vai para `ids_retirados`. Links antigos /c/1-3-5 continuam
    resolvendo (a página de chegada mostra o aviso e, se houver, o substituto).
  - O build (scripts/build.py) recusa o registro se algum id repetir, sumir ou for reaproveitado.

Depois da primeira geração, o registro é a fonte da verdade: correções de texto são feitas
nele (ou aqui, no META) e o script preserva ids. Sem dependências externas.
"""
import datetime, hashlib, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'dados' / 'comparacoes.json'

# ------------------------------------------------------------------ escala de impacto
# Critério definido ANTES de olhar quem venceu: por ONDE o dado é medido / por qual canal
# chega à família (inspirado no OECD Well-being Framework: bem-estar atual × recursos para o
# bem-estar futuro). Não é "importância": dívida e juros também chegam ao bolso, mais devagar.
IMPACTO = {
    'bolso':    {'ordem': 1, 'rotulo': 'Direto no bolso',
                 'regra': 'Medido na família ou no preço que ela paga: preços ao consumidor, emprego, renda, salário, crédito às famílias.'},
    'servicos': {'ordem': 2, 'rotulo': 'Nos serviços e na proteção social',
                 'regra': 'O que o governo entrega a pessoas: saúde, educação, segurança, assistência e previdência (gasto ou entrega).'},
    'economia': {'ordem': 3, 'rotulo': 'Indireto, de prazo mais longo',
                 'regra': 'Agregado da economia, das contas do governo, do meio ambiente ou das instituições (PIB, dívida, juros da dívida, gasto total, carga de impostos, câmbio, desmatamento): chega por canais indiretos e ao longo do tempo.'},
    'panorama': {'ordem': 4, 'rotulo': 'Panorama (vários temas)',
                 'regra': 'Placar geral que soma vários temas; não tem um canal único.'},
}

FONTE_PUB = {
    'pib': 'IBGE (Contas Nacionais), via Banco Central', 'ipca': 'IBGE (IPCA), via Banco Central',
    'pnad': 'IBGE (PNAD Contínua), via Banco Central', 'sidra': 'IBGE (PNAD Contínua/SIDRA)',
    'bc': 'Banco Central', 'nfsp': 'Banco Central (NFSP)', 'tesouro': 'Tesouro Nacional (SICONFI/RREO)',
    'tesouro_pib': 'Tesouro Nacional (SICONFI) e Banco Central', 'rgf': 'Tesouro Nacional (SICONFI/RGF)',
    'fed': 'Federal Reserve Bank of New York', 'sm': 'Banco Central (SGS 1619) e IBGE (IPCA)',
    'tse26': 'TSE: planos de governo de 2026 registrados', 'tse_bal': 'TSE: planos de 2018 e 2022 + fonte oficial de cada promessa',
}

LADOS_GOV = {'b': {'nome': 'Governo Bolsonaro', 'curto': 'Bolsonaro'}, 'l': {'nome': 'Governo Lula', 'curto': 'Lula'}}
LADOS_PLANO = {'b': {'nome': 'Flávio Bolsonaro (plano 2026)', 'curto': 'Flávio'}, 'l': {'nome': 'Lula (plano 2026)', 'curto': 'Lula'}}
LADOS_BAL = {'b': {'nome': 'Governo Bolsonaro (plano 2018)', 'curto': 'Bolsonaro'}, 'l': {'nome': 'Governo Lula (plano 2022)', 'curto': 'Lula'}}

# Metadados por linha da matriz. Campos:
#  slug, titulo (pergunta curta), impacto, como (como isso chega em você, ≤ 130 caracteres),
#  fonte (chave de FONTE_PUB), crit ('maior'|'menor'|None), num (b, l) para o gráfico de duelo,
#  fmt (formato do número), ancora (âncora que EXISTE hoje), q (âncora futura do card .vrd, 20-ux-spec §5.3),
#  resultado (força o roteiro quando difere da matriz), catalogo (False = fica fora da lista), obs.
META = {
 'H01': dict(slug='crescimento', titulo='Quanto a economia cresceu por ano?', impacto='economia',
             como='O crescimento chega aos poucos: mais vendas, contratações e arrecadação ao longo dos anos.',
             fonte='pib', crit='maior', num=(1.4, 3.0), fmt={'casas': 1, 'sufixo': '% ao ano'}, ancora='cap-motor', q='q-crescimento'),
 'H02': dict(slug='inflacao', titulo='Quanto os preços subiram por ano?', impacto='bolso',
             como='É o aumento de preços do mercado, do aluguel e da conta de luz: quanto o seu dinheiro deixa de comprar.',
             fonte='ipca', crit='menor', num=(6.1, 4.6), fmt={'casas': 1, 'sufixo': '% ao ano'}, ancora='cap-motor', q='q-inflacao'),
 'H03': dict(slug='desemprego', titulo='Quantos procuravam emprego e não achavam?', impacto='bolso',
             como='Mostra a chance de quem procura trabalho encontrar uma vaga.',
             fonte='pnad', crit='menor', num=(12.1, 7.0), fmt={'casas': 1, 'sufixo': '%'}, ancora='cap-motor', q='q-emprego'),
 'H04': dict(slug='assistencia', titulo='Quanto foi gasto com assistência social (sem 2020)?', impacto='servicos',
             como='É o dinheiro de programas como Bolsa Família, Auxílio Brasil e BPC, que chega a famílias de baixa renda.',
             fonte='tesouro', crit='maior', num=(188.1, 293.5), fmt={'prefixo': 'R$ ', 'casas': 1, 'sufixo': ' bi/ano'}, ancora='placar', q='q-protecao-social',
             obs='Regra particular: sem 2020 para o Governo Bolsonaro (decisão do dono, item 2). frase_veredito da matriz usa 282 × 294 (janela completa, H17): conferir.'),
 'H05': dict(slug='selic', titulo='Juro básico (Selic): quanto custava o dinheiro?', impacto='economia',
             como='A Selic influencia o juro do crediário, do cartão e dos financiamentos, e o rendimento das aplicações.',
             fonte='bc', crit=None, num=(6.5, 12.9), fmt={'casas': 1, 'sufixo': '% ao ano'}, ancora='cap-motor', q='q-selic'),
 'H06': dict(slug='gasto', titulo='Quanto o governo federal gastou por ano, sem contar juros?', impacto='economia',
             como='Gasto maior pode significar mais serviços agora e mais dívida ou impostos depois; gasto menor, o contrário.',
             fonte='tesouro', crit='menor', num=(2.67, 3.02), fmt={'prefixo': 'R$ ', 'casas': 2, 'sufixo': ' tri/ano'}, ancora='cap-conta', q='q-gasto'),
 'H07': dict(slug='divida', titulo='Quanto a dívida pública mudou, em pontos do PIB?', impacto='economia',
             como='Dívida maior tende a pressionar juros e impostos no futuro; dívida menor abre espaço no orçamento.',
             fonte='bc', crit='menor', num=(-3.6, 11.2), fmt={'casas': 1, 'sufixo': ' pontos', 'sinal': True}, ancora='cap-conta', q='q-divida',
             sub=('75,3% → 71,7% do PIB (dez/18 a dez/22)', '71,7% → 82,9% do PIB (parcial, até ago/26)'),
             obs='frase_veredito da matriz usa +7,0 (até dez/2025); o placar usa +11,2 (até ago/26): conferir.'),
 'H08': dict(slug='juros', titulo='Quanto se pagou de juros da dívida por ano?', impacto='economia',
             como='O dinheiro que vai para juros não vai para serviços; ele depende do tamanho da dívida e da Selic.',
             fonte='nfsp', crit='menor', num=(5.0, 7.5), fmt={'casas': 1, 'sufixo': '% do PIB'}, ancora='cap-conta', q='q-juros'),
 'H09': dict(slug='salario-minimo', titulo='Quanto o salário mínimo comprava?', impacto='bolso',
             como='É o piso de quem ganha o mínimo e a base de aposentadorias e benefícios ligados a ele.',
             fonte='sm', crit='maior', num=(1374, 1478), fmt={'prefixo': 'R$ ', 'casas': 0}, ancora='cap-bolso', q='q-salario-minimo'),
 'H10': dict(slug='renda', titulo='Quanto cada pessoa da família tinha por mês?', impacto='bolso',
             como='É quanto, em média, cada pessoa da família tem por mês para viver, já sem a inflação.',
             fonte='sidra', crit='maior', num=(1781, 2127), fmt={'prefixo': 'R$ ', 'casas': 0}, ancora='cap-bolso', q='q-renda'),
 'H11': dict(slug='desigualdade', titulo='A renda ficou menos desigual? (índice de Gini)', impacto='bolso',
             como='Mostra se a renda cresceu mais para quem ganha menos ou para quem ganha mais.',
             fonte='sidra', crit='menor', num=(0.531, 0.511), fmt={'casas': 3}, ancora='cap-bolso', q='q-desigualdade'),
 'H12': dict(slug='renda-por-faixa', titulo='Ganho de renda por faixa (P10 a P99)', impacto='bolso',
             como='Mostra em que faixa de renda o ganho, sem a inflação, foi maior.',
             fonte='sidra', crit=None, num=None, ancora='cap-bolso', resultado='sem-placar', catalogo=False,
             obs='Fora do catálogo: a tabela usada (SIDRA 7438) não está nos arquivos publicados em /dados/ (matriz: "NÃO publicado").'),
 'H13': dict(slug='renda-metade-mais-pobre', titulo='Quanto tinha a metade mais pobre, por pessoa?', impacto='bolso',
             como='É a renda média por pessoa da metade da população que ganha menos.',
             fonte='sidra', crit='maior', num=(576, 743), fmt={'prefixo': 'R$ ', 'casas': 0}, ancora='cap-bolso', q='q-renda-base'),
 'H14': dict(slug='renda-10-mais-ricos', titulo='Renda dos 10% mais ricos', impacto='bolso',
             como='Serve de referência para comparar o topo com a base da renda; não conta ponto.',
             fonte='sidra', crit=None, num=(7455, 8557), fmt={'prefixo': 'R$ ', 'casas': 0}, ancora='cap-bolso'),
 'H15': dict(slug='saude-educacao', titulo='Quanto foi gasto com saúde e educação?', impacto='servicos',
             como='Financia hospitais, postos, escolas e universidades; gastar mais não garante, sozinho, serviço melhor.',
             fonte='tesouro', crit=None, num=(327.2, 384.8), fmt={'prefixo': 'R$ ', 'casas': 1, 'sufixo': ' bi/ano'}, ancora='cap-gasto',
             resultado='sem-placar', obs='Roteiro (60 §11.3) e dataviz: áreas de gasto são "sem placar" (gastar mais não é, sozinho, melhor). Matriz: Lula, maior gasto.'),
 'H16': dict(slug='investimentos', titulo='Quanto foi investido em obras e equipamentos?', impacto='economia',
             como='São estradas, obras e equipamentos públicos: cerca de 2% do gasto nos dois governos.',
             fonte='tesouro', crit=None, num=(59.1, 72.9), fmt={'prefixo': 'R$ ', 'casas': 1, 'sufixo': ' bi/ano'}, ancora='cap-gasto',
             resultado='sem-placar', obs='Investimento público = capital para o futuro (OCDE: capital econômico) → nível "economia". Sem placar pelo roteiro.'),
 'H17': dict(slug='assistencia-com-2020', titulo='Assistência social com a janela inteira (com 2020)', impacto='servicos',
             como='Mesmo dado da assistência social, contando 2020, ano do Auxílio Emergencial.',
             fonte='tesouro', crit=None, num=(282.1, 293.5), fmt={'prefixo': 'R$ ', 'casas': 1, 'sufixo': ' bi/ano'}, ancora='cap-gasto',
             resultado='sem-placar', variante_de='H04', obs='Leitura alternativa do H04. Sem placar pelo roteiro (área de gasto).'),
 'H18': dict(slug='previdencia', titulo='Gasto com Previdência', impacto='servicos',
             como='Paga aposentadorias e pensões; cresce com o envelhecimento da população, por isso não conta ponto.',
             fonte='tesouro', crit=None, num=(1007.8, 1087.6), fmt={'prefixo': 'R$ ', 'casas': 1, 'sufixo': ' bi/ano'}, ancora='cap-gasto'),
 'H19': dict(slug='pessoal', titulo='Gasto com a folha de pessoal', impacto='economia',
             como='Paga os servidores federais; sozinho, não diz se os serviços melhoraram.',
             fonte='tesouro', crit=None, num=(407.6, 392.6), fmt={'prefixo': 'R$ ', 'casas': 1, 'sufixo': ' bi/ano'}, ancora='cap-gasto'),
 'H20': dict(slug='juros-orcamento', titulo='Juros no orçamento federal (outra conta)', impacto='economia',
             como='Outra forma de contar os juros (só a União, pelo orçamento); o placar usa a conta do Banco Central.',
             fonte='tesouro', crit=None, num=(362.9, 331.3), fmt={'prefixo': 'R$ ', 'casas': 1, 'sufixo': ' bi/ano'}, ancora='cap-gasto'),
 'H21': dict(slug='gasto-dentro-do-mandato', titulo='Quanto o gasto cresceu dentro de cada mandato?', impacto='economia',
             como='Mostra o ritmo do gasto dentro de cada mandato; as janelas têm tamanhos diferentes.',
             fonte='tesouro', crit=None, num=(8.6, 9.5), fmt={'casas': 1, 'sufixo': '%', 'sinal': True}, ancora='cap-conta'),
 'H22': dict(slug='gasto-pib', titulo='O gasto subiu ou caiu em relação ao PIB?', impacto='economia',
             como='Compara o gasto com o tamanho da economia: subir indica gasto crescendo mais que o PIB.',
             fonte='tesouro_pib', crit='menor', num=(-0.7, 0.7), fmt={'casas': 1, 'sufixo': ' pontos', 'sinal': True}, ancora='cap-conta',
             sub=('24,0% → 23,2% do PIB (2019 → 2022)', '24,3% → 25,0% do PIB (2023 → 2025)')),
 'H23': dict(slug='divida-estados', titulo='Dívida dos estados', impacto='economia',
             como='É a dívida dos governos estaduais, que não é administrada pelo governo federal.',
             fonte='rgf', crit=None, num=(0.78, 0.94), fmt={'prefixo': 'R$ ', 'casas': 2, 'sufixo': ' tri'}, ancora='cap-conta',
             sub=('valores nominais', 'valores nominais, até 2026')),
 'H24': dict(slug='juros-eua', titulo='Juros nos Estados Unidos', impacto='economia',
             como='Juro alto nos EUA costuma encarecer o dólar e o crédito no Brasil; é fator externo.',
             fonte='fed', crit=None, num=(1.1, 4.8), fmt={'casas': 1, 'sufixo': '% ao ano'}, ancora='cap-mundo'),
 'H25': dict(slug='dolar', titulo='Quanto custava o dólar?', impacto='economia',
             como='Dólar mais caro encarece combustíveis, trigo e eletrônicos; reflete fatores de fora e de dentro.',
             fonte='bc', crit=None, num=(4.92, 5.32), fmt={'prefixo': 'R$ ', 'casas': 2}, ancora='cap-mundo'),
 'H26': dict(slug='juro-real-divida', titulo='Juro real que a dívida pagou', impacto='economia',
             como='Ajuda a explicar por que a dívida cresce ou cai: é o juro descontada a inflação.',
             fonte='bc', crit=None, num=(-1.5, 4.8), fmt={'casas': 1, 'sufixo': '% ao ano', 'sinal': True}, ancora='cap-divida'),
 'H27': dict(slug='deficit-primario', titulo='Déficit primário (gasto acima da arrecadação, sem juros)', impacto='economia',
             como='Mostra se o governo gastou mais do que arrecadou, sem contar juros; o ano de 2020 decide o sinal.',
             fonte='nfsp', crit=None, num=(2.0, 1.0), fmt={'casas': 1, 'sufixo': '% do PIB'}, ancora='cap-divida',
             obs='Matriz: contexto, "não avaliado pelo site"; frase_veredito cita Lula — manter sem placar até decisão.'),
 'H28': dict(slug='teste-sem-pandemia', titulo='E sem 2020–21? Crescimento, inflação e desemprego', impacto='bolso',
             como='Refaz três contas sem os anos de pandemia, para ver se o resultado muda.',
             fonte='bc', crit=None, num=None, ancora='cap-divida', variante_de='H01,H02,H03',
             obs='Composto: nível pela maioria dos componentes (IPCA e desemprego = bolso; PIB = economia).'),
 'P00': dict(slug='planos-caminho-explicito', titulo='Qual plano mais diz COMO vai fazer?', impacto='panorama',
             como='Mostra se o plano nomeia o instrumento (lei, programa, dinheiro), não se a proposta é boa.',
             fonte='tse26', crit='maior', num=(1, 11), fmt={'casas': 0, 'sufixo': ' de 19'}, ancora='placar'),
 'P00b': dict(slug='planos-algum-caminho', titulo='Planos com algum caminho (explícito ou parcial)', impacto='panorama',
              como='Versão mais branda da mesma régua: conta também o caminho parcial.',
              fonte='tse26', crit='maior', num=(13, 17), fmt={'casas': 0, 'sufixo': ' de 19'}, ancora='placar', variante_de='P00'),
 'P01': dict(slug='planos-bolso', titulo='Planos: bolso (impostos, trabalho, renda, casa)', impacto='bolso',
             como='Diz se o plano explica como vai mexer em imposto, trabalho e renda.',
             fonte='tse26', crit='maior', num=(0, 2), fmt={'casas': 0, 'sufixo': ' de 5'}, ancora='cap-bolso'),
 'P02': dict(slug='planos-seguranca', titulo='Planos: segurança e crime organizado', impacto='servicos',
             como='Diz se o plano explica como vai agir contra o crime.',
             fonte='tse26', crit='maior', num=(0, 2), fmt={'casas': 0, 'sufixo': ' de 3'}, ancora='cap-seguranca'),
 'P03': dict(slug='planos-servicos', titulo='Planos: saúde, educação e serviços', impacto='servicos',
             como='Diz se o plano explica como vai mudar saúde, escola e outros serviços.',
             fonte='tse26', crit='maior', num=(0, 4), fmt={'casas': 0, 'sufixo': ' de 5'}, ancora='cap-servicos'),
 'P04': dict(slug='planos-economia', titulo='Planos: economia e crescimento', impacto='economia',
             como='Diz se o plano explica como vai fazer a economia crescer.',
             fonte='tse26', crit='maior', num=(1, 2), fmt={'casas': 0, 'sufixo': ' de 4'}, ancora='cap-economia'),
 'P05': dict(slug='planos-ambiente', titulo='Planos: meio ambiente e instituições', impacto='economia',
             como='Diz se o plano explica como vai agir no meio ambiente e nas instituições.',
             fonte='tse26', crit=None, num=(0, 1), fmt={'casas': 0, 'sufixo': ' de 2'}, ancora='cap-ambiente', resultado='sem-placar',
             obs='Força "não comparável" (2 cartões; o resultado depende da régua): sem placar.'),
 'B00': dict(slug='promessas-cumpridas', titulo='Quantas promessas do plano foram cumpridas?', impacto='panorama',
             como='Compara o que cada plano registrado no TSE prometeu com o que foi feito.',
             fonte='tse_bal', crit='maior', num=(15.2, 35.3), fmt={'casas': 1, 'sufixo': '%'}, ancora='placar',
             sub=('5 de 33 (mandato fechado)', '12 de 34 (em curso, até 30/09/2026)')),
 'B00b': dict(slug='promessas-cumpridas-verificaveis', titulo='Cumpridas, contando só as promessas verificáveis', impacto='panorama',
              como='Mesma conta, sem as promessas que não têm como ser checadas em fonte oficial.',
              fonte='tse_bal', crit='maior', num=(22.7, 38.7), fmt={'casas': 1, 'sufixo': '%'}, ancora='placar', variante_de='B00',
              sub=('5 de 22', '12 de 31')),
 'B00c': dict(slug='promessas-cumpridas-ou-parciais', titulo='Cumpridas ou parciais', impacto='panorama',
              como='Mesma conta, somando as promessas cumpridas em parte.',
              fonte='tse_bal', crit='maior', num=(27.3, 50.0), fmt={'casas': 1, 'sufixo': '%'}, ancora='placar', variante_de='B00',
              sub=('9 de 33', '17 de 34')),
 'B01': dict(slug='promessas-impostos-trabalho', titulo='Promessas de impostos e trabalho cumpridas', impacto='bolso',
             como='São as promessas sobre imposto, emprego e renda.',
             fonte='tse_bal', crit='maior', num=(0, 71), fmt={'casas': 0, 'sufixo': '%'}, ancora='cap-bolso'),
 'B02': dict(slug='promessas-servicos', titulo='Promessas de proteção social, saúde e educação cumpridas', impacto='servicos',
             como='São as promessas sobre os serviços e programas que as famílias usam.',
             fonte='tse_bal', crit='maior', num=(0, 33), fmt={'casas': 0, 'sufixo': '%'}, ancora='cap-servicos'),
 'B03': dict(slug='promessas-estado-infra', titulo='Promessas de Estado e infraestrutura cumpridas', impacto='economia',
             como='São as promessas sobre reformas, privatizações, energia e obras.',
             fonte='tse_bal', crit='maior', num=(38, 14), fmt={'casas': 0, 'sufixo': '%'}, ancora='cap-estado'),
 'B04': dict(slug='promessas-seguranca-instituicoes', titulo='Promessas de segurança, meio ambiente e instituições cumpridas', impacto='servicos',
             como='São as promessas sobre segurança, meio ambiente e instituições.',
             fonte='tse_bal', crit='maior', num=(0, 25), fmt={'casas': 0, 'sufixo': '%'}, ancora='cap-seguranca'),
 'B05': dict(slug='promessas-nao-cumpridas', titulo='Promessas não cumpridas', impacto='panorama',
             como='Não dá para comparar: um mandato terminou e o outro está em curso.',
             fonte='tse_bal', crit=None, num=(39.4, 5.9), fmt={'casas': 1, 'sufixo': '%'}, ancora='placar', resultado='nao-comparavel', catalogo=False,
             obs='Fora do catálogo: decisão do dono (item 3) tira "não cumpridas" do veredito.'),
}

PAGINA = {'/': ('comparativo', 'Governo Lula × Bolsonaro'), '/propostas/': ('propostas', 'Propostas 2026'), '/balanco/': ('balanco', 'Promessas e realizações')}
TEMA = {  # tema curto (filtro) — por assunto, igual para as três páginas
    'H01': 'economia', 'H02': 'precos', 'H03': 'trabalho', 'H04': 'protecao', 'H05': 'juros', 'H06': 'contas', 'H07': 'contas',
    'H08': 'juros', 'H09': 'renda', 'H10': 'renda', 'H11': 'renda', 'H12': 'renda', 'H13': 'renda', 'H14': 'renda',
    'H15': 'servicos', 'H16': 'contas', 'H17': 'protecao', 'H18': 'protecao', 'H19': 'contas', 'H20': 'juros', 'H21': 'contas',
    'H22': 'contas', 'H23': 'contas', 'H24': 'mundo', 'H25': 'mundo', 'H26': 'juros', 'H27': 'contas', 'H28': 'economia',
    'P00': 'planos', 'P00b': 'planos', 'P01': 'renda', 'P02': 'seguranca', 'P03': 'servicos', 'P04': 'economia', 'P05': 'ambiente',
    'B00': 'promessas', 'B00b': 'promessas', 'B00c': 'promessas', 'B01': 'renda', 'B02': 'servicos', 'B03': 'contas', 'B04': 'seguranca', 'B05': 'promessas',
}
TEMAS = {'precos': 'Preços', 'trabalho': 'Emprego', 'renda': 'Renda e salário', 'protecao': 'Proteção social',
         'servicos': 'Saúde e educação', 'seguranca': 'Segurança', 'economia': 'Crescimento', 'juros': 'Juros',
         'contas': 'Contas públicas', 'mundo': 'Cenário externo', 'ambiente': 'Meio ambiente e instituições',
         'planos': 'Planos de governo', 'promessas': 'Promessas'}


def sha256(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def arquivos(fonte_txt):
    """Arquivos de public/dados citados no campo `fonte` da matriz (com sha256)."""
    out, seen = [], set()
    for m in re.finditer(r'(?:public/)?dados/[\w./-]+\.(?:jsonl|json|pdf|zip)\b', fonte_txt):
        rel = m.group(0).replace('public/', '')
        if rel not in seen and (ROOT / 'public' / rel).exists():
            seen.add(rel); out.append({'arquivo': '/' + rel, 'sha256': sha256(ROOT / 'public' / rel)})
    for name in re.findall(r'\b(20\d\dBR\d+(?:_01)?\.pdf)', fonte_txt):
        rel = 'dados/tse/' + name
        if rel not in seen and (ROOT / 'public' / rel).exists():
            seen.add(rel); out.append({'arquivo': '/' + rel, 'sha256': sha256(ROOT / 'public' / rel)})
    if 'IPCA' in fonte_txt and 'dados/banco-central/bcb_sgs_series.json' not in seen:
        rel = 'dados/banco-central/bcb_sgs_series.json'
        out.append({'arquivo': '/' + rel, 'sha256': sha256(ROOT / 'public' / rel), 'papel': 'deflator (IPCA, SGS 433)'})
    return out


def resultado_de(row, meta):
    if meta.get('resultado'):
        return meta['resultado'], None
    v = row['vencedor']
    if v.startswith('sem vencedor'):
        return ('nao-comparavel' if 'não comparável' in v else 'contexto'), None
    if 'Bolsonaro' in v or 'Flávio' in v:
        return 'vitoria', 'b'
    if 'Lula' in v:
        return 'vitoria', 'l'
    raise SystemExit('vencedor não reconhecido: %s %s' % (row['id'], v))


def forca_de(f):
    return {'clara': 'clara', 'apertada': 'apertada'}.get(f, 'depende-da-regua')


def main(matriz_path):
    matriz = json.loads(Path(matriz_path).read_text(encoding='utf-8'))
    old = json.loads(OUT.read_text(encoding='utf-8')) if OUT.exists() else {}
    by_ref = {c['ref']: c['id'] for c in old.get('comparacoes', [])}
    proximo = old.get('proximo_id', 1)
    retirados = list(old.get('ids_retirados', []))
    hoje = datetime.date.today().isoformat()
    itens, refs = [], set()
    for row in matriz:
        ref = row['id']; meta = META[ref]; refs.add(ref)
        if ref in by_ref:
            cid = by_ref[ref]
        else:
            cid = proximo; proximo += 1
        pag = row['pagina']
        res, venc = resultado_de(row, meta)
        ladosbase = LADOS_GOV if pag == '/' else (LADOS_PLANO if pag == '/propostas/' else LADOS_BAL)
        lados = {k: dict(ladosbase[k], periodo=row['periodo_a' if k == 'b' else 'periodo_b'],
                         valor=row['valor_a' if k == 'b' else 'valor_b']) for k in ('b', 'l')}
        if meta.get('sub'):  # com detalhe, o valor principal perde o parêntese repetido: "−3,6 p.p. (75,3% → 71,7%)" → "−3,6 p.p."
            for k, d in zip(('b', 'l'), meta['sub']):
                lados[k]['valor'] = re.sub(r'\s*\(.*\)\s*$', '', lados[k]['valor']); lados[k]['detalhe'] = d
        it = {
            'id': cid, 'ref': ref, 'slug': meta['slug'], 'status': 'ativo',
            'titulo': meta['titulo'], 'tema': TEMA[ref], 'tema_matriz': row['tema'],
            'pagina': pag, 'pagina_id': PAGINA[pag][0], 'ancora': meta['ancora'], 'ancora_card': meta.get('q'),
            'no_placar': bool(row['no_placar']), 'catalogo': meta.get('catalogo', True),
            'metrica': row['metrica'], 'unidade': row['unidade'], 'lados': lados,
            'resultado': res, 'vencedor': venc,
            'criterio': meta['crit'], 'criterio_texto': row['criterio'],
            'forca': forca_de(row['forca']) if res == 'vitoria' else None,
            'ressalva': row['ressalva'],
            'impacto': meta['impacto'], 'como_chega': meta['como'],
            'fonte': FONTE_PUB[meta['fonte']], 'fonte_detalhe': row['fonte'], 'arquivos': arquivos(row['fonte']),
            'como_calculamos': row['como_reproduzido'],
            'grafico': ({'tipo': 'duelo', 'valores': {'b': meta['num'][0], 'l': meta['num'][1]}, 'formato': meta.get('fmt', {})}
                        if meta.get('num') else None),
            'atualizado_em': hoje,
        }
        if res != 'vitoria' and row['vencedor'] and not row['vencedor'].startswith('sem vencedor'):
            it['vencedor_matriz'] = row['vencedor']
        if meta.get('variante_de'):
            it['variante_de'] = [by_ref.get(r) or r for r in meta['variante_de'].split(',')]
        if meta.get('obs'):
            it['revisao'] = meta['obs']
        itens.append(it)
    # refs que existiam e sumiram da matriz: viram descontinuadas (id nunca é reaproveitado)
    for c in old.get('comparacoes', []):
        if c['ref'] not in refs:
            c = dict(c, status='descontinuado', catalogo=False)
            itens.append(c)
            if c['id'] not in retirados:
                retirados.append(c['id'])
    # resolve variante_de (ref -> id) depois de todos terem id
    ids = {i['ref']: i['id'] for i in itens}
    for i in itens:
        if 'variante_de' in i:
            i['variante_de'] = [ids.get(r, r) if isinstance(r, str) else r for r in i['variante_de']]
    itens.sort(key=lambda i: i['id'])
    reg = {
        'versao': 1,
        'gerado_em': hoje,
        'descricao': 'Registro único das comparações do site (Governo Bolsonaro × Governo Lula; planos 2026; promessas). '
                     'IDs numéricos permanentes: nunca mudam nem são reaproveitados. Usado pelo catálogo /meus-dados/ e pelos links /c/1-3-5.',
        'regra_ids': 'id inteiro sequencial; permanente; item retirado vira status "descontinuado" e o id vai para ids_retirados; novos itens recebem proximo_id.',
        'proximo_id': proximo,
        'ids_retirados': sorted(retirados),
        'impacto_niveis': IMPACTO,
        'temas': TEMAS,
        'paginas': {k: {'id': v[0], 'nome': v[1]} for k, v in PAGINA.items()},
        'comparacoes': itens,
    }
    OUT.write_text(json.dumps(reg, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print('ok: %d comparações -> %s (proximo_id=%d)' % (len(itens), OUT.relative_to(ROOT), proximo))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])

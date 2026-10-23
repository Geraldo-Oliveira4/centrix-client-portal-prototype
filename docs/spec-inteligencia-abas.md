# Inteligência em abas: o que cada aba mostra e de onde vem

Para: Mauro (integração) e Vitor (revisão técnica). Data: 23/10/2026.
Origem: semanal de produto (Vinicius, Orsi, Vitor). A Inteligência estava
completa, mas a primeira tela era longa demais. Decisão: a primeira tela mostra
só números principais, gráficos, evolução e performance; o detalhe vira abas por
exportador, agente de carga e rota. SKU não tem aba própria. O Raio X deixa de ser
uma página à parte e vira o detalhe de cada entidade.

Tudo abaixo roda sobre a fixture fictícia `public/prototypes/centrix-inteligencia/data.js`
(60 embarques de março a setembro de 2026, 5 exportadores, 4 agentes, 5 rotas,
10 SKUs). Nenhum endpoint novo. O cálculo está em `intel-engine.js` e
`intel-tabs.js` (puros e testados). Na versão integrada, troca-se a fonte e as
regras continuam as mesmas.

## Regras que valem para todas as abas

| Regra | Como funciona hoje | O que a versão integrada precisa |
|---|---|---|
| Período e filtros acima das abas | Período (compromisso de prontidão) + Exportador, Agente, Rota, Incoterm, País, SKU. OU dentro de um filtro, E entre filtros | O mesmo recorte aplicado no servidor, ou o payload inteiro do cliente no front |
| Aba na URL | `aba=exportadores\|agentes\|rotas` (ausente = Visão geral), junto dos filtros | Nada além da rota |
| Visões salvas | Guardam período, filtros, aba e layout (localStorage do protótipo). Visão sem `aba` abre na Visão geral | Persistência por usuário no servidor (ver `docs/spec-onboarding-backend.md`) |
| Amostra pequena | n < 3: selo "Amostra pequena", sem variação | Mesmo limiar |
| Dado, não veredito | Nenhuma nota, ranking de melhor/pior ou recomendação; ordem padrão por volume | Mesma regra: o backend não deve devolver score de parceiro para estas telas |

## Visão geral

| Indicador | Na fixture | Dado real necessário |
|---|---|---|
| Entrega final no prazo (destaque + série de 6 meses) | `final` e `finalPlan` por embarque | Compromisso final original e comprovante de entrega (fonte ainda não mapeada: operação, transportador ou cliente) |
| Onde o prazo se perde (Prontidão → Chegada → Entrega) | `ready`/`readyPlan`, `arrive`/`arrivePlan`, `final`/`finalPlan` | Prontidão prevista e realizada (Inova), primeiro ETA + chegada (ShipsGo), entrega final |
| Prontidão no prazo | `ready` ≤ `readyPlan` | Inova: prontidão prevista e realizada, preservando o compromisso original |
| Chegada ao destino no prazo | `arrive` ≤ `arrivePlan` (primeiro ETA) | ShipsGo: primeiro ETA e evento de chegada ao porto/aeroporto de descarga |
| Frete contratado | `freight` (USD) | Proposta aceita (Centrix) ligada ao embarque |
| Embarques no recorte | contagem | Lista de embarques do cliente |
| Evolução (prazo por etapa e frete por mês) | séries mensais calculadas | O mesmo acima, por mês do compromisso de prontidão |
| Performance por etapa | intervalos entre marcos (`D.stages`) | Dois eventos válidos da mesma operação por trecho e o prazo combinado de cada trecho |

Personalizar continua valendo aqui (liga e desliga blocos). Completa/Objetiva
está escondido (`CLIENT_FLAGS.modeSwitch=false`), com o código preservado. **A
confirmar com o Orsi.**

## Aba Exportadores

Topo: exportadores no recorte, maior participação (nome, % e n), quanto somam
os 2 maiores, e quantos têm amostra pequena.

| Coluna | Na fixture | Dado real necessário |
|---|---|---|
| Exportador, País | `companies` | Cadastro de exportadores (Configurações / `centrix_exporters`) |
| Embarques (n e % do recorte) | contagem por `supplier` | Vínculo embarque → exportador (hoje o exportador está na cotação, `app/quotation_exporter.py`) |
| Prontidão no prazo | métrica `ready` | Inova: prontidão prevista e realizada |
| Documentação sem correção | métrica `docs` | Registro da primeira versão documental e das correções (não existe hoje) |
| Chegada ao destino no prazo | métrica `port` | ShipsGo |
| Frete médio | média de `freight` | Proposta aceita por embarque |

Detalhe (painel): fatos principais (embarques, prontidão, chegada, entrega
final, trânsito mediano, frete médio), evolução de 6 meses e **SKUs deste
exportador** (SKU, descrição, rotas, embarques). Depende de itens por embarque
com SKU, o que hoje só existe na fixture (o portal não tem item de PO).

## Aba Agentes de carga

| Coluna | Na fixture | Dado real necessário |
|---|---|---|
| Agente, preferido no cadastro | `agents` | `default_agents` do DNA / Meus Agentes |
| Embarques (n e %) | contagem por `agent` | Agente da proposta aceita, ligado ao embarque |
| Rotas atendidas | rotas distintas | Rota do embarque (origem/destino da cotação) |
| Trânsito mediano | mediana de `arrive − depart` | Saída e chegada reais (ShipsGo) |
| Chegada ao destino no prazo | métrica `port` | ShipsGo |
| Entrega final no prazo | métrica `final` | Comprovante de entrega |
| Cobrança sem diferença | métrica `audit` (conferências concluídas) | Auditoria de frete: fatura + proposta aceita (módulo ainda não integrado) |
| Frete médio | `freight` | Proposta aceita |

Abaixo da tabela: **Compromissos do serviço** (combinado × realizado: trânsito,
free time, confirmação do booking), que saiu da Visão geral. Free time e prazo
de booking são campos da fixture; na versão real, free time é cláusula comercial
que mora no Inova e não vem do ShipsGo.

Detalhe: fatos principais, evolução e **Uso e impacto**: participação nos
embarques, trânsito mediano e quantos ficaram acima do trânsito previsto na
proposta, cotado × cobrado (conferências com diferença, valor fundamentado e
casos em esclarecimento) e embarques com desvio nos compromissos. Desvio não
atribui responsabilidade ao agente.

## Aba Rotas

| Coluna | Na fixture | Dado real necessário |
|---|---|---|
| Rota (origem → destino), equipamento | `routes` + `locations` | Origem/destino da cotação; mesma normalização de rota do Mapa e do Radar (`routePartsOf`) |
| Embarques | contagem por `route` | Embarques com rota |
| Agentes | agentes distintos | Agente por embarque |
| Trânsito mediano | mediana de `arrive − depart` | ShipsGo |
| Chegada ao destino no prazo, Entrega final no prazo | métricas `port`, `final` | ShipsGo + comprovante |
| Frete médio | `freight` | Proposta aceita |

Detalhe: fatos principais, evolução, **Agentes nesta rota** (embarques, trânsito
mediano, chegada no prazo) e **SKUs nesta rota** (SKU, exportador, embarques). O
preço de mercado da rota continua no Radar (link no rodapé da aba).

## Raio X

As fichas antigas (`#fornecedores/<id>/resumo`, `#rotas/<id>/...`,
`#agentes/<id>/...`) continuam no ar e são o "Ver ficha completa" do painel.
O atalho "Ver Raio X do exportador" (com um exportador filtrado) abre o detalhe
na aba Exportadores (`aba=exportadores&sel=<id>`).

## Preparar relatório

Aberto do painel de detalhe, o resumo menciona a aba e a entidade ("Aba
Exportadores · Eastbridge Components"), e o atalho "Preparar revisão com <X>"
trata a entidade como filtrada. O conteúdo do relatório não mudou: **o Orsi vai
definir**.

## Pontos em aberto

- Completa/Objetiva escondido: confirmar com o Orsi se sai de vez.
- O período padrão (últimos 90 dias) deixa várias linhas com amostra pequena na
  fixture (por desenho). Avaliar com dado real se o padrão deve ser maior.
- Documentação sem correção e SKUs por embarque não têm fonte no Centrix hoje.

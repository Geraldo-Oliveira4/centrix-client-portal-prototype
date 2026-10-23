# Simulador de cenários (Prévia): lógica, entradas, saídas e dados reais

Para: Mauro (integração) e Vitor (revisão técnica). Data: 23/10/2026.
Origem: semanal de produto (Vinicius, Orsi, Vitor). A Inteligência tem dois
caminhos: o retrovisor (o que aconteceu: Visão geral e as abas Exportadores,
Agentes de carga e Rotas) e o futuro (o que o cliente decide agora). O primeiro
passo do futuro é este simulador: **"quero chegar até uma data; qual rota e qual
agente cabem?"**. Errar a **semana** de chegada, e não o dia, já muda a vida do
cliente (margem de segurança de 10 a 20%).

Código: `public/prototypes/centrix-inteligencia/intel-sim.js` (puro) e
`intel-sim.test.cjs`; a tela fica em `intel-page.js` (`simulatorTab`). Aba
`aba=simulador`, separada das abas do passado por um divisor, com selo "Prévia".

## Entradas

| Entrada | URL | Padrão | Observação |
|---|---|---|---|
| Rota (origem → destino) | `srota` | Todas as rotas com histórico | Rota desconhecida = todas |
| Data desejada de chegada | `chegada` | Hoje + 32 dias | Para a aba responder sem clique extra (com a fixture, já mostra os três resultados) |
| Histórico (janela própria) | `janela` = `6m` \| `12m` \| `tudo` | Últimos 12 meses | Contado pela data de SAÍDA, até hoje. Visão salva sem `janela` abre com 12 meses |
| Filtros globais | os de sempre | — | Exportador, agente, incoterm, SKU e país de origem restringem o histórico, como em toda aba |

**O período do painel NÃO se aplica ao Simulador (24/10/2026).** Na primeira
versão ele herdava o período global (padrão 90 dias), e todo par rota × agente
caía em "Amostra pequena": quem abria a aba via o pior estado. Para trânsito, é o
histórico longo que dá confiança; por isso a janela é própria e fica sempre à
vista ("Histórico usado: últimos 12 meses · N embarques nesta rota", também na
faixa fixa do topo). O botão "Usar o histórico de Este ano" saiu, substituído
pelo seletor.

As entradas viajam na visão salva (junto da aba). "Hoje" é o corte da
demonstração, `D.cutoff`, **relativo à data atual** (ver "Relógio da
demonstração" abaixo); a tela mostra a data ao lado do campo.
Premissa declarada: o embarque pode acontecer **a partir de hoje**; prontidão e
coleta não entram.

## Cálculo (estatística sobre o histórico, sem modelo preditivo)

Para cada par rota × agente com embarques no recorte:

1. Trânsito de cada embarque = data de chegada ao destino − data de saída (dias
   corridos), só onde as duas datas existem.
2. n = número de trânsitos. **Se n < 3: "Amostra pequena, sem estimativa"**, e
   nada mais é calculado.
3. Mediana e **P90** pelo posto mais próximo (o menor trânsito que cobre 90% dos
   casos; sempre um trânsito que aconteceu, sem interpolação). Mediana
   fracionária arredonda para cima nas datas (lado conservador).
4. Dias disponíveis = data desejada − hoje.
5. Classificação **factual** (não é nota nem recomendação):
   - **Cabe na data**: P90 ≤ dias disponíveis (até o caso lento do histórico chega).
   - **Apertado**: mediana ≤ dias disponíveis < P90.
   - **Não cabe**: mediana > dias disponíveis.
6. Data limite de embarque = data desejada − P90 ("com folga") e − mediana ("no
   limite").
7. Chegada estimada se embarcar agora = hoje + mediana até hoje + P90.

Tudo sai em **semanas** (segunda-feira da semana: "chegada estimada entre a
semana de 12/10 e a de 19/10"; "embarcar até a semana de 21/09"; "esta semana";
"já passou"), nunca em dia exato. O texto "Estimativa baseada no histórico. Não é
garantia de prazo." fica sempre visível. A tabela é ordenada por volume de
embarques no histórico, com colunas ordenáveis; nada de "recomendado", "melhor"
ou ranking.

## Saídas e estados

| Estado | Quando | O que a tela mostra |
|---|---|---|
| `ok` | há pares com estimativa | resumo ("7 cabem · 1 apertado · 3 não cabem") + tabela + regras |
| `all_nao_cabe` | data muito próxima, nenhum par com estimativa cabe | aviso com a semana a partir da qual a mediana mais curta chega + tabela |
| `all_small` | todos os pares com n < 3 | aviso sugerindo ampliar para "Todo o histórico" no seletor + tabela com "Amostra pequena" |
| `no_history` | nenhum embarque na rota com período e filtros | vazio + "Limpar filtros" / "Ver todas as rotas" |
| `past` | data desejada ≤ hoje | "Essa data já passou" com a primeira data possível |
| `no_date` | data inválida | pede a data |

Com a fixture e a data padrão (hoje + 32 dias), as três janelas mostram os três
resultados: 6 meses = 11 pares (7 cabem · 1 apertado · 3 não cabem), 12 meses =
14 pares (9 · 2 · 3), todo o histórico = 15 pares (10 · 2 · 3).

## Histórico acrescentado à fixture (24/10/2026)

Com 12 meses, só Shanghai → Santos tinha 3 agentes com n ≥ 3. Foram acrescentados
**19 embarques fictícios** (DEMO-061 a DEMO-079), todos ANTES da série de março
(e portanto fora dos últimos 90 dias, sem mexer na Visão geral nem nas abas no
período padrão):

| Par | Embarques | Quando (data-base) | Efeito |
|---|---|---|---|
| Ningbo → Itajaí × Delta Shipping | 5 | out/2025 a fev/2026 | 3º agente em Ningbo, dentro de 12 meses |
| Hamburgo → Itajaí × Alpha Logistics | 5 | out/2025 a fev/2026 | 3º agente em Hamburgo |
| Gênova → Santos × Delta Shipping | 5 | out/2025 a fev/2026 | 3º agente em Gênova |
| Nova York → Santos × Gamma Freight | 4 | mai a ago/2025 | só em "Todo o histórico" (mais de 12 meses) |

Resultado com 12 meses: 4 rotas com 3 agentes de n ≥ 3. Mesmos exportadores,
SKUs e regras de geração (`makeOperation` em `data.js`); nenhum nome novo.

## Relógio da demonstração (nenhum "hoje" congelado)

A fixture é gerada contra uma data-base fixa (corte 13/09/2026) e, no
navegador, **deslocada em memória** por `offset = hoje − data-base`
(`D.shift`). Todas as datas andam o mesmo número de dias: trânsito, atraso,
compromisso × realizado e a duração dos períodos não mudam, e o corte vira o
hoje. O arquivo-fonte não muda. `?hoje=AAAA-MM-DD` (na URL do portal ou do
iframe) fixa o hoje para testes e screenshots; sem ele, vale a data local. No
Node os testes recebem o dataset na data-base e injetam o relógio
(`D.shift(...)`, `D.demoToday(search, now)`), então nenhum teste depende da data
real em que roda.

## Sem custo, saving ou economia

O simulador **não** mostra custo, frete, saving nem economia. A metodologia de
saving está em avaliação (Economia tem fonte única em
`inteligencia/lib/illustrative-kpis.ts` e não deve ser recalculada aqui). Há
teste que falha se o resultado ganhar campo de custo ou rótulo de score/recomendação.

## Dados reais necessários

| Dado | Por embarque | Fonte provável |
|---|---|---|
| Data de saída real (partida do navio/voo) | sim | ShipsGo (Vessel Loading / Ocean Transit) ou Inova |
| Data de chegada real ao destino (porto/aeroporto de descarga) | sim | ShipsGo (Arrival at POD) |
| Rota (origem e destino normalizados) | sim | Cotação de origem; mesma chave do Mapa/Radar (`routePartsOf`) |
| Agente de carga | sim | Proposta aceita ligada ao embarque |
| Modal / equipamento (para não misturar aéreo e marítimo) | sim | Cotação |

O fixture tem tudo isso (`depart`, `arrive`, `route`, `agent`), por isso nenhum
campo foi acrescentado. No portal real, hoje, as colunas `tracking_*` guardam
ETAs e milestone, mas **não** a data de saída real nem a chegada real datada de
forma confiável; isso é o que a integração ShipsGo precisa trazer.

## Limites (o que este simulador não é)

- Não é modelo preditivo: só a distribuição do que já aconteceu no recorte.
- Sazonalidade, feriados, congestionamento, greves, omissão de escala e
  capacidade de navio não entram.
- Não considera prontidão da carga, coleta nem desembaraço: mede saída → chegada.
- Amostras pequenas são a regra no início de cada cliente; abaixo de 3 trânsitos
  não há estimativa.
- P90 com poucos casos tende a ser o maior trânsito observado.

## O que faltaria para evoluir

- Data a partir da qual a carga pode embarcar (prontidão) como entrada opcional,
  em vez de "a partir de hoje".
- Separar trânsito por variante (direto × transbordo) e por janela sazonal.
- Histórico de mercado (Data Lake) para pares sem histórico do cliente.
- Custo por cenário, depois que a metodologia de saving for definida.
- Validar com 2 ou 3 clientes se a leitura em semanas e os três rótulos bastam.

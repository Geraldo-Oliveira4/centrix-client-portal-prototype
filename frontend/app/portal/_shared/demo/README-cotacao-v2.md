# Cotação V2 — o overlay de revisão (HITL)

O que é: a máquina de estados das **duas revisões humanas da Freitas** (na
entrada, antes de qualquer agente receber o pedido; na saída, antes de o cliente
ver as propostas), simulada inteiramente no navegador.

**Só o lado do CLIENTE existe.** A Freitas não ganhou tela nenhuma: ela é a
seção "Cotação V2" do painel de demonstração. Não há nada do Centrix interno
aqui.

## A regra que não pode afrouxar

O backend deste protótipo **não tem** os estados da V2 (entrada em revisão,
devolvida com motivo, saída em revisão) nem o campo "liberada ao cliente" por
proposta. Tudo isso vive no `localStorage`, sob o prefixo `centrix-proto-v2:`.

Consequência direta, e está escrita no topo de `quotation-review.ts`: **o filtro
de "só as propostas liberadas" é uma decisão de DESENHO, nunca uma garantia de
visibilidade.** Na versão integrada essa regra precisa estar na camada de dados
e na API — senão um erro num componente expõe proposta bloqueada. O mesmo vale
para os estados: eles são colunas do backend no produto, e aqui são um objeto no
navegador.

A flag `cotacaoV2` decide tudo. Desligada (Onda 0), o fluxo atual fica
**intacto**: "Revisar convite", escolha de agentes, estados de hoje.

## Os arquivos

| Arquivo | O que é |
|---|---|
| `quotation-review.ts` | **puro** — as seis etapas, as transições, o merge, o contador e o cálculo da autorresposta |
| `quotation-review-notices.ts` | **puro** — as notificações (RQ-16), derivadas do histórico |
| `quotation-v2-scenarios.ts` | **puro** — o botão "Carregar cenários de demonstração" |
| `use-quotation-review.ts` | hooks e escritores sobre o store |
| `use-v2-auto-advance.ts` | a autorresposta; montada pelo **layout**, não pelo painel |
| `portal-v2-auto-advance.tsx` | o componente sem saída visual que monta o hook acima |
| `quotation-v2-labels.tsx` | os selos, o chip "Reenviada", a lista de campos alterados e o `REVIEW_SLA_LABEL` |
| `review-sla.ts` | **puro** — o prazo das revisões (1 hora) numa regra só |
| `quotation-hardblocks.ts` | **puro** — a lista de bloqueios do Orsi, a mesma na entrada e na saída |
| `quotation-form-snapshot.ts` | **puro** — o que o cliente enviou, o diff entre rodadas e os rótulos em português |
| `direct-close.ts` · `use-direct-close.ts` · `demo-section-direct-close.tsx` | o fechamento direto com o agente preferido da rota |
| `what-happens-next.tsx` | o painel lateral dos quatro passos (RQ-3) |
| `portal-notifications-bell.tsx` | o sino do cabeçalho |
| `demo-section-cotacao-v2.tsx` | a seção do painel: a Freitas simulada |

Os **puros** rodam sob `node --test` e por isso não usam o alias `@/`.

## As seis etapas

| `v2Stage` | Coluna do Kanban | Selo | O que o cliente faz |
|---|---|---|---|
| `draft` | Preencher detalhes | Rascunho | continua preenchendo |
| `entry_review` | Aguardando agentes | Em revisão | espera |
| `returned` | Preencher detalhes | Devolvida | corrige e reenvia |
| `awaiting_quotes` | Aguardando agentes | Aguardando propostas | espera |
| `exit_review` | Aguardando agentes | Em revisão | espera |
| `released` | Escolha sua proposta | Nova | compara e escolhe |
| `approved` | sai do funil (aba Aprovadas) | Aprovada pelo cliente | acompanha o embarque |
| `cancelled` | sai do funil (Histórico, via backend) | Cancelada | — |

Três coisas nessa tabela não são detalhe:

- **Revisão nunca é coluna.** As seis etapas cabem nas três colunas que o portal
  já tem. Uma quarta coluna colocaria a fila interna da Freitas dentro do quadro
  do cliente.
- **As duas revisões dividem o selo** e se distinguem pela FRASE. Qual das duas
  está rodando é exatamente o que o cliente precisa saber, e é o que uma segunda
  cor não diria.
- **O contador "aguardando sua ação" conta só `draft`, `returned` e `released`**
  (RQ-6). As três etapas que a Freitas segura ficam de fora: cobrar do cliente
  uma ação que a tela não oferece é pior que não contar nada.

## Ajustes do Orsi (29/09/2026)

Decisões de negócio que o protótipo passou a refletir. Onde a spec
`01-cotacao-v2-hitl-self-service.md` diverge disto, isto vale mais.

- **Prazo de cada revisão: 1 hora**, na entrada e na saída. Horário CORRIDO é
  premissa (a pergunta segue aberta com o Orsi) e mora numa constante só,
  `REVIEW_SLA` em `review-sla.ts`. O Embarque via PO herda o mesmo prazo.
- **O Inbox não é uma fila nova.** É a visão que o analista usa para a revisão
  de entrada, sobre a coluna Para Cotar. O painel diz, em cada linha, em que
  coluna do Kanban interno a cotação estaria.
- **O cliente edita em rascunho, em revisão de entrada e em devolvida**
  (`V2_CLIENT_EDITABLE_STAGES`). Editar em revisão reabre o formulário inteiro;
  reenviar é `resubmitEdited`: a cotação volta ao Inbox como NOVA RODADA, com
  `stageEnteredAt` novo (o prazo recomeça). Até reenviar, a Freitas continua com
  a versão enviada — sair da edição não muda nada. Reenviar sem mudar um campo é
  recusado (`canResubmitEdit` = `no_changes`), porque abriria uma rodada só para
  zerar o relógio da Freitas. Depois do RFQ disparado o botão não aparece e a
  tela explica por quê.
- **"Reenviada" + campos alterados.** Correção (`resubmitted`) e edição
  (`edited`) guardam no evento do histórico o diff contra a rodada anterior
  (`changes`: campo, valor anterior, valor novo). O chip é SECUNDÁRIO — contorno
  neutro, abaixo da frase no cartão — e só aparece enquanto a Freitas revisa
  aquela rodada (`isResubmission`).
- **Cancelar exige justificativa** (mínimo 10 caracteres, contador, botão
  travado com mensagem). Na revisão de entrada o diálogo não diz que "os agentes
  serão avisados" (`agentsNotified`). O cancelamento é REAL no backend
  (`POST /cancel`, a cotação vai ao Histórico) e o overlay vira `cancelled`, que
  não tem coluna.
- **Hardblocks** (`quotation-hardblocks.ts`): a lista condicional do Orsi. O
  formulário mostra "faltam N itens" com atalhos, o motivo em cada campo, e só
  habilita "Enviar para a Freitas" sem pendência. A MESMA função trava "Aprovar
  e disparar RFQ" e "Liberar N propostas" no painel, e a autorresposta não
  aprova nem libera cotação bloqueada. As flags Crítico/Alto não entram na regra.
- **Snapshot do envio** (`submittedForm`). O payload não traz fator de escolha,
  NCM nem os "agentes decidam"; sem guardar o que o cliente enviou, reabrir a
  edição pediria de novo o que ele já respondeu. Os valores são canônicos (prazo
  em UTC, valor numérico), senão um formulário intocado acusaria alterações.
- **Correção ao agente é sempre por e-mail**: texto no painel, não botão.
- **Aprovar** leva a "Aprovada pelo cliente" (a Freitas recebe a instrução de
  fechamento). O detalhe mostra o desfecho, não mais "Com a Freitas".
- **Fechamento direto** (`/portal/nova-cotacao/fechamento-direto`, atrás da flag
  `cotacaoV2`): o cliente fecha com o agente preferido da rota, sem cotar. Passa
  pela revisão de entrada (seção "Fechamento direto" do painel). A tabela rota →
  agente preferido é FICTÍCIA; rota sem preferido mostra o estado vazio com
  "Cotar normalmente" e a rota pré-preenchida.

### A lista de hardblocks

| Item | Quando bloqueia |
|---|---|
| Tipo de cotação, tipo de serviço, modal, Incoterm, fator de escolha, produto, referência do cliente | sempre, se vazio |
| Carga perigosa | sempre: Sim/Não explícito, sem padrão. "Sim" sem classificação (IMO/RA) também bloqueia |
| Empilhável, tombável | sempre, sem resposta ("Não" é resposta) |
| Local de coleta | sempre, EXCETO FOB. "Agentes decidam" não dispensa |
| Local de embarque | SÓ no FOB (porto ou aeroporto, conforme o modal) |
| Local de desembarque | vazio e sem "Agentes decidam" |
| Endereço de entrega final | SÓ DAP/DDP |
| NCM | SÓ DAP/DDP; 8 dígitos |
| UN | SÓ carga perigosa; 4 dígitos |
| Temperatura mínima | SÓ carga refrigerada |
| Valor da carga | SÓ DAP, DDP, CIP, CIF; maior que zero |

No modo hardblock o formulário não exige mais a data de prontidão: a lista é o
único portão, e um obrigatório fora dela liberaria o botão para recusar o clique.

## Como acrescentar uma etapa

1. O valor em `V2Stage`, e as entradas em `V2_STAGE_LABELS`,
   `V2_STAGE_DESCRIPTIONS` e `V2_STAGE_COLUMN` — os três são `Record<V2Stage,…>`,
   então faltar uma quebra o build.
2. A transição, como função pura ao lado das outras. Ela **acrescenta** ao
   `history`, nunca o substitui: é o histórico que sustenta o RQ-5 (a devolução
   continua legível depois do reenvio) e de onde as notificações são derivadas.
3. Se a etapa depende do cliente, `V2_CLIENT_ACTION_STAGES`. Se ela avança
   sozinha, `V2_AUTO_ADVANCE_STAGES` **e** `autoAdvanceTarget`.
4. O CTA em `V2CardFooter` (`cotacoes/components/quotation-card.tsx`) e a ação
   em `QuotationRow` (`demo-section-cotacao-v2.tsx`).
5. O cenário em `SCENARIO_ORDER` e `buildScenario`, se ela deve aparecer no
   "Carregar cenários".
6. Um teste em `quotation-review.test.ts`.

Etapa gravada que esta versão não conhece é **descartada** na leitura, não
consertada: uma cotação sem overlay volta ao comportamento de hoje, que é sempre
um lugar seguro para cair.

## Como o painel usa

A seção "Cotação V2" lista as cotações com overlay e oferece **só a ação válida
para a etapa** — "Aprovar e disparar RFQ" e "Devolver ao cliente" na revisão de
entrada, "Propostas chegaram" na espera, "Liberar N propostas" na revisão de
saída, e "Voltar ao rascunho" em qualquer uma.

- **Devolver exige motivo** (três prontos mais campo livre) e é **sempre
  manual**. A autorresposta não tem aresta para `returned`: uma demonstração em
  que a Freitas recusa sozinha diria à plateia algo que não é verdade sobre o
  produto.
- **A autorresposta conta a partir de `stageEnteredAt`**, não de um cronômetro
  ligado na montagem — é isso que faz o avanço sobreviver a um reload. E ela é
  montada no **layout do portal**, não no painel: o avanço tem de acontecer com
  o painel fechado, que é como uma demonstração de verdade acontece.
- **"Carregar cenários de demonstração"** distribui as seis etapas por cotações
  que já existem, uma por etapa. Não cria, não apaga e não renumera nada no
  servidor; o estado do backend não é tocado.

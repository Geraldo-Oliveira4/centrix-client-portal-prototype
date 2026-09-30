# Novo embarque a partir do PO — o overlay de revisão

O que é: a jornada em que o cliente abre um embarque a partir de um **PO que já
fechou com o exportador**, sem passar por cotação, e a Freitas revisa antes de o
embarque ficar ativo.

**Só o lado do CLIENTE existe.** A fila de validação e a tela de validação
(Telas 10 e 11 da spec) são do Centrix interno e ficam fora deste protótipo. A
Freitas é a seção "Embarque via PO" do painel de demonstração.

A flag `embarqueViaPo` decide tudo. Desligada, nada aparece: nem o botão na
Central, nem o botão em Meus Embarques, nem a aba, nem o KPI — e
`/portal/embarques/novo` cai no `ModuleNotReleased` do layout.

## O que o backend precisaria ter, e não tem

Nada disto existe no schema do protótipo. Na versão real, tudo é **migration
nova**:

- **O PO como registro selecionável** (RQ-10). Hoje o PO é digitado dentro do
  `client_reference` da cotação, e o embarque não tem coluna de PO nenhuma.
- **Os estados de revisão** ("aguardando revisão", "devolvido") no embarque.
  `EmbarqueEstado` é um union fechado de sete estados operacionais e nenhum
  deles significa "a Freitas ainda não olhou isto".
- **Os SKUs**, que não existem em lugar nenhum.
- **O dedup sobre o PO** (RQ-5), que depende de o PO ser um registro primeiro.

Por isso tudo vive no `localStorage`, sob `centrix-proto-v2:`, e as telas leem
dali. É adereço de palco, nunca modelo de dados.

## A escolha do estado: `solicitado` + `review_status`

**O union fechado NÃO foi tocado.** Acrescentar um valor a `EmbarqueEstado`
respingaria em todo mapa indexado por ele (`ESTADO_BADGE_CLASS`,
`ESTADO_SEMAFORO`, `SHIPMENT_STEPS`, a timeline, os marcadores do mapa) e
colocaria um estado que só existe no protótipo dentro de um tipo que espelha o
enum do backend.

Um embarque em revisão é **`solicitado`** — o primeiro estado da jornada real, o
que um embarque tem antes de qualquer coisa ter acontecido com ele — mais um
campo **opcional `review_status`** que só as telas da V2 leem. Quem não conhece
`review_status` continua tratando a linha como um `solicitado` comum, que é o
fallback verdadeiro.

## A origem não é fabricada

`routePartsOf` cai no `illustrativeHub`, que **inventa um porto a partir da
referência** do embarque. Para um embarque aberto por PO isso seria inventar
justamente o dado que a revisão existe para estabelecer — então `poRouteLabel`
devolve **"A definir"** para todo embarque com overlay e sem cotação vinculada,
inclusive depois de ativo (ele não ganha cotação ao ser validado). Origem,
destino e peso são preenchidos depois, nas abas Datas e Booking (RQ-10), e ficam
ocultos enquanto está em análise — a proposta da Open Question 3.

## Os quatro estados

| `poStage` | Onde aparece | Selo | O que o cliente faz |
|---|---|---|---|
| `draft` | **não aparece na carteira** | Rascunho | retoma por "Abrir novo embarque" |
| `awaiting_review` | carteira (ou aba) | Em análise | espera |
| `returned` | carteira (ou aba) | Devolvido | corrige e reenvia |
| `active` | carteira | Ativo | acompanha |

## Os arquivos

| Arquivo | O que é |
|---|---|
| `shipment-po-review.ts` | **puro** — estados, transições, dedup, referências, contagem, autorresposta |
| `shipment-po-read.ts` | **puro** — a leitura simulada do PO e a fixture |
| `shipment-po-merge.ts` | **puro** — o overlay dobrado na carteira do `useMyShipments` |
| `shipment-po-scenarios.ts` | **puro** — "Carregar cenários de demonstração" |
| `shipment-po-notices.ts` | **puro** — "Embarque validado" e "Embarque devolvido" |
| `use-shipment-po-review.ts` | hooks e escritores |
| `shipment-po-labels.tsx` | selos, chips e `PO_REVIEW_SLA_LABEL` |
| `shipment-po-review-tab.tsx` | a aba "Em análise" (opção B, Tela 8) |
| `new-shipment-dialog.tsx` | o modal de escolha (Tela 2) |
| `link-quotation-card.tsx` | vincular cotação (Tela 9) |
| `po-review-view.ts` | os dois toggles do painel (A/B e falha de leitura) |
| `demo-section-embarque-po.tsx` | a seção do painel |
| `../../embarques/novo/` | a página (Tela 3) e o formulário (Telas 4, 5 e 6) |

Os **puros** rodam sob `node --test` e por isso não usam o alias `@/`.

## Como acrescentar um estado

1. O valor em `PoStage`, e as entradas em `PO_STAGE_LABELS` e
   `PO_STAGE_DESCRIPTIONS` — os dois são `Record<PoStage,…>`, então faltar uma
   quebra o build.
2. A transição, como função pura ao lado das outras. Ela **acrescenta** ao
   `history`, nunca o substitui: é o histórico que sustenta o reenvio com motivo
   preservado e de onde as notificações são derivadas.
3. Se o estado espera o cliente, `PO_CLIENT_ACTION_STAGES`. Se avança sozinho,
   `PO_AUTO_ADVANCE_STAGES` **e** `applyPoAutoAdvance`.
4. O selo em `shipment-po-labels.tsx`, a ação em `ShipmentRow`
   (`demo-section-embarque-po.tsx`) e, se ele deve entrar na carteira, as
   funções de `shipment-po-merge.ts`.
5. Um teste em `shipment-po-review.test.ts`.

Estado gravado que esta versão não conhece é **descartado** na leitura: um
embarque sem overlay volta ao comportamento de hoje, que é sempre um lugar
seguro para cair.

## As decisões que a spec deixou em aberto, e o que o protótipo fez

| Open Question | O que a spec diz | O que o protótipo faz |
|---|---|---|
| **10** — selo ou aba | Propõe o selo (opção A) | **As duas**, com um seletor no painel. Padrão: selo. A pergunta é do Orsi, e responder por ele no código seria pior que mostrar as duas |
| **13** — SLA da revisão | "[SLA a definir]" | 1 hora (decisão do Orsi, 29/09/2026), da regra única `review-sla.ts`; `PO_REVIEW_SLA_LABEL` só a formata. Horário corrido é premissa, não decisão |
| **12** — editar/cancelar em análise | Em aberto | Pode as duas. Cancelar devolve ao rascunho, não apaga |
| **3** — o que aparece em análise | Proposta sem resposta | Origem, destino e peso ocultos; rota "A definir" |
| **7** — critério da busca da vinculação | Em aberto | Os três (nº, REF do PO, cliente), porque escolher um seria responder |
| **1** — o v1 lê o PO? | Bloqueante, em aberto | Os wireframes mostram o cenário (a); o protótipo faz a leitura simulada E a Tela 6 manual |
| **2** — guard rail dos "5 primeiros" | Por cliente ou no total? Quem libera? | **NÃO MODELADO.** Todo embarque via PO passa pela revisão |
| **5** — como o PO é criado | Em aberto com o Mauro | Combobox com os POs conhecidos + digitar um novo |
| **6** — dedup bloqueia? | Em aberto | Alerta com confirmação explícita, como o RQ-5 pede. Não bloqueia |

## Referências: a partir de EMB-2026-0101

O seed vai até `EMB-2026-0013` e os top-ups de tracking acrescentam alguns na
mesma faixa. `PO_REFERENCE_BASE = 101` deixa tudo isso de lado, então uma
referência de PO nunca é confundida com uma semeada e nada precisa ser
renumerado. `nextPoReference` lê o overlay **e** as referências que a API
devolveu, então nem uma colisão futura passa.

## O PO da fixture colide de propósito

`simulateRead` lê **PO-2026-1183**, que é o `client_reference` de uma cotação
semeada (`seed_prototype.py` grava PO-2026-1180..1188) e chega ao portal no
embarque provisionado a partir dela. Com isso o diálogo de PO duplicado (Tela 5)
dispara sozinho numa demonstração, sem ninguém ter de lembrar um número. O
wireframe mostra PO-2026-1830, que não existe neste protótipo — usá-lo tornaria
a tela de dedup inalcançável.

## O botão da Central

A Central de trabalho é um iframe estático **de mesma origem**
(`public/prototypes/centrix-visao-geral/`). O botão mora no `index.html` do
protótipo embutido, **escondido** (`hidden`) e com `data-host-href`; quem o
revela e quem trata o clique é o HOST (`visao-geral/page.tsx`), porque é o host
que conhece a flag e o router do Next. O `?v=` do iframe subiu para invalidar o
cache.

## Autorresposta

`awaiting_review` vira `active` depois de `delaySeconds`, contados a partir de
`stageEnteredAt` — é isso que faz o avanço sobreviver a um reload. Ela roda no
**mesmo hook** da Cotação V2 (`use-v2-auto-advance.ts`), montado no layout do
portal, para que funcione com o painel fechado e para que os dois domínios não
acordem com temporizadores concorrentes escrevendo no mesmo prefixo.

**Devolver nunca é automático.** Não há aresta para `returned`: uma demonstração
em que a Freitas recusa sozinha diria à plateia algo que não é verdade sobre o
produto.

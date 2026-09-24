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
| `quotation-v2-labels.tsx` | os selos e o `REVIEW_SLA_LABEL` |
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

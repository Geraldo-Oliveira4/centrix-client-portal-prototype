# Handoff funcional — o que o protótipo V2 simula no cliente

Este documento lista, em nível de produto, o que as três frentes do protótipo V2
fazem **no navegador** e o que a versão integrada precisa ter de verdade. É a
leitura para quem vai construir o lado do servidor.

**Regra geral:** tudo abaixo vive hoje em `localStorage`, sob o prefixo
`centrix-proto-v2:`. Nenhum estado, nenhuma transição e nenhuma regra de
visibilidade existe no banco. O protótipo é referência visual e de fluxo.

---

## 1. Cotação — estados e origem

**Hoje no protótipo:** a cotação ganha uma máquina de estados paralela com seis
etapas — rascunho, revisão de entrada, devolvida, agentes cotando, revisão de
saída e liberada — mais "aprovada" para fechar a jornada.

**Na versão real:**

- Os estados de **revisão de entrada** e **revisão de saída** precisam existir no
  modelo da cotação. Hoje o Kanban interno já trabalha nas colunas equivalentes;
  o que falta é a cotação saber em qual delas está, de forma consultável pelo
  portal.
- Estado **devolvida ao cliente**, com **motivo** obrigatório escrito por quem
  devolveu. O motivo é exibido ao cliente e precisa sobreviver à correção.
- **Origem da cotação** (portal, e-mail, criação manual), para distinguir o que
  nasceu do self-service.
- **Data e hora de entrada em cada etapa de revisão**, para calcular prazo
  restante e alimentar métricas.

## 2. Devolução, edição em revisão e reenvio

- Devolver exige motivo; sem motivo a ação não acontece.
- Ao reenviar, a cotação volta à revisão de entrada e o **histórico é
  preservado**: a devolução anterior e o motivo dela continuam legíveis.
- O reenvio precisa ser distinguível do primeiro envio no histórico.
- **O cliente edita em rascunho, em revisão de entrada e em devolvida** (Orsi,
  29/09/2026). Editar durante a revisão de entrada reabre o formulário inteiro;
  ao reenviar, a cotação volta ao Inbox como **nova rodada**: nova data de
  entrada na etapa, e o prazo da revisão recomeça. Enquanto o cliente não
  reenvia, a Freitas segue revisando a versão anterior.
- **Reenvio sem nenhuma alteração não abre rodada** — só zeraria o relógio da
  revisão.
- **Edição depois do RFQ disparado está fora do escopo**: o backend deve recusar
  a alteração de dados a partir de "Cotando". O protótipo esconde o botão e
  explica ao cliente que o caminho é cancelar e abrir outra.
- A edição que chega depois de a Freitas ter aprovado a entrada precisa ser
  recusada com um erro que o portal consiga explicar (no protótipo, a tela avisa
  que as alterações não foram enviadas).
- **Diff de campos**: cada reenvio (correção ou edição) grava no histórico os
  campos alterados, com **valor anterior e novo**. É o que o Inbox mostra junto
  do chip "Reenviada". A comparação precisa ser por valor normalizado (datas em
  UTC, número em vez de texto formatado), senão um formulário intocado acusa
  alteração.
- **Prazo das revisões: 1 hora** na entrada e na saída (Orsi, 29/09/2026). Se a
  hora é corrida ou útil ainda está em aberto; o protótipo assume corrida.

## 2b. Cancelamento com justificativa

- **Cancelar exige justificativa** do cliente (o endpoint hoje aceita `note`
  opcional; passa a ser obrigatório). O protótipo pede no mínimo 10 caracteres.
- A justificativa vai para o histórico da cotação e para o Kanban interno.
- Cancelada na revisão de entrada, a cotação vai direto para as canceladas:
  nenhum agente recebeu o pedido, então nenhum aviso de cancelamento é enviado.
  A partir de "Cotando", os agentes acionados são avisados (como hoje).

## 2c. Hardblocks de entrada e de saída

A lista do Orsi (29/09/2026), **condicional**. A mesma regra vale nas duas
pontas: o cliente não envia com pendência, a Freitas não dispara o RFQ nem
**libera proposta** de cotação que deixou de atender a algum item. Precisa estar
no backend — o protótipo só desenha a tela.

| Item | Regra |
|---|---|
| Tipo de cotação, tipo de serviço, modal, Incoterm, fator de escolha, produto, referência do cliente | sempre |
| Carga perigosa | sempre, **resposta explícita Sim/Não sem valor padrão**; Sim exige classificação |
| Empilhável, tombável | sempre, resposta explícita |
| Local de coleta | sempre, exceto FOB |
| Local de embarque | só FOB |
| Local de desembarque | só se informado; "Agentes decidam" não bloqueia |
| Endereço de entrega final | só DAP/DDP |
| UN | só carga perigosa |
| Temperatura mínima | só carga refrigerada |
| Valor da carga | só DAP, DDP, CIP, CIF |
| NCM | só DAP/DDP |

- **Flags Crítico/Alto das propostas não são regra de bloqueio** — seguem só
  como indicador visual.
- Três campos da lista **não existem no create do portal hoje**: o backend
  ignora `price_or_performance`, `ncm` e os `agente_define_*` no POST do portal
  (o protótipo os guarda no navegador). A versão real precisa persisti-los.
- Liberar zero propostas continua impossível.

## 2d. Fechamento direto

- O cliente fecha direto com o **agente preferido da rota**, sem cotação. O
  pedido entra no Inbox e passa pela revisão de entrada (aprovar = instrução ao
  agente; devolver = motivo obrigatório).
- Precisa de um cadastro **rota → agente preferido** por cliente, mantido pela
  Freitas (não existe hoje; no protótipo é uma tabela fictícia). Rota sem
  preferido não oferece o fechamento direto — oferece cotar.
- Precisa de **origem** própria (fechamento direto), distinta de cotação.

## 3. Propostas — liberação e bloqueio

**Hoje no protótipo:** a revisão de saída marca quais propostas o cliente pode
ver; as demais somem da comparação.

**Na versão real, e este é o ponto mais importante do documento:**

- Cada proposta precisa de **liberada ao cliente** (sim/não), **bloqueada**
  (sim/não) e os **motivos do bloqueio**.
- **A regra "o cliente só lê proposta liberada" tem de estar na camada de dados e
  na API, não na interface.** No protótipo ela é um filtro de renderização, que é
  uma decisão de desenho e nunca uma garantia: um erro num componente exporia
  uma proposta que a Freitas decidiu segurar.
- Liberar zero propostas não pode ser possível: a comparação abriria vazia com
  um aviso dizendo o contrário.

## 4. Histórico de revisão

Registro de cada decisão, consultável pelo portal e pelo Kanban interno:
**quem**, **quando**, **qual etapa**, **resultado** (aprovou, devolveu, liberou,
pediu correção), **motivo** e, quando houver, **campo alterado com valor
anterior e novo**.

O portal deriva as notificações desse histórico — não de uma segunda tabela.

## 5. Notificações no portal

Quatro tipos, todos **dentro do portal**, sem link e sem e-mail:

| Evento | Quando |
|---|---|
| Propostas liberadas | a revisão de saída libera propostas |
| Cotação devolvida | a revisão de entrada devolve ao cliente |
| Embarque validado | a revisão do embarque o ativa |
| Embarque devolvido | a revisão do embarque o devolve |

Cada notificação precisa de estado **lido/não lido** por usuário e de um id
estável — o protótipo aprendeu que um id por posição faz o "lido" saltar de
linha quando chega um aviso novo.

## 6. Embarque aberto a partir do PO

**Campos novos no embarque** (nenhum existe hoje):

- **Número do PO, como registro selecionável** — não texto livre. Um embarque
  pode ter mais de um PO. A recomendação é **modelar a relação PO ↔ embarque
  como N:N já na migration** e restringir na regra e na UI do v1 (1 embarque =
  1 ou mais POs), para que a gestão por PO da V2 não exija uma segunda migration.
- **REF do cliente**. Hoje ela só existe na cotação.
- **SKU / part number** por item, com descrição, moeda, quantidade, valor
  unitário, peso líquido, valor total e peso bruto. Nada disso existe no schema.

**Estados de revisão do embarque:** aguardando revisão, devolvido (com motivo e
**quais campos corrigir**) e ativo. O enum atual de estados do embarque é
operacional e não comporta "a Freitas ainda não olhou isto" — o protótipo
contorna isso com um campo à parte, e a versão real precisa do estado de fato.

**Rascunho** não aparece na carteira e é retomável pelo cliente.

**Dedup por PO:** ao informar o PO, o sistema alerta se já existe embarque com
ele. **Não bloqueia**, mas exige confirmação explícita. A comparação precisa ser
por registro normalizado, não por texto: "PO-2026-1183" e "po 2026/1183" são o
mesmo pedido.

**Vínculo posterior de cotação:** um embarque aberto por PO pode ser ligado a uma
cotação depois, mantendo o mesmo ID. A busca do vínculo aceita número da
cotação, referência do PO e cliente, e lista só cotações aprovadas do próprio
cliente.

**Origem do embarque** (cotação aprovada, PO, criação manual do analista).

## 7. O que NÃO deve ser inventado

O protótipo é rígido nisto, e a versão real deveria ser também: **origem,
destino, peso e datas de um embarque que ninguém revisou ainda aparecem como
"A definir"**, nunca derivados. Eles são preenchidos depois, nas abas de datas e
booking. Uma origem inferida é exatamente o dado que a revisão existe para
estabelecer.

## 8. Flags por módulo

- Uma flag por módulo do portal: cotação, cotação V2, embarques, embarque via
  PO, auditoria, inteligência e radar.
- **Valor padrão global mais exceção por cliente**, com a exceção valendo mais
  que o padrão.
- **O menu esconde o que está desligado e o backend recusa a chamada de módulo
  desligado.** Esconder na tela não basta — no protótipo só existe o esconder, e
  isso é explicitamente insuficiente.
- Ligar e desligar **não exige deploy**.
- Registro de quem mudou cada flag, quando, e de qual valor para qual.

## 9. O que ficou fora do protótipo, de propósito

- **Guard rail dos "primeiros N embarques".** Não está definido se a contagem é
  por cliente ou no total, nem quem libera a saída. O protótipo faz **todo**
  embarque aberto por PO passar pela revisão.
- **Prazos (SLA) de revisão.** Definido em 1 hora (Orsi, 29/09/2026); falta
  decidir se é hora corrida ou útil.
- **Extração automática do PO.** A leitura no protótipo é uma fixture
  determinística, não OCR. Se o v1 for ler o PO de verdade, escopo e esforço
  mudam.
- **Gestão por PO** (PO dividido em vários embarques, linkagem linha a linha). A
  aba "Visão por PO" do protótipo existe só para validar aderência.

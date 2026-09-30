# Roteiro de demonstração — Protótipo V2

Como apresentar as três frentes do protótipo V2 (feature flags por módulo,
Cotação V2 e Novo embarque via PO) do lado do **cliente**. A Freitas não tem
tela: ela é simulada no painel.

Tudo roda no navegador. Não há backend das jornadas V2, não há envio de e-mail,
não há integração.

---

## 1. Antes de começar

**Abrir o painel de demonstração** (ele fica escondido; o cliente que está
testando o portal não pode encontrá-lo por engano):

| Ação | Efeito |
|---|---|
| `?demo=1` em qualquer URL do portal | liga e guarda a escolha **nesta aba** |
| `?demo=0` | desliga |
| `Ctrl+Shift+D` | alterna |

Ligado, aparece a aba **Demonstração** no canto inferior esquerdo. Ela abre o
Sheet "Painel de demonstração · simulação da Freitas".

A escolha vive em `sessionStorage`: sobrevive à navegação e **morre ao fechar a
aba**. Se você fechar o navegador entre uma apresentação e outra, precisa de
`?demo=1` de novo.

**Preparar o estado** (1 minuto, antes da plateia entrar):

1. Abra o painel, seção **Módulos liberados** → botão **Tudo liberado**.
2. Seção **Cotação V2** → **Carregar cenários de demonstração**.
3. Seção **Embarque via PO** → **Carregar cenários de demonstração** e, se for
   mostrar a Visão por PO, também **PO dividido em 3 embarques**.
4. Seção **Freitas simulada** → deixe **desligada** para conduzir no clique, ou
   ligue com 8 s se preferir que as etapas andem sozinhas enquanto você fala.

---

## 2. As ondas, e o que cada uma mostra

Seção **Módulos liberados** do painel. Cada botão aplica uma onda inteira.

| Onda | Módulos ligados | O que aparece |
|---|---|---|
| **Onda 0** | Cotação | Menu com Início, Central de trabalho, Minhas Cotações e Configurações. Nada de embarques, Inteligência, Radar ou Auditoria. A Home mostra só os cards que não dependem de módulo |
| **Onda 1** | + Cotação V2 | Mesmo menu, mas a jornada da cotação muda: "Enviar para a Freitas", revisão de entrada e de saída, sino de notificações |
| **Onda 2** | + Meus Embarques e Embarque via PO | Aparecem Meus Embarques, o botão "Abrir novo embarque" (na Central e em Meus Embarques) e a aba "Visão por PO" |
| **Onda 3** | + Inteligência, Radar e Auditoria | Menu completo |
| **Tudo liberado** | todos | O portal como ele é publicado hoje |

**O que dizer:** ligar e desligar um módulo não exige deploy, o menu esconde o
que está desligado e quem digitar a URL direto encontra a tela "Este módulo
ainda não está liberado para a sua empresa" — com a sidebar e o cabeçalho
intactos, porque é uma porta fechada dentro do portal, não uma sessão perdida.

**Sempre liberados, sem chave:** Início, Central de trabalho e Configurações.

---

## 3. Roteiro A — Cotação V2 (~12 minutos)

Onda 1 ou superior. Prazo de cada revisão: **1 hora** (Orsi, 29/09/2026).

1. **Minhas Cotações → Em andamento.** Os estados no quadro de uma vez:
   Rascunho e Devolvida em "Preencher detalhes"; duas "Em revisão" e uma
   "Aguardando propostas" em "Aguardando agentes"; uma "Nova" em "Escolha sua
   proposta". *Ponto:* revisão é **estado no cartão**, nunca coluna nova.
2. **O contador do topo** conta só o que depende do cliente: rascunho,
   devolvida e liberada.
3. **Nova cotação.** O botão principal é **"Enviar para a Freitas"** e começa
   **desabilitado**: o quadro "Faltam N itens" lista os hardblocks do Orsi, e
   cada campo pendente diz o motivo. *Ponto:* carga perigosa não tem resposta
   padrão — é Sim ou Não, explícito.
4. **Troque o Incoterm** (ex.: FCA → CIF → DAP). Os campos que passam a valer
   aparecem sem salto de layout (valor da carga no CIF; endereço de entrega e
   NCM no DAP) e o resumo revalida sozinho. Clique num item do resumo: a tela
   leva ao campo e o destaca.
5. **Corrija e envie.** "Tudo pronto" fica verde, o botão habilita. Confirmação
   "Solicitação COT-xxxx enviada à Freitas" e o cartão em "Aguardando agentes"
   com "Em revisão".
6. **Editar em revisão.** Abra a cotação: "Editar solicitação" reabre o
   formulário inteiro, com a faixa explicando que a Freitas segue com a versão
   enviada. Reenvie **sem mudar nada** — a tela recusa ("Nada mudou…"). Mude o
   Incoterm ou o produto e **Reenviar para a Freitas**: nova rodada, prazo
   recomeça.
7. **"Reenviada".** O cartão e o detalhe mostram o chip (discreto, abaixo do
   selo) e os campos alterados, anterior → novo. No painel → Cotação V2, a linha
   diz "Inbox · revisão de entrada (Para Cotar) · 2ª rodada" e o que mudou.
   *Ponto:* o Inbox não é fila nova — é a visão da revisão de entrada sobre Para
   Cotar.
8. **Cancelar.** Numa outra cotação em revisão, "Cancelar solicitação": o botão
   fica travado até a justificativa ter 10 caracteres, com contador. Como nenhum
   agente recebeu o pedido, o diálogo diz que ela vai direto para as canceladas.
   Confirme: a tela mostra a justificativa e o atalho para o Histórico.
9. **Painel → Devolver ao cliente.** Escolha um motivo. O cartão volta para
   "Preencher detalhes" com o motivo e "Corrigir e reenviar"; ao reenviar, o
   histórico é preservado e o chip "Reenviada" volta com o diff da correção.
10. **Painel → Aprovar e disparar RFQ → Propostas chegaram.** A revisão de
    saída mostra "Liberar N propostas" e o texto de que a correção ao agente é
    pedida por e-mail. *Ponto:* se a cotação deixar de atender à lista (os
    cenários carregados mostram isso), liberar fica bloqueado com o motivo — e
    as flags Crítico/Alto não entram na regra.
11. **Liberar.** Desmarque uma proposta para mostrar que só o liberado chega ao
    cliente. O cartão vira "Nova" e o sino avisa.
12. **Continuar com esta proposta → Aprovar.** O diálogo diz que a cotação
    passa a "Aprovada pelo cliente" e a Freitas recebe a instrução de
    fechamento. A cotação vai para "Aprovadas" e o embarque aparece em Meus
    Embarques.
13. **Fechamento direto** (opcional, ~2 min). Nova cotação → "Fechar direto com
    agente preferido". Escolha Izmir → Santos para mostrar o estado vazio (sem
    agente preferido → "Cotar normalmente", com a rota preenchida); depois
    Shanghai → Santos, preencha e envie. Painel → **Fechamento direto** →
    aprove ou devolva.

---

## 4. Roteiro B — Novo embarque via PO (~10 minutos)

Onda 2 ou superior.

1. **Central de trabalho → "Abrir novo embarque"** (ao lado de "Perguntar ao
   Centrix"). O mesmo botão existe no cabeçalho de Meus Embarques.
2. **O modal** oferece os dois caminhos: abrir uma cotação (fluxo de sempre) ou
   abrir uma PO. Cancelar e o X fecham sem criar nada.
3. **Enviar o PO.** Anexe qualquer arquivo. A leitura simulada leva ~2,5 s e
   mostra os dez campos sendo lidos. "Continuar" só habilita no fim.
4. **Conferir os dados.** O formulário vem preenchido, com o PO anexado ao lado.
   Os campos com leitura de baixa confiança ficam em âmbar, e o trecho
   correspondente aparece destacado no documento.
5. **PO duplicado.** O PO lido já existe num embarque do cliente: o campo fica
   vermelho, o diálogo mostra o embarque existente e **"Enviar à Freitas" fica
   desabilitado** até o cliente confirmar ou trocar o número.
6. **Enviar.** "EMB-xxxx criado. A Freitas vai revisar antes de ativar." O
   embarque entra na carteira com o selo **"Em análise"**, o chip "Sem cotação",
   o próximo passo com o prazo, o indicador no topo e o filtro "Em análise (n)".
   *Ponto:* origem, destino e peso aparecem como **"A definir"** — ninguém
   estabeleceu a rota ainda, e o protótipo não inventa um porto.
7. **Painel → Embarque via PO → Devolver ao cliente**, com motivo e os campos a
   corrigir. O cartão vira "Devolvido" e os campos ficam destacados no
   formulário.
8. **Corrigir e reenviar**, depois **Validar e ativar**. O embarque vira ativo.
9. **Opções A e B.** No painel, troque "Selo na carteira" por "Aba própria" e
   mostre a aba "Em análise", com os três passos e as ações Editar/Cancelar. A
   escolha entre as duas ainda é do produto.
10. **Preencher manualmente** e **falha de leitura** (toggle no painel) são as
    duas variações: sem leitura e sem confiança por campo, e com o anexo
    guardado mas os campos vazios.

---

## 5. Roteiro C — Vincular cotação e Visão por PO (~4 minutos)

1. **Vincular cotação.** Abra um embarque ativo aberto por PO: chip "Sem cotação
   vinculada" e o card "Cotação vinculada". O modal busca por número, referência
   do PO ou cliente e lista só cotações aprovadas. Ao vincular, o embarque
   mantém o mesmo ID e o chip some.
2. **Visão por PO** (aba em Meus Embarques). Carregue "PO dividido em 3
   embarques" no painel: um pedido com três parciais, cada uma num estágio, e a
   régua com a chegada prevista de cada carga. *Ponto:* só as datas que já
   existem entram na régua; carga sem previsão aparece na lista e fora dela.

---

## 6. Autorresposta

Seção **Freitas simulada**: ligue "A Freitas responde sozinha" e escolha o tempo
(3 a 60 s, padrão 8).

- As etapas em que a Freitas segura o trabalho avançam sozinhas: revisão de
  entrada → agentes cotando → revisão de saída → liberada; e, no embarque, em
  análise → ativo.
- **Funciona com o painel fechado**, que é como uma demonstração de verdade
  acontece: feche o Sheet, fale, e o cartão anda.
- O relógio conta a partir do momento em que a etapa começou, então **um reload
  não reinicia a contagem**.
- **Devolver nunca é automático.** Devolução é sempre um clique seu.
- **Cotação bloqueada pelos hardblocks não anda sozinha**: a autorresposta não
  aprova a entrada nem libera propostas dela. Ela espera um clique seu
  (normalmente "Devolver ao cliente", com o motivo já sugerido).

---

## 7. Entre uma apresentação e outra

Painel → **Reiniciar demonstração** → confirmar.

Apaga **só** o que o painel guardou (prefixo `centrix-proto-v2:`): módulos,
Freitas simulada, jornadas de cotação e de embarque. Não toca no login, nos
rascunhos de cotação do portal nem no tema, e o painel continua aberto — quem
acabou de reiniciar ainda está apresentando.

Depois do reset, **todos os módulos voltam ligados**. Reaplique a onda antes de
começar.

---

## 8. Limites conhecidos — diga antes que perguntem

- **Não há backend das jornadas V2.** Estados de revisão, devolução com motivo,
  liberação por proposta, PO como registro, SKUs e dedup vivem no navegador. Na
  versão integrada tudo isso é banco e API — ver o handoff em
  `HANDOFF-BACKEND.md`.
- **O filtro de "só as propostas liberadas" é decisão de tela**, não garantia. Na
  versão real a regra precisa estar na camada de dados e na API.
- **Uma cotação aberta durante a demonstração não recebe proposta de verdade** (o
  e-mail do RFQ é um log). As propostas que aparecem são ilustrativas, e a
  aprovação delas é simulada — ela cria o embarque no navegador, não no banco. A
  aprovação de uma proposta **real** continua passando pela API.
- **O guard rail dos "5 primeiros embarques" não foi modelado.** Não está
  definido se a contagem é por cliente ou no total, nem quem a libera. Aqui
  **todo** embarque aberto por PO passa pela revisão.
- **O prazo de revisão é 1 hora** na entrada e na saída (decisão do Orsi,
  29/09/2026). Se a hora conta em horário corrido ou comercial ainda está em
  aberto: o protótipo assume corrido (`review-sla.ts`).
- **A Visão por PO é só protótipo**, para validar aderência. A gestão por PO
  (PO dividido, linkagem linha a linha) é V2.
- **As flags não são controle de acesso.** Elas moram neste navegador, não há
  nada por cliente e nenhum endpoint recusa chamada de módulo desligado.
- **Todos os dados são fictícios.**

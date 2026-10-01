# Roteiro de demonstração — Protótipo V2

Como apresentar as três frentes do protótipo V2 (feature flags por módulo,
Cotação V2 e Novo embarque via PO) do lado do **cliente**. A Freitas não tem
tela: ela é simulada no painel.

Tudo roda no navegador. Não há backend das jornadas V2, não há envio de e-mail,
não há integração.

### Produção x Preview — leia antes de escolher o roteiro

| | Produção (domínio que os clientes veem) | Preview (`NEXT_PUBLIC_PROTO_INTERNAL=1`) |
|---|---|---|
| Painel | "Painel de demonstração": **Tipo de cliente**, **Boas-vindas**, **Reiniciar demonstração** | tudo: + Módulos liberados, Freitas simulada, Cotação V2, Embarque via PO, Fechamento direto |
| Módulos | **fixos: todos visíveis** (ondas guardadas no navegador são ignoradas) | o painel escolhe (padrão: todos) |
| Freitas | **responde sozinha, sempre**, 8 s por etapa | o painel liga/desliga (padrão: desligada, para conduzir no clique) |
| Roteiros | **A, B e C em modo "anda sozinho"** (abaixo), **D**, **E** e **F** | todos |
| Só em Preview | — | ondas (§2), cenários carregados, devolver/liberar/validar no clique |

**Em produção, nunca dependa do painel para a jornada andar.** Envie a cotação,
o fechamento direto ou o PO como cliente e espere: em ~8 s cada etapa da
revisão da Freitas avança sozinha (cotação: entrada → propostas → saída →
liberada, ~25 s; fechamento direto e PO: ~8 s). A Freitas automática nunca
devolve — devolução só existe no Preview, pelo painel.

---

## 1. Antes de começar

**Abrir o painel de demonstração** (ele fica escondido; o cliente que está
testando o portal não pode encontrá-lo por engano):

| Ação | Efeito |
|---|---|
| `?demo=1` em qualquer URL do portal | liga e guarda a escolha **nesta aba** |
| `?demo=0` | desliga |
| `Ctrl+Shift+D` | alterna |

Ligado, aparece a aba **Demonstração** no canto inferior esquerdo (o direito é o botão "Ajuda" do cliente). Ela abre o
Sheet "Painel de demonstração" (no Preview, "Painel de demonstração · simulação
da Freitas").

A escolha vive em `sessionStorage`: sobrevive à navegação e **morre ao fechar a
aba**. Se você fechar o navegador entre uma apresentação e outra, precisa de
`?demo=1` de novo.

**Preparar o estado — só no Preview** (1 minuto, antes da plateia entrar; em
produção não há o que preparar):

1. Abra o painel, seção **Módulos liberados** → botão **Tudo liberado**.
2. Seção **Cotação V2** → **Carregar cenários de demonstração**.
3. Seção **Embarque via PO** → **Carregar cenários de demonstração** e, se for
   mostrar a Visão por PO, também **PO dividido em 3 embarques**.
4. Seção **Freitas simulada** → deixe **desligada** para conduzir no clique, ou
   ligue com 8 s se preferir que as etapas andem sozinhas enquanto você fala.

---

## 2. As ondas, e o que cada uma mostra — só Preview

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

**Preview** (conduzido no clique, com cenários e devolução). **Em produção**,
use o modo "anda sozinho": crie uma cotação, mostre o cartão "Em revisão", fale
por ~25 s e abra a comparação liberada; aprove. Os passos de devolver, liberar
seletivamente e hardblock na saída são só Preview.

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

**Em produção**: abrir, preencher, enviar e mostrar o embarque ficando ativo
sozinho em ~8 s. Devolução com campos marcados, falha de leitura, "selo ou aba"
e cenários carregados são só Preview.

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

O vínculo funciona em produção com um embarque que você mesmo criou no Roteiro
B. "PO dividido em 3 embarques" (cenário do painel) é só Preview.

1. **Vincular cotação.** Abra um embarque ativo aberto por PO: chip "Sem cotação
   vinculada" e o card "Cotação vinculada". O modal busca por número, referência
   do PO ou cliente e lista só cotações aprovadas. Ao vincular, o embarque
   mantém o mesmo ID e o chip some.
2. **Visão por PO** (aba em Meus Embarques) — funciona em produção.
   - A faixa de resumo responde de cara: POs ativos, chegam em 7 dias, em risco
     e sem previsão. Cada chip **filtra** a tela; clicar de novo desfaz.
   - **Linha do tempo** (padrão): o eixo é o MESMO para todos os POs, com
     "Hoje" marcado; uma barra por embarque, com prontidão → embarque →
     chegada prevista só onde a data existe, e um trilho pontilhado de hoje até
     a chegada. Passe o mouse ou o Tab numa barra: as datas aparecem.
   - **"Informe a data de prontidão"**: onde não há previsão, a barra tracejada
     convida a agir (leva ao detalhe do embarque). *Ponto:* é dessa data que sai
     o ETA.
   - Grupos por quando chega (esta semana, este mês, depois, sem previsão);
     abra um PO para ver os embarques, a etapa em mini-passos e os SKUs.
   - **Lista**: a mesma informação sem eixo. No celular, cada PO vira um cartão
     com mini barra de progresso.
   - **"Seus pedidos | Exemplo"**: o Exemplo é um conjunto fictício com datas
     calculadas a partir de HOJE (chegadas em 3, 12 e 40 dias, um PO dividido
     em 2 embarques, um em risco, um sem previsão, um já entregue). Ele nunca
     envelhece e nunca se mistura aos pedidos do cliente. No Preview a aba abre
     nele; em produção abre nos pedidos do cliente, com o Exemplo a um clique.
     *Diga:* "isto é um exemplo; os seus pedidos estão no botão ao lado".
   - Datas de rastreamento de demonstração (`is_mock`) nos pedidos do cliente
     aparecem com o selo "Pré-visualização" e a frase que diz isso.
   - Com **SaaS puro**, a tela é a mesma, sem citar a Freitas.

---

## 5a. Roteiro F — Boas-vindas "uau" (~2 minutos) — produção e Preview

Para mostrar o primeiro acesso: painel → **Boas-vindas** → **Reiniciar
onboarding** (reinicia também o checklist "Primeiros passos"). Feche o painel e
recarregue o Início.

1. **Tour** de 6 passos (ou "Pular tour").
2. **Bem-vindo, {empresa}**: a saudação com o nome da empresa. "Pular" fica no
   canto em todas as telas, e Esc também pula.
3. **O que mais importa?** Custo, prazo ou visibilidade, em cartões.
4. **Rotas principais**: escolha origem e destino no mapa ou nos botões; o arco
   se desenha e aparece um cartão da rota com prazo típico e tendência —
   **sempre com a etiqueta "exemplo"**. *Diga:* no produto, isso vem dos dados
   reais de frete (data lake); aqui é um exemplo fictício.
5. **Seu papel**: Comex, Compras, Financeiro ou Gestor. Ele ordena a Home.
6. **Montar minha Home**: os cards entram em sequência, com "Sua Home está
   pronta", as rotas escolhidas e o porquê da ordem. Logo abaixo, **Primeiros
   passos** (abrir a 1ª cotação, configurar alertas, convidar um colega — tudo
   simulado), com anel de progresso e uma comemoração discreta no fim.

Fechar o navegador no meio retoma na mesma tela. Quem prefere menos movimento
(`prefers-reduced-motion`) vê tudo sem animação.

## 5b. Roteiro D — Cliente SaaS puro (~6 minutos) — produção e Preview

Painel → **Tipo de cliente** → **SaaS puro**.

1. **Nova cotação**: a faixa "Você informa tudo" substitui qualquer
   pré-preenchimento; mesmo vindo do Radar, nada entra sozinho. A aba de
   documentos explica que ninguém lê os arquivos.
2. **Fechamento direto**: sem tabela de rotas da Freitas; o cliente digita
   origem, destino e o agente dele.
3. **Novo embarque via PO**: anexe um arquivo — ele fica "aguardando
   conferência", sem leitura; o formulário abre vazio.
4. **Detalhe de um embarque**: a faixa mostra de onde vem cada bloco e que as
   etapas operadas pela Freitas não se aplicam.

Volte para **Com operação Freitas** antes do próximo roteiro.

## 5c. Roteiro E — Auditoria fora de ordem (~4 minutos) — produção e Preview

Auditoria → **Adicionar à auditoria** → "Usar embarque" (E-DEMO-02).

1. Clique direto na etapa **4**: nada bloqueia; o painel diz o que falta e em
   qual etapa. Cada etapa tem o próprio estado (não iniciada, em andamento,
   pendente de documento, concluída, com divergência).
2. Em "Fontes e próximos passos", **Rever documento** na Referência comercial:
   abre a etapa 3 no documento, com a faixa "Voltar para a etapa 4".
3. Saia (Voltar à Auditoria), volte, escolha outra cotação e clique na etapa 1:
   o primeiro rascunho está em "Rascunhos em andamento", parado na etapa 4.
   **Continuar** volta exatamente lá, com o que foi digitado.



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
- **As flags não são controle de acesso.** Elas moram neste navegador e nenhum
  endpoint recusa chamada de módulo desligado.
- **A gestão de acessos não está neste protótipo**: é ferramenta interna; o protótipo dela está na branch `feat/proto-interno-acessos`.
- **O link público de cotação não está no protótipo** (risco listado no handoff).
- **Todos os dados são fictícios.**

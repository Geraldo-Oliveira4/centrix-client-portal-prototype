# Centrix — Portal do Cliente (Protótipo) — Contexto para IA

Meta-contexto para qualquer IA (Claude etc.) trabalhando neste repositório.
Leia isto antes de editar. Convenções específicas do frontend copiado do Centrix
estão em `frontend/CLAUDE.md`.

## O que é este projeto

Réplica **standalone** do Portal do Cliente do Centrix (plataforma de
importação/logística da Arboria para a Freitas COMEX). Objetivo: o cliente rodar
só o portal na máquina dele, sem AWS, com funcionalidade parecida com a real.
**Não é produção — é um protótipo demonstrável.**

## MUDANÇA DE PROPÓSITO — 12/08/2026 (leia antes de "corrigir" qualquer mock)

**O protótipo deixou de ser uma réplica standalone que distingue dado real de
mock para o usuário final. Ele agora é REFERÊNCIA VISUAL para o Mauro construir
a versão integrada de verdade.** Decisão do Vinicius, confirmada nesta data.

Consequência prática: onde a tela dizia **"Pendente integração"**, ela passa a
mostrar **dado ilustrativo rico** — como a tela vai se comportar quando os dados
existirem. Isso vale para o portal INTEIRO, não só para o Mapa.

Telas afetadas e o que mudou em cada uma:

| Tela | Antes | Agora |
|---|---|---|
| Meus Embarques (Lista, detalhe, timeline) | ETA e risco de atraso "Pendente integração" em quase todo embarque | Todos os embarques com ETA, risco e milestone (via `topup_tracking_full.py`) |
| Auditoria | "0 embarques elegíveis", banner "Conceitual" | Elegíveis reais (milestone `AVAILABLE`), banner "Referência visual", 9 exemplos de conciliação |
| Inteligência > Performance | Rotas, Armadores e Economia com selo `pending` | Os três populados; `preview` no lugar de `pending` |
| Inteligência > Executivo | On-time rate e Economia sem valor | Ambos com valor; Economia vem da MESMA fonte do Performance |
| Mapa (Prompt 15) | SVG ilustrativo | Leaflet + OSM, marcadores sem distinção real/aproximado |

**O que NÃO mudou, e não pode afrouxar sem decisão explícita:**

- **`tracking_is_mock` continua obrigatório** em toda linha de tracking gravada
  por script. A infraestrutura de sinalização segue de pé; o que mudou foi o que
  a UI faz com a AUSÊNCIA de dado, não a marcação do dado ilustrativo. As
  checagens `O14`/`O15`/`O16` do e2e continuam valendo e passando.
- **O seed continua limpo.** Banco recém-semeado nasce sem tracking nenhum; quem
  popula é top-up explícito (`O15` trava isso). A demo é uma escolha de quem
  prepara a apresentação, não um efeito colateral do `make seed`.
- **`ProvenanceBadge` continua existindo e em uso** nos lugares do portal que o
  usavam. Aposentá-lo é decisão separada, ainda não tomada. O que mudou foi o
  VALOR em alguns pontos (`pending` -> `preview`), não o componente. Em
  28/08/2026 os dois cards da **Comparação de Propostas** (Confiabilidade e
  Mercado, no detalhe da cotação) deixaram de marcar real x ilustrativo, pelo
  mesmo motivo do Mapa — recorte escopado, ligado por uma chave
  (`frontend/app/portal/inteligencia/lib/proposal-provenance.ts`), sem tocar em
  Auditoria, Mapa nem `tracking_is_mock`.
- **Nada aqui fabrica número onde a aritmética é real.** On-time rate e desvio
  por rota são CALCULADOS pela mesma `computeDelayRisk` do badge de cada
  embarque; o que é ilustrativo é o dado de entrada. Ausência continua virando
  `null`/"—", nunca `0` — "0% no prazo" é acusação, não lacuna.
- **Economia tem fonte ÚNICA** (`inteligencia/lib/illustrative-kpis.ts`),
  consumida por Performance e Executivo. Em 05/08/2026 as duas telas davam
  respostas diferentes para a mesma pergunta e o número foi removido das duas; ele
  só voltou porque agora é calculado uma vez. **Não recalcule savings em outro
  lugar.**

**Uma única dependência de rede externa**, decidida em 12/08/2026: os tiles do
OpenStreetMap na aba Mapa de Meus Embarques (Leaflet, sem chave de API). Todo o
resto — banco, storage, e-mail, auth — continua local ou mockado. O mapa degrada
sozinho quando não há rede: sem os tiles, as rotas, os marcadores e os clusters
continuam desenhados e uma nota diz que só o mapa base está indisponível. Ao
acrescentar qualquer outra chamada externa, trate como decisão de produto, não
como detalhe de implementação.

O repositório de produção do Centrix fica ao lado (`../centrix`). Este repo foi
gerado copiando o domínio `client_portal` do Centrix e adaptando para rodar local.

## Arquitetura

```
backend/                         # FastAPI (substitui AWS Lambda + API Gateway)
  app/
    main.py                      # cria o app, instala mocks, monta routers
    event_shim.py                # Request HTTP -> evento API Gateway v2 + auto-login (DEMO_SUB)
    mocks.py                     # S3 -> filesystem local; Graph/e-mail -> no-op
    prototype_flow.py            # auto-aprovação (analista simulado) — ver abaixo
    audit_preview.py             # MOCK do comparativo de auditoria — ver abaixo
    routers/
      portal.py                  # rotas /portal/* -> handlers client_portal (+ audit_preview)
      auth.py                    # /portal/auth/* -> stubs (sem Cognito)
      local_s3.py                # PUT/GET /_local_s3/{key} no filesystem
  shared/                        # COPIADO do Centrix quase sem alteração (models, repos, domain, services)
  lambdas/client_portal*/        # COPIADO do Centrix — handlers originais intactos
                                 #   (+2 novos de exportador, +2 de embarque,
                                 #    +3 de agentes/preferências)
  alembic/                       # COPIADO — migrations 001..089 (+090..095, do protótipo)
  scripts/
    seed_prototype.py            # cliente demo + 9 cotações + agentes + DNA + 7 embarques
    e2e_test.py                  # suíte E2E (131 checagens)
frontend/                        # CÓPIA do app Next.js do Centrix (só /portal ligado ao backend)
  vendor/arboria-ui, arboria-config   # deps @arboria-tech vendorizadas (file:), sem GitHub Packages
docker-compose.yml               # Postgres 16 local
```

### Princípio central: não alterar o código copiado do Centrix

`shared/`, `lambdas/` e `alembic/` são cópias fiéis do Centrix. **Toda adaptação
do protótipo vive na camada `app/`** (shim, mocks, routers, prototype_flow). Isso
mantém a paridade comportamental com o original e facilita re-sincronizar com o
Centrix no futuro. Ao corrigir algo, prefira ajustar `app/` a editar `shared/`.

Divergências conhecidas em relação ao Centrix (mantenha esta lista curta e
atualizada — é o que dificulta um futuro re-sync):

- `shared/database/connection.py` — string do Postgres local + pool maior, em
  vez do pool tunado p/ Lambda.
- **Cadastro de exportador pelo portal** (não existe no Centrix, onde o
  exportador é catálogo global do analista):
  - `alembic/versions/090_add_client_id_to_exporters.py` — coluna `client_id`
    (nullable) em `centrix_exporters`. NULL = exportador global do analista;
    preenchido = cadastrado por aquele cliente no portal.
  - `shared/database/models/quotation/exporter.py` — mapeia a coluna acima.
  - `shared/database/repositories/portal_exporter_repository.py` — **arquivo
    novo**, queries escopadas ao cliente (o `exporter_repository` do analista é
    global e não filtra).
  - `lambdas/client_portal/{list_my_exporters,create_my_exporter}/` — handlers
    novos, sem contrapartida no Centrix.
  - `app/quotation_exporter.py` — vincula o exportador à cotação depois do
    create, porque `create_quotation_core` (copiado) não conhece `exporter_id`.
- **Origem da cotação aberta pelo portal** (não existe no Centrix, onde não há
  Radar de Preços nem de onde vir um clique rastreado):
  - `app/quotation_origin.py` — **arquivo novo**. Grava, depois do create e no
    mesmo arranjo do `quotation_exporter`, um log `quotation_portal_origin` com
    `{origin, route}`. É **log, não coluna**, pela mesma razão que
    `quotation_created_by_portal` é log: origem é fato do nascimento, não
    atributo mutável — e assim não há migração, a agregação é SQL comum sobre
    `centrix_quotation_logs` (contável e filtrável) e ninguém sobrescreve depois.
  - É uma **segunda dimensão**, não substituta: uma cotação de Radar é portal E
    radar, e `batch_fetch_created_by_portal` continua devolvendo exatamente o que
    devolvia. Ação própria justamente para não contar a mesma cotação duas vezes.
  - Lista **fechada** de origens (`PORTAL_ORIGINS`): o valor vem do corpo da
    requisição, e origem desconhecida é ignorada em silêncio — mesma disciplina
    de `update_my_preferences`. Travado por `R1`..`R6` no e2e.
  - O router anota `portal_origin`/`portal_origin_route` nas respostas de
    `GET /quotations`, `GET /quotations/{id}` e no 201 do create. Campo
    **aditivo**: cotação sem origem sai sem a chave, exatamente como antes.
  - `fetch_origins` é a consulta pronta para o serializer do Kanban do lado do
    Centrix acender o ícone do card (`created_from_radar`). Aqui o Kanban do
    analista não é servido por backend nenhum, então a marca é só visual.
- **Acompanhamento de embarque pelo portal** (no Centrix, GE é tela de analista;
  o cliente não enxerga o Processo/Embarque). Só leitura — nenhuma escrita de GE
  pelo portal:
  - `shared/database/repositories/portal_shipment_repository.py` — **arquivo
    novo**, queries escopadas ao cliente (o `processo_repository.list_for_kanban`
    do analista é global e não filtra).
  - `shared/portal_shipment_helpers.py` — **arquivo novo**, serializers com
    projeção reduzida (sem `inova_processo_id`, sem `client_id`).
  - `lambdas/client_portal/{list_my_shipments,get_my_shipment}/` — handlers
    novos, sem contrapartida no Centrix.
  - `client_reference` (a **PO do cliente**) viaja da cotação para o embarque
    por **join**, não por cópia: `portal_shipment_repository` faz OUTER JOIN
    `Processo.quotation_id -> Quotation.client_reference` e o serializer expõe o
    campo. Não existe coluna de PO em embarque, e não deve existir — duas
    cópias divergiriam na primeira correção de PO. Processo aberto fora do
    portal não tem cotação e por isso não tem PO: `null` é a resposta certa, não
    lacuna a preencher (travado por `O17`..`O20` no e2e).
  - Nada do módulo GE do analista (`lambdas/shipment*`, rotas `/shipments`) foi
    copiado: as tabelas e repositories existem, os handlers não.
- **Campos de rastreamento da companhia marítima** (estrutura para a integração
  ShipsGo, que ainda não existe — trabalho do Mauro, ago-out/2026):
  - `alembic/versions/091_add_tracking_fields_to_embarques.py` — quatro colunas
    nullable em `centrix_shipment_embarques`: `tracking_first_eta`,
    `tracking_current_eta`, `tracking_eta_is_actual`, `tracking_data_status`
    (CHECK: NULL | `COMPLETE` | `INCOMPLETE`).
  - `alembic/versions/092_add_tracking_milestone_and_mock_flag.py` — mais duas:
    `tracking_last_milestone` (CHECK: NULL | `OCEAN_TRANSIT` | `ARRIVAL` |
    `DISCHARGE` | `AVAILABLE`), que move os degraus pós-embarque da timeline, e
    `tracking_is_mock`, que marca a linha como dado de demonstração.
  - `alembic/versions/093_add_tracking_last_milestone_at.py` — mais uma:
    `tracking_last_milestone_at`, **quando** o milestone acima aconteceu. Existe
    porque o alerta de demurrage precisa dizer "liberado em [data]"; derivar do
    `tracking_current_eta` seria errado (aquilo é a chegada no POD, e a
    liberação vem depois dela). NULL mesmo com milestone conhecido é legal — a
    companhia pode reportar o estágio sem datar.
  - `shared/database/models/shipment/embarque.py` — mapeia as colunas acima.
  - `shared/portal_shipment_helpers.py::serialize_tracking_for_portal` — expõe o
    bloco `tracking` na lista e no detalhe.
  - **Nenhum handler e nenhum seed escreve nessas colunas**: num banco recém
    semeado elas ficam NULL e o portal mostra "Pendente integração" em vez de um
    ETA inventado. A única coisa que grava é o top-up de demonstração (seção
    abaixo), e ele sempre grava `tracking_is_mock = TRUE` junto.
- **Seleção de agentes e preferências do cliente pelo portal** (no Centrix o
  cliente não tem tela de agentes nem edita o próprio perfil de operação — ver
  a seção "DNA editável pelo cliente" abaixo):
  - `alembic/versions/094_add_portal_client_preferences.py` — tabela nova
    `centrix_portal_client_preferences`, uma linha por cliente, tudo nullable:
    `paused_agent_ids` (JSONB), `preferred_port`, `default_incoterm`,
    `uses_insurance`, `cargo_particularities`. **Ausência de linha é o estado
    normal** e nenhum seed a popula.
  - `shared/database/models/quotation/portal_client_preferences.py` e
    `shared/database/repositories/portal_client_preferences_repository.py` —
    **arquivos novos**, escopados ao cliente como o `portal_exporter_repository`.
  - `shared/portal_agent_helpers.py` — **arquivo novo**, projeção reduzida do
    agente: sem `reliability_score`, `total_quotations` nem `error_count`. O
    portal não expõe score de agente ao cliente, e a regra vale no backend, não
    só no que a tela renderiza (travado por `Q2` no e2e).
  - `lambdas/client_portal/{list_my_agents,get_my_preferences,update_my_preferences}/`
    — handlers novos, sem contrapartida no Centrix.
  - `app/agent_pause.py` — filtra os agentes pausados da resposta de
    `GET /portal/quotations/{id}/agents`. Vive em `app/` porque
    `list_quotation_agents` é copiado do Centrix, que não conhece "pausado". É o
    que faz o toggle ser real em vez de decorativo (travado por `Q8`); **não**
    remove agente já selecionado numa RFQ montada — pausar vale para as
    próximas.
- `shared/portal_helpers.py` — `closed_at` e `declined_at` acrescentados a
  `_QUOTATION_PORTAL_FIELDS`. Leitura aditiva de colunas que já existem no
  modelo e que o state machine já grava; o Histórico do portal data e filtra a
  cotação fechada por elas em vez de chutar pelo `updated_at`.

## DNA editável pelo cliente (mudança de direção — 05/08/2026)

**Isto não é regressão a corrigir: é extensão intencional de escopo.** A regra
antiga do checklist de não-regressão dizia que não existe fluxo de DNA do
Cliente dentro do portal — ela está **superada**. Direção confirmada pelo Victor
Orsi (dono do processo, Freitas) na revisão do protótipo de 05/08/2026: o DNA
hoje é planilha mantida só pela Freitas, e o cliente passa a editar a parte
operacional dele direto no portal.

Regra que substitui a antiga:

> O DNA do Cliente é editável pelo cliente em **Minhas Preferências**, mas só os
> campos operacionais/logísticos (porto/aeroporto preferido, incoterm padrão,
> uso de seguro, particularidades de carga, agentes bloqueados) — **nunca** os
> dados internos da Freitas: contatos, acordos comerciais, restrições
> contratuais, analista designado.

Como isso é sustentado no código, e o que não pode afrouxar:

- O que o cliente edita **não** vai para `centrix_quotation_client_dna`. Aquele
  model é do analista e copiado do Centrix; escrever nele pelo portal
  sobrescreveria campo de analista e divergiria do original. A camada do cliente
  é a tabela nova da migração 094, ao lado do DNA e sem tocá-lo. Quando o DNA
  editável for implementado de verdade, o merge das duas fontes é decisão de
  produto — aqui elas continuam distinguíveis.
- `update_my_preferences` aceita uma **lista fechada** de campos; qualquer outra
  chave é ignorada em silêncio. Um PUT com `contact_email` ou
  `assigned_analyst` retorna 200 sem gravar nada (travado por `Q12` no e2e).
- O bloco "Perfil de operação" leva selo "Pré-visualização" na tela. É a única
  vez no portal em que `preview` **não** marca número fabricado: marca um bloco
  funcional cujo efeito a jusante ainda não existe (as escolhas ficam salvas mas
  ainda não preenchem a próxima cotação). O texto do bloco diz isso — é ele que
  sustenta o selo, não apague ao mexer no layout.
- **Agente continua sendo curadoria da Freitas.** O cliente seleciona entre os
  pré-aprovados (`default_agents` do DNA), nunca cadastra: `paused_agent_ids` só
  aceita id que já esteja nessa lista (400 caso contrário, travado por `Q10`), e
  o CTA "Solicitar novo agente" é pedido, não self-service. Marketplace aberto
  segue descartado.
- "Pausado" (Meus Agentes) e "bloqueado" (Minhas Preferências) são **uma coluna
  só**, exposta em duas telas. Duas listas criariam um estado contraditório sem
  desempate ("pausado mas não bloqueado" vale qual?).

## Fronteiras mockadas (por design)

| Real (Postgres local) | Mockado / simplificado |
|---|---|
| kanban, detalhe, propostas, histórico, recomendação (score determinístico) | extração PDF/e-mail (IA/OpenRouter) — não exercida |
| cadastro de exportador pelo cliente + vínculo na nova cotação | — |
| seleção de agentes pelo cliente (toggle ativo/pausado filtra a montagem da RFQ) e preferências operacionais salvas (migração 094) | **limite de agentes por plano** — não existe modelo de planos ("Pendente integração"); **fila de avaliação** do CTA "Solicitar novo agente" — não há destinatário; **efeito do perfil de operação** na próxima cotação — o DNA que a Freitas usa ainda vive fora do portal |
| acompanhamento de embarque (Processo/Embarque criados na aprovação) | histórico de transições do embarque (não existe tabela) e ETA/SLA (`processos.datas` fica NULL) |
| — | rastreamento da companhia marítima (ShipsGo): colunas `tracking_*` existem e ficam NULL; ETA, risco de atraso e os marcos pós-embarque aparecem como "Pendente integração" |
| — | **documentos do embarque** (BL, Invoice, Packing List, Certificado de Origem): a seção "Documentos" do detalhe é montada no frontend (`embarques/lib/shipment-documents.ts`). O módulo GE do analista tem `EmbarqueDocumento`, mas nenhum handler do portal o expõe — não há upload nem download de verdade |
| — | **"Aprovar booking" / "Enviar arquivo" do detalhe do embarque**: desde 17/08/2026 o modal confirma em vez de encerrar com "Nada foi enviado", e a faixa de ação vira recibo e o documento anda um degrau. Continua **sem rota de escrita**: é estado de componente que morre no refresh, com selo `preview` no sucesso. Detalhe em `frontend/CLAUDE.md` |
| — | **Radar de Preços** (`Inteligência > Radar de Preços`): preço de frete por rota, variação contra a média e tendência. Não existe Data Lake nem tabela de frete de mercado neste repo — as ROTAS e a frequência são reais (saem dos embarques do cliente, pela mesma resolução do Mapa), todo número em dinheiro é ilustrativo. Modelado com dado simulado a pedido do Vinicius, para validar o valor da proposta com 2-3 clientes antes de puxar dado real |
| origem da cotação vinda do Radar (`portal_origin`, log imutável, contável) | **notificação de preço** (`Meus Embarques > Alertas`, 5º tipo): herda a mesma divisão do Radar — rota real, número ilustrativo — e não há cron nem serviço de push que a dispare. Ela é montada no frontend junto do resto do feed, a cada abertura da tela |
| — | **risco por etapa e gatilho de ação** da timeline (`embarques/lib/step-insights.ts`): o percentual histórico da rota é ilustrativo; onde há aritmética real (atraso da companhia), ela manda e o número é o mesmo do badge do topo |
| valor cotado na conferência da cotação (proposta vencedora) | **valor realizado** — fabricado em `app/audit_preview.py`; não existe fatura/BL neste repo |
| aprovar/recusar/cancelar, montar+disparar RFQ | envio de e-mail (Microsoft Graph) -> log |
| upload de documentos | S3 -> `backend/storage/` via `/_local_s3` |
| — | Cognito -> auto-login (sem login real); guard rail -> simplificado |

Auto-login: `app/event_shim.py::DEMO_SUB` injeta sempre o `sub` do `portal_user`
demo semeado. O frontend também sempre apresenta uma sessão demo
(`frontend/lib/portal-session.ts`).

## Simplificação da aprovação (happy path)

No Centrix real, aprovar leva a `APROVADA_PELO_CLIENTE` e a cotação espera um
analista fechar (guard rail, ARB-2449). Aqui, `app/prototype_flow.py` faz o
**analista automático**: após o handler original de aprovação ter sucesso, o
router avança `APROVADA_PELO_CLIENTE -> FECHADA`, e o card vai para "Aprovadas".
Está todo comentado lá. Guard rail e etapa manual do analista ficam de fora.

Efeito colateral (do Centrix, não do protótipo): a transição para `FECHADA` passa
pelo `quotation_state_machine`, que chama
`shipment_service.provision_processo_from_quotation`. Ou seja, toda aprovação no
portal cria um Processo + Embarque (`solicitado`) de verdade — é o que alimenta a
tela "Meus Embarques".

## Rastreamento da companhia marítima (estrutura pronta, integração ausente)

A integração ShipsGo **não existe** neste repo (e nem no Centrix ainda). O que
existe é o lugar onde ela vai encaixar, e a regra de exibição enquanto não
encaixa: **nenhum número fabricado**.

- Colunas (migração 091, todas NULL): `tracking_first_eta`,
  `tracking_current_eta`, `tracking_eta_is_actual`, `tracking_data_status`.
  Mapeamento para o payload do ShipsGo está no docstring da migração.
- Risco de atraso: **não é coluna**, é derivado. `delta_dias = ETA atual (ou
  chegada real, se `IsActual`) − primeiro ETA`, com semáforo por **dia
  absoluto** (≤0 no prazo · 1–3 atenção · >3 atraso) — percentual distorceria a
  comparação entre rota curta e rota longa. A regra vive numa função pura no
  frontend (`app/portal/embarques/lib/delay-risk.ts`), com teste unitário
  (`npm run test:unit`), e por isso não há endpoint novo aqui.
- Três estados de dado, que **não** são sinônimos e aparecem diferentes na tela:
  `NULL` = não integramos ainda ("Pendente integração", cinza sólido);
  `INCOMPLETE` = integramos e a companhia não reportou o suficiente
  ("Sem dado suficiente", cinza tracejado, ⚪ neutro — nunca cor de semáforo,
  porque é qualidade de dado, não saúde do embarque); `COMPLETE` = reportou.
- Marcos pós-embarque na timeline (Em trânsito → Chegada → Descarregado →
  Liberado) são os milestones do ShipsGo (Ocean Transit, Arrival at POD,
  Discharge, Available for Pickup). Gate-in e Vessel Loading não se repetem: já
  são os estados reais `coletado` e `embarcado`. O marco ainda não alcançado
  mostra uma **data prevista** derivada do ETA do próprio embarque
  (`frontend/.../lib/step-forecast.ts`) — o círculo do passo continua vazio e
  "Pendente integração" só volta quando não há ETA nenhum de onde derivar (banco
  recém-semeado, sem top-up).
- **Free time (dias livres de demurrage/detention) não existe e não é derivável.**
  O ShipsGo diz **quando** o container ficou disponível (milestone `AVAILABLE`),
  nunca quantos dias livres o cliente tem — isso é cláusula comercial, mora no
  Inova, e não está integrado. Por isso o alerta de demurrage (abaixo) afirma o
  fato da liberação e **para aí**: nada de "vence em X dias", contagem regressiva
  ou prazo. É a mesma distinção de fonte do "✓ Desembaraçado".
- "✓ Desembaraçado" é **etiqueta na Chegada**, não degrau, e vem de uma futura
  Camada 2 (Inova / Portal Único) que também não existe. Sem o dado ele não
  renderiza **nada** — nem "Pendente integração": o desembaraço não é garantido
  em todo processo (depende do porto e do vínculo de cadastro), então ausência é
  o estado correto, não lacuna a sinalizar.

### Dado de rastreamento para demonstração (`tracking_is_mock`)

O protótipo precisa **mostrar** os três caminhos visuais da tela, e com as
colunas todas NULL só existe um ("Pendente integração"). Por isso
`backend/scripts/topup_tracking_demo.py` popula três embarques com tracking
**inventado**, e a honestidade fica ancorada num flag que viaja com o dado:

| Embarque | Cenário | O que a tela mostra |
|---|---|---|
| EMB-2026-0001 (existente, UPDATE) | `COMPLETE`, ETAs iguais, milestone `OCEAN_TRANSIT` | 🟢 "No prazo"; timeline com "Em trânsito" como etapa atual |
| EMB-2026-0008 (novo, INSERT) | `COMPLETE`, ETA atual 5 dias depois da primeira, `IsActual`, milestone `DISCHARGE` | 🔴 "Atraso, +5 dias"; timeline com "Descarregado" preenchido |
| EMB-2026-0009 (novo, INSERT) | `INCOMPLETE`, ETAs NULL | ⚪ "Sem dado suficiente" na Lista, na Timeline e no Mapa |
| EMB-2026-0010 (novo, INSERT) | `COMPLETE`, chegada no prazo, milestone `AVAILABLE` + `last_milestone_at` | timeline fechada em "Liberado" e o alerta 🔴 "Container liberado" no topo da aba Alertas |

Regras que sustentam isso — **não popular tracking sem elas**:

- Toda linha gravada pelo script leva `tracking_is_mock = TRUE`, e o frontend
  **declara** esse flag em cima de qualquer valor que dele derive: selo
  "Pré-visualização" no card da Lista e na seção Acompanhamento, e uma linha de
  texto ("Rastreamento de demonstração — não vem da companhia marítima") no
  indicador de chegada do topo do detalhe, que desde 18/08/2026 não usa mais
  `ProvenanceBadge`. É o mesmo contrato do `is_mock` de `app/audit_preview.py`;
  o que varia é a forma de dizer, nunca o dever de dizer.
- O flag é **coluna**, não lista de referências chumbada no frontend: quando um
  desses embarques ganhar tracking real, ele perde o selo limpando o flag, não
  dependendo de alguém lembrar de editar uma lista.
- O e2e trava isso: `O14` falha se algum embarque expuser valor de tracking sem
  `is_mock`, `O15` garante que um banco recém-semeado (sem top-up) continua
  100% "Pendente integração", e `O16` proíbe data de milestone sem o milestone
  que ela data (o contrário é legal).
- Os cenários 2, 3 e 4 são embarques **novos**, não promoção de embarques
  existentes: mudar o `estado` ou o milestone de um embarque semeado quebraria a
  variedade que a demo mostra e que o `O2b` do e2e cobre. O cenário 4 chega **no
  prazo** de propósito — o alerta nasce da liberação, não de atraso, e empilhar
  as duas coisas esconderia isso.
- O script **pula** cenário já aplicado em vez de abortar tudo (ver Utilitários).
  Foi o que permitiu acrescentar o cenário 4 num banco que já tinha os três
  primeiros; sem isso, cenário novo só num banco limpo.

## Conferência de dados da cotação (MOCK, casca conceitual)

`app/audit_preview.py` + `GET /portal/quotations/{id}/audit-preview` servem um
comparativo cotado × realizado na tela de detalhe da cotação FECHADA e na
expansão "Conferência de dados" do Histórico (`/portal/cotacoes`). **Metade
é inventada**: o valor cotado é real (proposta vencedora), o valor realizado
não existe em tabela nenhuma — é uma variação determinística (-3% a +8%)
derivada do hash da `reference` da cotação.

Isso é conferência da própria cotação, não auditoria de fatura. A auditoria de
verdade (Camada de Auditoria de Frete/Fatura) é produto separado, sequenciado
depois do go-live do GE — `/portal/auditoria` mostra a casca dela em três
camadas **conceituais** (conciliação planejado × realizado, árvore de decisão no
limite de 5%, rascunho de contestação por template), com embarques de exemplo:
o gatilho de chegada não existe em `EmbarqueState` e não há model de NF/fatura
no schema. Este preview aqui é só para o cliente enxergar a ideia num debate de
produto.

Convenções que sustentam o aviso — mantenha se mexer nisso:

- O handler vive em `app/` (camada do protótipo), **não** em
  `lambdas/client_portal/`: endpoint que fabrica número não mora junto dos
  handlers reais.
- Todo campo fabricado da resposta tem prefixo `mock_`, e `is_mock: true` vai
  no topo do payload.
- A UI emoldura a seção inteira como ilustrativa (borda tracejada + selo
  "Pré-visualização"), rotula o card fabricado como "Valor estimado — dado
  ilustrativo" e imprime o disclaimer que vem do backend.
- A semente do hash é a `reference` (estável entre seeds), não o UUID
  (sorteado a cada `make seed`) — assim a COT-2026-0004 semeada sempre cai
  acima do limite de 5% e o selo "Divergência detectada" aparece na demo.

## Comportamento conhecido: leitura que escreve

`GET /portal/quotations/{id}/recommendation` reescreve `ProposalScore` a cada
chamada — `recommendation_service.calculate_and_persist` chama
`proposal_score_repository.upsert_for_quotation`, que faz DELETE + INSERT de
todas as linhas de score da cotação. Abrir a tela de detalhe de uma cotação já
altera o banco.

Isso **não é bug** (vem do Centrix, onde o score é recalculado sob demanda), mas
explica por que os scores podem divergir do que o seed criou mesmo sem nenhuma
ação de negócio ter ocorrido. Consequências práticas:

- Contagem de `centrix_quotation_proposal_scores` não é estável: basta alguém
  navegar no portal para ela mudar. Ao auditar se um banco "está como o seed
  deixou", use `centrix_quotation_logs` — esse sim só cresce por ação de
  negócio (aprovar/recusar/cancelar/criar).
- Os valores de score do seed são fabricados por `_score()` e não batem com o
  cálculo real do `recommendation_service`; a primeira abertura da tela
  substitui os do seed pelos calculados.

## Utilitários fora do fluxo de seed

Dois scripts de uma vez só, com o mesmo contrato: dry-run por padrão, `--apply`
para gravar, abortam se o efeito já tiver sido aplicado e conferem os deltas de
linha antes de commitar.

`backend/scripts/topup_tracking_demo.py` popula o rastreamento ilustrativo dos
quatro cenários (seção "Dado de rastreamento para demonstração"). Diferente do
outro top-up, ele faz **um** UPDATE — só nas colunas `tracking_*` do
EMB-2026-0001, e apenas se elas estiverem NULL — além dos três INSERTs. Não
mexe em campo de negócio de embarque nenhum. Também diferente do outro: cenário
já aplicado é **pulado**, não aborta o lote (só aborta se não sobrar nada a
fazer), e ele confere que cada embarque novo nasceu com o `reference` anunciado
no plano antes de commitar — a referência é gerada pelo repositório, não
escolhida aqui.

`backend/scripts/topup_tracking_full.py` fecha a lacuna deixada pelo
`topup_tracking_demo.py`: onde aquele monta quatro cenários NOMEADOS (no prazo /
atraso / sem dado / liberado) que a demo usa para explicar a tela, este preenche
o RESTO — todo embarque do cliente passa a ter ETA, risco de atraso e, quando o
estado permite, milestone. Os dois convivem e a ordem recomendada é `_demo`
depois `_full`, mas tanto faz: o `_full` pula qualquer embarque que já tenha
`tracking_data_status`, então nunca sobrescreve os cenários do outro nem um
rastreamento real futuro. Duas regras do dado gerado: **milestone só para
embarque `embarcado`** (um `aguardando_prontidao` com `DISCHARGE` estaria
descarregado no destino antes de sair da origem), e **ETA para todos**, porque
previsão de chegada existe antes de a carga partir. Cria três embarques novos,
dois deles em `AVAILABLE` — é o milestone que torna um embarque elegível para a
Auditoria, que até então mostrava "0 embarques elegíveis" por não existir nenhum.

`backend/scripts/topup_route_history_demo.py` cria as DUAS cotações FECHADAS que
faltavam numa rota que o Radar de Preços **não** acompanha — sem elas o ramo de
fallback do bloco "Mercado" (o histórico do cliente na rota) nunca aparece, e a
razão é aritmética: as duas FECHADAS do seed estão em rotas diferentes uma da
outra e as duas caem DENTRO do Radar. Só INSERT, dry-run por padrão. Duas
decisões que sustentam o script:

- **A rota é COPIADA do banco**, não escrita aqui: as cotações novas herdam
  `origin`/`porto_destino`/`modal` de uma cotação que já existe (`HOST_REFERENCE`
  = COT-2026-0009, Izmir → Santos). Copiar a ENTRADA garante a mesma chave
  normalizada sem reimplementar em Python a `quotationRadarRoute` do frontend —
  uma segunda normalização erraria calada no destino não nomeado, que é o caso
  mais comum. Que a rota do host cai fora do Radar foi conferido com as próprias
  funções da tela (`computePriceRadar` + `findQuotationRadarRoute`), e o
  docstring diz como reconferir.
- **Idempotente pelo EFEITO, não por referência**: aborta se o cliente já tiver
  FECHADA naquela rota, que é exatamente a condição que o script existe para
  criar. As referências são geradas pelo repositório (`_generate_reference`), não
  chumbadas — número fixo abriria buraco na sequência de qualquer outro banco.

Os fechamentos ficam no passado, em meses distintos (ordenação por recência) e
**fora do mês corrente e do anterior**, que são as duas janelas que
`computeSavingsTrend` soma: um fechamento novo caindo ali mudaria o KPI de
Economia de lambuja. Não toca em COT-2026-0001 nem COT-2026-0004, e não cria
embarque — logo não pode empurrar a rota para dentro do Radar e invalidar o
próprio efeito.

`backend/scripts/topup_client_po.py` preenche `client_reference` (a PO do
cliente) nas oito cotações semeadas que a ganharam no seed. Só UPDATE, e só onde
a coluna está NULL — cotação que já tem PO (inclusive as criadas pela suíte e2e
ou pelo próprio cliente) é pulada, nunca sobrescrita. Como não cria nem apaga
linha, o delta esperado é **zero** e qualquer delta vira ROLLBACK. Num banco
limpo o `make seed` já grava os POs e este script não tem o que fazer.

`backend/scripts/topup_funnel_quotations.py` é um script de uma vez só, **não faz
parte do fluxo normal**. `seed_prototype.py` é skip-if-exists (sai sem fazer nada
se o CLIENTE DEMO já existir), então cotações acrescentadas ao seed depois que um
banco já foi semeado nunca chegam nele. O top-up insere COT-2026-0007/0008/0009
num banco já populado, sem tocar no que existe: só INSERT, dry-run por padrão,
aborta se as referências já existirem e confere os deltas de linha antes de
commitar. Foi aplicado uma vez no Supabase remoto; num banco limpo, `make seed`
já cria as nove.

`backend/scripts/reanchor_tracking_demo.py` conserta a única coisa que os
top-ups de tracking não conseguem: o **envelhecimento** da demo. Os dois top-ups
ancoram as datas em "agora" e pulam qualquer embarque que já tenha
`tracking_data_status`, então rodar de novo não faz nada — e alguns dias depois o
ETA de um embarque "em trânsito" já está no passado. Este script soma o MESMO
número de dias a todas as datas ilustrativas do cliente demo. O deslocamento
uniforme é o ponto: preserva `current_eta - first_eta` (o desvio que vira o
semáforo) e a ordem entre embarques. Só UPDATE, só colunas `tracking_*`, delta de
linhas ZERO, e não toca em linha com `tracking_is_mock = FALSE`.

### EMB-2026-0013: datas recuadas 10 dias na mão (01/09/2026)

**Se você ler `first_eta: 2026-08-10` no EMB-2026-0013 e achar que é erro de
digitação, não é.** Está assim de propósito, e desfazer quebra a demo.

O problema: o EMB-2026-0013 tem milestone `ARRIVAL`, ou seja, a carga já chegou,
e ETA no passado é o estado CORRETO dele. Mas o reanchor desloca todo mundo de
uma vez, e o deslocamento que o EMB-2026-0001 (`OCEAN_TRANSIT`, o cenário-vitrine
"em trânsito / no prazo") precisava era +20 dias — o suficiente para empurrar o
0013 para uma chegada no futuro. Uma carga marcada como "chegou" com data de
chegada que ainda não aconteceu. O próprio script avisa disso antes de aplicar.

O teto que respeitaria o 0013 era +10, metade do necessário: consertaria cinco
embarques e deixaria justamente o cenário-vitrine com ETA vencido. Por isso as
ETAs do 0013 foram recuadas 10 dias ANTES do reanchor cheio, num script pontual
não commitado (mesmo padrão dos outros ajustes de dado de demo):

    first_eta   2026-08-20 -> 2026-08-10    (depois do +20: 2026-08-30)
    current_eta 2026-08-21 -> 2026-08-11    (depois do +20: 2026-08-31)

O recuo é **uniforme nas duas datas**, então o desvio `current - first` continua
+1 dia e o semáforo do 0013 não muda. Isso importa porque a mesma
`delayRiskFromTracking` alimenta o on-time rate do Executivo e o `onTimePct` por
rota/armador do Performance — que leem a DIFERENÇA, nunca a data absoluta.

Auditado antes de aplicar, e vale reconferir se alguém mexer nisso: a Auditoria
filtra por `last_milestone === 'AVAILABLE'` (o 0013 é `ARRIVAL`, nem entra e não
usa data nenhuma); `illustrative-kpis.ts` tira Economia das COTAÇÕES fechadas e
on-time da diferença de ETAs; `volume-helpers.ts` (gráficos de Performance e
Executivo) conta por `created_at`, coluna que nada disso toca; e o `price-radar`
agrupa rota e frequência, sem ETA. Nenhum teste unitário lê o banco — as datas
`2026-08-20/21` que aparecem em `step-insights.test.ts` e companhia são fixtures
inline, sem relação com esta linha.

## Home personalizável — substituiu a Home fixa (11/09/2026)

**`/portal/home` deixou de ser a 1b fixa.** A Home passou a ser montada pelo
próprio cliente: ele escolhe de 1 a 3 **temas** num onboarding não-descartável na
primeira visita e depois liga/desliga os **cards** desses temas num modal
"Personalizar". "Refazer personalização do zero" fica sempre visível, logo abaixo
do banner.

**A via de volta** é `frontend/app/portal/home/page.tsx.bak-1b` (a 1b salva
inteira, fora do build — a extensão não casa com o `include` do tsconfig nem com
as extensões de página do Next) e o commit anterior à troca,
`ea2b5d30cde74d23e32d43e852218602ce39a1e7`, anotado no topo do `page.tsx` novo.

**O topo e o rodapé continuam sendo a 1b**, e não cópias: `HomeBanner` (saudação,
frase dominante, farol) e `HomeShortcuts` são os mesmos componentes, importados
dos mesmos arquivos. O que mudou é o MEIO da tela.

| Tema | Pergunta | Cards |
|---|---|---|
| `acao` | O que precisa de mim | `acao_urgente` (UrgentActionCard) |
| `mapa` | Onde está minha carga | `mapa_embarques` (ShipmentMap) |
| `custos` | Quanto estou gastando | `economia` (SavingsCard) · `tendencia_preco` (PriceTrendCard) |

"Custos", e não "Inteligência": o segundo colide com o item de mesmo nome na
sidebar, e o rótulo de um tema descreve o que o card mostra, nunca um destino de
navegação. Há teste unitário travando essa colisão.

**A tabela `centrix_portal_home_layout_experiment` (migração 095) é PRODUÇÃO.**
Não é mais experimento descartável: sem linha nela o cliente não vê a Home, vê o
onboarding. O nome da tabela, do endpoint (`/portal/home-layout-experiment`) e do
módulo (`backend/app/home_layout_experiment.py`) guarda a origem experimental da
frente — renomear os três exigiria migração e rota nova em produção, sem ganho
funcional. A migração já está aplicada no remoto.

O que sustenta isso, e não pode afrouxar:

- **Tabela e endpoint próprios, separados de `centrix_portal_client_preferences`
  / `PUT /portal/preferences`.** Aquilo é preferência operacional com efeito na
  próxima cotação e tem lista fechada de campos que sustenta a regra de o cliente
  não editar dado interno da Freitas; isto é layout de tela. Nenhuma linha de
  código é compartilhada, e `H8` no e2e trava a fronteira.
- **Duas tabelas tema→card, uma em cada ponta** (`THEME_CARDS` no backend,
  `PORTAL_HOME_LAYOUT_CARDS` em
  `frontend/app/portal/home/lib/home-layout.ts`). Mexeu num lado, mexa no outro;
  `H11` no e2e compara as duas.
- **Nenhum card busca dado sozinho.** A página faz as duas chamadas que o portal
  já faz (`/portal/quotations`, `/portal/shipments`) uma vez e passa o resultado
  a todos por `HomeCardProps`. `HOME_LAYOUT_CARD_COMPONENTS` é
  `Record<PortalHomeCard, ...>`: card novo sem componente quebra o build.
- **Nenhum componente reaproveitado foi editado.** `UrgentActionCard`,
  `SavingsCard`, `ShipmentMap`, `PriceAlertBadge` e `PriceTrendLine` entram como
  estão — o registro só adiciona wrappers.
- **Ausência de linha é o estado normal** e nenhum seed a popula: é ela que faz o
  onboarding abrir. Reset APAGA a linha; zerar os campos deixaria a tabela
  dizendo "já onboardou" e o modal nunca mais abriria.
- **Vocabulário renomeado nesta data.** Os temas se chamavam
  `alertas`/`mapa_mundi`/`inteligencia`. A tabela estava vazia em todos os bancos,
  então não houve migração de dado — mas o frontend descarta tema desconhecido
  (`knownThemes`) e reabre o onboarding, porque uma linha com vocabulário velho
  não pode virar Home vazia sem saída. `H3b` no e2e garante que os nomes
  aposentados não voltem a ser aceitos.
- **`/portal/home-personalizada` virou redirect** para `/portal/home`. A rota
  chegou a ser servida em produção e foi divulgada por URL; um 404 leria como
  "a frente foi cancelada".

**O tema "Ação" tem UM card, e isso não é lacuna.** Um segundo card de farol
(`farol_resumido`, com as três contagens e atalho por recorte) chegou a existir e
foi removido na mesma data: o `HomeBanner`, a centímetros dele, já imprime as
mesmas três contagens — é a mesma razão pela qual o `StatusBeaconCard` saiu em
03/09/2026. **Não reintroduza um farol como card desta tela**; o do banner é o
farol da Home. `layoutRows` continua no lib porque a regra dela (metade sem par
ocupa a fileira inteira) vale para o próximo card meia-largura, mesmo que a
tabela de hoje não produza mais nenhuma órfã.

## Como rodar

```bash
docker compose up -d
cd backend && cp .env.example .env && make setup && make migrate && make seed && make run
cd frontend && npm install && npm run dev   # http://localhost:3000/portal/cotacoes
```

CORS aceita qualquer origem local (o Next pode subir em 3001 se 3000 estiver em uso).

## Testes

`backend/scripts/e2e_test.py` cobre todos os endpoints do portal e o comportamento
dos handlers originais (status codes, transições, buckets, privacidade,
elegibilidade de RFQ, 404 anti-enumeração, mocks). Rode com banco recém-semeado
(as contagens são fixas):

```bash
docker compose down -v && docker compose up -d
cd backend && make migrate && make seed && make run &
.venv/bin/python -m scripts.e2e_test     # -> 131/131 ALL PASS
```

A suíte **muta dados** (aprova, recusa, cancela cotações da semente) e exige um
banco recém-semeado. Confira antes o `DATABASE_URL` do `backend/.env`: se ele
não apontar para o Postgres do `docker-compose`, `docker compose down -v` não
limpa nada e a suíte roda contra o banco errado.

Ao adicionar comportamento, adicione uma checagem correspondente no e2e_test.py.

## Convenções

- Python 3.11, FastAPI. Handlers são síncronos (padrão Lambda do Centrix).
- Migrations: sempre `alembic upgrade head` (`make migrate`) — nunca `alembic stamp`.
- Ao mexer no schema/models, lembre que `shared/` espelha o Centrix; prefira não divergir.
- Sem emojis no código. Comentários só quando a lógica não é óbvia.
- Dados de seed são fictícios — não portar os clientes reais da Freitas (PII).

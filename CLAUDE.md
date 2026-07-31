# Centrix — Portal do Cliente (Protótipo) — Contexto para IA

Meta-contexto para qualquer IA (Claude etc.) trabalhando neste repositório.
Leia isto antes de editar. Convenções específicas do frontend copiado do Centrix
estão em `frontend/CLAUDE.md`.

## O que é este projeto

Réplica **standalone e offline** do Portal do Cliente do Centrix (plataforma de
importação/logística da Arboria para a Freitas COMEX). Objetivo: o cliente rodar
só o portal na máquina dele, sem AWS e sem nenhuma API externa, com funcionalidade
parecida com a real. **Não é produção — é um protótipo demonstrável.**

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
                                 #   (+2 novos de exportador, +2 novos de embarque)
  alembic/                       # COPIADO — migrations 001..089 (+090, do protótipo)
  scripts/
    seed_prototype.py            # cliente demo + 9 cotações + agentes + DNA + 7 embarques
    e2e_test.py                  # suíte E2E (92 checagens)
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
  - Nada do módulo GE do analista (`lambdas/shipment*`, rotas `/shipments`) foi
    copiado: as tabelas e repositories existem, os handlers não.
- `shared/portal_helpers.py` — `closed_at` e `declined_at` acrescentados a
  `_QUOTATION_PORTAL_FIELDS`. Leitura aditiva de colunas que já existem no
  modelo e que o state machine já grava; o Histórico do portal data e filtra a
  cotação fechada por elas em vez de chutar pelo `updated_at`.

## Fronteiras mockadas (por design)

| Real (Postgres local) | Mockado / simplificado |
|---|---|
| kanban, detalhe, propostas, histórico, recomendação (score determinístico) | extração PDF/e-mail (IA/OpenRouter) — não exercida |
| cadastro de exportador pelo cliente + vínculo na nova cotação | — |
| acompanhamento de embarque (Processo/Embarque criados na aprovação) | histórico de transições do embarque (não existe tabela) e ETA/SLA (`processos.datas` fica NULL) |
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
.venv/bin/python -m scripts.e2e_test     # -> 92/92 ALL PASS
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

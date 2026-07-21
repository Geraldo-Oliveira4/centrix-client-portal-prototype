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
    routers/
      portal.py                  # 15 rotas /portal/* -> handlers client_portal
      auth.py                    # /portal/auth/* -> stubs (sem Cognito)
      local_s3.py                # PUT/GET /_local_s3/{key} no filesystem
  shared/                        # COPIADO do Centrix quase sem alteração (models, repos, domain, services)
  lambdas/client_portal*/        # COPIADO do Centrix — os handlers originais, intactos
  alembic/                       # COPIADO — migrations 001..089
  scripts/
    seed_prototype.py            # cliente demo + 6 cotações + agentes + DNA
    e2e_test.py                  # suíte E2E (52 checagens)
frontend/                        # CÓPIA do app Next.js do Centrix (só /portal ligado ao backend)
  vendor/arboria-ui, arboria-config   # deps @arboria-tech vendorizadas (file:), sem GitHub Packages
docker-compose.yml               # Postgres 16 local
```

### Princípio central: não alterar o código copiado do Centrix

`shared/`, `lambdas/` e `alembic/` são cópias fiéis do Centrix. **Toda adaptação
do protótipo vive na camada `app/`** (shim, mocks, routers, prototype_flow). Isso
mantém a paridade comportamental com o original e facilita re-sincronizar com o
Centrix no futuro. Ao corrigir algo, prefira ajustar `app/` a editar `shared/`.

O único ajuste feito em código copiado foi `shared/database/connection.py`
(string do Postgres local + pool maior, em vez do pool tunado p/ Lambda).

## Fronteiras mockadas (por design)

| Real (Postgres local) | Mockado / simplificado |
|---|---|
| kanban, detalhe, propostas, histórico, recomendação (score determinístico) | extração PDF/e-mail (IA/OpenRouter) — não exercida |
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
.venv/bin/python -m scripts.e2e_test     # -> 52/52 ALL PASS
```

Ao adicionar comportamento, adicione uma checagem correspondente no e2e_test.py.

## Convenções

- Python 3.11, FastAPI. Handlers são síncronos (padrão Lambda do Centrix).
- Migrations: sempre `alembic upgrade head` (`make migrate`) — nunca `alembic stamp`.
- Ao mexer no schema/models, lembre que `shared/` espelha o Centrix; prefira não divergir.
- Sem emojis no código. Comentários só quando a lógica não é óbvia.
- Dados de seed são fictícios — não portar os clientes reais da Freitas (PII).

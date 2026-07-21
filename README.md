# Centrix — Portal do Cliente (Protótipo)

Protótipo **standalone** do Portal do Cliente do Centrix, para o cliente rodar
localmente sem depender de AWS ou de qualquer API externa. Replica as telas e os
fluxos principais do portal contra um Postgres local, com a camada de IA
(extração de PDF/e-mail), envio de e-mails e S3 **mockados**.

Não é um sistema de produção — é uma cópia funcional para prototipagem.

## Arquitetura

- **Backend** (`backend/`): FastAPI envolvendo os handlers Lambda do domínio
  `client_portal` do Centrix (copiados praticamente sem alteração em `backend/shared`
  e `backend/lambdas`). Um _event shim_ converte cada request HTTP no evento do API
  Gateway v2 que os handlers esperam. Banco: Postgres 16 local (Docker).
- **Frontend** (`frontend/`): cópia do app Next.js do Centrix. Só o Portal do
  Cliente (`/portal/*`) está ligado ao backend. `@arboria-tech/arboria-ui` e
  `@arboria-tech/arboria-config` foram **vendorizados** em `frontend/vendor/` (deps
  `file:`), então não é preciso credencial do GitHub Packages.

### O que é real vs. mockado

| Funcional (Postgres local) | Mockado / não funcional (por design) |
|----------------------------|--------------------------------------|
| Kanban de cotações, detalhe, propostas, histórico | Extração de PDF/e-mail (IA / OpenRouter) |
| Aprovar / recusar / cancelar cotação | Envio de e-mails (Microsoft Graph) → log no console |
| Montar + disparar RFQ | Upload S3 → filesystem local (`backend/storage/`) |
| Recomendação (score determinístico) | Cognito → auto-login como cliente demo |

## Aprovação de proposta (happy path simplificado)

No Centrix de produção, quando o cliente aprova uma proposta a cotação vai para
`APROVADA_PELO_CLIENTE` e **aguarda um analista da Freitas** revisar/fechar (o
"guard rail"). Neste protótipo simulamos o happy path: ao aprovar, o sistema
**automaticamente** faz o papel do analista e fecha a cotação (`FECHADA`), então
o card já anda para "Aprovadas". O guard rail e a etapa manual do analista ficam
de fora de propósito. Toda a lógica dessa simplificação está isolada e comentada
em `backend/app/prototype_flow.py` (não altera os handlers originais).

## Autenticação

Não há Cognito. O frontend faz **auto-login** como o cliente demo semeado
(`lib/portal-session.ts`) e o backend resolve sempre esse mesmo cliente
(`app/event_shim.py::DEMO_SUB`). As telas de login/cadastro continuam visíveis,
mas o fluxo real não é exercido.

## Como rodar

Pré-requisitos: Docker, Python 3.11, Node 18+.

### 1. Banco de dados

```bash
docker compose up -d          # sobe o Postgres 16 em localhost:5432
```

### 2. Backend

```bash
cd backend
cp .env.example .env
make setup                    # cria .venv e instala dependências
make migrate                  # aplica as migrations (schema 001–089)
make seed                     # cria cliente demo + ~6 cotações de exemplo
make run                      # API em http://localhost:8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                   # http://localhost:3000/portal/cotacoes
```

Abra **http://localhost:3000/portal/cotacoes** — o portal abre já logado como
"Cliente Demo" com as cotações semeadas.

> Se a porta 3000 estiver ocupada, o Next sobe em 3001; o CORS do backend aceita
> qualquer origem local, então funciona em qualquer porta.

## Dados semeados (`backend/scripts/seed_prototype.py`)

- 1 cliente demo + 1 portal_user (alvo do auto-login) + 3 agentes de carga
- 1 DNA (importação) com os agentes como `default_agents` (necessário p/ RFQ)
- 6 cotações cobrindo os estados do kanban: aguardando propostas, escolha da
  proposta, aprovada, recusada, cancelada — com propostas e scores.

`make seed` é idempotente: se o cliente demo já existe, não faz nada. Para
recomeçar do zero: `docker compose down -v` e refaça migrate + seed.

## Testes de ponta a ponta

`backend/scripts/e2e_test.py` exercita **todos** os endpoints do portal contra o
backend em execução e verifica o comportamento exato dos handlers originais do
Centrix: status codes, transições de estado, mapeamento de buckets do kanban,
omissão de campos internos (privacidade), regras de elegibilidade de RFQ,
404 anti-enumeração (posse do cliente) e os mocks offline (S3 local, e-mail no-op).

```bash
# banco limpo é necessário (os testes conferem contagens fixas)
docker compose down -v && docker compose up -d
cd backend
make migrate && make seed
make run &                       # backend em :8000
.venv/bin/python -m scripts.e2e_test
```

Cobertura (52 checagens): auth/auto-login, listagem/kanban, detalhe, recomendação,
histórico, documentos (upload → S3 local → download), criar cotação, montar +
disparar RFQ (incl. bloqueio de agente fora da lista), aprovar, recusar, cancelar,
trigger de extração (no-op), isolamento por cliente e stubs de auth.

Resultado atual: **52/52 checagens passam**. Além disso, o fluxo de aprovação foi
validado pela UI real no navegador (diálogo de confirmação → toast de sucesso →
badge "Vencedora" → banner de aprovação).

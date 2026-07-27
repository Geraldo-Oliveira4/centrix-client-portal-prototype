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
cp .env.local.example .env.local   # aponta o app para o backend em :8000
npm install
npm run dev                   # http://localhost:3000/portal/cotacoes
```

Sem o `.env.local` o app chama a própria origem (`:3000`) em vez do backend, e a
tela fica presa em "Aguarde o servidor inicializar".

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


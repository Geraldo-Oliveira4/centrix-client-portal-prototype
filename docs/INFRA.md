# Infraestrutura do protótipo — Portal do Cliente Centrix

Mapa de onde cada peça roda, o que configura cada uma e como diagnosticar quando
algo cai. **Sem segredos**: variáveis aparecem só pelo NOME, e nenhum endereço
interno de backend é escrito aqui. O repositório é público.

Legenda: **documentado** = está no repositório (arquivo citado) ·
**informado** = veio da equipe, não há arquivo no repo que comprove ·
**a confirmar** = ninguém registrou; não invente.

## Regra de produto

O protótipo é ferramenta de demonstração e **nunca depende do backend para uma
demonstração**. Se a API não responde, o portal entra no **modo demonstração**
(dados de exemplo, rotulados, ações simuladas) — ver "Modo offline" abaixo.

## As peças

| Peça | Onde roda | O que o repo diz | Responsável |
|---|---|---|---|
| Frontend (Next.js, `frontend/`) | Vercel | **documentado** (`CLAUDE.md`, "Publicação compartilhada"): o domínio principal acompanha a `main`; mudanças entram por branch/PR. **informado**: cada PR gera deploy de Preview, protegido por SSO da Vercel. | a preencher |
| Protótipos HTML estáticos (`frontend/public/prototypes/*`: Central de trabalho, Auditoria, Radar, Inteligência, Configurações) | Junto do frontend (arquivos estáticos do mesmo deploy) | **documentado** (`CLAUDE.md`, `frontend/CLAUDE.md`): embutidos por iframe, sem API, dados fictícios. Não dependem do backend. | a preencher |
| Backend (FastAPI, `backend/`) | **a confirmar** | **documentado**: roda local com `make run` (porta 8000) e expõe `GET /health` (`backend/app/main.py`). Não há `render.yaml`, `Dockerfile`, `Procfile` nem workflow de deploy no repo: **o host de produção não está documentado**. **informado**: o serviço "dorme" sem uso e às vezes é pausado por falta de crédito. Medido em 12/11/2026: primeira resposta do `/health` depois de ocioso levou ~43 s. | a preencher |
| Banco de dados (Postgres) | Local: Docker (`docker-compose.yml`). Remoto: **a confirmar** | **documentado**: Postgres 16 local. O `CLAUDE.md` cita um "Supabase remoto" onde um top-up foi aplicado; se é o banco que o backend publicado usa hoje, **a confirmar**. | a preencher |
| Verificador de saúde | GitHub Actions (`.github/workflows/backend-health.yml`) | **documentado** (este arquivo) | a preencher |

## Variáveis de ambiente (só nomes)

### Frontend (Vercel e `frontend/.env.local`)

| Nome | Para que serve |
|---|---|
| `NEXT_PUBLIC_API` | Endereço base da API do backend. Lido por `lib/portal-api.ts` (cliente do portal) e pelas telas de login/cadastro. Embutido no bundle no momento do build. |
| `NEXT_PUBLIC_OFFLINE_DEMO` | `1` = sempre modo demonstração (não consulta o servidor). `0` = **desliga** o modo offline: com a API fora, volta a tela "Aguarde o servidor inicializar". Ausente = decide pelo teste de saúde. |
| `NEXT_PUBLIC_PROTO_INTERNAL` | `1` liga as ferramentas internas do painel de Demonstração (ondas de módulos, Freitas simulada, mesas de revisão). Na Vercel, só no escopo Preview; produção é construída sem ela. |
| `PREVIEW_API_PORT`, `PREVIEW_ORIGIN` | Só para `npm run preview:api` (API de fixtures local da revisão visual). |

### Backend (`backend/.env`, ver `backend/.env.example`)

| Nome | Para que serve |
|---|---|
| `DATABASE_URL` | Conexão com o Postgres. **Segredo** quando aponta para banco remoto — nunca commitar (`backend/.env` está no `.gitignore`). |
| `DEMO_PORTAL_SUB`, `DEMO_PORTAL_EMAIL` | Usuário do auto-login demo (precisa casar com o seed). |
| `MS_GRAPH_MAILBOX_USER` | Remetente de e-mail (mockado; só precisa ser não vazio). |
| `APP_BASE_URL`, `FRONTEND_ORIGIN` | Links em e-mail e origem do frontend. |
| `LOCAL_STORAGE_DIR`, `LOCAL_S3_BASE_URL` | Onde o S3 mockado grava arquivos e a base dos links. |
| `SQS_EXTRACTION_QUEUE_URL` | **Deliberadamente ausente** (a extração por IA não roda no protótipo). |

### GitHub (Settings > Secrets and variables > Actions)

| Nome | Tipo | Para que serve |
|---|---|---|
| `BACKEND_HEALTH_URL` | **Variable** | Endereço completo de saúde do backend publicado (ex.: `https://<host>/health`). Sem ela o verificador termina com aviso e sucesso. |
| `SLACK_WEBHOOK_URL` | **Secret** (opcional) | Webhook de entrada do Slack para avisar quando o verificador falhar. Não está criado. |

## Como rodar local

```bash
# Banco + backend (ver README.md para o passo a passo completo)
docker compose up -d
cd backend && cp .env.example .env && make setup && make migrate && make seed && make run

# Frontend
cd frontend && npm install && npm run dev        # http://localhost:3000/portal

# Sem backend nenhum (modo demonstração forçado)
cd frontend && NEXT_PUBLIC_OFFLINE_DEMO=1 npm run dev
# ...ou abra qualquer tela com ?offline=1

# API de fixtures da revisão visual (só GET; inclui /health)
cd frontend && npm run preview:api               # porta 8011
```

## Modo offline (modo demonstração)

Implementado em `frontend/lib/offline/`. Resumo do comportamento:

1. Antes da primeira chamada à API, o portal faz `GET {NEXT_PUBLIC_API}/health`
   com prazo de 4 s e **uma** tentativa extra. Sem resposta, entra em modo
   demonstração **para a sessão da aba** (não re-testa a cada tela).
2. Também entra com `NEXT_PUBLIC_OFFLINE_DEMO=1` ou `?offline=1`, e quando a API
   cai no meio da sessão (erro de rede). Erro HTTP de uma API de pé (404, 500)
   continua sendo erro — nada é mascarado.
3. Uma faixa presa ao topo diz "Modo demonstração: servidor indisponível,
   mostrando dados de exemplo", com o botão **Tentar de novo**: testa a API e,
   se ela respondeu, recarrega a tela já com os dados reais.
4. Ações que gravariam algo (enviar cotação, aprovar, salvar preferências,
   cadastrar exportador) são **simuladas** e avisam "Prévia: nada foi enviado".
   Envio de arquivo é recusado.
5. `NEXT_PUBLIC_OFFLINE_DEMO=0` ou `?offline=0` desligam o modo: só assim volta
   a tela "Aguarde o servidor inicializar".

**Backend que dorme.** O primeiro `/health` de um serviço ocioso pode levar
dezenas de segundos (43 s medidos), mais que os 4 s do teste. Então o portal
abre em modo demonstração — mas o próprio teste já acordou o serviço, e um
"Tentar de novo" um minuto depois costuma trazer os dados reais.

## Diagnóstico: "Aguarde o servidor inicializar" / "Modo demonstração"

1. **Qual das duas telas aparece?** "Modo demonstração" = o portal fez o que
   devia; o backend não respondeu. "Aguarde o servidor inicializar" só deveria
   aparecer com o modo offline desligado (`NEXT_PUBLIC_OFFLINE_DEMO=0` ou
   `?offline=0`) — se aparecer sem isso, é defeito do modo offline.
2. **O backend responde?** Rode o verificador com o endereço de saúde:
   `BACKEND_HEALTH_URL=https://<host>/health node scripts/check-health.mjs`.
   Ou veja a última execução do workflow "Saúde do backend" na aba Actions.
   - Respondeu devagar (aviso de "provável serviço acordando"): espere um
     minuto e clique **Tentar de novo** no portal.
   - Não respondeu: o serviço está parado, pausado ou sem crédito. Verifique no
     painel do provedor do backend (**a confirmar** qual é — ver tabela acima).
3. **O frontend aponta para o backend certo?** Confira o valor de
   `NEXT_PUBLIC_API` no projeto da Vercel (escopo Production ou Preview). Ele é
   embutido no build: depois de mudar, é preciso **novo deploy**.
4. **CORS / origem.** Se o `/health` responde no terminal mas o navegador falha
   (console: erro de CORS), confira `FRONTEND_ORIGIN` no backend e a lista de
   origens em `backend/app/main.py`.
5. **Banco.** Backend de pé mas telas vazias ou 500: confira `DATABASE_URL` no
   serviço (o valor vive só no provedor e no `backend/.env` de quem roda script).
6. **Forçar a demonstração enquanto isso:** compartilhe o link com `?offline=1`.

## Verificador de saúde

- Script: `scripts/check-health.mjs` (Node 18+, sem dependências). Lê
  `BACKEND_HEALTH_URL`, mede o tempo e sai com código 1 se não houver 2xx no
  prazo (`BACKEND_HEALTH_TIMEOUT_MS`, padrão 60 s). Acima de
  `BACKEND_HEALTH_SLOW_MS` (padrão 10 s) passa com aviso. No log aparece só o
  host, nunca o caminho.
- Workflow: `.github/workflows/backend-health.yml`, a cada 15 minutos e por
  disparo manual (Actions > Saúde do backend > Run workflow).
- **Ativar:** crie a variável do repositório `BACKEND_HEALTH_URL`. Até lá o job
  roda, avisa "não configurada" e termina com sucesso.
- **Quem é avisado:** quando o job falha, o GitHub manda o aviso de "workflow
  run failed" para quem por último alterou o agendamento (`cron`) do workflow,
  conforme as preferências de notificação dessa pessoa.
- **Aviso no Slack (opcional):** crie um Incoming Webhook no Slack e cadastre a
  URL como **secret** `SLACK_WEBHOOK_URL`. O passo "Avisar no Slack" do workflow
  já existe e só roda quando o secret existe e a verificação falhou.

Três ressalvas:

- Agendamento do GitHub só roda a partir da branch padrão (`main`): o workflow
  passa a valer depois do merge.
- O GitHub desativa agendamentos de repositório público depois de 60 dias sem
  atividade no repo; reative em Actions se isso acontecer.
- Uma consulta a cada 15 minutos pode **impedir o serviço de dormir** (em
  provedores que suspendem por inatividade) e consumir a cota de horas. Se isso
  for um problema, aumente o intervalo no `cron`.

## Pontos em aberto

- Host do backend publicado e provedor do banco remoto: **a confirmar** e
  registrar aqui (sem endereço, só o nome do provedor e onde fica o painel).
- Responsáveis por cada peça: **a preencher**.
- Política de crédito do backend (quem recarrega, alerta de saldo): **a confirmar**.

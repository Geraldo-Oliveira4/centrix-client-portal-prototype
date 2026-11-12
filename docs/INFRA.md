# Infraestrutura do protótipo — Portal do Cliente Centrix

Mapa de onde cada peça roda, o que configura cada uma e como diagnosticar quando
algo cai. **Sem segredos**: variáveis aparecem só pelo NOME, e nenhum endereço
interno de backend é escrito aqui. O repositório é público.

Legenda: **documentado** = está no repositório (arquivo citado) ·
**informado** = veio da equipe, não há arquivo no repo que comprove ·
**a confirmar** = ninguém registrou; não invente.

## Regra de produto

O protótipo é ferramenta de demonstração e **nunca depende do backend para uma
demonstração**. Se a API não entrega dados, o portal entra no **modo
demonstração** (dados de exemplo, rotulados, ações simuladas) — ver "Modo
offline" abaixo. O backend real é opcional.

## A falha de novembro/2026 (por que isto existe)

**"Servidor no ar" não é "dados disponíveis".** O backend publicado sobe e
responde 200 em `/health` e `/docs`, mas o banco que ele usava não existe mais:
toda rota que toca no banco responde **500**, depois de um cold start de ~17 s.
O portal ficava em "Carregando…" e depois "Aguarde o servidor inicializar".

Conferido em 12/11/2026 com o verificador deste repositório: `/health` → 200 (em
43 s, serviço acordando); `/portal/clients/me` → **500** em 5,3 s.

Consequências que valem daqui em diante:

- O portal trata **5xx, timeout acima de 4 s e rede caída** como servidor
  indisponível e abre com dados de exemplo — não basta o servidor responder.
- O verificador de saúde consulta uma rota que **lê o banco**, nunca `/health`
  nem `/docs`.
- Recriar o banco (e o `DATABASE_URL` do serviço) é decisão **a confirmar**; o
  protótipo não depende disso.

## As peças

| Peça | Onde roda | O que o repo diz | Responsável |
|---|---|---|---|
| Frontend (Next.js, `frontend/`) | Vercel | **documentado** (`CLAUDE.md`, "Publicação compartilhada"): o domínio principal acompanha a `main`; mudanças entram por branch/PR. **informado**: cada PR gera deploy de Preview, protegido por SSO da Vercel. | a preencher |
| Protótipos HTML estáticos (`frontend/public/prototypes/*`: Central de trabalho, Auditoria, Radar, Inteligência, Configurações) | Junto do frontend (arquivos estáticos do mesmo deploy) | **documentado** (`CLAUDE.md`, `frontend/CLAUDE.md`): embutidos por iframe, sem API, dados fictícios. Não dependem do backend. | a preencher |
| Backend (FastAPI, `backend/`) | **informado**: Render, plano free | **documentado**: roda local com `make run` (porta 8000) e expõe `GET /health` (`backend/app/main.py`), que **não** toca no banco. Não há `render.yaml`, `Dockerfile`, `Procfile` nem workflow de deploy no repo: a configuração do serviço vive só no painel do Render. **informado**: o serviço dorme sem uso (plano free) e já foi pausado por falta de crédito. | a preencher |
| Banco de dados (Postgres) | Local: Docker (`docker-compose.yml`). Remoto: **a confirmar** | **documentado**: Postgres 16 local. O `CLAUDE.md` cita um "Supabase remoto" onde um top-up foi aplicado. **informado**: esse banco **não existe mais** — é a causa dos 500 (seção acima). Qual banco o backend publicado deve usar: **a confirmar**. | a preencher |
| Verificador de saúde | GitHub Actions (`.github/workflows/backend-health.yml`) | **documentado** (este arquivo) | a preencher |

## Variáveis de ambiente (só nomes)

### Frontend (Vercel e `frontend/.env.local`)

| Nome | Para que serve |
|---|---|
| `NEXT_PUBLIC_API` | Endereço base da API do backend. Lido por `lib/portal-api.ts` (cliente do portal) e pelas telas de login/cadastro. Embutido no bundle no momento do build. |
| `NEXT_PUBLIC_OFFLINE_DEMO` | `1` = sempre modo demonstração, **sem nenhuma chamada ao backend** (zero espera). `0` = **desliga** o modo offline: falha do servidor vira aviso de erro na tela (com saída para os dados de exemplo). Ausente = decide pelo teste de saúde. |
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
| `BACKEND_HEALTH_URL` | **Variable** | Endereço de uma rota do backend publicado que **lê o banco** (ex.: `https://<host>/portal/clients/me`). Se for só o host, `/health` ou `/docs`, o verificador consulta `/portal/clients/me` no mesmo host. Sem ela o verificador termina com aviso e sucesso. |
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

# API de fixtures da revisão visual (só GET; inclui /health e /portal/clients/me)
cd frontend && npm run preview:api               # porta 8011
```

## Modo offline (modo demonstração)

Implementado em `frontend/lib/offline/`. Como ligar e desligar:

| Como | Efeito |
|---|---|
| nada (padrão) | Antes da primeira chamada, o portal consulta `{NEXT_PUBLIC_API}/portal/clients/me` (rota que lê o banco) com prazo de 4 s. Falhou: modo demonstração para a sessão da aba. |
| `?offline=1` em qualquer URL do portal | Liga na hora e guarda na sessão da aba. Não chama o backend. |
| `NEXT_PUBLIC_OFFLINE_DEMO=1` (build) | Liga sempre. Não chama o backend. |
| `?offline=0` ou `NEXT_PUBLIC_OFFLINE_DEMO=0` | Desliga: falha do servidor vira aviso de erro ("Não foi possível carregar estes dados"), com "Tentar de novo" e "Usar dados de exemplo". |
| botão **Tentar de novo** na faixa | Re-testa a rota com banco; se respondeu, recarrega com os dados reais. |

Regras:

1. Conta como indisponível: **rede caída, timeout acima de 4 s ou resposta
   5xx**, no teste de saúde e em qualquer chamada durante a sessão (a chamada é
   repetida nas fixtures). Resposta 4xx de uma API de pé continua sendo erro.
2. Faixa presa ao topo: "Modo demonstração: servidor indisponível. Dados de
   exemplo." Usuário fictício "Cliente Demo"; datas relativas ao dia atual.
3. Ações que gravariam algo (enviar cotação, aprovar, salvar preferências,
   cadastrar exportador) são **simuladas em memória** e avisam "Prévia: nada
   foi enviado". Envio de arquivo é recusado.
4. Não há mais a tela "Aguarde o servidor inicializar… recarregue em 30
   segundos" no portal.

**Backend que dorme.** O primeiro acesso a um serviço ocioso pode levar
dezenas de segundos, mais que os 4 s do teste: o portal abre em modo
demonstração e o próprio teste já acorda o serviço. Com o banco de pé, um
"Tentar de novo" um minuto depois traz os dados reais.

## Diagnóstico: "Modo demonstração" no ar

1. **O portal fez o que devia.** A faixa diz que o servidor não entregou dados
   (rede, timeout de 4 s ou 5xx). As telas seguem com dados de exemplo.
2. **O backend entrega dados?** Rode o verificador apontando para o host:
   `BACKEND_HEALTH_URL=https://<host> node scripts/check-health.mjs` (ele
   consulta `/portal/clients/me`). Ou veja a última execução de "Saúde do
   backend" na aba Actions.
   - **500**: o serviço está de pé e o **banco** não. Confira o `DATABASE_URL`
     no painel do Render e se o banco existe (a causa de novembro/2026).
   - **Sem resposta / timeout**: serviço dormindo, pausado ou sem crédito.
     Veja o painel do Render; se acordou, "Tentar de novo" no portal.
   - **200 lento** (aviso "provável serviço acordando"): espere e clique
     **Tentar de novo**.
3. **`/health` ou `/docs` respondendo 200 não prova nada**: eles não tocam no
   banco.
4. **O frontend aponta para o backend certo?** Confira `NEXT_PUBLIC_API` no
   projeto da Vercel (Production ou Preview). Ele é embutido no build: depois
   de mudar, é preciso **novo deploy**.
5. **CORS / origem.** Se a rota responde no terminal mas o navegador falha
   (console: erro de CORS), confira `FRONTEND_ORIGIN` e as origens em
   `backend/app/main.py`.
6. **Forçar a demonstração sem esperar:** compartilhe o link com `?offline=1`.

## Verificador de saúde

- Script: `scripts/check-health.mjs` (Node 18+, sem dependências). Lê
  `BACKEND_HEALTH_URL`, consulta uma rota que **lê o banco** (troca `/health`,
  `/docs` ou host puro por `/portal/clients/me`), mede o tempo e sai com código
  1 em 5xx, outro não-2xx ou timeout (`BACKEND_HEALTH_TIMEOUT_MS`, padrão 60 s).
  Acima de `BACKEND_HEALTH_SLOW_MS` (padrão 10 s) passa com aviso. No log
  aparecem host e caminho, nunca a query.
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

- Banco remoto do backend publicado: **a confirmar** (recriar ou apontar para
  outro; registrar aqui só o nome do provedor e onde fica o painel).
- Responsáveis por cada peça: **a preencher**.
- Política de crédito do backend (quem recarrega, alerta de saldo): **a confirmar**.

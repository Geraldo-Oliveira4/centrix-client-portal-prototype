# Onboarding e Performance: o que precisaria de backend

O protótipo guarda tudo no navegador (`localStorage`, prefixo
`centrix-proto-v2:`, com `try/catch` e valor padrão quando falha). Na versão
integrada, os itens abaixo passam a morar no servidor, **por usuário dentro do
tenant** (a empresa cliente), e não por navegador. Repositório público: todos
os exemplos são fictícios.

## 1. Respostas das boas-vindas

| Campo | Tipo | Exemplo | Regra |
|---|---|---|---|
| `priority` | `"custo" \| "prazo" \| "visibilidade" \| null` | `"custo"` | Ordena a Home e a visão "Minha operação". |
| `persona` | `"comex" \| "compras" \| "financeiro" \| "gestor" \| null` | `"compras"` | Ordena os temas da Home. |
| `preferred_routes` | `{ origin: string; destination: string; modal: "MARITIMO" \| "AEREO" }[]` (máx. 3) | `[{ origin: "CNSHA", destination: "BRSSZ", modal: "MARITIMO" }]` | Origem e destino do mesmo modal; sem repetição. Fonte única também para Radar e Configurações. |
| `setup_done`, `tour_done` | `boolean` | `true`, `false` | "Rever tour" no Ajuda volta `tour_done` para `false`. |

Hoje: `centrix-proto-v2:onboarding` (`app/portal/_shared/onboarding.ts`).

## 2. Visão padrão "Minha operação" por usuário

| Campo | Tipo | Exemplo | Regra |
|---|---|---|---|
| `id` | `string` | `"minha-operacao"` | Fixo: refazer a personalização **substitui** esta visão; as outras visões do usuário ficam intactas. |
| `name` | `string` | `"Minha operação"` | Editável pelo usuário (renomear/excluir como qualquer visão). |
| `filters` | `{ rota: string[] }` | `{ rota: ["shanghai", "ningbo"] }` | Rotas das boas-vindas. OU dentro do filtro, E entre filtros. Rota sem embarques vira o estado "0 no recorte", nunca erro. |
| `mode` | `"completa" \| "objetiva"` | `"completa"` | |
| `hidden` | `{ completa: string[]; objetiva: string[] }` | `{ completa: [], objetiva: [] }` | A prioridade **não** esconde blocos. |
| `order` | `{ completa: string[]; objetiva: string[] }` | `{ completa: ["graficos", "precos", "kpis", …] }` | Gerada pela prioridade (regra em `onboarding-intel.ts`). |

Precisa de: endpoint de visões salvas por usuário (hoje
`centrix-proto-v2:intelligence-views`, lido pelo iframe da Inteligência) e uma
regra de criação no fim do onboarding. Quando houver embarques reais, a
Inteligência troca a fixture pelos dados do tenant e o selo "Exemplo
ilustrativo" sai; regras de amostra (n < 3 → "Amostra pequena") continuam.

## 3. Progresso dos "Primeiros passos"

| Campo | Tipo | Exemplo | Regra |
|---|---|---|---|
| `done` | `("cotacao" \| "alertas" \| "inteligencia" \| "visao" \| "colega")[]` | `["cotacao", "inteligencia"]` | Cada passo fecha pela AÇÃO: cotação enviada, preferências de alerta salvas, Inteligência aberta, visão salva/editada, convite enviado. Nunca pelo clique no link. |
| `dismissed` | `boolean` | `false` | |

Hoje: `centrix-proto-v2:first-steps`. Com backend, os eventos que fecham cada
passo são registrados no servidor (a cotação já existe; os outros, não).

## 4. Preferências de alertas

| Campo | Tipo | Exemplo | Regra |
|---|---|---|---|
| `channels` | `("portal" \| "email")[]` (≥ 1) | `["portal", "email"]` | Sem canal o alerta não chega: mínimo um. |
| `frequency` | `"imediato" \| "diario"` | `"diario"` | |
| `weekly_summary` | `boolean` | `true` | Resumo semanal da Inteligência (indicadores + variação + conclusão). |
| `weekly_day` | `"segunda" … "sexta"` | `"segunda"` | |

Hoje: `centrix-proto-v2:alert-delivery` (`app/portal/preferencias/lib/alert-delivery.ts`).
"Testar notificação" é simulado e marcado "Prévia": precisa de um serviço de
envio (e-mail e avisos no portal) e de um endpoint de teste. Os **tipos** de
alerta continuam em Configurações › Alertas.

## 5. Convite de colega

Hoje simulado. Precisa de convite por e-mail com vínculo ao tenant (ver a
gestão de acessos, fora da `main`).

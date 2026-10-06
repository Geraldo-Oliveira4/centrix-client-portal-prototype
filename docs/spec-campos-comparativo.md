# Comparativo de propostas — campos que faltam no backend

Especificação para a versão integrada da tela `/portal/cotacoes/comparativo`
(protótipo: `frontend/app/portal/cotacoes/comparativo/`). A tela hoje roda só
sobre fixture. Abaixo, cada dado que ela usa e que o modelo atual
(`Quotation`, `Proposal`, `PortalProposal` em `frontend/types/portal.ts`) **não**
tem.

> Repositório público: todos os exemplos são **fictícios** (agentes da fixture
> de demonstração, referências `COT-DEMO-*`, valores inventados).

## Campos da proposta

| Campo | Tipo | Onde aparece na tela | Exemplo (fictício) | Regra |
|---|---|---|---|---|
| `free_time_days` | `integer \| null` | Mapa (linha "Free time"); critério Free time da nota | `14` | Dias livres no destino informados pelo agente. `null` = não informado: a tela mostra "—" e a nota conta **0 dias** (ver Regras de nota). Nunca preencher com padrão do armador. |
| `next_departure_date` | `date \| null` | Mapa ("Chegada estimada") e o bloco "Chegada estimada" | `2026-10-11` | Próxima saída informada pelo agente. Chegada estimada = saída + `transit_time` (dias entre portos). Sem saída, a tela conta só o trânsito a partir de hoje e diz isso. |
| `origin_charges` | `Charge[]` | Mapa ("Taxas de origem"), TOTAL ALL IN, TOTAL EM BRL | `[{label:"Handling", currency:"USD", amount:60}]` | Cada item na moeda em que foi cotado. Totais são **somados**, nunca digitados. |
| `freight_charges` | `Charge[]` | Mapa ("Frete internacional"), totais | `[{label:"Frete marítimo LCL", currency:"USD", amount:240}]` | O frete internacional é o **TOTAL** da proposta, nunca tarifa por kg/m³ a multiplicar. Validação de plausibilidade (tarifa por kg digitada como total) é melhoria futura do lado do analista. |
| `destination_charges` | `Charge[]` | Mapa ("Taxas de destino"), totais | `[{label:"Desconsolidação", currency:"BRL", amount:650}]` | Idem. |
| `Charge` | `{ label: string; currency: "USD" \| "EUR" \| "BRL"; amount: decimal }` | — | — | Moedas aceitas hoje no protótipo; ampliar a lista é decisão de produto. |
| `transshipment_port` | `string \| null` | Mapa ("Transbordo/Conexão"); justificativa da recomendação | `"Singapura"` | **Informativo**: não define o porto de desembarque. Só faz sentido com `route_type = transbordo`. |
| `documents` | `{ name: string; kind: "pdf" \| "xlsx" \| "eml"; url: string }[]` | Mapa ("Documentos"); bloco "Cotação dos agentes" | `[{name:"Proposta_Alpha_Opcao1.pdf", kind:"pdf", url:"…"}]` | Arquivos que o agente enviou com a proposta. Lista vazia = "Nenhum arquivo enviado". |
| `insurance_included` | `boolean` | Mapa ("Seguro incluso", ícone + texto); elegibilidade | `true` | Já existe em `PortalProposal`; listado porque passa a ser regra de elegibilidade (ver `insurance_required`). |
| `insurance_charge` | `Charge \| null` | TOTAL ALL IN, TOTAL EM BRL | `{label:"Seguro internacional", currency:"USD", amount:120}` | Prêmio de seguro quando o agente o contabiliza; entra no total. |
| `high_audit_pending` | `boolean` | Elegibilidade (Recomendação IA, motivo de exclusão) | `false` | Pendência de auditoria de severidade alta ou crítica envolvendo o agente. `true` = não pode ser recomendada. Não é exibido como selo no Mapa. |

## Campos da cotação

| Campo | Tipo | Onde aparece na tela | Exemplo (fictício) | Regra |
|---|---|---|---|---|
| `insurance_required` | `boolean` | Resumo da solicitação ("Seguro"); elegibilidade | `true` | **Rodoviário sempre exige seguro.** Nos outros modais depende do que foi pedido aos agentes nesta cotação. **Sem regra automática** por incoterm nem por valor de carga. Proposta com `insurance_required && !insurance_included` não pode ser recomendada. |
| `ptax_rates` + `ptax_date` | `{ USD: decimal; EUR: decimal }`, `date` | Mapa ("TOTAL EM BRL — aprox. à taxa PTAX de …") | `{USD:5.42, EUR:5.89}`, `2026-10-05` | **Uma taxa comum** a todas as propostas da cotação. "Menor preço" e o critério Custo usam o total em BRL convertido por ela. |
| `recommendation_approval` | `{ status: "em_revisao" \| "aprovada"; approved_by: user_id; approved_at: datetime }` | Aba Recomendação IA; selo "Recomendada" no Mapa | `{status:"aprovada", approved_by:"<id>", approved_at:"2026-10-06T14:00:00Z"}` | Regra do Mauro: a recomendação só é visível ao cliente **depois** que o analista da Freitas a aprova. Antes disso a API não devolve nota, ranking nem a proposta recomendada (o filtro tem de estar na API, não só na tela). |
| `chosen_proposal_id` | `uuid \| null` | Selo "Escolhida"; botões "Aprovar esta proposta" desabilitados | `"b-delta"` | A proposta que o cliente aprovou. Independe da recomendação: o cliente pode aprovar uma não recomendada. |
| `choice_reasons` | `("preco" \| "prazo" \| "ja_trabalho_com_agente" \| "rota_porto" \| "outro")[]` | Diálogo de aprovação, passo opcional "Por que você escolheu esta proposta?" | `["preco", "rota_porto"]` | **Opcional e pulável.** Ideia de produto pendente de validação do Orsi, para alimentar o futuro relatório de propostas ganhas/perdidas por agente. Hoje não é persistido. |
| `link_valid_until` | `date` | Resumo ("Link válido até …") | `2026-10-18` | Validade do link da proposta comercial. |

## Regras de nota

*Regra vigente; pode mudar por decisão comercial/de produto.* Fonte única no
protótipo: `frontend/app/portal/cotacoes/comparativo/lib/recommendation-engine.ts`
(constantes nomeadas, com testes).

- **Nota 0–100** = soma ponderada das notas por critério.
- **Pesos**: Custo 28% (menor custo total em BRL, à taxa comum) · Transit time
  22% (menos dias) · Rota 18% (direta 100; com transbordo 40; sem informação 0)
  · Frequência 14% (diária 100; semanal 80; quinzenal 50; mensal 25; sem
  informação 0) · Free time 10% (mais dias) · Validade 8% (mais dias úteis
  restantes).
- **Relativos ao grupo**: Custo, Transit time, Free time e Validade são
  normalizados contra o melhor e o pior valor das propostas **elegíveis** da
  cotação (melhor = 100, pior = 0, linear no meio).
- **Tolerâncias de equivalência**, sempre contra o melhor valor do grupo:
  custo até **2%** acima do menor total; transit time até **1 dia** a mais;
  free time até **2 dias** a menos; validade até **2 dias úteis** a menos.
  Dentro da tolerância = 100.
- **Free time ausente = 0 dias**, e depois passam a equivalência e a
  normalização (não vira nota 0 automaticamente).
- **Empate por ausência**: critério que nenhuma proposta informou vale **100**
  para todas.
- **Elegibilidade**: fora da recomendação a proposta vencida (validade antes de
  hoje), a sem o seguro exigido e a com pendência de auditoria alta/crítica.
- **Recomendada**: entre as elegíveis com total até **10%** acima da mais barata
  elegível, **rota direta tem prioridade**; dentro dela, a maior nota. Logo, a
  recomendada **não é necessariamente a maior nota**, e a tela diz isso.

## Dívida aberta

- **Detalhe antigo sem portão do analista.** `/portal/cotacao/[id]` ainda passa
  as notas por critério (`recommendation.scores`) ao painel de recomendação
  (`components/recommendation-panel.tsx`) sem o estado de aprovação do
  analista. A nova tela é a única superfície com o portão. **A unificar**: a
  integração deve servir as duas pelo mesmo contrato (`recommendation_approval`
  acima) e o mesmo motor de regras, e o detalhe antigo deve deixar de receber
  notas antes da aprovação.

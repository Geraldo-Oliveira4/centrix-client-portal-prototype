# Detalhe de cotação — prévia local

Implementação React no layout nativo Centrix, em `/portal/cotacoes/previa?cenario=comparar`. Base: main `8a18f7e` (PR #2 integrado). Branch `codex/cotacao-hierarquia`. A rota de revisão continua isolada. /portal/cotacao/[id] passa a usar o novo layout com dados e ações do backend existente, mantendo o Kanban da main.

## Executar

Na pasta `frontend`, instalar as dependências do lockfile com `npm ci`. Em um terminal PowerShell:

```powershell
$env:PREVIEW_API_PORT = '8014'
$env:PREVIEW_ORIGIN = 'http://localhost:3014'
npm run preview:api
```

Em outro terminal:

```powershell
$env:NEXT_PUBLIC_API = 'http://localhost:8014'
$env:NEXT_TELEMETRY_DISABLED = '1'
npm run dev -- -H 127.0.0.1 -p 3014
```

Abrir `http://localhost:3014/portal/cotacoes/previa?cenario=comparar`. A API local atende apenas o shell e as fixtures anteriores de embarques; esta nova experiência de cotação não envia requests de negócio. Selecionar cenários pelo controle discreto no topo. Ver variações abre o guia por etapa em ?variacoes=1. Minhas cotações e o menu global conservam a rota existente do Kanban.

Guia para desenvolvimento: [GUIA-DEV.md](./GUIA-DEV.md), com links das 14 variações, roteiro e limites de integração.

## Escopo e dados

15 cenários (incluindo envio programado aos agentes): comparação, complemento, rascunho, dados completos para revisão do envio, espera, parciais, escolha em análise, liberada, devolvida, fechada, vencidas, falta de dados, recusada e cancelada. Relógio demonstrativo fixo em 13/09/2026. Empresas, ofertas, documentos e métricas são fictícios. Chegadas provêm das datas nas fixtures; não são hoje + trânsito. Valores em BRL por contêiner, cobertura explícita; custos ausentes não viram zero.

Comparação por oferta, seleção explícita, composição expansível, recomendação pelo menor valor completo que atende à necessidade no porto, histórico e referência de mercado. Validade/escopo/estado são rechecados na confirmação. Escolha leva à revisão; liberar, devolver, fechar e receber respostas são controles de simulação. Formulário valida peso/volume, mantém campos preenchidos e permite revisar destinatários antes do envio simulado. Recusa/cancelamento guardam motivo e histórico. Falha simulada conserva escolha.

Persistência por cenário no localStorage, prefixo `centrix-quotation-preview-v1:`. Reiniciar remove somente o registro do cenário atual, sem apagar sessões ou outras aplicações. Não há banco, LLM, envio de e-mail, upload, cobrança ou sincronização multiusuário. Documentos mostram metadados demonstrativos sem arquivo. Instrução e embarque são resumos locais de continuidade; a integração com os fluxos completos permanece para a próxima etapa.

Raio X do agente: seção final da comparação com pontualidade, divergências confirmadas entre cotado e cobrado e experiência na rota, usando as mesmas amostras de cada oferta. Acompanha a escolha (ou a recomendação inicial); consultar outro agente pelo seletor não altera a escolha nem o contexto de mercado. Uma nova escolha volta a orientar o Raio X. Expansão informa critérios, período e limites das evidências; registros individuais, causas/duração dos atrasos e atendimento ainda não estão conectados.

## Verificação

Mercado fica junto ao preço de cada oferta completa, sem faixa isolada. Os detalhes de custos mostram mediana, amostra/período, rota e cobertura; ofertas incompletas não exibem percentual. Percentuais são arredondados, calculados sobre a mesma mediana demonstrativa de R$ 24.100.

Regressão de seleção: escolher Beta → consultar Gamma no Raio X → clicar novamente no rádio de Beta deve restaurar o perfil de Beta. Clicar no nome/área da linha de Alpha deve selecionar Alpha e atualizar o perfil; abrir Detalhes não deve alterar a escolha. Ofertas inválidas/incompletas continuam bloqueadas. A necessidade de chegada tem destaque próprio no contexto e referência na coluna de chegada, mantendo a distinção entre porto e fábrica.

`npm run test:quotation-preview` verifica regras de recomendação, validade/escopo, estados e datas. `npm run build` verifica a rota nativa e tipos. Revisão por navegador: comparação/seleção, erro/repetição, persistência, complemento/envio com destinatário único, chegada de propostas, detalhes e responsividade. Registrar resultados efetivos no esquema vivo do vault.

Plano canônico: `C:\SecondBrain_local\SB_Vini\03_Projetos\Cliente\Ativos\Freitas_Comex\Centrix_SaaS\Plano_Telas_Detalhe_Cotacao.md`. Estado e evidências: `Esquema_Vivo_Portal.md` no mesmo diretório. Deploy do detalhamento autorizado em 13/09/2026, incluindo abertura pelos cartões sem alteração do Kanban. Ver limites da conexão no GUIA-DEV.md.

## Early quotation stages — local revision, 2026-09-13

Preparation and waiting now share the comparison page typography, spacing, context and table treatment. The live detail uses a compact data summary for missing information, an inline RFQ form for an explicitly undispatched request, and agent response rows for waiting/partial responses. Partial offer conditions are collapsed under Consultar propostas; no agent profile or recommendation is presented during waiting. Existing RFQ save/dispatch actions and the email complement fallback are preserved; no business mutations were performed during verification.

The interactive prototype at /portal/cotacoes/previa?cenario=rascunho additionally edits supplier, PO, product, pickup and dates, preserving values through the existing browser storage. Continuar depois does not dispatch. Complementar, envio, aguardando and parciais remain direct review scenarios. These draft edits are demonstrative, not a new API persistence contract. AGUARDANDO_DADOS alone does not prove an unsent request or client invisibility. The user clarified that scheduling means sending to agents. The programado scenario and dispatch review demonstrate a Sao Paulo date/time, editing and cancellation, with browser-only persistence. No automatic sender or backend scheduler was implemented.

TypeScript and 27 quotation/card checks passed, including future-date validation and preventing scheduling of sent or incomplete requests. Browser verified draft edit/reload persistence, waiting and partial variants, and the matching API-backed missing-info/partial details. This revision is local, not deployed.

### Progressive responses and additional invitations — local revision

The preview now allows explicit review of available offers without waiting for all agents; receiving all offers does not automatically release a decision. Per-agent preview and additional-invitation dialogs preserve responses and filter already invited agents. Catalog and actions are illustrative; no portal backend permission or dispatch endpoint was changed. See GUIA-DEV for integration requirements and simulator limits. 29 quotation tests and TypeScript pass.

### Detail release package — 2026-09-13

Based on published settings commit 786d229 with the Kanban preserved. Drafts now reuse the existing ManualForm from Nova Cotação (sections, conditional fields and equipment/volume dialogs) with browser-only save and review. See the latest GUIA-DEV section for updated steps; the previous eight-field draft is replaced. Live detail actions retain existing endpoints. New scheduling/additional invitations remain prototype interactions.

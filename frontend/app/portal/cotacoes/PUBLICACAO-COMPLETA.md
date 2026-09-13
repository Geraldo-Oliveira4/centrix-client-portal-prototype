# Complete quotation publication — 2026-09-13

## Current release — full quotation journey

Source: 7f27704bd8367b2df025039586cab5a4902a9f39, branch codex/cotacoes-publicacao-final. Deployment dpl_8PbWCpWNQ2L9G2qoUG4LHeQtrCEB is READY and promoted to https://centrix-client-portal-prototype.vercel.app. Candidate: https://centrix-client-portal-prototype-jsrmol50c.vercel.app. This section supersedes earlier publication/local-only checkpoints below.

Merged codex/cotacoes-historico (7d9aa08) onto the exact current public base 177892f657776285c9bebd2e9e0bd15bd19c0b25 without conflicts. Preserves Central de trabalho/Operação, Radar, Inteligência, Panorama/Alertas, Configurações and shipments. Changes relative to that base are confined to quotation journeys, the shared ManualForm and their documentation.

Published: revised Kanban; Em andamento/Aprovadas/Histórico; final contracted conditions; Cotar novamente with separate local drafts; Aprovadas with shipment linkage and simulated opening requests; actual early-stage details using the shared draft form; received proposal preview and additional-agent selection; restored shared visual styles; Preencher com IA demonstration in all draft entries. Nine card examples, fifteen status scenarios and four habitual-request entries remain available.

Verification: 54 focused quotation tests passed. Local production build and Vercel production build passed type checking and generated 48 static pages (repository configuration skips lint). Authenticated candidate GET returned 200; all 28 checked public routes returned 200. Browser confirmed the public three tabs, approved shipment-opening actions, history with final conditions/repeat actions, actual draft with assisted-fill dialog, and partial-response detail with Alpha received and Beta/Gamma available. Public deployment ID checked after promotion. Full draft completion-to-dispatch UI and new accessibility audit were not performed; no real business sends occurred.

Prototype boundaries remain: drafts, scheduling, added invitations, repeated requests and opening requests are browser-local simulations. Assisted fill recognizes five labelled fields in demonstration text; no LLM or document extraction/upload is connected. Existing early-stage workspace replaces the former live complement/RFQ form in this prototype, not its backend integration. Existing API data remains authoritative. See HISTORICO.md and GUIA-DEV.md.

Rollback: dpl_8weV9Zi6Ju9uayMte6wwsDNbDAGF / https://centrix-client-portal-prototype-c9o4fqny4.vercel.app / source 177892f. Exact previous public ID checked immediately before promotion. Build/runtime NEXT_PUBLIC_API remains https://centrix-client-portal-prototype.onrender.com. GitHub synchronization remains pending; no push or PR attempted in this release. Future deployments must include 7f27704 to preserve this quotation work.

## Earlier publication checkpoints

Source: 630142c27a6e27aef6546de71fffbc0d49e8259b.
Branch: codex/cotacoes-publicacao-completa.
Deployment: dpl_g3dE1GACQjJ3yNLuk7ciUejxuEsD (READY, promoted, public ID verified).
Candidate: https://centrix-client-portal-prototype-brs86d9f8.vercel.app
Public Kanban: https://centrix-client-portal-prototype.vercel.app/portal/cotacoes

Vinicius explicitly expanded publication to include the approved Kanban hierarchy and all added status details. Cherry-picked 8ebfef4 as 28f5408 onto 17acfde/cd15780, retaining the published habitual requests, quotation details, Panorama/Alertas and Configurações. Only overlapping documentation and the already-present optional exporter_name comment needed conflict resolution. No changes to columns, grouping or quotation IDs.

Cards identify cargo/supplier and PO before stage-specific action. Waiting shows response progress without implying a released selection. Choosing shows price, freight agent, transit and offer validity; recommendation requires an explicit valid flag. The current API can omit exporter_name, so cargo is the title fallback with supplier unavailability explicit. Fixture suppliers are never injected into actual records.

Review entry points:
- Nine card examples: /portal/cotacoes/previa-cards (links to status and habitual-request previews).
- Fifteen status details: /portal/cotacoes/previa?variacoes=1.
- Four habitual-request entries: /portal/cotacoes/previa-habituais.

All detail scenarios retained: comparar, complementar, rascunho, envio, programado, aguardando, parciais, analise, liberada, devolvida, fechada, vencidas, sem-dados, recusada, cancelada. Actual cards still open /portal/cotacao/[id] with API state/permissions. Scheduling, additional invitations, progressive decision demonstration and habitual templates retain their existing prototype-only boundaries; no new RFQ or scheduler integration is claimed.

Validation: 54 tests passed; TypeScript passed; production build generated 47 static pages. Authenticated candidate GET returned 200. Public deployment ID verified; all 15 status URLs, Kanban, nine-card preview, habitual requests, shipments and Configurações returned HTTP 200 (20 routes). Browser verified local nine-card hierarchy and public Kanban with 13 active quotations. No full date/review/send E2E or new accessibility audit; previous date-picker automation limitation remains documented.

Rollback: dpl_6cggTx6HTN12Bkgg1betqZhyeca4 / cd15780. Previous public ID checked before promotion. Build/runtime NEXT_PUBLIC_API explicitly points to https://centrix-client-portal-prototype.onrender.com. File comparison preserves shipment/detail code, existing status models, Configurações and public prototype assets.

GitHub synchronization remains pending following the prior automatic-review rejection of the fork push; no push retry, new PR or merge in this turn. Source committed in this local checkout and deployed to the authorized Vercel project. Future releases must include this source to avoid reverting the approved Kanban.

Browser follow-up: clicking the actual COT-2026-0015 card opened its matching API-backed detail with the new Respostas parciais layout, cargo-need summary, preparation steps and received-agent table. Returned to the public Kanban and left it open for review.

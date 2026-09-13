# Complete quotation publication — 2026-09-13

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

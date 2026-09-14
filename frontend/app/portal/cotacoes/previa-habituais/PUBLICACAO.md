# Publication — habitual quotation requests, 2026-09-13

Public source: cd1578075401c144700489569aa271b2066d23c6.
Deployment: dpl_6cggTx6HTN12Bkgg1betqZhyeca4 (READY, promoted and verified).
Public URL: https://centrix-client-portal-prototype.vercel.app/portal/cotacoes/previa-habituais
Candidate: https://centrix-client-portal-prototype-1d7nz7g8x.vercel.app
Branch: codex/cotacao-habituais.

Preserved public base: 6b181f96215972189aea3c83cdd273ccf7a089e4, plus documentation b577aec. This includes Panorama/Alertas, cd1bd72 quotation details and the previous Configurações release. Main was checked at 8a18f7e. File comparison confirmed unchanged Kanban, shipment components, alerts assets and Configurações. Do not redeploy an older branch without these published changes.

Rollback: dpl_Eq5NCRPrXwQhSjtQ22b9UuBFzNEP, https://centrix-client-portal-prototype-r5r9mqssq.vercel.app. The previous domain ID was checked again immediately before promotion. API build/runtime setting: NEXT_PUBLIC_API=https://centrix-client-portal-prototype.onrender.com.

The isolated preview offers entrada=nova, historico, fornecedor and rota. It reuses ManualForm, with stable context copied into a new remittance and browser-local models/draft. The normal Nova Cotação page and Configurações route catalogue are not connected to this preview. No RFQ, recurring scheduler or external message is produced.

Validation: 47 quotation/panorama/alert tests, TypeScript, production build (46 static pages), authenticated candidate HTTP 200 and public deployment ID. Nine public route GETs returned 200, including four preview entries, Kanban, draft detail, normal Nova Cotação, shipments and Configurações. Browser verified public route filtering and inherited form context with blank transaction fields. Local 390×844 check found and fixed grid overflow; list and shared form were rechecked. Full final review/send with native dates remains unverified because the internal browser failed on date automation/calendar in the previous round; no full E2E claim or accessibility audit.

GitHub synchronization is pending: automatic approval review rejected pushing to IonixAdmin/centrix-client-portal-prototype, citing missing specific authorization for that destination/payload. No workaround push, new PR or merge was performed. Source is committed locally and deployed only to the explicitly authorized Vercel project. Obtain explicit permission for the fork before retrying the push.

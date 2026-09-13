# Publication — quotation details, 2026-09-13

Public source: cd1bd72bbf0a7177954d38c5001e0ad3e3ea95c2.
Deployment: dpl_J2UnFSmUxgYAgyXWNkWvR9hbo67H (READY, promoted).
URL: https://centrix-client-portal-prototype.vercel.app
Candidate: https://centrix-client-portal-prototype-4aykqzs7g.vercel.app
PR: https://github.com/Geraldo-Oliveira4/centrix-client-portal-prototype/pull/6 (merge pending in the original repository).

Preserved base: 786d229 (previous deployment dpl_8jas9mccKrm1vBaYPmYquyTniF3P). Exact file comparison confirms no changes to the Kanban, Configurações or shipment code in this release. Do not redeploy older branches without incorporating these published commits. NEXT_PUBLIC_API was explicitly set to https://centrix-client-portal-prototype.onrender.com for build and runtime.

Validation: 22 quotation tests; TypeScript; production build (45 static pages); authenticated candidate GET 200; public deployment ID verified; HTTP 200 for Kanban, draft, waiting, partial, quotation detail, Configurações and shipments. Browser verified the published draft sections/fields and partial-response table/actions. Local browser verified normal creation UI unchanged, saved draft restoration and review with current route/cargo.

Public review links:
- Draft: https://centrix-client-portal-prototype.vercel.app/portal/cotacoes/previa?cenario=envio
- Waiting: https://centrix-client-portal-prototype.vercel.app/portal/cotacoes/previa?cenario=aguardando
- Partial: https://centrix-client-portal-prototype.vercel.app/portal/cotacoes/previa?cenario=parciais
- Scheduled: https://centrix-client-portal-prototype.vercel.app/portal/cotacoes/previa?cenario=programado
- All 15 variants: https://centrix-client-portal-prototype.vercel.app/portal/cotacoes/previa?variacoes=1

The preview draft reuses Nova Cotação's ManualForm, including conditional fields and equipment/volume dialogs. Saving/reviewing never creates a new quotation through the API. Scheduling, additional invitations and early comparison are demonstrations; no external message was sent. API-backed detail routes retain their existing actions and state permissions. See GUIA-DEV.md for integration requirements.

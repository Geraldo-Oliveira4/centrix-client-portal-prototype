# Quotation history — local review, 2026-09-13

Branch: codex/cotacoes-historico. Base: 969242e (published quotation code 630142c).
Review: http://localhost:3036/portal/cotacoes?tab=historico

## Behavior

- Em andamento retains the approved three-column Kanban. Histórico lists only FECHADA, DECLINADA and CANCELADO. Client approval remains active.
- Search, result and period are URL state; detail links preserve the return location. Legacy fechadas and negadas tabs resolve to equivalent filters.
- A closed row uses a unique winning proposal consistent with winning_agent_id. The API list's cheapest best_proposal is insufficient; missing winners are resolved through the existing detail hook. Missing data remains explicit.
- Freight conference and its existing document modal remain available in the closed quotation detail. This revision does not change the existing upload endpoint.
- Cotar novamente opens /portal/cotacoes/repetir/[id] with the shared DraftRequestForm/ManualForm. A stable-field allow-list clears PO, occurrence dates, dimensions, prices, PTAX, offers, recipients, attachments and schedule. The source quotation is not mutated.
- Saving creates a distinct local occurrence in Preencher detalhes. Multiple drafts coexist; drafts for the same source offer resume or a separate remittance.
- Review validates cargo and dates, asks for recipients and explicit confirmation. Dispatch is simulated and becomes a local waiting card; it makes no API request.
- Optional named models are separate from drafts and available when starting another remittance from the same source.

## Persistence and integration limits

New occurrences use centrix-repeat-requests-v1:<clientId>; source-specific models use centrix-history-habits-v1:<clientId>. Both are browser-local. Storage errors remain visible and do not claim success.

These models are not yet merged with the standalone previa-habituais catalogue or normal Nova Cotação entry. Real drafts, RFQ dispatch, scheduled jobs and shared template persistence require backend integration. Browser storage is not an authorization boundary; backend integration must enforce tenant access independently.

## Verification

45 focused tests passed across history, card presentation, reusable requests and quotation detail/status rules. TypeScript --noEmit passed; git diff --check passed.

Browser checks: history search; detail link with retained filters; closed conference and document action; cleared occurrence fields; save draft; new Kanban card/count; resume with supplier, PO and notes intact; desktop and 390px history layout with readable actions. No document upload or real dispatch was performed. The simulated dispatch end-to-end UI and full keyboard/accessibility audit were not exercised.

No deployment in this revision. Other threads have since published Radar, Inteligência and Central de trabalho. Reconcile with the current public base before any future deployment; do not publish this older base wholesale.

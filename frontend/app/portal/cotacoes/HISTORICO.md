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

## Approved workspace — local revision, 2026-09-13

User requested a separate Aprovadas tab to facilitate shipment opening. /portal/cotacoes?tab=aprovadas includes APROVADA_PELO_CLIENTE and FECHADA; client approvals leave the choice column. Closed quotations remain in history, making this an operational cross-section rather than another terminal state. Default filter is no linked shipment; linked/all filters and search are available.

Shipment links resolve only through quotation_id from the portal shipment list. Review guard, existing sent SI and unknown lookup status prevent a new opening action. Request registration is explicitly simulated, stored under centrix-opening-requests-v1:<clientId>, and does not send an SI, contact the team or create a shipment. Existing SI generation/dispatch in detail remains unchanged. A saved request can be inspected and does not offer duplicate registration. Real opening workflow integration and reconciliation of analyst-created requests remain pending.

Verification: 20 focused tests (approval classification/stage precedence, history and cards) and TypeScript passed. Browser showed two quotations without a shipment and three with links; request dialog/save/state change and mobile tabs/layout checked. Production publication remains pending; preserve current concurrent public modules when integrating.

## Correct early-stage detail routing — local, 2026-09-13

User reported that actual cards still opened the old complement summary and incomplete waiting view. The detail entry now routes AGUARDANDO_DADOS, TRIAGEM_IA, COTANDO and PARA_ANALISE to EarlyQuotationDetail. Missing information opens only the shared ManualForm workspace, preserving existing PO, dates, values and dimensions (unlike Cotar novamente). Waiting shows registered/dispatched agents and respondents, per-agent proposal preview, and an inline catalogue for additional recipients. Additional invitations preserve prior responses and remove selected recipients from the available list after confirmation.

Draft edits and invitations use centrix-preparation-v1:<clientId>:<quotationId>; sends remain explicit local simulations. Saved draft dispatch changes the local detail to waiting and projects that move into the Kanban without mutating the source API. Existing backend records and proposals remain authoritative; unknown recipient/catalog data stays explicit. The new early-stage workspace supersedes the old live complement-mail/RFQ form in this prototype; it must not be described as production RFQ integration. Comparison, approval and terminal detail routes remain unchanged. Existing standalone scenario previews remain accessible by their direct URLs.

34 focused rule tests and TypeScript pass. Browser verified incomplete form with original PO/value, saving notes, partial response preview, selection/review/invitation of a second agent while preserving the first response. Full draft completion-to-dispatch UI was not exercised; no real business send occurred. Not deployed.

### Early-stage visual correction

The new workspace lacked the shared .workspace ancestor, leaving --q-* variables undefined and dropping panel backgrounds, borders and heading styles. Restored the existing scope, context grid and restrained agent-row separators. An unconfirmed dispatch now uses Preparar envio aos agentes / Selecionar agentes, without marking preparation complete or claiming responses are awaited. TypeScript passed. No API mutation or deployment.

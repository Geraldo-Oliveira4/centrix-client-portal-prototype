# Quotation card hierarchy — local review

Open `/portal/cotacoes/previa-cards` for nine examples in the existing three-column Kanban. `/portal/cotacoes` uses the same presentation with current API data. This revision is local, not deployed.

- Identify the demand by goods supplier, PO, cargo, route and cargo need date.
- Missing information: show the pending step and open the quotation detail through “Ver pendência”. The detail retains its existing update action.
- Waiting: show response progress, including one received offer, without presenting a price or recommendation as a released decision.
- Choosing: show the featured price, freight agent, transit time, proposal count and explicit offer validity. Recommendation requires an explicit flag and usable offer.

No changes to columns, ordering or bucket rules. Search also matches the supplier when supplied. Arrival is not inferred from today plus transit time; cargo need, response deadline and offer validity remain separate.

## Data boundary

`examples.json` is a public demo quotation snapshot with illustrative suppliers and selected dates, identified in the page banner. It includes missing supplier, missing details, no offers, a partial response, a recommended offer and an expired offer. Links open the existing quotation IDs; fixture-only supplier/date overrides do not propagate to the detail.

`PortalQuotation.exporter_name` is an optional proposed display projection. The current quotation API omits the supplier relationship; the UI falls back to product/reference and states supplier unavailability. Do not infer the goods supplier from freight agent, carrier or origin. Backend mapping and contract validation remain pending.

## Verification

Run `npm run test:quotation-cards` and `npx tsc --noEmit`. Browser checks covered supplier search and navigation from a missing-information card to its matching detail. No quotation mutation or publication is needed to review this page.

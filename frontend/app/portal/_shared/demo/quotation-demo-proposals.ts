// Demonstration proposals for a quotation that has none.
//
// PURE, and free of the `@/` alias: it runs under `npm run test:unit`.
//
// WHY THIS EXISTS. A quotation opened through the portal is created by
// `create_quotation_core` in TRIAGEM_IA with ZERO proposals, and nothing in
// this prototype ever produces one — the RFQ e-mail is a no-op log, so no agent
// ever answers. The V2 journey therefore stalled at the exit review:
// `releaseProposals([])` refuses to release nothing, so a quotation the client
// had just opened sat in "Em revisão" forever and the live demonstration could
// never reach the comparison screen.
//
// THE RULE THAT CANNOT SLIP: these NEVER replace real proposals. They are used
// only when the payload has none AND the quotation has a V2 overlay — a
// quotation outside the journey, and every seeded quotation that really does
// carry proposals, is untouched. `is_demo` travels with each row so the screen
// can refuse to approve one: approving posts the proposal id to the backend,
// and these ids exist nowhere but here.

import type { PortalProposal } from '../../../../types/portal.ts';

/**
 * The three agents. Fictional, like every name in this repository.
 *
 * Distinct on purpose in the three axes the client compares: price, transit
 * time and completeness. The third has no price, which is what exercises the
 * "blocked / not released" path of the exit review — a proposal the Freitas
 * would hold back instead of passing on.
 */
const DEMO_AGENTS = [
  {
    id: 'demo-agent-alpha',
    name: 'Alpha Cargo',
    carrier: 'Maersk',
    totalBrl: 6490,
    totalValue: 1180,
    currency: 'USD',
    transit: 29,
    validityDays: 16,
    recommended: true,
  },
  {
    id: 'demo-agent-gamma',
    name: 'Gamma Logistics',
    carrier: 'MSC',
    totalBrl: 7120,
    totalValue: 1295,
    currency: 'USD',
    transit: 27,
    validityDays: 18,
    recommended: false,
  },
  {
    id: 'demo-agent-delta',
    name: 'Delta Freight',
    // No price: the exit review holds this one back.
    totalBrl: 0,
    totalValue: 0,
    currency: 'EUR',
    carrier: null,
    transit: 33,
    validityDays: 0,
    recommended: false,
  },
] as const;

/** A demonstration proposal carries this flag; a real one never does. */
export interface DemoPortalProposal extends PortalProposal {
  is_demo: true;
}

function isoDaysFrom(base: number, days: number): string | null {
  if (days <= 0) return null;
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * The three proposals for one quotation.
 *
 * DETERMINISTIC given the same `now`: the ids are derived from the quotation
 * id, so a released list survives a reload and keeps pointing at the same rows.
 * `now` is injected rather than read here so the validity dates are testable.
 */
export function demoProposalsFor(
  quotationId: string,
  now: number = Date.now(),
): DemoPortalProposal[] {
  return DEMO_AGENTS.map((agent) => ({
    id: `demo-proposal:${quotationId}:${agent.id}`,
    quotation_id: quotationId,
    agent_id: agent.id,
    agent: { id: agent.id, name: agent.name },
    total_value: agent.totalValue,
    total_brl: agent.totalBrl,
    freight_value: agent.totalValue,
    taxes_breakdown: {},
    transit_time: agent.transit,
    route_type: null,
    route_detail: null,
    proposal_origin: null,
    proposal_destination: null,
    carrier: agent.carrier,
    validity: isoDaysFrom(now, agent.validityDays),
    insurance_included: false,
    incoterm: null,
    is_winner: false,
    received_at: new Date(now).toISOString(),
    numero_oferta: null,
    ptax_percentual: null,
    prazo_pagamento_dias: null,
    seguro_percentual: null,
    seguro_minimo: null,
    frequencia: null,
    observations: null,
    carga_perigosa: null,
    is_recommended: agent.recommended,
    additional_costs: null,
    moeda_original: agent.currency,
    is_demo: true,
  })) as DemoPortalProposal[];
}

/** True for a row this module produced. */
export function isDemoProposal(proposal: { id: string }): boolean {
  return proposal.id.startsWith('demo-proposal:');
}

/**
 * The proposals the V2 journey should work with.
 *
 * Real ones win, always and without inspection: one real proposal in the
 * payload is enough to keep the demonstration set out entirely. Mixing the two
 * would put a row the backend cannot approve next to one it can, in the same
 * table, with nothing telling them apart.
 */
export function effectiveProposals<
  T extends { id: string; proposals?: { id: string }[] | null },
>(quotation: T, now: number = Date.now()): PortalProposal[] {
  const real = quotation.proposals ?? [];
  if (real.length > 0) return real as PortalProposal[];
  return demoProposalsFor(quotation.id, now);
}

/** The ids the exit review may release: the ones with a price. */
export function releasableProposalIds(proposals: PortalProposal[]): string[] {
  return proposals
    .filter((p) => Number.isFinite(p.total_brl) && p.total_brl > 0)
    .map((p) => p.id);
}

import type { PortalProposal } from '../../../../types/portal';
import { seededInt } from '../../inteligencia/lib/intel-helpers.ts';

/** Eligibility uses the current calendar day, unlike the frozen review fixtures. */
export function proposalIssue(
  p: Pick<PortalProposal, 'total_brl' | 'validity'>,
  today = new Date().toLocaleDateString('en-CA'),
): string | null {
  if (!Number.isFinite(p.total_brl) || p.total_brl <= 0)
    return 'Valor a confirmar';
  if (!p.validity || !Number.isFinite(Date.parse(p.validity)))
    return 'Validade a confirmar';
  if (p.validity.slice(0, 10) < today) return 'Proposta vencida';
  return null;
}

/** Same illustrative 8% benchmark as the existing MarketBlock; one base per quote. */
export function illustrativeMarketReference(
  proposals: PortalProposal[],
): number | null {
  const priced = proposals.filter(
    (p) => Number.isFinite(p.total_brl) && p.total_brl > 0,
  );
  const reference =
    priced.find((p) => p.is_winner) ??
    priced.find((p) => p.is_recommended) ??
    [...priced].sort((a, b) => a.total_brl - b.total_brl)[0];
  return reference ? reference.total_brl * 1.08 : null;
}

/** UI reference only: stable sample per agent, not calculated from shipment records. */
export function illustrativeAgentHistory(agentId: string) {
  const completed = seededInt(agentId + ':sample', 8, 24);
  const audited = completed - 2;
  return {
    completed,
    onTime: completed - seededInt(agentId + ':late', 1, 4),
    audited,
    discrepancies: seededInt(agentId + ':billing', 0, 2),
  };
}

import type { PortalQuotationsResponse } from '@/types/portal';

import { flattenQuotations, withProposal } from './intel-helpers';

// Same illustrative factor the (now relocated) MarketBlock uses: the sector
// benchmark sits 8% above what the client actually paid. There is no price-index
// feed in this prototype, so any "economia" derived from it is illustrative.
const BENCHMARK_FACTOR = 1.08;

export interface AgentWins {
  name: string;
  wins: number;
}

export interface PerformanceMetrics {
  /** REAL. Total quotations across every bucket. */
  totalQuotations: number;
  /** REAL. Counts by terminal/active state. */
  approved: number;
  declined: number;
  cancelled: number;
  inProgress: number;
  /** REAL. Closed / (closed + declined), 0..100, or null when nothing decided. */
  approvalRate: number | null;
  /** REAL. Mean days from created_at to the best proposal's received_at. */
  avgResponseDays: number | null;
  /** REAL. Winning agent per closed quotation, most wins first. */
  agentWins: AgentWins[];
  /** ILLUSTRATIVE. closedSum * (benchmark - 1) — no real market baseline. */
  estimatedSavingsBRL: number | null;
}

/**
 * Derives the client's performance dashboard entirely from the existing
 * /portal/quotations payload — no new endpoint. Every field except
 * estimatedSavingsBRL is real; the savings figure reuses the illustrative
 * benchmark factor and must be shown behind the preview badge.
 */
export function computePerformanceMetrics(
  data?: PortalQuotationsResponse,
): PerformanceMetrics {
  const all = flattenQuotations(data);
  const approved = all.filter((q) => q.state === 'FECHADA');
  const declined = all.filter((q) => q.state === 'DECLINADA');
  const cancelled = all.filter((q) => q.state === 'CANCELADO');

  const decided = approved.length + declined.length;
  const approvalRate =
    decided > 0 ? Math.round((approved.length / decided) * 100) : null;
  const inProgress =
    all.length - approved.length - declined.length - cancelled.length;

  const responseDays = all
    .map((q) => {
      const received = q.best_proposal?.received_at;
      if (!received || !q.created_at) return null;
      const days =
        (new Date(received).getTime() - new Date(q.created_at).getTime()) /
        86_400_000;
      return Number.isFinite(days) && days >= 0 ? days : null;
    })
    .filter((v): v is number => v != null);
  const avgResponseDays = responseDays.length
    ? Math.round(
        (responseDays.reduce((sum, v) => sum + v, 0) / responseDays.length) * 10,
      ) / 10
    : null;

  const winCounts = new Map<string, number>();
  for (const q of approved) {
    const name = q.best_proposal?.agent?.name;
    if (name) winCounts.set(name, (winCounts.get(name) ?? 0) + 1);
  }
  const agentWins = Array.from(winCounts, ([name, wins]) => ({ name, wins })).sort(
    (a, b) => b.wins - a.wins,
  );

  const closedSum = withProposal(approved)
    .map((q) => q.best_proposal?.total_brl ?? 0)
    .filter((v) => v > 0)
    .reduce((sum, v) => sum + v, 0);
  const estimatedSavingsBRL =
    closedSum > 0 ? Math.round(closedSum * (BENCHMARK_FACTOR - 1)) : null;

  return {
    totalQuotations: all.length,
    approved: approved.length,
    declined: declined.length,
    cancelled: cancelled.length,
    inProgress,
    approvalRate,
    avgResponseDays,
    agentWins,
    estimatedSavingsBRL,
  };
}

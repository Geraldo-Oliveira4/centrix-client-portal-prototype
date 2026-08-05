import type { PortalQuotationsResponse } from '@/types/portal';

import { flattenQuotations } from './intel-helpers';

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
  /**
   * REAL. Mean days from created_at to the best proposal's received_at. Kept as
   * an unrounded float so the UI can render sub-day values ("< 1 dia") instead
   * of a misleading "0 d" — the seed inserts quotation and proposal in the same
   * transaction, so real gaps are milliseconds.
   */
  avgResponseDays: number | null;
  /** REAL. Winning agent per closed quotation, most wins first. */
  agentWins: AgentWins[];
}

// Havia aqui um `estimatedSavingsBRL` = Σ(fechadas.total_brl) × 0,08, o único
// campo fabricado deste helper. Foi removido em 05/08/2026 junto com seus dois
// consumidores (o bloco "Economia estimada" do Performance e o KPI "Economia" do
// Executivo), que passaram a responder "Pendente integração" — não há base de
// preço de mercado neste protótipo, e as duas telas chegaram a dar respostas
// contraditórias para a mesma métrica.
//
// Não reintroduza o campo aqui: um número fabricado disponível no helper volta
// para a tela na primeira pessoa que procurar "savings". O fator +8% continua
// vivo, deliberadamente, apenas no `components/market-block.tsx`, que declara o
// próprio `BENCHMARK_FACTOR` e emoldura o resultado como ilustrativo.

/**
 * Derives the client's performance dashboard entirely from the existing
 * /portal/quotations payload — no new endpoint. Every field here is REAL; this
 * helper no longer produces any fabricated figure (see the note above).
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
    ? responseDays.reduce((sum, v) => sum + v, 0) / responseDays.length
    : null;

  const winCounts = new Map<string, number>();
  for (const q of approved) {
    const name = q.best_proposal?.agent?.name;
    if (name) winCounts.set(name, (winCounts.get(name) ?? 0) + 1);
  }
  const agentWins = Array.from(winCounts, ([name, wins]) => ({ name, wins })).sort(
    (a, b) => b.wins - a.wins,
  );

  return {
    totalQuotations: all.length,
    approved: approved.length,
    declined: declined.length,
    cancelled: cancelled.length,
    inProgress,
    approvalRate,
    avgResponseDays,
    agentWins,
  };
}

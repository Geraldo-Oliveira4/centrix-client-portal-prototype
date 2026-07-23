'use client';

import { TrendingUp } from 'lucide-react';
import { LoadingState } from '@arboria-tech/arboria-ui';

import { useMyQuotations } from '@/hooks/use-portal-quotations';
import { formatBRL } from '@/lib/portal-formatters';

import { IntelBlock } from './intel-block';
import { flattenQuotations, withProposal } from '../lib/intel-helpers';

// MOCK factor: the illustrative sector benchmark sits 8% above the client's own
// average, so the reading is a favourable "below market". No price-index feed
// exists in this prototype.
const BENCHMARK_FACTOR = 1.08;

/**
 * MIXED, headline is MOCK. "Seu preço médio" is real (mean of the proposal
 * totals the client received); the sector benchmark it is compared against is
 * fabricated.
 */
export function MarketBlock() {
  const { data, isLoading } = useMyQuotations();

  const totals = withProposal(flattenQuotations(data))
    .map((q) => q.best_proposal?.total_brl ?? 0)
    .filter((v) => v > 0);
  const yourAvg = totals.length
    ? Math.round(totals.reduce((sum, v) => sum + v, 0) / totals.length)
    : null;
  const benchmark = yourAvg != null ? Math.round(yourAvg * BENCHMARK_FACTOR) : null;
  const deltaPct =
    yourAvg != null && benchmark ? Math.round((1 - yourAvg / benchmark) * 100) : null;

  return (
    <IntelBlock
      icon={<TrendingUp className="h-5 w-5" />}
      title="Mercado"
      question="O preço está competitivo?"
      provenance="preview"
      footnote="Seu preço médio é real (média das propostas recebidas). O benchmark do setor é ilustrativo — não há base de preços de mercado neste protótipo."
    >
      {isLoading ? (
        <LoadingState />
      ) : yourAvg == null ? (
        <p className="portal-body text-portal-neutral">
          Sem propostas suficientes para calcular seu preço médio.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="portal-card-muted space-y-1 p-3">
              <p className="portal-small text-portal-neutral">Seu preço médio</p>
              <p className="portal-body font-semibold text-foreground">
                {formatBRL(yourAvg)}
              </p>
              <p className="portal-small text-portal-success">Dado real</p>
            </div>
            <div className="space-y-1 rounded-xl border border-dashed border-border p-3">
              <p className="portal-small text-portal-neutral">Benchmark do setor</p>
              <p className="portal-body font-semibold text-portal-neutral">
                {formatBRL(benchmark ?? 0)}
              </p>
              <p className="portal-small text-portal-neutral">Ilustrativo</p>
            </div>
          </div>
          {deltaPct != null ? (
            <p className="portal-body text-foreground">
              Estimativa: seu preço está{' '}
              <span className="font-semibold text-portal-success">
                {deltaPct}% abaixo
              </span>{' '}
              do benchmark ilustrativo.
            </p>
          ) : null}
        </div>
      )}
    </IntelBlock>
  );
}

'use client';

import { TrendingUp } from 'lucide-react';

import type { PortalProposal } from '@/types/portal';
import { formatBRL } from '@/lib/portal-formatters';

import { IntelBlock } from './intel-block';

// MOCK factor: the illustrative sector benchmark sits 8% above this quotation's
// value, so the reading is a favourable "below market". No price-index feed
// exists in this prototype.
const BENCHMARK_FACTOR = 1.08;

/**
 * Picks the proposal that represents "this quotation's price": the winner if the
 * quotation is closed, otherwise the recommended proposal, otherwise the
 * cheapest. Mirrors what the client is actually looking at in the proposals
 * table.
 */
function referenceProposal(
  proposals: PortalProposal[],
): PortalProposal | undefined {
  const priced = proposals.filter((p) => (p.total_brl ?? 0) > 0);
  if (priced.length === 0) return undefined;
  return (
    priced.find((p) => p.is_winner) ??
    priced.find((p) => p.is_recommended) ??
    [...priced].sort((a, b) => a.total_brl - b.total_brl)[0]
  );
}

/**
 * MIXED, headline is MOCK. Scoped to a SINGLE quotation: it compares THIS
 * quotation's value (winning proposal, or the recommended/cheapest one while it
 * is still open) against a fabricated sector benchmark. The value is real; the
 * benchmark it is measured against is illustrative.
 */
export function MarketBlock({
  proposals,
  className,
}: {
  proposals: PortalProposal[];
  /** `h-full` quando o bloco divide a linha com a Confiabilidade. */
  className?: string;
}) {
  const ref = referenceProposal(proposals);
  const value = ref?.total_brl ?? null;
  const benchmark = value != null ? Math.round(value * BENCHMARK_FACTOR) : null;
  const deltaPct =
    value != null && benchmark ? Math.round((1 - value / benchmark) * 100) : null;
  const refLabel = ref?.is_winner
    ? 'proposta vencedora'
    : ref?.is_recommended
      ? 'proposta recomendada'
      : 'proposta mais barata';

  return (
    <IntelBlock
      icon={<TrendingUp className="h-5 w-5" />}
      title="Mercado"
      question="O preço está competitivo?"
      provenance="preview"
      className={className}
      footnote="O valor desta cotação é real (proposta recebida). O benchmark do setor é ilustrativo — não há base de preços de mercado neste protótipo."
    >
      {/* `justify-center` só importa quando este bloco divide a linha com a
          Confiabilidade (que carrega a Evidência dentro e é bem mais alta): o
          grid estica os dois na mesma altura, e sem isto o conteúdo curto
          ficava grudado no topo com ~300px de vazio abaixo — igualar altura sem
          distribuir o conteúdo lê como card truncado, não como par equilibrado.
          Sozinho em largura total o efeito é nulo, porque aí não há altura
          sobrando. */}
      {value == null ? (
        <p className="portal-body text-portal-neutral">
          Esta cotação ainda não tem proposta com valor para comparar.
        </p>
      ) : (
        <div className="flex h-full flex-col justify-center gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="portal-card-muted space-y-1 p-3">
              <p className="portal-small text-portal-neutral">
                Esta cotação ({refLabel})
              </p>
              <p className="portal-body font-semibold text-foreground">
                {formatBRL(value)}
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
              Estimativa: esta cotação está{' '}
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

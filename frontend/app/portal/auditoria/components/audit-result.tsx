'use client';

import { cn } from '@/lib/utils';
import { formatBRL } from '@/lib/portal-formatters';
import type { PortalAuditPreview } from '@/types/portal-audit';

/**
 * The single, shared audit-result component (unification rule 2.3): the visual
 * result of an audit is the SAME whether it was produced automatically or after
 * the client submitted documentation. Used by:
 *  - the per-quotation AuditPreviewSection (quotation detail),
 *  - the aggregated Auditoria panel (expanded row),
 *  - the "Enviar documentação" flow (result step).
 *
 * Honesty is unchanged: only `quoted_value_brl` is real (winning proposal); the
 * estimated value, the difference and the divergence are the `mock_*` fields, so
 * the caller must keep this inside a dashed preview frame.
 *
 * Hierarchy of the 3 blocks (not 3 equal cards):
 *   1. Valor cotado   — real, white card, number emphasised
 *   2. Valor estimado — fabricated, dashed + greyed, recedes
 *   3. Diferença      — the reading that matters, semantic colour only when it diverges
 */
export function AuditResult({ preview }: { preview: PortalAuditPreview }) {
  const divergent = preview.mock_divergence_detected;
  const difference = preview.mock_difference_brl;
  const higher = difference > 0;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {/* Real — from the approved proposal. The only block with card weight. */}
      <div className="portal-card space-y-1 p-4">
        <p className="portal-small text-portal-neutral">Valor cotado</p>
        <p className="text-xl font-semibold text-foreground">
          {formatBRL(preview.quoted_value_brl)}
        </p>
        <p className="portal-small text-portal-neutral">Proposta aprovada</p>
      </div>

      {/* Fabricated — the label says so, reinforced by the dashed + grey treatment. */}
      <div className="space-y-1 rounded-xl border border-dashed border-border bg-transparent p-4">
        <p className="portal-small text-portal-neutral">
          Valor estimado — dado ilustrativo
        </p>
        <p className="text-xl font-medium text-portal-neutral">
          {formatBRL(preview.mock_realized_value_brl)}
        </p>
        <p className="portal-small text-portal-neutral">Não apurado — exemplo gerado</p>
      </div>

      <div className="space-y-1 rounded-xl border border-dashed border-border bg-transparent p-4">
        <p className="portal-small text-portal-neutral">Diferença</p>
        <p
          className={cn(
            'text-xl font-semibold',
            divergent ? 'text-portal-danger' : 'text-portal-neutral',
          )}
        >
          {higher ? '+' : '−'}
          {formatBRL(Math.abs(difference))}
        </p>
        <p className="portal-small text-portal-neutral">
          {preview.mock_variation_pct > 0 ? '+' : ''}
          {preview.mock_variation_pct}% sobre o cotado · limite{' '}
          {preview.divergence_threshold_pct}%
        </p>
      </div>
    </div>
  );
}

'use client';

import { AlertTriangle, FlaskConical } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatBRL } from '@/lib/portal-formatters';
import { useAuditPreview } from '@/hooks/use-portal-audit-preview';

/**
 * MOCK - Auditoria real (Camada de Auditoria de Frete/Fatura) é produto separado,
 * sequenciado após GE go-live. Este preview existe apenas para visualização
 * conceitual no debate de produto.
 *
 * Regra de honestidade desta seção: o valor cotado é real (proposta vencedora),
 * o valor "realizado" NÃO existe — não há fatura nem BL em lugar nenhum deste
 * protótipo. Por isso o bloco inteiro é emoldurado como ilustrativo (faixa
 * tracejada + selo "Pré-visualização"), o card do valor fabricado é rotulado
 * "Valor estimado — dado ilustrativo", e o disclaimer que fecha a seção vem do
 * próprio backend. Se alguém reaproveitar este componente, tem que reaproveitar
 * a moldura junto: sem ela a tela afirma um número que ninguém apurou.
 */
export function AuditPreviewSection({ quotationId }: { quotationId: string }) {
  const { preview, isLoading, isError } = useAuditPreview(quotationId);

  // Falha silenciosa: é uma seção conceitual, não pode quebrar a tela da cotação.
  if (isLoading || isError || !preview) return null;

  const divergent = preview.mock_divergence_detected;
  const difference = preview.mock_difference_brl;
  const higher = difference > 0;

  return (
    <section className="rounded-md border border-dashed bg-muted/30 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold">Auditoria</h3>
          <span className="inline-flex items-center gap-1 rounded border border-violet-300 bg-violet-100 px-1.5 py-0.5 text-xs text-violet-700">
            <FlaskConical className="h-3 w-3" />
            Pré-visualização
          </span>
        </div>
        {divergent && (
          <span className="inline-flex items-center gap-1 rounded border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            Divergência detectada · {formatBRL(Math.abs(difference))}
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {/* Real — vem da proposta aprovada. */}
        <div className="rounded-md border bg-background p-3">
          <p className="text-xs text-muted-foreground">Valor cotado</p>
          <p className="text-lg font-semibold">
            {formatBRL(preview.quoted_value_brl)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Proposta aprovada
          </p>
        </div>

        {/* Fabricado — o rótulo tem que dizer isso sem depender do disclaimer. */}
        <div className="rounded-md border border-dashed bg-background p-3">
          <p className="text-xs text-muted-foreground">
            Valor estimado — dado ilustrativo
          </p>
          <p className="text-lg font-semibold text-muted-foreground">
            {formatBRL(preview.mock_realized_value_brl)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Não apurado — exemplo gerado
          </p>
        </div>

        <div className="rounded-md border border-dashed bg-background p-3">
          <p className="text-xs text-muted-foreground">Diferença</p>
          <p
            className={cn(
              'text-lg font-semibold',
              divergent ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {higher ? '+' : '−'}
            {formatBRL(Math.abs(difference))}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {preview.mock_variation_pct > 0 ? '+' : ''}
            {preview.mock_variation_pct}% sobre o cotado · limite{' '}
            {preview.divergence_threshold_pct}%
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{preview.disclaimer}</p>
    </section>
  );
}

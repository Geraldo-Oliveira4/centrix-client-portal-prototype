'use client';

import Link from 'next/link';
import { AlertTriangle, FlaskConical } from 'lucide-react';
import { LoaderComponent, ErrorComponent, EmptyState } from '@arboria-tech/arboria-ui';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { formatBRL, formatRoute } from '@/lib/portal-formatters';
import { useMyQuotations } from '@/hooks/use-portal-quotations';
import { useAuditPreviews } from '@/hooks/use-portal-audit-preview';
import type { PortalAuditPreview } from '@/types/portal-audit';
import type { PortalQuotation } from '@/types/portal';

import { PagePortalHeader } from '../_shared/page-header';

/**
 * Auditoria — the per-quotation audit-preview (MOCK "realized value") lifted to
 * an aggregated list over every closed quotation. Same honesty discipline as the
 * per-quotation section: only "Valor cotado" is real; the estimated value, the
 * difference and the divergence flag are illustrative, so the whole comparison
 * sits inside a dashed "Pré-visualização" frame.
 */
export default function AuditoriaPage() {
  const { data, isLoading, isError } = useMyQuotations();

  const fechadas: PortalQuotation[] = (data?.buckets.finalizadas ?? []).filter(
    (q) => q.state === 'FECHADA',
  );
  const { previews, isLoading: loadingPreviews } = useAuditPreviews(
    fechadas.map((q) => q.id),
  );

  if (isLoading) return <LoaderComponent />;
  if (isError || !data) return <ErrorComponent />;

  const loaded = Object.values(previews).filter(Boolean) as PortalAuditPreview[];
  const divergentCount = loaded.filter((p) => p.mock_divergence_detected).length;
  const threshold = loaded[0]?.divergence_threshold_pct ?? 5;
  const disclaimer = loaded[0]?.disclaimer;

  return (
    <div className="space-y-8">
      <PagePortalHeader
        title="Auditoria"
        subtitle={
          fechadas.length === 0
            ? 'Nenhuma cotação fechada ainda.'
            : `${fechadas.length} ${fechadas.length === 1 ? 'cotação fechada' : 'cotações fechadas'} · comparativo cotado × estimado.`
        }
        action={
          <span className="portal-small inline-flex items-center gap-1.5 rounded border border-dashed border-primary/40 bg-primary/5 px-2 py-0.5 font-medium text-primary">
            <FlaskConical className="h-3.5 w-3.5" />
            Pré-visualização
          </span>
        }
      />

      {fechadas.length === 0 ? (
        <EmptyState message="A auditoria compara o valor cotado com o realizado das cotações fechadas. Assim que uma cotação for aprovada e fechada, ela aparece aqui." />
      ) : (
        <>
          {/* Summary — derived from the illustrative previews, framed as such. */}
          <section className="space-y-4 rounded-xl border border-dashed border-border bg-muted/20 p-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="portal-card space-y-1 p-4">
                <p className="portal-small text-portal-neutral">Cotações fechadas</p>
                <p className="text-2xl font-semibold text-foreground">
                  {fechadas.length}
                </p>
                <p className="portal-small text-portal-neutral">no período</p>
              </div>
              <div className="space-y-1 rounded-xl border border-dashed border-border p-4">
                <p className="portal-small text-portal-neutral">
                  Com divergência estimada
                </p>
                <p
                  className={cn(
                    'text-2xl font-semibold',
                    divergentCount > 0 ? 'text-portal-danger' : 'text-portal-neutral',
                  )}
                >
                  {loadingPreviews ? '…' : divergentCount}
                </p>
                <p className="portal-small text-portal-neutral">
                  variação acima de {threshold}% (ilustrativo)
                </p>
              </div>
              <div className="space-y-1 rounded-xl border border-dashed border-border p-4">
                <p className="portal-small text-portal-neutral">Limite de divergência</p>
                <p className="text-2xl font-semibold text-portal-neutral">
                  {threshold}%
                </p>
                <p className="portal-small text-portal-neutral">sobre o valor cotado</p>
              </div>
            </div>
            <p className="portal-small text-portal-neutral">
              Coluna <span className="font-medium text-foreground">Valor cotado</span>{' '}
              é real (proposta aprovada). Valor estimado, diferença e status de
              divergência são ilustrativos.
              {disclaimer ? ` ${disclaimer}` : ''}
            </p>
          </section>

          {/* Aggregated table */}
          <div className="portal-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="portal-small font-medium text-portal-neutral">
                    Cotação
                  </TableHead>
                  <TableHead className="portal-small hidden font-medium text-portal-neutral md:table-cell">
                    Rota
                  </TableHead>
                  <TableHead className="portal-small font-medium text-portal-neutral">
                    Valor cotado
                  </TableHead>
                  <TableHead className="portal-small font-medium text-portal-neutral">
                    Valor estimado
                  </TableHead>
                  <TableHead className="portal-small font-medium text-portal-neutral">
                    Diferença
                  </TableHead>
                  <TableHead className="portal-small font-medium text-portal-neutral">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fechadas.map((q) => {
                  const preview = previews[q.id];
                  const divergent = preview?.mock_divergence_detected ?? false;
                  const difference = preview?.mock_difference_brl ?? 0;
                  const higher = difference > 0;
                  return (
                    <TableRow key={q.id} className="hover:bg-muted/40">
                      <TableCell>
                        <Link
                          href={`/portal/cotacao/${q.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {q.reference}
                        </Link>
                      </TableCell>
                      <TableCell className="portal-body hidden text-portal-neutral md:table-cell">
                        {formatRoute(q)}
                      </TableCell>
                      <TableCell className="portal-body font-medium text-foreground">
                        {preview ? formatBRL(preview.quoted_value_brl) : '—'}
                      </TableCell>
                      <TableCell className="portal-body text-portal-neutral">
                        {preview ? formatBRL(preview.mock_realized_value_brl) : '—'}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'portal-body font-medium',
                          divergent ? 'text-portal-danger' : 'text-portal-neutral',
                        )}
                      >
                        {preview
                          ? `${higher ? '+' : '−'}${formatBRL(Math.abs(difference))}`
                          : loadingPreviews
                            ? '…'
                            : '—'}
                      </TableCell>
                      <TableCell>
                        {preview ? (
                          divergent ? (
                            <span className="portal-small inline-flex items-center gap-1 rounded border border-portal-danger/30 bg-portal-danger/10 px-2 py-0.5 font-medium text-portal-danger">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Divergência
                            </span>
                          ) : (
                            <span className="portal-small text-portal-neutral">
                              Dentro do limite
                            </span>
                          )
                        ) : (
                          <span className="portal-small text-portal-neutral">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

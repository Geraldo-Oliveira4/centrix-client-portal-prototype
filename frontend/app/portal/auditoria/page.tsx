'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileUp,
  FlaskConical,
  type LucideIcon,
} from 'lucide-react';
import { LoaderComponent, ErrorComponent, EmptyState } from '@arboria-tech/arboria-ui';

import {
  Button,
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
import type { SemaforoTone } from '@/types/portal-shipment';

import { PagePortalHeader } from '../_shared/page-header';
import { AuditDocumentModal } from './components/audit-document-modal';
import { resolveAuditStatus } from './lib/audit-journey';

const SUBMITTED_KEY = 'portal:audit:submitted';

const STATUS_ICON: Record<SemaforoTone, LucideIcon> = {
  success: CheckCircle2,
  warning: Clock,
  danger: AlertTriangle,
};

const STATUS_CLASS: Record<SemaforoTone, string> = {
  success: 'border-portal-success/25 bg-portal-success/10 text-portal-success',
  warning: 'border-portal-warning/30 bg-portal-warning/10 text-portal-warning',
  danger: 'border-portal-danger/30 bg-portal-danger/10 text-portal-danger',
};

interface SelectedRow {
  id: string;
  reference: string;
  preview: PortalAuditPreview | null;
}

/**
 * Auditoria — the consolidated panel (journey step 2.1). Per closed quotation it
 * shows cotado (real) vs estimado (mock), a 3-colour semáforo status
 * (Auditado / Em conferência / Divergência) and the journey origin, plus the
 * "Enviar documentação" action (step 2.2). Same honesty discipline: only the
 * quoted value is real, so the whole comparison stays in a dashed preview frame.
 */
export default function AuditoriaPage() {
  const { data, isLoading, isError } = useMyQuotations();

  const fechadas: PortalQuotation[] = (data?.buckets.finalizadas ?? []).filter(
    (q) => q.state === 'FECHADA',
  );
  const { previews, isLoading: loadingPreviews } = useAuditPreviews(
    fechadas.map((q) => q.id),
  );

  // Which quotations the client sent documents for -> "em conferência". Client
  // side only (no backend audit engine); seeded from localStorage after mount.
  const [submittedList, setSubmittedList] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SUBMITTED_KEY);
      if (raw) setSubmittedList(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);
  const submittedIds = useMemo(() => new Set(submittedList), [submittedList]);

  const [selected, setSelected] = useState<SelectedRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleSubmitted = (quotationId: string) => {
    if (submittedIds.has(quotationId)) return;
    const next = [...submittedList, quotationId];
    setSubmittedList(next);
    try {
      localStorage.setItem(SUBMITTED_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const openModal = (q: PortalQuotation) => {
    setSelected({ id: q.id, reference: q.reference, preview: previews[q.id] ?? null });
    setModalOpen(true);
  };

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
              é real (proposta aprovada). Valor estimado, diferença, status e
              conferência são ilustrativos.
              {disclaimer ? ` ${disclaimer}` : ''}
            </p>
          </section>

          {/* Aggregated table */}
          <div className="portal-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="portal-small font-medium text-portal-neutral">
                    Cotação
                  </TableHead>
                  <TableHead className="portal-small hidden font-medium text-portal-neutral lg:table-cell">
                    Rota
                  </TableHead>
                  <TableHead className="portal-small font-medium text-portal-neutral">
                    Valor cotado
                  </TableHead>
                  <TableHead className="portal-small hidden font-medium text-portal-neutral sm:table-cell">
                    Valor estimado
                  </TableHead>
                  <TableHead className="portal-small font-medium text-portal-neutral">
                    Diferença
                  </TableHead>
                  <TableHead className="portal-small font-medium text-portal-neutral">
                    Status
                  </TableHead>
                  <TableHead className="portal-small font-medium text-portal-neutral">
                    Documentação
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fechadas.map((q) => {
                  const preview = previews[q.id];
                  const divergent = preview?.mock_divergence_detected ?? false;
                  const difference = preview?.mock_difference_brl ?? 0;
                  const higher = difference > 0;
                  const rowStatus = resolveAuditStatus(
                    divergent,
                    submittedIds.has(q.id),
                  );
                  const StatusIcon = STATUS_ICON[rowStatus.tone];
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
                      <TableCell className="portal-body hidden text-portal-neutral lg:table-cell">
                        {formatRoute(q)}
                      </TableCell>
                      <TableCell className="portal-body font-medium text-foreground">
                        {preview ? formatBRL(preview.quoted_value_brl) : '—'}
                      </TableCell>
                      <TableCell className="portal-body hidden text-portal-neutral sm:table-cell">
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
                          <div className="space-y-1">
                            <span
                              className={cn(
                                'portal-small inline-flex items-center gap-1 rounded border px-2 py-0.5 font-medium',
                                STATUS_CLASS[rowStatus.tone],
                              )}
                            >
                              <StatusIcon className="h-3.5 w-3.5" />
                              {rowStatus.label}
                            </span>
                            <p className="portal-small text-portal-neutral">
                              {rowStatus.originLabel}
                            </p>
                          </div>
                        ) : (
                          <span className="portal-small text-portal-neutral">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          disabled={!preview}
                          onClick={() => openModal(q)}
                        >
                          <FileUp className="h-4 w-4" />
                          Enviar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <AuditDocumentModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        quotationId={selected?.id ?? null}
        reference={selected?.reference ?? ''}
        preview={selected?.preview ?? null}
        onSubmitted={handleSubmitted}
      />
    </div>
  );
}

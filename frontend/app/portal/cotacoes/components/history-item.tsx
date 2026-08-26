'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileUp,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { formatBRL, formatDate, formatRoute } from '@/lib/portal-formatters';
import { isApproved, isCancelled, resolveClosedAt } from '@/lib/portal-state';
import type { PortalQuotation } from '@/types/portal';
import type { PortalAuditPreview } from '@/types/portal-audit';
import type { SemaforoTone } from '@/types/portal-shipment';

import { AuditResult } from '../../_shared/audit-result';
import { ClientReferenceTag } from '../../_shared/client-reference-tag';
import { ProvenanceBadge } from '../../_shared/provenance-badge';
import { resolveAuditStatus } from '../lib/audit-journey';

const OUTCOME = {
  FECHADA: {
    label: 'Aprovada',
    icon: CheckCircle2,
    pill: 'border-portal-success/25 bg-portal-success/10 text-portal-success',
    accent: 'border-l-portal-success',
  },
  DECLINADA: {
    label: 'Reprovada',
    icon: XCircle,
    pill: 'border-portal-danger/25 bg-portal-danger/10 text-portal-danger',
    accent: 'border-l-portal-danger',
  },
  CANCELADO: {
    label: 'Cancelada',
    icon: Ban,
    pill: 'border-border bg-muted text-portal-neutral',
    accent: 'border-l-portal-neutral/40',
  },
} as const;

const CONFERENCE_ICON: Record<SemaforoTone, typeof CheckCircle2> = {
  success: CheckCircle2,
  warning: Clock,
  danger: AlertTriangle,
};

const CONFERENCE_TEXT: Record<SemaforoTone, string> = {
  success: 'text-portal-success',
  warning: 'text-portal-warning',
  danger: 'text-portal-danger',
};

interface HistoryItemProps {
  quotation: PortalQuotation;
  /** `undefined` while the preview is still loading, `null` when unavailable. */
  preview: PortalAuditPreview | null | undefined;
  submitted: boolean;
  onSendDocuments: () => void;
}

/**
 * One closed quotation in the Histórico: read-only summary plus, for approved
 * ones, the "Conferência de dados" expansion.
 *
 * The conference is the old /portal/auditoria comparison in its proper home: it
 * checks the closing figures of THIS quotation, it is not the freight/invoice
 * audit product. Only `quoted_value_brl` is real, so the expanded detail keeps
 * the dashed preview frame and the "Pré-visualização" seal.
 */
export function HistoryItem({
  quotation,
  preview,
  submitted,
  onSendDocuments,
}: HistoryItemProps) {
  const [expanded, setExpanded] = useState(false);

  const outcome = OUTCOME[quotation.state as keyof typeof OUTCOME] ?? OUTCOME.CANCELADO;
  const approved = isApproved(quotation.state);
  const best = quotation.best_proposal;
  const showValue = best != null && !isCancelled(quotation.state);

  const conference = preview
    ? resolveAuditStatus(preview.mock_divergence_detected, submitted)
    : null;
  const ConferenceIcon = conference ? CONFERENCE_ICON[conference.tone] : null;

  return (
    <div className={cn('portal-card border-l-4 p-4', outcome.accent)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/portal/cotacao/${quotation.id}`}
              className="portal-body font-medium text-foreground hover:text-primary"
            >
              {quotation.reference}
            </Link>
            <ClientReferenceTag value={quotation.client_reference} />
            <span
              className={cn(
                'portal-small inline-flex items-center gap-1 rounded border px-2 py-0.5 font-medium',
                outcome.pill,
              )}
            >
              <outcome.icon className="h-3.5 w-3.5" />
              {outcome.label}
            </span>
          </div>
          <p className="portal-small truncate text-portal-neutral">
            {formatRoute(quotation)}
            {quotation.product ? ` · ${quotation.product}` : ''}
          </p>
        </div>

        <div className="text-right">
          {showValue && best ? (
            <p
              className={cn(
                'portal-h3',
                approved ? 'text-foreground' : 'text-portal-neutral line-through',
              )}
            >
              {formatBRL(best.total_brl)}
            </p>
          ) : (
            <p className="portal-h3 text-portal-neutral">—</p>
          )}
          <p className="portal-small text-portal-neutral">
            {approved ? 'Valor aprovado' : 'Não contratada'} ·{' '}
            {formatDate(resolveClosedAt(quotation))}
          </p>
        </div>
      </div>

      {/* Conference — approved quotations only: there is no closing figure to
          check on a declined or cancelled one. */}
      {approved ? (
        <div className="mt-3 border-t pt-3">
          {preview === undefined ? (
            <p className="portal-small text-portal-neutral">
              Conferência de dados: carregando…
            </p>
          ) : preview === null ? (
            <p className="portal-small text-portal-neutral">
              Conferência de dados indisponível — esta cotação foi fechada sem
              proposta vencedora registrada.
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                className="flex w-full items-center gap-2 text-left"
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-portal-neutral" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-portal-neutral" />
                )}
                <span className="portal-small text-portal-neutral">
                  Conferência de dados:
                </span>
                {ConferenceIcon && conference ? (
                  <span
                    className={cn(
                      'portal-small inline-flex items-center gap-1 font-medium',
                      CONFERENCE_TEXT[conference.tone],
                    )}
                  >
                    <ConferenceIcon className="h-3.5 w-3.5" />
                    {conference.status === 'divergencia'
                      ? 'divergência encontrada'
                      : conference.status === 'em_conferencia'
                        ? 'em conferência'
                        : 'sem divergência'}
                  </span>
                ) : null}
                <span className="portal-small text-portal-neutral">
                  {expanded ? 'ocultar detalhe' : 'ver detalhe'}
                </span>
              </button>

              {expanded ? (
                <div className="mt-3 space-y-4 rounded-xl border border-dashed border-border bg-muted/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="portal-small text-portal-neutral">
                      Valor cotado × valor de fechamento
                    </p>
                    <ProvenanceBadge provenance="preview" />
                  </div>

                  <AuditResult preview={preview} />

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="portal-small max-w-2xl text-portal-neutral">
                      {preview.disclaimer} {conference?.originLabel}.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={onSendDocuments}
                    >
                      <FileUp className="h-4 w-4" />
                      Enviar documentação
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

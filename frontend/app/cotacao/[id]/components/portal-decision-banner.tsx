'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getDeclineReasonLabel } from '@/lib/portal-state';
import type { Quotation, QuotationLog } from '@/types/quotation';

const PORTAL_APPROVE = 'client_approved_proposal';
const PORTAL_DECLINE = 'client_declined_quotation';

interface PortalDecisionBannerProps {
  quotation: Quotation;
  logs: QuotationLog[] | undefined;
}

export function PortalDecisionBanner({
  quotation,
  logs,
}: PortalDecisionBannerProps) {
  if (quotation.state !== 'FECHADA' && quotation.state !== 'DECLINADA') {
    return null;
  }

  const portalLog = logs?.find(
    (l) => l.action === PORTAL_APPROVE || l.action === PORTAL_DECLINE,
  );
  if (!portalLog) return null;

  const isApproval = portalLog.action === PORTAL_APPROVE;
  const date = new Date(portalLog.created_at);
  const dateStr = date.toLocaleDateString('pt-BR');
  const details = (portalLog.details ?? {}) as Record<string, unknown>;

  if (isApproval) {
    const totalValue =
      typeof details.quoted_value_usd === 'number'
        ? details.quoted_value_usd
        : null;
    const formattedValue =
      totalValue != null
        ? new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
          }).format(totalValue)
        : null;

    return (
      <div
        className={cn(
          'flex items-start gap-3 rounded-lg border-l-4 px-4 py-3',
          'border-green-300 bg-green-50 dark:bg-green-950/20',
        )}
      >
        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
        <div className="text-sm space-y-0.5">
          <p className="font-medium text-green-900 dark:text-green-100">
            Cotação aprovada pelo cliente em {dateStr}
          </p>
          {formattedValue ? (
            <p className="text-green-700 dark:text-green-300">
              Valor fechado: <span className="font-semibold">{formattedValue}</span>
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  const declineReason = getDeclineReasonLabel(
    typeof details.decline_reason === 'string' ? details.decline_reason : null,
  );
  const note = typeof details.note === 'string' ? details.note : null;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border-l-4 px-4 py-3',
        'border-red-300 bg-red-50 dark:bg-red-950/20',
      )}
    >
      <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
      <div className="text-sm space-y-0.5">
        <p className="font-medium text-red-900 dark:text-red-100">
          Cotação recusada pelo cliente em {dateStr}
        </p>
        {declineReason ? (
          <p className="text-red-700 dark:text-red-300">
            Motivo: <span className="font-semibold">{declineReason}</span>
          </p>
        ) : null}
        {note ? (
          <p className="text-red-700 dark:text-red-300 italic">&ldquo;{note}&rdquo;</p>
        ) : null}
      </div>
    </div>
  );
}

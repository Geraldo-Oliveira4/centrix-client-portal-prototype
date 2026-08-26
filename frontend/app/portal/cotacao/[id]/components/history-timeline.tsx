'use client';

import { useMyQuotationHistory } from '@/hooks/use-portal-quotations';
import { getDeclineReasonLabel } from '@/lib/portal-state';
import { formatCurrencyCode } from '@/lib/portal-formatters';
import { QuotationTimeline } from '@/components/quotation-timeline';
import type { QuotationLog } from '@/types/quotation';

// Client-friendly labels for the milestones the portal history endpoint exposes.
const ACTION_LABELS: Record<string, string> = {
  created: 'Cotação criada',
  extraction_complete: 'Dados processados',
  rfq_dispatched: 'Enviada aos agentes',
  proposal_received: 'Proposta recebida',
  proposal_portal_submitted: 'Proposta recebida',
  portal_auto_advanced: 'Cotação processada automaticamente',
  client_approved_proposal: 'Proposta aprovada',
  client_declined_quotation: 'Cotação reprovada',
  client_cancelled_quotation: 'Cotação cancelada',
};

// Fallback label derived from the milestone the quotation entered.
const STATE_LABELS: Record<string, string> = {
  ENVIADA_CLIENTE: 'Propostas prontas para escolha',
  FECHADA: 'Cotação fechada',
  DECLINADA: 'Cotação reprovada',
  CANCELADO: 'Cotação cancelada',
};

const PROPOSAL_ACTIONS = new Set(['proposal_received', 'proposal_portal_submitted']);

function resolveLabel(log: QuotationLog): string {
  return (
    ACTION_LABELS[log.action] ??
    (log.new_state ? STATE_LABELS[log.new_state] : undefined) ??
    'Atualização'
  );
}

function EntryDetails({ log }: { log: QuotationLog }) {
  const details = (log.details ?? {}) as Record<string, unknown>;
  const declineReason = typeof details.decline_reason === 'string' ? details.decline_reason : null;
  const note = typeof details.note === 'string' ? details.note : null;

  const isProposalAction = PROPOSAL_ACTIONS.has(log.action);
  const agentName = isProposalAction && typeof details.agent_name === 'string' ? details.agent_name : null;
  const freightValue =
    isProposalAction && typeof details.freight_value === 'number' ? details.freight_value : null;
  const freightCurrency =
    typeof details.freight_currency === 'string' ? details.freight_currency : 'USD';

  return (
    <>
      {declineReason && (
        <p className="text-xs text-muted-foreground mt-0.5">
          Motivo:{' '}
          <span className="font-medium text-foreground">
            {getDeclineReasonLabel(declineReason)}
          </span>
        </p>
      )}
      {note && (
        <p className="text-xs text-muted-foreground mt-0.5 italic">&ldquo;{note}&rdquo;</p>
      )}
      {agentName && (
        <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
          <span>
            Agente: <span className="font-medium text-foreground">{agentName}</span>
          </span>
          {freightValue != null && (
            <span>
              Frete:{' '}
              <span className="font-medium text-foreground">
                {formatCurrencyCode(freightValue, freightCurrency)}
              </span>
            </span>
          )}
        </div>
      )}
    </>
  );
}

interface HistoryTimelineProps {
  quotationId: string;
}

export function HistoryTimeline({ quotationId }: HistoryTimelineProps) {
  const { logs, isLoading } = useMyQuotationHistory(quotationId);

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground py-6 text-center">
        Carregando histórico...
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-6 text-center border rounded-lg">
        Nenhum evento registrado.
      </div>
    );
  }

  return (
    <QuotationTimeline
      logs={logs}
      renderEntry={(log) => ({
        label: resolveLabel(log),
        details: <EntryDetails log={log} />,
      })}
    />
  );
}

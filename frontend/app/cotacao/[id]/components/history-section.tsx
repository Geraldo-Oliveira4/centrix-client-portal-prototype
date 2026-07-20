'use client';

import { cn } from '@/lib/utils';
import { useQuotationLogs } from '@/hooks/use-quotations';
import { getDeclineReasonLabel } from '@/lib/portal-state';
import { formatCurrencyCode } from '@/lib/portal-formatters';
import { QuotationTimeline } from '@/components/quotation-timeline';
import type { QuotationLog, QuotationModal, QuotationVolume, TipoEmbarque } from '@/types/quotation';

const ACTION_LABELS: Record<string, string> = {
  created: 'Cotacao criada',
  transitioned: 'Estado alterado',
  extraction_complete: 'Extracao IA concluida',
  extraction_failed: 'Extracao IA falhou',
  rfq_created: 'RFQ criada',
  rfq_dispatched: 'RFQ disparada',
  proposal_received: 'Proposta recebida',
  proposal_portal_submitted: 'Proposta recebida (portal)',
  updated: 'Dados atualizados',
  review_requested: 'Revisao solicitada',
  note_added: 'Nota adicionada',
  client_approved_proposal: 'Proposta aprovada pelo cliente',
  client_declined_quotation: 'Cotacao recusada pelo cliente',
  client_link_generated: 'Link de proposta gerado',
  client_link_sent: 'Proposta enviada ao cliente',
};

const PORTAL_ACTIONS = new Set([
  'client_approved_proposal',
  'client_declined_quotation',
]);

const PROPOSAL_ACTIONS = new Set(['proposal_received', 'proposal_portal_submitted']);

function computeChargeableWeight(
  volumes: QuotationVolume[],
  modal: QuotationModal,
  tipoEmbarque: TipoEmbarque | null,
): number {
  let totalKg = 0;
  let totalM3 = 0;
  for (const v of volumes) {
    const qty = v.quantity ?? 1;
    if (v.peso_bruto != null) {
      const kg = v.peso_unidade === 'LB' ? v.peso_bruto * 0.453592 : v.peso_bruto;
      totalKg += kg * qty;
    }
    if (v.volume_m3 != null) {
      totalM3 += v.volume_m3 * qty;
    }
  }
  if (modal === 'AEREO') {
    return Math.max(totalKg, totalM3 * 166.67);
  }
  if (modal === 'MARITIMO' && tipoEmbarque === 'LCL') {
    return Math.max(totalKg, totalM3 * 1000);
  }
  return totalKg;
}

interface HistorySectionProps {
  quotationId: string;
  volumes?: QuotationVolume[];
  modal?: QuotationModal | null;
  tipoEmbarque?: TipoEmbarque | null;
}

export function HistorySection({ quotationId, volumes, modal, tipoEmbarque }: HistorySectionProps) {
  const { logs, isLoading } = useQuotationLogs(quotationId);

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground py-6 text-center">
        Carregando historico...
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
      renderEntry={(log) => renderEntry(log, volumes, modal, tipoEmbarque)}
    />
  );
}

function renderEntry(
  log: QuotationLog,
  volumes?: QuotationVolume[],
  modal?: QuotationModal | null,
  tipoEmbarque?: TipoEmbarque | null,
) {
  const label = ACTION_LABELS[log.action] ?? log.action;
  const details = log.details as Record<string, unknown>;
  const completenessScore = typeof details?.completeness_score === 'number' ? details.completeness_score : undefined;
  const fieldsExtracted = typeof details?.fields_extracted === 'number' ? details.fields_extracted : undefined;
  const declineReason = typeof details?.decline_reason === 'string' ? details.decline_reason : null;
  const noteContent = typeof details?.content === 'string' ? details.content : null;
  const reviewReason = typeof details?.reason === 'string' ? details.reason : null;
  const reviewAgent = typeof details?.agent_name === 'string' ? details.agent_name : null;
  const clientNote = typeof details?.note === 'string' ? details.note : null;

  const isProposalAction = PROPOSAL_ACTIONS.has(log.action);
  const proposalAgentName = isProposalAction && typeof details?.agent_name === 'string' ? details.agent_name : null;
  const proposalFreightValue = isProposalAction && typeof details?.freight_value === 'number' ? details.freight_value : null;
  // Log details don't always record the currency; default to USD (international
  // freight standard) so a EUR proposal isn't mislabeled once logs carry it.
  const proposalFreightCurrency = typeof details?.freight_currency === 'string' ? details.freight_currency : 'USD';

  let freightPerKg: number | null = null;
  if (isProposalAction && proposalFreightValue != null && volumes && volumes.length > 0 && modal) {
    const cw = computeChargeableWeight(volumes, modal, tipoEmbarque ?? null);
    if (cw > 0) {
      freightPerKg = proposalFreightValue / cw;
    }
  }

  const isPortalAction = PORTAL_ACTIONS.has(log.action);
  const portalBadgeColor =
    log.action === 'client_approved_proposal'
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-rose-100 text-rose-700';

  return {
    label,
    badges: isPortalAction ? (
      <span className={cn('rounded text-xs font-medium px-2 py-0.5', portalBadgeColor)}>
        Via Portal
      </span>
    ) : undefined,
    meta: (
      <>
        {log.user_id && (
          <span className="text-muted-foreground/60">· {log.user_id.slice(0, 8)}...</span>
        )}
        {completenessScore !== undefined && (
          <span>· Completude: <span className="font-medium text-foreground">{completenessScore}%</span></span>
        )}
        {fieldsExtracted !== undefined && (
          <span>· {fieldsExtracted} campos extraidos</span>
        )}
      </>
    ),
    details: (
      <>
        {declineReason && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Motivo: <span className="font-medium text-foreground">
              {getDeclineReasonLabel(declineReason)}
            </span>
          </p>
        )}
        {clientNote && (
          <p className="text-xs text-muted-foreground mt-0.5 italic">
            &ldquo;{clientNote}&rdquo;
          </p>
        )}
        {noteContent && (
          <p className="text-xs text-muted-foreground mt-0.5 italic">
            &ldquo;{noteContent}&rdquo;
          </p>
        )}
        {reviewReason && (
          <div className="text-xs text-muted-foreground mt-0.5">
            {reviewAgent && (
              <span>Agente: <span className="font-medium text-foreground">{reviewAgent}</span> · </span>
            )}
            Motivo: <span className="font-medium text-foreground">{reviewReason}</span>
          </div>
        )}
        {isProposalAction && proposalAgentName && (
          <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
            <span>Agente: <span className="font-medium text-foreground">{proposalAgentName}</span></span>
            {proposalFreightValue != null && (
              <span>Frete: <span className="font-medium text-foreground">
                {formatCurrencyCode(proposalFreightValue, proposalFreightCurrency)}
              </span></span>
            )}
            {freightPerKg != null && (
              <span>Frete/kg: <span className="font-medium text-foreground">
                {proposalFreightCurrency} {freightPerKg.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
              </span></span>
            )}
          </div>
        )}
      </>
    ),
  };
}

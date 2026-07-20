import {
  PORTAL_DECLINE_REASON_LABELS,
  type PortalDeclineReason,
  type PortalQuotation,
} from '@/types/portal';

type State = PortalQuotation['state'];

export const canDecide = (state: State): boolean => state === 'ENVIADA_CLIENTE';

// States in which the client may still assemble and dispatch the RFQ: before any
// proposal exists. Once proposals start arriving (PARA_ANALISE onward) the
// assembly form is hidden. This is only a UX pre-filter — the authoritative gate
// is the backend `rfq_dispatched` flag from GET /portal/quotations/{id}/agents,
// backed by COTANDO_ELIGIBLE_STATES in quotation_state_machine.py. COTANDO is
// included here (but not in the backend COTANDO transition set) so a client can
// still (re)assemble while the RFQ is being prepared.
export const canAssembleRfq = (state: State): boolean =>
  state === 'TRIAGEM_IA' || state === 'AGUARDANDO_DADOS' || state === 'COTANDO';

// The RFQ has been dispatched and we are waiting for the agents to send their
// proposals (no proposal has arrived yet). COTANDO is the only state with the
// RFQ out and no proposals — once proposals arrive the quotation advances to
// PARA_ANALISE. Mirrors the detail-page "Estamos buscando propostas" block.
export const isAwaitingAgentProposals = (state: State): boolean =>
  state === 'COTANDO';

export const isApproved = (state: State): boolean => state === 'FECHADA';

// The client has selected a proposal and Freitas is reviewing it before the
// quotation closes (guard rail, ARB-2449). The client cannot act while here — the
// analyst either approves (flow continues) or blocks (back to ENVIADA_CLIENTE
// with a reason, so the client re-picks).
export const isPendingAnalystReview = (state: State): boolean =>
  state === 'APROVADA_PELO_CLIENTE';

export const isDeclined = (state: State): boolean => state === 'DECLINADA';
export const isCancelled = (state: State): boolean => state === 'CANCELADO';
export const isAwaitingInfo = (state: State): boolean =>
  state === 'AGUARDANDO_DADOS';

export const isFinalized = (state: State): boolean =>
  isApproved(state) || isDeclined(state) || isCancelled(state);

// The client may cancel their own quotation from any non-terminal state. This
// mirrors the analyst state machine, where CANCELADO is a valid target from
// every state except the terminal ones (FECHADA / DECLINADA / CANCELADO).
export const canCancel = (state: State): boolean => !isFinalized(state);

export const getDeclineReasonLabel = (
  reason: string | null | undefined,
): string | null => {
  if (!reason) return null;
  return PORTAL_DECLINE_REASON_LABELS[reason as PortalDeclineReason] ?? reason;
};

export const FREITAS_CONTACT_EMAIL = 'cotacao@freitascomex.com.br';

export const buildNeedsInfoMailto = (reference: string): string => {
  const subject = encodeURIComponent(`${reference} - Informações adicionais`);
  const body = encodeURIComponent(
    `Olá, equipe Freitas,\n\nRecebi a solicitação de informações adicionais para a cotação ${reference}. Segue abaixo:\n\n`,
  );
  return `mailto:${FREITAS_CONTACT_EMAIL}?subject=${subject}&body=${body}`;
};

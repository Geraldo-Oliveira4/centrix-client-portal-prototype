'use client';

import { AlertCircle, Ban, Calendar, CheckCircle2, Clock, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { addDays, formatBRL, formatDate } from '@/lib/portal-formatters';
import { buildNeedsInfoMailto, getDeclineReasonLabel } from '@/lib/portal-state';
import type { PortalProposal, PortalQuotation } from '@/types/portal';

export function EmptyProposalsBlock() {
  return (
    <div className="rounded-xl border bg-portal-warning/8 px-4 py-6 text-sm text-portal-warning">
      Estamos buscando propostas com os agentes. Você será avisado quando elas chegarem.
    </div>
  );
}

export function BestArrivalBanner({ proposal }: { proposal: PortalProposal }) {
  const arrival = addDays(proposal.transit_time ?? 0);
  return (
    <div className="rounded-xl border-l-4 border-portal-danger/60 bg-portal-danger/8 p-4 flex items-center gap-3">
      <Calendar className="h-5 w-5 text-portal-danger" />
      <div>
        <p className="portal-body">
          Se fechar hoje com{' '}
          <span className="font-medium">{proposal.agent?.name ?? '—'}</span>
        </p>
        <p className="portal-h3 text-portal-danger">
          Chega na sua fábrica em {proposal.transit_time} dias ({formatDate(arrival)})
        </p>
      </div>
    </div>
  );
}

export function FinalizedApprovedBanner({ proposal }: { proposal: PortalProposal }) {
  const arrival = addDays(proposal.transit_time ?? 0);
  return (
    <div className="rounded-xl border-l-4 border-portal-success bg-portal-success/8 p-4 flex items-start gap-3">
      <CheckCircle2 className="h-5 w-5 text-portal-success shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        <p className="portal-h3 text-portal-success">
          Cotação aprovada com {proposal.agent?.name ?? '—'}
        </p>
        <p className="portal-body text-foreground/75">
          Valor fechado:{' '}
          <span className="font-semibold">{formatBRL(proposal.total_brl)}</span>{' '}
          · Chegada estimada em {proposal.transit_time} dias ({formatDate(arrival)})
        </p>
      </div>
    </div>
  );
}

export function NeedsMoreInfoBanner({ quotation }: { quotation: PortalQuotation }) {
  return (
    <div className="rounded-xl border border-portal-warning/30 bg-portal-warning/8 p-4 flex items-start gap-3">
      <AlertCircle className="h-5 w-5 text-portal-warning shrink-0 mt-0.5" />
      <div className="flex-1 space-y-0.5">
        <p className="portal-h3 text-portal-warning">
          Precisamos de mais informações
        </p>
        <p className="portal-body text-foreground/75">
          Nossa equipe precisa de dados adicionais para continuar. Verifique seu
          e-mail ou entre em contato.
        </p>
      </div>
      <Button asChild variant="outline" size="sm" className="shrink-0">
        <a href={buildNeedsInfoMailto(quotation.reference)}>Atualizar</a>
      </Button>
    </div>
  );
}

export function FinalizedDeclinedBanner({
  reason,
  note,
}: {
  reason: string | null;
  note: string | null;
}) {
  const reasonLabel = getDeclineReasonLabel(reason);
  return (
    <div className="rounded-xl border-l-4 border-portal-danger bg-portal-danger/8 p-4 flex items-start gap-3">
      <XCircle className="h-5 w-5 text-portal-danger shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        <p className="portal-h3 text-portal-danger">Cotação recusada</p>
        {reasonLabel ? (
          <p className="portal-body text-portal-danger">
            Motivo: <span className="font-semibold">{reasonLabel}</span>
          </p>
        ) : null}
        {note ? <p className="portal-body text-portal-danger mt-1">Descrição: {note}</p> : null}
      </div>
    </div>
  );
}

export function PendingAnalystReviewBanner({
  proposal,
}: {
  proposal?: PortalProposal;
}) {
  return (
    <div className="rounded-xl border-l-4 border-portal-warning bg-portal-warning/8 p-4 flex items-start gap-3">
      <Clock className="h-5 w-5 text-portal-warning shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        <p className="portal-h3 text-portal-warning">
          Sua seleção está em análise pela Freitas
        </p>
        <p className="portal-body text-foreground/75">
          {proposal?.agent?.name
            ? `Você selecionou a proposta de ${proposal.agent.name}. `
            : ''}
          Nossa equipe está revisando sua escolha e entrará em contato em breve
          para dar continuidade.
        </p>
      </div>
    </div>
  );
}

export function SelectionApprovedBanner({
  proposal,
}: {
  proposal?: PortalProposal;
}) {
  return (
    <div className="rounded-xl border-l-4 border-portal-success bg-portal-success/8 p-4 flex items-start gap-3">
      <CheckCircle2 className="h-5 w-5 text-portal-success shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        <p className="portal-h3 text-portal-success">
          Sua escolha foi aprovada pela Freitas
        </p>
        <p className="portal-body text-foreground/75">
          {proposal?.agent?.name
            ? `A proposta de ${proposal.agent.name} foi confirmada. `
            : ''}
          Nossa equipe está finalizando os próximos passos e entrará em contato em
          breve.
        </p>
      </div>
    </div>
  );
}

export function GuardRailBlockBanner({ reason }: { reason: string }) {
  return (
    <div className="rounded-xl border-l-4 border-portal-warning bg-portal-warning/8 p-4 flex items-start gap-3">
      <AlertCircle className="h-5 w-5 text-portal-warning shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        <p className="portal-h3 text-portal-warning">
          Proposta em revisão pela Freitas
        </p>
        <p className="portal-body text-foreground/75">Mensagem: {reason}</p>
      </div>
    </div>
  );
}

export function FinalizedCancelledBanner() {
  return (
    <div className="rounded-xl border-l-4 border-portal-neutral bg-portal-neutral/8 p-4 flex items-start gap-3">
      <Ban className="h-5 w-5 text-portal-neutral shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        <p className="portal-h3 text-portal-neutral">
          Cotação cancelada
        </p>
        <p className="portal-body text-portal-neutral">
          Esta cotação foi cancelada e não está mais em andamento.
        </p>
      </div>
    </div>
  );
}


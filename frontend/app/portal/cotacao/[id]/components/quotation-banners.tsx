'use client';

import { AlertCircle, Ban, Calendar, CheckCircle2, Clock, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { addDays, formatBRL, formatDate } from '@/lib/portal-formatters';
import { buildNeedsInfoMailto, getDeclineReasonLabel } from '@/lib/portal-state';
import type { PortalProposal, PortalQuotation } from '@/types/portal';

export function EmptyProposalsBlock() {
  return (
    <div className="rounded-md border bg-amber-50 px-4 py-6 text-sm text-amber-900">
      Estamos buscando propostas com os agentes. Você será avisado quando elas chegarem.
    </div>
  );
}

export function BestArrivalBanner({ proposal }: { proposal: PortalProposal }) {
  const arrival = addDays(proposal.transit_time ?? 0);
  return (
    <div className="rounded-md border-l-4 border-rose-400 bg-rose-50 p-4 flex items-center gap-3">
      <Calendar className="h-5 w-5 text-rose-500" />
      <div>
        <p className="text-sm">
          Se fechar hoje com{' '}
          <span className="font-medium">{proposal.agent?.name ?? '—'}</span>
        </p>
        <p className="text-base font-semibold text-rose-700">
          Chega na sua fábrica em {proposal.transit_time} dias ({formatDate(arrival)})
        </p>
      </div>
    </div>
  );
}

export function FinalizedApprovedBanner({ proposal }: { proposal: PortalProposal }) {
  const arrival = addDays(proposal.transit_time ?? 0);
  return (
    <div className="rounded-md border-l-4 border-emerald-500 bg-emerald-50 p-4 flex items-start gap-3">
      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        <p className="text-base font-semibold text-emerald-800">
          Cotação aprovada com {proposal.agent?.name ?? '—'}
        </p>
        <p className="text-sm text-emerald-700">
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
    <div className="rounded-md border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
      <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
      <div className="flex-1 space-y-0.5">
        <p className="text-base font-semibold text-amber-900">
          Precisamos de mais informações
        </p>
        <p className="text-sm text-amber-800">
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
    <div className="rounded-md border-l-4 border-rose-500 bg-rose-50 p-4 flex items-start gap-3">
      <XCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        <p className="text-base font-semibold text-rose-800">Cotação recusada</p>
        {reasonLabel ? (
          <p className="text-sm text-rose-700">
            Motivo: <span className="font-semibold">{reasonLabel}</span>
          </p>
        ) : null}
        {note ? <p className="text-sm text-rose-700 mt-1">Descrição: {note}</p> : null}
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
    <div className="rounded-md border-l-4 border-amber-500 bg-amber-50 p-4 flex items-start gap-3">
      <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        <p className="text-base font-semibold text-amber-900">
          Sua seleção está em análise pela Freitas
        </p>
        <p className="text-sm text-amber-800">
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
    <div className="rounded-md border-l-4 border-emerald-500 bg-emerald-50 p-4 flex items-start gap-3">
      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        <p className="text-base font-semibold text-emerald-800">
          Sua escolha foi aprovada pela Freitas
        </p>
        <p className="text-sm text-emerald-700">
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
    <div className="rounded-md border-l-4 border-amber-500 bg-amber-50 p-4 flex items-start gap-3">
      <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        <p className="text-base font-semibold text-amber-900">
          Proposta em revisão pela Freitas
        </p>
        <p className="text-sm text-amber-800">Mensagem: {reason}</p>
      </div>
    </div>
  );
}

export function FinalizedCancelledBanner() {
  return (
    <div className="rounded-md border-l-4 border-slate-400 bg-slate-50 p-4 flex items-start gap-3">
      <Ban className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        <p className="text-base font-semibold text-slate-700">
          Cotação cancelada
        </p>
        <p className="text-sm text-slate-600">
          Esta cotação foi cancelada e não está mais em andamento.
        </p>
      </div>
    </div>
  );
}


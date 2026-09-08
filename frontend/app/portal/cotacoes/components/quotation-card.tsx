'use client';

import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  Hourglass,
  Sparkles,
  Zap,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  addDays,
  formatBRL,
  formatRoute,
  formatShortDate,
  daysUntil,
} from '@/lib/portal-formatters';
import {
  buildNeedsInfoMailto,
  isAwaitingAgentProposals,
  isAwaitingInfo,
} from '@/lib/portal-state';
import type {
  PortalBucketKey,
  PortalProposalScore,
  PortalQuotation,
} from '@/types/portal';

import { ClientReferenceTag } from '../../_shared/client-reference-tag';
import { ModalIcon } from '../../_shared/modal-icon';

// Cards only ever render inside the Funil columns now — the terminal buckets
// are a read-only list in the Histórico tab — so there is no "Aprovada /
// Reprovada / Cancelada" outcome pill here anymore.
const bucketAccentClass: Record<PortalBucketKey, string> = {
  aguardando_dados: 'border-l-portal-warning',
  aguardando_aprovacao: 'border-l-portal-success',
  buscando_propostas: 'border-l-portal-info',
  finalizadas: 'border-l-portal-neutral/40',
  cancelada: 'border-l-portal-neutral/40',
};

interface ScoreBadgeProps {
  score: PortalProposalScore | null | undefined;
}

// Qualitative "recommended" seal. The numeric AI score is deliberately NOT shown
// to the client (product decision): the portal surfaces the recommendation, not
// the model's number.
//
// INFO (azul), nao SUCCESS (verde): a paleta semantica do portal separa
// `portal-success` = OUTCOME (o que aconteceu — Vencedora, Menor preco) de
// `portal-info` = SYSTEM-SAID (o que o sistema sugere). O criterio esta escrito
// em `cotacao/[id]/components/proposals-table.tsx`, e la o mesmo selo
// "Recomendada" ja e azul. Recomendacao nao e resultado: em verde, o card do
// Funil dizia que a cotacao tinha um desfecho bom antes de ela ter desfecho
// nenhum. Este e o mesmo tratamento do irmao, tint por tint.
function ScoreBadge({ score }: ScoreBadgeProps) {
  if (!score || score.total == null) return null;

  return (
    <span className="portal-small inline-flex items-center gap-1 rounded bg-portal-info/15 px-1.5 py-0.5 font-medium text-portal-info">
      <Sparkles className="h-4 w-4" />
      Recomendada
    </span>
  );
}

interface QuotationCardProps {
  quotation: PortalQuotation;
  bucket: PortalBucketKey;
}

/**
 * Kanban card. Visual hierarchy is deliberate and single-peaked: the price is
 * the one element with weight — it is what the client compares — and route,
 * transit time, arrival and badges are secondary metadata around it.
 */
export function QuotationCard({ quotation, bucket }: QuotationCardProps) {
  const best = quotation.best_proposal;
  const remaining = daysUntil(best?.validity ?? quotation.data_limite_necessidade);
  const isUrgent = quotation.urgency === 'URGENTE' || quotation.urgency === 'VIP';

  const needsInfo = isAwaitingInfo(quotation.state);
  // Only "waiting" until the first proposal arrives — once any proposal is in,
  // the card is no longer awaiting (even if still COTANDO for more).
  const awaitingProposals =
    isAwaitingAgentProposals(quotation.state) &&
    (quotation.proposals_count ?? 0) === 0;

  const arrivalDateLabel =
    best?.transit_time != null ? formatShortDate(addDays(best.transit_time)) : null;

  return (
    <Link
      href={`/portal/cotacao/${quotation.id}`}
      className={cn(
        'block rounded-md border bg-background border-l-4 p-4 transition-all',
        'hover:shadow-md hover:bg-muted/30 focus-visible:shadow-md focus-visible:bg-muted/30 focus-visible:outline-none',
        bucketAccentClass[bucket],
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 portal-small text-portal-neutral">
          <ModalIcon modal={quotation.modal} />
          <span className="font-medium text-foreground">{quotation.reference}</span>
          {/* Sua referência (PO), quando o cliente informou uma. Fica ao lado da
              COT-XXXX, nunca no lugar dela: é chave de busca e reconhecimento,
              não a identidade do registro. */}
          <ClientReferenceTag value={quotation.client_reference} />
          {quotation.incoterm ? <span>· {quotation.incoterm}</span> : null}
          {isUrgent ? (
            <span className="portal-small inline-flex items-center gap-1 rounded bg-portal-danger/10 px-1.5 py-0.5 font-medium text-portal-danger">
              <Zap className="h-4 w-4" />
              {quotation.urgency === 'VIP' ? 'VIP' : 'Urgente'}
            </span>
          ) : null}
          {quotation.created_by_me ? <span>· Criada por você</span> : null}
        </div>
        {needsInfo ? (
          <AlertCircle className="h-4 w-4 shrink-0 text-portal-warning-ink" />
        ) : (
          <ArrowRight className="h-4 w-4 shrink-0 text-portal-neutral" />
        )}
      </div>

      {/* The dominant element. Without a proposal there is no price yet, and the
          card says what it is waiting for instead of showing an empty slot. */}
      {best ? (
        <div className="mt-3 space-y-1">
          <p className="text-2xl font-semibold leading-none text-foreground">
            {formatBRL(best.total_brl)}
          </p>
          <p className="portal-small text-portal-neutral">
            preço all-in
            {best.transit_time != null ? ` · ${best.transit_time}d de trânsito` : ''}
            {arrivalDateLabel ? ` · chega ${arrivalDateLabel}` : ''}
          </p>
        </div>
      ) : (
        <p className="portal-small mt-3 inline-flex items-center gap-1.5 text-portal-neutral">
          <Hourglass className="h-4 w-4" />
          {awaitingProposals
            ? 'Agentes ainda não enviaram propostas'
            : needsInfo
              ? 'Aguardando os detalhes que faltam'
              : 'Sem proposta recebida'}
        </p>
      )}

      {best ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <ScoreBadge score={best.score} />
          {best.route_detail ? (
            <span className="portal-small rounded bg-muted px-1.5 py-0.5 text-portal-neutral">
              {best.route_detail}
            </span>
          ) : null}
          {best.carrier ? (
            <span className="portal-small rounded border px-1.5 py-0.5 text-portal-neutral">
              {best.carrier}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 portal-small text-portal-neutral">
        <span className="truncate">
          {formatRoute(quotation)}
          {quotation.product ? ` · ${quotation.product}` : ''}
        </span>
        <div className="flex shrink-0 items-center gap-3">
          {quotation.proposals_count ? (
            <span>{quotation.proposals_count} propostas</span>
          ) : null}
          {!needsInfo && remaining ? (
            <span
              className={cn(
                remaining === 'Expira hoje' || remaining === 'Expirou'
                  ? 'font-medium text-portal-danger'
                  : 'text-portal-neutral',
              )}
            >
              {remaining}
            </span>
          ) : null}
        </div>
      </div>

      {needsInfo ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.location.href = buildNeedsInfoMailto(quotation.reference);
          }}
          className="portal-small mt-3 inline-flex items-center gap-1 rounded border border-portal-warning/40 bg-portal-warning/10 px-2 py-1 font-medium text-portal-warning-ink hover:bg-portal-warning/20"
        >
          Enviar informações
          <ArrowRight className="h-5 w-5" />
        </button>
      ) : null}
    </Link>
  );
}

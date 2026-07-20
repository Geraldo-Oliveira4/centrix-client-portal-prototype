'use client';

import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  Ban,
  Calendar,
  CheckCircle2,
  Hourglass,
  Sparkles,
  XCircle,
  Zap,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui';
import {
  addDays,
  formatBRL,
  formatRoute,
  formatShortDate,
  daysUntil,
} from '@/lib/portal-formatters';
import {
  buildNeedsInfoMailto,
  isApproved,
  isAwaitingAgentProposals,
  isAwaitingInfo,
  isCancelled,
  isDeclined,
} from '@/lib/portal-state';
import type {
  PortalBucketKey,
  PortalProposalScore,
  PortalQuotation,
} from '@/types/portal';

import { ModalIcon } from '../../_shared/modal-icon';

const bucketAccentClass: Record<PortalBucketKey, string> = {
  aguardando_dados: 'border-l-amber-500',
  aguardando_aprovacao: 'border-l-emerald-500',
  buscando_propostas: 'border-l-blue-500',
  finalizadas: 'border-l-slate-400',
  cancelada: 'border-l-slate-400',
};

type FinalizedOutcome = {
  label: string;
  icon: typeof CheckCircle2;
  pillClass: string;
  borderClass: string;
};

const FINALIZED_OUTCOMES: Record<string, FinalizedOutcome> = {
  FECHADA: {
    label: 'Aprovada',
    icon: CheckCircle2,
    pillClass: 'bg-emerald-50 text-emerald-700',
    borderClass: 'border-l-emerald-500',
  },
  DECLINADA: {
    label: 'Recusada',
    icon: XCircle,
    pillClass: 'bg-rose-50 text-rose-700',
    borderClass: 'border-l-rose-500',
  },
  CANCELADO: {
    label: 'Cancelada',
    icon: Ban,
    pillClass: 'bg-slate-100 text-slate-600',
    borderClass: 'border-l-slate-400',
  },
};

interface ScoreBadgeProps {
  score: PortalProposalScore | null | undefined;
}

function scoreColorClass(total: number | null): string {
  if (total == null) return 'bg-slate-100 text-slate-600';
  if (total >= 70) return 'bg-emerald-50 text-emerald-700';
  if (total >= 50) return 'bg-amber-50 text-amber-700';
  return 'bg-rose-50 text-rose-700';
}

function ScoreBadge({ score }: ScoreBadgeProps) {
  if (!score || score.total == null) return null;

  const rows = [
    { label: 'Preço', value: score.cost },
    { label: 'Transit time', value: score.transit },
    { label: 'Validade', value: score.validity },
    { label: 'Frequência', value: score.frequency },
  ];

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium cursor-default',
              scoreColorClass(score.total),
            )}
          >
            <Sparkles className="h-3 w-3" />
            Score {score.total.toFixed(1)}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="space-y-1 text-xs">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-medium">
                {row.value != null ? row.value.toFixed(1) : '—'}
              </span>
            </div>
          ))}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface QuotationCardProps {
  quotation: PortalQuotation;
  bucket: PortalBucketKey;
}

export function QuotationCard({ quotation, bucket }: QuotationCardProps) {
  const best = quotation.best_proposal;
  const remaining = daysUntil(best?.validity ?? quotation.data_limite_necessidade);
  const isUrgent = quotation.urgency === 'URGENTE' || quotation.urgency === 'VIP';

  const outcome =
    bucket === 'finalizadas' || bucket === 'cancelada'
      ? FINALIZED_OUTCOMES[quotation.state]
      : null;
  const cancelled = isCancelled(quotation.state);
  const declined = isDeclined(quotation.state);
  const needsInfo = isAwaitingInfo(quotation.state);
  // Only "waiting" until the first proposal arrives — once any proposal is in,
  // the card is no longer awaiting (even if still COTANDO for more).
  const awaitingProposals =
    isAwaitingAgentProposals(quotation.state) &&
    (quotation.proposals_count ?? 0) === 0;

  const showValue = !cancelled && best != null;
  const valueClass = isApproved(quotation.state)
    ? 'text-emerald-600'
    : declined
      ? 'text-muted-foreground line-through'
      : 'text-emerald-600';

  const arrivalDateLabel =
    best?.transit_time && showValue ? formatShortDate(addDays(best.transit_time)) : null;

  return (
    <Link
      href={`/portal/cotacao/${quotation.id}`}
      className={cn(
        'block rounded-md border bg-background border-l-4 p-4 transition-all',
        'hover:shadow-md hover:bg-muted/30 focus-visible:shadow-md focus-visible:bg-muted/30 focus-visible:outline-none',
        outcome?.borderClass ?? (needsInfo ? 'border-l-amber-500' : bucketAccentClass[bucket]),
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap min-w-0">
          <ModalIcon modal={quotation.modal} />
          <span className="font-medium text-foreground whitespace-nowrap">{quotation.reference}</span>
          {quotation.incoterm ? (
            <span className="rounded border px-1.5 py-0.5 text-xs">
              {quotation.incoterm}
            </span>
          ) : null}
          {outcome ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium',
                outcome.pillClass,
              )}
            >
              <outcome.icon className="h-3 w-3" />
              {outcome.label}
            </span>
          ) : null}
          {awaitingProposals ? (
            <span className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">
              <Hourglass className="h-3 w-3" />
              Aguardando propostas
            </span>
          ) : null}
          {!outcome && isUrgent ? (
            <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-xs text-rose-700">
              <Zap className="h-3 w-3" />
              {quotation.urgency === 'VIP' ? 'VIP' : 'Urgente'}
            </span>
          ) : null}
          {quotation.created_by_me ? (
            <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700 border border-blue-200">
              Criada por você
            </span>
          ) : null}
        </div>
        {needsInfo ? (
          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
        ) : (
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </div>

      {showValue && best ? (
        <div className="mt-3 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-baseline gap-6">
            <div>
              <p className={cn('text-xl font-semibold leading-none', valueClass)}>
                {formatBRL(best.total_brl)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">preço all-in</p>
            </div>
            <div>
              <p className="text-xl font-semibold leading-none">
                {best.transit_time}d
              </p>
              <p className="text-xs text-muted-foreground mt-1">transit time</p>
            </div>
          </div>
          {arrivalDateLabel ? (
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-4 w-4 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">{arrivalDateLabel}</p>
                <p>chegada fábrica</p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {!outcome && best ? (
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <ScoreBadge score={best.score} />
          {best.route_detail ? (
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">
              {best.route_detail}
            </span>
          ) : null}
          {best.carrier ? (
            <span className="rounded border px-1.5 py-0.5 text-muted-foreground">
              {best.carrier}
            </span>
          ) : null}
          {best.frequencia ? (
            <span className="rounded border px-1.5 py-0.5 text-muted-foreground">
              {best.frequencia}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground gap-3 flex-wrap">
        <span className="truncate">
          {formatRoute(quotation)}{' '}
          {quotation.product ? `· ${quotation.product}` : ''}
        </span>
        <div className="flex items-center gap-3 shrink-0">
          {needsInfo ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.location.href = buildNeedsInfoMailto(quotation.reference);
              }}
              className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
            >
              Responder
              <ArrowRight className="h-3 w-3" />
            </button>
          ) : null}
          {quotation.proposals_count != null ? (
            <span>{quotation.proposals_count} propostas</span>
          ) : null}
          {!outcome && !needsInfo && remaining ? (
            <span
              className={cn(
                remaining === 'Expira hoje' || remaining === 'Expirou'
                  ? 'text-rose-600 font-medium'
                  : 'text-emerald-600',
              )}
            >
              {remaining}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

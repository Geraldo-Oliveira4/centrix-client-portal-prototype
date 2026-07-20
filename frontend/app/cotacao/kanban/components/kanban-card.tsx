'use client';

import { useRouter } from 'next/navigation';
import { Ship, Plane, Truck } from 'lucide-react';
import { formatDistanceToNow, differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { KanbanCard as KanbanCardType, KanbanColumnKey } from '@/types/quotation';
import { PriorityBadge } from '@/app/inbox/components/priority-badge';
import { formatCurrencyCode } from '@/lib/portal-formatters';
import { CardContextMenu } from './card-context-menu';
import { ReviewBadge } from './review-badge';
import { ReadyToSendBadge } from './ready-to-send-badge';
import { GuardRailControl } from './guard-rail-control';
import type { QuotationState } from '@/types/quotation';
import { MODAL_DISPLAY } from '@/types/quotation';

interface KanbanCardProps {
  card: KanbanCardType;
  columnKey: KanbanColumnKey;
  onTransition: (cardId: string, targetState: QuotationState) => void;
}

const URGENCY_CONFIG: Record<string, { label: string; className: string }> = {
  URGENTE: {
    label: 'Urgente',
    className: 'bg-destructive/10 text-destructive border-destructive/30',
  },
  VIP: {
    label: 'VIP',
    className: 'bg-secondary text-secondary-foreground border-primary/20',
  },
  ALTA: {
    label: 'Alta',
    className:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800',
  },
};

export function KanbanCard({ card, columnKey, onTransition }: KanbanCardProps) {
  const router = useRouter();

  const modalInfo = card.modal ? MODAL_DISPLAY[card.modal] : null;
  const isCritical = card.client?.is_vip ?? false;
  const showReadyToSend = card.ready_to_send && !card.has_agent_review && columnKey === 'PARA_ANALISE';
  const showReviewBadge = card.has_agent_review && columnKey === 'PARA_ANALISE';
  const showProposalCount = columnKey === 'PARA_ANALISE' && (card.proposal_count ?? 0) > 0;

  const handleClick = () => {
    router.push(`/cotacao/${card.id}`);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`Cotação ${card.reference}${card.client?.name ? ` — ${card.client.name}` : ''} — Ver detalhes`}
      className={cn(
        'rounded-lg border bg-card p-3 shadow-sm transition-shadow cursor-pointer',
        'hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        showReadyToSend && 'border-green-500 border-2',
        card.guard_rail_active && 'border-amber-500 border-2',
        columnKey === 'ENVIADA_CLIENTE' && card.portal_approved && 'border-emerald-500 border-2',
        columnKey === 'APROVADA_PELO_CLIENTE' && 'border-amber-500 border-2',
      )}
    >
      {/* Header: reference + context menu */}
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <span className="text-xs font-semibold text-foreground truncate min-w-0 flex-1">
          {card.reference}
        </span>
        <CardContextMenu
          state={card.state}
          onTransition={(target) => onTransition(card.id, target)}
        />
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-1 mb-1.5">
        {card.urgency && URGENCY_CONFIG[card.urgency] && (
          <Badge
            variant="outline"
            className={cn('text-xs py-0 px-1.5', URGENCY_CONFIG[card.urgency].className)}
          >
            {URGENCY_CONFIG[card.urgency].label}
          </Badge>
        )}
        <PriorityBadge score={card.priority_score} className="text-xs py-0 px-1.5" />
        {isCritical && (
          <Badge
            variant="outline"
            className="text-xs py-0 px-1.5 bg-secondary text-secondary-foreground border-primary/20"
          >
            Crítico
          </Badge>
        )}
        {card.created_by_portal && (
          <Badge
            variant="outline"
            className="text-xs py-0 px-1.5 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800"
          >
            Portal
          </Badge>
        )}
        {card.guard_rail_active && (
          <Badge
            variant="outline"
            className="text-xs py-0 px-1.5 bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800"
          >
            Guard Rail
          </Badge>
        )}
        {card.incoterm && (
          <Badge variant="secondary" className="text-xs py-0 px-1.5">
            {card.incoterm}
          </Badge>
        )}
        {modalInfo && (
          <Badge variant="secondary" className="text-xs py-0 px-1.5 gap-0.5">
            {modalInfo.icon === 'ship' ? (
              <Ship className="h-2.5 w-2.5" />
            ) : modalInfo.icon === 'plane' ? (
              <Plane className="h-2.5 w-2.5" />
            ) : (
              <Truck className="h-2.5 w-2.5" />
            )}
            {modalInfo.label}
          </Badge>
        )}
      </div>

      {/* Client name */}
      <p className="text-xs text-foreground truncate">
        {card.client?.name ?? 'Cliente não vinculado'}
      </p>

      {/* Client reference */}
      {card.client_reference && (
        <p className="text-[11px] text-muted-foreground truncate">
          Ref: {card.client_reference}
        </p>
      )}

      {/* Route */}
      {(() => {
        const dest = card.porto_destino?.join(', ') || card.aeroporto_destino?.join(', ');
        if (!card.origin && !dest) return null;
        return (
          <p className="text-[11px] text-muted-foreground truncate">
            {card.origin ?? '?'} → {dest ?? '?'}
          </p>
        );
      })()}

      {/* Context info per column */}
      <ColumnContext card={card} columnKey={columnKey} />

      {/* Proposal count badge for PARA_ANALISE column */}
      {showProposalCount && (
        <div className="mt-1.5">
          <Badge
            variant="outline"
            className="text-xs py-0 px-1.5 bg-muted text-muted-foreground border-border"
          >
            {card.proposal_count} proposta{card.proposal_count === 1 ? '' : 's'}
          </Badge>
        </div>
      )}

      {/* Status badges */}
      {(showReviewBadge || showReadyToSend) && (
        <div className="mt-1.5">
          {showReviewBadge && <ReviewBadge />}
          {showReadyToSend && <ReadyToSendBadge />}
        </div>
      )}

      {/* Guard rail actions (ARB-2449) — analyst resolves release/block here */}
      {card.guard_rail_active && <GuardRailControl card={card} />}

      {/* Analyst */}
      {card.analyst_name && (
        <p className="text-[10px] text-muted-foreground mt-1.5 truncate">
          {card.analyst_name}
        </p>
      )}
    </div>
  );
}

// Absolute short date for state-transition timestamps (sent/closed/declined).
function formatShortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return format(new Date(iso), "dd/MM/yyyy", { locale: ptBR });
}

function DaysCounter({ createdAt, columnKey }: { createdAt: string; columnKey: KanbanColumnKey }) {
  const days = differenceInDays(new Date(), new Date(createdAt));
  if (days < 1) return null;

  const isUrgent =
    (columnKey === 'COTANDO' && days > 3) ||
    (columnKey === 'PARA_ANALISE' && days > 5) ||
    (columnKey === 'ENVIADA_CLIENTE' && days > 7);

  return (
    <span
      className={cn(
        'text-[10px] font-medium',
        isUrgent ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      {days}d
    </span>
  );
}

function ColumnContext({
  card,
  columnKey,
}: {
  card: KanbanCardType;
  columnKey: KanbanColumnKey;
}) {
  switch (columnKey) {
    case 'COTANDO': {
      const deadline = card.desired_deadline ? new Date(card.desired_deadline) : null;
      const now = new Date();
      const isDeadlineExpired = deadline && deadline < now;
      const isDeadlineSoon = deadline && !isDeadlineExpired && differenceInDays(deadline, now) <= 1;
      return (
        <div className="flex flex-col gap-0.5 mt-1">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">
              Aguardando respostas dos agentes
            </p>
            {card.created_at && <DaysCounter createdAt={card.created_at} columnKey={columnKey} />}
          </div>
          {deadline && (
            <p className={cn(
              'text-[10px] font-medium',
              isDeadlineExpired ? 'text-destructive' : isDeadlineSoon ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
            )}>
              DDL: {deadline.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              {isDeadlineExpired && ' — Vencido'}
            </p>
          )}
        </div>
      );
    }

    case 'PARA_ANALISE':
      return card.created_at ? (
        <div className="flex justify-end mt-1">
          <DaysCounter createdAt={card.created_at} columnKey={columnKey} />
        </div>
      ) : null;

    case 'ENVIADA_CLIENTE': {
      const sentDate = formatShortDate(card.sent_at);
      const sentLabel = sentDate ? `Enviada em ${sentDate}` : null;
      return (
        <div className="flex flex-col gap-0.5 mt-1">
          <div className="flex items-center justify-between">
            {card.portal_approved ? (
              <span className="inline-flex items-center text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800 px-1.5 py-0.5 rounded w-fit">
                Aprovada pelo cliente
              </span>
            ) : (
              sentLabel ? (
                <p className="text-[11px] text-muted-foreground">
                  {sentLabel}
                </p>
              ) : <span />
            )}
            {card.created_at && <DaysCounter createdAt={card.created_at} columnKey={columnKey} />}
          </div>
          {card.portal_approved && sentLabel && (
            <p className="text-[11px] text-muted-foreground">
              {sentLabel}
            </p>
          )}
        </div>
      );
    }

    case 'APROVADA_PELO_CLIENTE': {
      const approvedAt = card.updated_at;
      const approvedRelative = approvedAt
        ? formatDistanceToNow(new Date(approvedAt), { locale: ptBR, addSuffix: true })
        : null;
      return (
        <div className="flex flex-col gap-0.5 mt-1">
          <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium truncate">
            {card.quoted_value_usd != null
              ? formatCurrencyCode(card.quoted_value_usd, 'USD')
              : 'Aguardando instrução de embarque'}
          </p>
          {approvedRelative && (
            <p className="text-[11px] text-muted-foreground">
              Aprovada {approvedRelative}
            </p>
          )}
        </div>
      );
    }

    case 'FECHADA': {
      const closedDate = formatShortDate(card.closed_at);
      return (
        <div className="flex flex-col gap-0.5 mt-1">
          {card.portal_approved && (
            <span className="inline-flex items-center text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800 px-1.5 py-0.5 rounded w-fit">
              Aprovada pelo cliente
            </span>
          )}
          <p className="text-[11px] text-green-600 dark:text-green-400 truncate">
            {card.quoted_value_usd != null
              ? formatCurrencyCode(card.quoted_value_usd, 'USD')
              : 'Fechada'}
          </p>
          {closedDate && (
            <p className="text-[11px] text-muted-foreground">
              Fechada em {closedDate}
            </p>
          )}
        </div>
      );
    }

    case 'DECLINADA': {
      const declinedDate = formatShortDate(card.declined_at);
      return (
        <div className="flex flex-col gap-0.5 mt-1">
          <p className="text-[11px] text-destructive">
            Cotação declinada
          </p>
          {declinedDate && (
            <p className="text-[11px] text-muted-foreground">
              Declinada em {declinedDate}
            </p>
          )}
        </div>
      );
    }

    default:
      return null;
  }
}

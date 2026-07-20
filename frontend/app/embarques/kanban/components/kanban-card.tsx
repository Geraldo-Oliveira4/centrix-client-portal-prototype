'use client';

import { useRouter } from 'next/navigation';
import { Ship, Plane, Truck, AlertTriangle, CalendarClock, Flag } from 'lucide-react';
import { differenceInCalendarDays, differenceInDays, format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ShipmentKanbanItem } from '@/types/shipment';
import { TIPO_DESPACHO_LABELS } from '@/types/shipment';
import { MODAL_DISPLAY } from '../constants';

interface KanbanCardProps {
  card: ShipmentKanbanItem;
}

// A readiness date is "near due" when it is less than 3 calendar days away
// (72h). Comparisons are done in calendar days because data_prontidao carries
// no time component, so the readiness day itself must still count as on time.
const NEAR_DUE_DAYS = 3;

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function KanbanCard({ card }: KanbanCardProps) {
  const router = useRouter();

  const modalInfo = card.modal ? MODAL_DISPLAY[card.modal] : null;
  const days = differenceInDays(new Date(), new Date(card.created_at));

  const prontidao = parseDate(card.data_prontidao);
  const limiteNecessidade = parseDate(card.data_limite_necessidade);
  const now = new Date();
  const prontidaoExpired = prontidao !== null && differenceInCalendarDays(prontidao, now) < 0;
  const prontidaoSoon =
    prontidao !== null &&
    !prontidaoExpired &&
    differenceInCalendarDays(prontidao, now) < NEAR_DUE_DAYS;

  const handleClick = () => {
    router.push(`/embarques/${card.id}`);
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
      aria-label={`Embarque ${card.referencia} — ${card.cliente_nome} — Ver detalhes`}
      className={cn(
        'rounded-lg border bg-card p-3 shadow-sm transition-shadow cursor-pointer',
        'hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        card.carga_urgente && 'border-2 border-destructive/40 bg-destructive/5',
      )}
    >
      {/* Header: reference + urgent flag */}
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <span className="text-xs font-semibold text-foreground truncate">
          {card.referencia}
        </span>
        {card.carga_urgente && (
          <Badge
            variant="outline"
            className="text-xs py-0 px-1.5 gap-0.5 bg-destructive/10 text-destructive border-destructive/30"
          >
            <AlertTriangle className="h-2.5 w-2.5" />
            Urgente
          </Badge>
        )}
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-1 mb-1.5">
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
        {card.tipo_despacho && (
          <Badge variant="outline" className="text-xs py-0 px-1.5">
            {TIPO_DESPACHO_LABELS[card.tipo_despacho]}
          </Badge>
        )}
      </div>

      {/* Client name */}
      <p className="text-xs text-foreground truncate">{card.cliente_nome}</p>

      {/* Agent */}
      {card.agente_nome && (
        <p className="text-[11px] text-muted-foreground truncate">{card.agente_nome}</p>
      )}

      {/* Dates: readiness (with near-due alert) and need-by limit */}
      {(prontidao || limiteNecessidade) && (
        <div className="mt-1.5 flex flex-col gap-0.5">
          {prontidao && (
            <div
              className={cn(
                'flex items-center gap-1 text-[11px]',
                prontidaoExpired
                  ? 'font-medium text-destructive'
                  : prontidaoSoon
                    ? 'font-medium text-amber-600 dark:text-amber-400'
                    : 'text-muted-foreground',
              )}
            >
              <CalendarClock className="h-3 w-3 shrink-0" />
              <span>Prontidão: {format(prontidao, 'dd/MM/yyyy')}</span>
              {prontidaoExpired && <span>— Vencida</span>}
            </div>
          )}
          {limiteNecessidade && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Flag className="h-3 w-3 shrink-0" />
              <span>Limite: {format(limiteNecessidade, 'dd/MM/yyyy')}</span>
            </div>
          )}
        </div>
      )}

      {/* Age counter */}
      {days >= 1 && (
        <div className="flex justify-end mt-1">
          <span className="text-[10px] font-medium text-muted-foreground">{days}d</span>
        </div>
      )}
    </div>
  );
}

'use client';

import { Anchor, AlertTriangle, MapPin } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ModalIcon } from '../../_shared/modal-icon';
import {
  ESTADO_LABELS,
  isExceptionState,
  type EmbarqueEstado,
} from '@/types/portal-shipment';
import type { QuotationModal } from '@/types/quotation';

/**
 * Illustrative origin → destination track with the vehicle placed according to
 * the shipment's CURRENT STATE.
 *
 * >>> This is NOT tracking. <<<
 *
 * There is no GPS, no AIS, no carrier feed and no ChipsGo integration behind
 * this repo: the only movement signal in the database is the `estado` column on
 * centrix_shipment_embarques. The position below is a fixed percentage per
 * state, not a location — a shipment sitting in `coletado` for three weeks
 * renders at exactly the same point the whole time. The caption on the
 * component says so, and it must stay: without it the line reads as a live map,
 * which is precisely the claim the data cannot support.
 *
 * The endpoints are labelled generically ("Origem" / "Destino") because the
 * portal shipment payload carries no route — origin and destination live on the
 * quotation (centrix_quotation_quotations.origin), and only shipments
 * provisioned from a quotation have one at all. Naming the ports would mean
 * fetching the quotation here and leaving the other shipments blank; a v2 that
 * wants real port names should add them to the shipment serializer instead.
 *
 * Exception states (postergado, booking_divergente) park the vehicle at the
 * start with an alert rather than guessing a position: the state that preceded
 * the exception is not stored, so any point on the line would be invented.
 */

// Progress per state. Deliberately coarse — these are stages of a process, not
// distances travelled, and rounder numbers make that easier to read as such.
const STATE_PROGRESS: Record<EmbarqueEstado, number> = {
  solicitado: 6,
  aguardando_prontidao: 20,
  coletado: 42,
  analise_booking: 62,
  embarcado: 88,
  // Exceptions never use this map — see below.
  postergado: 0,
  booking_divergente: 0,
};

export function ShipmentRoute({
  estado,
  modal,
}: {
  estado: EmbarqueEstado;
  modal: QuotationModal | null;
}) {
  const exception = isExceptionState(estado);
  const progress = exception ? 0 : STATE_PROGRESS[estado];
  const arrived = estado === 'embarcado';

  const trackTone = exception
    ? 'bg-portal-danger'
    : arrived
      ? 'bg-portal-success'
      : 'bg-portal-info';
  const vehicleTone = exception
    ? 'border-portal-danger text-portal-danger'
    : arrived
      ? 'border-portal-success text-portal-success'
      : 'border-portal-info text-portal-info';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="portal-small inline-flex items-center gap-1.5 font-medium text-foreground">
          <MapPin className="h-4 w-4 text-portal-neutral" />
          Origem
        </span>
        <span className="portal-small inline-flex items-center gap-1.5 font-medium text-foreground">
          <Anchor className="h-4 w-4 text-portal-neutral" />
          Destino
        </span>
      </div>

      {/* Track. The vehicle badge is CENTRED on the line, not stacked above it:
          riding above forced 28px of padding whose only occupant was a 28px
          badge parked at one end, so the wider the card the more of that band
          read as an empty gap beside the bar. Centred, the padding is only the
          badge's own half-height (14px = py-3.5) and the band is never empty. */}
      <div className="relative py-3.5">
        <div className="h-1.5 w-full rounded-full bg-border/70">
          <div
            className={cn('h-1.5 rounded-full transition-all duration-500', trackTone)}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Endpoint dots, on the same centre line as the track and the badge. */}
        <span className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-portal-neutral" />
        <span
          className={cn(
            'absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 bg-white',
            arrived ? 'border-portal-success' : 'border-border',
          )}
        />

        {/* Vehicle */}
        {/* clamp keeps the 28px badge fully inside the track at both ends —
            at 0% (parked) half of it would otherwise hang past the card padding. */}
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-500"
          style={{ left: `clamp(14px, ${progress}%, calc(100% - 14px))` }}
        >
          <span
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full border-2 bg-white shadow-sm',
              vehicleTone,
            )}
            aria-hidden="true"
          >
            <ModalIcon modal={modal} className="h-4 w-4" />
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={cn(
            'portal-small inline-flex items-center gap-1.5 font-medium',
            exception ? 'text-portal-danger' : 'text-portal-neutral',
          )}
        >
          {exception ? (
            <>
              <AlertTriangle className="h-4 w-4" />
              Parado — {ESTADO_LABELS[estado]}
            </>
          ) : (
            ESTADO_LABELS[estado]
          )}
        </span>
        {/* Non-negotiable caption: see the module docstring. */}
        <span className="portal-small text-portal-neutral">
          Representação ilustrativa do estágio do processo — não é rastreamento por GPS.
        </span>
      </div>
    </div>
  );
}

'use client';

import { AlertTriangle, Check } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  ESTADO_DESCRIPTIONS,
  ESTADO_LABELS,
  SHIPMENT_STEPS,
  isExceptionState,
  type EmbarqueEstado,
} from '@/types/portal-shipment';

/**
 * Horizontal progress indicator for the CURRENT state of a shipment.
 *
 * This is not a timeline, and cannot become one with today's schema: the
 * database stores a single `estado` column on centrix_shipment_embarques and
 * writes no row when it changes, so there are no per-step dates to show and no
 * way to know when the shipment left a previous stage. A v2 would need a
 * shipment transition-log table (embarque_id, from_state, to_state, actor,
 * timestamp) fed by the GE state machine; only then can the steps carry dates
 * and the exception states be positioned on the line.
 *
 * Consequence for the two exception states (postergado, booking_divergente):
 * they are rendered as an interruption of the whole line rather than as a
 * position on it. The state that preceded the exception is not stored, so
 * marking any step as completed would be a guess presented as a fact.
 */
export function ShipmentProgress({ estado }: { estado: EmbarqueEstado }) {
  const exception = isExceptionState(estado);
  const currentIndex = SHIPMENT_STEPS.indexOf(estado);

  return (
    <div className="space-y-4">
      <ol className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-0">
        {SHIPMENT_STEPS.map((step, index) => {
          const done = !exception && index < currentIndex;
          const current = !exception && index === currentIndex;
          const last = index === SHIPMENT_STEPS.length - 1;

          return (
            <li
              key={step}
              className="flex flex-1 items-start gap-3 sm:flex-col sm:items-center sm:gap-2"
            >
              <div className="flex items-center sm:w-full">
                {/* Connector to the previous step (desktop only) */}
                <span
                  className={cn(
                    'hidden h-0.5 flex-1 sm:block',
                    index === 0 && 'invisible',
                    done || current ? 'bg-primary' : 'bg-border',
                  )}
                />
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold',
                    done && 'border-primary bg-primary text-primary-foreground',
                    current && 'border-primary text-primary',
                    !done && !current && 'border-border text-muted-foreground',
                  )}
                  aria-current={current ? 'step' : undefined}
                >
                  {done ? <Check className="h-4 w-4" /> : index + 1}
                </span>
                <span
                  className={cn(
                    'hidden h-0.5 flex-1 sm:block',
                    last && 'invisible',
                    done ? 'bg-primary' : 'bg-border',
                  )}
                />
              </div>
              <span
                className={cn(
                  'text-xs sm:text-center',
                  current ? 'font-semibold text-foreground' : 'text-muted-foreground',
                )}
              >
                {ESTADO_LABELS[step]}
              </span>
            </li>
          );
        })}
      </ol>

      {exception ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">{ESTADO_LABELS[estado]}</p>
            <p className="text-destructive/90">{ESTADO_DESCRIPTIONS[estado]}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{ESTADO_DESCRIPTIONS[estado]}</p>
      )}
    </div>
  );
}

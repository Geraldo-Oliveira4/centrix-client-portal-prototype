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
 *
 * Colour follows the semantic palette, not the brand: completed steps are
 * portal-success, the current step takes its own state colour (warning while
 * waiting, success once embarcado), and pending steps stay portal-neutral.
 */
export function ShipmentProgress({ estado }: { estado: EmbarqueEstado }) {
  const exception = isExceptionState(estado);
  const currentIndex = SHIPMENT_STEPS.indexOf(estado);
  // The final step is the only "done" state; everything before it is in flight.
  const currentIsDone = estado === 'embarcado';

  return (
    <div className="space-y-6">
      <ol className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-0">
        {SHIPMENT_STEPS.map((step, index) => {
          const done = !exception && index < currentIndex;
          const current = !exception && index === currentIndex;
          const last = index === SHIPMENT_STEPS.length - 1;
          const currentTone = currentIsDone
            ? 'border-portal-success text-portal-success'
            : 'border-portal-warning text-portal-warning';

          return (
            <li
              key={step}
              className="flex flex-1 items-start gap-4 sm:flex-col sm:items-center sm:gap-2"
            >
              <div className="flex items-center sm:w-full">
                {/* Connector to the previous step (desktop only) */}
                <span
                  className={cn(
                    'hidden h-0.5 flex-1 sm:block',
                    index === 0 && 'invisible',
                    done || current ? 'bg-portal-success' : 'bg-border',
                  )}
                />
                <span
                  className={cn(
                    'portal-small flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 font-medium transition-colors',
                    done && 'border-portal-success bg-portal-success text-white',
                    current && cn('bg-white', currentTone),
                    !done && !current && 'border-border text-portal-neutral',
                  )}
                  aria-current={current ? 'step' : undefined}
                >
                  {done ? <Check className="h-4 w-4" /> : index + 1}
                </span>
                <span
                  className={cn(
                    'hidden h-0.5 flex-1 sm:block',
                    last && 'invisible',
                    done ? 'bg-portal-success' : 'bg-border',
                  )}
                />
              </div>
              <span
                className={cn(
                  'portal-small sm:text-center',
                  current
                    ? 'font-medium text-foreground'
                    : done
                      ? 'text-foreground/70'
                      : 'text-portal-neutral',
                )}
              >
                {ESTADO_LABELS[step]}
              </span>
            </li>
          );
        })}
      </ol>

      {exception ? (
        <div className="flex items-start gap-2 rounded-xl border border-portal-danger/30 bg-portal-danger/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-portal-danger" />
          <div className="space-y-1">
            <p className="portal-h3 text-portal-danger">{ESTADO_LABELS[estado]}</p>
            <p className="portal-body text-foreground/80">
              {ESTADO_DESCRIPTIONS[estado]}
            </p>
          </div>
        </div>
      ) : (
        <p className="portal-body text-portal-neutral">
          {ESTADO_DESCRIPTIONS[estado]}
        </p>
      )}
    </div>
  );
}

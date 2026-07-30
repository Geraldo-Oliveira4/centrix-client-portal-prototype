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

import { ProvenanceBadge } from '../../_shared/provenance-badge';

/**
 * Vertical, linear timeline of a shipment's journey.
 *
 * Two halves, honestly separated:
 *  - The REAL operational states (SHIPMENT_STEPS), which the backend actually
 *    tracks: past steps are done, the `estado` is the current step, the rest are
 *    upcoming. There are still no per-step dates (the schema stores only the
 *    current `estado`, no transition log), so no step carries a timestamp.
 *  - The DOWNSTREAM stages the client cares about (Em trânsito -> Chegada ->
 *    Liberado), which no data source in this prototype can confirm — there is no
 *    ETA feed and no customs-release signal. They are always inactive and wear a
 *    "Pendente integração" badge, never a fabricated date.
 *
 * Exception states (postergado, booking_divergente) interrupt the line rather
 * than sit on it: the state that preceded the exception is not stored, so marking
 * any step done would be a guess presented as fact.
 */

type StepStatus = 'done' | 'current' | 'upcoming' | 'pending';

interface TimelineStep {
  key: string;
  label: string;
  description: string;
  status: StepStatus;
}

const DOWNSTREAM: { key: string; label: string; description: string }[] = [
  {
    key: 'em_transito',
    label: 'Em trânsito',
    description: 'A carga segue em trânsito internacional até o destino.',
  },
  {
    key: 'chegada_prevista',
    label: 'Chegada prevista',
    description: 'Chegada ao porto ou aeroporto de destino.',
  },
  {
    key: 'liberado',
    label: 'Liberado',
    description: 'Carga desembaraçada e liberada para retirada.',
  },
];

function buildSteps(estado: EmbarqueEstado): TimelineStep[] {
  const exception = isExceptionState(estado);
  const currentIndex = SHIPMENT_STEPS.indexOf(estado);

  const real: TimelineStep[] = SHIPMENT_STEPS.map((step, index) => {
    let status: StepStatus;
    if (exception) {
      // Prior stage is unknown once an exception is raised — nothing is "done".
      status = 'upcoming';
    } else if (index < currentIndex) {
      status = 'done';
    } else if (index === currentIndex) {
      status = 'current';
    } else {
      status = 'upcoming';
    }
    return {
      key: step,
      label: ESTADO_LABELS[step],
      description: ESTADO_DESCRIPTIONS[step],
      status,
    };
  });

  const downstream: TimelineStep[] = DOWNSTREAM.map((d) => ({
    ...d,
    status: 'pending' as const,
  }));

  return [...real, ...downstream];
}

function StepDot({ status }: { status: StepStatus }) {
  if (status === 'done') {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-portal-success text-white">
        <Check className="h-4 w-4" />
      </span>
    );
  }
  if (status === 'current') {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-portal-success bg-white">
        <span className="h-2.5 w-2.5 rounded-full bg-portal-success" />
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-border bg-muted" />
    );
  }
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-white" />
  );
}

export function ShipmentTimeline({ estado }: { estado: EmbarqueEstado }) {
  const exception = isExceptionState(estado);
  const steps = buildSteps(estado);

  return (
    <div className="space-y-6">
      {exception && (
        <div className="flex items-start gap-2 rounded-xl border border-portal-danger/30 bg-portal-danger/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-portal-danger" />
          <div className="space-y-1">
            <p className="portal-h3 text-portal-danger">{ESTADO_LABELS[estado]}</p>
            <p className="portal-body text-foreground/80">
              {ESTADO_DESCRIPTIONS[estado]}
            </p>
          </div>
        </div>
      )}

      <ol className="relative space-y-6">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const active = step.status === 'done' || step.status === 'current';
          return (
            <li key={step.key} className="relative flex gap-4">
              {/* Connector to the next step */}
              {!isLast && (
                <span
                  className={cn(
                    'absolute left-[13px] top-8 h-[calc(100%+0.5rem)] w-px',
                    step.status === 'done' ? 'bg-portal-success' : 'bg-border',
                  )}
                  aria-hidden
                />
              )}
              <StepDot status={step.status} />
              <div className="flex-1 space-y-0.5 pb-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className={cn(
                      'portal-body font-medium',
                      step.status === 'current'
                        ? 'text-foreground'
                        : active
                          ? 'text-foreground/80'
                          : 'text-portal-neutral',
                    )}
                  >
                    {step.label}
                  </p>
                  {step.status === 'current' && (
                    <span className="portal-small inline-flex items-center rounded border border-portal-success/25 bg-portal-success/10 px-1.5 py-0.5 font-medium text-portal-success">
                      Etapa atual
                    </span>
                  )}
                  {step.status === 'pending' && (
                    <ProvenanceBadge provenance="pending" />
                  )}
                </div>
                <p className="portal-small text-portal-neutral">
                  {step.description}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

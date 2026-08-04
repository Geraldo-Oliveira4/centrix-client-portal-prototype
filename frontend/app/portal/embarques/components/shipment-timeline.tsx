'use client';

import { AlertTriangle, Check, ShieldCheck } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  ESTADO_DESCRIPTIONS,
  ESTADO_LABELS,
  SHIPMENT_STEPS,
  isExceptionState,
  type EmbarqueEstado,
  type PortalShipmentTracking,
} from '@/types/portal-shipment';

import {
  IncompleteDataBadge,
  IncompleteDataNote,
} from '../../_shared/incomplete-data-badge';
import { ProvenanceBadge } from '../../_shared/provenance-badge';
import { INCOMPLETE_DATA_COPY } from '../lib/delay-risk';
import {
  buildTimelineSteps,
  firstBlockedKey,
  type StepStatus,
} from '../lib/timeline-steps';

/**
 * Vertical, linear timeline of a shipment's journey.
 *
 * Two halves, honestly separated:
 *  - The REAL operational states (SHIPMENT_STEPS), which the backend actually
 *    tracks: past steps are done, the `estado` is the current step, the rest are
 *    upcoming. There are still no per-step dates (the schema stores only the
 *    current `estado`, no transition log), so no step carries a timestamp.
 *  - The DOWNSTREAM stages the client cares about (Em trânsito -> Chegada ->
 *    Descarregado -> Liberado). They advance only from `tracking.last_milestone`
 *    (the carrier's own milestone), and with no feed they stay inactive under a
 *    "Pendente integração" badge — never a fabricated date. When a milestone IS
 *    present, the steps before it are done and the milestone itself becomes the
 *    current stage; the caller is responsible for showing the `preview` seal if
 *    `tracking.is_mock` (demo data), which is why this component does not draw
 *    it per step.
 *
 * The downstream four are the carrier milestones the ShipsGo integration will
 * report, in its own vocabulary: Ocean Transit, Arrival at POD, Discharge,
 * Available for Pickup. Upstream, Gate-in maps onto the real `coletado` state
 * and Vessel Loading onto `embarcado`, which is why they are not repeated here.
 *
 * Third state, once the feed exists: `tracking.data_status === 'INCOMPLETE'`
 * means ShipsGo is integrated for this shipment but the carrier never published
 * enough. The downstream steps are then "travados" — neutral, never a health
 * colour — and carry the standard explanation instead of a promise of progress.
 *
 * Exception states (postergado, booking_divergente) interrupt the line rather
 * than sit on it: the state that preceded the exception is not stored, so marking
 * any step done would be a guess presented as fact.
 */

/**
 * Customs clearance (desembaraço) enrichment — a future Camada 2 over
 * Inova / Portal Único, NOT part of the carrier feed and NOT integrated.
 *
 * It is deliberately not a step on the line: clearance is a status the arrival
 * either has or does not, and it is not guaranteed for every process (it
 * depends on the port and on the client being linked in the Inova cadastro).
 * That is also why its absence renders NOTHING — not even "Pendente
 * integração": a permanent grey badge on shipments that will never have the
 * data would read as a gap in the process rather than an attribute that simply
 * does not apply.
 */
export interface CustomsClearance {
  /** ISO date the cargo cleared customs, when Camada 2 reports one. */
  clearedAt?: string | null;
}

/** The five real operational steps, with the client-facing wording. */
const REAL_STEPS = SHIPMENT_STEPS.map((step) => ({
  key: step,
  label: ESTADO_LABELS[step],
  description: ESTADO_DESCRIPTIONS[step],
}));

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
  if (status === 'pending' || status === 'blocked') {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-border bg-muted" />
    );
  }
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-white" />
  );
}

/**
 * "✓ Desembaraçado" — a tag on the arrival step, not a step of its own.
 * Renders only when Camada 2 actually reports a clearance; see CustomsClearance.
 */
function CustomsClearedTag({ clearance }: { clearance?: CustomsClearance | null }) {
  if (!clearance?.clearedAt) return null;
  return (
    <span className="portal-small inline-flex items-center gap-1 rounded border border-portal-success/25 bg-portal-success/10 px-1.5 py-0.5 font-medium text-portal-success">
      <ShieldCheck className="h-3.5 w-3.5" />
      Desembaraçado
    </span>
  );
}

export function ShipmentTimeline({
  estado,
  tracking,
  customsClearance,
}: {
  estado: EmbarqueEstado;
  /** Carrier feed. Null/absent today — the downstream stages stay "pendente". */
  tracking?: PortalShipmentTracking | null;
  /** Camada 2 (Inova / Portal Único). Not integrated: nothing passes this yet. */
  customsClearance?: CustomsClearance | null;
}) {
  const exception = isExceptionState(estado);
  const steps = buildTimelineSteps({
    estado,
    realSteps: REAL_STEPS,
    isException: exception,
    dataStatus: tracking?.data_status,
    milestone: tracking?.last_milestone,
  });
  // The explanation goes on the first step that is actually blocked, which is
  // not necessarily the first downstream step once milestones have advanced.
  const blockedKey = firstBlockedKey(steps);

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
                  {/* One badge for the whole blocked stretch — repeating it on
                      four consecutive steps says the same thing four times. */}
                  {step.status === 'blocked' && step.key === blockedKey && (
                    <IncompleteDataBadge label="Sem atualização da companhia" />
                  )}
                  {step.isArrival && (
                    <CustomsClearedTag clearance={customsClearance} />
                  )}
                </div>
                <p className="portal-small text-portal-neutral">
                  {step.description}
                </p>
                {step.status === 'blocked' && step.key === blockedKey && (
                  <IncompleteDataNote className="pt-1">
                    {INCOMPLETE_DATA_COPY}
                  </IncompleteDataNote>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

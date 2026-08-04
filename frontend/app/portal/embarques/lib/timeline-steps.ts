// Step-by-step state of the shipment timeline. Pure and unit-tested
// (timeline-steps.test.ts) — the component that draws it stays presentational,
// which is the same split the Inteligência blocks use (logic in lib/, blocks
// render).
//
// Two independent inputs decide a step's status:
//
//   `estado`     — the real EmbarqueState the GE module stores. Drives the five
//                  operational steps (solicitado .. embarcado).
//   `milestone`  — the last milestone the carrier reported (ShipsGo), which is
//                  the ONLY thing that can advance the four post-departure
//                  steps. Without it they stay "pending" (no integration), or
//                  "blocked" when the carrier answered with INCOMPLETE.
//
// No date is ever derived here: the schema stores no transition log, so a step
// carries a status and never a timestamp.

import type { EmbarqueEstado, TrackingDataStatus, TrackingMilestone } from '@/types/portal-shipment';

export type StepStatus = 'done' | 'current' | 'upcoming' | 'pending' | 'blocked';

export interface TimelineStep {
  key: string;
  label: string;
  description: string;
  status: StepStatus;
  /** Chegada is the anchor for the customs-clearance tag (Camada 2). */
  isArrival?: boolean;
}

export interface DownstreamStep {
  key: string;
  label: string;
  description: string;
  /** ShipsGo milestone that marks this step as reached. */
  milestone: TrackingMilestone;
}

/**
 * The four post-departure stages, in carrier order. Gate-in and Vessel Loading
 * are absent because they already are the real states `coletado` / `embarcado`.
 */
export const DOWNSTREAM_STEPS: DownstreamStep[] = [
  {
    key: 'em_transito',
    label: 'Em trânsito',
    description: 'A carga segue em trânsito internacional até o destino.',
    milestone: 'OCEAN_TRANSIT',
  },
  {
    key: 'chegada',
    label: 'Chegada',
    description: 'Chegada ao porto ou aeroporto de destino.',
    milestone: 'ARRIVAL',
  },
  {
    key: 'descarregado',
    label: 'Descarregado',
    description: 'A carga foi descarregada do navio no porto de destino.',
    milestone: 'DISCHARGE',
  },
  {
    key: 'liberado',
    label: 'Liberado',
    description: 'Carga liberada para retirada no destino.',
    milestone: 'AVAILABLE',
  },
];

export interface TimelineInput {
  estado: EmbarqueEstado;
  /** Real operational steps, in order, with their labels/descriptions. */
  realSteps: { key: EmbarqueEstado; label: string; description: string }[];
  /** True for postergado / booking_divergente. */
  isException: boolean;
  dataStatus?: TrackingDataStatus | null;
  milestone?: TrackingMilestone | null;
}

export function buildTimelineSteps({
  estado,
  realSteps,
  isException,
  dataStatus,
  milestone,
}: TimelineInput): TimelineStep[] {
  const currentIndex = realSteps.findIndex((s) => s.key === estado);

  // An exception freezes the line: the stage that preceded it is not stored, so
  // marking anything done would be a guess presented as fact — and a milestone
  // reported before the exception cannot be trusted to still hold.
  const milestoneIndex =
    !isException && milestone
      ? DOWNSTREAM_STEPS.findIndex((d) => d.milestone === milestone)
      : -1;
  const hasMilestone = milestoneIndex >= 0;

  const real: TimelineStep[] = realSteps.map((step, index) => {
    let status: StepStatus;
    if (isException) {
      status = 'upcoming';
    } else if (index < currentIndex) {
      status = 'done';
    } else if (index === currentIndex) {
      // A reported milestone means the cargo is past the last operational state
      // the GE module tracks, so "Etapa atual" belongs on the milestone below.
      status = hasMilestone ? 'done' : 'current';
    } else {
      status = 'upcoming';
    }
    return { key: step.key, label: step.label, description: step.description, status };
  });

  const blocked = dataStatus === 'INCOMPLETE';
  const downstream: TimelineStep[] = DOWNSTREAM_STEPS.map((step, index) => {
    let status: StepStatus = blocked ? 'blocked' : 'pending';
    if (hasMilestone && index < milestoneIndex) status = 'done';
    else if (hasMilestone && index === milestoneIndex) status = 'current';
    return {
      key: step.key,
      label: step.label,
      description: step.description,
      status,
      isArrival: step.key === 'chegada',
    };
  });

  return [...real, ...downstream];
}

/** Key of the first step that is blocked, for the single INCOMPLETE notice. */
export function firstBlockedKey(steps: TimelineStep[]): string | null {
  return steps.find((s) => s.status === 'blocked')?.key ?? null;
}

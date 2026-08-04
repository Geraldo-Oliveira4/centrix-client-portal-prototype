// Delay risk for a shipment: how much later than originally promised the cargo
// is arriving. Pure, dependency-free and unit-tested (delay-risk.test.ts) —
// nothing here reads the network, the clock or the DOM, and nothing here
// fabricates a value.
//
// Formula (agreed with the ShipsGo integration spec):
//
//     delta_dias = ETA_atual (ou chegada real, se IsActual) - First_ETA
//
// The threshold is in ABSOLUTE DAYS, not a percentage of transit time: a 3-day
// slip is the same operational problem on a 12-day Montevideo run and on a
// 38-day Shanghai run, and a percentage would rank the long haul as healthier
// for the same delay.
//
// The two dates come from centrix_shipment_embarques.tracking_* (backend
// migration 091) and are NULL until the ShipsGo integration exists. That is the
// whole reason `pending` and `incomplete` are outcomes of this function rather
// than something the component decides: the caller must not be able to render a
// number when there is no data behind it.

import type { TrackingDataStatus } from '@/types/portal-shipment';

export type DelayRiskStatus =
  /** No carrier feed at all — the integration does not exist yet. */
  | 'pending'
  /** Integrated, but the carrier did not report enough for this shipment. */
  | 'incomplete'
  | 'on_time'
  | 'attention'
  | 'delayed';

export interface DelayRiskInput {
  /** First ETA the carrier ever reported (ISO 8601). */
  firstEta: string | null | undefined;
  /** Current ETA, or the actual arrival when `etaIsActual` is true (ISO 8601). */
  currentEta: string | null | undefined;
  /** ShipsGo IsActual: `currentEta` is a real arrival, not an estimate. */
  etaIsActual?: boolean | null;
  /** Carrier data sufficiency as reported by the source. */
  dataStatus?: TrackingDataStatus | null;
}

export interface DelayRisk {
  status: DelayRiskStatus;
  /** Whole days late (positive) or early (negative). Null unless computed. */
  deltaDays: number | null;
  /** Ready-to-render label; carries the exact number when there is one. */
  label: string;
  /** Whether the comparison used a real arrival or a still-moving estimate. */
  basis: 'actual' | 'estimated' | null;
}

/** Days of slip that are still "attention" rather than "delay". */
export const DELAY_ATTENTION_MAX_DAYS = 3;

/**
 * Shown wherever the source is integrated but reported too little. Distinct
 * from "Pendente integração", which means we have not integrated at all.
 */
export const INCOMPLETE_DATA_COPY =
  'A companhia marítima ainda não reportou dados suficientes para este embarque. Vamos atualizar assim que disponível.';

const DAY_MS = 86_400_000;

/**
 * Calendar days between two instants, ignoring time of day: ETAs are published
 * as a date, and comparing raw timestamps would turn a same-day 06:00 -> 20:00
 * revision into "half a day late" and round it into a delay.
 */
function utcDayDiff(from: Date, to: Date): number {
  const day = (d: Date) =>
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((day(to) - day(from)) / DAY_MS);
}

function parse(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Classify a shipment's delay risk. Never throws and never guesses: any missing
 * or unparseable date resolves to `pending` / `incomplete`, with `deltaDays`
 * null so the caller has no number to print.
 */
export function computeDelayRisk(input: DelayRiskInput): DelayRisk {
  const { dataStatus } = input;

  if (dataStatus === 'INCOMPLETE') {
    return {
      status: 'incomplete',
      deltaDays: null,
      label: 'Sem dado suficiente da companhia',
      basis: null,
    };
  }

  const first = parse(input.firstEta);
  const current = parse(input.currentEta);

  if (!first || !current) {
    // Which of the two "no number" outcomes applies depends on whether the
    // source answered at all: a COMPLETE status with a missing date is the
    // carrier's gap, not ours.
    return dataStatus === 'COMPLETE'
      ? {
          status: 'incomplete',
          deltaDays: null,
          label: 'Sem dado suficiente da companhia',
          basis: null,
        }
      : {
          status: 'pending',
          deltaDays: null,
          label: 'Pendente integração',
          basis: null,
        };
  }

  const deltaDays = utcDayDiff(first, current);
  const basis = input.etaIsActual === true ? 'actual' : 'estimated';

  if (deltaDays <= 0) {
    return { status: 'on_time', deltaDays, label: 'No prazo', basis };
  }
  if (deltaDays <= DELAY_ATTENTION_MAX_DAYS) {
    return {
      status: 'attention',
      deltaDays,
      label: `Atenção, +${deltaDays} ${deltaDays === 1 ? 'dia' : 'dias'}`,
      basis,
    };
  }
  return {
    status: 'delayed',
    deltaDays,
    label: `Atraso, +${deltaDays} dias`,
    basis,
  };
}

/** Convenience wrapper for the shape the portal payload delivers. */
export function delayRiskFromTracking(
  tracking:
    | {
        first_eta: string | null;
        current_eta: string | null;
        eta_is_actual: boolean | null;
        data_status: TrackingDataStatus | null;
      }
    | null
    | undefined,
): DelayRisk {
  return computeDelayRisk({
    firstEta: tracking?.first_eta,
    currentEta: tracking?.current_eta,
    etaIsActual: tracking?.eta_is_actual,
    dataStatus: tracking?.data_status,
  });
}

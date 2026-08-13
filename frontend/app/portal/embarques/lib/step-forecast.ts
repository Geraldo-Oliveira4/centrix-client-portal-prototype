// Forecast dates for the post-departure timeline steps the carrier has not
// reported yet. Pure and unit-tested (step-forecast.test.ts); the clock is an
// argument, never a call to `new Date()` inside the rule.
//
// Why this exists
// ---------------
// Mudança de propósito de 12/08/2026: onde a tela dizia "Pendente integração",
// ela passa a mostrar como vai se comportar quando o dado existir. The four
// downstream steps (Em trânsito -> Chegada -> Descarregado -> Liberado) only
// advance from `tracking.last_milestone`, and a shipment that has not reached
// `embarcado` has no milestone at all — so the whole lower half of its timeline
// was four grey "Pendente integração" badges.
//
// The rule, and the one thing that keeps it honest
// ------------------------------------------------
// Every date here is a DERIVATION of the ETA the same screen already shows
// (`tracking.current_eta`, the arrival at POD), never a second invented number.
// That is deliberate: the removed "Rastreamento marítimo" panel was deleted
// precisely because its own made-up ETA contradicted the ETA at the top of the
// same screen. Here `Chegada` IS the ETA, so the two cannot disagree, and with
// no ETA there is no forecast (the caller keeps its "Pendente integração").
//
//   Chegada       = ETA
//   Descarregado  = ETA + 2 dias   (nominal discharge window at the terminal)
//   Liberado      = ETA + 5 dias   (nominal release for pickup)
//   Em trânsito   = the departure, which is the only one the ETA cannot give on
//                   its own — a transit leg subtracted from the arrival would
//                   land in the PAST for a cargo still awaiting readiness. So it
//                   is derived forward from today by how much of the operational
//                   journey is left (DEPARTURE_LEAD_DAYS), and never allowed
//                   past the halfway point to the arrival.
//
// None of this marks a step as done: the caller keeps the circle empty. This
// module only supplies the text that replaces the badge.

import type { EmbarqueEstado } from '@/types/portal-shipment';

/** Keys of the four downstream steps, mirroring DOWNSTREAM_STEPS. */
export type DownstreamKey = 'em_transito' | 'chegada' | 'descarregado' | 'liberado';

/**
 * Days after the arrival ETA for the two stages that follow it. Nominal
 * terminal figures, not a carrier promise — the caller labels them "Previsto".
 */
export const POST_ARRIVAL_OFFSET_DAYS: Record<'descarregado' | 'liberado', number> = {
  descarregado: 2,
  liberado: 5,
};

/**
 * Nominal days still to run before the cargo departs, per operational state.
 * Decreasing as the shipment advances, which is what makes the forecast follow
 * the shipment instead of being one constant for the whole fleet.
 *
 * The two exception states are absent on purpose: with the line frozen we do not
 * know which stage preceded the exception, so there is no lead to apply and the
 * departure falls back to the midpoint rule below.
 */
export const DEPARTURE_LEAD_DAYS: Partial<Record<EmbarqueEstado, number>> = {
  solicitado: 12,
  aguardando_prontidao: 8,
  coletado: 4,
  analise_booking: 2,
  // Already departed: the carrier simply has not published OCEAN_TRANSIT yet.
  embarcado: 1,
};

const DAY_MS = 86_400_000;

/** Calendar days between two instants, ignoring time of day (as in delay-risk). */
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

function addDays(base: Date, days: number): string {
  return new Date(base.getTime() + days * DAY_MS).toISOString();
}

export interface StepForecastInput {
  estado: EmbarqueEstado;
  /** Current ETA at POD — the anchor. `first_eta` only backs it up. */
  currentEta: string | null | undefined;
  firstEta?: string | null;
  /** "Today". Injected so the rule stays pure and testable. */
  now: Date;
}

/**
 * Forecast date (ISO) per downstream step, for the steps the carrier has not
 * reported. Returns an EMPTY object when there is no ETA to derive from — the
 * caller must then keep whatever it shows for absent data, and must not invent
 * a date of its own.
 */
export function forecastDownstreamDates(
  input: StepForecastInput,
): Partial<Record<DownstreamKey, string>> {
  const arrival = parse(input.currentEta) ?? parse(input.firstEta);
  if (!arrival) return {};

  const arrivalInDays = utcDayDiff(input.now, arrival);
  const lead = DEPARTURE_LEAD_DAYS[input.estado];

  // Departure is always BEFORE the arrival, including when the arrival forecast
  // is already due or past (stale illustrative data): a forecast pair that
  // departs after it arrives would be a worse answer than the badge it replaced.
  const departureInDays =
    arrivalInDays >= 1
      ? Math.min(lead ?? Infinity, Math.floor(arrivalInDays / 2))
      : arrivalInDays - 1;

  return {
    em_transito: addDays(input.now, departureInDays),
    chegada: arrival.toISOString(),
    descarregado: addDays(arrival, POST_ARRIVAL_OFFSET_DAYS.descarregado),
    liberado: addDays(arrival, POST_ARRIVAL_OFFSET_DAYS.liberado),
  };
}

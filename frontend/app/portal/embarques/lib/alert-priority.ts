// Feed ordering for the shipment alerts. Pure and unit-tested
// (alert-priority.test.ts) — the tab that draws the feed stays presentational,
// the same split delay-risk.ts and timeline-steps.ts use.
//
// Split out of shipment-alerts.ts (which imports runtime values and therefore
// cannot run under `npm run test:unit`) so the one rule with a real ordering
// consequence is covered.

import type { AlertType, ShipmentAlert } from './shipment-alerts';

/**
 * Types that jump the queue while unread. Exactly one today, and the bar to add
 * a second is high: a priority type is a claim that the client loses money by
 * reading the feed in order. `demurrage` qualifies (storage accrues daily from
 * the release); "embarque confirmado" and "exceção detectada" do not — the
 * Freitas is already handling those and the client owes nothing.
 */
export const PRIORITY_ALERT_TYPES: readonly AlertType[] = ['demurrage'];

export const isPriorityType = (type: AlertType): boolean =>
  PRIORITY_ALERT_TYPES.includes(type);

/** Newest first. String compare is fine for ISO-8601 timestamps. */
export const compareByTimestampDesc = (
  a: Pick<ShipmentAlert, 'timestamp'>,
  b: Pick<ShipmentAlert, 'timestamp'>,
): number => (a.timestamp < b.timestamp ? 1 : -1);

/**
 * Feed order: unread priority alerts first, everything else chronological.
 *
 * Chronology is the right default for a notification list, but it buries the
 * one alert that costs money — a container released three weeks ago sorts below
 * today's routine "embarque confirmado". Once read, the alert falls back into
 * its chronological slot: the exception exists to make the client SEE it once,
 * not to pin it to the top forever.
 *
 * Relative order within each group is untouched, so two unread demurrage alerts
 * still read newest-first between themselves.
 */
export function sortAlertsForFeed(
  alerts: ShipmentAlert[],
  readIds: Set<string>,
): ShipmentAlert[] {
  const isUrgent = (a: ShipmentAlert) =>
    isPriorityType(a.type) && !readIds.has(a.id);
  return [
    ...alerts.filter(isUrgent).sort(compareByTimestampDesc),
    ...alerts.filter((a) => !isUrgent(a)).sort(compareByTimestampDesc),
  ];
}

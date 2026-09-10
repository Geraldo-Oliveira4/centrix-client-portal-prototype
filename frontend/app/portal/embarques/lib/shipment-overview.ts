import type { PortalShipment } from '../../../../types/portal-shipment.ts';
import type { HomeAction } from '../../home/lib/home-actions.ts';
import { delayRiskFromTracking } from './delay-risk.ts';
import { arrivalDay, shipmentToday } from './shipment-date.ts';

export type ShipmentOverviewKey = 'action' | 'delayed' | 'upcoming';

export const SHIPMENT_OVERVIEW_LABELS: Record<ShipmentOverviewKey, string> = {
  action: 'Precisam de você',
  delayed: 'Com chegada atrasada',
  upcoming: 'Chegam nos próximos 7 dias',
};

const DAY_MS = 86_400_000;

export function hasArrived(shipment: PortalShipment, now: Date): boolean {
  const tracking = shipment.tracking;
  const today = shipmentToday(now);
  const milestoneDate = arrivalDay(tracking?.last_milestone_at);
  if (
    ['ARRIVAL', 'DISCHARGE', 'AVAILABLE'].includes(
      tracking?.last_milestone ?? '',
    ) &&
    (milestoneDate == null || milestoneDate <= today)
  )
    return true;
  const eta = arrivalDay(tracking?.current_eta);
  // Some prototype payloads mark a future ETA as actual. A future event
  // cannot be presented as an arrival that already happened.
  return tracking?.eta_is_actual === true && eta != null && eta <= today;
}

export function buildShipmentOverview(
  shipments: PortalShipment[],
  actions: HomeAction[],
  now: Date,
) {
  const today = shipmentToday(now);
  const actionsByShipment = new Map<string, HomeAction[]>();
  for (const action of actions) {
    if (action.module !== 'embarque') continue;
    const current = actionsByShipment.get(action.recordId) ?? [];
    actionsByShipment.set(action.recordId, [...current, action]);
  }
  const groups: Record<ShipmentOverviewKey, Set<string>> = {
    action: new Set(),
    delayed: new Set(),
    upcoming: new Set(),
  };
  for (const shipment of shipments) {
    if (actionsByShipment.has(shipment.id)) groups.action.add(shipment.id);
    if (hasArrived(shipment, now)) continue;
    const tracking = shipment.tracking;
    const risk = delayRiskFromTracking(tracking);
    if (risk.deltaDays != null && risk.deltaDays > 0)
      groups.delayed.add(shipment.id);
    const eta = arrivalDay(tracking?.current_eta);
    // A rolling seven-calendar-day window includes today and the next six days.
    if (
      tracking?.data_status !== 'INCOMPLETE' &&
      eta != null &&
      eta >= today &&
      eta < today + 7 * DAY_MS
    )
      groups.upcoming.add(shipment.id);
  }
  return { groups, actionsByShipment };
}

/** Shared ordering for the list and its geographic view. */
export function compareShipmentOverview(
  a: PortalShipment,
  b: PortalShipment,
  groups: Record<ShipmentOverviewKey, Set<string>>,
  now: Date,
  metric: ShipmentOverviewKey | null = null,
): number {
  const eta = (s: PortalShipment) =>
    arrivalDay(s.tracking?.current_eta) ?? Infinity;
  if (metric === 'upcoming')
    return eta(a) - eta(b) || a.referencia.localeCompare(b.referencia);
  const priority = (s: PortalShipment) =>
    groups.action.has(s.id) ? 0 : groups.delayed.has(s.id) ? 1 : hasArrived(s, now) ? 3 : 2;
  return (
    priority(a) - priority(b) ||
    Number(b.carga_urgente) - Number(a.carga_urgente) ||
    eta(a) - eta(b) ||
    a.referencia.localeCompare(b.referencia)
  );
}

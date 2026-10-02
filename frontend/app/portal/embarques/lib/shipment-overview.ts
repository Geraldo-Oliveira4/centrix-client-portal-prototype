import type { PortalShipment } from '../../../../types/portal-shipment.ts';
import type { HomeAction } from '../../home/lib/home-actions.ts';
import { arrivalDay } from './shipment-date.ts';
import {
  buildShipmentIndicators,
  hasArrived,
  SHIPMENT_INDICATOR_LABELS,
  type ShipmentIndicatorKey,
} from './shipment-indicators.ts';

// Os grupos da lista e do Panorama SÃO os indicadores da fonte única
// (`shipment-indicators.ts`). Este módulo só acrescenta o índice de ações por
// embarque e a ordenação; nenhuma definição de indicador mora aqui.
export { hasArrived };
export type ShipmentOverviewKey = ShipmentIndicatorKey;
export const SHIPMENT_OVERVIEW_LABELS = SHIPMENT_INDICATOR_LABELS;

export function buildShipmentOverview(
  shipments: PortalShipment[],
  actions: HomeAction[],
  now: Date,
) {
  const actionsByShipment = new Map<string, HomeAction[]>();
  for (const action of actions) {
    if (action.module !== 'embarque') continue;
    const current = actionsByShipment.get(action.recordId) ?? [];
    actionsByShipment.set(action.recordId, [...current, action]);
  }
  const groups = buildShipmentIndicators(shipments, actions, now);
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

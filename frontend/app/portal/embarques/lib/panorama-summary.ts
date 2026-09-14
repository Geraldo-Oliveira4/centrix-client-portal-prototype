import type { PortalShipment } from '../../../../types/portal-shipment.ts';
import { arrivalDay, shipmentToday } from './shipment-date.ts';

export type PanoramaScope = 'active' | 'arrivals' | 'attention';

// Current portal states represent the open process. A tracking gate-out is
// not a business closure. Unknown/future terminal states are not counted here.
const OPEN_STATES = new Set(['solicitado', 'aguardando_prontidao', 'coletado', 'analise_booking', 'embarcado', 'postergado', 'booking_divergente']);

export function buildPanoramaSummary(shipments: PortalShipment[], now: Date) {
  const active = new Set<string>();
  const arrivals = new Set<string>();
  const attention = new Set<string>();
  const missingEta = new Set<string>();
  const today = shipmentToday(now);
  for (const shipment of shipments) {
    if (!OPEN_STATES.has(shipment.estado)) continue;
    active.add(shipment.id);
    // Structured exceptions are available; document requests, decision tasks
    // and their resolution are not projected by this endpoint. Coverage is partial.
    if (['postergado', 'booking_divergente'].includes(shipment.estado)) attention.add(shipment.id);
    const tracking = shipment.tracking;
    const arrived = ['ARRIVAL', 'DISCHARGE', 'AVAILABLE'].includes(tracking?.last_milestone ?? '');
    if (arrived || tracking?.eta_is_actual === true) continue;
    const eta = arrivalDay(tracking?.current_eta);
    if (tracking?.data_status !== 'COMPLETE' || tracking?.eta_is_actual !== false || eta == null) {
      missingEta.add(shipment.id);
      continue;
    }
    // Today through the next six calendar days, at the destination (not factory).
    if (eta >= today && eta < today + 7 * 86_400_000) arrivals.add(shipment.id);
  }
  return { active, arrivals, attention, missingEta, isDemo: shipments.some(s => s.tracking?.is_mock) };
}

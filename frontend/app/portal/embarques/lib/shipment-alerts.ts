// Illustrative notification feed for the shipment "Alertas" tab.
//
// PREVIEW, by design: there is no exception-detection engine and no ETA feed in
// this prototype (see backend/shared/portal_shipment_helpers.py — the payload
// carries only `estado`, no dates). So this module fabricates a plausible, stable
// alert stream deterministically from the shipments the client already owns. The
// whole tab wears the "Pré-visualização" badge; nothing here is a real push.
//
// The timestamps ARE real (created_at / updated_at of the shipment) — only the
// framing as "notifications" is illustrative, so we never invent a date.

import {
  ESTADO_DESCRIPTIONS,
  ESTADO_SEMAFORO,
  isExceptionState,
  type PortalShipment,
  type SemaforoTone,
} from '@/types/portal-shipment';

export type AlertType = 'confirmado' | 'eta' | 'excecao';

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  confirmado: 'Embarque confirmado',
  eta: 'Mudança de estimativa de chegada',
  excecao: 'Exceção detectada',
};

export const ALL_ALERT_TYPES: AlertType[] = ['confirmado', 'eta', 'excecao'];

export interface ShipmentAlert {
  id: string;
  type: AlertType;
  tone: SemaforoTone;
  shipmentId: string;
  referencia: string;
  title: string;
  description: string;
  // Real ISO timestamp from the shipment; the alert framing is illustrative.
  timestamp: string;
}

// Build the (illustrative) alert stream from the owned shipments. Deterministic:
// same shipments -> same alerts, stable ids so read-state persists.
export function buildShipmentAlerts(
  shipments: PortalShipment[],
): ShipmentAlert[] {
  const alerts: ShipmentAlert[] = [];

  shipments.forEach((s) => {
    const opened = s.created_at;
    const moved = s.updated_at ?? s.created_at;

    // 1. Every shipment was confirmed when it opened.
    alerts.push({
      id: `${s.id}:confirmado`,
      type: 'confirmado',
      tone: 'success',
      shipmentId: s.id,
      referencia: s.referencia,
      title: `Embarque ${s.referencia} confirmado`,
      description: ESTADO_DESCRIPTIONS.solicitado,
      timestamp: opened,
    });

    // 2. Shipments already in transit get an (illustrative) ETA-window update.
    //    No specific date is asserted — there is no ETA source.
    if (s.estado === 'embarcado' || s.estado === 'analise_booking') {
      alerts.push({
        id: `${s.id}:eta`,
        type: 'eta',
        tone: 'success',
        shipmentId: s.id,
        referencia: s.referencia,
        title: `Estimativa de chegada revista — ${s.referencia}`,
        description:
          'A janela estimada de chegada foi ajustada com base no andamento do embarque.',
        timestamp: moved,
      });
    }

    // 3. Exception states raise an alert, coloured by the same health semáforo.
    if (isExceptionState(s.estado)) {
      alerts.push({
        id: `${s.id}:excecao`,
        type: 'excecao',
        tone: ESTADO_SEMAFORO[s.estado],
        shipmentId: s.id,
        referencia: s.referencia,
        title: `Exceção detectada — ${s.referencia}`,
        description: ESTADO_DESCRIPTIONS[s.estado],
        timestamp: moved,
      });
    }
  });

  // Newest first. String compare is fine for ISO-8601 timestamps.
  return alerts.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

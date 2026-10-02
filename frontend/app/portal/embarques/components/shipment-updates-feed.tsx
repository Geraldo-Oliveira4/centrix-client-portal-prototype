'use client';

import { useMemo } from 'react';

import type { PortalShipment } from '@/types/portal-shipment';

import { useAlertTypePreferences } from '../../_shared/alert-type-preferences';
import { UpdatesFeed, type UpdateItem } from '../../_shared/updates-feed';
import {
  ALERT_TYPE_LABELS,
  buildShipmentAlerts,
  type ShipmentAlert,
} from '../lib/shipment-alerts';

// O feed "Atualizações" de Meus Embarques. A fonte é a mesma de sempre
// (`buildShipmentAlerts`, ilustrativa, com as preferências de tipo de
// Configurações); o que mudou em 02/10/2026 é a forma: a aba Alertas, que era
// uma segunda fila de tarefas, saiu, e o que sobrou é leitura.
function toUpdate(alert: ShipmentAlert): UpdateItem {
  return {
    id: alert.id,
    at: alert.timestamp,
    title: alert.title,
    context: ALERT_TYPE_LABELS[alert.type],
    href: alert.link.href,
    // Container liberado é custo correndo (Crítico na escala). Confirmação é
    // desfecho bom. O resto é informação, sem cor.
    tone:
      alert.type === 'demurrage'
        ? 'critical'
        : alert.type === 'confirmado'
          ? 'success'
          : 'neutral',
  };
}

export function ShipmentUpdatesFeed({
  shipments,
  max = 5,
}: {
  shipments: PortalShipment[];
  max?: number;
}) {
  const { enabledTypes } = useAlertTypePreferences();
  const items = useMemo(
    () =>
      buildShipmentAlerts(shipments)
        .filter((alert) => enabledTypes.has(alert.type))
        .map(toUpdate),
    [shipments, enabledTypes],
  );
  return (
    <UpdatesFeed
      items={items}
      max={max}
      preview
      description="O que mudou nos seus embarques. Só leitura: o que pede ação sua está em “Precisam de você”."
      emptyText="Nenhuma atualização nos tipos que você acompanha (Configurações)."
    />
  );
}

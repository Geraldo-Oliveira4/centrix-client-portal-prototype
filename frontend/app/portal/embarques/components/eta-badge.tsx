'use client';

import { cn } from '@/lib/utils';
import { formatShipmentEta } from '../lib/shipment-date';
import type { PortalShipmentTracking } from '@/types/portal-shipment';

import { IncompleteDataBadge } from '../../_shared/incomplete-data-badge';
import { ProvenanceBadge } from '../../_shared/provenance-badge';

/**
 * Arrival date badge, in the three states the carrier feed can be in:
 *
 *   real date              -> ShipsGo reported an ETA (or an actual arrival)
 *   "Pendente integração"  -> no feed yet (every shipment today)
 *   "Sem dado suficiente"  -> feed answered, carrier did not report enough
 *
 * The date is printed only when `current_eta` is actually there; the component
 * has no fallback that invents one. `eta_is_actual` promotes the label from
 * "chegada prevista" to a confirmed arrival, which is why it is shown in green
 * — that is the shipment's own health, not a data-quality statement.
 */
export function ShipmentEtaBadge({
  tracking,
  className,
}: {
  tracking: PortalShipmentTracking | null | undefined;
  className?: string;
}) {
  if (tracking?.current_eta) {
    const actual = tracking.eta_is_actual === true;
    return (
      <span
        className={cn(
          'portal-small inline-flex items-center rounded border px-2 py-0.5 font-medium',
          actual
            ? 'border-portal-success/25 bg-portal-success/10 text-portal-success'
            : 'border-border bg-muted text-foreground',
          className,
        )}
        title={actual ? 'Chegada confirmada pela companhia' : 'Previsão da companhia'}
      >
        {formatShipmentEta(tracking.current_eta)}
      </span>
    );
  }

  if (tracking?.data_status === 'INCOMPLETE') {
    return <IncompleteDataBadge className={className} />;
  }

  return <ProvenanceBadge provenance="pending" className={className} />;
}

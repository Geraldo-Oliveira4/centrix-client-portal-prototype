'use client';

import { Navigation } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatShortDate } from '@/lib/portal-formatters';
import type { PortalShipmentDetail } from '@/types/portal-shipment';

import { ProvenanceBadge } from '../../_shared/provenance-badge';
import { SectionHeading } from '../../_shared/page-header';
import { buildTracking } from '../lib/shipment-tracking';

/**
 * Maritime tracking panel — the structure a real carrier/tracking integration
 * (e.g. ShipsGo) would fill: vessel, voyage, MBL/booking, carrier, POL/POD,
 * transshipment, ETD/ETA. There is no such integration here, so the whole panel
 * carries the "Pré-visualização" seal and the values are illustrative
 * (deterministic per shipment). The one exception is the vessel name when the
 * Freitas note actually names one — that field is real and flagged "Dado real".
 *
 * Only rendered for maritime shipments: air freight would track by flight/MAWB,
 * a different shape, and this repo's demo data is all maritime.
 */
export function ShipmentTrackingPanel({
  shipment,
}: {
  shipment: PortalShipmentDetail;
}) {
  const t = buildTracking(shipment);

  return (
    <section className="space-y-4 rounded-xl border border-dashed border-border bg-muted/20 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionHeading
          title="Rastreamento marítimo"
          icon={<Navigation className="h-5 w-5" />}
        />
        <ProvenanceBadge provenance="preview" />
      </div>

      <p className="portal-small text-portal-neutral">
        Estrutura ilustrativa de como o Portal exibiria os dados de uma integração
        de rastreamento (ex.: ShipsGo). Não há integração ativa: os campos abaixo
        são estimados a partir do embarque, exceto o nome do navio quando informado
        pela Freitas.
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <TrackingField label="Navio" value={t.vessel.name} real={t.vessel.isReal} />
        <TrackingField label="Viagem" value={t.voyage} />
        <TrackingField label="Armador" value={t.carrier} />
        <TrackingField label="MBL / Booking" value={t.mbl} />
        <TrackingField label="POL — porto de origem" value={t.pol} />
        <TrackingField label="POD — porto de destino" value={t.pod} />
        <TrackingField label="Transbordo" value={t.transbordo ?? 'Sem transbordo (rota direta)'} />
        <TrackingField label="ETD — saída estimada" value={formatShortDate(t.etd)} />
        <TrackingField label="ETA — chegada estimada" value={formatShortDate(t.eta)} />
      </div>
    </section>
  );
}

/**
 * Real fields sit in `text-foreground` with a "Dado real" badge; illustrative
 * fields recede in `text-portal-neutral` — visual weight carries the provenance
 * so a real value never reads as mocked inside this preview-framed panel.
 */
function TrackingField({
  label,
  value,
  real = false,
}: {
  label: string;
  value: string;
  real?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="portal-small text-portal-neutral">{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        <p
          className={cn(
            'portal-body font-medium',
            real ? 'text-foreground' : 'text-portal-neutral',
          )}
        >
          {value}
        </p>
        {real ? <ProvenanceBadge provenance="real" /> : null}
      </div>
    </div>
  );
}

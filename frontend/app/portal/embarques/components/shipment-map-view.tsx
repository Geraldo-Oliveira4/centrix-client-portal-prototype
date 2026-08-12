'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Info } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useMyQuotations } from '@/hooks/use-portal-quotations';
import {
  SEMAFORO_DOT_CLASS,
  type PortalShipment,
  type SemaforoTone,
} from '@/types/portal-shipment';

import { MapEventsFeed } from './map-events-feed';
import { MapSummaryPanel } from './map-summary-panel';
import type { AlertType, ShipmentAlert } from '../lib/shipment-alerts';

// Leaflet touches `window` at import time, so the map cannot be server-rendered.
// This is the only place that knows that; every other component here is ordinary.
const ShipmentMap = dynamic(
  () => import('./shipment-map').then((m) => m.ShipmentMap),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full rounded-lg" />,
  },
);

const LEGEND: { tone: SemaforoTone; label: string }[] = [
  { tone: 'success', label: 'Em andamento' },
  { tone: 'warning', label: 'Atenção / atraso' },
  { tone: 'danger', label: 'Exceção' },
];

/**
 * Aba Mapa: resumo | mapa | eventos.
 *
 * A regra "mapa = visão geográfica dominante, sem filtro/busca/card solto"
 * continua valendo — as duas colunas laterais são leitura, nenhuma delas filtra
 * ou recorta o mapa. O mapa mantém a maior área em qualquer breakpoint.
 *
 * Abaixo de `xl` as três colunas empilham na ordem resumo -> mapa -> eventos,
 * que é o padrão do resto do portal (grid que colapsa, nunca painel virando
 * aba): a tela já vive dentro das abas Lista/Alertas/Mapa, e abas dentro de aba
 * seriam uma navegação que nenhuma outra tela usa.
 */
export function ShipmentMapView({
  shipments,
  alerts,
  readIds,
  enabledTypes,
  onSeeAllAlerts,
}: {
  shipments: PortalShipment[];
  alerts: ShipmentAlert[];
  readIds: Set<string>;
  enabledTypes: Set<AlertType>;
  onSeeAllAlerts: () => void;
}) {
  // O join com a cotação é o que dá a origem REAL de um embarque; sem ela o mapa
  // cai no hub ilustrativo (ver lib/port-coordinates.ts). Mesma chave SWR que a
  // aba Cotações usa, então isto é deduplicado, não um fetch novo.
  const { data } = useMyQuotations();

  // Memoizado: este objeto é dependência do `useMemo` que monta os marcadores e
  // do efeito que os anexa ao Leaflet. Recriado a cada render, ele fazia a
  // camada inteira ser destruída e remontada sem nada ter mudado.
  const originByShipmentId = useMemo(() => {
    const byId = new Map(
      Object.values(data?.buckets ?? {})
        .flat()
        .map((q) => [q.id, q.origin ?? null] as const),
    );
    return Object.fromEntries(
      shipments.map((s) => [
        s.id,
        s.quotation_id ? (byId.get(s.quotation_id) ?? null) : null,
      ]),
    ) as Record<string, string | null>;
  }, [data, shipments]);

  return (
    <div className="space-y-3">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,17rem)]">
        <MapSummaryPanel shipments={shipments} />

        <div className="h-[26rem] xl:h-[32rem]">
          <ShipmentMap
            shipments={shipments}
            originByShipmentId={originByShipmentId}
          />
        </div>

        <MapEventsFeed
          alerts={alerts}
          readIds={readIds}
          enabledTypes={enabledTypes}
          onSeeAll={onSeeAllAlerts}
        />
      </div>

      {/* Legenda do semáforo + a ressalva sobre o que o ponto significa. A
          ressalva mudou de conteúdo com o mapa real: a posição do PORTO agora é
          verdadeira, o que continua ilustrativo é tratá-la como posição da
          carga, porque não há AIS/ShipsGo mapPoint. Não remova. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {LEGEND.map(({ tone, label }) => (
            <span key={tone} className="inline-flex items-center gap-1.5">
              <span
                className={cn('h-2.5 w-2.5 rounded-full', SEMAFORO_DOT_CLASS[tone])}
              />
              <span className="portal-small text-portal-neutral">{label}</span>
            </span>
          ))}
        </div>
        <span className="inline-flex items-center gap-1.5 portal-small text-portal-neutral">
          <Info className="h-3.5 w-3.5" />
          Cada ponto marca o porto do embarque, não a posição do navio — o
          rastreamento da companhia ainda não está integrado.
        </span>
      </div>
    </div>
  );
}

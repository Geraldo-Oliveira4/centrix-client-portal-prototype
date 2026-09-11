'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import type { PortalQuotationsResponse } from '@/types/portal';
import type { PortalShipment } from '@/types/portal-shipment';

import { SectionHeading } from '../../_shared/page-header';
import { REAL_STEPS } from '../../embarques/lib/real-steps';
import { flattenQuotations } from '../../inteligencia/lib/intel-helpers';
import { computePriceRadar } from '../../inteligencia/lib/price-radar';
import {
  computeIllustrativeSavings,
  computeSavingsTrend,
} from '../../inteligencia/lib/illustrative-kpis';
import { collectHomeActions } from '../lib/home-actions';
import type { PortalHomeCard } from '../lib/home-layout';
import { PriceTrendCard } from './price-trend-card';
import { SavingsCard } from './savings-card';
import { UrgentActionCard } from './urgent-action-card';

/**
 * O REGISTRO: card -> componente.
 *
 * Contrato unico de props (`HomeCardProps`), e nenhum card busca dado sozinho.
 * A pagina faz as DUAS chamadas que o portal ja faz (`/portal/quotations` e
 * `/portal/shipments`) uma vez e passa o resultado para todos — ligar quatro
 * cards nao pode custar quatro vezes o mesmo fetch, e dois cards nao podem
 * discordar por terem lido payloads diferentes.
 *
 * NENHUM COMPONENTE REAPROVEITADO FOI EDITADO. `UrgentActionCard` e
 * `SavingsCard` ja eram componentes burros e entram como estao; `ShipmentMap` e
 * burro nas props mas toca `window` no import (Leaflet), e por isso ganha o
 * wrapper com `dynamic({ ssr: false })` abaixo; `PriceAlertBadge` e
 * `PriceTrendLine` entram inteiros dentro de `PriceTrendCard`.
 */

export interface HomeCardProps {
  shipments: PortalShipment[];
  quotations: PortalQuotationsResponse | undefined;
  /** UMA leitura de relogio por render, compartilhada por todos os cards. */
  now: Date;
}

// Leaflet toca `window` no import: o mapa nao pode ser renderizado no servidor.
// Este e o unico lugar da Home que sabe disso — mesmo arranjo de
// `embarques/components/shipment-map-view.tsx`.
const ShipmentMap = dynamic(
  () => import('../../embarques/components/shipment-map').then((m) => m.ShipmentMap),
  { ssr: false, loading: () => <Skeleton className="h-full w-full rounded-lg" /> },
);

function AcaoUrgenteCard({ shipments, quotations, now }: HomeCardProps) {
  const actions = useMemo(
    () =>
      collectHomeActions({
        shipments,
        buckets: quotations?.buckets ?? {},
        realSteps: REAL_STEPS,
        now,
      }),
    [shipments, quotations, now],
  );

  return (
    <section className="space-y-3">
      <SectionHeading title="Sua ação mais urgente" />
      <UrgentActionCard action={actions[0]} />
    </section>
  );
}

function MapaEmbarquesCard({ shipments, quotations }: HomeCardProps) {
  // O join com a cotacao e o que da a origem REAL de um embarque; sem ele o
  // mapa cai no hub ilustrativo. Memoizado porque este objeto e dependencia do
  // efeito que anexa os marcadores ao Leaflet — recriado a cada render, ele
  // destruiria e remontaria a camada inteira sem nada ter mudado.
  const originByShipmentId = useMemo(() => {
    const byId = new Map(
      flattenQuotations(quotations).map((q) => [q.id, q.origin ?? null] as const),
    );
    return Object.fromEntries(
      shipments.map((s) => [
        s.id,
        s.quotation_id ? (byId.get(s.quotation_id) ?? null) : null,
      ]),
    ) as Record<string, string | null>;
  }, [quotations, shipments]);

  return (
    <section className="space-y-3">
      <SectionHeading
        title="Mapa dos embarques"
        hint="cada marcador é o porto de origem, não a posição do navio"
      />
      {/* As cores dos marcadores sao as do semaforo (`ESTADO_SEMAFORO`), as
          mesmas do farol — o mapa nao tem paleta propria. */}
      <div className="h-[26rem] xl:h-[32rem]">
        <ShipmentMap
          shipments={shipments}
          originByShipmentId={originByShipmentId}
        />
      </div>
    </section>
  );
}

function EconomiaCard({ quotations, now }: HomeCardProps) {
  // Fonte UNICA de economia do portal (`inteligencia/lib/illustrative-kpis`), a
  // mesma que Performance e Executivo leem. Nao recalcule savings aqui.
  const flat = useMemo(() => flattenQuotations(quotations), [quotations]);
  const savings = useMemo(() => computeIllustrativeSavings(flat), [flat]);
  const trend = useMemo(() => computeSavingsTrend(flat, now), [flat, now]);

  return <SavingsCard savings={savings} trend={trend} />;
}

function TendenciaPrecoCard({ shipments, quotations }: HomeCardProps) {
  // Mesma funcao e mesmo `limit` padrao que a aba Radar roda. O corte para tres
  // rotas e do card, e ele o declara — ver `price-trend-card.tsx`.
  const routes = useMemo(
    () =>
      computePriceRadar({
        shipments,
        quotations: flattenQuotations(quotations),
      }),
    [shipments, quotations],
  );

  return <PriceTrendCard routes={routes} />;
}

/**
 * `Record<PortalHomeCard, ...>` e nao um objeto solto: acrescentar um valor a
 * `PortalHomeCard` sem dar um componente a ele quebra o BUILD, em vez de virar
 * um `undefined` no meio do `map` da tela.
 */
export const HOME_LAYOUT_CARD_COMPONENTS: Record<
  PortalHomeCard,
  ComponentType<HomeCardProps>
> = {
  acao_urgente: AcaoUrgenteCard,
  mapa_embarques: MapaEmbarquesCard,
  economia: EconomiaCard,
  tendencia_preco: TendenciaPrecoCard,
};

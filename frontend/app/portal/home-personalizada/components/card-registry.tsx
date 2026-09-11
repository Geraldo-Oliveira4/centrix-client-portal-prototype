'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import type { PortalQuotationsResponse } from '@/types/portal';
import type { PortalShipment } from '@/types/portal-shipment';

import { useAlertTypePreferences } from '../../_shared/alert-type-preferences';
import { SectionHeading } from '../../_shared/page-header';
import { ShipmentAlertsTab } from '../../embarques/components/shipment-alerts-tab';
import { buildPriceAlerts } from '../../embarques/lib/price-alerts';
import { buildShipmentAlerts } from '../../embarques/lib/shipment-alerts';
import { REAL_STEPS } from '../../embarques/lib/real-steps';
import { UrgentActionCard } from '../../home/components/urgent-action-card';
import { SavingsCard } from '../../home/components/savings-card';
import { collectHomeActions } from '../../home/lib/home-actions';
import { flattenQuotations } from '../../inteligencia/lib/intel-helpers';
import { computePriceRadar } from '../../inteligencia/lib/price-radar';
import {
  computeIllustrativeSavings,
  computeSavingsTrend,
} from '../../inteligencia/lib/illustrative-kpis';
import type { PortalHomeCard } from '../lib/home-layout';

/**
 * O REGISTRO: card -> componente.
 *
 * Contrato unico de props (`HomeCardProps`), e nenhum card busca dado sozinho.
 * A pagina faz as DUAS chamadas que o portal ja faz (`/portal/quotations` e
 * `/portal/shipments`) uma vez e passa o resultado para todos — ligar tres
 * cards nao pode custar tres vezes o mesmo fetch, e dois cards nao podem
 * discordar por terem lido payloads diferentes.
 *
 * OS CARDS ORIGINAIS NAO FORAM TOCADOS. `UrgentActionCard` e `SavingsCard` ja
 * eram componentes burros e entram como estao; `ShipmentMap` e burro nas props
 * mas toca `window` no import (Leaflet), e por isso ganha o wrapper com
 * `dynamic({ ssr: false })` abaixo; `ShipmentAlertsTab` e burro nas props mas
 * exige estado (lido / tipos ligados), que o wrapper fornece. Nenhuma edicao em
 * `app/portal/home/` — a Home real continua sendo o "voltar ao normal".
 */

export interface HomeCardProps {
  shipments: PortalShipment[];
  quotations: PortalQuotationsResponse | undefined;
  /** UMA leitura de relogio por render, compartilhada por todos os cards. */
  now: Date;
}

// Leaflet toca `window` no import: o mapa nao pode ser renderizado no servidor.
// Este e o unico lugar do experimento que sabe disso — mesmo arranjo de
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

// Mesma chave de "lidas" de Meus Embarques, de proposito: marcar uma
// notificacao como lida aqui e volta-la a aparecer nao-lida la seria o cliente
// vendo duas verdades sobre o mesmo aviso. A chave e privada daquela tela hoje
// (constante local), entao ela e repetida aqui — se um terceiro consumidor
// aparecer, extraia para `_shared` como foi feito com os tipos de alerta.
const READ_KEY = 'portal:shipment-alerts:read';

function AlertasEmbarqueCard({ shipments, quotations, now }: HomeCardProps) {
  // A MESMA lista da aba Alertas de Meus Embarques, os cinco tipos. Montar so os
  // de embarque aqui deixaria o switch "Oportunidade ou alta de preco" ligado e
  // sem nada para mostrar — um controle que nao controla nada le como
  // funcionalidade quebrada, e a preferencia de tipos e compartilhada com a
  // outra tela, entao nao da para esconder o switch so deste lado.
  const alerts = useMemo(
    () => [
      ...buildShipmentAlerts(shipments),
      ...buildPriceAlerts({
        routes: computePriceRadar({
          shipments,
          quotations: flattenQuotations(quotations),
        }),
        observedAt: now.toISOString(),
      }),
    ],
    [shipments, quotations, now],
  );

  const { enabledTypes, toggleType } = useAlertTypePreferences();

  // Semeado depois do mount, nunca no initial state: no servidor nao existe
  // localStorage, e ler ali daria hydration mismatch.
  const [readList, setReadList] = useState<string[]>([]);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(READ_KEY);
      if (stored) setReadList(JSON.parse(stored));
    } catch {
      // storage corrompido ou indisponivel — o padrao (nada lido) vale
    }
  }, []);

  const readIds = useMemo(() => new Set(readList), [readList]);

  const persist = (next: string[]) => {
    setReadList(next);
    try {
      localStorage.setItem(READ_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  return (
    <section className="portal-card p-6">
      <ShipmentAlertsTab
        alerts={alerts}
        readIds={readIds}
        enabledTypes={enabledTypes}
        onToggleType={toggleType}
        onMarkRead={(id) => {
          if (readIds.has(id)) return;
          persist([...readList, id]);
        }}
        onMarkAllRead={() =>
          persist(
            Array.from(
              new Set([
                ...readList,
                ...alerts.filter((a) => enabledTypes.has(a.type)).map((a) => a.id),
              ]),
            ),
          )
        }
      />
    </section>
  );
}

function MapaEmbarquesCard({ shipments, quotations }: HomeCardProps) {
  // O join com a cotacao e o que da a origem REAL de um embarque; sem ele o mapa
  // cai no hub ilustrativo. Memoizado porque este objeto e dependencia do efeito
  // que anexa os marcadores ao Leaflet — recriado a cada render, ele destruiria
  // e remontaria a camada inteira sem nada ter mudado.
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
  alertas_embarque: AlertasEmbarqueCard,
  mapa_embarques: MapaEmbarquesCard,
  economia: EconomiaCard,
};

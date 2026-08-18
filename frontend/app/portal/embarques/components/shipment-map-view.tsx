'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Info, MapPinOff } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useMyQuotations } from '@/hooks/use-portal-quotations';
import {
  SEMAFORO_DOT_CLASS,
  SEMAFORO_LABELS,
  type PortalShipment,
  type SemaforoTone,
} from '@/types/portal-shipment';

import { MapEventsFeed } from './map-events-feed';
import { MapSummaryPanel } from './map-summary-panel';
import { ShipmentFilterChips } from './shipment-filter-chips';
import type { AlertType, ShipmentAlert } from '../lib/shipment-alerts';
import {
  countShipmentFilters,
  filterShipments,
  type ShipmentFilterKey,
} from '../lib/shipment-filters';

// Leaflet touches `window` at import time, so the map cannot be server-rendered.
// This is the only place that knows that; every other component here is ordinary.
const ShipmentMap = dynamic(
  () => import('./shipment-map').then((m) => m.ShipmentMap),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full rounded-lg" />,
  },
);

// Legenda das cores dos marcadores. Os rótulos vêm de `SEMAFORO_LABELS`: a
// legenda explica o mesmo semáforo que o card "Visão do todo" conta, e o chip
// "Com atraso" logo acima mede outra coisa (ver a justificativa lá).
const LEGEND: SemaforoTone[] = ['success', 'warning', 'danger'];

/**
 * Os três recortes que o Mapa oferece, e por que não são os quatro da Lista.
 *
 * Victor Orsi, na revisão de 14/08/2026: o mapa "é mais visual do que
 * funcional" — mostra os treze embarques de uma vez e não deixa isolar o que
 * precisa de atenção. Os chips respondem a isso, e por isso o critério de
 * inclusão é "isto precisa de atenção?", não "isto é uma dimensão do embarque".
 *
 * "Embarcados" fica de FORA, divergindo da Lista de propósito: `embarcado` é o
 * estado da maioria da carteira, então o chip removeria pouca coisa do mapa —
 * seria um filtro que não filtra, contra um pedido que era exatamente sobre
 * remover poluição. Ele continua na Lista, onde o recorte por etapa do ciclo faz
 * sentido ao lado dos filtros de situação, origem e período.
 *
 * "Urgentes" fica DENTRO: urgência é bandeira do próprio cliente e mora na mesma
 * família de "olhe para isto agora" que atraso e exceção.
 */
const MAP_FILTER_KEYS: ShipmentFilterKey[] = ['atraso', 'excecao', 'urgentes'];

/**
 * Aba Mapa: resumo | mapa | eventos.
 *
 * A regra antiga "mapa = visão geográfica dominante, sem filtro/busca/card
 * solto" foi PARCIALMENTE levantada em 14/08/2026: o mapa passou a ter os chips
 * de filtro rápido (os mesmos da Lista, mesmo componente e mesmos predicados).
 * Busca e card solto continuam fora. O que o filtro faz, e o que ele não faz:
 *
 *   - recorta o MAPA e os EVENTOS, que respondem "o que está acontecendo com
 *     estes embarques"; o que não bate SOME do mapa, não fica esmaecido —
 *     esmaecer não remove poluição visual, só a repinta;
 *   - NÃO recorta o "Visão do todo", que responde "como está a operação". Ele é
 *     a saúde da carteira inteira, e mudá-lo com o filtro faria o cliente achar
 *     que embarques sumiram da contagem.
 *
 * O filtro é estado local e não persiste: o `TabsContent` do Radix desmonta a
 * aba inativa, então trocar de aba (ou recarregar) já devolve "Todos".
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

  const [filter, setFilter] = useState<ShipmentFilterKey | null>(null);

  // Contagem sempre sobre a carteira inteira, e chip zerado CONTINUA visível —
  // ao contrário da Lista. São três chips fixos: "Com exceção 0" é a resposta à
  // pergunta, não um controle quebrado, e é o único caminho até o estado vazio
  // amigável abaixo. Esconder o chip esconderia a boa notícia.
  const filterCounts = useMemo(
    () => countShipmentFilters(shipments, MAP_FILTER_KEYS),
    [shipments],
  );

  // Filtrar sem memo remontaria a camada de marcadores do Leaflet a cada render
  // (o array novo é dependência do efeito que a anexa).
  const visible = useMemo(
    () => filterShipments(shipments, filter),
    [shipments, filter],
  );

  // Os eventos seguem o mapa: o feed da direita descreve os embarques plotados,
  // e deixá-lo falando de um embarque que o filtro tirou da tela seria a mesma
  // contradição de duas respostas para a mesma pergunta.
  const visibleAlerts = useMemo(() => {
    if (!filter) return alerts;
    const ids = new Set(visible.map((s) => s.id));
    // Alerta sem embarque (o de preço, que é da rota) sai junto quando há
    // filtro: o feed passa a descrever os embarques plotados, e um aviso de
    // mercado no meio deles responderia a outra pergunta.
    return alerts.filter((a) => a.shipmentId != null && ids.has(a.shipmentId));
  }, [alerts, visible, filter]);

  const activeLabel = filterCounts.find((f) => f.key === filter)?.label ?? null;

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
      <ShipmentFilterChips
        filters={filterCounts}
        active={filter}
        total={shipments.length}
        onChange={setFilter}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,17rem)]">
        {/* Números GLOBAIS: o resumo é a saúde da carteira, e não acompanha o
            filtro. Ver o cabeçalho do arquivo. */}
        <MapSummaryPanel shipments={shipments} />

        <div className="h-[26rem] xl:h-[32rem]">
          {visible.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
              <MapPinOff className="h-6 w-6 text-portal-neutral" />
              <p className="portal-body font-medium text-foreground">
                {filter === 'excecao'
                  ? 'Nenhum embarque com exceção no momento — ótimo sinal.'
                  : filter === 'atraso'
                    ? 'Nenhum embarque com atraso no momento — ótimo sinal.'
                    : 'Nenhum embarque urgente no momento.'}
              </p>
              <button
                type="button"
                onClick={() => setFilter(null)}
                className="portal-small font-medium text-primary hover:underline"
              >
                Ver todos os {shipments.length} embarques
              </button>
            </div>
          ) : (
            <ShipmentMap
              shipments={visible}
              originByShipmentId={originByShipmentId}
            />
          )}
        </div>

        <MapEventsFeed
          alerts={visibleAlerts}
          readIds={readIds}
          enabledTypes={enabledTypes}
          onSeeAll={onSeeAllAlerts}
          filterLabel={activeLabel}
        />
      </div>

      {/* Legenda do semáforo + a ressalva sobre o que o ponto significa. A
          ressalva mudou de conteúdo com o mapa real: a posição do PORTO agora é
          verdadeira, o que continua ilustrativo é tratá-la como posição da
          carga, porque não há AIS/ShipsGo mapPoint. Não remova. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {LEGEND.map((tone) => (
            <span key={tone} className="inline-flex items-center gap-1.5">
              <span
                className={cn('h-2.5 w-2.5 rounded-full', SEMAFORO_DOT_CLASS[tone])}
              />
              <span className="portal-small text-portal-neutral">
                {SEMAFORO_LABELS[tone]}
              </span>
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

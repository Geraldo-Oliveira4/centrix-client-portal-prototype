'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Map as MapIcon, List, Bell, Plus } from 'lucide-react';
import { ErrorComponent, LoaderComponent } from '@arboria-tech/arboria-ui';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMyQuotations } from '@/hooks/use-portal-quotations';
import { useMyShipments } from '@/hooks/use-portal-shipments';

import { useAlertTypePreferences } from '../_shared/alert-type-preferences';
import { PagePortalHeader } from '../_shared/page-header';
import { flattenQuotations } from '../inteligencia/lib/intel-helpers';
import { computePriceRadar } from '../inteligencia/lib/price-radar';
import { ShipmentMapView } from './components/shipment-map-view';
import { ShipmentListTab } from './components/shipment-list-tab';
import { ShipmentAlertsTab } from './components/shipment-alerts-tab';
import { buildPriceAlerts } from './lib/price-alerts';
import { buildShipmentAlerts } from './lib/shipment-alerts';
import {
  SHIPMENT_FILTERS,
  type ShipmentFilterKey,
} from './lib/shipment-filters';

const READ_KEY = 'portal:shipment-alerts:read';

// Ordem = prioridade de uso, não de impacto visual. Lista primeiro (é a tela do
// dia a dia e por isso a aba padrão), Alertas em segundo (é o que exige ação),
// Mapa por último: ele ilustra bem, mas não responde nenhuma pergunta
// operacional que a Lista já não responda melhor.
const TABS = ['lista', 'alertas', 'mapa'] as const;
type ShipmentTab = (typeof TABS)[number];

const isShipmentTab = (value: string | null): value is ShipmentTab =>
  value != null && (TABS as readonly string[]).includes(value);

// Chaves válidas para `?filtro=`, derivadas de `SHIPMENT_FILTERS` em vez de
// digitadas aqui: um chip novo passa a ser deep-linkável sozinho, e um removido
// deixa de ser aceito sem ninguém precisar lembrar desta linha.
const isShipmentFilterKey = (value: string | null): value is ShipmentFilterKey =>
  value != null && SHIPMENT_FILTERS.some((f) => f.key === value);

function PortalEmbarquesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { shipments, isLoading, isError } = useMyShipments();

  // Deep link from the header's "Verificar embarque" shortcut. It used to point
  // at `#verificar`, an anchor that disappeared when this screen was rebuilt as
  // three tabs — clicking it navigated here and did nothing. It now selects the
  // Lista tab and expands its search field.
  const tabParam = searchParams.get('tab');
  const buscaParam = searchParams.get('busca');
  // `?filtro=` semeia o chip do Mapa. É o que faz "Ver no mapa" do farol da Home
  // chegar com o recorte JÁ aplicado em vez de despejar a carteira inteira e
  // pedir mais um clique. Valor desconhecido vira null — um filtro que ninguém
  // reconhece não pode esvaziar a tela, mesma regra de `filterShipments`.
  const filtroParam = searchParams.get('filtro');
  const initialMapFilter = isShipmentFilterKey(filtroParam) ? filtroParam : null;
  const [tab, setTab] = useState<ShipmentTab>(
    isShipmentTab(tabParam) ? tabParam : 'lista',
  );
  const [searchOpen, setSearchOpen] = useState(buscaParam === '1');

  useEffect(() => {
    if (isShipmentTab(tabParam)) setTab(tabParam);
    if (buscaParam !== '1') return;
    setSearchOpen(true);
    // Drop the flag so a second click on the shortcut is a real navigation and
    // re-opens the field even if the user closed it in the meantime.
    router.replace('/portal/embarques?tab=lista', { scroll: false });
  }, [tabParam, buscaParam, router]);

  // As cotações não são desta tela: elas entram porque o Radar de Preços resolve
  // a rota de um embarque pela cotação que o originou (`routePartsOf`), e é a
  // MESMA resolução que o Mapa e "Rotas com maiores desvios" usam. Sem elas, a
  // notificação de preço nomearia uma rota diferente da que o Radar mostra.
  const { data: quotationsData } = useMyQuotations();

  // Quando a leitura de preço foi feita. Fixado no mount: recalcular a cada
  // render mudaria o carimbo do alerta enquanto o cliente lê a lista. Ver a
  // justificativa da data em `lib/price-alerts.ts`.
  const observedAt = useMemo(() => new Date().toISOString(), []);

  const alerts = useMemo(() => {
    const routes = computePriceRadar({
      shipments,
      quotations: flattenQuotations(quotationsData),
    });
    // Uma lista só, para os dois consumidores (aba Alertas e feed do Mapa)
    // continuarem lendo a mesma coisa. A ordenação é de quem exibe
    // (`sortAlertsForFeed`), não daqui.
    return [
      ...buildShipmentAlerts(shipments),
      ...buildPriceAlerts({ routes, observedAt }),
    ];
  }, [shipments, quotationsData, observedAt]);

  // Quais tipos o cliente quer receber: mesma preferência editável em Minhas
  // Preferências > Notificações, por isso vem do módulo compartilhado e não de
  // um estado local (ver `_shared/alert-type-preferences.ts`).
  const { enabledTypes, toggleType } = useAlertTypePreferences();

  // O que já foi lido é local desta tela — não é configuração de conta.
  // Semeado do localStorage após o mount para evitar hydration mismatch.
  const [readList, setReadList] = useState<string[]>([]);

  useEffect(() => {
    try {
      const r = localStorage.getItem(READ_KEY);
      if (r) setReadList(JSON.parse(r));
    } catch {
      // ignore corrupt/unavailable storage — defaults stand
    }
  }, []);

  const readIds = useMemo(() => new Set(readList), [readList]);

  const persistRead = (next: string[]) => {
    setReadList(next);
    try {
      localStorage.setItem(READ_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const handleMarkRead = (id: string) => {
    if (readIds.has(id)) return;
    persistRead([...readList, id]);
  };

  const handleMarkAllRead = () => {
    const visibleIds = alerts
      .filter((a) => enabledTypes.has(a.type))
      .map((a) => a.id);
    persistRead(Array.from(new Set([...readList, ...visibleIds])));
  };

  const unreadCount = alerts.filter(
    (a) => enabledTypes.has(a.type) && !readIds.has(a.id),
  ).length;

  if (isError) return <ErrorComponent />;

  const subtitle = isLoading
    ? undefined
    : shipments.length === 0
      ? 'Nenhum embarque em andamento.'
      : `${shipments.length} ${
          shipments.length === 1
            ? 'embarque em acompanhamento'
            : 'embarques em acompanhamento'
        }.`;

  return (
    <div className="space-y-9">
      <PagePortalHeader title="Meus Embarques" subtitle={subtitle} />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : shipments.length === 0 ? (
        <div className="space-y-4 rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center">
          <div className="space-y-1">
            <p className="portal-h3">
              Você ainda não tem embarques ativos
            </p>
            <p className="portal-small text-portal-neutral">
              Eles aparecem aqui assim que uma cotação aprovada é fechada pela
              Freitas.
            </p>
          </div>
          <Button asChild>
            <Link href="/portal/nova-cotacao">
              <Plus className="mr-2 h-5 w-5" />
              Criar cotação
            </Link>
          </Button>
        </div>
      ) : (
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as ShipmentTab)}
          className="space-y-6"
        >
          <TabsList>
            <TabsTrigger value="lista" className="gap-1.5 data-[state=active]:border-brand-indigo-800">
              <List className="h-4 w-4" />
              Lista
            </TabsTrigger>
            <TabsTrigger value="alertas" className="gap-1.5 data-[state=active]:border-brand-indigo-800">
              <Bell className="h-4 w-4" />
              Alertas
              {unreadCount > 0 && (
                <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                  {unreadCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="mapa" className="gap-1.5 data-[state=active]:border-brand-indigo-800">
              <MapIcon className="h-4 w-4" />
              Mapa
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lista">
            <ShipmentListTab
              shipments={shipments}
              quotations={flattenQuotations(quotationsData)}
              isLoading={false}
              searchOpen={searchOpen}
              onSearchOpenChange={setSearchOpen}
            />
          </TabsContent>

          <TabsContent value="alertas">
            <ShipmentAlertsTab
              alerts={alerts}
              readIds={readIds}
              enabledTypes={enabledTypes}
              onToggleType={toggleType}
              onMarkRead={handleMarkRead}
              onMarkAllRead={handleMarkAllRead}
            />
          </TabsContent>

          {/* Mapa — geografia real (Leaflet + OSM) em 3 colunas: resumo | mapa |
              eventos. As laterais são leitura agregada, nenhuma delas filtra o
              mapa: a regra "sem filtro/busca/card solto" segue valendo. O feed
              da direita é o MESMO dado da aba Alertas, incluindo as preferências
              de tipo e o que já foi lido. */}
          <TabsContent value="mapa">
            <ShipmentMapView
              shipments={shipments}
              alerts={alerts}
              readIds={readIds}
              enabledTypes={enabledTypes}
              onSeeAllAlerts={() => setTab('alertas')}
              initialFilter={initialMapFilter}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

export default function PortalEmbarquesPage() {
  // useSearchParams (the ?tab=lista&busca=1 deep link from the header) needs a
  // Suspense boundary for the static prerender of this route.
  return (
    <Suspense fallback={<LoaderComponent />}>
      <PortalEmbarquesContent />
    </Suspense>
  );
}

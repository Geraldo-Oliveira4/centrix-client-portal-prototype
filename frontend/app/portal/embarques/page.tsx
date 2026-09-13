'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Map as MapIcon, List, Bell, Plus } from 'lucide-react';
import { ErrorComponent, LoaderComponent } from '@arboria-tech/arboria-ui';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMyQuotations } from '@/hooks/use-portal-quotations';
import { useMyShipments } from '@/hooks/use-portal-shipments';

import { PagePortalHeader } from '../_shared/page-header';
import { flattenQuotations } from '../inteligencia/lib/intel-helpers';

import { ShipmentMapWorkspace } from './components/shipment-map-workspace';
import { ShipmentAlertsPreview } from './components/shipment-alerts-preview';
import { ShipmentListTab } from './components/shipment-list-tab';

import {
  SHIPMENT_FILTERS,
  type ShipmentFilterKey,
} from './lib/shipment-filters';

// Navegação do panorama da carteira ao detalhe e às ocorrências.
const TABS = ['mapa', 'lista', 'alertas'] as const;
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
    isShipmentTab(tabParam) ? tabParam : 'mapa',
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

  // The existing shipment list uses its originating quotation context.
  const { data: quotationsData } = useMyQuotations();

  if (isError && tab !== 'alertas') return <ErrorComponent />;

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

      {isLoading && tab !== 'alertas' ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : shipments.length === 0 && tab !== 'alertas' ? (
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
          onValueChange={(v) => { setTab(v as ShipmentTab); router.replace(`/portal/embarques?tab=${v}`, { scroll: false }); }}
          className="space-y-6"
        >
          <TabsList>
            <TabsTrigger value="mapa" className="gap-1.5 data-[state=active]:border-brand-indigo-800">
              <MapIcon className="h-4 w-4" />
              Panorama
            </TabsTrigger>
            <TabsTrigger value="lista" className="gap-1.5 data-[state=active]:border-brand-indigo-800">
              <List className="h-4 w-4" />
              Embarques
            </TabsTrigger>
            <TabsTrigger value="alertas" className="gap-1.5 data-[state=active]:border-brand-indigo-800">
              <Bell className="h-4 w-4" />
              Alertas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="space-y-4">
            <p className="portal-small text-portal-neutral">
              Compare seus embarques e veja quais precisam de atenção primeiro.
            </p>
            <ShipmentListTab
              shipments={shipments}
              quotations={flattenQuotations(quotationsData)}
              isLoading={false}
              searchOpen={searchOpen}
              onSearchOpenChange={setSearchOpen}
            />
          </TabsContent>

          <TabsContent value="alertas" className="space-y-4">
            <ShipmentAlertsPreview />
          </TabsContent>

          {/* Mapa amplo, resumo contextual e a mesma carteira priorizada. */}
          <TabsContent value="mapa" className="space-y-4">
            <p className="portal-small text-portal-neutral">
              Selecione uma origem no mapa ou um embarque na lista para ver um resumo.
            </p>
            <ShipmentMapWorkspace
              shipments={shipments}
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

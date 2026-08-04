'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Map as MapIcon, List, Bell, Plus } from 'lucide-react';
import { ErrorComponent, LoaderComponent } from '@arboria-tech/arboria-ui';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMyShipments } from '@/hooks/use-portal-shipments';

import { PagePortalHeader } from '../_shared/page-header';
import { ShipmentWorldMap } from './components/shipment-world-map';
import { ShipmentListTab } from './components/shipment-list-tab';
import { ShipmentAlertsTab } from './components/shipment-alerts-tab';
import {
  ALL_ALERT_TYPES,
  buildShipmentAlerts,
  type AlertType,
} from './lib/shipment-alerts';

const READ_KEY = 'portal:shipment-alerts:read';
// Versioned on purpose. A preference list stored before "Risco de
// demurrage/detention" existed names only the first three types, and restoring
// it verbatim would leave the new type OFF for every returning client — the one
// type with a direct financial cost, silently disabled by a storage artefact.
// Bumping the key drops those stale lists so the default (all four on) applies
// once; from then on the client's own choice persists. Bump again if a future
// type must not inherit an old opt-out.
const TYPES_KEY = 'portal:shipment-alerts:types:v2';

const TABS = ['mapa', 'lista', 'alertas'] as const;
type ShipmentTab = (typeof TABS)[number];

const isShipmentTab = (value: string | null): value is ShipmentTab =>
  value != null && (TABS as readonly string[]).includes(value);

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

  const alerts = useMemo(() => buildShipmentAlerts(shipments), [shipments]);

  // Read-state and alert-type preferences are client-side only (no backend feed):
  // seeded from localStorage after mount to avoid a hydration mismatch. Every
  // type starts enabled, including `demurrage` (see TYPES_KEY above).
  const [readList, setReadList] = useState<string[]>([]);
  const [enabledList, setEnabledList] = useState<AlertType[]>(ALL_ALERT_TYPES);

  useEffect(() => {
    try {
      const r = localStorage.getItem(READ_KEY);
      if (r) setReadList(JSON.parse(r));
      const t = localStorage.getItem(TYPES_KEY);
      if (t) setEnabledList(JSON.parse(t));
    } catch {
      // ignore corrupt/unavailable storage — defaults stand
    }
  }, []);

  const readIds = useMemo(() => new Set(readList), [readList]);
  const enabledTypes = useMemo(() => new Set(enabledList), [enabledList]);

  const persistRead = (next: string[]) => {
    setReadList(next);
    try {
      localStorage.setItem(READ_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const persistTypes = (next: AlertType[]) => {
    setEnabledList(next);
    try {
      localStorage.setItem(TYPES_KEY, JSON.stringify(next));
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

  const handleToggleType = (type: AlertType) => {
    persistTypes(
      enabledTypes.has(type)
        ? enabledList.filter((t) => t !== type)
        : [...enabledList, type],
    );
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
    <div className="space-y-8">
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
            <p className="portal-h3 text-foreground">
              Você ainda não tem embarques ativos
            </p>
            <p className="portal-small text-portal-neutral">
              Eles aparecem aqui assim que uma cotação aprovada é fechada pela
              Freitas.
            </p>
          </div>
          <Button asChild>
            <Link href="/portal/nova-cotacao">
              <Plus className="mr-2 h-4 w-4" />
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
            <TabsTrigger value="mapa" className="gap-1.5">
              <MapIcon className="h-4 w-4" />
              Mapa
            </TabsTrigger>
            <TabsTrigger value="lista" className="gap-1.5">
              <List className="h-4 w-4" />
              Lista
            </TabsTrigger>
            <TabsTrigger value="alertas" className="gap-1.5">
              <Bell className="h-4 w-4" />
              Alertas
              {unreadCount > 0 && (
                <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                  {unreadCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Mapa — só o mapa mundi e a legenda, nada mais (sem cards/contador/busca). */}
          <TabsContent value="mapa">
            <section className="portal-card p-6">
              <ShipmentWorldMap shipments={shipments} />
            </section>
          </TabsContent>

          <TabsContent value="lista">
            <ShipmentListTab
              shipments={shipments}
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
              onToggleType={handleToggleType}
              onMarkRead={handleMarkRead}
              onMarkAllRead={handleMarkAllRead}
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

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Map as MapIcon, List, Bell, Plus } from 'lucide-react';
import { ErrorComponent } from '@arboria-tech/arboria-ui';

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
const TYPES_KEY = 'portal:shipment-alerts:types';

export default function PortalEmbarquesPage() {
  const { shipments, isLoading, isError } = useMyShipments();

  const alerts = useMemo(() => buildShipmentAlerts(shipments), [shipments]);

  // Read-state and alert-type preferences are client-side only (no backend feed):
  // seeded from localStorage after mount to avoid a hydration mismatch.
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
        <Tabs defaultValue="mapa" className="space-y-6">
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
            <ShipmentListTab shipments={shipments} isLoading={false} />
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

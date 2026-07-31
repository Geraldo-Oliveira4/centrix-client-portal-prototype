'use client';

import { Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { History, KanbanSquare } from 'lucide-react';
import { LoaderComponent, ErrorComponent, EmptyState } from '@arboria-tech/arboria-ui';

import { useMyQuotations } from '@/hooks/use-portal-quotations';
import { Button } from '@/components/ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { PagePortalHeader } from '../_shared/page-header';
import { FunnelTab } from './components/funnel-tab';
import { HistoryTab } from './components/history-tab';

function PortalCotacoesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, isLoading, isError } = useMyQuotations();

  // Closed quotations: "finalizadas" holds approved (FECHADA) and declined,
  // "cancelada" the cancelled ones. All three are read-only history.
  const closed = useMemo(
    () => [...(data?.buckets.finalizadas ?? []), ...(data?.buckets.cancelada ?? [])],
    [data],
  );

  if (isLoading) return <LoaderComponent />;
  if (isError || !data) return <ErrorComponent />;

  const defaultTab = searchParams.get('tab') === 'historico' ? 'historico' : 'funil';

  return (
    <div className="space-y-8">
      <PagePortalHeader
        title="Minhas Cotações"
        action={
          <Button onClick={() => router.push('/portal/nova-cotacao')}>
            Solicitar nova cotação
          </Button>
        }
      />

      {data.total === 0 ? (
        <EmptyState message="Nenhuma cotação. Quando a Freitas registrar uma cotação para sua empresa, ela aparecerá aqui." />
      ) : (
        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="funil" className="gap-1.5">
              <KanbanSquare className="h-4 w-4" />
              Funil
            </TabsTrigger>
            <TabsTrigger value="historico" className="gap-1.5">
              <History className="h-4 w-4" />
              Histórico
              {closed.length > 0 && (
                <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[10px] font-medium text-portal-neutral">
                  {closed.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="funil">
            <FunnelTab data={data} />
          </TabsContent>

          <TabsContent value="historico">
            <HistoryTab quotations={closed} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

export default function PortalCotacoesPage() {
  // useSearchParams (the ?tab=historico deep link from Auditoria) needs a
  // Suspense boundary for the static prerender of this route.
  return (
    <Suspense fallback={<LoaderComponent />}>
      <PortalCotacoesContent />
    </Suspense>
  );
}

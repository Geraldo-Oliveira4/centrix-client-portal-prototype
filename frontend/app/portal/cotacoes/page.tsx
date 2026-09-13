'use client';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { History, KanbanSquare } from 'lucide-react';
import { LoaderComponent, ErrorComponent } from '@arboria-tech/arboria-ui';
import { useMyQuotations, useMyClient } from '@/hooks/use-portal-quotations';
import { Button } from '@/components/ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PagePortalHeader } from '../_shared/page-header';
import { FunnelTab } from './components/funnel-tab';
import { HistoryTab } from './components/history-tab';
import { useLocalRequests } from './lib/local-requests';

function PortalCotacoesContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { data, isLoading, isError } = useMyQuotations();
  const { client } = useMyClient();
  const local = useLocalRequests(client?.id);
  if (isLoading) return <LoaderComponent />;
  if (isError || !data) return <ErrorComponent />;
  const closed = [...data.buckets.finalizadas, ...data.buckets.cancelada];
  const tab = ['historico', 'fechadas', 'negadas'].includes(
    params.get('tab') || '',
  )
    ? 'historico'
    : 'funil';
  const changeTab = (value: string) => {
    const next = new URLSearchParams(params.toString());
    next.set('tab', value);
    router.push(`/portal/cotacoes?${next}`, { scroll: false });
  };
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
      <Tabs value={tab} onValueChange={changeTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="funil" className="gap-2">
            <KanbanSquare className="h-4 w-4" />
            Em andamento
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2">
            <History className="h-4 w-4" />
            Histórico{' '}
            <span className="portal-small text-portal-neutral">
              {closed.length}
            </span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="funil">
          {local.error && (
            <p
              role="alert"
              className="mb-4 portal-small text-portal-warning-ink"
            >
              {local.error}
            </p>
          )}
          <FunnelTab data={data} localRequests={local.rows} />
        </TabsContent>
        <TabsContent value="historico">
          <HistoryTab quotations={closed} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
export default function PortalCotacoesPage() {
  return (
    <Suspense fallback={<LoaderComponent />}>
      <PortalCotacoesContent />
    </Suspense>
  );
}

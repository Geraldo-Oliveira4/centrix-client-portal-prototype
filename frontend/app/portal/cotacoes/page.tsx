'use client';

import { Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, History, KanbanSquare, XCircle } from 'lucide-react';
import { LoaderComponent, ErrorComponent, EmptyState } from '@arboria-tech/arboria-ui';

import { useMyQuotations } from '@/hooks/use-portal-quotations';
import { Button } from '@/components/ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isApproved } from '@/lib/portal-state';

import { PagePortalHeader } from '../_shared/page-header';
import { FunnelTab } from './components/funnel-tab';
import { HistoryTab, type HistoryOutcome } from './components/history-tab';

// Aprovadas e Reprovadas são RECORTES do Histórico, não telas novas: mesmo
// componente de lista, mesma expansão de conferência, só o escopo muda. O
// Histórico continua mostrando as três situações juntas — as abas focadas são
// atalho, não substituição.
const APPROVED_OUTCOMES: HistoryOutcome[] = ['FECHADA'];
const REFUSED_OUTCOMES: HistoryOutcome[] = ['DECLINADA', 'CANCELADO'];

// Deep links aceitos em ?tab=. "historico" já era usado pela Auditoria.
const TABS = ['funil', 'historico', 'fechadas', 'negadas'] as const;
type CotacoesTab = (typeof TABS)[number];

const isCotacoesTab = (value: string | null): value is CotacoesTab =>
  value != null && (TABS as readonly string[]).includes(value);

function TabCount({ value }: { value: number }) {
  if (value === 0) return null;
  return (
    <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[10px] font-medium text-portal-neutral">
      {value}
    </span>
  );
}

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

  const approvedCount = useMemo(
    () => closed.filter((q) => isApproved(q.state)).length,
    [closed],
  );
  const refusedCount = closed.length - approvedCount;

  if (isLoading) return <LoaderComponent />;
  if (isError || !data) return <ErrorComponent />;

  const tabParam = searchParams.get('tab');
  const defaultTab: CotacoesTab = isCotacoesTab(tabParam) ? tabParam : 'funil';

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
            <TabsTrigger value="funil" className="gap-1.5 data-[state=active]:border-brand-indigo-800">
              <KanbanSquare className="h-4 w-4" />
              Funil
            </TabsTrigger>
            <TabsTrigger value="historico" className="gap-1.5 data-[state=active]:border-brand-indigo-800">
              <History className="h-4 w-4" />
              Histórico
              <TabCount value={closed.length} />
            </TabsTrigger>
            <TabsTrigger value="fechadas" className="gap-1.5 data-[state=active]:border-brand-indigo-800">
              <CheckCircle2 className="h-4 w-4" />
              Aprovadas
              <TabCount value={approvedCount} />
            </TabsTrigger>
            <TabsTrigger value="negadas" className="gap-1.5 data-[state=active]:border-brand-indigo-800">
              <XCircle className="h-4 w-4" />
              Reprovadas
              <TabCount value={refusedCount} />
            </TabsTrigger>
          </TabsList>

          <TabsContent value="funil">
            <FunnelTab data={data} />
          </TabsContent>

          <TabsContent value="historico">
            <HistoryTab quotations={closed} />
          </TabsContent>

          <TabsContent value="fechadas">
            <HistoryTab
              quotations={closed}
              outcomes={APPROVED_OUTCOMES}
              countLabel={{ singular: 'cotação aprovada', plural: 'cotações aprovadas' }}
              emptyHint="Cotações que você aprovou aparecem aqui, com a conferência de dados do fechamento."
            />
          </TabsContent>

          <TabsContent value="negadas">
            <HistoryTab
              quotations={closed}
              outcomes={REFUSED_OUTCOMES}
              countLabel={{ singular: 'cotação reprovada', plural: 'cotações reprovadas' }}
              emptyHint="Cotações que você reprovou e cotações canceladas aparecem aqui."
            />
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

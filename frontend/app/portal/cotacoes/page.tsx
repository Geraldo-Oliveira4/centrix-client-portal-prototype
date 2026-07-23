'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { LoaderComponent, ErrorComponent, EmptyState } from '@arboria-tech/arboria-ui';

import { useMyQuotations } from '@/hooks/use-portal-quotations';
import { Button } from '@/components/ui';
import type { PortalBucketKey } from '@/types/portal';

import { PagePortalHeader, SectionHeading } from '../_shared/page-header';
import { Bucket } from './components/bucket';
import { KanbanColumn } from './components/kanban-column';
import { KpiCards } from './components/kpi-cards';
import { SummaryCards } from './components/summary-cards';
import {
  PortalFilters,
  applyPortalFilters,
  type PortalFilterValues,
} from './components/portal-filters';

const EMPTY_FILTERS: PortalFilterValues = {
  exporter: '',
  route: '',
  agent: '',
  modal: '',
  pais_procedencia: '',
  peso_taxado_min: '',
};

export default function PortalCotacoesPage() {
  const router = useRouter();
  const { data, isLoading, isError } = useMyQuotations();
  const [filters, setFilters] = useState<PortalFilterValues>(EMPTY_FILTERS);
  // Cancelled quotations are hidden by default; the client opts into the column
  // via the toggle, mirroring "Mostrar cancelados" in the analyst kanban.
  const [showCancelled, setShowCancelled] = useState(false);

  if (isLoading) return <LoaderComponent />;
  if (isError || !data) return <ErrorComponent />;

  // bucket_order holds the 3 active kanban columns. "finalizadas" is rendered
  // as a 4th column; "cancelada" stays as a collapsible section below.
  const allBucketKeys: PortalBucketKey[] = [
    ...data.bucket_order,
    'finalizadas',
    'cancelada',
  ];

  const cancelledCount = data.buckets.cancelada?.length ?? 0;

  const totalAcrossBuckets = allBucketKeys.reduce(
    (sum, key) => sum + (data.buckets[key]?.length ?? 0),
    0,
  );

  // KPI counts derived from the same buckets the kanban renders. "finalizadas"
  // holds both closed (approved) and declined quotations; the closed ones are
  // FECHADA. Cancelled quotations live in their own bucket and count in neither.
  const finalizadas = data.buckets.finalizadas ?? [];
  const approvedCount = finalizadas.filter((q) => q.state === 'FECHADA').length;
  const declinedCount = finalizadas.length - approvedCount;

  const filteredBuckets = Object.fromEntries(
    allBucketKeys.map((key) => [
      key,
      applyPortalFilters(data.buckets[key] ?? [], filters),
    ]),
  ) as typeof data.buckets;

  const filteredTotal = allBucketKeys.reduce(
    (sum, key) => sum + (filteredBuckets[key]?.length ?? 0),
    0,
  );

  return (
    <div className="space-y-8">
      <PagePortalHeader
        title="Minhas Cotações"
        subtitle={
          totalAcrossBuckets === 0
            ? 'Nenhuma cotação encontrada.'
            : `${totalAcrossBuckets} ${totalAcrossBuckets === 1 ? 'cotação' : 'cotações'} no total.`
        }
        action={
          <Button onClick={() => router.push('/portal/nova-cotacao')}>
            Solicitar nova cotação
          </Button>
        }
      />

      {totalAcrossBuckets === 0 ? (
        <EmptyState message="Nenhuma cotação. Quando a Freitas registrar uma cotação para sua empresa, ela aparecerá aqui." />
      ) : (
        <>
          {/* Indicators: a self-contained overview block, visually distinct from
              the funnel below. The KPI card is the pulse of the account (counts
              only); the SummaryCards are the priority shortlists to act on. */}
          <section className="space-y-4">
            <div className="portal-card space-y-4 p-6">
              <SectionHeading title="Indicadores" />
              <KpiCards
                total={totalAcrossBuckets}
                awaitingProposals={data.buckets.buscando_propostas?.length ?? 0}
                awaitingApproval={data.buckets.aguardando_aprovacao?.length ?? 0}
                approved={approvedCount}
                declined={declinedCount}
              />
            </div>

            <SummaryCards
              awaitingApproval={data.buckets.aguardando_aprovacao ?? []}
              awaitingProposals={data.buckets.buscando_propostas ?? []}
            />
          </section>

          {/* Funnel: the kanban, unchanged, now under its own section heading so
              it reads as separate from the indicators above. */}
          <section className="space-y-4">
            <SectionHeading title="Funil de Cotações" />

            <PortalFilters values={filters} onChange={setFilters} />

            {filteredTotal === 0 ? (
              <EmptyState message="Nenhuma cotação corresponde aos filtros aplicados." />
            ) : (
              <div className="space-y-6">
                <div className="flex gap-4 overflow-x-auto pb-4">
                  {data.bucket_order.map((bucket) => (
                    <KanbanColumn
                      key={bucket}
                      bucket={bucket}
                      quotations={filteredBuckets[bucket] ?? []}
                    />
                  ))}
                  <KanbanColumn
                    key="finalizadas-aprovadas"
                    bucket="finalizadas"
                    quotations={(filteredBuckets.finalizadas ?? []).filter((q) => q.state === 'FECHADA')}
                    label="Aprovadas"
                    accentColor="border-t-portal-success"
                  />
                  <KanbanColumn
                    key="finalizadas-recusadas"
                    bucket="finalizadas"
                    quotations={(filteredBuckets.finalizadas ?? []).filter((q) => q.state !== 'FECHADA')}
                    label="Recusadas"
                    accentColor="border-t-portal-danger"
                  />
                </div>
                {cancelledCount > 0 ? (
                  <Bucket
                    bucket="cancelada"
                    quotations={filteredBuckets.cancelada ?? []}
                  />
                ) : null}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { LoaderComponent, ErrorComponent, EmptyState } from '@arboria-tech/arboria-ui';

import { useMyQuotations } from '@/hooks/use-portal-quotations';
import { Button } from '@/components/ui';
import type { PortalBucketKey } from '@/types/portal';

import { Bucket } from './components/bucket';
import { KanbanColumn } from './components/kanban-column';
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Minhas Cotações</h1>
          <p className="text-sm text-muted-foreground">
            {totalAcrossBuckets === 0
              ? 'Nenhuma cotação encontrada.'
              : `${totalAcrossBuckets} ${totalAcrossBuckets === 1 ? 'cotação' : 'cotações'} no total.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => router.push('/portal/nova-cotacao')}>
            Solicitar nova cotação
          </Button>
        </div>
      </div>

      {totalAcrossBuckets === 0 ? (
        <EmptyState message="Nenhuma cotação. Quando a Freitas registrar uma cotação para sua empresa, ela aparecerá aqui." />
      ) : (
        <>
          <SummaryCards
            awaitingApproval={data.buckets.aguardando_aprovacao ?? []}
            awaitingProposals={data.buckets.buscando_propostas ?? []}
          />

          <PortalFilters values={filters} onChange={setFilters} />

          {filteredTotal === 0 ? (
            <EmptyState message="Nenhuma cotação corresponde aos filtros aplicados." />
          ) : (
            <div className="space-y-8">
              <div className="flex gap-3 overflow-x-auto pb-4">
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
                  accentColor="border-t-emerald-500"
                />
                <KanbanColumn
                  key="finalizadas-recusadas"
                  bucket="finalizadas"
                  quotations={(filteredBuckets.finalizadas ?? []).filter((q) => q.state !== 'FECHADA')}
                  label="Recusadas"
                  accentColor="border-t-rose-500"
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
        </>
      )}
    </div>
  );
}

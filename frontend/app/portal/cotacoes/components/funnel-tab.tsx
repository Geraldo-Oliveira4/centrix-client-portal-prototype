'use client';

import { useMemo, useState } from 'react';
import { EmptyState } from '@arboria-tech/arboria-ui';

import {
  PORTAL_CLIENT_ACTION_BUCKETS,
  type PortalBucketKey,
  type PortalQuotationsResponse,
} from '@/types/portal';

import { PortalSearchInput } from '../../_shared/portal-search-input';
import { KanbanColumn } from './kanban-column';
import {
  EMPTY_PORTAL_FILTERS,
  PortalFiltersMenu,
  applyPortalFilters,
  type PortalFilterValues,
} from './portal-filters';

/**
 * Funil — the active quotations only. Closed ones (aprovadas, recusadas,
 * canceladas) live in the Histórico tab, so the funnel reads as work in flight.
 *
 * There is exactly ONE headline number here: how many quotations are waiting on
 * the client. Everything else is secondary text. The previous screen repeated
 * the same counts three times (five equal KPI tiles, two shortlist cards, then
 * the kanban columns); the columns already carry the per-stage counts, so the
 * duplicates are gone.
 */
export function FunnelTab({ data }: { data: PortalQuotationsResponse }) {
  const [filters, setFilters] = useState<PortalFilterValues>(EMPTY_PORTAL_FILTERS);

  // "Preencher detalhes" is only shown when Freitas actually asked the client
  // for something — an empty column would read as a permanent pending task.
  const activeBuckets = useMemo(
    () =>
      data.bucket_order.filter(
        (bucket) =>
          bucket !== 'aguardando_dados' || (data.buckets.aguardando_dados?.length ?? 0) > 0,
      ),
    [data],
  );

  const countOf = (bucket: PortalBucketKey) => data.buckets[bucket]?.length ?? 0;

  const needsAction = PORTAL_CLIENT_ACTION_BUCKETS.reduce(
    (sum, bucket) => sum + countOf(bucket),
    0,
  );
  const activeCount = data.bucket_order.reduce((sum, bucket) => sum + countOf(bucket), 0);

  const filteredBuckets = useMemo(
    () =>
      Object.fromEntries(
        activeBuckets.map((bucket) => [
          bucket,
          applyPortalFilters(data.buckets[bucket] ?? [], filters),
        ]),
      ) as Record<PortalBucketKey, ReturnType<typeof applyPortalFilters>>,
    [activeBuckets, data, filters],
  );

  const filteredTotal = activeBuckets.reduce(
    (sum, bucket) => sum + (filteredBuckets[bucket]?.length ?? 0),
    0,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-3xl font-semibold leading-none text-foreground">
            {needsAction}
          </p>
          <p className="portal-body font-medium text-foreground">
            {needsAction === 1
              ? 'cotação aguardando sua ação'
              : 'cotações aguardando sua ação'}
          </p>
          <p className="portal-small text-portal-neutral">
            {data.total} no total · {activeCount}{' '}
            {activeCount === 1 ? 'ativa' : 'ativas'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <PortalSearchInput
            value={filters.query}
            onChange={(query) => setFilters((prev) => ({ ...prev, query }))}
            placeholder="Referência, PO ou produto…"
            label="Buscar cotação por referência, PO do cliente ou produto"
          />
          <PortalFiltersMenu values={filters} onChange={setFilters} />
        </div>
      </div>

      {activeCount === 0 ? (
        <EmptyState message="Nenhuma cotação em andamento. As cotações fechadas ficam na aba Histórico." />
      ) : filteredTotal === 0 ? (
        <EmptyState message="Nenhuma cotação corresponde à busca ou aos filtros aplicados." />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {activeBuckets.map((bucket) => (
            <KanbanColumn
              key={bucket}
              bucket={bucket}
              quotations={filteredBuckets[bucket] ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}

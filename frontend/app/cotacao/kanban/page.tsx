'use client';

import { useState, useCallback, useEffect } from 'react';
import { PageTitle } from '@arboria-tech/arboria-ui';
import { LoaderComponent } from '@arboria-tech/arboria-ui';
import { ErrorComponent } from '@arboria-tech/arboria-ui';
import { useQuotationKanban } from '@/hooks/use-quotations';
import type { QuotationState } from '@/types/quotation';
import { QuotationTransitionModal } from '@/app/cotacao/components/quotation-transition-modal';
import { KanbanBoard } from './components/kanban-board';
import { KanbanFilters } from './components/kanban-filters';
import {
  INITIAL_KANBAN_FILTERS,
  type FilterChip,
  type KanbanFilterState,
  type ModalFilter,
} from './constants';

function useKanbanFilters() {
  const [filters, setFilters] = useState<KanbanFilterState>(INITIAL_KANBAN_FILTERS);

  const setFilter = useCallback(<K extends keyof KanbanFilterState>(key: K, value: KanbanFilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Modal change resets tipoEmbarqueFilter to avoid stale FCL/LCL selection.
  const setModalFilter = useCallback((v: ModalFilter) => {
    setFilters((prev) => ({ ...prev, modalFilter: v, tipoEmbarqueFilter: 'TODOS' }));
  }, []);

  const toggleChip = useCallback((chip: FilterChip) => {
    setFilters((prev) => {
      const next = new Set(prev.activeChips);
      next.has(chip) ? next.delete(chip) : next.add(chip);
      return { ...prev, activeChips: next };
    });
  }, []);

  return { filters, setFilter, setModalFilter, toggleChip };
}

export default function KanbanPage() {
  const { board, isLoading, isError, mutate, isValidating } = useQuotationKanban();
  const { filters, setFilter, setModalFilter, toggleChip } = useKanbanFilters();
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [transitionModal, setTransitionModal] = useState<{
    quotationId: string;
    targetState: QuotationState;
  } | null>(null);

  useEffect(() => {
    if (board) setLastRefreshed(new Date());
  }, [board]);

  const handleTransitionRequest = useCallback(
    (quotationId: string, targetState: QuotationState) => {
      setTransitionModal({ quotationId, targetState });
    },
    [],
  );

  const handleRefresh = useCallback(() => { mutate(); }, [mutate]);

  if (isLoading) return <LoaderComponent />;
  if (isError) return <ErrorComponent />;

  return (
    <div className="space-y-4">
      <PageTitle title="Kanban de Cotacoes" />

      <KanbanFilters
        filters={filters}
        onFilterChange={setFilter}
        onModalFilterChange={setModalFilter}
        onToggleChip={toggleChip}
        refresh={{
          lastRefreshed,
          isRefreshing: isValidating ?? false,
          onRefresh: handleRefresh,
        }}
      />

      {board && (
        <KanbanBoard
          board={board}
          mutate={mutate}
          filters={filters}
          onTransitionRequest={handleTransitionRequest}
        />
      )}

      {transitionModal && (
        <QuotationTransitionModal
          open
          onOpenChange={(open) => { if (!open) setTransitionModal(null); }}
          quotationId={transitionModal.quotationId}
          targetState={transitionModal.targetState}
          onSuccess={() => mutate()}
        />
      )}
    </div>
  );
}

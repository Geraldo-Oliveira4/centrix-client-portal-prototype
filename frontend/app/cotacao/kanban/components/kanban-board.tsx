'use client';

import { useCallback, useMemo } from 'react';
import { isBefore, addDays } from 'date-fns';
import type {
  KanbanCard as KanbanCardType,
  KanbanColumnKey,
  QuotationKanban,
  QuotationState,
} from '@/types/quotation';
import { STATES_REQUIRING_MODAL } from '@/types/quotation';
import { transitionQuotation } from '@/hooks/use-quotations';
import {
  KANBAN_COLUMNS,
  STATE_TO_COLUMN,
  isWithinReceptionRange,
  type KanbanFilterState,
} from '../constants';
import { KanbanColumn } from './kanban-column';
import type { KeyedMutator } from 'swr';

interface KanbanBoardProps {
  board: QuotationKanban;
  mutate: KeyedMutator<QuotationKanban>;
  filters: KanbanFilterState;
  onTransitionRequest: (quotationId: string, targetState: QuotationState) => void;
}

export function KanbanBoard({
  board,
  mutate,
  filters,
  onTransitionRequest,
}: KanbanBoardProps) {
  const getFilteredItems = useCallback(
    (items: KanbanCardType[]): KanbanCardType[] => {
      const {
        search,
        activeChips,
        sort,
        modalFilter,
        tipoEmbarqueFilter,
        portalApprovedFilter,
        guardRailActiveFilter,
        produtoFilter,
        rotaFilter,
        agenteFilter,
        exportadorFilter,
        paisProcedenciaFilter,
        pesoTaxadoMin,
        periodoInicio,
        periodoFim,
      } = filters;

      let filtered = items;

      if (search.trim()) {
        const q = search.toLowerCase();
        filtered = filtered.filter(
          (c) =>
            c.reference?.toLowerCase().includes(q) ||
            c.client_reference?.toLowerCase().includes(q) ||
            c.client?.name?.toLowerCase().includes(q) ||
            c.origin?.toLowerCase().includes(q) ||
            c.porto_destino?.some((p) => p.toLowerCase().includes(q)) ||
            c.aeroporto_destino?.some((p) => p.toLowerCase().includes(q)),
        );
      }

      if (activeChips.has('URGENTES')) {
        filtered = filtered.filter((c) => (c.priority_score ?? 0) >= 80);
      }
      if (activeChips.has('CRITICO')) {
        filtered = filtered.filter((c) => c.client?.is_vip === true);
      }
      if (activeChips.has('SLA_CRITICO')) {
        const twoFromNow = addDays(new Date(), 2);
        filtered = filtered.filter(
          (c) => c.desired_deadline && isBefore(new Date(c.desired_deadline), twoFromNow),
        );
      }

      if (modalFilter !== 'TODOS') {
        filtered = filtered.filter((c) => c.modal === modalFilter);
      }

      if (modalFilter === 'MARITIMO' && tipoEmbarqueFilter !== 'TODOS') {
        filtered = filtered.filter((c) => c.tipo_embarque === tipoEmbarqueFilter);
      }

      if (portalApprovedFilter) {
        filtered = filtered.filter((c) => c.portal_approved === true);
      }

      if (guardRailActiveFilter) {
        filtered = filtered.filter((c) => c.guard_rail_active === true);
      }

      if (produtoFilter.trim()) {
        const q = produtoFilter.toLowerCase();
        filtered = filtered.filter(
          (c) =>
            c.product?.toLowerCase().includes(q) ||
            c.ncm?.toLowerCase().includes(q),
        );
      }

      if (rotaFilter.trim()) {
        const q = rotaFilter.toLowerCase();
        filtered = filtered.filter(
          (c) =>
            c.origin?.toLowerCase().includes(q) ||
            c.porto_embarque?.toLowerCase().includes(q) ||
            c.porto_destino?.some((p) => p.toLowerCase().includes(q)) ||
            c.aeroporto_embarque?.toLowerCase().includes(q) ||
            c.aeroporto_destino?.some((p) => p.toLowerCase().includes(q)),
        );
      }

      if (agenteFilter) {
        filtered = filtered.filter((c) => c.rfq_agent_ids?.includes(agenteFilter));
      }

      if (exportadorFilter.trim()) {
        const q = exportadorFilter.toLowerCase();
        filtered = filtered.filter((c) => c.exportador?.toLowerCase().includes(q));
      }

      if (paisProcedenciaFilter.trim()) {
        const q = paisProcedenciaFilter.toLowerCase();
        filtered = filtered.filter((c) => c.pais_procedencia?.toLowerCase().includes(q));
      }

      if (pesoTaxadoMin.trim()) {
        const min = parseFloat(pesoTaxadoMin);
        if (!isNaN(min)) {
          filtered = filtered.filter((c) => c.peso_taxado != null && c.peso_taxado >= min);
        }
      }

      if (periodoInicio || periodoFim) {
        filtered = filtered.filter((c) =>
          isWithinReceptionRange(c.created_at, periodoInicio, periodoFim),
        );
      }

      return [...filtered].sort((a, b) => {
        switch (sort) {
          case 'urgency':
            return (b.priority_score ?? 0) - (a.priority_score ?? 0);
          case 'date':
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          case 'sla': {
            const aDeadline = a.desired_deadline ? new Date(a.desired_deadline).getTime() : Infinity;
            const bDeadline = b.desired_deadline ? new Date(b.desired_deadline).getTime() : Infinity;
            return aDeadline - bDeadline;
          }
          default:
            return 0;
        }
      });
    },
    [filters],
  );

  const handleMenuTransition = useCallback(
    async (cardId: string, targetState: QuotationState) => {
      let sourceColumn: KanbanColumnKey | null = null;
      let card: KanbanCardType | null = null;
      for (const col of KANBAN_COLUMNS) {
        const found = board[col].items.find((c) => c.id === cardId);
        if (found) {
          sourceColumn = col;
          card = found;
          break;
        }
      }

      if (STATES_REQUIRING_MODAL.includes(targetState)) {
        if (targetState === 'FECHADA' && card?.state === 'APROVADA_PELO_CLIENTE') {
          // No extra payload needed — fall through to direct optimistic transition
        } else {
          onTransitionRequest(cardId, targetState);
          return;
        }
      }

      if (!sourceColumn || !card) return;

      const targetColumn = STATE_TO_COLUMN[targetState];

      const optimisticBoard = structuredClone(board);
      const sourceItems = optimisticBoard[sourceColumn].items;
      const cardIndex = sourceItems.findIndex((c) => c.id === cardId);
      if (cardIndex !== -1) {
        sourceItems.splice(cardIndex, 1);
      }

      const updatedCard = { ...card, state: targetState };
      optimisticBoard[targetColumn].items.unshift(updatedCard);

      mutate(optimisticBoard, false);

      const success = await transitionQuotation(cardId, { target_state: targetState });
      if (!success) {
        mutate();
      }
    },
    [board, mutate, onTransitionRequest],
  );

  const visibleColumns = useMemo(
    () => (filters.showCancelled ? KANBAN_COLUMNS : KANBAN_COLUMNS.filter((k) => k !== 'CANCELADO')),
    [filters.showCancelled],
  );

  const columns = useMemo(
    () =>
      visibleColumns.map((key) => {
        const items = getFilteredItems(board[key]?.items ?? []);
        return { key, items, count: items.length };
      }),
    [board, visibleColumns, getFilteredItems],
  );

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {columns.map((col) => (
        <KanbanColumn
          key={col.key}
          columnKey={col.key}
          items={col.items}
          count={col.count}
          onTransition={handleMenuTransition}
        />
      ))}
    </div>
  );
}

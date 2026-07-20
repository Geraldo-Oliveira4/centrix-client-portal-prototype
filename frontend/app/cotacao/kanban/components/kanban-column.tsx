'use client';

import { KanbanColumnShell } from '@/components/kanban-column-shell';
import type { KanbanCard as KanbanCardType, KanbanColumnKey, QuotationState } from '@/types/quotation';
import { COLUMN_CONFIG } from '../constants';
import { KanbanCard } from './kanban-card';

interface KanbanColumnProps {
  columnKey: KanbanColumnKey;
  items: KanbanCardType[];
  count: number;
  onTransition: (cardId: string, targetState: QuotationState) => void;
}

export function KanbanColumn({ columnKey, items, count, onTransition }: KanbanColumnProps) {
  const config = COLUMN_CONFIG[columnKey];

  return (
    <KanbanColumnShell
      label={config.label}
      headerColor={config.headerColor}
      headerBg={config.headerBg}
      darkHeaderBg={config.darkHeaderBg}
      count={count}
      emptyLabel="Nenhuma cotacao"
    >
      {items.map((card) => (
        <KanbanCard key={card.id} card={card} columnKey={columnKey} onTransition={onTransition} />
      ))}
    </KanbanColumnShell>
  );
}

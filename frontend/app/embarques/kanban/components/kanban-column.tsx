'use client';

import { KanbanColumnShell } from '@/components/kanban-column-shell';
import type { EmbarqueEstado, ShipmentKanbanItem } from '@/types/shipment';
import { COLUMN_CONFIG } from '../constants';
import { KanbanCard } from './kanban-card';

interface KanbanColumnProps {
  columnKey: EmbarqueEstado;
  items: ShipmentKanbanItem[];
  count: number;
}

export function KanbanColumn({ columnKey, items, count }: KanbanColumnProps) {
  const config = COLUMN_CONFIG[columnKey];

  return (
    <KanbanColumnShell
      label={config.label}
      headerColor={config.headerColor}
      headerBg={config.headerBg}
      darkHeaderBg={config.darkHeaderBg}
      count={count}
      isEmpty={items.length === 0}
      emptyLabel="Nenhum embarque"
    >
      {items.map((card) => (
        <KanbanCard key={card.id} card={card} />
      ))}
    </KanbanColumnShell>
  );
}

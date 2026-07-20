'use client';

import { useMemo } from 'react';
import type { ShipmentKanban } from '@/types/shipment';
import { EMBARQUE_COLUMNS } from '../constants';
import { KanbanColumn } from './kanban-column';

interface KanbanBoardProps {
  board: ShipmentKanban;
}

// All filtering (search, modal, urgent) is applied server-side via the SWR key
// (GET /shipments/kanban), so the board renders the columns as returned and the
// header counts already reflect the active filters.
export function KanbanBoard({ board }: KanbanBoardProps) {
  const columns = useMemo(
    () =>
      EMBARQUE_COLUMNS.map((key) => {
        const items = board[key]?.items ?? [];
        return { key, items, count: items.length };
      }),
    [board],
  );

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {columns.map((col) => (
        <KanbanColumn
          key={col.key}
          columnKey={col.key}
          items={col.items}
          count={col.count}
        />
      ))}
    </div>
  );
}

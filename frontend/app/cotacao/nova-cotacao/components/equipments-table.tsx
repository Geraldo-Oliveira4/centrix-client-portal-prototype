'use client';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { LineItemsTable, LineItemsTableRow } from '@arboria-tech/arboria-ui';
import { Button } from '@/components/ui';
import type { PesoUnidade, TipoContainer } from '@/types/quotation';
import { TIPO_CONTAINER_LABELS } from '@/types/quotation';

export interface EquipmentTableItem {
  quantity: number;
  tipo_container: TipoContainer;
  volume_m3?: number | null;
  peso_bruto?: number | null;
  peso_unidade?: PesoUnidade | null;
}

interface EquipmentsTableProps {
  equipments: EquipmentTableItem[];
  onAdd?: () => void;
  onEdit?: (index: number) => void;
  onDelete?: (index: number) => void;
}

export function EquipmentsTable({ equipments, onAdd, onEdit, onDelete }: EquipmentsTableProps) {
  const canEdit = !!(onAdd || onEdit || onDelete);
  const colTemplate = canEdit ? 'grid-cols-[40px_1fr_60px_80px_64px]' : 'grid-cols-4';

  return (
    <LineItemsTable
      title="Equipamentos (FCL)"
      headers={canEdit ? ['Qtd', 'Equipamento', 'm³', 'Peso', ''] : ['Qtd', 'Equipamento', 'm³', 'Peso']}
      colTemplate={colTemplate}
      action={
        onAdd ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={onAdd}
          >
            <Plus className="h-3 w-3 mr-1" />
            Adicionar
          </Button>
        ) : undefined
      }
    >
      {equipments.map((eq, i) => (
        <LineItemsTableRow key={i} colTemplate={colTemplate} className="items-center">
          <span>{eq.quantity}</span>
          <span className="truncate">
            {TIPO_CONTAINER_LABELS[eq.tipo_container] ?? eq.tipo_container}
          </span>
          <span>{eq.volume_m3 ?? '—'}</span>
          <span>
            {eq.peso_bruto != null ? `${eq.peso_bruto} ${eq.peso_unidade ?? 'KG'}` : '—'}
          </span>
          {canEdit && (
            <span className="flex items-center justify-end gap-1">
              {onEdit && (
                <button
                  type="button"
                  className="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => onEdit(i)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  className="flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                  onClick={() => onDelete(i)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </span>
          )}
        </LineItemsTableRow>
      ))}
    </LineItemsTable>
  );
}

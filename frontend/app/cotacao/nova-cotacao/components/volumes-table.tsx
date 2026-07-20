'use client';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { LineItemsTable, LineItemsTableRow } from '@arboria-tech/arboria-ui';
import { Button } from '@/components/ui';
import type { DimensaoUnidade, PesoUnidade, QuotationModal, TipoEmbalagem } from '@/types/quotation';
import { TIPO_EMBALAGEM_LABELS } from '@/types/quotation';
import { formatPesoByUnit, summarizeVolumes } from '@/utils/quotation-fields';

export interface VolumeTableItem {
  quantity: number;
  embalagem?: TipoEmbalagem | null;
  peso_bruto?: number | null;
  peso_unidade?: PesoUnidade | null;
  comprimento?: number | null;
  largura?: number | null;
  altura?: number | null;
  dimensao_unidade?: DimensaoUnidade | null;
  volume_m3?: number | null;
}

interface VolumesTableProps {
  volumes: VolumeTableItem[];
  modal?: QuotationModal;
  onAdd?: () => void;
  onEdit?: (index: number) => void;
  onDelete?: (index: number) => void;
}

export function VolumesTable({ volumes, modal, onAdd, onEdit, onDelete }: VolumesTableProps) {
  const isAereo = modal === 'AEREO';
  const canEdit = !!(onAdd || onEdit || onDelete);
  const colTemplate = canEdit
    ? 'grid-cols-[40px_1fr_2fr_1fr_1fr_64px]'
    : 'grid-cols-[40px_1fr_2fr_1fr_1fr]';

  const { pesoByUnit, totalM3 } = summarizeVolumes(volumes);
  const pesoLabel = formatPesoByUnit(pesoByUnit, '—');

  return (
    <LineItemsTable
      title="Volumes"
      headers={
        canEdit
          ? ['Qtd', 'Embalagem', 'Dimensões', 'Peso', isAereo ? 'Peso Taxado (kg)' : 'm³', '']
          : ['Qtd', 'Embalagem', 'Dimensões', 'Peso', isAereo ? 'Peso Taxado (kg)' : 'm³']
      }
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
      footer={
        volumes.length > 0 ? (
          <LineItemsTableRow colTemplate={colTemplate} className="font-semibold bg-muted/30">
            <span className="text-muted-foreground col-span-3">Total</span>
            <span>{pesoLabel}</span>
            <span>
              {totalM3 > 0
                ? `${totalM3.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${isAereo ? 'kg' : 'm³'}`
                : '—'}
            </span>
            {canEdit && <span />}
          </LineItemsTableRow>
        ) : undefined
      }
    >
      {volumes.map((vol, i) => {
        const hasDims =
          vol.comprimento != null || vol.largura != null || vol.altura != null;
        const dimsLabel = hasDims
          ? `${vol.comprimento ?? '?'} × ${vol.largura ?? '?'} × ${vol.altura ?? '?'} ${vol.dimensao_unidade ?? 'CM'}`
          : '—';
        return (
          <LineItemsTableRow key={i} colTemplate={colTemplate}>
            <span>{vol.quantity}</span>
            <span className="truncate">
              {vol.embalagem ? (TIPO_EMBALAGEM_LABELS[vol.embalagem] ?? vol.embalagem) : '—'}
            </span>
            <span className="text-muted-foreground">{dimsLabel}</span>
            <span>
              {vol.peso_bruto != null
                ? `${vol.peso_bruto} ${vol.peso_unidade ?? 'KG'}`
                : '—'}
            </span>
            <span>{vol.volume_m3 ?? '—'}</span>
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
        );
      })}
    </LineItemsTable>
  );
}

'use client';

import { cn } from '@/lib/utils';

import type {
  ShipmentFilterCount,
  ShipmentFilterKey,
} from '../lib/shipment-filters';

/**
 * A fileira de chips de filtro rápido. Um componente só, usado pela aba Lista e
 * pela aba Mapa: os predicados já são compartilhados (`lib/shipment-filters.ts`)
 * e o desenho tinha de acompanhar, senão o mesmo filtro apareceria com duas
 * caras em duas abas da mesma tela.
 *
 * Presentacional: quem conta é o lib, quem decide se um chip zerado aparece é o
 * chamador (ver `countShipmentFilters`).
 */

const ACTIVE_CLASS: Record<ShipmentFilterCount['tone'], string> = {
  neutral: 'border-brand-indigo-800 bg-brand-indigo-100 text-brand-indigo',
  success: 'border-portal-success bg-portal-success/10 text-portal-success',
  warning: 'border-portal-warning bg-portal-warning/10 text-portal-warning-ink',
  danger: 'border-portal-danger bg-portal-danger/10 text-portal-danger',
};

const CHIP_CLASS =
  'portal-small rounded-full border px-3 py-1 font-medium transition-colors';

const IDLE_CLASS =
  'border-border bg-background text-portal-neutral hover:bg-muted/50';

export function ShipmentFilterChips({
  filters,
  active,
  total,
  onChange,
  className,
}: {
  filters: ShipmentFilterCount[];
  active: ShipmentFilterKey | null;
  /** Quantos embarques existem ao todo — o número do chip "Todos". */
  total: number;
  onChange: (key: ShipmentFilterKey | null) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <button
        type="button"
        onClick={() => onChange(null)}
        aria-pressed={active === null}
        className={cn(
          CHIP_CLASS,
          active === null ? 'border-brand-indigo-800 bg-brand-indigo-100 text-brand-indigo' : IDLE_CLASS,
        )}
      >
        Todos
        <span className="ml-1.5 text-portal-neutral">{total}</span>
      </button>
      {filters.map((filter) => (
        <button
          key={filter.key}
          type="button"
          // Clicar no chip ativo desliga — é o jeito de voltar para "Todos" sem
          // atravessar a fileira.
          onClick={() => onChange(active === filter.key ? null : filter.key)}
          aria-pressed={active === filter.key}
          className={cn(
            CHIP_CLASS,
            active === filter.key ? ACTIVE_CLASS[filter.tone] : IDLE_CLASS,
          )}
        >
          {filter.label}
          <span className="ml-1.5 opacity-70">{filter.count}</span>
        </button>
      ))}
    </div>
  );
}

'use client';

import { SlidersHorizontal, X } from 'lucide-react';

import {
  Button,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import type { PortalQuotation } from '@/types/portal';

// Toolbar of Minhas Cotações. Six always-visible inputs used to sit above the
// kanban and dominate the screen; the search is now a single icon and the rest
// lives in a popover, mirroring the toolbar of Meus Embarques > Lista.
//
// The search icon itself lives in `_shared/portal-search-input.tsx` — both
// screens render the same component now.
export interface PortalFilterValues {
  /** Icon search — matches reference or product. */
  query: string;
  route: string;
  agent: string;
  modal: string;
  pais_procedencia: string;
  peso_taxado_min: string;
}

export const EMPTY_PORTAL_FILTERS: PortalFilterValues = {
  query: '',
  route: '',
  agent: '',
  modal: '',
  pais_procedencia: '',
  peso_taxado_min: '',
};

const MODAL_OPTIONS = [
  { value: 'MARITIMO', label: 'Marítimo' },
  { value: 'AEREO', label: 'Aéreo' },
  { value: 'RODOVIARIO', label: 'Rodoviário' },
];

// The search term is not counted: it has its own visible affordance.
export const countActivePortalFilters = (values: PortalFilterValues): number =>
  [
    values.route,
    values.agent,
    values.modal,
    values.pais_procedencia,
    values.peso_taxado_min,
  ].filter((v) => v.trim() !== '').length;

export function PortalFiltersMenu({
  values,
  onChange,
}: {
  values: PortalFilterValues;
  onChange: (values: PortalFilterValues) => void;
}) {
  const active = countActivePortalFilters(values);

  const setText =
    (key: keyof PortalFilterValues) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...values, [key]: e.target.value });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <SlidersHorizontal className="h-4 w-4" />
          Filtros
          {active > 0 && (
            <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
              {active}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-4">
        <div className="space-y-2">
          <Label className="portal-small text-portal-neutral">Modal</Label>
          <Select
            value={values.modal || 'all'}
            onValueChange={(v) => onChange({ ...values, modal: v === 'all' ? '' : v })}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {MODAL_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="portal-small text-portal-neutral">Rota</Label>
          <Input
            value={values.route}
            onChange={setText('route')}
            placeholder="Origem ou destino"
            className="h-9"
          />
        </div>

        <div className="space-y-2">
          <Label className="portal-small text-portal-neutral">Agente de cargas</Label>
          <Input
            value={values.agent}
            onChange={setText('agent')}
            placeholder="Nome do agente"
            className="h-9"
          />
        </div>

        <div className="space-y-2">
          <Label className="portal-small text-portal-neutral">País de procedência</Label>
          <Input
            value={values.pais_procedencia}
            onChange={setText('pais_procedencia')}
            placeholder="País"
            className="h-9"
          />
        </div>

        <div className="space-y-2">
          <Label className="portal-small text-portal-neutral">
            Peso taxado mínimo (kg)
          </Label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={values.peso_taxado_min}
            onChange={setText('peso_taxado_min')}
            placeholder="0"
            className="h-9"
          />
        </div>

        {active > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full gap-1.5 text-portal-neutral"
            onClick={() => onChange({ ...EMPTY_PORTAL_FILTERS, query: values.query })}
          >
            <X className="h-3.5 w-3.5" />
            Limpar filtros
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function applyPortalFilters(
  quotations: PortalQuotation[],
  filters: PortalFilterValues,
): PortalQuotation[] {
  const query = filters.query.trim().toLowerCase();
  const route = filters.route.trim().toLowerCase();
  const agent = filters.agent.trim().toLowerCase();
  const modal = filters.modal.trim().toLowerCase();
  const pais = filters.pais_procedencia.trim().toLowerCase();
  const pesoMin = parseFloat(filters.peso_taxado_min);

  if (
    !query &&
    !route &&
    !agent &&
    !modal &&
    !pais &&
    (Number.isNaN(pesoMin) || pesoMin <= 0)
  ) {
    return quotations;
  }

  return quotations.filter((q) => {
    if (query) {
      const haystack = `${q.reference} ${q.product ?? ''}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    if (route) {
      const origin = (q.origin ?? '').toLowerCase();
      const dest = [
        ...(q.porto_destino ?? []),
        ...(q.aeroporto_destino ?? []),
      ]
        .join(' ')
        .toLowerCase();
      if (!origin.includes(route) && !dest.includes(route)) return false;
    }

    if (agent) {
      const agentName = (q.best_proposal?.agent?.name ?? '').toLowerCase();
      if (!agentName.includes(agent)) return false;
    }

    if (modal && (q.modal ?? '').toLowerCase() !== modal) {
      return false;
    }

    if (pais) {
      const paisValue = (q.pais_procedencia ?? '').toLowerCase();
      if (!paisValue.includes(pais)) return false;
    }

    if (!Number.isNaN(pesoMin) && pesoMin > 0) {
      if (q.peso_taxado == null || q.peso_taxado < pesoMin) return false;
    }

    return true;
  });
}

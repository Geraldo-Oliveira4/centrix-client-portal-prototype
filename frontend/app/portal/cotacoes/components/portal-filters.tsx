'use client';

import { Search, X } from 'lucide-react';
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import type { PortalQuotation } from '@/types/portal';

export interface PortalFilterValues {
  exporter: string;
  route: string;
  agent: string;
  modal: string;
  pais_procedencia: string;
  peso_taxado_min: string;
}

interface PortalFiltersProps {
  values: PortalFilterValues;
  onChange: (values: PortalFilterValues) => void;
}

const EMPTY: PortalFilterValues = {
  exporter: '',
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

export function PortalFilters({ values, onChange }: PortalFiltersProps) {
  const hasAny =
    values.exporter ||
    values.route ||
    values.agent ||
    values.modal ||
    values.pais_procedencia ||
    values.peso_taxado_min;

  const set =
    (key: keyof PortalFilterValues) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...values, [key]: e.target.value });

  const setModal = (value: string) => onChange({ ...values, modal: value });

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Produto / fornecedor..."
          value={values.exporter}
          onChange={set('exporter')}
          className="pl-9 w-52"
        />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rota (ex: TWKHH)"
          value={values.route}
          onChange={set('route')}
          className="pl-9 w-44"
        />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Agente de cargas..."
          value={values.agent}
          onChange={set('agent')}
          className="pl-9 w-48"
        />
      </div>

      <Select value={values.modal} onValueChange={setModal}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Modal" />
        </SelectTrigger>
        <SelectContent>
          {MODAL_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="País de procedência..."
          value={values.pais_procedencia}
          onChange={set('pais_procedencia')}
          className="pl-9 w-48"
        />
      </div>

      <Input
        type="number"
        min={0}
        step={0.01}
        placeholder="Peso taxado mín. (kg)"
        value={values.peso_taxado_min}
        onChange={set('peso_taxado_min')}
        className="w-44"
      />

      {hasAny && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 text-muted-foreground"
          onClick={() => onChange(EMPTY)}
        >
          <X className="h-3.5 w-3.5" />
          Limpar
        </Button>
      )}
    </div>
  );
}

export function applyPortalFilters(
  quotations: PortalQuotation[],
  filters: PortalFilterValues,
): PortalQuotation[] {
  const exporter = filters.exporter.trim().toLowerCase();
  const route = filters.route.trim().toLowerCase();
  const agent = filters.agent.trim().toLowerCase();
  const modal = filters.modal.trim().toLowerCase();
  const pais = filters.pais_procedencia.trim().toLowerCase();
  const pesoMin = parseFloat(filters.peso_taxado_min);

  if (
    !exporter &&
    !route &&
    !agent &&
    !modal &&
    !pais &&
    (Number.isNaN(pesoMin) || pesoMin <= 0)
  ) {
    return quotations;
  }

  return quotations.filter((q) => {
    if (exporter) {
      const product = (q.product ?? '').toLowerCase();
      if (!product.includes(exporter)) return false;
    }

    if (route) {
      const origin = (q.origin ?? '').toLowerCase();
      const dest = [
        ...(q.porto_destino ?? []),
        ...(q.aeroporto_destino ?? []),
      ].join(' ').toLowerCase();
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

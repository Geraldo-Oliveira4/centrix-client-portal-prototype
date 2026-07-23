'use client';

import { AlertTriangle } from 'lucide-react';

import { cn } from '@/lib/utils';
import type {
  PortalAdditionalCost,
  PortalCostProbability,
} from '@/types/portal';

const PROBABILITY_COLOR: Record<PortalCostProbability, string> = {
  BAIXA: 'text-portal-success',
  MEDIA: 'text-portal-warning',
  ALTA: 'text-portal-danger',
};

const PROBABILITY_LABEL: Record<PortalCostProbability, string> = {
  BAIXA: 'Probabilidade baixa',
  MEDIA: 'Probabilidade média',
  ALTA: 'Probabilidade alta',
};

export function AdditionalCostsCard({ items }: { items: PortalAdditionalCost[] }) {
  return (
    <section className="portal-card-muted p-6">
      <header className="flex items-start gap-2 mb-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-portal-danger" />
        <div>
          <h2 className="portal-h3 text-portal-danger">
            Possíveis Custos Adicionais
          </h2>
          <p className="portal-small text-portal-neutral">
            Custos que podem ocorrer dependendo da operação.
          </p>
        </div>
      </header>
      <ul className="space-y-4">
        {items.map((cost, idx) => (
          <li key={`${cost.label}-${idx}`} className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <p className="font-medium text-sm">{cost.label}</p>
              {cost.probability ? (
                <p className={cn('text-xs font-medium', PROBABILITY_COLOR[cost.probability])}>
                  {PROBABILITY_LABEL[cost.probability]}
                </p>
              ) : null}
              {cost.note ? (
                <p className="portal-small text-portal-neutral">{cost.note}</p>
              ) : null}
            </div>
            <p className="text-sm whitespace-nowrap">{formatCostRange(cost)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatCostRange(cost: PortalAdditionalCost): string {
  if (cost.amount_min == null && cost.amount_max == null) return 'Variável';
  const fmt = (n: number) => `${cost.currency} ${n.toLocaleString('pt-BR')}`;
  let body: string;
  if (cost.amount_min != null && cost.amount_max != null) {
    body = `~${cost.currency} ${cost.amount_min.toLocaleString('pt-BR')}-${cost.amount_max.toLocaleString('pt-BR')}`;
  } else if (cost.amount_min != null) {
    body = `~${fmt(cost.amount_min)}`;
  } else {
    body = `~${fmt(cost.amount_max as number)}`;
  }
  return cost.unit ? `${body}${cost.unit}` : body;
}

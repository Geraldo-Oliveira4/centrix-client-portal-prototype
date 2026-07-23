'use client';

import { cn } from '@/lib/utils';

interface KpiCardsProps {
  total: number;
  awaitingProposals: number;
  awaitingApproval: number;
  approved: number;
  declined: number;
}

interface Kpi {
  label: string;
  value: number;
  valueClass: string;
}

// Compact metric tiles derived entirely from the buckets already returned by
// /portal/quotations. Numbers only: the actionable shortlists live in the
// SummaryCards below, the funnel detail in the kanban. State colours follow the
// portal semantic palette (warning = waiting, info = client action, success =
// approved, danger = declined); the total stays neutral.
export function KpiCards({
  total,
  awaitingProposals,
  awaitingApproval,
  approved,
  declined,
}: KpiCardsProps) {
  const kpis: Kpi[] = [
    { label: 'Total de cotações', value: total, valueClass: 'text-foreground' },
    { label: 'Aguardando propostas', value: awaitingProposals, valueClass: 'text-portal-warning' },
    { label: 'Escolha sua proposta', value: awaitingApproval, valueClass: 'text-portal-info' },
    { label: 'Aprovadas', value: approved, valueClass: 'text-portal-success' },
    { label: 'Recusadas', value: declined, valueClass: 'text-portal-danger' },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="space-y-1">
          <p className={cn('text-2xl font-semibold leading-none', kpi.valueClass)}>
            {kpi.value}
          </p>
          <p className="portal-small text-portal-neutral">{kpi.label}</p>
        </div>
      ))}
    </div>
  );
}

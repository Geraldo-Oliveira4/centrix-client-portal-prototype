'use client';

import Link from 'next/link';
import { CheckCircle2, Clock } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  addDays,
  daysSince,
  formatBRL,
  formatRoute,
  formatShortDate,
} from '@/lib/portal-formatters';
import { PORTAL_BUCKET_LABELS, type PortalQuotation } from '@/types/portal';

interface SummaryCardsProps {
  awaitingApproval: PortalQuotation[];
  awaitingProposals: PortalQuotation[];
}

export function SummaryCards({
  awaitingApproval,
  awaitingProposals,
}: SummaryCardsProps) {
  return (
    <div className="grid items-start gap-4 md:grid-cols-2">
      <SummaryCard
        label={PORTAL_BUCKET_LABELS.aguardando_aprovacao}
        quotations={awaitingApproval}
        icon={CheckCircle2}
        iconClass="bg-portal-success/10 text-portal-success"
        countClass="text-portal-success"
        renderItem={(q) => <ApproveItem quotation={q} />}
      />
      <SummaryCard
        label={PORTAL_BUCKET_LABELS.buscando_propostas}
        quotations={awaitingProposals}
        icon={Clock}
        iconClass="bg-portal-warning/10 text-portal-warning"
        countClass="text-portal-warning"
        renderItem={(q) => <WaitingItem quotation={q} />}
      />
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  quotations: PortalQuotation[];
  icon: typeof CheckCircle2;
  iconClass: string;
  countClass: string;
  renderItem: (q: PortalQuotation) => React.ReactNode;
}

function SummaryCard({
  label,
  quotations,
  icon: Icon,
  iconClass,
  countClass,
  renderItem,
}: SummaryCardProps) {
  return (
    <div className="portal-card-muted space-y-4 p-4">
      <header className="flex items-center gap-3">
        <div className={cn('rounded-full p-2', iconClass)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <p className="portal-small text-portal-neutral">{label}</p>
          <p className={cn('text-2xl font-semibold leading-none', countClass)}>
            {quotations.length}
          </p>
        </div>
      </header>
      {quotations.length > 0 ? (
        <ul className="-mx-2 divide-y text-sm">
          {quotations.map((q) => (
            <li key={q.id}>
              <Link
                href={`/portal/cotacao/${q.id}`}
                className="block px-2 py-2 rounded transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
              >
                {renderItem(q)}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ApproveItem({ quotation }: { quotation: PortalQuotation }) {
  const best = quotation.best_proposal;
  const arrivalLabel = best?.transit_time
    ? formatShortDate(addDays(best.transit_time))
    : null;

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="portal-body font-medium text-foreground truncate">
          {formatRoute(quotation)}
        </p>
        {arrivalLabel ? (
          <p className="portal-small text-portal-neutral">
            Chegada na fábrica: {arrivalLabel}
          </p>
        ) : null}
      </div>
      {best ? (
        <p className="portal-body font-medium text-portal-success whitespace-nowrap">
          {formatBRL(best.total_brl)}
        </p>
      ) : null}
    </div>
  );
}

function WaitingItem({ quotation }: { quotation: PortalQuotation }) {
  const since = daysSince(quotation.created_at);
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="portal-body font-medium text-foreground truncate">
          {formatRoute(quotation)}
        </p>
        {quotation.product ? (
          <p className="portal-small text-portal-neutral truncate">
            {quotation.product}
          </p>
        ) : null}
      </div>
      {since ? (
        <p className="portal-small text-portal-warning whitespace-nowrap">{since}</p>
      ) : null}
    </div>
  );
}

'use client';

import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatEstimatedArrival } from '@/lib/portal-formatters';
import type { ClientPortalProposal } from '@/types/quotation';

interface EstimatedArrivalSectionProps {
  proposals: ClientPortalProposal[];
}

export function EstimatedArrivalSection({ proposals }: EstimatedArrivalSectionProps) {
  if (proposals.length === 0) return null;

  const sorted = [...proposals].sort((a, b) => a.transit_time - b.transit_time);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="bg-brand-navy px-4 py-3 flex items-center gap-2">
        <Calendar className="w-3.5 h-3.5 text-brand-orange-500" />
        <p className="text-xs font-semibold text-white/90 uppercase tracking-wide">
          Chegada Estimada
        </p>
      </div>
      <div className="p-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((p) => (
          <div
            key={p.proposal_id}
            className={cn(
              'flex items-center justify-between gap-3 rounded border px-3 py-2',
              p.is_lowest_transit && 'border-brand-indigo-800/40 bg-brand-indigo-100',
            )}
          >
            <span className="text-sm font-medium truncate">{p.agent_name}</span>
            <span
              className={cn(
                'text-xs whitespace-nowrap',
                p.is_lowest_transit ? 'text-brand-indigo font-semibold' : 'text-muted-foreground',
              )}
            >
              {formatEstimatedArrival(p.transit_time)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

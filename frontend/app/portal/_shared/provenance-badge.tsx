'use client';

import { CheckCircle2, FlaskConical, PlugZap } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Honesty badge shared by the Inteligência and Auditoria modules.
 *
 * `real` — the number/value shown is backed by real data in this prototype
 * (a received proposal, a computed recommendation, an actual shipment).
 * `preview` — the headline value is fabricated or illustrative; reuses the exact
 * same "Pré-visualização" seal already used in the per-quotation Auditoria
 * section, so the two read identically across the portal.
 * `pending` — the value is not fabricated, it simply has no data source yet in
 * this prototype (an integration that does not exist: ETA feed, invoice/BL,
 * exception engine). Grey, so it reads as "coming, not made up" — distinct from
 * the pink `preview` (which IS a made-up number).
 *
 * The rule the whole task rests on: nothing real should wear the preview badge,
 * and nothing fabricated should be shown without it.
 */
export type Provenance = 'real' | 'preview' | 'pending';

export function ProvenanceBadge({
  provenance,
  className,
}: {
  provenance: Provenance;
  className?: string;
}) {
  if (provenance === 'real') {
    return (
      <span
        className={cn(
          'portal-small inline-flex items-center gap-1.5 rounded border border-portal-success/30 bg-portal-success/10 px-2 py-0.5 font-medium text-portal-success',
          className,
        )}
      >
        <CheckCircle2 className="h-4 w-4" />
        Dado real
      </span>
    );
  }
  if (provenance === 'pending') {
    return (
      <span
        className={cn(
          'portal-small inline-flex items-center gap-1.5 rounded border border-border bg-muted px-2 py-0.5 font-medium text-portal-neutral',
          className,
        )}
      >
        <PlugZap className="h-4 w-4" />
        Pendente integração
      </span>
    );
  }
  return (
    <span
      className={cn(
        'portal-small inline-flex items-center gap-1.5 rounded border border-dashed border-brand-indigo-800/40 bg-brand-indigo-100 px-2 py-0.5 font-medium text-brand-indigo',
        className,
      )}
    >
      <FlaskConical className="h-4 w-4" />
      Pré-visualização
    </span>
  );
}

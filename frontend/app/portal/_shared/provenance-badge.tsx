'use client';

import { CheckCircle2, FlaskConical } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Honesty badge shared by the Inteligência and Auditoria modules.
 *
 * `real` — the number/value shown is backed by real data in this prototype
 * (a received proposal, a computed recommendation, an actual shipment).
 * `preview` — the headline value is fabricated or illustrative; reuses the exact
 * same "Pré-visualização" seal already used in the per-quotation Auditoria
 * section, so the two read identically across the portal.
 *
 * The rule the whole task rests on: nothing real should wear the preview badge,
 * and nothing fabricated should be shown without it.
 */
export type Provenance = 'real' | 'preview';

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
        <CheckCircle2 className="h-3.5 w-3.5" />
        Dado real
      </span>
    );
  }
  return (
    <span
      className={cn(
        'portal-small inline-flex items-center gap-1.5 rounded border border-dashed border-primary/40 bg-primary/5 px-2 py-0.5 font-medium text-primary',
        className,
      )}
    >
      <FlaskConical className="h-3.5 w-3.5" />
      Pré-visualização
    </span>
  );
}

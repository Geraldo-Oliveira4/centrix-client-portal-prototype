'use client';

import { CircleDashed } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Third data state, next to ProvenanceBadge's `real` / `preview` / `pending`:
 * the source IS integrated, it simply did not report enough for this shipment.
 *
 *   pending    ("Pendente integração")  -> we have not integrated yet
 *   incomplete (this badge)             -> integrated, the carrier stayed quiet
 *
 * Two rules hold this apart from everything else on a shipment surface:
 *
 *  - NEUTRAL ONLY. Never portal-success / portal-warning / portal-danger. Those
 *    three are the health semáforo of the shipment itself; this badge says
 *    nothing about the cargo, only about the data behind it, and borrowing a
 *    health colour would read as "the shipment is fine" or "it is late".
 *  - Visually distinct from `pending`, which is also grey: dashed outline on a
 *    transparent surface with a hollow dot, versus pending's solid border on a
 *    filled surface with a plug icon.
 *
 * `INCOMPLETE_DATA_COPY` (app/portal/embarques/lib/delay-risk.ts) is the single
 * wording for the explanation; pass it through `IncompleteDataNote` so the
 * sentence stays identical on the card, the timeline and the map.
 */

export function IncompleteDataBadge({
  label = 'Sem dado suficiente',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'portal-small inline-flex items-center gap-1.5 rounded border border-dashed border-portal-neutral/50 bg-transparent px-2 py-0.5 font-medium text-portal-neutral',
        className,
      )}
    >
      <CircleDashed className="h-4 w-4" />
      {label}
    </span>
  );
}

export function IncompleteDataNote({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'portal-small flex items-start gap-1.5 text-portal-neutral',
        className,
      )}
    >
      <CircleDashed className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

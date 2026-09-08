'use client';

import { Tag } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * The client's own PO number (`client_reference`), rendered the same way on
 * every screen of the journey: Funil, Histórico, Meus Embarques (lista e
 * detalhe).
 *
 * It is an ADDITIONAL identifier, never a replacement: COT-XXXX / EMB-XXXX stay
 * the record's identity and keep the visual weight, so the tag is deliberately
 * quieter than the reference next to it — outline, neutral, prefixed "PO" so it
 * is never mistaken for an internal reference.
 *
 * Renders nothing when there is no PO. A quotation may be created without one,
 * and a shipment the analyst opened outside the portal has no quotation behind
 * it at all; an empty "PO —" would read as a missing field rather than as a
 * field that simply does not apply.
 */
export function ClientReferenceTag({
  value,
  className,
}: {
  value: string | null | undefined;
  className?: string;
}) {
  if (!value) return null;

  return (
    <span
      className={cn(
        'portal-small inline-flex max-w-full items-center gap-1 rounded border border-border bg-muted/60 px-1.5 py-0.5 font-medium text-portal-neutral',
        className,
      )}
      title={`Sua referência (PO): ${value}`}
    >
      <Tag className="h-4 w-4 shrink-0" />
      <span className="truncate">PO {value}</span>
    </span>
  );
}

/**
 * Does this PO match what the user typed? Shared by the two search boxes
 * (Minhas Cotações and Meus Embarques) so "PO 1183", "po-2026-1183" and
 * "2026-1183" all find the same record on both screens.
 *
 * Normalisation drops case, spaces and the separators a PO is commonly written
 * with, which is what makes a pasted "PO 2026/1183" match a stored
 * "PO-2026-1183".
 */
export const normalizeReference = (value: string) =>
  value.toUpperCase().replace(/[\s\-/_.]/g, '');

export const matchesClientReference = (
  value: string | null | undefined,
  term: string,
): boolean =>
  !!value && normalizeReference(value).includes(normalizeReference(term));

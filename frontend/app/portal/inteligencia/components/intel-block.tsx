'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { ProvenanceBadge, type Provenance } from '../../_shared/provenance-badge';

/**
 * One canvas-question block. A `real` block wears the primary `.portal-card`
 * surface (it looks like real content); a `preview` block wears the dashed,
 * tinted frame already used by the Auditoria preview, so the provenance is
 * legible at a glance before the reader even gets to the badge.
 */
export function IntelBlock({
  icon,
  title,
  question,
  provenance,
  children,
  footnote,
}: {
  icon: ReactNode;
  title: string;
  question: string;
  provenance: Provenance;
  children: ReactNode;
  footnote?: ReactNode;
}) {
  const preview = provenance === 'preview';
  return (
    <section
      className={cn(
        'flex flex-col gap-4 p-6',
        preview
          ? 'rounded-xl border border-dashed border-border bg-muted/20'
          : 'portal-card',
      )}
    >
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-portal-neutral">{icon}</span>
            <h2 className="portal-h2 text-foreground">{title}</h2>
          </div>
          <ProvenanceBadge provenance={provenance} />
        </div>
        <p className="portal-small text-portal-neutral">{question}</p>
      </header>

      <div className="flex-1">{children}</div>

      {footnote ? (
        <p className="portal-small border-t border-dashed pt-3 text-portal-neutral">
          {footnote}
        </p>
      ) : null}
    </section>
  );
}

'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  PORTAL_BUCKET_LABELS,
  type PortalBucketKey,
  type PortalQuotation,
} from '@/types/portal';

import { QuotationCard } from './quotation-card';

interface BucketProps {
  bucket: PortalBucketKey;
  quotations: PortalQuotation[];
}

interface SubBucketProps {
  label: string;
  quotations: PortalQuotation[];
  bucket: PortalBucketKey;
  defaultExpanded?: boolean;
}

function SubBucket({ label, quotations, bucket, defaultExpanded = false }: SubBucketProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (quotations.length === 0) return null;

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="flex items-center gap-1.5 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          {quotations.length}
        </span>
      </button>
      {expanded && (
        <div className="grid gap-3 pl-5">
          {quotations.map((q) => (
            <QuotationCard key={q.id} quotation={q} bucket={bucket} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Bucket({ bucket, quotations }: BucketProps) {
  // Terminal sections ("Finalizadas", "Canceladas") render below the columns and
  // start collapsed. "Finalizadas" additionally splits into approved/declined
  // sub-buckets; "Canceladas" is a single flat list.
  const collapsible = bucket === 'finalizadas' || bucket === 'cancelada';
  const split = bucket === 'finalizadas';
  const [expanded, setExpanded] = useState(!collapsible);

  if (quotations.length === 0) return null;

  const approved = split
    ? quotations.filter((q) => q.state === 'FECHADA')
    : [];
  const declined = split
    ? quotations.filter((q) => q.state !== 'FECHADA')
    : [];

  return (
    <section className="space-y-3">
      <header
        className={cn(
          'flex items-center gap-2',
          collapsible && 'cursor-pointer select-none',
        )}
        onClick={collapsible ? () => setExpanded((v) => !v) : undefined}
        role={collapsible ? 'button' : undefined}
        aria-expanded={collapsible ? expanded : undefined}
      >
        {collapsible ? (
          expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )
        ) : null}
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {PORTAL_BUCKET_LABELS[bucket]}
        </h2>
        <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {quotations.length}
        </span>
      </header>
      {expanded ? (
        split ? (
          <div className="space-y-4">
            <SubBucket
              label="Aprovadas"
              quotations={approved}
              bucket={bucket}
              defaultExpanded
            />
            <SubBucket
              label="Reprovadas"
              quotations={declined}
              bucket={bucket}
              defaultExpanded={false}
            />
          </div>
        ) : (
          <div className="grid gap-3">
            {quotations.map((q) => (
              <QuotationCard key={q.id} quotation={q} bucket={bucket} />
            ))}
          </div>
        )
      ) : null}
    </section>
  );
}

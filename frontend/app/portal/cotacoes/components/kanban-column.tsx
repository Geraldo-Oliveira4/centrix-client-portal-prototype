'use client';

import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  PORTAL_BUCKET_LABELS,
  type PortalBucketKey,
  type PortalQuotation,
} from '@/types/portal';

import { QuotationCard } from './quotation-card';

interface KanbanColumnProps {
  bucket: PortalBucketKey;
  quotations: PortalQuotation[];
  /** Overrides the default PORTAL_BUCKET_LABELS label. */
  label?: string;
  /** Tailwind class for the top border accent colour. */
  accentColor?: string;
}

const DEFAULT_ACCENT: Record<PortalBucketKey, string> = {
  // Semantic accents: waiting on the client or on Freitas = warning, in
  // progress = info, ready for the client to decide = success.
  aguardando_dados: 'border-t-portal-warning',
  buscando_propostas: 'border-t-portal-info',
  aguardando_aprovacao: 'border-t-portal-success',
  finalizadas: 'border-t-portal-neutral/40',
  cancelada: 'border-t-portal-neutral/40',
};

export function KanbanColumn({ bucket, quotations, label, accentColor }: KanbanColumnProps) {
  const topBorder = accentColor ?? DEFAULT_ACCENT[bucket];

  return (
    <div
      className={cn(
        'flex flex-col min-w-80 w-80 rounded-xl border border-t-4 bg-white/60',
        topBorder,
      )}
    >
      <header className="flex shrink-0 items-center justify-between rounded-t-xl px-4 py-3">
        <h2 className="portal-small font-medium uppercase tracking-wide text-portal-neutral">
          {label ?? PORTAL_BUCKET_LABELS[bucket]}
        </h2>
        <span className="portal-small rounded bg-muted px-2 py-0.5 tabular-nums text-portal-neutral">
          {quotations.length}
        </span>
      </header>

      <ScrollArea className="flex-1 max-h-[calc(100vh-220px)]">
        <div className="space-y-2 p-2">
          {quotations.length === 0 ? (
            <p className="portal-small py-8 text-center text-portal-neutral">
              Nenhuma cotação.
            </p>
          ) : (
            quotations.map((q) => (
              <QuotationCard key={q.id} quotation={q} bucket={bucket} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

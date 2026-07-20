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
  aguardando_dados: 'border-t-amber-500',
  buscando_propostas: 'border-t-blue-500',
  aguardando_aprovacao: 'border-t-teal-500',
  finalizadas: 'border-t-slate-300',
  cancelada: 'border-t-slate-300',
};

export function KanbanColumn({ bucket, quotations, label, accentColor }: KanbanColumnProps) {
  const topBorder = accentColor ?? DEFAULT_ACCENT[bucket];

  return (
    <div
      className={cn(
        'flex flex-col min-w-80 w-80 rounded-lg border bg-muted/20 border-t-4',
        topBorder,
      )}
    >
      <header className="flex items-center justify-between px-3 py-2.5 rounded-t-lg bg-muted/30 shrink-0">
        <h2 className="text-sm font-medium text-foreground uppercase tracking-wide">
          {label ?? PORTAL_BUCKET_LABELS[bucket]}
        </h2>
        <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground tabular-nums">
          {quotations.length}
        </span>
      </header>

      <ScrollArea className="flex-1 max-h-[calc(100vh-220px)]">
        <div className="p-2 space-y-2">
          {quotations.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
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

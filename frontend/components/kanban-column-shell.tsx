'use client';

import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface KanbanColumnShellProps {
  label: string;
  headerColor: string;
  headerBg: string;
  darkHeaderBg: string;
  count: number;
  emptyLabel: string;
  // Separate from count so client-side filtering can show empty state even
  // when the server-reported total (count) is non-zero.
  isEmpty?: boolean;
  children: React.ReactNode;
}

export function KanbanColumnShell({
  label,
  headerColor,
  headerBg,
  darkHeaderBg,
  count,
  emptyLabel,
  isEmpty,
  children,
}: KanbanColumnShellProps) {
  return (
    <div
      className={cn(
        'flex flex-col min-w-[288px] w-[288px] rounded-lg border-t-4 bg-muted/30',
        headerColor,
      )}
    >
      <div
        className={cn(
          'px-3 py-2.5 flex items-center justify-between rounded-t-lg',
          headerBg,
          darkHeaderBg,
        )}
      >
        <span className="text-sm font-medium text-foreground">{label}</span>
        <Badge variant="secondary" className="text-xs tabular-nums">
          {count}
        </Badge>
      </div>

      <ScrollArea className="flex-1 max-h-[calc(100vh-220px)]">
        <div className="p-2 space-y-2">
          {(isEmpty ?? count === 0) ? (
            <p className="text-xs text-muted-foreground text-center py-8">{emptyLabel}</p>
          ) : (
            children
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

'use client';

import type { ReactNode } from 'react';
import { ArrowRight, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuotationLog } from '@/types/quotation';

// Shared timeline shell for the quotation history (analyst history-section and
// portal history-timeline). Owns the vertical line + dot + label/state/date
// header so the two never drift; each caller supplies the label and the
// divergent detail/meta/badge rows via `renderEntry`.

export interface TimelineEntryContent {
  label: string;
  /** Inline badges after the label (e.g. analyst "Via Portal"). */
  badges?: ReactNode;
  /** Extra inline meta after the date (e.g. analyst user id / completeness). */
  meta?: ReactNode;
  /** Detail rows below the header (decline reason, note, proposal freight...). */
  details?: ReactNode;
}

interface QuotationTimelineProps {
  logs: QuotationLog[];
  renderEntry: (log: QuotationLog) => TimelineEntryContent;
}

export function QuotationTimeline({ logs, renderEntry }: QuotationTimelineProps) {
  return (
    <div className="relative flex flex-col gap-0">
      <div className="absolute left-[11px] top-3 bottom-3 w-px bg-border" />
      {logs.map((log, idx) => (
        <TimelineEntry
          key={log.id}
          log={log}
          isLast={idx === logs.length - 1}
          content={renderEntry(log)}
        />
      ))}
    </div>
  );
}

function TimelineEntry({
  log,
  isLast,
  content,
}: {
  log: QuotationLog;
  isLast: boolean;
  content: TimelineEntryContent;
}) {
  const date = new Date(log.created_at);
  const dateStr = date.toLocaleDateString('pt-BR');
  const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={cn('flex gap-4 pb-4', isLast && 'pb-0')}>
      <div className="relative flex flex-col items-center">
        <div className="w-6 h-6 rounded-full border-2 border-border bg-background flex items-center justify-center shrink-0 z-10">
          <Clock className="w-3 h-3 text-muted-foreground" />
        </div>
      </div>

      <div className="flex flex-col gap-0.5 pt-0.5 pb-2 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{content.label}</span>
          {content.badges}
          {log.previous_state && log.new_state && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>{log.previous_state}</span>
              <ArrowRight className="w-3 h-3" />
              <span className="font-medium text-foreground">{log.new_state}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <span>
            {dateStr} {timeStr}
          </span>
          {content.meta}
        </div>

        {content.details}
      </div>
    </div>
  );
}

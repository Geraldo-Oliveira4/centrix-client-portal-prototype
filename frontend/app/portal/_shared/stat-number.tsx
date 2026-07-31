'use client';

import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

import { cn } from '@/lib/utils';

import { TONE_TEXT, type Tone } from './tone';

/**
 * Big-number tile for the portal dashboards, enforcing the house rule: a number
 * never stands alone — it always carries a label and, where a comparison exists,
 * a signed variação. When there is no real value yet (e.g. on-time rate has no
 * data source), pass no `value` and a `badge` (ProvenanceBadge "pending") so the
 * tile reads as "coming", never as a fabricated number.
 */

export interface Delta {
  /** Signed percent change. */
  pct: number;
  /** e.g. "vs mês anterior". */
  label?: string;
  /** Which direction is "good" — colours the arrow. Default up. */
  goodDirection?: 'up' | 'down';
}

function DeltaPill({ delta }: { delta: Delta }) {
  const good = delta.goodDirection ?? 'up';
  const flat = delta.pct === 0;
  const up = delta.pct > 0;
  const isGood = up === (good === 'up');
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const color = flat
    ? 'text-portal-neutral'
    : isGood
      ? 'text-portal-success'
      : 'text-portal-danger';
  return (
    <p className={cn('inline-flex items-center gap-1 portal-small font-medium', color)}>
      <Icon className="h-3.5 w-3.5" />
      {up ? '+' : ''}
      {delta.pct}%
      {delta.label ? (
        <span className="font-normal text-portal-neutral">{delta.label}</span>
      ) : null}
    </p>
  );
}

export function StatNumber({
  label,
  value,
  tone,
  delta,
  caption,
  badge,
  icon,
  size = 'default',
}: {
  label: string;
  /** The big number. Omit when the metric has no data yet (show `badge` instead). */
  value?: ReactNode;
  /** Colours the value. Omit for a normal foreground number. */
  tone?: Tone;
  /** Signed variação; omit or pass null when there is no comparable baseline. */
  delta?: Delta | null;
  caption?: ReactNode;
  /** e.g. a ProvenanceBadge — shown top-right, and used in place of a value when pending. */
  badge?: ReactNode;
  icon?: ReactNode;
  /**
   * Weight of the tile on the page. `hero` is for the one or two headline
   * metrics of a dashboard; `compact` for the supporting row beneath them. A
   * screen with every tile at the same size has no hierarchy — pick one level
   * to dominate and drop the rest to `compact`.
   */
  size?: 'hero' | 'default' | 'compact';
}) {
  const valueClass =
    size === 'hero' ? 'text-5xl' : size === 'compact' ? 'text-2xl' : 'text-3xl';

  return (
    <div className={cn('portal-card space-y-2', size === 'compact' ? 'p-4' : 'p-6')}>
      <div className="flex items-center justify-between gap-2 text-portal-neutral">
        <div className="flex items-center gap-2">
          {icon}
          <p className={size === 'hero' ? 'portal-body' : 'portal-small'}>{label}</p>
        </div>
        {badge}
      </div>
      {value != null ? (
        <p
          className={cn(
            'font-semibold leading-none',
            valueClass,
            tone ? TONE_TEXT[tone] : 'text-foreground',
          )}
        >
          {value}
        </p>
      ) : null}
      {delta ? <DeltaPill delta={delta} /> : null}
      {caption ? <p className="portal-small text-portal-neutral">{caption}</p> : null}
    </div>
  );
}

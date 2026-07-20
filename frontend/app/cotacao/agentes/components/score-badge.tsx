'use client';

import { cn } from '@/lib/utils';

interface ScoreBadgeProps {
  score: number | null;
  showBar?: boolean;
}

function getScoreVariant(score: number | null): {
  label: string;
  barColor: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
} {
  if (score === null) {
    return {
      label: '—',
      barColor: 'bg-muted-foreground/30',
      textColor: 'text-muted-foreground',
      bgColor: 'bg-muted/50',
      borderColor: 'border-border',
    };
  }
  if (score > 80) {
    return {
      label: score.toFixed(1),
      barColor: 'bg-green-500',
      textColor: 'text-green-700 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-950/20',
      borderColor: 'border-green-300 dark:border-green-700',
    };
  }
  if (score >= 60) {
    return {
      label: score.toFixed(1),
      barColor: 'bg-yellow-500',
      textColor: 'text-yellow-700 dark:text-yellow-400',
      bgColor: 'bg-yellow-50 dark:bg-yellow-950/20',
      borderColor: 'border-yellow-300 dark:border-yellow-700',
    };
  }
  return {
    label: score.toFixed(1),
    barColor: 'bg-red-500',
    textColor: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/20',
    borderColor: 'border-red-300 dark:border-red-700',
  };
}

export function ScoreBadge({ score, showBar = false }: ScoreBadgeProps) {
  const variant = getScoreVariant(score);
  const percentage = score !== null ? Math.min(Math.max(score, 0), 100) : 0;

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <span
        className={cn(
          'inline-flex items-center justify-center rounded border px-2 py-0.5 text-xs font-semibold tabular-nums min-w-[48px]',
          variant.textColor,
          variant.bgColor,
          variant.borderColor,
        )}
      >
        {variant.label}
      </span>

      {showBar && score !== null && (
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden min-w-[60px]">
          <div
            className={cn('h-full rounded-full transition-all', variant.barColor)}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}

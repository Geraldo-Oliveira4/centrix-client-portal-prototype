'use client';

import { AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui';
import { COMPLETENESS_FIELD_LABELS } from '@/types/quotation';
import type { CompletenessField } from '@/types/quotation';
import { cn } from '@/lib/utils';

interface CompletenessBarProps {
  score: number;
  missingFields: CompletenessField[];
  hideReadyMessage?: boolean;
}

export function CompletenessBar({
  score,
  missingFields,
  hideReadyMessage,
}: CompletenessBarProps) {
  const colorClass =
    score >= 80
      ? 'text-green-600 dark:text-green-400'
      : score >= 50
        ? 'text-yellow-600 dark:text-yellow-400'
        : 'text-red-600 dark:text-red-400';

  const progressColorClass =
    score >= 80
      ? '[&>div]:bg-green-500'
      : score >= 50
        ? '[&>div]:bg-yellow-500'
        : '[&>div]:bg-red-500';

  return (
    <div className="border rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Completude dos dados</span>
        <span className={cn('text-sm font-bold tabular-nums', colorClass)}>
          {score}%
        </span>
      </div>

      <Progress value={score} className={cn('h-2', progressColorClass)} />

      {missingFields.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Campos faltantes:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {missingFields.map((field) => (
              <span
                key={field}
                className="text-xs px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800"
              >
                {COMPLETENESS_FIELD_LABELS[field]}
              </span>
            ))}
          </div>
        </div>
      )}

      {missingFields.length === 0 && !hideReadyMessage && (
        <p className="text-xs text-green-600 dark:text-green-400 font-medium">
          Todos os campos preenchidos. Cotacao pronta para iniciar.
        </p>
      )}
    </div>
  );
}

'use client';

import { Check, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AutoSaveStatus } from '@/hooks/use-autosave';

export type { AutoSaveStatus };

interface AutoSaveIndicatorProps {
  status: AutoSaveStatus;
  className?: string;
}

export function AutoSaveIndicator({ status, className }: AutoSaveIndicatorProps) {
  if (status === 'idle') return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs',
        status === 'error' ? 'text-destructive' : 'text-muted-foreground',
        className,
      )}
    >
      {status === 'saving' && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          Salvando...
        </>
      )}
      {status === 'saved' && (
        <>
          <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
          Salvo
        </>
      )}
      {status === 'error' && (
        <>
          <AlertCircle className="h-3 w-3" />
          Erro ao salvar automaticamente
        </>
      )}
    </span>
  );
}

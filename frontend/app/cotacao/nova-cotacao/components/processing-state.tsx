'use client';

import { Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui';

interface ProcessingStateProps {
  timedOut: boolean;
  onProceedManually: () => void;
}

export function ProcessingState({
  timedOut,
  onProceedManually,
}: ProcessingStateProps) {
  return (
    <div className="border rounded-lg p-8 flex flex-col items-center gap-4 text-center">
      <div className="relative">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
      <div>
        <p className="text-sm font-medium">Processando arquivo...</p>
        <p className="text-xs text-muted-foreground mt-1">
          A IA está extraindo os dados do email. Isso pode levar alguns
          instantes.
        </p>
      </div>

      {timedOut && (
        <div className="flex flex-col items-center gap-3 border-t pt-4 w-full">
          <div className="flex items-start gap-2 text-left bg-muted/50 rounded-lg p-3 w-full">
            <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              A extração está demorando mais que o esperado. Você pode preencher
              os campos manualmente enquanto aguarda.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onProceedManually}>
            Preencher manualmente
          </Button>
        </div>
      )}
    </div>
  );
}

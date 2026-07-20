'use client';

import { AlertTriangle, CheckCircle2, FileText, Info, Wrench } from 'lucide-react';
import { Button } from '@/components/ui';
import type { ValidationBlock } from '@/types/quotation';

interface RFQPreflightPanelProps {
  hardBlocks: ValidationBlock[];
  softWarnings: ValidationBlock[];
  rfqExists: boolean;
  isCorrectingData: boolean;
  onStartCorrection: () => void;
  onOpenRFQ: () => void;
}

export function RFQPreflightPanel({
  hardBlocks,
  softWarnings,
  rfqExists,
  isCorrectingData,
  onStartCorrection,
  onOpenRFQ,
}: RFQPreflightPanelProps) {
  if (hardBlocks.length > 0) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/20 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {hardBlocks.length} bloqueio{hardBlocks.length > 1 ? 's' : ''} impedem a criacao da RFQ
          </div>
          {!isCorrectingData && (
            <Button
              variant="outline"
              size="sm"
              onClick={onStartCorrection}
              className="gap-1.5 border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <Wrench className="w-3.5 h-3.5" />
              Corrigir dados
            </Button>
          )}
        </div>
        <div className="px-4 pb-3 flex flex-col gap-1.5 border-t border-red-200 dark:border-red-800 pt-2.5">
          {hardBlocks.map((block) => (
            <div key={block.field} className="flex items-start gap-2 text-xs">
              <span className="font-medium text-red-800 dark:text-red-300 shrink-0">{block.label}:</span>
              <span className="text-red-600 dark:text-red-400">{block.reason}</span>
            </div>
          ))}
          {softWarnings.length > 0 && (
            <div className="mt-1 pt-1.5 border-t border-red-200 dark:border-red-800 flex flex-col gap-1">
              {softWarnings.map((w) => (
                <div key={w.field} className="flex items-start gap-2 text-xs">
                  <span className="font-medium text-amber-700 dark:text-amber-400 shrink-0">{w.label}:</span>
                  <span className="text-amber-600 dark:text-amber-500">{w.reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (softWarnings.length > 0 && !rfqExists) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
            <Info className="w-4 h-4 shrink-0" />
            RFQ pode ser criada, mas ha {softWarnings.length} aviso{softWarnings.length > 1 ? 's' : ''}
          </div>
          <Button variant="ghost" size="sm" onClick={onOpenRFQ}>
            Iniciar RFQ
          </Button>
        </div>
        <div className="px-4 pb-3 flex flex-col gap-1 border-t border-amber-200 dark:border-amber-800 pt-2.5">
          {softWarnings.map((w) => (
            <div key={w.field} className="flex items-start gap-2 text-xs">
              <span className="font-medium text-amber-800 dark:text-amber-300 shrink-0">{w.label}:</span>
              <span className="text-amber-600 dark:text-amber-500">{w.reason}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!rfqExists) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-green-300 bg-green-50 dark:bg-green-950/20 px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 className="w-4 h-4" />
          Todos os campos obrigatorios preenchidos. RFQ pronta para ser criada.
        </div>
        <Button variant="ghost" size="sm" onClick={onOpenRFQ}>
          Iniciar RFQ
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 px-4 py-2.5">
      <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
        <FileText className="w-4 h-4" />
        RFQ criada. Pronta para disparar.
      </div>
      <Button variant="ghost" size="sm" onClick={onOpenRFQ}>Ver RFQ</Button>
    </div>
  );
}

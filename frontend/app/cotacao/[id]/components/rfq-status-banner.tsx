'use client';

import { AlertTriangle, CheckCircle2, FileText } from 'lucide-react';
import { Button } from '@/components/ui';

interface RFQStatusBannerProps {
  hasBlocks: boolean;
  blockCount: number;
  dispatched: boolean;
  onView: () => void;
}

export function RFQStatusBanner({ hasBlocks, blockCount, dispatched, onView }: RFQStatusBannerProps) {
  if (dispatched) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-green-300 bg-green-50 dark:bg-green-950/20 px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 className="w-4 h-4" />
          RFQ disparada para os agentes.
        </div>
        <Button variant="ghost" size="sm" onClick={onView}>Ver detalhes</Button>
      </div>
    );
  }
  if (hasBlocks) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/20 px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="w-4 h-4" />
          RFQ com {blockCount} bloqueio{blockCount > 1 ? 's' : ''} critico{blockCount > 1 ? 's' : ''}. Preencha os campos obrigatorios.
        </div>
        <Button variant="ghost" size="sm" onClick={onView}>Resolver</Button>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 px-4 py-2.5">
      <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
        <FileText className="w-4 h-4" />
        RFQ criada. Pronta para disparar.
      </div>
      <Button variant="ghost" size="sm" onClick={onView}>Ver RFQ</Button>
    </div>
  );
}

'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Selo de desfecho de um embarque conciliado. Vive num arquivo próprio porque a
 * lista compacta e o cabeçalho do detalhe mostram O MESMO selo — se cada um
 * desenhasse o seu, um poderia dizer "Sem divergência" enquanto o outro conta
 * duas.
 */
export function DivergenceBadge({
  divergences,
  className,
}: {
  divergences: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'portal-small inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-medium',
        divergences > 0
          ? 'border-portal-danger/30 bg-portal-danger/10 text-portal-danger'
          : 'border-portal-success/25 bg-portal-success/10 text-portal-success',
        className,
      )}
    >
      {divergences > 0 ? (
        <>
          <AlertTriangle className="h-4 w-4" />
          {divergences} {divergences === 1 ? 'divergência' : 'divergências'}
        </>
      ) : (
        <>
          <CheckCircle2 className="h-4 w-4" />
          Sem divergência
        </>
      )}
    </span>
  );
}

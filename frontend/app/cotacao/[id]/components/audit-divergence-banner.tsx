'use client';

import { AlertTriangle, Info, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AuditDivergencia } from '@/types/quotation';

interface AuditDivergenceBannerProps {
  divergencias: AuditDivergencia[];
  className?: string;
}

const FONTE_LABELS: Record<string, string> = {
  dna_cliente: 'DNA do cliente',
  cadastro_exportador: 'Cadastro do exportador',
  cotacao_solicitada: 'Cotação solicitada',
};

export function AuditDivergenceBanner({ divergencias, className }: AuditDivergenceBannerProps) {
  const strict = divergencias.filter((d) => d.tipo_validacao === 'strict');
  const flexible = divergencias.filter((d) => d.tipo_validacao === 'flexible');

  if (divergencias.length === 0) return null;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {strict.length > 0 && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-800">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            <span className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide">
              Bloqueios criticos — {strict.length} {strict.length === 1 ? 'regra' : 'regras'} DNA
            </span>
          </div>
          <div className="flex flex-col divide-y divide-red-100 dark:divide-red-900">
            {strict.map((d, i) => (
              <DivergenceRow key={i} divergencia={d} />
            ))}
          </div>
        </div>
      )}

      {flexible.length > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
              Avisos flexiveis — {flexible.length} {flexible.length === 1 ? 'item' : 'itens'} a revisar
            </span>
          </div>
          <div className="flex flex-col divide-y divide-amber-100 dark:divide-amber-900">
            {flexible.map((d, i) => (
              <DivergenceRow key={i} divergencia={d} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DivergenceRow({ divergencia: d }: { divergencia: AuditDivergencia }) {
  const isStrict = d.tipo_validacao === 'strict';
  const fonte = FONTE_LABELS[d.fonte_esperado] ?? d.fonte_esperado;

  return (
    <div
      className={cn(
        'px-3 py-2.5 flex flex-col gap-1.5 text-sm',
        isStrict
          ? 'bg-white dark:bg-background'
          : 'bg-white dark:bg-background',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span
            className={cn(
              'text-xs font-semibold',
              isStrict
                ? 'text-red-800 dark:text-red-300'
                : 'text-amber-800 dark:text-amber-300',
            )}
          >
            {d.mensagem}
          </span>
          <span className="text-[11px] text-muted-foreground">
            Campo: <code className="font-mono">{d.campo}</code> · Fonte: {fonte}
          </span>
        </div>
      </div>

      {d.sugestao != null && (
        <div className="flex items-start gap-1.5 rounded bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-2 py-1.5">
          <Lightbulb className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <span className="text-xs text-amber-800 dark:text-amber-300">
            <span className="font-medium">Sugestao:</span>{' '}
            {typeof d.sugestao === 'string'
              ? d.sugestao
              : JSON.stringify(d.sugestao)}
          </span>
        </div>
      )}
    </div>
  );
}

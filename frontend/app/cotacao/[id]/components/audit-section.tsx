'use client';

import { AlertTriangle, CheckCircle2, Clock, Info, Lightbulb, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuotationAudit } from '@/hooks/use-quotations';
import type { CotacaoAuditoria } from '@/types/quotation';

const MOMENTO_LABELS: Record<number, string> = {
  1: 'M1 — Pre-Despacho',
  2: 'M2 — Pos-Proposta',
  3: 'M3 — Pre-Link Cliente',
};

const RESULTADO_CONFIG = {
  aprovado: {
    label: 'Aprovado',
    icon: CheckCircle2,
    className: 'text-green-700 dark:text-green-400',
    badgeClass: 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400',
  },
  divergente: {
    label: 'Divergente',
    icon: AlertTriangle,
    className: 'text-amber-700 dark:text-amber-400',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400',
  },
  bloqueado: {
    label: 'Bloqueado',
    icon: ShieldAlert,
    className: 'text-red-700 dark:text-red-400',
    badgeClass: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400',
  },
};

const SEVERIDADE_ORDER = { critico: 0, alto: 1, medio: 2, baixo: 3 };

function AuditRecordCard({ record }: { record: CotacaoAuditoria }) {
  const config = RESULTADO_CONFIG[record.resultado];
  const Icon = config.icon;

  const sorted = [...record.divergencias].sort(
    (a, b) => SEVERIDADE_ORDER[a.severidade] - SEVERIDADE_ORDER[b.severidade],
  );

  const strict = sorted.filter((d) => d.tipo_validacao === 'strict');
  const flexible = sorted.filter((d) => d.tipo_validacao === 'flexible');

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {MOMENTO_LABELS[record.momento] ?? `Momento ${record.momento}`}
          </span>
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', config.badgeClass)}>
            <Icon className="w-3 h-3" />
            {config.label}
          </span>
          {record.acao_tomada === 'passivo' && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
              Modo passivo
            </span>
          )}
        </div>
        <time className="text-xs text-muted-foreground">
          {new Date(record.timestamp).toLocaleString('pt-BR')}
        </time>
      </div>

      {record.divergencias.length === 0 ? (
        <div className="flex items-center gap-2 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Nenhuma divergencia detectada.
        </div>
      ) : (
        <div className="p-4 flex flex-col gap-3">
          {strict.length > 0 && (
            <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 overflow-hidden">
              <div className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 border-b border-red-200 dark:border-red-800">
                <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                  Divergencias Bloqueantes ({strict.length})
                </p>
              </div>
              <div className="divide-y divide-red-100 dark:divide-red-900/40">
                {strict.map((d, i) => (
                  <div key={i} className="px-3 py-2.5 flex flex-col gap-1">
                    <p className="text-sm text-red-700 dark:text-red-300">{d.mensagem}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-red-600 dark:text-red-400">
                      <span>Campo: <span className="font-medium">{d.campo}</span></span>
                      <span>Fonte: <span className="font-medium">{d.fonte_esperado}</span></span>
                    </div>
                    {d.sugestao && (
                      <div className="flex items-start gap-1.5 mt-0.5 text-xs text-red-600 dark:text-red-400">
                        <Lightbulb className="w-3 h-3 mt-0.5 shrink-0" />
                        <span>{d.sugestao}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {flexible.length > 0 && (
            <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 overflow-hidden">
              <div className="px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                  Alertas ({flexible.length})
                </p>
              </div>
              <div className="divide-y divide-amber-100 dark:divide-amber-900/40">
                {flexible.map((d, i) => (
                  <div key={i} className="px-3 py-2.5 flex flex-col gap-1">
                    <p className="text-sm text-amber-700 dark:text-amber-300">{d.mensagem}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-amber-600 dark:text-amber-400">
                      <span>Campo: <span className="font-medium">{d.campo}</span></span>
                      <span>Fonte: <span className="font-medium">{d.fonte_esperado}</span></span>
                    </div>
                    {d.sugestao && (
                      <div className="flex items-start gap-1.5 mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                        <Lightbulb className="w-3 h-3 mt-0.5 shrink-0" />
                        <span>{d.sugestao}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {record.resolucao_tipo && (
        <div className="px-4 py-2.5 border-t bg-muted/20 flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="w-3.5 h-3.5 shrink-0" />
          Resolucao: <span className="font-medium text-foreground">{record.resolucao_tipo}</span>
          {record.observacao && <> — {record.observacao}</>}
        </div>
      )}
    </div>
  );
}

export function AuditSection({ quotationId }: { quotationId: string }) {
  const { records, isLoading, isError } = useQuotationAudit(quotationId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground justify-center">
        <Clock className="w-4 h-4 animate-spin" />
        Carregando historico de auditoria...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-10 text-center text-sm text-destructive">
        Erro ao carregar historico de auditoria.
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        Nenhum registro de auditoria encontrado para esta cotacao.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Historico de Auditoria — {records.length} registro{records.length !== 1 ? 's' : ''}
      </p>
      {records.map((record) => (
        <AuditRecordCard key={record.id} record={record} />
      ))}
    </div>
  );
}

'use client';

import { AlertTriangle, CheckCircle2, Gavel } from 'lucide-react';

import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { formatBRL } from '@/lib/portal-formatters';

import {
  DIVERGENCE_THRESHOLD_PCT,
  evaluateExample,
  type ConciliationExample,
  type EvaluatedLine,
} from '../lib/conciliation';

const formatValue = (value: number, kind: EvaluatedLine['kind']): string =>
  kind === 'currency' ? formatBRL(value) : `${value} dias`;

/**
 * Camada 1 (conciliação planejado × realizado) + Camada 2 (árvore de decisão)
 * de UM embarque de exemplo. A leitura de cada linha vem de `evaluateLine`:
 * if/else sobre o limite de divergência, nada de IA.
 */
export function ConciliationTable({
  example,
  onDispute,
}: {
  example: ConciliationExample;
  onDispute: (line: EvaluatedLine) => void;
}) {
  const lines = evaluateExample(example);
  const divergences = lines.filter((l) => l.status === 'divergent').length;

  return (
    <section className="space-y-4 rounded-xl border border-dashed border-border bg-muted/20 p-6">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="portal-h3 text-foreground">{example.reference}</p>
          <p className="portal-small text-portal-neutral">
            {example.route} · {example.agent}
          </p>
        </div>
        <span
          className={cn(
            'portal-small inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-medium',
            divergences > 0
              ? 'border-portal-danger/30 bg-portal-danger/10 text-portal-danger'
              : 'border-portal-success/25 bg-portal-success/10 text-portal-success',
          )}
        >
          {divergences > 0 ? (
            <>
              <AlertTriangle className="h-3.5 w-3.5" />
              {divergences}{' '}
              {divergences === 1 ? 'divergência' : 'divergências'}
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Sem divergência
            </>
          )}
        </span>
      </header>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="portal-small font-medium text-portal-neutral">
                Item
              </TableHead>
              <TableHead className="portal-small font-medium text-portal-neutral">
                Planejado (cotação)
              </TableHead>
              <TableHead className="portal-small font-medium text-portal-neutral">
                Realizado (NF final)
              </TableHead>
              <TableHead className="portal-small font-medium text-portal-neutral">
                Diferença
              </TableHead>
              <TableHead className="portal-small font-medium text-portal-neutral">
                Leitura
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => {
              const divergent = line.status === 'divergent';
              return (
                <TableRow key={line.item} className="hover:bg-transparent">
                  <TableCell className="portal-body font-medium text-foreground">
                    {line.item}
                  </TableCell>
                  <TableCell className="portal-body text-portal-neutral">
                    {formatValue(line.planned, line.kind)}
                  </TableCell>
                  <TableCell className="portal-body text-portal-neutral">
                    {formatValue(line.realized, line.kind)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'portal-body font-medium',
                      divergent ? 'text-portal-danger' : 'text-portal-neutral',
                    )}
                  >
                    {line.difference === 0 ? (
                      '—'
                    ) : (
                      <>
                        {line.difference > 0 ? '+' : '−'}
                        {formatValue(Math.abs(line.difference), line.kind)}{' '}
                        <span className="portal-small">
                          ({line.variationPct > 0 ? '+' : ''}
                          {line.variationPct}%)
                        </span>
                      </>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      {divergent ? (
                        <span className="portal-small inline-flex items-center gap-1 font-medium text-portal-danger">
                          <AlertTriangle className="h-4 w-4" />
                          Diverge
                        </span>
                      ) : (
                        <span className="portal-small inline-flex items-center gap-1 font-medium text-portal-success">
                          <CheckCircle2 className="h-4 w-4" />
                          Bate
                        </span>
                      )}
                      {line.suggestContest ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => onDispute(line)}
                        >
                          <Gavel className="h-4 w-4" />
                          Sugerimos contestar
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="portal-small text-portal-neutral">
        Uma linha é marcada como divergente quando a variação sobre o planejado
        passa de {DIVERGENCE_THRESHOLD_PCT}% — o mesmo limite usado na conferência
        da cotação. A sugestão de contestar aparece quando a diferença é para
        cima.
      </p>
    </section>
  );
}

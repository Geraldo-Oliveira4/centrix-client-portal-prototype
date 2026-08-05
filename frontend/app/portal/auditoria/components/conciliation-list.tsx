'use client';

import { ChevronRight, Gavel } from 'lucide-react';

import { cn } from '@/lib/utils';

import {
  summarizeExample,
  type ConciliationExample,
} from '../lib/conciliation';
import { DivergenceBadge } from './divergence-badge';

/**
 * Lista compacta da Conciliação — o estado padrão da Camada 1.
 *
 * Antes as cinco tabelas ficavam abertas ao mesmo tempo, o que dava à tela o
 * peso de um relatório e escondia a pergunta que a lista responde primeiro
 * ("algum embarque divergiu?") atrás de ~20 linhas de item. É o mesmo padrão
 * resumo -> detalhe de Meus Embarques > Lista: aqui o resumo é o desfecho da
 * árvore de decisão, e a tabela item a item vive na view de detalhe.
 *
 * Nada muda de status: os exemplos continuam fictícios (prefixo EXEMPLO-), o
 * banner "Conceitual" e o selo "Pré-visualização" seguem intactos. É só
 * hierarquia visual.
 */
export function ConciliationList({
  examples,
  onOpen,
}: {
  examples: ConciliationExample[];
  onOpen: (example: ConciliationExample) => void;
}) {
  return (
    <div className="space-y-3">
      {examples.map((example) => {
        const { divergences, hasContestable } = summarizeExample(example);
        return (
          <button
            key={example.reference}
            type="button"
            onClick={() => onOpen(example)}
            className={cn(
              'block w-full space-y-3 rounded-xl border border-dashed border-border bg-muted/20 p-4 text-left transition-colors',
              'hover:border-primary/40 hover:bg-muted/40',
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <p className="portal-body font-medium text-foreground">
                  {example.reference}
                </p>
                <p className="portal-small text-portal-neutral">
                  {example.route} · {example.agent}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <DivergenceBadge divergences={divergences} />
                {hasContestable && (
                  <span className="portal-small inline-flex items-center gap-1.5 rounded border border-portal-warning/30 bg-portal-warning/10 px-2 py-0.5 font-medium text-portal-warning">
                    <Gavel className="h-3.5 w-3.5" />
                    Sugerimos contestar
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-dashed pt-3">
              <span className="portal-small text-portal-neutral">
                {example.lines.length}{' '}
                {example.lines.length === 1 ? 'item conciliado' : 'itens conciliados'}
              </span>
              <span className="portal-small inline-flex items-center gap-1 font-medium text-primary">
                Ver detalhe
                <ChevronRight className="h-4 w-4" />
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

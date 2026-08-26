'use client';

import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  PORTAL_BUCKET_LABELS,
  type PortalBucketKey,
  type PortalQuotation,
} from '@/types/portal';

import { QuotationCard } from './quotation-card';

interface KanbanColumnProps {
  bucket: PortalBucketKey;
  quotations: PortalQuotation[];
}

const DEFAULT_ACCENT: Record<PortalBucketKey, string> = {
  // Semantic accents: waiting on the client or on Freitas = warning, in
  // progress = info, ready for the client to decide = success. The two terminal
  // buckets no longer have a column (they live in the Histórico list), but the
  // map stays exhaustive over PortalBucketKey.
  aguardando_dados: 'border-t-portal-warning',
  buscando_propostas: 'border-t-portal-info',
  aguardando_aprovacao: 'border-t-portal-success',
  finalizadas: 'border-t-portal-neutral/40',
  cancelada: 'border-t-portal-neutral/40',
};

export function KanbanColumn({ bucket, quotations }: KanbanColumnProps) {
  return (
    <div
      className={cn(
        // Largura elastica, nao fixa: as colunas dividem em partes iguais
        // (`flex-1`, base 0) a largura do container, para nao sobrar vao a
        // direita em tela larga. Os dois limites existem por motivos opostos:
        // `min-w-80` e o piso de legibilidade do card (abaixo disso o preco e a
        // rota comecam a quebrar) e devolve o scroll horizontal em tela
        // estreita; `max-w-[34rem]` e o teto — o card tem linhas em
        // `justify-between` (rota x propostas/validade) que viram um vao
        // estranho dentro do proprio card se a coluna esticar sem limite.
        // Com 3 colunas o teto nao morde ate ~1700px de container, entao em
        // 1440px e 1920px elas preenchem a largura inteira.
        'flex flex-1 min-w-80 max-w-[34rem] flex-col rounded-xl border border-t-4 bg-white/60',
        DEFAULT_ACCENT[bucket],
      )}
    >
      <header className="flex shrink-0 items-center justify-between rounded-t-xl px-4 py-3">
        <h2 className="portal-small font-medium uppercase tracking-wide text-portal-neutral">
          {PORTAL_BUCKET_LABELS[bucket]}
        </h2>
        <span className="portal-small rounded bg-muted px-2 py-0.5 tabular-nums text-portal-neutral">
          {quotations.length}
        </span>
      </header>

      <ScrollArea className="flex-1 max-h-[calc(100vh-220px)]">
        <div className="space-y-2 p-2">
          {quotations.length === 0 ? (
            <p className="portal-small py-8 text-center text-portal-neutral">
              Nenhuma cotação.
            </p>
          ) : (
            quotations.map((q) => (
              <QuotationCard key={q.id} quotation={q} bucket={bucket} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

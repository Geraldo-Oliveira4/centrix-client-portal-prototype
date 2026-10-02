'use client';

import Link from 'next/link';
import { ChevronRight, CircleDot } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatShortDate } from '@/lib/portal-formatters';

import { ProvenanceBadge } from './provenance-badge';

/**
 * "Atualizações" — o feed de leitura do portal (feedback do Orsi, 02/10/2026).
 *
 * Nasceu de "Mudanças relevantes", que saiu da Central de trabalho: lá ele era
 * uma segunda lista de tarefas ("Já vi", impacto a revisar, contador). Aqui ele
 * é só LEITURA, e as regras abaixo é que o mantêm assim:
 *
 *   - Sem estado de lido, sem "marcar todas", sem contador no título. Contador
 *     e check transformam informação em pendência.
 *   - Sem CTA de ação. Cada linha leva ao contexto (o embarque); o que exige
 *     ação do cliente já está em "Precisam de você" e na Central.
 *   - Cor só onde a escala de urgência deixa (`_shared/urgency.ts`): `critical`
 *     é reservado a custo correndo (container liberado / demurrage). O resto é
 *     neutro; `success` é a confirmação discreta de algo que deu certo.
 *   - Corte declarado: mostra `max` e diz quantas ficaram de fora.
 *
 * O mesmo desenho existe dentro da Central (iframe `centrix-visao-geral`,
 * `updatesFeed` em `work.js`) para a Operação, porque o iframe não importa
 * React. Mudou a anatomia aqui, mude lá.
 */
export interface UpdateItem {
  id: string;
  /** ISO real do evento. Nunca inventado. */
  at: string;
  title: string;
  /** Uma linha de contexto: referência, PO, rota. */
  context?: string;
  href?: string;
  tone?: 'neutral' | 'success' | 'critical';
}

const TONE_DOT: Record<NonNullable<UpdateItem['tone']>, string> = {
  neutral: 'text-portal-neutral',
  success: 'text-portal-success-ink',
  critical: 'text-portal-danger-ink',
};

export function UpdatesFeed({
  items,
  max = 5,
  description,
  emptyText = 'Nenhuma atualização recente.',
  preview = false,
  className,
}: {
  items: UpdateItem[];
  max?: number;
  description?: string;
  emptyText?: string;
  /** Selo `preview` quando o feed é ilustrativo. */
  preview?: boolean;
  className?: string;
}) {
  const sorted = [...items].sort((a, b) => b.at.localeCompare(a.at));
  const shown = sorted.slice(0, max);
  const hidden = sorted.length - shown.length;

  return (
    <section
      className={cn('portal-card p-5', className)}
      aria-labelledby="updates-feed-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="updates-feed-title" className="portal-h3">
          Atualizações
        </h2>
        {preview && <ProvenanceBadge provenance="preview" />}
      </div>
      {description && (
        <p className="portal-small mt-1 text-portal-neutral">{description}</p>
      )}

      {shown.length === 0 ? (
        <p className="portal-small mt-4 text-portal-neutral">{emptyText}</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {shown.map((item) => {
            const body = (
              <>
                <CircleDot
                  className={cn(
                    'mt-1 h-3.5 w-3.5 shrink-0',
                    TONE_DOT[item.tone ?? 'neutral'],
                  )}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="portal-small block font-medium text-foreground">
                    {item.title}
                  </span>
                  <span className="portal-small block text-portal-neutral">
                    {[formatShortDate(item.at), item.context]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                {item.href && (
                  <ChevronRight
                    className="mt-1 h-4 w-4 shrink-0 text-portal-neutral"
                    aria-hidden="true"
                  />
                )}
              </>
            );
            return (
              <li key={item.id}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="flex gap-3 rounded-md px-1 py-2.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="flex gap-3 px-1 py-2.5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {hidden > 0 && (
        <p className="portal-small mt-3 text-portal-neutral">
          Mostrando as {shown.length} mais recentes de {sorted.length}.
        </p>
      )}
    </section>
  );
}

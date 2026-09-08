'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { cn } from '@/lib/utils';

import {
  TOWER_MODULE_LABEL,
  type TowerColumnData,
  type TowerItem,
} from '../lib/control-tower';

/**
 * Uma das duas colunas da Torre de Controle. Puramente presentacional — quem
 * decide o que entra em qual coluna, em que ordem e onde cortar é
 * `lib/control-tower.ts`.
 *
 * O acento da linha (barra à esquerda + badge) é SEMÁFORO, porque fala de
 * estado. O CTA é ROSA em toda linha, inclusive nas vermelhas: no portal a cor
 * de marca significa AÇÃO e o semáforo significa ESTADO.
 *
 * Estado vazio é TEXTO, nunca uma linha de exemplo: cliente sem itens numa
 * coluna não recebe dado fabricado para a coluna não parecer quebrada.
 *
 * O CORTE É DECLARADO. O rodapé conta quantos ficaram de fora e leva ao módulo
 * onde eles estão inteiros — truncar em silêncio leria como "é só isso".
 */

const TONE_BAR: Record<TowerItem['tone'], string> = {
  danger: 'bg-portal-danger',
  warning: 'bg-portal-warning',
  info: 'bg-portal-info',
};

const MODULE_BADGE: Record<TowerItem['module'], string> = {
  cotacao: 'bg-portal-info/10 text-portal-info border-portal-info/25',
  embarque: 'bg-brand-indigo-100 text-brand-indigo border-brand-indigo-800/20',
};

export interface TowerColumnLink {
  href: string;
  label: string;
}

export function TowerColumn({
  title,
  hint,
  column,
  emptyMessage,
  links,
}: {
  title: string;
  /** Uma linha explicando o critério da coluna. */
  hint: string;
  column: TowerColumnData;
  emptyMessage: string;
  /** Para onde o cliente vê o resto: o Funil, a Lista, ou os dois. */
  links: TowerColumnLink[];
}) {
  const { items, total, hidden, hiddenSpansBothModules } = column;

  return (
    <section className="portal-card flex flex-col gap-4 p-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="portal-h2">{title}</h2>
          <span className="portal-small tabular-nums text-portal-neutral">
            {total}
          </span>
        </div>
        <p className="portal-small text-portal-neutral">{hint}</p>
      </div>

      {items.length === 0 ? (
        <p className="portal-body rounded-md border border-dashed p-4 text-portal-neutral">
          {emptyMessage}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="relative overflow-hidden rounded-md border bg-background p-4 pl-5"
            >
              <span
                aria-hidden="true"
                className={cn(
                  'absolute inset-y-0 left-0 w-1',
                  TONE_BAR[item.tone],
                )}
              />
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'portal-small rounded border px-1.5 py-0.5 font-medium',
                    MODULE_BADGE[item.module],
                  )}
                >
                  {TOWER_MODULE_LABEL[item.module]}
                </span>
                <span className="portal-body font-medium text-foreground">
                  {item.reference}
                </span>
              </div>
              <p className="portal-body mt-2 font-medium text-foreground">
                {item.title}
              </p>
              <p className="portal-small mt-1 text-portal-neutral">
                {item.description}
              </p>
              <Link
                href={item.href}
                className="portal-small mt-2 inline-flex items-center gap-1 font-medium text-brand-indigo hover:underline"
              >
                {item.ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {hidden > 0 ? (
        <p className="portal-small mt-auto border-t pt-3 text-portal-neutral">
          {/* "entre os dois módulos" só aparece quando é verdade: a coluna de
              prazo é só de embarque, e dizê-lo ali seria prometer uma cotação
              que não existe naquele resto. */}
          +{hidden} {hidden === 1 ? 'item mais' : 'itens mais'}
          {hiddenSpansBothModules ? ', entre os dois módulos' : ''}. Ver em{' '}
          {links.map((link, index) => (
            <span key={link.href}>
              {index > 0 ? ' ou ' : ''}
              <Link
                href={link.href}
                className="font-medium text-brand-indigo hover:underline"
              >
                {link.label}
              </Link>
            </span>
          ))}
          .
        </p>
      ) : null}
    </section>
  );
}

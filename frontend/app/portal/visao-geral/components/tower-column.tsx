'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { cn } from '@/lib/utils';

import {
  TOWER_MODULE_LABEL,
  type TowerItem,
} from '../lib/control-tower';

/**
 * Uma das duas colunas da Torre de Controle. Puramente presentacional — quem
 * decide o que entra em qual coluna é `lib/control-tower.ts`.
 *
 * O acento da linha (barra à esquerda + badge) é SEMÁFORO, porque fala de
 * estado. O CTA é ROSA em toda linha, inclusive nas vermelhas: no portal a cor
 * de marca significa AÇÃO e o semáforo significa ESTADO — a mesma regra da
 * `ActionList` da Home.
 *
 * Estado vazio é TEXTO, nunca uma linha de exemplo: cliente sem itens numa
 * coluna não recebe dado fabricado para a coluna não parecer quebrada.
 */

const TONE_BAR: Record<TowerItem['tone'], string> = {
  danger: 'bg-portal-danger',
  warning: 'bg-portal-warning',
  info: 'bg-portal-info',
};

const MODULE_BADGE: Record<TowerItem['module'], string> = {
  cotacao: 'bg-portal-info/10 text-portal-info border-portal-info/25',
  embarque: 'bg-brand-navy/10 text-brand-navy border-brand-navy/20',
};

export function TowerColumn({
  title,
  hint,
  items,
  emptyMessage,
}: {
  title: string;
  /** Uma linha explicando o critério da coluna. */
  hint: string;
  items: TowerItem[];
  emptyMessage: string;
}) {
  return (
    <section className="portal-card flex flex-col gap-4 p-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="portal-h2 text-foreground">{title}</h2>
          <span className="portal-small tabular-nums text-portal-neutral">
            {items.length}
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
                className="portal-small mt-2 inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                {item.ctaLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

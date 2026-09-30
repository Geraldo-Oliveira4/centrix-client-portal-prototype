'use client';

// O padrão de INSIGHT do portal (ver DESIGN.md): selo de variação — seta, cor
// e texto, nunca só cor — seguido da frase que interpreta o número. Regra em
// `insight.ts`; o iframe da Inteligência desenha o mesmo padrão em JS.

import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { InsightTone, Variation } from './insight';

const TONE: Record<InsightTone, string> = {
  good: 'bg-portal-success/10 text-portal-success-ink',
  bad: 'bg-portal-danger/10 text-portal-danger-ink',
  neutral: 'bg-muted text-portal-neutral',
};

export function InsightLine({
  variation,
  sentence,
  className,
}: {
  variation: Variation | null;
  /** A leitura do número em linguagem do cliente. */
  sentence: string;
  className?: string;
}) {
  const Arrow =
    variation?.direction === 'up'
      ? ArrowUpRight
      : variation?.direction === 'down'
        ? ArrowDownRight
        : ArrowRight;
  return (
    <div className={cn('space-y-1.5', className)}>
      {variation && (
        <span
          className={cn(
            'portal-small inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium',
            TONE[variation.tone],
          )}
        >
          <Arrow aria-hidden="true" className="h-4 w-4 shrink-0" />
          {variation.text}
        </span>
      )}
      <p className="portal-body text-foreground">{sentence}</p>
    </div>
  );
}

'use client';

// Os QUATRO selos do comparativo, e são quatro conceitos diferentes:
//
//   FATOS (contorno, sem preenchimento) — saem só dos números da tabela:
//     Menor preço  (menor TOTAL EM BRL)
//     Menor prazo  (menor transit time)
//   DECISÕES (placa preenchida) — alguém decidiu:
//     Recomendada  (a recomendação que o analista da Freitas aprovou; `info`,
//                   porque é o sistema sugerindo — recomendação nunca é verde)
//     Escolhida    (a proposta que o cliente aprovou; `success`, é desfecho)
//
// Nenhum é só cor: todo selo tem ícone e a palavra. A legenda abaixo da barra
// de ordenação diz isso ao cliente.

import { CheckCircle2, CircleDollarSign, Sparkles, Timer } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type ProposalBadgeKind = 'menorPreco' | 'menorPrazo' | 'recomendada' | 'escolhida';

const BADGES: Record<
  ProposalBadgeKind,
  { label: string; icon: ReactNode; className: string; meaning: string }
> = {
  menorPreco: {
    label: 'Menor preço',
    icon: <CircleDollarSign className="h-4 w-4" aria-hidden />,
    className: 'border border-brand-indigo-800/40 bg-transparent text-brand-indigo',
    meaning: 'Fato: menor total em BRL entre as propostas válidas.',
  },
  menorPrazo: {
    label: 'Menor prazo',
    icon: <Timer className="h-4 w-4" aria-hidden />,
    className:
      'border border-dashed border-brand-indigo-800/40 bg-transparent text-brand-indigo',
    meaning: 'Fato: menor transit time entre as propostas válidas.',
  },
  recomendada: {
    label: 'Recomendada',
    icon: <Sparkles className="h-4 w-4" aria-hidden />,
    className: 'border border-portal-info/30 bg-portal-info/10 text-portal-info',
    meaning: 'Decisão: recomendação aprovada pela equipe Freitas.',
  },
  escolhida: {
    label: 'Escolhida',
    icon: <CheckCircle2 className="h-4 w-4" aria-hidden />,
    className:
      'border border-portal-success/40 bg-portal-success/10 font-medium text-portal-success-ink',
    meaning: 'Decisão: a proposta que você aprovou.',
  },
};

export function ProposalBadge({ kind }: { kind: ProposalBadgeKind }) {
  const b = BADGES[kind];
  return (
    <span
      className={cn(
        'portal-small inline-flex items-center gap-1 rounded-full px-2 py-0.5 whitespace-nowrap',
        b.className,
      )}
      title={b.meaning}
    >
      {b.icon}
      {b.label}
    </span>
  );
}

export function BadgeLegend() {
  return (
    <div className="portal-small flex flex-wrap items-center gap-x-4 gap-y-2 text-portal-neutral">
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-foreground">Fatos:</span>
        <ProposalBadge kind="menorPreco" />
        <ProposalBadge kind="menorPrazo" />
        <span>calculados dos números da tabela.</span>
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-foreground">Decisões:</span>
        <ProposalBadge kind="recomendada" />
        <span>pela equipe Freitas ·</span>
        <ProposalBadge kind="escolhida" />
        <span>por você.</span>
      </span>
    </div>
  );
}

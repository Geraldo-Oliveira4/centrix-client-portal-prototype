'use client';

// Selos e textos compartilhados da jornada por PO.
//
// Um lugar só para o selo, pelo mesmo motivo da Cotação V2: "Em análise" não
// pode ser âmbar na lista e outra coisa no detalhe. Os tons vêm do semáforo do
// portal — warning enquanto a Freitas segura, success quando ativa, neutro para
// um rascunho que nunca saiu das mãos do cliente.
//
// `portal-warning-ink` para TEXTO (o fill #C98A00 dá 2.95:1 sobre branco e
// reprova AA); o fill fica no preenchimento do selo.

import { CheckCircle2, FileEdit, Hourglass, Undo2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

import { PO_STAGE_LABELS, type PoStage } from './shipment-po-review';

/**
 * Prazo da revisão do embarque.
 *
 * PLACEHOLDER. A spec diz "[SLA a definir]" nas Telas 7, 8 e 10 e a Open
 * Question 13 segue aberta com o Orsi. É uma constante só para que trocar o
 * prazo seja uma edição, não uma busca pelas telas.
 */
export const PO_REVIEW_SLA_LABEL = 'até 4 horas úteis';

const STAGE_BADGE: Record<PoStage, { icon: LucideIcon; className: string }> = {
  draft: { icon: FileEdit, className: 'bg-muted text-portal-neutral' },
  awaiting_review: {
    icon: Hourglass,
    className: 'bg-portal-warning/15 text-portal-warning-ink',
  },
  returned: {
    icon: Undo2,
    className: 'bg-portal-warning/15 text-portal-warning-ink',
  },
  active: {
    icon: CheckCircle2,
    className: 'bg-portal-success/15 text-portal-success',
  },
};

export function PoStageBadge({
  stage,
  className,
}: {
  stage: PoStage;
  className?: string;
}) {
  const { icon: Icon, className: tone } = STAGE_BADGE[stage];
  return (
    <span
      className={cn(
        'portal-small inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 font-medium',
        tone,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {PO_STAGE_LABELS[stage]}
    </span>
  );
}

/**
 * "Sem cotação" (Tela 7) e "Sem cotação vinculada" (Tela 9).
 *
 * Neutro, nunca vermelho: não ter cotação é um caminho legítimo de abertura —
 * é o caminho que esta jornada inteira existe para servir —, não um problema.
 */
export function NoQuotationChip({
  long = false,
  className,
}: {
  long?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'portal-small inline-flex shrink-0 items-center rounded border border-border px-1.5 py-0.5 text-portal-neutral',
        className,
      )}
    >
      {long ? 'Sem cotação vinculada' : 'Sem cotação'}
    </span>
  );
}

/** "Aguardando revisão da Freitas desde 10:32. Prazo: até 4 horas úteis." */
export function poNextStepLabel(since: string): string {
  const at = new Date(since);
  const time = Number.isNaN(at.getTime())
    ? null
    : at.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return time
    ? `Aguardando revisão da Freitas desde ${time}. Prazo: ${PO_REVIEW_SLA_LABEL}.`
    : `Aguardando revisão da Freitas. Prazo: ${PO_REVIEW_SLA_LABEL}.`;
}

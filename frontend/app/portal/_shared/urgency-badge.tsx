'use client';

// O desenho da escala de urgência (`urgency.ts`). UM componente para o selo e
// UM mapa para o acento de borda, para que "Prazo vencido" tenha a mesma cara
// no cartão do Kanban, na linha de Embarques e na Home.
//
// Cor SEMPRE com ícone e texto (o `reason`). Texto na cor do INK, placa no tom
// /10 — ver os tokens `portal-*-ink` em `styles/globals.css`.

import { AlertOctagon, CheckCircle2, Clock3 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { Urgency, UrgencyLevel } from './urgency';

const BADGE: Record<
  UrgencyLevel,
  { icon: LucideIcon | null; className: string }
> = {
  critico: {
    icon: AlertOctagon,
    className: 'bg-portal-danger/10 text-portal-danger-ink',
  },
  atencao: {
    icon: Clock3,
    className: 'bg-portal-warning/10 text-portal-warning-ink',
  },
  // Normal nao e selo: e texto neutro. Um selo cinza em cada linha seria mais
  // um elemento disputando o olho sem dizer nada urgente.
  normal: { icon: null, className: 'text-portal-neutral' },
  ok: {
    icon: CheckCircle2,
    className: 'bg-portal-success/10 text-portal-success-ink',
  },
};

/**
 * Acento de borda esquerda de um cartão. Só os dois níveis com ênfase pintam;
 * normal e ok ficam na borda comum — o concluído não precisa chamar atenção.
 */
export const URGENCY_BORDER_CLASS: Record<UrgencyLevel, string> = {
  critico: 'border-l-portal-danger',
  atencao: 'border-l-portal-warning',
  normal: 'border-l-border',
  ok: 'border-l-border',
};

export function UrgencyBadge({
  urgency,
  className,
}: {
  urgency: Urgency;
  className?: string;
}) {
  const { icon: Icon, className: tone } = BADGE[urgency.level];
  return (
    <span
      className={cn(
        'portal-small inline-flex shrink-0 items-center gap-1 font-medium',
        Icon && 'rounded px-1.5 py-0.5',
        tone,
        className,
      )}
    >
      {Icon && <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
      {urgency.reason}
    </span>
  );
}

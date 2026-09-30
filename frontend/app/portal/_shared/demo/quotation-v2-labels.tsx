'use client';

// The V2 seals and the copy the screens share.
//
// ONE PLACE for the badge so "Em revisão" cannot be orange on the card and
// something else on the detail. The tones come from the portal's semáforo
// (`_shared/tone.ts` conventions): warning for the two reviews — the Freitas is
// holding the quotation — success for released, neutral for a draft that has
// not left the client's hands.
//
// `portal-warning-ink` and not `portal-warning` for the TEXT: #C98A00 on white
// is 2.95:1 and fails AA for copy. The rule and its two tones are documented in
// the portal design system section of `frontend/CLAUDE.md`.

import { CheckCircle2, Clock3, FileEdit, UserCheck, Undo2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

import {
  V2_STAGE_DESCRIPTIONS,
  V2_STAGE_LABELS,
  type V2Stage,
} from './quotation-review';

/**
 * Prazo estimado da revisão de entrada.
 *
 * PLACEHOLDER. The spec says "[SLA a definir]" for RQ-3 and RQ-7: nobody has
 * agreed a number. The value below is illustrative so the panel has something
 * to say, and it is a single constant precisely so that replacing it is one
 * edit rather than a search across screens.
 */
export const REVIEW_SLA_LABEL = 'até 4 horas úteis';

const STAGE_BADGE: Record<
  V2Stage,
  { icon: LucideIcon; className: string }
> = {
  draft: {
    icon: FileEdit,
    className: 'bg-muted text-portal-neutral',
  },
  entry_review: {
    icon: UserCheck,
    className: 'bg-portal-warning/15 text-portal-warning-ink',
  },
  returned: {
    icon: Undo2,
    className: 'bg-portal-warning/15 text-portal-warning-ink',
  },
  awaiting_quotes: {
    icon: Clock3,
    className: 'bg-portal-info/12 text-portal-info',
  },
  exit_review: {
    icon: UserCheck,
    className: 'bg-portal-warning/15 text-portal-warning-ink',
  },
  released: {
    icon: CheckCircle2,
    className: 'bg-portal-success/15 text-portal-success',
  },
  approved: {
    icon: CheckCircle2,
    className: 'bg-portal-success/15 text-portal-success',
  },
};

/** The seal on the card and on the detail header. */
export function V2StageBadge({
  stage,
  className,
}: {
  stage: V2Stage;
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
      {V2_STAGE_LABELS[stage]}
    </span>
  );
}

/**
 * "Revisada pela Freitas" (RQ-17), on every released proposal.
 *
 * Success and not info: it states an outcome — a person looked at this and let
 * it through — and not a system suggestion. Same split the proposals table
 * already applies between "Vencedora" and "Recomendada".
 */
export function ReviewedByFreitasBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'portal-small inline-flex items-center gap-1 rounded bg-portal-success/15 px-1.5 py-0.5 font-medium text-portal-success',
        className,
      )}
    >
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      Revisada pela Freitas
    </span>
  );
}

export { V2_STAGE_DESCRIPTIONS, V2_STAGE_LABELS };

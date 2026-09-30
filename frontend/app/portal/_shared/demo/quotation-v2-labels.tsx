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

import {
  CheckCircle2,
  Clock3,
  FileEdit,
  RotateCcw,
  UserCheck,
  Undo2,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

import {
  V2_STAGE_DESCRIPTIONS,
  V2_STAGE_LABELS,
  type V2Stage,
} from './quotation-review';
import { reviewSlaLabel } from './review-sla';
import {
  SNAPSHOT_FIELD_LABELS,
  formatSnapshotValue,
  type FieldChange,
} from './quotation-form-snapshot';

/**
 * Prazo de cada revisão da Freitas (entrada e saída): 1 hora, decisão do Orsi
 * em 29/09/2026. The rule itself lives in `review-sla.ts` — including the open
 * question of whether the hour is wall-clock or business time — so that both V2
 * journeys change together.
 */
export const REVIEW_SLA_LABEL = reviewSlaLabel();

const STAGE_BADGE: Record<V2Stage, { icon: LucideIcon; className: string }> = {
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
  cancelled: {
    icon: XCircle,
    className: 'bg-muted text-portal-neutral',
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

/**
 * "Reenviada": the round under review came back by a correction or an edit.
 *
 * SECONDARY on purpose — outlined, neutral, no fill — so it never competes with
 * the stage seal next to it. The seal says where the quotation is; this chip
 * only adds that it has been here before.
 */
export function ResubmittedChip({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'portal-small inline-flex shrink-0 items-center gap-1 rounded border border-border px-1.5 py-0.5 text-portal-neutral',
        className,
      )}
    >
      <RotateCcw className="h-3.5 w-3.5 shrink-0" />
      Reenviada
    </span>
  );
}

/**
 * The fields that changed against the previous submission, "anterior -> novo".
 *
 * `changes` undefined means there was no previous copy to compare with (a
 * quotation sent before this version); an EMPTY list means the client resent
 * without changing a field. The two read differently, and neither is blank.
 */
export function ChangedFieldsList({
  changes,
  max = 3,
  className,
}: {
  changes: FieldChange[] | undefined;
  max?: number;
  className?: string;
}) {
  if (changes === undefined) {
    return (
      <p className={cn('portal-small text-portal-neutral', className)}>
        Os campos alterados não foram registrados nesta rodada.
      </p>
    );
  }
  if (changes.length === 0) {
    return (
      <p className={cn('portal-small text-portal-neutral', className)}>
        Reenviada sem alteração nos campos.
      </p>
    );
  }
  const shown = changes.slice(0, max);
  const rest = changes.length - shown.length;
  return (
    <ul className={cn('portal-small space-y-0.5', className)}>
      {shown.map((change) => (
        <li key={change.field} className="text-portal-neutral">
          <span>{SNAPSHOT_FIELD_LABELS[change.field]}: </span>
          <span className="line-through decoration-portal-neutral/60">
            {formatSnapshotValue(change.field, change.from)}
          </span>
          <span aria-hidden="true"> → </span>
          <span className="sr-only"> alterado para </span>
          <span className="font-medium text-foreground">
            {formatSnapshotValue(change.field, change.to)}
          </span>
        </li>
      ))}
      {rest > 0 && (
        <li className="text-portal-neutral">
          e mais {rest} {rest === 1 ? 'campo' : 'campos'}
        </li>
      )}
    </ul>
  );
}

export { V2_STAGE_DESCRIPTIONS, V2_STAGE_LABELS };

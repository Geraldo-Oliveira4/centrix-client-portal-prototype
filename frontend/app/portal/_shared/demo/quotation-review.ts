// Cotação V2 — the human-in-the-loop review, simulated in the client.
//
// PURE, and free of the `@/` alias: this module runs under the native Node
// runner (`npm run test:unit`). Same rule as `feature-flags.ts`.
//
// WHAT THIS IS NOT, and it matters more here than anywhere else in the demo
// layer. In the integrated product these states live in the backend: the
// quotation gains a "devolvida ao cliente" state and an origin, each proposal
// gains "liberada ao cliente" and "bloqueada", and the rule that the client only
// READS released proposals sits in the data layer and in the API — not in the
// screen. Here there is no backend for any of it, so this file keeps the whole
// state machine in `localStorage` and the screens filter what they draw. A
// filter in the browser is a drawing decision, never a visibility guarantee:
// whoever builds the real version must put the released-only rule behind the
// API, or a bug in one component exposes a blocked proposal.
//
// The overlay follows the arrangement of `cotacoes/lib/use-preparation-data.ts`
// (API response + local entry merged at render time), but under the V2 prefix.
// It NEVER reads or writes `centrix-preparation-v1:` keys: that store belongs to
// the current flow, which has to keep working untouched with the flag off.

/** Storage name under `DEMO_STORE_PREFIX`. */
export const QUOTATION_REVIEW_STORE_NAME = 'quotation-review';

/**
 * The six stages of the V2 journey.
 *
 * Deliberately its own type in its own module, never the `Stage` of
 * `cotacoes/previa/model.ts`. The two are different vocabularies for different
 * screens — the prévia's `released` means "the client's CHOICE was released",
 * this one's means "the PROPOSALS were released" — and merging them into one
 * union would make that difference invisible at the call site.
 */
export type V2Stage =
  | 'draft'
  | 'entry_review'
  | 'returned'
  | 'awaiting_quotes'
  | 'exit_review'
  | 'released'
  | 'approved';

/** Where the quotation came from. Today only the portal produces an overlay. */
export type V2Origin = 'portal';

export type V2EventKind =
  | 'submitted'
  | 'returned'
  | 'resubmitted'
  | 'entry_approved'
  | 'quotes_arrived'
  | 'proposals_released'
  | 'approved'
  | 'reset';

export interface V2Event {
  kind: V2EventKind;
  /** ISO. Injected by the caller — this module never reads the clock. */
  at: string;
  /** Only `returned` carries one. */
  reason?: string;
  /** Only `proposals_released` carries one. */
  releasedCount?: number;
  /** Only `approved` carries one. */
  proposalId?: string;
}

export interface QuotationReview {
  origin: V2Origin;
  stage: V2Stage;
  /** The Freitas' words, kept while the client corrects and resends. */
  returnReason?: string;
  /**
   * The proposals the client may see. `undefined` before the exit review;
   * an EMPTY ARRAY is not the same thing and means "released nothing", which is
   * why the merge distinguishes the two.
   */
  releasedProposalIds?: string[];
  /** ISO. The clock the automatic reply counts from. */
  stageEnteredAt: string;
  /** The proposal the client chose, once they have. */
  approvedProposalId?: string;
  /** Oldest first. Survives a return and a resubmission (RQ-5). */
  history: V2Event[];
}

/** id -> overlay. A quotation with no entry behaves exactly as it does today. */
export type QuotationReviewStore = Record<string, QuotationReview>;

export const EMPTY_QUOTATION_REVIEW_STORE: QuotationReviewStore = {};

/**
 * The stages that are waiting on the CLIENT (RQ-6).
 *
 * The three the Freitas is holding (`entry_review`, `awaiting_quotes`,
 * `exit_review`) are deliberately out: a counter that called them "aguardando
 * sua ação" would be asking the client to do something they cannot do.
 */
export const V2_CLIENT_ACTION_STAGES: V2Stage[] = [
  'draft',
  'returned',
  'released',
];

/** The stages the automatic reply may advance. Returning is never automatic. */
export const V2_AUTO_ADVANCE_STAGES: V2Stage[] = [
  'entry_review',
  'awaiting_quotes',
  'exit_review',
];

export const V2_STAGE_LABELS: Record<V2Stage, string> = {
  draft: 'Rascunho',
  entry_review: 'Em revisão',
  returned: 'Devolvida',
  awaiting_quotes: 'Aguardando propostas',
  exit_review: 'Em revisão',
  released: 'Nova',
  approved: 'Aprovada',
};

/**
 * The line under the badge. `entry_review` and `exit_review` share a badge on
 * purpose (RQ-4 asks for one "Em revisão" seal) and are told apart HERE, by the
 * sentence — which of the two reviews is running is exactly what the client
 * needs and exactly what a second badge colour would not say.
 */
export const V2_STAGE_DESCRIPTIONS: Record<V2Stage, string> = {
  draft: 'Rascunho · ainda não enviado à Freitas',
  entry_review: 'A Freitas está revisando os dados da sua solicitação',
  returned: 'A Freitas pediu um ajuste antes de acionar os agentes',
  awaiting_quotes: 'Aguardando propostas dos agentes',
  exit_review: 'A comparação ainda não está liberada',
  released: 'A Freitas liberou as propostas para você comparar',
  approved: 'Proposta aprovada. O embarque já está em Meus Embarques.',
};

/** Which Kanban column a stage belongs to. */
export type V2Column =
  | 'aguardando_dados'
  | 'buscando_propostas'
  | 'aguardando_aprovacao';

/**
 * Stage -> column, or `null` for a stage that does NOT belong on the funnel.
 *
 * THREE COLUMNS, and review is never one of them (RQ-4). `entry_review` and
 * `exit_review` both land in "Aguardando agentes" because that is what the
 * client is doing in both: waiting. A fourth column called "Em revisão" would
 * turn the Freitas' internal queue into part of the client's board.
 *
 * `approved` is `null` because the funnel is work IN FLIGHT: an approved
 * quotation has left it and lives in the "Aprovadas" tab, exactly like a
 * quotation the backend closed.
 */
export const V2_STAGE_COLUMN: Record<V2Stage, V2Column | null> = {
  draft: 'aguardando_dados',
  returned: 'aguardando_dados',
  entry_review: 'buscando_propostas',
  awaiting_quotes: 'buscando_propostas',
  exit_review: 'buscando_propostas',
  released: 'aguardando_aprovacao',
  approved: null,
};

/** A fresh overlay for a quotation the client just started. */
export function createReview(at: string): QuotationReview {
  return {
    origin: 'portal',
    stage: 'draft',
    stageEnteredAt: at,
    history: [],
  };
}

/** Advances one entry, appending to the history rather than replacing it. */
function advance(
  review: QuotationReview,
  stage: V2Stage,
  event: V2Event,
  patch: Partial<QuotationReview> = {},
): QuotationReview {
  return {
    ...review,
    ...patch,
    stage,
    stageEnteredAt: event.at,
    history: [...review.history, event],
  };
}

/** Client sends the request. Draft or returned -> entry review (RQ-1). */
export function submitToFreitas(
  review: QuotationReview,
  at: string,
): QuotationReview {
  const resubmitting = review.stage === 'returned';
  return advance(review, 'entry_review', {
    kind: resubmitting ? 'resubmitted' : 'submitted',
    at,
  });
}

/**
 * Resubmitting after a return (RQ-5).
 *
 * The same transition as `submitToFreitas`, named separately because the call
 * site is a different button on a different screen and because the history has
 * to record which of the two happened. The return REASON is cleared — it
 * described a draft that no longer exists — but the event that carried it
 * stays in `history`, which is what "histórico preservado" means.
 */
export function resubmit(
  review: QuotationReview,
  at: string,
): QuotationReview {
  const next = advance(review, 'entry_review', { kind: 'resubmitted', at });
  const { returnReason: _dropped, ...rest } = next;
  return rest;
}

/** Freitas sends it back with a reason. Always manual, never automatic. */
export function returnToClient(
  review: QuotationReview,
  reason: string,
  at: string,
): QuotationReview {
  const trimmed = reason.trim();
  if (!trimmed) return review;
  return advance(
    review,
    'returned',
    { kind: 'returned', at, reason: trimmed },
    { returnReason: trimmed },
  );
}

/** Freitas approves the entry review and fires the simulated RFQ. */
export function approveEntry(
  review: QuotationReview,
  at: string,
): QuotationReview {
  return advance(review, 'awaiting_quotes', { kind: 'entry_approved', at });
}

/** The agents answered; the exit review opens. */
export function quotesArrived(
  review: QuotationReview,
  at: string,
): QuotationReview {
  return advance(review, 'exit_review', { kind: 'quotes_arrived', at });
}

/**
 * Freitas releases a subset of the proposals (RQ-15/RQ-17).
 *
 * Releasing NOTHING is refused: the comparison would open with an empty table
 * and the client would read it as a system failure rather than as a decision.
 * Duplicated ids are collapsed so the banner's count matches the rows drawn.
 */
export function releaseProposals(
  review: QuotationReview,
  ids: string[],
  at: string,
): QuotationReview {
  const unique = Array.from(new Set(ids.filter((id) => id)));
  if (unique.length === 0) return review;
  return advance(
    review,
    'released',
    { kind: 'proposals_released', at, releasedCount: unique.length },
    { releasedProposalIds: unique },
  );
}

/**
 * Client approves one of the released proposals (RQ-18), SIMULATED.
 *
 * Only ever reached by an ILLUSTRATIVE proposal. A real proposal goes through
 * `approveProposal` and the backend, which closes the quotation and provisions
 * the Processo/Embarque for real — that path is untouched. This one exists
 * because a quotation opened in the portal during a demonstration has no real
 * proposal to approve (it is created with none and never gets one), so without
 * it the journey "nova cotação -> embarque" had no ending.
 */
export function approveQuotation(
  review: QuotationReview,
  proposalId: string,
  at: string,
): QuotationReview {
  if (review.stage !== 'released' || !proposalId) return review;
  return advance(
    review,
    'approved',
    { kind: 'approved', at, proposalId },
    { approvedProposalId: proposalId },
  );
}

/**
 * Back to square one, for the demonstration panel.
 *
 * Keeps the history and drops the released list: the point of the reset is to
 * run the journey again, and a stale released list would let the comparison
 * open on a stage that has not released anything yet.
 */
export function resetToDraft(
  review: QuotationReview,
  at: string,
): QuotationReview {
  const next = advance(review, 'draft', { kind: 'reset', at });
  const {
    returnReason: _r,
    releasedProposalIds: _p,
    approvedProposalId: _a,
    ...rest
  } = next;
  return rest;
}

/** A minimal shape of what the portal's quotation payload gives us. */
export interface MergeableQuotation {
  id: string;
  reference?: string;
  proposals?: { id: string }[] | null;
}

export interface MergedQuotationV2<T extends MergeableQuotation> {
  quotation: T;
  /** `null` when the quotation has no overlay: it behaves as it does today. */
  review: QuotationReview | null;
  stage: V2Stage | null;
  column: V2Column | null;
  /** The proposals the client may see. Identical to the input without overlay. */
  visibleProposals: NonNullable<T['proposals']>;
  /** True only when the overlay is actually hiding something. */
  proposalsFiltered: boolean;
  returnReason: string | null;
}

/**
 * The display state of one quotation: API payload plus overlay.
 *
 * THE ONE RULE THAT CANNOT SLIP: with no overlay, nothing here changes anything
 * — same proposals, same object, `review: null`. That is what keeps the current
 * flow intact with `cotacaoV2` off, and what keeps every seeded quotation
 * behaving as it did before this file existed.
 *
 * Before the exit review `releasedProposalIds` is `undefined` and NOTHING is
 * visible: the proposals exist in the payload, but the Freitas has not reviewed
 * them, and that is precisely the state RQ-17 exists to protect.
 */
export function mergeQuotationV2<T extends MergeableQuotation>(
  quotation: T,
  overlay: QuotationReview | null | undefined,
): MergedQuotationV2<T> {
  const proposals = (quotation.proposals ?? []) as NonNullable<T['proposals']>;

  if (!overlay) {
    return {
      quotation,
      review: null,
      stage: null,
      column: null,
      visibleProposals: proposals,
      proposalsFiltered: false,
      returnReason: null,
    };
  }

  const released = overlay.releasedProposalIds;
  const visible =
    (overlay.stage === 'released' || overlay.stage === 'approved') && released
      ? (proposals.filter((p) => released.includes(p.id)) as NonNullable<
          T['proposals']
        >)
      : ([] as unknown as NonNullable<T['proposals']>);

  return {
    quotation,
    review: overlay,
    stage: overlay.stage,
    column: V2_STAGE_COLUMN[overlay.stage],
    visibleProposals: visible,
    proposalsFiltered: visible.length !== proposals.length,
    returnReason: overlay.returnReason ?? null,
  };
}

/**
 * How many quotations are waiting on the CLIENT (RQ-6).
 *
 * Counts only quotations that HAVE an overlay: one without is counted by the
 * screen's existing bucket arithmetic, and adding it here would double it.
 */
export function countV2ClientActions(store: QuotationReviewStore): number {
  return Object.values(store).filter((review) =>
    V2_CLIENT_ACTION_STAGES.includes(review.stage),
  ).length;
}

/** The ids at a given stage, for the panel's list. */
export function quotationIdsAtStage(
  store: QuotationReviewStore,
  stage: V2Stage,
): string[] {
  return Object.entries(store)
    .filter(([, review]) => review.stage === stage)
    .map(([id]) => id);
}

/**
 * Milliseconds left before the automatic reply advances this entry.
 *
 * Derived from `stageEnteredAt` and NOT from a timer started on mount: a timer
 * would restart on every reload and an entry left open would never advance.
 * `0` means "due now"; `null` means this stage never advances on its own.
 *
 * A `stageEnteredAt` in the future (clock skew, or an entry written by another
 * machine) is clamped to the full delay rather than treated as overdue — firing
 * instantly on load would look like the panel ignoring the delay entirely.
 */
export function msUntilAutoAdvance(
  review: QuotationReview,
  delaySeconds: number,
  now: number,
): number | null {
  if (!V2_AUTO_ADVANCE_STAGES.includes(review.stage)) return null;
  const enteredAt = Date.parse(review.stageEnteredAt);
  const delayMs = delaySeconds * 1000;
  if (!Number.isFinite(enteredAt)) return 0;
  const elapsed = now - enteredAt;
  if (elapsed < 0) return delayMs;
  return Math.max(0, delayMs - elapsed);
}

/** The next stage the automatic reply moves to, or `null` if it does not. */
export function autoAdvanceTarget(stage: V2Stage): V2Stage | null {
  if (stage === 'entry_review') return 'awaiting_quotes';
  if (stage === 'awaiting_quotes') return 'exit_review';
  if (stage === 'exit_review') return 'released';
  return null;
}

/**
 * Applies one automatic step, given the proposal ids available for release.
 *
 * `exit_review -> released` needs ids, and with none the entry STAYS in the
 * exit review: an automatic release of nothing would leave the client on an
 * empty comparison with a banner saying proposals had been released.
 */
export function applyAutoAdvance(
  review: QuotationReview,
  proposalIds: string[],
  at: string,
): QuotationReview {
  if (review.stage === 'entry_review') return approveEntry(review, at);
  if (review.stage === 'awaiting_quotes') return quotesArrived(review, at);
  if (review.stage === 'exit_review') {
    return releaseProposals(review, proposalIds, at);
  }
  return review;
}

/** Coerces one stored entry, or `null` when it is beyond repair. */
function normalizeReview(raw: unknown): QuotationReview | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  const stage = source.stage;
  if (
    typeof stage !== 'string' ||
    !(Object.keys(V2_STAGE_COLUMN) as string[]).includes(stage)
  ) {
    return null;
  }
  const history = Array.isArray(source.history)
    ? (source.history.filter(
        (event) =>
          event != null &&
          typeof event === 'object' &&
          typeof (event as V2Event).kind === 'string' &&
          typeof (event as V2Event).at === 'string',
      ) as V2Event[])
    : [];
  const released = Array.isArray(source.releasedProposalIds)
    ? source.releasedProposalIds.filter(
        (id): id is string => typeof id === 'string',
      )
    : undefined;
  return {
    origin: 'portal',
    stage: stage as V2Stage,
    stageEnteredAt:
      typeof source.stageEnteredAt === 'string'
        ? source.stageEnteredAt
        : new Date(0).toISOString(),
    history,
    ...(typeof source.returnReason === 'string' && source.returnReason
      ? { returnReason: source.returnReason }
      : {}),
    ...(released ? { releasedProposalIds: released } : {}),
    ...(typeof source.approvedProposalId === 'string' && source.approvedProposalId
      ? { approvedProposalId: source.approvedProposalId }
      : {}),
  };
}

/**
 * Coerces the whole store. An entry beyond repair is DROPPED, not defaulted:
 * a quotation with no overlay falls back to today's behaviour, which is always
 * a safe place to land.
 */
export function normalizeQuotationReviewStore(
  raw: unknown,
): QuotationReviewStore {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: QuotationReviewStore = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const review = normalizeReview(value);
    if (review) out[id] = review;
  }
  return out;
}

/** The store entry as a map. Absent or corrupted means "no overlay at all". */
export function parseQuotationReviewStore(
  raw: string | null,
): QuotationReviewStore {
  if (raw == null) return {};
  try {
    return normalizeQuotationReviewStore(JSON.parse(raw));
  } catch {
    return {};
  }
}

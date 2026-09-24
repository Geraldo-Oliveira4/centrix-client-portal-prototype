'use client';

// "A Freitas responde sozinha", applied to the Cotação V2 overlay.
//
// MOUNTED BY THE PORTAL LAYOUT, not by the panel. The whole point of the
// automatic reply is that whoever is presenting closes the panel, talks, and
// the card moves on its own — a hook living inside the Sheet would stop the
// moment the Sheet unmounted.
//
// THE CLOCK IS `stageEnteredAt`, never a timer started on mount. A timer would
// restart on every reload and on every navigation inside the portal, so a
// quotation left in the entry review would wait forever while the presenter
// wondered what broke. `msUntilAutoAdvance` derives what is left from the
// stored instant, which is what makes the countdown survive a reload.
//
// RETURNING IS NEVER AUTOMATIC. `autoAdvanceTarget` has no edge into
// `returned`: a demonstration where the Freitas rejects the request on its own
// would be telling the audience something that is not true about the product.

import { useEffect } from 'react';

import {
  V2_AUTO_ADVANCE_STAGES,
  applyAutoAdvance,
  msUntilAutoAdvance,
} from './quotation-review';
import { useFreitasSimulation } from './use-freitas-simulation';
import { usePortalModuleFlags } from './use-feature-flags';
import {
  readQuotationReviewStore,
  updateQuotationReview,
  useQuotationReviewStore,
} from './use-quotation-review';

/** Proposal ids per quotation, so the exit review has something to release. */
export type ProposalIdsByQuotation = Record<string, string[]>;

/**
 * Advances every due entry and schedules the next one.
 *
 * ONE TIMER for the whole store, set to the nearest deadline, instead of one
 * per quotation: the entries share a delay, so N timers would fire within
 * milliseconds of each other and each would write the store on top of the last.
 */
export function useV2AutoAdvance(proposalIds: ProposalIdsByQuotation): void {
  const flags = usePortalModuleFlags();
  const simulation = useFreitasSimulation();
  const store = useQuotationReviewStore();

  const enabled = flags.cotacaoV2 && simulation.autoRespond;
  const delaySeconds = simulation.delaySeconds;

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = () => {
      // Re-read from storage: this callback can fire long after the render that
      // scheduled it, and the panel may have moved a card in the meantime.
      const current = readQuotationReviewStore();
      const now = Date.now();
      let nextDelay: number | null = null;

      for (const [quotationId, review] of Object.entries(current)) {
        if (!V2_AUTO_ADVANCE_STAGES.includes(review.stage)) continue;
        const remaining = msUntilAutoAdvance(review, delaySeconds, now);
        if (remaining == null) continue;
        if (remaining <= 0) {
          updateQuotationReview(
            quotationId,
            (entry) =>
              applyAutoAdvance(
                entry,
                proposalIds[quotationId] ?? [],
                new Date().toISOString(),
              ),
            new Date().toISOString(),
          );
          // The entry that just moved has a new deadline; re-scheduling below
          // from a fresh read is simpler than predicting it here.
          nextDelay = 50;
          continue;
        }
        nextDelay =
          nextDelay == null ? remaining : Math.min(nextDelay, remaining);
      }

      if (nextDelay != null) timer = setTimeout(tick, Math.max(50, nextDelay));
    };

    tick();
    return () => {
      if (timer) clearTimeout(timer);
    };
    // `store` is a dependency so that a card moved by hand in the panel
    // re-arms the timer immediately instead of waiting for the previous one.
  }, [enabled, delaySeconds, proposalIds, store]);
}

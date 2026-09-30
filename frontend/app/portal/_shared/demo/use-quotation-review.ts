'use client';

// The Cotação V2 overlay, as the screens consume it.
//
// One subscription over `localStorage`, exactly like the flags: every card, the
// counter, the bell and the panel read the same value in the same render, so a
// stage change reaches all of them at once without a provider in between.

import { useCallback } from 'react';

import { readDemoRaw } from './demo-store';
import {
  QUOTATION_NOTICES_STORE_NAME,
  markNoticesRead,
  parseNoticeReadStore,
  type NoticeReadStore,
} from './quotation-review-notices';
import {
  QUOTATION_REVIEW_STORE_NAME,
  createReview,
  parseQuotationReviewStore,
  type QuotationReview,
  type QuotationReviewStore,
} from './quotation-review';
import { setDemoValue, useDemoValue } from './use-demo-store';

/** Every overlay entry. `{}` when the demonstration has not started one. */
export function useQuotationReviewStore(): QuotationReviewStore {
  return useDemoValue(QUOTATION_REVIEW_STORE_NAME, parseQuotationReviewStore);
}

/** One quotation's overlay, or `null` — which means "behaves as today". */
export function useQuotationReview(
  quotationId: string | null | undefined,
): QuotationReview | null {
  const store = useQuotationReviewStore();
  return quotationId ? (store[quotationId] ?? null) : null;
}

export function writeQuotationReviewStore(store: QuotationReviewStore): void {
  setDemoValue(QUOTATION_REVIEW_STORE_NAME, store);
}

/**
 * Applies a transition to one entry, reading the CURRENT store first.
 *
 * Reads from storage rather than from a React snapshot on purpose: the
 * automatic reply and the panel can both write within the same tick, and a
 * stale snapshot would silently drop one of the two writes.
 */
export function updateQuotationReview(
  quotationId: string,
  apply: (review: QuotationReview) => QuotationReview,
  at: string = new Date().toISOString(),
): void {
  const store = readQuotationReviewStore();
  const current = store[quotationId] ?? createReview(at);
  writeQuotationReviewStore({ ...store, [quotationId]: apply(current) });
}

/** The store, straight from `localStorage`. For non-React callers. */
export function readQuotationReviewStore(): QuotationReviewStore {
  if (typeof window === 'undefined') return {};
  let storage: Storage | null = null;
  try {
    storage = window.localStorage;
  } catch {
    return {};
  }
  return parseQuotationReviewStore(
    readDemoRaw(storage, QUOTATION_REVIEW_STORE_NAME),
  );
}

/** Drops every overlay entry, leaving the rest of the demo layer alone. */
export function clearQuotationReviewStore(): void {
  writeQuotationReviewStore({});
}

export function useNoticeReadStore(): NoticeReadStore {
  return useDemoValue(QUOTATION_NOTICES_STORE_NAME, parseNoticeReadStore);
}

/** Marks notices read. Returns a stable callback for the bell's `onOpenChange`. */
export function useMarkNoticesRead(): (ids: string[]) => void {
  const read = useNoticeReadStore();
  return useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const next = markNoticesRead(read, ids);
      if (next.length !== read.length) {
        setDemoValue(QUOTATION_NOTICES_STORE_NAME, next);
      }
    },
    [read],
  );
}

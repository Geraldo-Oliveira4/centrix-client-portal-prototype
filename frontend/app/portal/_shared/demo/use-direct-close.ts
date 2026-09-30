'use client';

// O fechamento direto como as telas o consomem: uma assinatura sobre o
// `localStorage`, igual ao overlay da cotação (`use-quotation-review.ts`).

import { readDemoRaw } from './demo-store';
import {
  DIRECT_CLOSE_STORE_NAME,
  parseDirectCloseStore,
  type DirectCloseRequest,
  type DirectCloseStore,
} from './direct-close';
import { setDemoValue, useDemoValue } from './use-demo-store';

export function useDirectCloseStore(): DirectCloseStore {
  return useDemoValue(DIRECT_CLOSE_STORE_NAME, parseDirectCloseStore);
}

/** The store straight from storage — writers read this, never a snapshot. */
export function readDirectCloseStore(): DirectCloseStore {
  if (typeof window === 'undefined') return {};
  try {
    return parseDirectCloseStore(
      readDemoRaw(window.localStorage, DIRECT_CLOSE_STORE_NAME),
    );
  } catch {
    return {};
  }
}

export function putDirectClose(request: DirectCloseRequest): void {
  setDemoValue(DIRECT_CLOSE_STORE_NAME, {
    ...readDirectCloseStore(),
    [request.id]: request,
  });
}

export function updateDirectClose(
  id: string,
  apply: (request: DirectCloseRequest) => DirectCloseRequest,
): void {
  const store = readDirectCloseStore();
  const current = store[id];
  if (!current) return;
  setDemoValue(DIRECT_CLOSE_STORE_NAME, { ...store, [id]: apply(current) });
}

export function clearDirectCloseStore(): void {
  setDemoValue(DIRECT_CLOSE_STORE_NAME, {});
}

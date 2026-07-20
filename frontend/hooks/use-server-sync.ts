import { useEffect, useRef } from 'react';

interface UseServerSyncOptions {
  /** Skip this sync pass — e.g. there are unsaved local edits pending. */
  skip?: boolean;
  /** true (default): apply `value` at most once per `resetKey` epoch. Pass `false` to re-apply every time `value` changes (still gated by `skip`). */
  once?: boolean;
  /** Changing this value re-arms a `once` sync — e.g. a modal's `open` prop. */
  resetKey?: unknown;
}

// Seeds local editable state from an async/server-backed `value` (SWR, polling,
// a prop that refetches) without clobbering in-progress local edits. A plain
// `useEffect(() => setState(value), [value])` re-applies every time `value`
// gets a new reference — including background revalidation while the user is
// mid-edit — which silently discards unsaved input. See frontend/CLAUDE.md
// "Syncing local state from server data".
export function useServerSync<T>(
  value: T | null | undefined,
  apply: (value: T) => void,
  { skip = false, once = true, resetKey }: UseServerSyncOptions = {},
): void {
  const seededRef = useRef(false);

  useEffect(() => {
    seededRef.current = false;
  }, [resetKey]);

  useEffect(() => {
    if (value == null || skip) return;
    if (once && seededRef.current) return;
    seededRef.current = true;
    apply(value);
    // `apply` is intentionally excluded — callers pass an inline closure and
    // including it would re-run this sync on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, skip, once]);
}

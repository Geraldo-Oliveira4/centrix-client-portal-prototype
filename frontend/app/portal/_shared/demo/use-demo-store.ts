'use client';

// Thin React layer over `demo-store.ts`. The rules live there; this file only
// binds them to the browser's `localStorage` and to the `window` event target.
//
// SSR-SAFE. `useSyncExternalStore` gets a server snapshot of `null`, which
// every parser in this layer turns into its defaults — so the server and the
// first client render agree, and the stored value arrives on the subscription
// that follows. Reading `localStorage` during render would have been both a
// hydration mismatch and a throw on the server.
//
// THE SNAPSHOT IS THE RAW STRING, never the parsed value: `useSyncExternalStore`
// compares snapshots by identity, and a parser that returns a fresh object on
// every call makes React re-render forever.

import { useCallback, useMemo, useSyncExternalStore } from 'react';

import {
  notifyDemoStore,
  readDemoRaw,
  resetPrefix,
  subscribeDemoStore,
  writeDemoValue,
  type DemoEventTarget,
  type DemoStorage,
} from './demo-store';

/**
 * `localStorage`, or `null` when there is none to be had.
 *
 * The access itself throws in a browser with site data blocked — it is not
 * enough to check that `window` exists.
 */
function browserStorage(): DemoStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function browserEvents(): DemoEventTarget | null {
  return typeof window === 'undefined' ? null : window;
}

const getServerSnapshot = () => null;

/**
 * Subscribes to one entry of the demonstration store and parses it.
 *
 * `parse` MUST be a module-level constant. It is a dependency of the memo, so a
 * function defined inside the component would re-parse on every render and hand
 * a new object to whatever holds it as an effect dependency.
 */
export function useDemoValue<T>(
  name: string,
  parse: (raw: string | null) => T,
): T {
  const subscribe = useCallback(
    (onChange: () => void) => subscribeDemoStore(browserEvents(), onChange),
    [],
  );
  const getSnapshot = useCallback(() => readDemoRaw(browserStorage(), name), [
    name,
  ]);

  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return useMemo(() => parse(raw), [raw, parse]);
}

/** Writes an entry and wakes this tab. Returns whether it landed. */
export function setDemoValue(name: string, value: unknown): boolean {
  const written = writeDemoValue(browserStorage(), name, value);
  if (written) notifyDemoStore(browserEvents());
  return written;
}

/**
 * Wipes the demonstration layer and wakes this tab. Returns the keys removed.
 *
 * It does NOT touch `sessionStorage`, so the panel stays open across a restart:
 * whoever just reset the demonstration is still running it, and having the
 * panel vanish under their cursor would read as a crash.
 */
export function resetDemoStore(): string[] {
  const removed = resetPrefix(browserStorage());
  notifyDemoStore(browserEvents());
  return removed;
}

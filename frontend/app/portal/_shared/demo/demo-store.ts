// Core of the prototype's local demonstration store.
//
// PURE ON PURPOSE: no `window`, no `localStorage`, no `document`. Storage and
// the event target both arrive as parameters, which is what lets the rules be
// tested with `node --test` (see `demo-store.test.ts`) without a DOM.
//
// It follows the pattern already established by
// `cotacoes/lib/local-requests.ts`: a prefixed key, a custom event for the tab
// that wrote, and the native `storage` event for the other tabs. What is new
// here is a SINGLE prefix shared by the whole V2 layer, so that "restart the
// demonstration" can be a prefix sweep instead of a hand-kept list of keys that
// silently goes stale the first time a later prompt adds one.
//
// Every read is total: missing key, unavailable storage, corrupted JSON and a
// value that fails validation all land on the same fallback. A demo panel must
// never be the reason a screen fails to render.

/** The one prefix. Nothing outside the V2 demonstration layer may use it. */
export const DEMO_STORE_PREFIX = 'centrix-proto-v2:';

/** Same-tab change notification. `storage` only fires on the OTHER tabs. */
export const DEMO_STORE_EVENT = 'centrix-proto-v2-store';

/** The slice of the Web Storage API this module needs. */
export interface DemoStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The slice of `EventTarget` this module needs. */
export interface DemoEventTarget {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
  dispatchEvent(event: Event): boolean;
}

/** Full storage key for a demonstration entry. */
export function demoStoreKey(name: string): string {
  return DEMO_STORE_PREFIX + name;
}

/**
 * The raw string behind a name, or `null`.
 *
 * Separate from `readDemoValue` because `useSyncExternalStore` needs a snapshot
 * that is referentially stable between renders, and a parsed object never is.
 * The hook snapshots the STRING and parses it in a memo.
 */
export function readDemoRaw(
  storage: DemoStorage | null,
  name: string,
): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(demoStoreKey(name));
  } catch {
    return null;
  }
}

/**
 * Decodes a raw entry, falling back on anything unusable.
 *
 * `normalize` is not belt-and-braces: a stored value survives a deploy, so the
 * shape on disk is whatever an OLDER version of this code wrote. Parsing
 * successfully is not the same as still being usable, which is why every caller
 * in this layer passes one and why it runs INSIDE the try — a normalizer that
 * throws on a shape it did not expect must still land on the fallback.
 */
export function decodeDemoValue<T>(
  raw: string | null,
  fallback: T,
  normalize?: (parsed: unknown) => T,
): T {
  if (raw == null) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    return normalize ? normalize(parsed) : (parsed as T);
  } catch {
    return fallback;
  }
}

/** `readDemoRaw` + `decodeDemoValue`, for callers outside React. */
export function readDemoValue<T>(
  storage: DemoStorage | null,
  name: string,
  fallback: T,
  normalize?: (parsed: unknown) => T,
): T {
  return decodeDemoValue(readDemoRaw(storage, name), fallback, normalize);
}

/** Returns whether the write landed. Quota and private modes both throw. */
export function writeDemoValue(
  storage: DemoStorage | null,
  name: string,
  value: unknown,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(demoStoreKey(name), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeDemoValue(
  storage: DemoStorage | null,
  name: string,
): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(demoStoreKey(name));
    return true;
  } catch {
    return false;
  }
}

/** Every key currently under the prefix, full keys, in storage order. */
export function listDemoKeys(storage: DemoStorage | null): string[] {
  if (!storage) return [];
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key != null && key.startsWith(DEMO_STORE_PREFIX)) keys.push(key);
    }
    return keys;
  } catch {
    return [];
  }
}

/**
 * Wipes the demonstration layer and NOTHING else. Returns the keys removed.
 *
 * The two-pass shape is the point: `storage.key(i)` is index-based, so removing
 * while walking shifts everything after the removed entry down one slot and
 * skips it. The snapshot is taken first, then removed by name.
 *
 * A key outside `DEMO_STORE_PREFIX` is never touched — the portal keeps real
 * prototype state next door (`centrix-preparation-v1:`, `centrix-repeat-requests-v1:`,
 * `@centrix:session`, `portal:theme`), and "restart the demonstration" must not
 * log the client out or throw away their quotation drafts.
 */
export function resetPrefix(storage: DemoStorage | null): string[] {
  if (!storage) return [];
  const keys = listDemoKeys(storage);
  for (const key of keys) {
    try {
      storage.removeItem(key);
    } catch {
      /* A key that refuses to go is still reported: the caller re-reads. */
    }
  }
  return keys;
}

/** Tells the CURRENT tab that the store changed. */
export function notifyDemoStore(events: DemoEventTarget | null): void {
  if (!events) return;
  try {
    events.dispatchEvent(new Event(DEMO_STORE_EVENT));
  } catch {
    /* No event constructor (very old runtime): readers fall back to remount. */
  }
}

/**
 * Subscribes to both channels and returns the unsubscribe.
 *
 * `storage` covers the other tabs, `DEMO_STORE_EVENT` covers this one. The
 * listener takes no argument on purpose — it is a "something changed, re-read"
 * signal, not a diff, so the two very different event payloads never leak into
 * the callers.
 */
export function subscribeDemoStore(
  events: DemoEventTarget | null,
  listener: () => void,
): () => void {
  if (!events) return () => {};
  events.addEventListener('storage', listener);
  events.addEventListener(DEMO_STORE_EVENT, listener);
  return () => {
    events.removeEventListener('storage', listener);
    events.removeEventListener(DEMO_STORE_EVENT, listener);
  };
}

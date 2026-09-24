'use client';

// Visibility of the demonstration panel.
//
// THE CLIENT WHO IS TESTING THE PORTAL MUST NOT FIND THIS BY ACCIDENT. The
// panel simulates the Freitas side; a client who opens it is looking at
// controls that are not theirs, on a screen that is supposed to be theirs.
// Hence: hidden unless asked for, and asked for in a way nobody types by
// accident.
//
// THREE WAYS IN, one state:
//   - `?demo=1` turns it on, `?demo=0` turns it off. The query wins over what
//     was stored, so a link can put someone straight into a demonstration.
//   - Ctrl+Shift+D toggles, for when the URL is already what it should be.
//   - Whatever was chosen persists in `sessionStorage`, so navigating inside
//     the portal keeps it — and closing the tab loses it. It is deliberately
//     NOT `localStorage`: a panel that survives for days on the machine of
//     whoever once ran a demonstration would eventually be found by someone
//     else using that browser.

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

import { DEMO_STORE_PREFIX } from './demo-store';

/** In `sessionStorage`, under the same prefix — but see `resetDemoStore`. */
export const DEMO_PANEL_SESSION_KEY = DEMO_STORE_PREFIX + 'demo-panel';

/** What `?demo=` asks for, when it asks for anything. */
export function demoParamIntent(search: string): boolean | null {
  let value: string | null = null;
  try {
    value = new URLSearchParams(search).get('demo');
  } catch {
    return null;
  }
  if (value == null) return null;
  if (value === '0' || value === 'false') return false;
  return true;
}

function readSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(DEMO_PANEL_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function writeSession(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(DEMO_PANEL_SESSION_KEY, enabled ? '1' : '0');
  } catch {
    /* No session storage: the panel simply does not survive navigation. */
  }
}

/**
 * Whether the demonstration panel is showing, plus its toggle.
 *
 * Always false on the first render, including on the server: the panel appears
 * in an effect. That is what keeps it out of the server-rendered HTML, and it
 * costs nothing — a control for whoever is presenting does not need to be
 * painted on the first frame.
 */
export function useDemoPanel(): { enabled: boolean; toggle: () => void } {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);

  // Re-read on navigation. `usePathname` does not fire on a query-only change,
  // so `?demo=1` appended to the URL bar is picked up by the full navigation
  // that produces it, not by a client-side router update.
  useEffect(() => {
    const intent = demoParamIntent(window.location.search);
    if (intent == null) {
      setEnabled(readSession());
      return;
    }
    writeSession(intent);
    setEnabled(intent);
  }, [pathname]);

  const toggle = useCallback(() => {
    setEnabled((previous) => {
      writeSession(!previous);
      return !previous;
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || !event.shiftKey || event.altKey) return;
      if (event.key !== 'D' && event.key !== 'd') return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggle]);

  return { enabled, toggle };
}

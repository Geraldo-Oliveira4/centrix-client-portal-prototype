'use client';

// The flags, as the screens consume them.
//
// One hook, one writer, no context provider: `useSyncExternalStore` over
// `localStorage` already gives every subscriber the same value in the same
// render, and a provider would add a tree that the sidebar, the layout guard
// and the panel would each have to sit inside.

import { useCallback } from 'react';

import {
  MODULE_FLAGS_STORE_NAME,
  flagsForWave,
  isRouteReleased,
  moduleForRoute,
  parseModuleFlags,
  type PortalModule,
  type PortalModuleFlags,
  type PortalWaveId,
} from './feature-flags';
import { setDemoValue, useDemoValue } from './use-demo-store';

/** Every module's current state. Defaults to all released. */
export function usePortalModuleFlags(): PortalModuleFlags {
  return useDemoValue(MODULE_FLAGS_STORE_NAME, parseModuleFlags);
}

/**
 * Whether a module is released right now.
 *
 * `module` accepts `null` so a caller can pass `moduleForRoute(href)` straight
 * through: a link to a route no prefix claims is always allowed.
 */
export function usePortalModuleReleased(module: PortalModule | null): boolean {
  const flags = usePortalModuleFlags();
  return module == null ? true : flags[module];
}

/** Whether a portal href is reachable. Query string and hash are ignored. */
export function useReleasedHref(): (href: string) => boolean {
  const flags = usePortalModuleFlags();
  return useCallback(
    (href: string) => isRouteReleased(href.split(/[?#]/)[0], flags),
    [flags],
  );
}

export function setPortalModuleFlags(flags: PortalModuleFlags): void {
  setDemoValue(MODULE_FLAGS_STORE_NAME, flags);
}

export function setPortalModuleFlag(
  flags: PortalModuleFlags,
  module: PortalModule,
  released: boolean,
): void {
  setPortalModuleFlags({ ...flags, [module]: released });
}

export function applyPortalWave(wave: PortalWaveId): void {
  setPortalModuleFlags(flagsForWave(wave));
}

export { moduleForRoute };

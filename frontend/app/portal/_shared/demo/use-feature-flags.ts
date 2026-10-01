'use client';

// The flags, as the screens consume them.
//
// One hook, one writer, no context provider: `useSyncExternalStore` over
// `localStorage` already gives every subscriber the same value in the same
// render, and a provider would add a tree that the sidebar, the layout guard
// and the panel would each have to sit inside.

import { useCallback, useMemo } from 'react';

import {
  ACCESS_STORE_NAME,
  VIEWING_AS_STORE_NAME,
  parseAccessState,
  parseViewingAs,
  resolveCompanyFlags,
} from './access-model';

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

/**
 * The GLOBAL default: what the panel's "Módulos liberados" edits. It is also
 * the first row of the access matrix (/portal/admin/acessos).
 */
export function useGlobalModuleFlags(): PortalModuleFlags {
  return useDemoValue(MODULE_FLAGS_STORE_NAME, parseModuleFlags);
}

/**
 * What the screens obey. Normally the global default; while "ver como" is on,
 * the viewed company's resolution (default + its exceptions). One hook for
 * both, so the two existing consumers that hide a module — the sidebar filter
 * and the layout guard — follow "ver como" without a third mechanism.
 * The access store is read raw and only when a company is being viewed.
 */
export function usePortalModuleFlags(): PortalModuleFlags {
  const global = useGlobalModuleFlags();
  const viewingAs = useDemoValue(VIEWING_AS_STORE_NAME, parseViewingAs);
  const access = useDemoValue(ACCESS_STORE_NAME, parseAccessState);
  return useMemo(() => {
    if (!viewingAs || !access) return global;
    const company = access.companies.find((item) => item.id === viewingAs);
    return company ? resolveCompanyFlags(global, company) : global;
  }, [global, viewingAs, access]);
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

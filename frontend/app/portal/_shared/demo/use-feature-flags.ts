'use client';

// The flags, as the screens consume them.
//
// One hook, one writer, no context provider: `useSyncExternalStore` over
// `localStorage` already gives every subscriber the same value in the same
// render, and a provider would add a tree that the sidebar, the layout guard
// and the panel would each have to sit inside.

import { useCallback } from 'react';

import {
  DEFAULT_MODULE_FLAGS,
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
  const stored = useDemoValue(MODULE_FLAGS_STORE_NAME, parseModuleFlags);
  // Produção não tem a seção "Módulos liberados" no painel: todos os módulos
  // do protótipo ficam visíveis, e o que estiver guardado no navegador (de uma
  // onda aplicada num preview, por exemplo) é ignorado — sem a seção, ninguém
  // conseguiria desfazê-lo.
  return process.env.NEXT_PUBLIC_PROTO_INTERNAL === '1'
    ? stored
    : DEFAULT_MODULE_FLAGS;
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

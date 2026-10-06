'use client';

// Grava a visão "Minha operação" na Inteligência a partir das respostas das
// boas-vindas (regras em onboarding-intel.ts). Mesmo store de demonstração que
// o iframe lê: localStorage com try/catch, e uma falha aqui nunca impede a
// Home de abrir.

import { readDemoRaw } from './demo/demo-store';
import { setDemoValue } from './demo/use-demo-store';
import {
  INTEL_VIEWS_STORE_NAME,
  buildDefaultIntelView,
  parseIntelViews,
  upsertDefaultView,
} from './onboarding-intel';
import type { PreferredRoute, Priority } from './onboarding';

export function writeDefaultIntelView(
  routes: PreferredRoute[],
  priority: Priority | '',
): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const current = parseIntelViews(readDemoRaw(window.localStorage, INTEL_VIEWS_STORE_NAME));
    return setDemoValue(
      INTEL_VIEWS_STORE_NAME,
      upsertDefaultView(current, buildDefaultIntelView(routes, priority)),
    );
  } catch {
    return false;
  }
}

'use client';

import { readDemoRaw } from './demo/demo-store';
import { setDemoValue, useDemoValue } from './demo/use-demo-store';
import {
  EMPTY_ONBOARDING,
  ONBOARDING_STORE_NAME,
  parseOnboarding,
  type OnboardingState,
} from './onboarding';

export function useOnboarding(): OnboardingState {
  return useDemoValue(ONBOARDING_STORE_NAME, parseOnboarding);
}

function readOnboarding(): OnboardingState {
  if (typeof window === 'undefined') return EMPTY_ONBOARDING;
  try {
    return parseOnboarding(
      readDemoRaw(window.localStorage, ONBOARDING_STORE_NAME),
    );
  } catch {
    return EMPTY_ONBOARDING;
  }
}

/** Merges a patch over the CURRENT stored state (never a React snapshot). */
export function updateOnboarding(patch: Partial<OnboardingState>): void {
  setDemoValue(ONBOARDING_STORE_NAME, { ...readOnboarding(), ...patch });
}

/** "Ver tour de novo": só o tour; a configuração inicial feita continua. */
export function restartTour(): void {
  updateOnboarding({ tourDone: false });
}

/** Painel de demonstração: primeiro login de novo, tour e configuração. */
export function resetOnboarding(): void {
  setDemoValue(ONBOARDING_STORE_NAME, EMPTY_ONBOARDING);
}

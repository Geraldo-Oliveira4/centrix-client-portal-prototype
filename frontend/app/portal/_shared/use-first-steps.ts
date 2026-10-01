'use client';

// "Primeiros passos" da Home (Prompt 4): estado local, com o prefixo da camada
// de demonstração. Tudo simulado — marcar um passo não cria cotação, alerta nem
// convite em lugar nenhum.

import { readDemoRaw } from './demo/demo-store';
import { setDemoValue, useDemoValue } from './demo/use-demo-store';
import {
  EMPTY_FIRST_STEPS,
  FIRST_STEPS_STORE_NAME,
  parseFirstSteps,
  type FirstStepId,
  type FirstStepsState,
} from './onboarding';

export function useFirstSteps(): FirstStepsState {
  return useDemoValue(FIRST_STEPS_STORE_NAME, parseFirstSteps);
}

function readFirstSteps(): FirstStepsState {
  if (typeof window === 'undefined') return EMPTY_FIRST_STEPS;
  try {
    return parseFirstSteps(
      readDemoRaw(window.localStorage, FIRST_STEPS_STORE_NAME),
    );
  } catch {
    return EMPTY_FIRST_STEPS;
  }
}

export function markFirstStep(id: FirstStepId): void {
  const current = readFirstSteps();
  if (current.done.includes(id)) return;
  setDemoValue(FIRST_STEPS_STORE_NAME, {
    ...current,
    done: [...current.done, id],
  });
}

export function dismissFirstSteps(): void {
  setDemoValue(FIRST_STEPS_STORE_NAME, {
    ...readFirstSteps(),
    dismissed: true,
  });
}

export function resetFirstSteps(): void {
  setDemoValue(FIRST_STEPS_STORE_NAME, EMPTY_FIRST_STEPS);
}

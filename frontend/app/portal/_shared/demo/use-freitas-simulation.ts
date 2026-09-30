'use client';

import {
  FREITAS_SIMULATION_STORE_NAME,
  parseFreitasSimulation,
  type FreitasSimulation,
} from './freitas-simulation';
import { setDemoValue, useDemoValue } from './use-demo-store';

/**
 * The simulated analyst's settings.
 *
 * Nothing in the portal acts on them yet — the automatic reply arrives with the
 * Cotação V2 and PO journeys. The hook exists now so those prompts read the
 * setting instead of inventing a second place to keep it.
 */
export function useFreitasSimulation(): FreitasSimulation {
  return useDemoValue(FREITAS_SIMULATION_STORE_NAME, parseFreitasSimulation);
}

export function setFreitasSimulation(value: FreitasSimulation): void {
  setDemoValue(FREITAS_SIMULATION_STORE_NAME, value);
}

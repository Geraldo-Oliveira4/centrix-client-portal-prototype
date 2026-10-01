'use client';

import {
  FREITAS_SIMULATION_STORE_NAME,
  PRODUCTION_FREITAS_SIMULATION,
  parseFreitasSimulation,
  type FreitasSimulation,
} from './freitas-simulation';
import { setDemoValue, useDemoValue } from './use-demo-store';

/**
 * The simulated analyst's settings.
 *
 * Read by the automatic reply (`use-v2-auto-advance.ts`) for the quotation,
 * direct close and PO journeys.
 */
export function useFreitasSimulation(): FreitasSimulation {
  const stored = useDemoValue(FREITAS_SIMULATION_STORE_NAME, parseFreitasSimulation);
  // Produção não tem a seção "Freitas simulada" no painel: a Freitas responde
  // sozinha, sempre (ver PRODUCTION_FREITAS_SIMULATION).
  return process.env.NEXT_PUBLIC_PROTO_INTERNAL === '1'
    ? stored
    : PRODUCTION_FREITAS_SIMULATION;
}

export function setFreitasSimulation(value: FreitasSimulation): void {
  setDemoValue(FREITAS_SIMULATION_STORE_NAME, value);
}

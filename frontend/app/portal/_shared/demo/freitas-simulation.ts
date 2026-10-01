// "A Freitas responde sozinha" — the settings of the simulated analyst.
//
// PURE, no `@/` alias, for the same reason as `feature-flags.ts`: it runs under
// `npm run test:unit`.
//
// THE SETTINGS ONLY, NOT THE BEHAVIOUR. Nothing in the portal reads these yet:
// the automatic reply belongs to the Cotação V2 and PO journeys, which are
// later work. Storing them now is what lets the panel be built once, and what
// keeps the delay a single number instead of one per journey.
//
// The prototype's backend already has an automatic analyst
// (`backend/app/prototype_flow.py`, which closes an approved quotation with no
// human in the loop). This is NOT that, and must not be confused with it: that
// one is a permanent simplification of the happy path, this one is a visible
// demonstration control that whoever runs the demo turns on and off.

import { decodeDemoValue } from './demo-store.ts';

/** Storage name under `DEMO_STORE_PREFIX`. */
export const FREITAS_SIMULATION_STORE_NAME = 'freitas-simulation';

export interface FreitasSimulation {
  /** Whether the simulated analyst answers without anyone clicking. */
  autoRespond: boolean;
  /** How long it waits before answering. */
  delaySeconds: number;
}

/**
 * The delay window.
 *
 * Below three seconds the reply lands before the client has finished reading
 * what they just sent, and the demonstration stops showing a handoff at all;
 * above a minute nobody in a meeting waits for it. Both ends are demonstration
 * ergonomics, not a claim about how fast the real Freitas answers.
 */
export const MIN_FREITAS_DELAY_SECONDS = 3;
export const MAX_FREITAS_DELAY_SECONDS = 60;
export const DEFAULT_FREITAS_DELAY_SECONDS = 8;

/**
 * Off by default.
 *
 * The published prototype has to keep behaving as it does today, and today
 * nothing answers on its own. Turning the simulated analyst on is a choice of
 * whoever is presenting, never a side effect of opening the portal — the same
 * discipline as the tracking top-up scripts being outside `make seed`.
 */
export const DEFAULT_FREITAS_SIMULATION: FreitasSimulation = {
  autoRespond: false,
  delaySeconds: DEFAULT_FREITAS_DELAY_SECONDS,
};

/** Clamps into the window, rounding to whole seconds. */
/**
 * Em PRODUÇÃO (build sem NEXT_PUBLIC_PROTO_INTERNAL) o painel não tem a seção
 * "Freitas simulada", então nada pode depender dela: a Freitas responde
 * sozinha, sempre, e o que estiver guardado no navegador é ignorado. Sem isso,
 * uma cotação, um fechamento direto ou um PO enviados pelo cliente ficariam
 * "em revisão" para sempre. Em preview vale o padrão de sempre (desligado,
 * ligado pelo painel).
 */
export const PRODUCTION_FREITAS_SIMULATION: FreitasSimulation = {
  autoRespond: true,
  delaySeconds: DEFAULT_FREITAS_DELAY_SECONDS,
};

export function clampFreitasDelay(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_FREITAS_DELAY_SECONDS;
  const whole = Math.round(value);
  if (whole < MIN_FREITAS_DELAY_SECONDS) return MIN_FREITAS_DELAY_SECONDS;
  if (whole > MAX_FREITAS_DELAY_SECONDS) return MAX_FREITAS_DELAY_SECONDS;
  return whole;
}

/**
 * Coerces whatever was on disk.
 *
 * A field of the wrong type takes the default rather than dropping the whole
 * object: a stored delay that lost its meaning should not also switch the
 * analyst back on behind the presenter's back.
 */
export function normalizeFreitasSimulation(raw: unknown): FreitasSimulation {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_FREITAS_SIMULATION };
  }
  const source = raw as Record<string, unknown>;
  return {
    autoRespond:
      typeof source.autoRespond === 'boolean'
        ? source.autoRespond
        : DEFAULT_FREITAS_SIMULATION.autoRespond,
    delaySeconds:
      typeof source.delaySeconds === 'number'
        ? clampFreitasDelay(source.delaySeconds)
        : DEFAULT_FREITAS_SIMULATION.delaySeconds,
  };
}

/** The store entry as settings. Absent or corrupted means "as shipped". */
export function parseFreitasSimulation(raw: string | null): FreitasSimulation {
  return decodeDemoValue(
    raw,
    { ...DEFAULT_FREITAS_SIMULATION },
    normalizeFreitasSimulation,
  );
}

// Feature flags per portal module — the prototype's simulation of RQ-3.
//
// PURE, and deliberately free of the `@/` alias: this module runs under the
// native Node runner (`npm run test:unit`), which does not resolve the alias.
// Same reason as `embarques/lib/delay-risk.ts` and `home/lib/home-actions.ts`.
//
// WHAT THIS IS NOT. In the real product the flag lives per client, on the
// server, and the backend refuses a call to a module that is off — hiding it on
// the screen is not enough. Here there is no per-client anything and no backend
// check: this is a browser-local switch that exists so a release wave can be
// SHOWN in a demonstration. Treat it as a stage prop, never as access control.
//
// THREE AREAS HAVE NO FLAG and are always on: Início, Central de trabalho and
// Configurações. Início is where `ModuleNotReleased` sends the client back to,
// so a client cannot be locked out of the portal by a wave; the other two are
// how they find their own settings and their own day. A wave that could hide
// those would produce a portal with no way out of it.

import { decodeDemoValue } from './demo-store.ts';

/** Every module a wave can turn on or off. */
export const PORTAL_MODULES = [
  'cotacao',
  'cotacaoV2',
  'embarques',
  'embarqueViaPo',
  'inteligencia',
  'radar',
  'auditoria',
] as const;

export type PortalModule = (typeof PORTAL_MODULES)[number];

export type PortalModuleFlags = Record<PortalModule, boolean>;

export const PORTAL_MODULE_LABELS: Record<PortalModule, string> = {
  cotacao: 'Cotação',
  cotacaoV2: 'Cotação V2',
  embarques: 'Meus Embarques',
  embarqueViaPo: 'Novo embarque via PO',
  inteligencia: 'Inteligência',
  radar: 'Radar',
  auditoria: 'Auditoria',
};

export const PORTAL_MODULE_DESCRIPTIONS: Record<PortalModule, string> = {
  cotacao: 'Minhas Cotações, o detalhe e a abertura de cotação.',
  cotacaoV2: 'A revisão da Freitas na abertura e o self-service.',
  embarques: 'Meus Embarques: panorama, lista, mapa e alertas.',
  embarqueViaPo: 'Abrir um embarque a partir da PO do cliente.',
  inteligencia: 'Performance, executivo e agentes.',
  radar: 'Radar de preços de frete por rota.',
  auditoria: 'Conciliação de planejado x realizado.',
};

/**
 * Areas the flags never reach. Listed so the panel can SAY so, instead of the
 * client wondering why three menu items have no switch.
 */
export const ALWAYS_ON_PORTAL_AREAS = [
  'Início',
  'Central de trabalho',
  'Configurações',
];

/**
 * Everything on.
 *
 * This is the default because the published prototype has to keep behaving
 * exactly as it does today: a flag layer that arrives turning screens OFF is
 * indistinguishable, for whoever opens the link, from a regression.
 */
export const DEFAULT_MODULE_FLAGS: PortalModuleFlags = {
  cotacao: true,
  cotacaoV2: true,
  embarques: true,
  embarqueViaPo: true,
  inteligencia: true,
  radar: true,
  auditoria: true,
};

/** Storage name under `DEMO_STORE_PREFIX`. */
export const MODULE_FLAGS_STORE_NAME = 'feature-flags';

export type PortalWaveId = 'onda0' | 'onda1' | 'onda2' | 'onda3' | 'tudo';

export interface PortalWavePreset {
  id: PortalWaveId;
  label: string;
  /** What the wave adds on top of the previous one, in the client's words. */
  description: string;
  modules: PortalModule[];
}

/**
 * The waves of the release plan.
 *
 * CUMULATIVE: each wave carries everything the previous one opened. A wave that
 * dropped a module the client already had would be a rollback, not a release,
 * and the order of the plan is quotation first precisely because the later
 * modules read data that the quotation produces.
 *
 * The composition is a working assumption of the prototype, not a commitment:
 * which clients enter which wave is a product decision that has not been taken.
 */
export const PORTAL_WAVE_PRESETS: PortalWavePreset[] = [
  {
    id: 'onda0',
    label: 'Onda 0',
    description: 'Só a cotação atual.',
    modules: ['cotacao'],
  },
  {
    id: 'onda1',
    label: 'Onda 1',
    description: 'Acrescenta a Cotação V2.',
    modules: ['cotacao', 'cotacaoV2'],
  },
  {
    id: 'onda2',
    label: 'Onda 2',
    description: 'Acrescenta os embarques e a abertura via PO.',
    modules: ['cotacao', 'cotacaoV2', 'embarques', 'embarqueViaPo'],
  },
  {
    id: 'onda3',
    label: 'Onda 3',
    description: 'Acrescenta Inteligência, Radar e Auditoria.',
    modules: [
      'cotacao',
      'cotacaoV2',
      'embarques',
      'embarqueViaPo',
      'inteligencia',
      'radar',
      'auditoria',
    ],
  },
  {
    id: 'tudo',
    label: 'Tudo liberado',
    description: 'O portal inteiro, como ele é publicado hoje.',
    modules: [...PORTAL_MODULES],
  },
];

/** The flag set a wave produces: its modules on, every other module off. */
export function flagsForWave(id: PortalWaveId): PortalModuleFlags {
  const preset = PORTAL_WAVE_PRESETS.find((wave) => wave.id === id);
  const on = new Set<PortalModule>(preset?.modules ?? []);
  return Object.fromEntries(
    PORTAL_MODULES.map((module) => [module, on.has(module)]),
  ) as PortalModuleFlags;
}

/**
 * The wave whose flag set matches exactly, when there is one — the LAST such
 * wave, not the first.
 *
 * Two presets can describe the same set: today "Onda 3" and "Tudo liberado" do,
 * because the last wave happens to open everything that exists. With everything
 * on, the button that should read as selected is "Tudo liberado" — lighting
 * "Onda 3" would tell whoever is presenting that they are looking at a wave,
 * when they are looking at the portal as it is published. The day a module lands
 * outside Onda 3 the two stop coinciding and this stops mattering.
 */
export function matchingWave(flags: PortalModuleFlags): PortalWaveId | null {
  for (let i = PORTAL_WAVE_PRESETS.length - 1; i >= 0; i -= 1) {
    const wave = PORTAL_WAVE_PRESETS[i];
    const same = PORTAL_MODULES.every(
      (module) => flags[module] === wave.modules.includes(module),
    );
    if (same) return wave.id;
  }
  return null;
}

/**
 * Route prefix -> module.
 *
 * MOST SPECIFIC WINS, and `moduleForRoute` sorts by length rather than trusting
 * the order of this array: `/portal/embarques/novo` has to resolve to the PO
 * journey and not to the shipment list that shares its prefix. Writing the rule
 * down beats remembering to keep the array hand-sorted.
 *
 * `/portal/inteligencia/radar` belongs to INTELIGÊNCIA, not to Radar. The two
 * are different screens that happen to share a word: the sidebar's Radar is the
 * standalone module at `/portal/radar`, while the Intelligence tab of the same
 * name is part of that module's own navigation.
 */
export const PORTAL_MODULE_ROUTES: { prefix: string; module: PortalModule }[] = [
  { prefix: '/portal/embarques/novo', module: 'embarqueViaPo' },
  { prefix: '/portal/embarques', module: 'embarques' },
  { prefix: '/portal/cotacoes', module: 'cotacao' },
  { prefix: '/portal/cotacao', module: 'cotacao' },
  { prefix: '/portal/nova-cotacao', module: 'cotacao' },
  { prefix: '/portal/inteligencia', module: 'inteligencia' },
  { prefix: '/portal/radar', module: 'radar' },
  { prefix: '/portal/auditoria', module: 'auditoria' },
];

/** `/portal/x` and `/portal/x/y` match `/portal/x`; `/portal/xyz` does not. */
function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + '/');
}

/**
 * The module a route belongs to, or `null` when no prefix claims it.
 *
 * `null` is not an error state and is not "blocked": Início, Central de
 * trabalho, Configurações, the login screens and anything a later prompt adds
 * all land here, and all of them stay open. A flag layer whose default answer
 * for an unrecognised route was "blocked" would take down every screen someone
 * forgot to register, which is the opposite of the failure we want.
 */
export function moduleForRoute(pathname: string): PortalModule | null {
  let best: { prefix: string; module: PortalModule } | null = null;
  for (const entry of PORTAL_MODULE_ROUTES) {
    if (!matchesPrefix(pathname, entry.prefix)) continue;
    if (!best || entry.prefix.length > best.prefix.length) best = entry;
  }
  return best ? best.module : null;
}

/** Whether the client may open this route under these flags. */
export function isRouteReleased(
  pathname: string,
  flags: PortalModuleFlags,
): boolean {
  const module = moduleForRoute(pathname);
  return module == null ? true : flags[module];
}

/**
 * Coerces whatever was on disk into a usable flag set.
 *
 * A module missing from the stored object takes its DEFAULT, which is on — that
 * is what makes adding a module in a later prompt safe for a browser that
 * already has a saved object: the new module arrives released, exactly as if
 * the layer had never been there, instead of silently hiding a screen.
 */
export function normalizeModuleFlags(raw: unknown): PortalModuleFlags {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_MODULE_FLAGS };
  }
  const source = raw as Record<string, unknown>;
  return Object.fromEntries(
    PORTAL_MODULES.map((module) => [
      module,
      typeof source[module] === 'boolean'
        ? (source[module] as boolean)
        : DEFAULT_MODULE_FLAGS[module],
    ]),
  ) as PortalModuleFlags;
}

/**
 * The store entry as flags. Absent, corrupted and unrecognised all mean the
 * same thing here: the portal behaves exactly as it does with no flag layer.
 */
export function parseModuleFlags(raw: string | null): PortalModuleFlags {
  return decodeDemoValue(
    raw,
    { ...DEFAULT_MODULE_FLAGS },
    normalizeModuleFlags,
  );
}

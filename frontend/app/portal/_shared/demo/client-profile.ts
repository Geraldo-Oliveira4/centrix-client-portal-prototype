// O perfil de cliente que as telas obedecem (PR #11, ajuste antes do merge).
// Puro e SEGURO PARA PRODUÇÃO: não conhece empresas, convites nem CSV.
//
// Duas fontes, e só duas:
//   - o seletor "Tipo de cliente" do painel de Demonstração (existe também em
//     produção) — é ele que liga o SaaS puro numa apresentação a cliente;
//   - o "ver como" da gestão de acessos, que é INTERNO e só existe em preview
//     (NEXT_PUBLIC_PROTO_INTERNAL=1). Ele grava um RETRATO pequeno da empresa
//     vista (id, nome, tipo, exceções), e é só esse retrato que esta camada lê:
//     o modelo da gestão de acessos não entra no bundle de produção.
//
// Precedência: enquanto um "ver como" está ativo, o tipo e os módulos são os
// da empresa vista (a faixa no topo diz isso); sem ele, vale o seletor.

import type { PortalModuleFlags } from './feature-flags.ts';

export type ClientKind = 'freitas' | 'saas';

export const CLIENT_KIND_LABELS: Record<ClientKind, string> = {
  freitas: 'Com operação Freitas',
  saas: 'SaaS puro',
};

/** Seletor do painel. Ausente = com operação Freitas, como o portal sempre foi. */
export const CLIENT_KIND_STORE_NAME = 'client-kind';
export const VIEWING_AS_STORE_NAME = 'viewing-as';

export function parseClientKind(raw: string | null): ClientKind {
  if (raw == null) return 'freitas';
  try {
    return JSON.parse(raw) === 'saas' ? 'saas' : 'freitas';
  } catch {
    return 'freitas';
  }
}

export interface ViewingAsSnapshot {
  id: string;
  name: string;
  kind: ClientKind;
  exceptions: Partial<PortalModuleFlags>;
}

export function parseViewingAs(raw: string | null): ViewingAsSnapshot | null {
  if (raw == null) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (v == null || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== 'string' || !o.id || typeof o.name !== 'string')
    return null;
  const exceptions: Partial<PortalModuleFlags> = {};
  const raw2 = (o.exceptions ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(raw2))
    if (typeof value === 'boolean')
      (exceptions as Record<string, boolean>)[key] = value;
  return {
    id: o.id,
    name: o.name,
    kind: o.kind === 'saas' ? 'saas' : 'freitas',
    exceptions,
  };
}

/** Padrão global + exceções da empresa vista; sem "ver como", o padrão. */
export function effectiveFlags(
  global: PortalModuleFlags,
  viewing: ViewingAsSnapshot | null,
): PortalModuleFlags {
  if (!viewing) return global;
  const out = { ...global };
  for (const key of Object.keys(out) as (keyof PortalModuleFlags)[]) {
    const value = viewing.exceptions[key];
    if (typeof value === 'boolean') out[key] = value;
  }
  return out;
}

export function effectiveClientKind(
  selected: ClientKind,
  viewing: ViewingAsSnapshot | null,
): ClientKind {
  return viewing ? viewing.kind : selected;
}

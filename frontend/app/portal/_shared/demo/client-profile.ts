// O tipo de cliente que as telas obedecem. Puro.
//
// Uma fonte só: o seletor "Tipo de cliente" do painel de Demonstração, que
// existe também em produção. "Com operação Freitas" é o portal de sempre;
// "SaaS puro" desliga todo preenchimento automático (regra em
// `client-kind.ts`). No produto real é um atributo do cliente no Centrix
// interno, junto do DNA.

export type ClientKind = 'freitas' | 'saas';

export const CLIENT_KIND_LABELS: Record<ClientKind, string> = {
  freitas: 'Com operação Freitas',
  saas: 'SaaS puro',
};

/** Seletor do painel. Ausente = com operação Freitas, como o portal sempre foi. */
export const CLIENT_KIND_STORE_NAME = 'client-kind';

export function parseClientKind(raw: string | null): ClientKind {
  if (raw == null) return 'freitas';
  try {
    return JSON.parse(raw) === 'saas' ? 'saas' : 'freitas';
  } catch {
    return 'freitas';
  }
}

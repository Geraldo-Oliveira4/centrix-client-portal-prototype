import type { PortalQuotation, PortalQuotationsResponse } from '@/types/portal';

// Small, dependency-free helpers shared by the Inteligência blocks. Kept apart
// from the components so the six blocks stay presentational.

/** Every quotation across all buckets, unordered. */
export function flattenQuotations(
  data?: PortalQuotationsResponse,
): PortalQuotation[] {
  if (!data) return [];
  return Object.values(data.buckets).flat();
}

/** Quotations that already carry a best/winning proposal. */
export function withProposal(qs: PortalQuotation[]): PortalQuotation[] {
  return qs.filter((q) => q.best_proposal);
}

/** Newest-first by created_at (ISO strings sort lexicographically). */
export function sortByNewest(qs: PortalQuotation[]): PortalQuotation[] {
  return [...qs].sort((a, b) =>
    (b.created_at ?? '').localeCompare(a.created_at ?? ''),
  );
}

/**
 * The quotation whose recommendation the Decisão block summarises: the newest
 * one that has proposals to reason about. Prefers "escolha sua proposta"
 * (awaiting the client's decision), then closed, then still-quoting.
 */
export function pickDecisionCandidate(
  data?: PortalQuotationsResponse,
): PortalQuotation | null {
  if (!data) return null;
  const awaiting = withProposal(data.buckets.aguardando_aprovacao ?? []);
  const closed = withProposal(data.buckets.finalizadas ?? []).filter(
    (q) => q.state === 'FECHADA',
  );
  const quoting = withProposal(data.buckets.buscando_propostas ?? []);
  const pool = sortByNewest([...awaiting, ...closed, ...quoting]);
  return pool[0] ?? null;
}

/**
 * Deterministic pseudo-value in [min, max] from a string seed. MOCK helper: it
 * only spreads illustrative numbers stably so they do not flicker between
 * renders — it models nothing.
 */
export function seededInt(seed: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return min + (hash % (max - min + 1));
}

/** Whole days from now until an ISO date, or null if unparseable. */
export function daysUntilDate(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return null;
  return Math.ceil((time - Date.now()) / 86_400_000);
}

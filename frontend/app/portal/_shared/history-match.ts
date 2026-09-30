// "Você já embarcou esta carga" (30/09/2026). Na Nova cotação, quando produto,
// origem e destino batem com uma cotação anterior do cliente, a tela oferece
// copiar os dados — pelo "Cotar novamente" que já existe
// (`/portal/cotacoes/repetir/[id]`), não por um caminho paralelo.
//
// PURE, sem o alias `@/`: roda sob `npm run test:unit`.
//
// Os três precisam bater: produto parecido em rota diferente é outra operação,
// e a mesma rota com outro produto também. Aprovada (FECHADA) vale mais que só
// cotada, porque é a que virou embarque.

export interface HistoryInput {
  product?: string | null;
  /** Local de coleta e/ou porto/aeroporto de embarque, como o formulário tem. */
  origins: (string | null | undefined)[];
  destinations: (string | null | undefined)[];
}

export interface HistoryQuotation {
  id: string;
  reference: string;
  state: string;
  product?: string | null;
  origin?: string | null;
  porto_embarque?: string | null;
  aeroporto_embarque?: string | null;
  porto_destino?: string[] | null;
  aeroporto_destino?: string[] | null;
  closed_at?: string | null;
  created_at: string;
}

export interface HistoryMatch {
  quotationId: string;
  reference: string;
  /** "2026-08". */
  month: string;
  /** Virou embarque (cotação aprovada). */
  shipped: boolean;
  /**
   * A cotação anterior não registrou destino: casou por produto + origem, e a
   * tela precisa dizer isso em vez de afirmar a rota inteira.
   */
  destinationUnknown: boolean;
}

/** Minúsculas, sem acento, sem pontuação, espaços colapsados. */
export function normalize(text: string | null | undefined): string {
  return (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * O nome do lugar sem país e sem código: "Shanghai, China (CNSHA)" e
 * "Shanghai" são o mesmo porto; "Rua X 100, Shanghai" também cita Shanghai.
 */
function placeTokens(value: string | null | undefined): string[] {
  const raw = (value ?? '').replace(/\([^)]*\)/g, '');
  return raw
    .split(',')
    .map(normalize)
    .filter((part) => part.length >= 3);
}

function samePlace(
  a: (string | null | undefined)[],
  b: (string | null | undefined)[],
): boolean {
  const left = new Set(a.flatMap(placeTokens));
  return b.flatMap(placeTokens).some((token) => left.has(token));
}

function sameProduct(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const x = normalize(a);
  const y = normalize(b);
  if (x.length < 4 || y.length < 4) return false;
  return x === y || x.includes(y) || y.includes(x);
}

export function matchHistory(
  input: HistoryInput,
  quotations: HistoryQuotation[],
): HistoryMatch | null {
  if (!normalize(input.product)) return null;
  const destinationsOf = (q: HistoryQuotation) =>
    [...(q.porto_destino ?? []), ...(q.aeroporto_destino ?? [])].filter(
      Boolean,
    );
  // Destino registrado na anterior TEM de bater. Sem destino registrado nela
  // ("Destino a confirmar"), produto + origem bastam — e o match diz isso.
  const candidates = quotations.filter(
    (q) =>
      sameProduct(input.product, q.product) &&
      samePlace(input.origins, [
        q.origin,
        q.porto_embarque,
        q.aeroporto_embarque,
      ]) &&
      (destinationsOf(q).length === 0 ||
        samePlace(input.destinations, destinationsOf(q))),
  );
  if (candidates.length === 0) return null;
  const when = (q: HistoryQuotation) => q.closed_at ?? q.created_at;
  // Rota completa antes de rota sem destino; embarcada antes de só cotada;
  // a mais recente antes.
  const best = [...candidates].sort((a, b) => {
    const knownA = destinationsOf(a).length ? 0 : 1;
    const knownB = destinationsOf(b).length ? 0 : 1;
    const shippedA = a.state === 'FECHADA' ? 0 : 1;
    const shippedB = b.state === 'FECHADA' ? 0 : 1;
    return (
      knownA - knownB || shippedA - shippedB || when(b).localeCompare(when(a))
    );
  })[0];
  return {
    quotationId: best.id,
    reference: best.reference,
    month: when(best).slice(0, 7),
    shipped: best.state === 'FECHADA',
    destinationUnknown: destinationsOf(best).length === 0,
  };
}

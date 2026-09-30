// "Carregar cenários de demonstração" — as seis etapas distribuídas de uma vez.
//
// PURE, no `@/` alias: runs under `npm run test:unit`.
//
// WHY IT EXISTS. Walking the whole journey takes six clicks per quotation and
// leaves five of the six states invisible while you are in the sixth. A
// demonstration needs the Kanban FULL — a returned card next to a draft, a card
// in each review, a released one ready to compare — before anyone has clicked
// anything.
//
// IT ONLY WRITES THE OVERLAY. No quotation is created, none is renumbered, and
// nothing goes to the server: the scenarios attach to quotations that already
// exist in the seed, chosen by the order the API returned them. That is also
// why it cannot break the prévia (`cotacoes/previa/`, which builds its own
// fixtures in memory and never reads this store) nor any existing test.
//
// THE BACKEND STATE IS NOT TOUCHED, which is deliberate and is the one thing to
// understand before adding a scenario: a quotation can be AGUARDANDO_DADOS in
// the payload and `released` in the overlay. In the integrated product the two
// are one state; here the overlay is what the V2 screens read, and the payload
// is what everything else keeps reading.

import {
  approveEntry,
  createReview,
  quotesArrived,
  releaseProposals,
  returnToClient,
  submitToFreitas,
  type QuotationReview,
  type QuotationReviewStore,
  type V2Stage,
} from './quotation-review.ts';

/** The minimum this module needs to know about a quotation. */
export interface ScenarioQuotation {
  id: string;
  reference: string;
  proposals?: { id: string; total_brl?: number | null }[] | null;
}

/**
 * Motivo de devolução do cenário. Fictício e ilustrativo, como todo dado deste
 * repositório — é um dos exemplos de bloqueio que a própria spec cita.
 */
export const SCENARIO_RETURN_REASON = 'Peso divergente da invoice';

/**
 * A ordem em que as etapas são distribuídas.
 *
 * `released` PRIMEIRO, e isso não é estética: ele é o único cenário que precisa
 * de propostas no payload para ficar completo, então ele fica com a primeira
 * cotação que tiver alguma. Deixá-lo por último faria a demonstração cair,
 * quase sempre, numa cotação sem proposta nenhuma e abrir a comparação vazia.
 */
export const SCENARIO_ORDER: V2Stage[] = [
  'released',
  'exit_review',
  'entry_review',
  'returned',
  'awaiting_quotes',
  'draft',
];

/** Instants far enough apart to read as a real sequence in the timeline. */
function stepTimes(now: number, steps: number): string[] {
  const MINUTE = 60_000;
  return Array.from({ length: steps }, (_, index) =>
    new Date(now - (steps - index) * 12 * MINUTE).toISOString(),
  );
}

/** Builds one entry already sitting at `stage`, with a coherent history. */
export function buildScenario(
  stage: V2Stage,
  proposalIds: string[],
  now: number,
): QuotationReview {
  const t = stepTimes(now, 5);
  let review = createReview(t[0]);
  if (stage === 'draft') return review;

  review = submitToFreitas(review, t[1]);
  if (stage === 'entry_review') return review;

  if (stage === 'returned') {
    return returnToClient(review, SCENARIO_RETURN_REASON, t[2]);
  }

  review = approveEntry(review, t[2]);
  if (stage === 'awaiting_quotes') return review;

  review = quotesArrived(review, t[3]);
  if (stage === 'exit_review') return review;

  // `released` com payload sem proposta pararia na revisão de saída (é o que
  // `releaseProposals` faz com lista vazia). Não é erro: é o estado honesto,
  // e o próprio painel diz que não há o que liberar.
  return releaseProposals(review, proposalIds, t[4]);
}

/**
 * Distribui as seis etapas pelas cotações disponíveis.
 *
 * Uma cotação por etapa, e nunca duas etapas na mesma cotação. Com menos de
 * seis cotações, as etapas do fim da ordem simplesmente não entram — meia
 * demonstração é melhor que duas etapas disputando o mesmo cartão.
 */
export function buildScenarioStore(
  quotations: ScenarioQuotation[],
  now: number = Date.now(),
): QuotationReviewStore {
  const priced = (q: ScenarioQuotation) =>
    (q.proposals ?? []).filter(
      (p) => Number.isFinite(p.total_brl) && (p.total_brl ?? 0) > 0,
    );

  // A cotação com mais propostas com preço vai para `released`, que é o único
  // cenário que precisa delas. O resto segue a ordem em que a API devolveu.
  const pool = [...quotations].sort(
    (a, b) => priced(b).length - priced(a).length,
  );

  const store: QuotationReviewStore = {};
  SCENARIO_ORDER.forEach((stage, index) => {
    const quotation = pool[index];
    if (!quotation) return;
    store[quotation.id] = buildScenario(
      stage,
      priced(quotation).map((p) => p.id),
      now,
    );
  });
  return store;
}

/** Shape of the portal's `/portal/quotations` response, narrowed. */
export interface ScenarioSource {
  buckets?: Record<string, ScenarioQuotation[]>;
}

/** The store to write, straight from the SWR payload. */
export function buildDemoScenarios(
  data: ScenarioSource | undefined,
  now: number = Date.now(),
): QuotationReviewStore {
  const rows = Object.values(data?.buckets ?? {}).flat();
  return buildScenarioStore(rows, now);
}

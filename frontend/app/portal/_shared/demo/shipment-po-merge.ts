// The PO overlay, merged into the wallet that `useMyShipments` returns.
//
// PURE, no `@/` alias — it runs under `npm run test:unit`.
//
// THE CLOSED UNION IS NOT TOUCHED. `EmbarqueEstado` has seven operational
// values and none of them means "the Freitas has not looked at this yet".
// Adding one would ripple through every map keyed by it
// (`ESTADO_BADGE_CLASS`, `ESTADO_SEMAFORO`, `SHIPMENT_STEPS`, the timeline,
// the map markers) and would put a prototype-only state inside a type that
// mirrors the backend's enum.
//
// So a shipment in review is `solicitado` — the FIRST state of the real
// journey, the one a shipment is in before anything has happened to it — plus
// an OPTIONAL `review_status` field that only the V2 screens read. Anything
// that does not know about `review_status` keeps treating it as an ordinary
// `solicitado` shipment, which is the truthful fallback.
//
// ORIGIN IS NOT FABRICATED. `routePartsOf` falls back to `illustrativeHub`,
// which invents a port from the reference. For a shipment the Freitas has not
// reviewed, inventing Shanghai would be inventing the one fact the review
// exists to establish — so `poRouteLabel` returns "A definir" instead, and
// origin, destination and weight stay hidden while it is in review (the spec's
// Open Question 3).

import type { PortalShipment } from '../../../../types/portal-shipment.ts';
import {
  PO_STAGE_LABELS,
  isPoDraft,
  type PoStage,
  type ShipmentPoReview,
  type ShipmentPoStore,
} from './shipment-po-review.ts';

/** What the V2 screens read off a merged shipment. Absent on every other one. */
export interface PoReviewStatus {
  stage: PoStage;
  reference: string;
  poNumbers: string[];
  hasQuotation: boolean;
  returnReason: string | null;
  fieldsToFix: string[];
  /** ISO, when the shipment entered the current stage. */
  since: string;
  /**
   * O que a carga É, para a linha da carteira.
   *
   * Sai do primeiro item do PO. Sem isto o cartao cairia no
   * `client_reference` e imprimiria o numero do PO duas vezes — como titulo e
   * como etiqueta —, sem dizer em momento nenhum o que esta dentro do
   * embarque.
   */
  title: string | null;
}

export interface PortalShipmentWithReview extends PortalShipment {
  review_status?: PoReviewStatus;
}

/** Route label for a shipment whose origin nobody has established yet. */
export const PO_UNDEFINED_ROUTE = 'A definir';

function statusOf(entry: ShipmentPoReview): PoReviewStatus {
  const first = entry.data.items[0];
  return {
    stage: entry.stage,
    reference: entry.reference,
    poNumbers: entry.data.poNumbers,
    hasQuotation: !!entry.linkedQuotationId,
    returnReason: entry.returnReason ?? null,
    fieldsToFix: entry.fieldsToFix,
    since: entry.stageEnteredAt,
    title: first?.description?.trim() || null,
  };
}

/**
 * Builds the `PortalShipment` a PO overlay entry stands for.
 *
 * Everything the review has not established yet is NULL, not a guess: no
 * incoterm the client did not type, no agent, no tracking. `quotation_id` is
 * the linked quotation or null, which is what drives the "Sem cotação" chip.
 */
export function poShipmentFrom(
  id: string,
  entry: ShipmentPoReview,
): PortalShipmentWithReview {
  const created = entry.history[0]?.at ?? entry.stageEnteredAt;
  return {
    id,
    referencia: entry.reference,
    client_reference: entry.data.poNumbers[0] ?? null,
    estado: 'solicitado',
    incoterm: entry.data.incoterm || null,
    modal: (entry.data.modal || null) as PortalShipment['modal'],
    tipo_embarque: (entry.data.tipoEmbarque ||
      null) as PortalShipment['tipo_embarque'],
    tipo_despacho: (entry.data.despacho || null) as PortalShipment['tipo_despacho'],
    carga_urgente: entry.data.urgent,
    agente_nome: null,
    quotation_id: entry.linkedQuotationId ?? null,
    created_at: created,
    updated_at: entry.stageEnteredAt,
    tracking: null,
    review_status: statusOf(entry),
  };
}

/**
 * The wallet the screens should draw: the API's shipments plus the PO ones.
 *
 * DRAFTS ARE EXCLUDED. The spec is explicit that a draft "não aparece na
 * carteira" — the client resumes it from the "Abrir novo embarque" modal. A
 * draft in the wallet would be a shipment the Freitas has never heard of.
 *
 * An overlay entry whose id matches an API shipment ANNOTATES it instead of
 * duplicating it: that is what lets a validated PO shipment keep its place
 * once (in the real version) the backend starts returning it.
 */
export function mergePoShipments(
  shipments: PortalShipment[],
  store: ShipmentPoStore,
): PortalShipmentWithReview[] {
  const entries = Object.entries(store).filter(([, e]) => !isPoDraft(e));
  const byId = new Map(entries);

  const annotated: PortalShipmentWithReview[] = shipments.map((shipment) => {
    const entry = byId.get(shipment.id);
    if (!entry) return shipment;
    byId.delete(shipment.id);
    return { ...shipment, review_status: statusOf(entry) };
  });

  // Newest first, so a shipment the client just sent is the one they land on.
  const created = Array.from(byId.entries())
    .map(([id, entry]) => poShipmentFrom(id, entry))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

  return [...created, ...annotated];
}

/** Only the ones still waiting on the Freitas — the "Em análise (n)" filter. */
export function shipmentsInPoReview(
  shipments: PortalShipmentWithReview[],
): PortalShipmentWithReview[] {
  return shipments.filter(
    (s) =>
      s.review_status?.stage === 'awaiting_review' ||
      s.review_status?.stage === 'returned',
  );
}

export function countShipmentsInPoReview(
  shipments: PortalShipmentWithReview[],
): number {
  return shipmentsInPoReview(shipments).length;
}

/** True while origin, destination and weight must stay hidden. */
export function hidesRoute(shipment: PortalShipmentWithReview): boolean {
  const stage = shipment.review_status?.stage;
  return stage === 'awaiting_review' || stage === 'returned';
}

/**
 * The route label for the list.
 *
 * Returns `null` when the caller should use its normal resolution, and
 * `PO_UNDEFINED_ROUTE` when the shipment is in review and has no quotation —
 * the case where the usual resolution would invent a port.
 */
/**
 * O rótulo da rota de um embarque aberto por PO.
 *
 * `null` quando a tela deve resolver a rota como sempre resolve;
 * `PO_UNDEFINED_ROUTE` quando ela inventaria um porto.
 *
 * A CONDIÇÃO É "NÃO TEM COTAÇÃO", não "está em análise". `routePartsOf` cai no
 * `illustrativeHub`, que deriva um porto da REFERÊNCIA do embarque — e um
 * embarque aberto por PO não tem cotação nem depois de validado, então sem esta
 * linha ele passaria a exibir "Los Angeles → Brasil" no instante em que a
 * Freitas o ativasse. Origem é justamente o que ninguém estabeleceu ainda; ela
 * é preenchida depois, nas abas Datas e Booking (RQ-10).
 */
export function poRouteLabel(
  shipment: PortalShipmentWithReview,
): string | null {
  if (!shipment.review_status) return null;
  if (shipment.quotation_id) return null;
  return PO_UNDEFINED_ROUTE;
}

/** The seal's text for the list row. */
export function poStageLabel(stage: PoStage): string {
  return PO_STAGE_LABELS[stage];
}

// Client Portal shipment (GE) types.
//
// Mirrors the backend contract from backend/lambdas/client_portal/{list,get}_my_shipment*
// and shared/portal_shipment_helpers.py. Kept apart from types/shipment.ts (the
// analyst GE workspace) because the portal receives a deliberately narrower
// projection: no inova_processo_id, no client, no datas.
//
// The state enum itself is shared — it is the same EmbarqueState column.

import type { EmbarqueEstado } from './shipment';
import type { QuotationModal, TipoEmbarque } from './quotation';

export type { EmbarqueEstado };

/**
 * Carrier data sufficiency, as reported by the tracking source (ShipsGo).
 * Three-valued on purpose, and the three are NOT interchangeable:
 *   null         -> the integration does not exist yet ("Pendente integração")
 *   'INCOMPLETE' -> integrated, but the carrier did not report enough data
 *   'COMPLETE'   -> integrated and reported
 */
export type TrackingDataStatus = 'COMPLETE' | 'INCOMPLETE';

/**
 * Last carrier milestone, in the ShipsGo vocabulary. Maps 1:1 onto the four
 * post-embarque steps of the timeline. Gate-in and Vessel Loading are absent
 * because they are the real states `coletado` / `embarcado`.
 */
export type TrackingMilestone =
  | 'OCEAN_TRANSIT'
  | 'ARRIVAL'
  | 'DISCHARGE'
  | 'AVAILABLE';

/**
 * Carrier tracking block (backend migrations 091 + 092). No real integration
 * writes it yet: in production-shaped data every field is NULL. The demo
 * top-up (backend/scripts/topup_tracking_demo.py) populates a few shipments to
 * exercise the three visual states, and every one of those rows carries
 * `is_mock: true`.
 *
 * `first_eta` / `current_eta` are the two dates the delay risk is computed from
 * (see app/portal/embarques/lib/delay-risk.ts); `eta_is_actual` is ShipsGo's
 * IsActual — true when `current_eta` is the real arrival, not an estimate.
 *
 * `is_mock` is the honesty switch: whenever it is true the surfaces that render
 * these values must show the `preview` ProvenanceBadge. Never render a tracking
 * value without checking it.
 */
export interface PortalShipmentTracking {
  first_eta: string | null;
  current_eta: string | null;
  eta_is_actual: boolean | null;
  data_status: TrackingDataStatus | null;
  last_milestone: TrackingMilestone | null;
  /**
   * When the carrier says `last_milestone` happened (backend migration 093).
   * Null even when the milestone is known — a carrier may report the stage
   * without dating it. Never fall back to `current_eta` to fill it: that is the
   * arrival at POD, and every milestone after ARRIVAL happens later than it.
   */
  last_milestone_at: string | null;
  is_mock: boolean;
}

export interface PortalShipment {
  id: string;
  referencia: string;
  /**
   * The client's own PO number, read from the quotation that provisioned this
   * shipment (backend joins Processo.quotation_id -> Quotation.client_reference).
   *
   * It is an ADDITIONAL display/search key, never the record's identity: the
   * portal still addresses a shipment by `id` and names it by `referencia`.
   * Null for a process the analyst opened outside the portal — there is no
   * quotation behind it, so there is no PO, and that reads as absent.
   */
  client_reference: string | null;
  estado: EmbarqueEstado;
  incoterm: string | null;
  modal: QuotationModal | null;
  tipo_embarque: TipoEmbarque | null;
  tipo_despacho: 'DIRETO' | 'CONSOLIDADO' | null;
  carga_urgente: boolean;
  agente_nome: string | null;
  quotation_id: string | null;
  created_at: string;
  updated_at: string | null;
  // Optional so a payload predating migration 091 (or any caller building a
  // shipment stub) is still a valid PortalShipment; absent reads the same as
  // "not integrated".
  tracking?: PortalShipmentTracking | null;
}

export interface PortalShipmentContainer {
  numero?: string | null;
  tipo?: string | null;
  tara?: number | null;
}

export interface PortalShipmentDetail extends PortalShipment {
  agente: { id: string; nome: string } | null;
  containers: PortalShipmentContainer[];
  observacao: string | null;
}

export interface PortalShipmentList {
  items: PortalShipment[];
  total: number;
  by_estado: Partial<Record<EmbarqueEstado, number>>;
}

// The happy path, in order. The two exception states are deliberately absent:
// they are not positions on this line, they are conditions that interrupt it.
export const SHIPMENT_STEPS: EmbarqueEstado[] = [
  'solicitado',
  'aguardando_prontidao',
  'coletado',
  'analise_booking',
  'embarcado',
];

export const EXCEPTION_STATES: EmbarqueEstado[] = [
  'postergado',
  'booking_divergente',
];

export const isExceptionState = (estado: EmbarqueEstado): boolean =>
  EXCEPTION_STATES.includes(estado);

// Client-facing wording. Deliberately not imported from the analyst kanban
// constants (app/embarques/kanban/constants.ts): that screen speaks to
// operators, this one to the importer, and the two should be free to diverge.
export const ESTADO_LABELS: Record<EmbarqueEstado, string> = {
  solicitado: 'Solicitado',
  aguardando_prontidao: 'Aguardando prontidão',
  coletado: 'Coletado',
  analise_booking: 'Em análise de booking',
  embarcado: 'Embarcado',
  postergado: 'Postergado',
  booking_divergente: 'Booking divergente',
};

// Short explanation shown under the progress indicator, so the client knows what
// the current stage actually means for their cargo.
export const ESTADO_DESCRIPTIONS: Record<EmbarqueEstado, string> = {
  solicitado: 'O embarque foi aberto a partir da cotação aprovada.',
  aguardando_prontidao: 'Aguardando a carga ficar pronta na origem.',
  coletado: 'A carga foi coletada e segue para o porto ou aeroporto de embarque.',
  analise_booking: 'A Freitas está conferindo os dados do booking com o armador.',
  embarcado: 'A carga embarcou e está a caminho do destino.',
  postergado: 'O embarque foi adiado. A Freitas está tratando a reprogramação.',
  booking_divergente:
    'O booking veio diferente do que foi aprovado. A Freitas está em tratativa com o armador.',
};

/**
 * Health semáforo — 3 colours only (green / orange / red), no 4th status colour.
 * A shipment is GREEN whenever it is progressing normally (whatever the internal
 * stage), and only lights up when something needs the client's attention:
 *
 *   portal-success (green)  — proceeding normally: solicitado, aguardando_prontidao,
 *                             coletado, analise_booking, embarcado
 *   portal-warning (orange) — attention: postergado (a delay)
 *   portal-danger  (red)    — critical: booking_divergente (divergence)
 *
 * The old blue "info" tone was dropped: the portal status rule is a 3-colour
 * semáforo, so the internal progress stages all read as green health. Brand pink
 * stays absent — it means "action", and a shipment state is never a client action.
 */
export type SemaforoTone = 'success' | 'warning' | 'danger';

export const ESTADO_SEMAFORO: Record<EmbarqueEstado, SemaforoTone> = {
  solicitado: 'success',
  aguardando_prontidao: 'success',
  coletado: 'success',
  analise_booking: 'success',
  embarcado: 'success',
  postergado: 'warning',
  booking_divergente: 'danger',
};

/**
 * Rótulo de cada tom do semáforo. Uma definição só, porque quatro superfícies o
 * imprimem (o contador da Lista, o filtro "Situação", a legenda do Mapa e o
 * card "Visão do todo") e três cópias já tinham nascido.
 *
 * POR QUE `warning` NÃO FALA EM "ATRASO" (decisão de 18/08/2026)
 * --------------------------------------------------------------
 * O rótulo era "Atenção / atraso", e na aba Mapa ele aparecia a centímetros do
 * chip "Com atraso": um dizia 1, o outro 5. Dois números diferentes com a mesma
 * palavra na mesma tela leem como bug de contagem, e não é o caso — são duas
 * réguas legitimamente distintas, sobre fontes distintas:
 *
 *   - o chip "Com atraso" mede o DESLIZE DA COMPANHIA MARÍTIMA: quantos dias o
 *     ETA atual passou do primeiro ETA (`delayRiskFromTracking`, a mesma função
 *     do badge de cada card). É medida contínua, existe só onde há
 *     rastreamento, e um embarque em curso normal pode estar atrasado nela;
 *   - o semáforo mede o ESTADO DO EMBARQUE no GE (`ESTADO_SEMAFORO`): uma
 *     classificação categórica do que a Freitas registrou, que hoje só acende
 *     laranja em `postergado`. Existe para todo embarque, com ou sem
 *     rastreamento, e não sabe nada de ETA.
 *
 * Elas não podem ser unificadas sem perder informação: unificar apagaria ou o
 * embarque adiado que a companhia ainda não reportou, ou o embarque que a
 * Freitas não reprogramou e que mesmo assim vai chegar cinco dias tarde. As
 * duas ficam, e o que muda é o NOME — só o chip fala em atraso, e o semáforo
 * passa a dizer o que de fato classifica. Mesmo julgamento do "✓ Desembaraçado":
 * quando duas fontes respondem coisas diferentes, o texto tem de deixar isso à
 * vista em vez de sugerir equivalência.
 *
 * "Reprogramado" é verdade hoje porque `postergado` é o único estado laranja. Um
 * estado laranja novo que não seja reprogramação exige rever este rótulo — o
 * teste `shipment-semaforo.test.ts` falha se isso acontecer.
 */
export const SEMAFORO_LABELS: Record<SemaforoTone, string> = {
  success: 'Em andamento',
  warning: 'Reprogramado',
  danger: 'Exceção',
};

const SEMAFORO_BADGE_CLASS: Record<SemaforoTone, string> = {
  success: 'bg-portal-success/10 text-portal-success border-portal-success/25',
  warning: 'bg-portal-warning/10 text-portal-warning-ink border-portal-warning/30',
  danger: 'bg-portal-danger/10 text-portal-danger border-portal-danger/30',
};

// TEXT, not fill: warning is spelled portal-warning-ink #8A5E00 (5.4:1) rather
// than portal-warning #C98A00 (2.95:1, fails AA for copy). The badge and dot
// maps above keep the fill — same rule as TONE_TEXT vs TONE_DOT in
// _shared/tone.ts.
const SEMAFORO_ACCENT_CLASS: Record<SemaforoTone, string> = {
  success: 'text-portal-success',
  warning: 'text-portal-warning-ink',
  danger: 'text-portal-danger',
};

/** Semáforo badge classes per state (bg + text + border). */
export const ESTADO_BADGE_CLASS: Record<EmbarqueEstado, string> =
  Object.fromEntries(
    (Object.keys(ESTADO_SEMAFORO) as EmbarqueEstado[]).map((estado) => [
      estado,
      SEMAFORO_BADGE_CLASS[ESTADO_SEMAFORO[estado]],
    ]),
  ) as Record<EmbarqueEstado, string>;

/** Solid semáforo colour per state, for map arcs, dots and tile numbers. */
export const ESTADO_ACCENT_CLASS: Record<EmbarqueEstado, string> =
  Object.fromEntries(
    (Object.keys(ESTADO_SEMAFORO) as EmbarqueEstado[]).map((estado) => [
      estado,
      SEMAFORO_ACCENT_CLASS[ESTADO_SEMAFORO[estado]],
    ]),
  ) as Record<EmbarqueEstado, string>;

// Counts per semáforo tone, for the "🟢 N · 🟠 N · 🔴 N" strip. Derives from the
// same ESTADO_SEMAFORO map, so the counter and the dots can never disagree.
export interface SemaforoCounts {
  success: number;
  warning: number;
  danger: number;
}

export const countBySemaforo = (
  shipments: { estado: EmbarqueEstado }[],
): SemaforoCounts => {
  const counts: SemaforoCounts = { success: 0, warning: 0, danger: 0 };
  shipments.forEach((s) => {
    counts[ESTADO_SEMAFORO[s.estado]] += 1;
  });
  return counts;
};

export const SEMAFORO_DOT_CLASS: Record<SemaforoTone, string> = {
  success: 'bg-portal-success',
  warning: 'bg-portal-warning',
  danger: 'bg-portal-danger',
};

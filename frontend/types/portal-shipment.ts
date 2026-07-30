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

export interface PortalShipment {
  id: string;
  referencia: string;
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

const SEMAFORO_BADGE_CLASS: Record<SemaforoTone, string> = {
  success: 'bg-portal-success/10 text-portal-success border-portal-success/25',
  warning: 'bg-portal-warning/10 text-portal-warning border-portal-warning/30',
  danger: 'bg-portal-danger/10 text-portal-danger border-portal-danger/30',
};

const SEMAFORO_ACCENT_CLASS: Record<SemaforoTone, string> = {
  success: 'text-portal-success',
  warning: 'text-portal-warning',
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

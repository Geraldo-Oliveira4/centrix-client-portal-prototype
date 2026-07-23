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
 * Semantic colour per state. The palette carries the meaning, so the same state
 * reads identically in the badge, the summary tile and the progress steps:
 *
 *   portal-info    — moving, nothing required from the client (solicitado, coletado)
 *   portal-warning — waiting or under review (aguardando_prontidao, analise_booking,
 *                    postergado: a delay is attention, not a failure)
 *   portal-success — done (embarcado)
 *   portal-danger  — divergence the client should know about (booking_divergente)
 *
 * Brand pink is deliberately absent: it means "action" in this app, and a
 * shipment state is never an action the client can take here.
 */
export const ESTADO_BADGE_CLASS: Record<EmbarqueEstado, string> = {
  solicitado: 'bg-portal-info/10 text-portal-info border-portal-info/25',
  aguardando_prontidao:
    'bg-portal-warning/10 text-portal-warning border-portal-warning/30',
  coletado: 'bg-portal-info/10 text-portal-info border-portal-info/25',
  analise_booking:
    'bg-portal-warning/10 text-portal-warning border-portal-warning/30',
  embarcado: 'bg-portal-success/10 text-portal-success border-portal-success/25',
  postergado: 'bg-portal-warning/10 text-portal-warning border-portal-warning/30',
  booking_divergente:
    'bg-portal-danger/10 text-portal-danger border-portal-danger/30',
};

/** Solid colour per state, for the progress dots and the summary tile numbers. */
export const ESTADO_ACCENT_CLASS: Record<EmbarqueEstado, string> = {
  solicitado: 'text-portal-info',
  aguardando_prontidao: 'text-portal-warning',
  coletado: 'text-portal-info',
  analise_booking: 'text-portal-warning',
  embarcado: 'text-portal-success',
  postergado: 'text-portal-warning',
  booking_divergente: 'text-portal-danger',
};

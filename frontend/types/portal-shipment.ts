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

export const ESTADO_BADGE_CLASS: Record<EmbarqueEstado, string> = {
  solicitado: 'bg-blue-50 text-blue-700 border-blue-200',
  aguardando_prontidao: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  coletado: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  analise_booking: 'bg-orange-50 text-orange-800 border-orange-200',
  embarcado: 'bg-green-50 text-green-700 border-green-200',
  postergado: 'bg-amber-50 text-amber-800 border-amber-200',
  booking_divergente: 'bg-destructive/10 text-destructive border-destructive/30',
};

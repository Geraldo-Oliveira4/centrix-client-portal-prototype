import type { QuotationModal, TipoEmbarque } from './quotation';

// GE (Gerenciamento de Embarque) module types.
// Mirrors the backend contract from backend/lambdas/shipment/* and
// shared/lambda_helpers.py (serialize_processo_detail / serialize_processo_kanban_item).
// Backend naming (EMB-YYYY-NNNN reference, lowercase snake_case states) is the source
// of truth; the prototype prints are visual reference only.

// EmbarqueState — five primary states plus two exception states.
export type EmbarqueEstado =
  | 'solicitado'
  | 'aguardando_prontidao'
  | 'coletado'
  | 'analise_booking'
  | 'embarcado'
  | 'postergado'
  | 'booking_divergente';

export type TipoDespacho = 'DIRETO' | 'CONSOLIDADO';

// Reuse the quotation enums — backend shares the same Modal / TipoEmbarque types.
export type ShipmentModal = QuotationModal;
export type { TipoEmbarque };

export const TIPO_DESPACHO_LABELS: Record<TipoDespacho, string> = {
  DIRETO: 'Direto',
  CONSOLIDADO: 'Consolidado',
};

// Date keys carried in the processo.datas JSONB (PROCESSO_DATAS_KEYS on the backend).
export interface ShipmentDatas {
  prontidao: string | null;
  limite_necessidade: string | null;
  coleta: string | null;
  embarque: string | null;
  chegada_destino: string | null;
}

// Compact card item from GET /shipments/kanban.
export interface ShipmentKanbanItem {
  id: string;
  referencia: string;
  estado: EmbarqueEstado;
  cliente_nome: string;
  agente_nome: string | null;
  incoterm: string | null;
  modal: ShipmentModal | null;
  tipo_embarque: TipoEmbarque | null;
  tipo_despacho: TipoDespacho | null;
  carga_urgente: boolean;
  data_prontidao: string | null;
  data_limite_necessidade: string | null;
  quotation_id: string | null;
  inova_processo_id: string | null;
  created_at: string;
}

export interface ShipmentKanbanColumn {
  count: number;
  items: ShipmentKanbanItem[];
}

// Columns are keyed by every EmbarqueEstado value.
export type ShipmentKanban = Record<EmbarqueEstado, ShipmentKanbanColumn>;

// Rich detail from GET /shipments/{id} and PUT /shipments/{id} — workspace view.
export interface ShipmentDetail {
  id: string;
  referencia: string;
  estado: EmbarqueEstado;
  cliente: { id: string; nome: string };
  agente: { id: string; nome: string } | null;
  incoterm: string | null;
  modal: ShipmentModal | null;
  tipo_embarque: TipoEmbarque | null;
  tipo_despacho: TipoDespacho | null;
  carga_urgente: boolean;
  observacao: string | null;
  quotation_id: string | null;
  inova_processo_id: string | null;
  datas: ShipmentDatas;
  created_at: string;
}

// ---- Booking (Dados de Frete) — ARB-2378 ----

export interface BookingContainer {
  numero: string;
  tipo: string;
  tara: number | null;
}

export interface BookingDetail {
  id: string;
  embarque_id: string;
  cia_aerea_armador: string | null;
  mawb_mbl: string | null;
  hawb_hbl: string | null;
  containers: BookingContainer[] | null;
  frete_valor: number | null;
  seguro_valor: number | null;
  observacao: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface UpdateBookingPayload {
  cia_aerea_armador?: string | null;
  mawb_mbl?: string | null;
  hawb_hbl?: string | null;
  containers?: BookingContainer[] | null;
  frete_valor?: number | null;
  seguro_valor?: number | null;
  observacao?: string | null;
}

// ---- Followup (Ocorrencias) — ARB-2380 ----

export interface Followup {
  id: string;
  embarque_id: string;
  grupo: string | null;
  tipo_ocorrencia: string;
  nota: string | null;
  origem: 'MANUAL' | 'AUTOMATICO';
  responsavel_id: string | null;
  created_at: string;
}

export interface CreateFollowupPayload {
  tipo_ocorrencia: string;
  nota?: string | null;
  grupo?: string | null;
}

// ---- Documentos Anexados — ARB-2379 ----

export interface TipoArquivo {
  codigo: number;
  descricao: string;
}

export interface EmbarqueDocumento {
  id: string;
  embarque_id: string;
  tipo_arquivo_codigo: number | null;
  tipo_arquivo_label: string;
  observacao: string | null;
  responsavel_id: string | null;
  inova_sequencia: number | null;
  created_at: string;
  download_url: string | null;
}

// Response shape of GET /shipments/{id}/documentos.
export interface EmbarqueDocumentosResponse {
  items: EmbarqueDocumento[];
  tipos_arquivo: { curated: TipoArquivo[]; outros: TipoArquivo[] };
}

export interface UploadDocumentoPayload {
  tipo_arquivo_label: string;
  tipo_arquivo_codigo: number | null;
  observacao?: string | null;
}

export interface CreateShipmentPayload {
  client_id: string;
  quotation_id?: string | null;
  agente_id?: string | null;
  incoterm?: string | null;
  modal?: ShipmentModal | null;
  tipo_embarque?: TipoEmbarque | null;
  tipo_despacho?: TipoDespacho | null;
  carga_urgente?: boolean;
  observacao?: string | null;
  // Numero do processo na Inova (ex: FRT0585.II) — opcional, nunca bloqueia
  // a criacao. Nasce do lado da Inova; digitado pelo analista se ja souber
  // (ARB-2438). Skip gracioso com alerta enquanto vazio.
  inova_processo_id?: string | null;
}

export interface UpdateShipmentPayload {
  observacao?: string | null;
  inova_processo_id?: string | null;
  datas?: Partial<ShipmentDatas>;
  estado?: EmbarqueEstado;
}

// Response shape of POST /shipments (serialize_processo with embarques[]).
export interface CreateShipmentResponse {
  id: string;
  quotation_id: string | null;
  client_id: string;
  incoterm: string | null;
  modal: ShipmentModal | null;
  tipo_embarque: TipoEmbarque | null;
  tipo_despacho: TipoDespacho | null;
  carga_urgente: boolean;
  agente_id: string | null;
  observacao: string | null;
  inova_processo_id: string | null;
  created_at: string;
  updated_at: string | null;
  embarques: Array<{
    id: string;
    processo_id: string;
    estado: EmbarqueEstado;
    reference: string;
    created_at: string;
    updated_at: string | null;
  }>;
}

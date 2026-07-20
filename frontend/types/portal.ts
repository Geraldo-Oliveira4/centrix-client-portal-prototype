// Types for Client Portal API responses. The portal serializers in the
// backend (shared/portal_helpers.py) return slim payloads — many fields
// from the analyst-side Quotation/QuotationProposal types are intentionally
// absent (analyst_id, confidence_scores, sender_email, etc.).

import type {
  CargaPerigosa,
  CreateQuotationManualPayload,
  CreateQuotationUploadPayload,
  Currency,
  ProposalRouteType,
  QuotationEquipment,
  QuotationModal,
  QuotationState,
  QuotationVolume,
  ServiceType,
  TipoCotacao,
  TipoEmbarque,
  ValidationBlock,
} from './quotation';
import type { FreightAgent } from './freight-agent';

export type PortalBucketKey =
  | 'aguardando_dados'
  | 'aguardando_aprovacao'
  | 'buscando_propostas'
  | 'finalizadas'
  | 'cancelada';

export interface PortalProposalAgent {
  id: string;
  name: string;
}

export interface PortalProposalScore {
  total: number | null;
  cost: number | null;
  transit: number | null;
  validity: number | null;
  frequency: number | null;
}

export interface PortalProposal {
  id: string;
  quotation_id: string;
  agent_id: string;
  agent?: PortalProposalAgent;
  total_value: number;
  total_brl: number;
  freight_value: number;
  taxes_breakdown: Record<string, number>;
  transit_time: number;
  route_type: ProposalRouteType | null;
  route_detail: string | null;
  proposal_origin: string | null;
  proposal_destination: string | null;
  carrier: string | null;
  validity: string | null;
  insurance_included: boolean;
  incoterm: string | null;
  is_winner: boolean;
  received_at: string;
  numero_oferta: string | null;
  ptax_percentual: number | null;
  prazo_pagamento_dias: number | null;
  seguro_percentual: number | null;
  seguro_minimo: number | null;
  frequencia: string | null;
  observations: string | null;
  carga_perigosa: string | null;
  is_recommended: boolean | null;
  additional_costs: PortalAdditionalCost[] | null;
  // Runtime flags computed by the backend serializer per quotation.
  is_cheapest?: boolean;
  is_fastest?: boolean;
  score?: PortalProposalScore | null;
}

export const PORTAL_DECLINE_REASONS = [
  'PRECO',
  'TRANSIT_TIME',
  'SEM_RESPOSTA',
  'NAO_VAI_IMPORTAR',
  'ALTERNATIVA_OUTRO_PRESTADOR',
  'VALIDADE_EXPIRADA',
  'OUTROS',
] as const;

export type PortalDeclineReason = (typeof PORTAL_DECLINE_REASONS)[number];

export const PORTAL_DECLINE_REASON_LABELS: Record<PortalDeclineReason, string> =
  {
    PRECO: 'Preço',
    TRANSIT_TIME: 'Tempo de trânsito',
    SEM_RESPOSTA: 'Sem resposta',
    NAO_VAI_IMPORTAR: 'Não vou prosseguir com esta importação',
    ALTERNATIVA_OUTRO_PRESTADOR: 'Encontrei alternativa com outro prestador',
    VALIDADE_EXPIRADA: 'Prazo de validade expirado',
    OUTROS: 'Outros',
  };

export const DECLINE_REASON_OPTIONS = PORTAL_DECLINE_REASONS.map((value) => ({
  value,
  label: PORTAL_DECLINE_REASON_LABELS[value],
}));

export type PortalCostProbability = 'BAIXA' | 'MEDIA' | 'ALTA';

export interface PortalAdditionalCost {
  label: string;
  amount_min: number | null;
  amount_max: number | null;
  currency: string;
  unit: string | null;
  probability: PortalCostProbability | null;
  note: string | null;
}

export interface PortalQuotationTotals {
  weight_kg: number | null;
  volume_m3: number | null;
  qty: number | null;
}

export interface PortalQuotation {
  id: string;
  reference: string;
  state: QuotationState;
  service_type: ServiceType | null;
  modal: QuotationModal | null;
  tipo_embarque: TipoEmbarque | null;
  tipo_cotacao: TipoCotacao | null;
  data_cotacao: string | null;
  origin: string | null;
  porto_embarque: string | null;
  porto_destino: string[] | null;
  aeroporto_embarque: string | null;
  aeroporto_destino: string[] | null;
  incoterm: string | null;
  product: string | null;
  desired_deadline: string | null;
  data_limite_necessidade: string | null;
  data_prontidao: string | null;
  declared_value: number | null;
  declared_value_currency: Currency | null;
  stackability: boolean | null;
  carga_tombavel: boolean | null;
  insurance_required: boolean | null;
  destination_yard: string | null;
  endereco_entrega_final: string | null;
  observations: string | null;
  carga_perigosa: CargaPerigosa | null;
  un_number: string | null;
  imo_class: string | null;
  temperatura_min: number | null;
  temperatura_max: number | null;
  client_reference: string | null;
  urgency: 'URGENTE' | 'VIP' | 'ALTA' | 'NORMAL' | null;
  decline_reason: string | null;
  decline_note: string | null;
  winning_agent_id: string | null;
  quoted_value_usd: number | null;
  pais_procedencia: string | null;
  peso_taxado: number | null;
  created_at: string;
  updated_at: string | null;
  created_by_me?: boolean;
  // True when the quotation was created by the client via the portal. Gates the
  // self-service features (RFQ dispatch, document upload, history, cancel);
  // analyst-created quotations are view/approve only.
  created_via_portal?: boolean;
  // Guard rail (ARB-2449): when true the client's approval is locked pending
  // Freitas review ("Proposta em revisao pela Freitas"). The analyst
  // justification is never exposed to the portal.
  guard_rail_active?: boolean;
  // The analyst's justification when they blocked the guard rail — shown to the
  // client so they know what Freitas asked for. Only present when blocked.
  guard_rail_block_reason?: string | null;
  proposals_count?: number;
  best_proposal?: PortalProposal;
  equipments?: QuotationEquipment[];
  volumes?: QuotationVolume[];
  proposals?: PortalProposal[];
  totals?: PortalQuotationTotals;
}

export interface PortalQuotationsSummary {
  aprovar_propostas: number;
  aguardando_propostas: number;
}

export interface PortalQuotationsResponse {
  buckets: Record<PortalBucketKey, PortalQuotation[]>;
  bucket_order: PortalBucketKey[];
  total: number;
  summary: PortalQuotationsSummary;
}

export interface PortalQuotationResponse {
  quotation: PortalQuotation;
}

export interface PortalClient {
  id: string;
  name: string;
  email: string;
}

export interface PortalClientResponse {
  client: PortalClient;
}

export interface PortalLoginResponse {
  access_token: string;
  id_token: string;
  refresh_token: string;
}

// Client-facing stage labels. The portal is self-service: the stage backed by
// the internal ENVIADA_CLIENTE state (bucket `aguardando_aprovacao`) reads as a
// client action ("Escolha sua proposta"), never "Enviada ao cliente" (ARB-2452).
export const PORTAL_BUCKET_LABELS: Record<PortalBucketKey, string> = {
  aguardando_dados: 'Aguardando Dados',
  buscando_propostas: 'Aguardando propostas',
  aguardando_aprovacao: 'Escolha sua proposta',
  finalizadas: 'Finalizadas',
  cancelada: 'Canceladas',
};

export type CreatePortalManualPayload = Omit<
  CreateQuotationManualPayload,
  'client_id'
>;
export type CreatePortalUploadPayload = Omit<
  CreateQuotationUploadPayload,
  'client_id' | 'sender_email'
>;
export type CreatePortalQuotationPayload =
  | CreatePortalManualPayload
  | CreatePortalUploadPayload;

// RFQ assembly + dispatch from the portal (ARB-2450 / ARB-2452). The client
// only picks from the pre-set agents Freitas curated — there is no "add new".
export interface PortalQuotationAgentsResponse {
  agents: FreightAgent[];
  rfq_dispatched: boolean;
  selected_agent_ids: string[];
}

export interface SavePortalRfqPayload {
  agents_targeted: string[];
  particularities?: string | null;
  desired_deadline?: string | null;
  include_insurance?: boolean;
  // Collection point completed inline from the RFQ form when left blank at
  // creation, so the client can clear the "origin required" hard block.
  origin?: string | null;
  agente_define_local_coleta?: boolean;
}

export interface PortalRfqSaveResult {
  hard_blocks: ValidationBlock[];
  soft_warnings: ValidationBlock[];
}

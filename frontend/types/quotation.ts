import type { ClientDna, PriceOrPerformance, QuotationClient } from './client';

export type QuotationState =
  | 'TRIAGEM_IA'
  | 'AGUARDANDO_DADOS'
  | 'COTANDO'
  | 'PARA_ANALISE'
  | 'REVISAO_AGENTE'
  | 'ENVIADA_CLIENTE'
  | 'APROVADA_PELO_CLIENTE'
  | 'FECHADA'
  | 'DECLINADA'
  | 'CANCELADO';

export type QuotationModal = 'AEREO' | 'MARITIMO' | 'RODOVIARIO';

export const STATE_LABELS: Record<QuotationState, string> = {
  TRIAGEM_IA: 'Triagem IA',
  AGUARDANDO_DADOS: 'Aguardando Dados',
  COTANDO: 'Cotando',
  PARA_ANALISE: 'Para Analise',
  REVISAO_AGENTE: 'Revisao Agente',
  ENVIADA_CLIENTE: 'Enviada ao Cliente',
  APROVADA_PELO_CLIENTE: 'Aprovada pelo Cliente',
  FECHADA: 'Fechada',
  DECLINADA: 'Declinada',
  CANCELADO: 'Cancelado',
};

// Contextual action labels for state transitions, keyed by [currentState][targetState]
// (e.g. TRANSITION_ACTION_LABELS.FECHADA.COTANDO === 'Reabrir p/ Cotando'). This is the
// single source of truth for how a transition is *worded* as an action, shared by the
// Kanban 3-dot card menu (app/cotacao/kanban/components/card-context-menu.tsx) and the
// quotation detail "Mover Estado" dropdown (app/cotacao/[id]/components/quotation-transition-button.tsx).
// Do not duplicate these strings in either component — add new transitions here instead.
//
// This map is deliberately a labeling layer only: it does NOT decide which transitions are
// allowed. The detail page's dropdown sources the allowed target list live from
// GET /quotations/{id}/allowed-transitions (backend ALLOWED_TRANSITIONS in
// shared/domain/quotation_state_machine.py is the sole authority on what is reachable); the
// Kanban menu keeps its own curated subset (see AVAILABLE_TARGETS_BY_STATE in
// card-context-menu.tsx) that must stay in sync with the backend graph by hand. Any target
// state missing from this map falls back to the generic STATE_LABELS[target] entry, so an
// unlabeled transition degrades gracefully instead of crashing.
export const TRANSITION_ACTION_LABELS: Partial<Record<QuotationState, Partial<Record<QuotationState, string>>>> = {
  TRIAGEM_IA: {
    AGUARDANDO_DADOS: 'Enviar p/ Aguardando Dados',
    CANCELADO: 'Cancelar Cotacao',
  },
  AGUARDANDO_DADOS: {
    TRIAGEM_IA: 'Voltar p/ Triagem',
    CANCELADO: 'Cancelar Cotacao',
  },
  COTANDO: {
    PARA_ANALISE: 'Enviar p/ Analise',
    CANCELADO: 'Cancelar Cotacao',
  },
  PARA_ANALISE: {
    REVISAO_AGENTE: 'Solicitar Revisao Agente',
    ENVIADA_CLIENTE: 'Enviar ao Cliente',
    FECHADA: 'Fechar Cotacao',
    CANCELADO: 'Cancelar Cotacao',
  },
  REVISAO_AGENTE: {
    PARA_ANALISE: 'Retornar p/ Analise',
    ENVIADA_CLIENTE: 'Enviar ao Cliente',
    FECHADA: 'Fechar Cotacao',
    CANCELADO: 'Cancelar Cotacao',
  },
  ENVIADA_CLIENTE: {
    APROVADA_PELO_CLIENTE: 'Registrar Aprovacao do Cliente',
    FECHADA: 'Fechar Cotacao',
    DECLINADA: 'Declinar',
    CANCELADO: 'Cancelar Cotacao',
  },
  APROVADA_PELO_CLIENTE: {
    // Guard-rail block sends the client's selection back for a fresh pick (ARB-2449).
    ENVIADA_CLIENTE: 'Devolver ao Cliente',
    FECHADA: 'Fechar Cotacao',
    CANCELADO: 'Cancelar Cotacao',
  },
  FECHADA: {
    COTANDO: 'Reabrir p/ Cotando',
    DECLINADA: 'Declinar',
  },
};

// Target states that need QuotationTransitionModal's confirmation UI (proposal
// select, decline reason, or reopen warning) rather than firing immediately.
// Shared by the Kanban card menu (kanban-board.tsx) and the quotation detail
// "Mover Estado" dropdown (quotation-transition-button.tsx) — single list so
// the two callers can never drift on which transitions need a confirmation step.
// COTANDO is here because reopening a FECHADA quotation clears the winning
// agent/value and cancels any SI server-side (quotation_state_machine.py); it
// isn't a routine, reversible move like most other transitions.
export const STATES_REQUIRING_MODAL: QuotationState[] = [
  'FECHADA',
  'DECLINADA',
  'APROVADA_PELO_CLIENTE',
  'COTANDO',
];

export const MODAL_LABELS: Record<string, string> = {
  AEREO: 'Aéreo',
  MARITIMO: 'Marítimo',
  RODOVIARIO: 'Rodoviário',
};

// Label + icon per transport modal — shared by the cotacao and embarques kanban cards.
export const MODAL_DISPLAY: Record<string, { label: string; icon: 'ship' | 'plane' | 'truck' }> = {
  MARITIMO: { label: 'Marítimo', icon: 'ship' },
  AEREO: { label: 'Aéreo', icon: 'plane' },
  RODOVIARIO: { label: 'Rodoviário', icon: 'truck' },
};

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  IMPORTACAO: 'Importação',
  EXPORTACAO: 'Exportação',
};

export type TipoEmbarque = 'FCL' | 'LCL' | 'BREAK_BULK';

// Covers both tipo_embarque values and the AEREO modal, which has no tipo_embarque.
export const TIPO_EMBARQUE_LABELS: Record<string, string> = {
  FCL: 'FCL',
  LCL: 'LCL',
  BREAK_BULK: 'Break Bulk',
  AEREO: 'Aéreo',
};

export type ServiceType = 'IMPORTACAO' | 'EXPORTACAO';

export type TipoCotacao = 'REAL' | 'ESTIMATIVA';

export type CargaPerigosa = 'NAO' | 'RA' | 'IMO';

export type ProposalRouteType = 'DIRETA' | 'TRANSBORDO';

export const PROPOSAL_ROUTE_TYPE_LABELS: Record<ProposalRouteType, string> = {
  DIRETA: 'Direta',
  TRANSBORDO: 'Transbordo',
};

export type Currency = 'BRL' | 'USD' | 'EUR' | 'GBP' | 'CNY' | 'ARS' | 'CLP' | 'MXN' | 'CHF';

export type PesoUnidade = 'KG' | 'LB';

export type DimensaoUnidade = 'CM' | 'M' | 'MM' | 'POL';

export type TipoContainer =
  | 'STANDARD_20' | 'STANDARD_40' | 'HIGH_CUBE_40' | 'NOR_40'
  | 'HARDTOP_20' | 'HARDTOP_40' | 'HARDTOP_HIGH_CUBE_40'
  | 'OPEN_TOP_20' | 'OPEN_TOP_40' | 'OPEN_TOP_HIGH_CUBE_40'
  | 'FLATRACK_20' | 'FLATRACK_40' | 'PLATFORM_20' | 'PLATFORM_40'
  | 'REFRIGERATED_20' | 'REFRIGERATED_40' | 'BULK_20' | 'TANK_20';

export type TipoEmbalagem =
  | 'BARRICA_FIBRA_VIDRO' | 'BARRICA_METAL' | 'BARRICA_OUTROS' | 'BARRICA_PAPELAO' | 'BARRICA_PLASTICO'
  | 'BAU_MADEIRA' | 'BAU_METAL' | 'BAU_OUTROS'
  | 'BIG_BAG' | 'BLOCO' | 'BOBINA' | 'BOMBONA' | 'BOTIJAO'
  | 'CAIXA' | 'CAIXA_ISOPOR' | 'CAIXA_MADEIRA' | 'CAIXA_METAL' | 'CAIXA_OUTROS'
  | 'CAIXA_PAPELAO' | 'CAIXA_PAPELAO_CORRUGADO' | 'CAIXA_PLASTICO'
  | 'CARGA_SOLTA' | 'CARRETEL' | 'CILINDRO' | 'CINTADO'
  | 'ENGRADADO_MADEIRA' | 'ENGRADADO_OUTROS' | 'ENGRADADO_PLASTICO'
  | 'ENVELOPE' | 'ESTOJO' | 'ESTRADO' | 'FARDO' | 'FRASCO'
  | 'GALAO_METAL' | 'GALAO_OUTROS' | 'GALAO_PLASTICO'
  | 'GRANEL' | 'LATA' | 'MALA' | 'MALETA' | 'MODAL_OCTABIN' | 'OUTRO'
  | 'PACOTE' | 'PALLET' | 'PECA' | 'ROLO'
  | 'SACA' | 'SACA_ANIAGEM' | 'SACA_COURO' | 'SACA_LONA'
  | 'SACO_NYLON' | 'SACO_OUTROS' | 'SACO_PAPEL' | 'SACO_PAPELAO' | 'SACO_PLASTICO'
  | 'SACOLA' | 'SAND_BAG'
  | 'TAMBOR_METAL' | 'TAMBOR_OUTROS' | 'TAMBOR_PAPELAO' | 'TAMBOR_PLASTICO'
  | 'TUBO';


export interface QuotationEquipment {
  id: string;
  quotation_id: string;
  quantity: number;
  tipo_container: TipoContainer;
  volume_m3: number | null;
  peso_bruto: number | null;
  peso_unidade: PesoUnidade;
  created_at: string;
}

export interface QuotationVolume {
  id: string;
  quotation_id: string;
  quantity: number;
  embalagem: TipoEmbalagem | null;
  peso_bruto: number | null;
  peso_unidade: PesoUnidade;
  comprimento: number | null;
  largura: number | null;
  altura: number | null;
  dimensao_unidade: DimensaoUnidade;
  volume_m3: number | null;
  inspecao_iof: boolean | null;
  created_at: string;
}

export interface ContainerSpec {
  tipo_container: TipoContainer;
  comprimento_interno_mm: number | null;
  largura_interna_mm: number | null;
  altura_interna_mm: number | null;
  capacidade_m3: number | null;
  carga_maxima_kg: number | null;
  tara_kg: number | null;
  peso_max_total_kg: number | null;
  updated_at: string | null;
}

export const TIPO_CONTAINER_LABELS: Record<TipoContainer, string> = {
  STANDARD_20: "20' Standard",
  STANDARD_40: "40' Standard",
  HIGH_CUBE_40: "40' High Cube",
  NOR_40: "40' NOR",
  HARDTOP_20: "20' Hardtop",
  HARDTOP_40: "40' Hardtop",
  HARDTOP_HIGH_CUBE_40: "40' Hardtop High Cube",
  OPEN_TOP_20: "20' Open Top",
  OPEN_TOP_40: "40' Open Top",
  OPEN_TOP_HIGH_CUBE_40: "40' Open Top High Cube",
  FLATRACK_20: "20' Flat Rack",
  FLATRACK_40: "40' Flat Rack",
  PLATFORM_20: "20' Platform (Flatbed)",
  PLATFORM_40: "40' Platform (Flatbed)",
  REFRIGERATED_20: "20' Refrigerated",
  REFRIGERATED_40: "40' Refrigerated",
  BULK_20: "20' Bulk",
  TANK_20: "20' Tank",
};

export const TIPO_EMBALAGEM_LABELS: Record<TipoEmbalagem, string> = {
  BARRICA_FIBRA_VIDRO: "Barrica de Fibra de Vidro",
  BARRICA_METAL: "Barrica de Metal",
  BARRICA_OUTROS: "Barrica de Outros Materiais",
  BARRICA_PAPELAO: "Barrica de Papelão",
  BARRICA_PLASTICO: "Barrica de Plástico",
  BAU_MADEIRA: "Baú de Madeira",
  BAU_METAL: "Baú de Metal",
  BAU_OUTROS: "Baú de Outros Materiais",
  BIG_BAG: "Big Bag",
  BLOCO: "Bloco",
  BOBINA: "Bobina",
  BOMBONA: "Bombona",
  BOTIJAO: "Botijão",
  CAIXA: "Caixa",
  CAIXA_ISOPOR: "Caixa de Isopor",
  CAIXA_MADEIRA: "Caixa de Madeira",
  CAIXA_METAL: "Caixa de Metal",
  CAIXA_OUTROS: "Caixa de Outros Materiais",
  CAIXA_PAPELAO: "Caixa de Papelão",
  CAIXA_PAPELAO_CORRUGADO: "Caixa de Papelão Corrugado",
  CAIXA_PLASTICO: "Caixa de Plástico",
  CARGA_SOLTA: "Carga Solta",
  CARRETEL: "Carretel",
  CILINDRO: "Cilindro",
  CINTADO: "Cintado",
  ENGRADADO_MADEIRA: "Engradado de Madeira",
  ENGRADADO_OUTROS: "Engradado de Outros Materiais",
  ENGRADADO_PLASTICO: "Engradado de Plástico",
  ENVELOPE: "Envelope",
  ESTOJO: "Estojo",
  ESTRADO: "Estrado",
  FARDO: "Fardo",
  FRASCO: "Frasco",
  GALAO_METAL: "Galão de Metal",
  GALAO_OUTROS: "Galão de Outros Materiais",
  GALAO_PLASTICO: "Galão de Plástico",
  GRANEL: "Granel",
  LATA: "Lata",
  MALA: "Mala",
  MALETA: "Maleta",
  MODAL_OCTABIN: "Modal Octabin",
  OUTRO: "Outro",
  PACOTE: "Pacote",
  PALLET: "Pallet",
  PECA: "Peça",
  ROLO: "Rolo",
  SACA: "Saca",
  SACA_ANIAGEM: "Saca de Aniagem",
  SACA_COURO: "Saca de Couro",
  SACA_LONA: "Saca de Lona",
  SACO_NYLON: "Saco de Nylon",
  SACO_OUTROS: "Saco de Outros Materiais",
  SACO_PAPEL: "Saco de Papel",
  SACO_PAPELAO: "Saco de Papelão",
  SACO_PLASTICO: "Saco de Plástico",
  SACOLA: "Sacola",
  SAND_BAG: "Sand Bag",
  TAMBOR_METAL: "Tambor de Metal",
  TAMBOR_OUTROS: "Tambor de Outros Materiais",
  TAMBOR_PAPELAO: "Tambor de Papelão",
  TAMBOR_PLASTICO: "Tambor de Plástico",
  TUBO: "Tubo",
};

export interface Quotation {
  id: string;
  reference: string;
  state: QuotationState;
  priority_score: number | null;
  completeness_score: number | null;
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
  incluir_entrega_destino_final: boolean | null;
  incoterm: string | null;

  product: string | null;
  desired_deadline: string | null;
  data_prontidao: string | null;
  data_limite_necessidade: string | null;
  declared_value: number | null;
  declared_value_currency: Currency | null;
  stackability: boolean | null;
  carga_tombavel: boolean | null;
  insurance_required: boolean | null;
  destination_yard: string | null;
  endereco_entrega_final: string | null;
  necessidade_descarga: boolean | null;
  ncm: string | null;
  exportador: string | null;
  pais_procedencia: string | null;
  peso_taxado: number | null;
  observations: string | null;
  carga_perigosa: CargaPerigosa | null;
  un_number: string | null;
  imo_class: string | null;
  temperatura_min: number | null;
  temperatura_max: number | null;
  client_reference: string | null;
  agente_define_porto_embarque: boolean | null;
  agente_define_porto_destino: boolean | null;
  agente_define_aeroporto_embarque: boolean | null;
  agente_define_aeroporto_destino: boolean | null;
  agente_define_local_coleta: boolean | null;
  ptax_negociada: string | null;
  price_or_performance: PriceOrPerformance | null;
  urgency: 'URGENTE' | 'VIP' | 'ALTA' | 'NORMAL' | null;
  analyst_id: string | null;
  analyst_name: string | null;
  client_id: string | null;
  // Link to the structured Exporter record (ARB-2443) — distinct from the
  // free-text `exportador` field below, which is AI-extracted from documents.
  exporter_id: string | null;
  sender_email: string | null;
  client_match_status: 'matched' | 'not_found' | 'multiple_found' | 'agent_matched' | null;
  client_match_candidates:
    | Array<{ id: string; name: string; email: string }>
    | Array<{ freight_agent_id: string; contact_email: string; contact_name: string }>
    | null;
  confidence_scores: Record<string, number> | null;
  extraction_status: string | null;
  extraction_model: string | null;
  extracted_at: string | null;
  original_email_s3_key: string | null;
  attachments_s3_keys: Record<string, string>;
  created_at: string;
  updated_at: string | null;
  // Durable state-transition timestamps, stamped by the backend state machine on
  // entry into the matching state (most recent wins). Null when never reached.
  sent_at: string | null;
  closed_at: string | null;
  declined_at: string | null;
  client?: QuotationClient;
  client_dna?: ClientDna;
  equipments?: QuotationEquipment[];
  volumes?: QuotationVolume[];
  decline_reason: string | null;
  winning_agent_id: string | null;
  quoted_value_usd: number | null;
  originated_from_id: string | null;
  recotacao_motivo: string | null;
  // Guard rail (ARB-2449) — portal-flow safety net. Present on the kanban card
  // and on the detail payload (GET /quotations/{id}) so the analyst workspace can
  // gate the winner notification while a portal selection is still under review.
  guard_rail_active?: boolean;
  guard_rail_reasons?: GuardRailReason[];
  guard_rail_decision?: GuardRailDecision | null;
  guard_rail_block_reason?: string | null;
  guard_rail_reviewed_by?: string | null;
  guard_rail_reviewed_at?: string | null;
}

export interface CreateQuotationUploadPayload {
  source: 'upload';
  client_id?: string;
  sender_email?: string;
  modal?: QuotationModal;
  files?: string[];
};

export interface CreateEquipmentItem {
  quantity: number;
  tipo_container: TipoContainer;
  volume_m3?: number;
  peso_bruto?: number;
  peso_unidade?: PesoUnidade;
}

export interface CreateVolumeItem {
  quantity: number;
  embalagem?: TipoEmbalagem;
  peso_bruto?: number;
  peso_unidade?: PesoUnidade;
  comprimento?: number;
  largura?: number;
  altura?: number;
  dimensao_unidade?: DimensaoUnidade;
  volume_m3?: number;
  inspecao_iof?: boolean;
}

export interface CreateQuotationManualPayload {
  source: 'manual';
  client_id?: string;
  exporter_id?: string;
  service_type?: ServiceType;
  modal?: QuotationModal;
  tipo_embarque?: TipoEmbarque;
  tipo_cotacao?: TipoCotacao;
  data_cotacao?: string;
  origin?: string;
  porto_embarque?: string;
  porto_destino?: string[];
  aeroporto_embarque?: string;
  aeroporto_destino?: string[];
  incluir_entrega_destino_final?: boolean;
  incoterm?: string;
  product?: string;
  desired_deadline?: string;
  data_prontidao?: string;
  data_limite_necessidade?: string;
  declared_value?: number;
  declared_value_currency?: Currency;
  stackability?: boolean;
  carga_tombavel?: boolean;
  insurance_required?: boolean;
  destination_yard?: string;
  endereco_entrega_final?: string;
  necessidade_descarga?: boolean;
  ncm?: string;
  observations?: string;
  carga_perigosa?: CargaPerigosa;
  un_number?: string;
  imo_class?: string;
  temperatura_min?: number;
  temperatura_max?: number;
  client_reference?: string;
  agente_define_porto_embarque?: boolean;
  agente_define_porto_destino?: boolean;
  agente_define_aeroporto_embarque?: boolean;
  agente_define_aeroporto_destino?: boolean;
  agente_define_local_coleta?: boolean;
  ptax_negociada?: string;
  price_or_performance?: PriceOrPerformance;
  equipments?: CreateEquipmentItem[];
  volumes?: CreateVolumeItem[];
  files?: string[];
};

export type CreateQuotationPayload =
  | CreateQuotationUploadPayload
  | CreateQuotationManualPayload;

export interface FileUploadInfo {
  filename: string;
  upload_url: string;
  s3_key: string;
}

export interface CreateQuotationResponse {
  quotation: Quotation;
  upload_urls?: FileUploadInfo[];
}

// Fields tracked for completeness score (matches backend _COMPLETENESS_FIELDS)
// These fields must be filled before the quotation can move to COTANDO state
export const COMPLETENESS_FIELDS = [
  'client_id',
  'origin',
  'incoterm',
  'insurance_required',
  'product',
  'stackability',
  'declared_value',
  // Additional fields for better UX (not strictly required for COTANDO)
  'service_type',
  'modal',
  'desired_deadline',
] as const;

export type CompletenessField = (typeof COMPLETENESS_FIELDS)[number];

export const COMPLETENESS_FIELD_LABELS: Record<CompletenessField, string> = {
  client_id: 'Cliente',
  origin: 'Local de coleta',
  incoterm: 'Incoterm',
  insurance_required: 'Seguro Obrigatório',
  product: 'Produto / Mercadoria',
  stackability: 'Empilhável',
  declared_value: 'Valor Declarado',
  service_type: 'Tipo de Serviço',
  modal: 'Modal',
  desired_deadline: 'Deadline envio cotacao',
};

// Audit types

export type AuditCategory =
  | 'SEGURO'
  | 'ROTA_DESTINO'
  | 'COTACAO_INCOMPLETA'
  | 'PARTICULARIDADES_IGNORADAS'
  | 'DNA_COMPLIANCE';

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AuditFlag {
  id: string;
  proposal_id: string;
  rule_category: AuditCategory;
  rule_name: string;
  severity: Severity;
  description: string;
  resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  justification: string | null;
  created_at: string;
}

// Proposal

export interface TaxesBreakdown {
  [component: string]: number;
}

export type ValidadeStatus = 'ok' | 'em_risco' | 'expirada';

export interface QuotationProposal {
  id: string;
  quotation_id: string;
  agent_id: string;
  total_value: number;
  // BRL-normalized total computed by the backend (list_proposals) using a single
  // reference PTAX across the quotation. Null when no proposal submitted a PTAX.
  total_brl: number | null;
  // The reference USD/BRL PTAX used to compute total_brl. Shared across all
  // proposals in the quotation so the BRL comparison is apples-to-apples.
  ptax_usado: number | null;
  freight_value: number;
  freight_currency: string | null;
  taxes_breakdown: TaxesBreakdown;
  taxes_currency_breakdown: Record<string, string> | null;
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
  original_email_s3_key: string | null;
  attachments_s3_keys: Record<string, string>;
  extraction_status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | null;
  extraction_model: string | null;
  extracted_at: string | null;
  confidence_scores: Record<string, number | null> | null;
  agent?: { id: string; name: string };
  audit_flags?: AuditFlag[];
  audit_flags_summary?: AuditFlagsSummary;
  review_status: 'PENDING' | 'RESOLVED' | 'DISMISSED' | null;
  review_reason: string | null;
  numero_oferta: string | null;
  ptax_percentual: number | null;
  prazo_pagamento_dias: number | null;
  seguro_percentual: number | null;
  seguro_minimo: number | null;
  frequencia: string | null;
  free_time_dias: number | null;
  observations: string | null;
  carga_perigosa: CargaPerigosa | null;
  version: number;
  is_latest: boolean;
  has_previous_versions: boolean;
  parent_proposal_id: string | null;
  version_diff: Record<string, { before: unknown; after: unknown }> | null;
  containers_priced: number | null;
  offered_container_type: TipoContainer | null;
  validade_status: ValidadeStatus;
  score: number | null;
  is_recommended: boolean;
}

// Notify winner (POST /quotations/{id}/proposals/{proposal_id}/notify-winner)
export interface NotifyWinnerResponse {
  notified: Array<{
    agent_id: string;
    agent_name: string;
    status: 'sent' | 'failed';
    to_emails?: string[];
    cc_emails?: string[];
    dropped_cc?: string[];
    quotation_state?: QuotationState;
    sent_at?: string;
    error?: string;
  }>;
}

export interface NotifyWinnerPayload {
  message_body?: string;
  cc_emails?: string[];
  attach_proposal_pdf?: boolean;
}

export interface AuditFlagsSummary {
  total: number;
  critical: number;
  high: number;
  resolved: number;
}

// Create / upload proposal

export interface CreateProposalPayload {
  agent_id: string;
  total_value: number;
  freight_value: number;
  freight_currency?: string;
  taxes_breakdown: TaxesBreakdown;
  taxes_currency_breakdown?: Record<string, string>;
  transit_time: number;
  validity?: string;
  insurance_included?: boolean;
  route_type?: ProposalRouteType;
  route_detail?: string;
  carrier?: string;
  incoterm?: string;
  // When true, signals that the proposal is a placeholder created by the upload
  // flow. The backend skips audit and state transitions until AI extraction
  // completes and real field values are available.
  extraction_pending?: boolean;
  numero_oferta?: string;
  ptax_percentual?: number;
  prazo_pagamento_dias?: number;
  seguro_percentual?: number;
  seguro_minimo?: number;
  frequencia?: string;
  free_time_dias?: number;
  observations?: string;
  carga_perigosa?: CargaPerigosa;
  containers_priced?: number;
  offered_container_type?: TipoContainer;
}

export interface CreateProposalResponse {
  proposal: QuotationProposal;
  audit_flags: AuditFlag[];
  quotation_state: QuotationState;
  warnings?: string[];
}

export interface SubmitPortalProposalResponse {
  proposal: ExistingPortalProposal;
  audit_flags: AuditFlag[];
  quotation_state: QuotationState;
  warnings: string[];
}

export interface UploadProposalAttachmentResponse {
  upload_url: string;
  s3_key: string;
  expires_in: number;
}

export interface ProposalAttachment {
  filename: string;
  s3_key: string;
  download_url: string;
}

export interface ProposalAttachmentsResponse {
  items: ProposalAttachment[];
  original_email?: { s3_key: string; download_url: string } | null;
}

// RFQ

export interface RFQAgentToken {
  id: string;
  agent_id: string;
  revoked_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
}

export interface RFQ {
  id: string;
  quotation_id: string;
  agents_targeted: string[];
  template_data: Record<string, unknown>;
  include_insurance: boolean;
  destination_yard: string | null;
  particularities: string | null;
  dispatched_at: string | null;
  created_at: string;
}

export interface ValidationBlock {
  field: string;
  label: string;
  reason: string;
}

export interface RFQValidationResult {
  hard_blocks: ValidationBlock[];
  soft_warnings: ValidationBlock[];
}

export interface CreateRFQPayload {
  agents_targeted: string[];
  destination_yard?: string;
  particularities?: string;
  imo_class?: string;
  template_data?: Record<string, unknown>;
}

// Attachment (presigned download)

export interface QuotationAttachment {
  filename: string;
  s3_key: string;
  download_url: string;
  preview_url: string | null;
}

// Original email content

export interface OriginalEmail {
  subject: string;
  sender: string;
  to: string;
  cc: string;
  date: string;
  body: string;
}

// Client portal link (ARB-2051)

export interface QuotationClientLink {
  id: string;
  token: string;
  url: string;
  observations: string | null;
  expires_at: string;
  sent_at: string | null;
  created_at: string;
  is_expired: boolean;
}

export interface GenerateClientLinkPayload {
  observations?: string;
}

export interface GenerateClientLinkResponse extends QuotationClientLink {}

export interface SendClientLinkPayload {
  token: string;
}

export interface SendClientLinkResponse {
  sent: boolean;
  recipient: string;
}

// Client portal view data (public, no auth)

export interface ClientPortalProposal {
  agent_name: string;
  proposal_id: string;
  total_value: number;
  total_brl: number | null;
  freight_value: number;
  freight_currency: string | null;
  taxes_breakdown: Record<string, number>;
  taxes_currency_breakdown: Record<string, string>;
  transit_time: number;
  carrier: string | null;
  validity: string | null;
  incoterm: string | null;
  insurance_included: boolean;
  observations: string | null;
  is_winner: boolean;
  pdf_urls: Record<string, string>;
  score: number | null;
  cost_score: number | null;
  transit_score: number | null;
  is_recommended: boolean;
  is_lowest_cost: boolean;
  is_lowest_transit: boolean;
  validade_status: ValidadeStatus;
  frequency_score: number | null;
  proposal_origin: string | null;
  proposal_destination: string | null;
  route_type: ProposalRouteType | null;
  route_detail: string | null;
  frequencia: string | null;
  free_time_dias: number | null;
  updated_after_sent: boolean;
  offered_container_type: TipoContainer | null;
}

export interface ProposalScore {
  proposal_id: string;
  agent_name: string;
  is_eligible: boolean;
  ineligibility_reason: string | null;
  cost_score: number | null;
  transit_score: number | null;
  frequency_score: number | null;
  route_score: number | null;
  free_time_score: number | null;
  validity_score: number | null;
  total_score: number | null;
  validade_status: ValidadeStatus;
  posicao_ranking: number | null;
  motivo: string | null;
  is_recommended: boolean;
  is_lowest_cost: boolean;
  is_lowest_transit: boolean;
}

export interface RecommendationOverride {
  id: string;
  proposal_id: string | null;
  agent_name: string;
  justification: string;
  overridden_by: string;
  created_at: string;
}

export interface RecommendationResult {
  recommended_proposal_id: string | null;
  recommendation_text: string | null;
  is_overridden: boolean;
  override: RecommendationOverride | null;
  scores: ProposalScore[];
}

export interface ClientPortalData {
  quotation: {
    reference: string;
    client_reference: string | null;
    modal: string | null;
    tipo_embarque: string | null;
    service_type: string | null;
    origin: string | null;
    destination: string | null;
    incoterm: string | null;
    product: string | null;
    exportador: string | null;
    pais_procedencia: string | null;
    data_cotacao: string | null;
    carga_perigosa: string | null;
    equipments: QuotationEquipment[];
    volumes: QuotationVolume[];
    document_urls: Record<string, string>;
  };
  client: { name: string; company_code: string | null } | null;
  proposals: ClientPortalProposal[];
  observations: string | null;
  recommendation: RecommendationResult | null;
  expires_at: string;
}

// Update payload

export interface UpdateQuotationPayload {
  service_type?: ServiceType;
  modal?: QuotationModal;
  tipo_embarque?: TipoEmbarque;
  tipo_cotacao?: TipoCotacao;
  data_cotacao?: string;
  origin?: string | null;
  porto_embarque?: string;
  porto_destino?: string[];
  aeroporto_embarque?: string;
  aeroporto_destino?: string[];
  incluir_entrega_destino_final?: boolean;
  incoterm?: string | null;
  product?: string | null;
  desired_deadline?: string;
  data_prontidao?: string;
  data_limite_necessidade?: string;
  declared_value?: number;
  declared_value_currency?: Currency;
  stackability?: boolean;
  carga_tombavel?: boolean;
  insurance_required?: boolean;
  destination_yard?: string | null;
  endereco_entrega_final?: string | null;
  necessidade_descarga?: boolean;
  ncm?: string | null;
  exportador?: string | null;
  pais_procedencia?: string | null;
  peso_taxado?: number;
  observations?: string | null;
  carga_perigosa?: CargaPerigosa;
  un_number?: string;
  imo_class?: string;
  temperatura_min?: number;
  temperatura_max?: number;
  client_reference?: string;
  agente_define_porto_embarque?: boolean;
  agente_define_porto_destino?: boolean;
  agente_define_aeroporto_embarque?: boolean;
  agente_define_aeroporto_destino?: boolean;
  agente_define_local_coleta?: boolean;
  ptax_negociada?: string | null;
  price_or_performance?: PriceOrPerformance | null;
  urgency?: 'URGENTE' | 'VIP' | 'ALTA' | 'NORMAL' | null;
  client_id?: string | null;
  exporter_id?: string | null;
  equipments?: CreateEquipmentItem[];
  volumes?: CreateVolumeItem[];
}

// Quotation log (immutable audit trail)

export interface QuotationLog {
  id: string;
  quotation_id: string;
  action: string;
  previous_state: QuotationState | null;
  new_state: QuotationState;
  user_id: string;
  details: Record<string, unknown>;
  created_at: string;
}

// Transit time reference table

export type TransitModal = 'MARITIMO' | 'AEREO';

export interface TransitTimeReference {
  id: string;
  modal: TransitModal;
  origin_country: string;
  avg_days: number;
  sample_size: number;
  tolerance_pct: number;
  updated_at: string;
}

// Filters for quotation list

export interface QuotationFilters {
  state?: QuotationState;
  client_id?: string;
  analyst_id?: string;
  priority_min?: number;
  search?: string;
  date_from?: string;
  date_to?: string;
}

// Kanban board types

export type GuardRailDecision = 'RELEASED' | 'BLOCKED';

export interface GuardRailReason {
  type: 'validation_period' | 'high_value';
  value?: number;
  threshold?: number;
}

export interface KanbanCard extends Quotation {
  has_agent_review?: boolean;
  ready_to_send?: boolean;
  proposal_count?: number;
  portal_approved?: boolean;
  rfq_agent_ids?: string[];
  created_by_portal?: boolean;
  // Aberta pelo CTA "Cotar agora" do Radar de Preços do portal, e por qual rota.
  //
  // Dimensão ADICIONAL a `created_by_portal`, não substituta: uma cotação de
  // Radar é as duas coisas, e o card mostra as duas marcas. A origem é fato do
  // nascimento da cotação e mora no log imutável — do lado do backend do
  // Centrix, o serializer do card resolve esta flag com a mesma consulta que
  // resolve `created_by_portal`, trocando a ação por `quotation_portal_origin`
  // (a consulta pronta está em `backend/app/quotation_origin.py::fetch_origins`).
  created_from_radar?: boolean;
  portal_origin_route?: string;
  // Guard-rail fields (ARB-2449) are declared on the base Quotation interface —
  // both the kanban card and the detail payload carry them.
}

export interface KanbanColumn {
  count: number;
  items: KanbanCard[];
}

export type KanbanColumnKey =
  | Exclude<QuotationState, 'REVISAO_AGENTE' | 'TRIAGEM_IA' | 'AGUARDANDO_DADOS'>
  | 'PARA_COTAR';

export type QuotationKanban = Record<KanbanColumnKey, KanbanColumn>;

// Transition types

export interface AllowedTransitions {
  current_state: QuotationState;
  transitions: Record<string, { allowed: boolean; blocked_by: string[] }>;
  ready_to_send: boolean;
}

export interface TransitionPayload {
  target_state: QuotationState;
  decline_reason?: string;
  winning_agent_id?: string;
  quoted_value_usd?: number;
}

// Existing proposal returned by GET /public/rfq/form — used to pre-fill revision cards.
export interface ExistingPortalProposal {
  id: string;
  version: number;
  numero_oferta: string | null;
  total_value: number | null;
  freight_value: number | null;
  freight_currency: string | null;
  transit_time: number | null;
  carrier: string | null;
  validity: string | null;
  incoterm: string | null;
  route_type: ProposalRouteType | null;
  route_detail: string | null;
  insurance_included: boolean;
  observations: string | null;
  ptax_percentual: number | null;
  prazo_pagamento_dias: number | null;
  seguro_percentual: number | null;
  seguro_minimo: number | null;
  frequencia: string | null;
  free_time_dias: number | null;
  taxes_breakdown: Record<string, number>;
  taxes_currency_breakdown: Record<string, string> | null;
  carga_perigosa: string | null;
  containers_priced: number | null;
  offered_container_type: TipoContainer | null;
}

// Fields returned by POST /public/rfq/extract-pdf — used to pre-fill the agent portal form.
// All fields are nullable since extraction may not find every value.
export interface PortalProposalExtractedFields {
  total_value: number | null;
  freight_value: number | null;
  freight_currency: string | null;
  transit_time: number | null;
  carrier: string | null;
  incoterm: string | null;
  route_type: ProposalRouteType | null;
  route_detail: string | null;
  insurance_included: boolean | null;
  taxes_breakdown: Record<string, number> | null;
  taxes_currency_breakdown: Record<string, string> | null;
  validity: string | null;
  numero_oferta: string | null;
  frequencia: string | null;
  free_time_dias: number | null;
  prazo_pagamento_dias: number | null;
  observations: string | null;
}

export interface PortalProposalExtractionResult {
  extracted_fields: PortalProposalExtractedFields;
  confidence_scores: Record<string, number | null>;
  model: string;
}

// Local editable state for the extraction results grid
export interface DuplicateQuotationPayload {
  modal?: QuotationModal;
}

export interface QuotationFieldValues {
  client_id: string;
  service_type: ServiceType | '';
  modal: QuotationModal | '';
  tipo_embarque: TipoEmbarque | '';
  tipo_cotacao: TipoCotacao | '';
  data_cotacao: string;
  origin: string;
  porto_embarque: string;
  porto_destino: string[];
  aeroporto_embarque: string;
  aeroporto_destino: string[];
  incluir_entrega_destino_final: '' | 'true' | 'false';
  incoterm: string;
  product: string;
  desired_deadline: string;
  data_prontidao: string;
  data_limite_necessidade: string;
  declared_value: string;
  declared_value_currency: Currency | '';
  stackability: '' | 'true' | 'false';
  carga_tombavel: '' | 'true' | 'false';
  insurance_required: '' | 'true' | 'false';
  destination_yard: string;
  endereco_entrega_final: string;
  necessidade_descarga: '' | 'true' | 'false';
  ncm: string;
  exportador: string;
  pais_procedencia: string;
  peso_taxado: string;
  observations: string;
  carga_perigosa: CargaPerigosa | '';
  un_number: string;
  imo_class: string;
  temperatura_min: string;
  temperatura_max: string;
  client_reference: string;
  agente_define_porto_embarque: '' | 'true' | 'false';
  agente_define_porto_destino: '' | 'true' | 'false';
  agente_define_aeroporto_embarque: '' | 'true' | 'false';
  agente_define_aeroporto_destino: '' | 'true' | 'false';
  agente_define_local_coleta: '' | 'true' | 'false';
  ptax_negociada: string;
  price_or_performance: PriceOrPerformance | '';
};


export interface AddRFQAgentsResult {
  rfq: RFQ;
  added_agents: { id: string; name: string; emails: string[]; status: 'sent' | 'failed'; error?: string }[];
  skipped_agents: string[];
}

export interface NotificationResult {
  id: string;
  name: string;
  emails: string[];
  status: 'sent' | 'failed';
  error?: string;
}

// Agent portal form types — used by /proposta/[token] page and rfq-details-card
export interface ProposalFormEquipment {
  id: string;
  quantity: number;
  tipo_container: string | null;
  volume_m3: number | null;
  peso_bruto: number | null;
  peso_unidade: string | null;
}

export interface ProposalFormVolume {
  id: string;
  quantity: number;
  embalagem: string | null;
  peso_bruto: number | null;
  peso_unidade: string | null;
  comprimento: number | null;
  largura: number | null;
  altura: number | null;
  dimensao_unidade: string | null;
  volume_m3: number | null;
}

export interface ProposalFormQuotation {
  reference: string;
  modal: string | null;
  tipo_embarque: string | null;
  service_type: string | null;
  origin: string | null;
  porto_destino: string[] | null;
  aeroporto_destino: string[] | null;
  incoterm: string | null;
  product: string | null;
  desired_deadline: string | null;
  declared_value: number | null;
  declared_value_currency: string | null;
  stackability: boolean | null;
  insurance_required: boolean | null;
  carga_perigosa: string | null;
  observations: string | null;
  incluir_entrega_destino_final: boolean | null;
  endereco_entrega_final: string | null;
  document_urls: Record<string, string>;
  equipments: ProposalFormEquipment[];
  volumes: ProposalFormVolume[];
}

export interface NotifyRfqUpdateResponse {
  agents: NotificationResult[];
  agents_sent_count: number;
  agents_failed_count: number;
  partial_failure: boolean;
}

export interface TransitionResponse {
  state: string;
  message: string;
  notifications?: NotificationResult[];
}

// ---------------------------------------------------------------------------
// Audit types — CotacaoAuditoria (3-moment audit agent)
// ---------------------------------------------------------------------------

export type AuditResultado = 'aprovado' | 'divergente' | 'bloqueado';
export type AuditAcaoTomada = 'passivo' | 'alerta' | 'bloqueio' | 'sugestao_aplicada';
export type AuditResolucaoTipo = 'correcao_aplicada' | 'justificada_e_seguiu' | 'cancelada';

export interface AuditDivergencia {
  tipo: string;
  campo: string;
  tipo_validacao: 'strict' | 'flexible';
  esperado: unknown;
  recebido: unknown;
  fonte_esperado: string;
  sugestao: string | null;
  severidade: 'critico' | 'alto' | 'medio' | 'baixo';
  mensagem: string;
}

export interface CotacaoAuditoria {
  id: string;
  cotacao_id: string;
  momento: 1 | 2 | 3;
  agente_carga_id: string | null;
  timestamp: string;
  resultado: AuditResultado;
  divergencias: AuditDivergencia[];
  acao_tomada: AuditAcaoTomada;
  resolvido_por: string | null;
  resolvido_em: string | null;
  resolucao_tipo: AuditResolucaoTipo | null;
  observacao: string | null;
}

// ---------------------------------------------------------------------------
// Shipment Instruction
// ---------------------------------------------------------------------------

export interface SIParty {
  nome?: string;
  cnpj?: string;
  endereco?: string;
  pic?: string;
  tel?: string;
  email?: string;
  texto_livre?: string;
}

// CANCELADA: set when the quotation that owns this SI is reopened (FECHADA ->
// COTANDO) after the SI was already generated — the draft/sent instruction is
// superseded and a fresh one will be created once the quotation closes again
// with the new agent.
export type SIStatus = 'RASCUNHO' | 'ENVIADA' | 'CANCELADA';

export interface ShipmentInstruction {
  id: string;
  reference: string;
  quotation_id: string;
  proposal_id: string | null;
  status: SIStatus;
  exportador: SIParty | null;
  consignatario: SIParty | null;
  notificado: SIParty | null;
  incoterm_cotado: string | null;
  incoterm_aprovado: string | null;
  ptax_tipo: 'padrao' | 'negociado' | null;
  ptax_valor: number | null;
  incluir_seguro: boolean;
  solicitar_agente_origem: boolean;
  prontidao_prevista: string | null;
  instrucoes_livres: string | null;
  cc_emails: string[];
  agente_origem: string | null;
  created_by: string;
  sent_by: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string | null;
}

// Minimal quotation shape the ShipmentInstruction UI reads. Both the internal
// `Quotation` and the portal `PortalQuotation` structurally satisfy it, so the
// SI section component is reused across the analyst app and the client portal
// without coupling to either full type (ARB-2449).
export interface SIQuotationView {
  id: string;
  reference: string;
  client_reference: string | null;
  modal: QuotationModal | null;
  service_type: ServiceType | null;
  porto_embarque: string | null;
  aeroporto_embarque: string | null;
  porto_destino: string[] | null;
  aeroporto_destino: string[] | null;
  stackability: boolean | null;
  carga_tombavel: boolean | null;
  declared_value: number | null;
  declared_value_currency: Currency | null;
}

export interface CreateSIPayload {
  exportador?: SIParty;
  consignatario?: SIParty;
  notificado?: SIParty;
  incoterm_aprovado?: string;
  ptax_tipo?: 'padrao' | 'negociado';
  ptax_valor?: number;
  incluir_seguro?: boolean;
  solicitar_agente_origem?: boolean;
  prontidao_prevista?: string;
  instrucoes_livres?: string;
  cc_emails?: string[];
}

export interface SendSIPayload extends CreateSIPayload {
  confirm_incoterm_divergence?: boolean;
}

export interface UpdateSIAgentPayload {
  agente_origem: string;
}

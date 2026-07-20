import type { TipoEmbarque } from './quotation';
import { MODAL_LABELS } from './quotation';

export type { TipoEmbarque };
export { MODAL_LABELS };

export type ClientTier = 'PREMIUM' | 'POTENCIAL' | 'CRESCIMENTO' | 'MANTER';

export type InsuranceResponsibility = 'FREITAS' | 'CLIENTE' | 'NAO_INCLUSO' | 'AGENTE_DE_CARGAS';

export type Modal = 'MARITIMO' | 'AEREO' | 'RODOVIARIO';

export type LogisticsType = 'COTACAO' | 'TORRE_DE_CONTROLE' | 'PREMIUM';

export type PriceOrPerformance = 'PRECO' | 'PERFORMANCE';

export type ServiceType = 'IMPORTACAO' | 'EXPORTACAO';

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  IMPORTACAO: 'Importação',
  EXPORTACAO: 'Exportação',
};

// Single source of truth for DNA enum labels, shared by client-modal.tsx,
// bulk-dna-modal.tsx and dna-summary-card.tsx (previously 3 independent
// copies with no consistency check between them or with the backend enums
// in shared/database/models/quotation/enums.py).
//
// Deliberately not reusing quotation.ts's TIPO_EMBARQUE_LABELS here: that map
// adds an AEREO entry for a different display context (labeling the modal
// when tipo_embarque doesn't apply), which isn't a valid TipoEmbarque value
// and would show up as a bogus selectable option if used to build a Select.
export const TIPO_EMBARQUE_LABELS: Record<TipoEmbarque, string> = {
  FCL: 'FCL',
  LCL: 'LCL',
  BREAK_BULK: 'Break Bulk',
};

export const LOGISTICS_TYPE_LABELS: Record<LogisticsType, string> = {
  COTACAO: 'Cotação',
  TORRE_DE_CONTROLE: 'Torre de Controle',
  PREMIUM: 'Premium',
};

export const INSURANCE_RESPONSIBILITY_LABELS: Record<InsuranceResponsibility, string> = {
  FREITAS: 'Freitas',
  CLIENTE: 'Cliente',
  NAO_INCLUSO: 'Não incluso',
  AGENTE_DE_CARGAS: 'Agente de Cargas',
};

export const PRICE_OR_PERFORMANCE_LABELS: Record<PriceOrPerformance, string> = {
  PRECO: 'Preço',
  PERFORMANCE: 'Performance',
};

export interface ClientDnaInsurance {
  value: InsuranceResponsibility | null;
  is_critical: boolean;
}

export interface ClientDna {
  id: string;
  client_id: string;
  service_type: ServiceType;
  modality: Modal | null;
  tipo_embarque: TipoEmbarque | null;
  logistics_type: LogisticsType | null;
  default_agents: Record<string, unknown> | null;
  /** @deprecated Legacy free-text field, replaced by the 3 fields below (ARB-2384). */
  destination_yard: string | null;
  destination_yard_aereo: string | null;
  destination_yard_maritimo_fcl: string | null;
  destination_yard_maritimo_lcl: string | null;
  insurance_responsibility: ClientDnaInsurance;
  quotation_particularities: string | null;
  dangerous_cargo_shipper: boolean | null;
  price_or_performance: PriceOrPerformance | null;
  cargo_profile: string | null;
  contact_name: string | null;
  contact_email: string | null;
  assigned_analyst: string | null;
  exige_oea: boolean | null;
  anvisa_restrictions: Record<string, unknown> | null;
  preferred_embarque_local: string | null;
  updated_at: string | null;
}

export interface PortalContact {
  id: string;
  client_id: string;
  email: string;
  name: string | null;
  created_at: string;
}

export interface CreatePortalContactPayload {
  email: string;
  name?: string;
}

export interface QuotationClient {
  id: string;
  name: string;
  sector: string | null;
  email: string;
  company_code: string | null;
  cnpj: string | null;
  razao_social: string | null;
  endereco: string | null;
  importador: string | null;
  adquirente: string | null;
  importacao_direta: boolean;
  tier: ClientTier;
  is_vip: boolean;
  created_at: string;
  dnas?: ClientDna[];
}

export interface CreateClientPayload {
  name: string;
  email: string;
  sector?: string;
  company_code?: string;
  cnpj?: string;
  razao_social?: string;
  endereco?: string;
  importador?: string;
  adquirente?: string;
  importacao_direta?: boolean;
  tier?: ClientTier;
  is_vip?: boolean;
  modality?: Modal;
  tipo_embarque?: TipoEmbarque;
  logistics_type?: LogisticsType;
  destination_yard_aereo?: string;
  destination_yard_maritimo_fcl?: string;
  destination_yard_maritimo_lcl?: string;
  insurance_responsibility?: InsuranceResponsibility;
  quotation_particularities?: string;
  dangerous_cargo_shipper?: boolean;
  price_or_performance?: PriceOrPerformance;
  cargo_profile?: string;
  contact_name?: string;
  contact_email?: string;
  assigned_analyst?: string;
}

export interface UpdateClientPayload {
  name?: string;
  email?: string;
  sector?: string;
  company_code?: string;
  cnpj?: string;
  razao_social?: string;
  endereco?: string;
  importador?: string;
  adquirente?: string;
  importacao_direta?: boolean;
  tier?: ClientTier;
  is_vip?: boolean;
}

// Fields the bulk DNA editor may write. Narrower than UpdateDnaPayload on
// purpose: excludes per-client fields (contact_name/contact_email) and complex
// JSONB editors (default_agents/anvisa_restrictions), matching the backend
// whitelist in lambdas/client/bulk_update_client_dna. Keying the modal's field
// config off this type makes adding an excluded field a compile error.
export type BulkDnaUpdateFields = Pick<
  UpdateDnaPayload,
  | 'modality'
  | 'tipo_embarque'
  | 'logistics_type'
  | 'insurance_responsibility'
  | 'price_or_performance'
  | 'destination_yard_aereo'
  | 'destination_yard_maritimo_fcl'
  | 'destination_yard_maritimo_lcl'
  | 'preferred_embarque_local'
  | 'cargo_profile'
  | 'dangerous_cargo_shipper'
  | 'exige_oea'
  | 'quotation_particularities'
  | 'assigned_analyst'
>;

export interface BulkUpdateDnaPayload {
  client_ids: string[];
  service_types: ServiceType[];
  dna_update: BulkDnaUpdateFields;
}

export interface BulkUpdateDnaResult {
  updated_count: number;
  skipped_count: number;
  skipped: { client_id: string; service_type: ServiceType }[];
  failed_count: number;
  failed: { client_id: string; service_type: ServiceType; error: string }[];
}

export interface UpdateDnaPayload {
  service_type?: ServiceType;
  modality?: Modal;
  tipo_embarque?: TipoEmbarque;
  logistics_type?: LogisticsType;
  default_agents?: Record<string, boolean> | null;
  destination_yard_aereo?: string;
  destination_yard_maritimo_fcl?: string;
  destination_yard_maritimo_lcl?: string;
  insurance_responsibility?: InsuranceResponsibility;
  quotation_particularities?: string;
  dangerous_cargo_shipper?: boolean;
  price_or_performance?: PriceOrPerformance;
  cargo_profile?: string;
  contact_name?: string;
  contact_email?: string;
  assigned_analyst?: string;
  exige_oea?: boolean;
  anvisa_restrictions?: Record<string, unknown>;
  preferred_embarque_local?: string;
}

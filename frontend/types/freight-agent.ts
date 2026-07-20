export type ModalRegion =
  | 'AEREO_ASIA'
  | 'AEREO_EUROPA'
  | 'AEREO_AMERICAS'
  | 'MARITIMO_FCL_ASIA'
  | 'MARITIMO_FCL_EUROPA'
  | 'MARITIMO_FCL_AMERICAS'
  | 'MARITIMO_LCL_ASIA'
  | 'MARITIMO_LCL_EUROPA'
  | 'MARITIMO_LCL_AMERICAS';

export interface FreightAgentContact {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  export_air: boolean;
  import_air: boolean;
  export_maritime: boolean;
  import_maritime: boolean;
  export_road: boolean;
  import_road: boolean;
  created_at?: string;
  updated_at?: string | null;
}

export interface FreightAgent {
  id: string;
  name: string;
  email: string;
  preferred_channel: string | null;
  reliability_score: number | null;
  total_quotations: number;
  error_count: number;
  modal_regions: ModalRegion[] | null;
  certificacao_oea: boolean | null;
  data_validade_oea: string | null;
  carga_imo: boolean | null;
  contacts: FreightAgentContact[];
  created_at: string;
  updated_at: string | null;
}

export interface CreateFreightAgentPayload {
  name: string;
  email: string;
  preferred_channel?: string;
  modal_regions?: ModalRegion[];
  certificacao_oea?: boolean;
  data_validade_oea?: string;
  carga_imo?: boolean;
  contacts?: FreightAgentContact[];
}

export interface UpdateFreightAgentPayload {
  name?: string;
  email?: string;
  preferred_channel?: string;
  modal_regions?: ModalRegion[] | null;
  certificacao_oea?: boolean | null;
  data_validade_oea?: string | null;
  carga_imo?: boolean | null;
  contacts?: FreightAgentContact[];
}

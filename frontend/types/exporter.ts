export type ExporterCargoProfile = 'GERAL' | 'PERIGOSA' | 'TEMP_CONTROLADA';

export const CARGO_PROFILE_LABELS: Record<ExporterCargoProfile, string> = {
  GERAL: 'Geral',
  PERIGOSA: 'Perigosa',
  TEMP_CONTROLADA: 'Temperatura Controlada',
};

export interface Exporter {
  id: string;
  name: string;
  endereco: string | null;
  particularidades: string | null;
  cargo_profile: ExporterCargoProfile;
  contact_email: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface CreateExporterPayload {
  name: string;
  endereco?: string;
  particularidades?: string;
  cargo_profile?: ExporterCargoProfile;
  contact_email?: string;
}

export interface UpdateExporterPayload {
  name?: string;
  endereco?: string;
  particularidades?: string;
  cargo_profile?: ExporterCargoProfile;
  contact_email?: string;
}

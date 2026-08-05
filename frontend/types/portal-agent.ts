// Agentes pré-aprovados e preferências do cliente no portal.
//
// Deliberadamente SEM score: o backend (`shared/portal_agent_helpers.py`) não
// devolve `reliability_score`, `total_quotations` nem `error_count`, então não
// há campo aqui para alguém renderizar por engano. É a mesma regra do
// `ScoreBadge` da cotação e do dashboard Inteligência > Agentes.

export interface PortalAgent {
  id: string;
  name: string;
  modal_regions: string[] | null;
  certificacao_oea: boolean | null;
  carga_imo: boolean | null;
  /** Escolha do cliente: participa das próximas solicitações de cotação. */
  active: boolean;
}

export interface PortalAgentsResponse {
  items: PortalAgent[];
  total_count: number;
  active_count: number;
  /**
   * Limite de agentes do plano contratado. SEMPRE null hoje — não existe modelo
   * de planos no schema. A tela mostra "Pendente integração" no lugar do limite
   * em vez de inventar um número; não faça fallback para uma constante.
   */
  plan_limit: number | null;
  plan_name: string | null;
}

export interface PortalPreferences {
  /** Mesma lista do toggle de Meus Agentes — ver migração 094. */
  paused_agent_ids: string[];
  preferred_port: string | null;
  default_incoterm: string | null;
  uses_insurance: boolean | null;
  cargo_particularities: string | null;
  updated_at: string | null;
}

/** PATCH: só as chaves enviadas são gravadas. */
export type UpdatePreferencesPayload = Partial<
  Omit<PortalPreferences, 'updated_at'>
>;

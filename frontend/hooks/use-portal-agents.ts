// Agentes pré-aprovados do cliente e preferências da conta.
//
// Duas chaves SWR, uma única fonte de verdade no backend: pausar um agente é um
// PUT em /portal/preferences, e por isso `setAgentActive` revalida TAMBÉM
// /portal/agents — é de lá que sai o `active` de cada card e o contador de
// ativos. Sem essa segunda revalidação o toggle mudaria o banco e a lista
// continuaria mostrando o estado velho até o próximo foco da aba.

import useSWR, { mutate as globalMutate } from 'swr';
import { toast } from 'react-toastify';
import portal_api from '@/lib/portal-api';
import type {
  PortalAgentsResponse,
  PortalPreferences,
  UpdatePreferencesPayload,
} from '@/types/portal-agent';

const AGENTS_URL = '/portal/agents';
const PREFERENCES_URL = '/portal/preferences';

const agentsFetcher = async (url: string): Promise<PortalAgentsResponse> => {
  const response = await portal_api.get<PortalAgentsResponse>(url);
  return response.data;
};

const preferencesFetcher = async (url: string): Promise<PortalPreferences> => {
  const response = await portal_api.get<{ preferences: PortalPreferences }>(url);
  return response.data.preferences;
};

export const useMyAgents = () => {
  const { data, error, mutate } = useSWR<PortalAgentsResponse>(
    AGENTS_URL,
    agentsFetcher,
  );
  return {
    agents: data?.items ?? [],
    activeCount: data?.active_count ?? 0,
    totalCount: data?.total_count ?? 0,
    planLimit: data?.plan_limit ?? null,
    planName: data?.plan_name ?? null,
    isLoading: !error && !data,
    isError: !!error,
    mutate,
  };
};

export const useMyPreferences = () => {
  const { data, error, mutate } = useSWR<PortalPreferences>(
    PREFERENCES_URL,
    preferencesFetcher,
  );
  return {
    preferences: data,
    isLoading: !error && !data,
    isError: !!error,
    mutate,
  };
};

/**
 * Grava um subconjunto das preferências. Retorna as preferências atualizadas ou
 * null — como toda mutation do portal, não propaga exceção.
 */
export const updateMyPreferences = async (
  payload: UpdatePreferencesPayload,
): Promise<PortalPreferences | null> => {
  try {
    const response = await portal_api.put<{ preferences: PortalPreferences }>(
      PREFERENCES_URL,
      payload,
    );
    globalMutate(PREFERENCES_URL);
    globalMutate(AGENTS_URL);
    return response.data.preferences;
  } catch {
    toast.error('Erro ao salvar suas preferências.');
    return null;
  }
};

/**
 * Ativa ou pausa um agente. Recebe a lista de pausados ATUAL para montar a nova
 * — o backend grava a lista inteira, não um delta, e derivá-la aqui a partir de
 * um estado desatualizado apagaria a pausa de outro agente.
 */
export const setAgentActive = async (
  agentId: string,
  active: boolean,
  currentPaused: string[],
): Promise<boolean> => {
  const next = active
    ? currentPaused.filter((id) => id !== agentId)
    : Array.from(new Set([...currentPaused, agentId]));

  const result = await updateMyPreferences({ paused_agent_ids: next });
  if (result) {
    toast.success(
      active
        ? 'Agente ativado nas suas próximas cotações.'
        : 'Agente pausado. Ele não entra nas suas próximas cotações.',
    );
  }
  return result != null;
};

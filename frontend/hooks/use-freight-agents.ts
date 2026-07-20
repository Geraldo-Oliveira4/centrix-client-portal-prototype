import useSWR, { mutate as globalMutate } from 'swr';
import { toast } from 'react-toastify';
import base_api from '@/lib/axios-config';
import {
  CreateFreightAgentPayload,
  FreightAgent,
  UpdateFreightAgentPayload,
} from '@/types/freight-agent';

const BASE_URL = '/freight-agents';

const fetcher = async () => {
  const response = await base_api.get<{ items: FreightAgent[]; total: number }>(BASE_URL);
  return response.data.items;
};

export const useFreightAgents = () => {
  const { data: agents, error } = useSWR<FreightAgent[]>(BASE_URL, fetcher);

  const createAgent = async (
    payload: CreateFreightAgentPayload,
  ): Promise<FreightAgent | null> => {
    try {
      const response = await base_api.post<{ freight_agent: FreightAgent }>(BASE_URL, payload);
      globalMutate(BASE_URL);
      toast.success('Agente de carga cadastrado com sucesso!');
      return response.data.freight_agent;
    } catch {
      toast.error('Erro ao cadastrar agente de carga.');
      return null;
    }
  };

  const updateAgent = async (
    agentId: string,
    payload: UpdateFreightAgentPayload,
  ): Promise<FreightAgent | null> => {
    try {
      const response = await base_api.put<{ freight_agent: FreightAgent }>(
        `${BASE_URL}/${agentId}`,
        payload,
      );
      globalMutate(BASE_URL);
      toast.success('Agente de carga atualizado com sucesso!');
      return response.data.freight_agent;
    } catch {
      toast.error('Erro ao atualizar agente de carga.');
      return null;
    }
  };

  const getAgent = async (agentId: string): Promise<FreightAgent | null> => {
    try {
      const response = await base_api.get<{ freight_agent: FreightAgent }>(
        `${BASE_URL}/${agentId}`,
      );
      return response.data.freight_agent;
    } catch {
      toast.error('Erro ao carregar dados do agente de carga.');
      return null;
    }
  };

  return {
    agents,
    isLoading: !error && !agents,
    isError: !!error,
    createAgent,
    updateAgent,
    getAgent,
  };
};

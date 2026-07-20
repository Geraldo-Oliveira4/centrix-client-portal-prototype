import useSWR from 'swr';
import axios from 'axios';
import { toast } from 'react-toastify';
import base_api from '@/lib/axios-config';
import { mutate as globalMutate } from 'swr';
import type {
  AddRFQAgentsResult,
  AuditDivergencia,
  CreateRFQPayload,
  NotifyRfqUpdateResponse,
  RFQ,
  RFQAgentToken,
  RFQValidationResult,
  ValidationBlock,
} from '@/types/quotation';

const BASE_URL = '/quotations';

interface RFQResponse extends RFQValidationResult {
  rfq: RFQ | null;
  agent_tokens: RFQAgentToken[];
}

const fetchRFQ = async (url: string): Promise<RFQResponse> => {
  const response = await base_api.get<RFQResponse>(url);
  return response.data;
};

// Stable empty arrays — prevents useEffect dependency churn when data is loading
const EMPTY_BLOCKS: ValidationBlock[] = [];

export const useRFQ = (quotationId: string | null) => {
  const key = quotationId ? `${BASE_URL}/${quotationId}/rfq` : null;

  const { data, error, mutate } = useSWR<RFQResponse>(key, fetchRFQ, {
    revalidateOnFocus: false,
  });

  return {
    rfq: data?.rfq ?? null,
    agentTokens: data?.agent_tokens ?? [],
    hardBlocks: data?.hard_blocks ?? EMPTY_BLOCKS,
    softWarnings: data?.soft_warnings ?? EMPTY_BLOCKS,
    isLoading: !!quotationId && !error && !data,
    isError: !!error,
    mutate,
  };
};

export interface DispatchRFQResult {
  success: boolean;
  auditDivergencias?: AuditDivergencia[];
}

export const dispatchRFQ = async (
  quotationId: string,
): Promise<DispatchRFQResult> => {
  try {
    const response = await base_api.post<{
      dispatched_at: string;
      rfq: RFQ;
      agents: { id: string; name: string; emails: string[]; status: 'sent' | 'failed'; error?: string }[];
      state_transition: { success: boolean; state: string };
    }>(`${BASE_URL}/${quotationId}/rfq/dispatch`);

    const agents = response.data.agents;
    const sent = agents.filter((a) => a.status === 'sent').length;
    const failed = agents.filter((a) => a.status === 'failed').length;

    if (failed > 0 && sent === 0) {
      toast.error(`Falha ao enviar RFQ para todos os agentes (${failed}).`);
      return { success: false };
    }
    if (failed > 0) {
      toast.warn(`RFQ enviado para ${sent} agente(s). Falha em ${failed}.`);
    } else {
      toast.success(`RFQ disparado para ${sent} agente(s) com sucesso!`);
    }

    globalMutate(`${BASE_URL}/${quotationId}/rfq`);
    globalMutate(`${BASE_URL}/${quotationId}`);
    globalMutate(`${BASE_URL}/${quotationId}/history`);
    globalMutate(`${BASE_URL}/kanban`);
    return { success: true };
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 422) {
      const data = err.response.data as {
        error?: string;
        blocked_agents?: { id: string; name: string }[];
        audit_divergencias?: AuditDivergencia[];
      };
      const blockedNames = data.blocked_agents?.map((a) => a.name).join(', ');
      if (blockedNames) {
        toast.error(`Disparo bloqueado (OEA): ${blockedNames}`);
        return { success: false };
      }
      if (data.audit_divergencias?.length) {
        return { success: false, auditDivergencias: data.audit_divergencias };
      }
      toast.error(data.error ?? 'Disparo bloqueado por restricao de certificacao.');
      return { success: false };
    }
    toast.error('Erro ao disparar RFQ para agentes.');
    return { success: false };
  }
};

export const addRFQAgents = async (
  quotationId: string,
  agentIds: string[],
): Promise<AddRFQAgentsResult | null> => {
  try {
    const response = await base_api.post<AddRFQAgentsResult>(
      `${BASE_URL}/${quotationId}/rfq/add-agents`,
      { agent_ids: agentIds },
    );

    const agents = response.data.added_agents;
    const sent = agents.filter((a) => a.status === 'sent').length;
    const failed = agents.filter((a) => a.status === 'failed').length;
    const skipped = response.data.skipped_agents.length;

    if (failed > 0 && sent === 0) {
      toast.error(`Falha ao adicionar todos os agentes (${failed}).`);
    } else if (failed > 0) {
      toast.warn(`${sent} agente(s) adicionado(s). Falha em ${failed}.`);
    } else {
      toast.success(`${sent} agente(s) adicionado(s) com sucesso!`);
    }

    if (skipped > 0) {
      toast.info(`${skipped} agente(s) já estavam na cotação e foram ignorados.`);
    }

    globalMutate(`${BASE_URL}/${quotationId}/rfq`);
    globalMutate(`${BASE_URL}/${quotationId}`);
    globalMutate(`${BASE_URL}/${quotationId}/history`);
    return response.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 422) {
      const data = err.response.data as { error?: string; blocked_agents?: { id: string; name: string }[] };
      const blockedNames = data.blocked_agents?.map((a) => a.name).join(', ');
      if (blockedNames) {
        toast.error(`Adicao bloqueada (OEA): ${blockedNames}`);
      } else {
        toast.error(data.error ?? 'Adicao de agentes bloqueada por restricao de certificacao.');
      }
    } else {
      toast.error('Erro ao adicionar agentes à cotação.');
    }
    return null;
  }
};

export const createRFQ = async (
  quotationId: string,
  payload: CreateRFQPayload,
): Promise<{ rfq: RFQ; hard_blocks: ValidationBlock[]; soft_warnings: ValidationBlock[] } | null> => {
  try {
    const response = await base_api.post<{
      rfq: RFQ;
      hard_blocks: ValidationBlock[];
      soft_warnings: ValidationBlock[];
    }>(`${BASE_URL}/${quotationId}/rfq`, payload);
    globalMutate(`${BASE_URL}/${quotationId}/rfq`);
    return response.data;
  } catch {
    toast.error('Erro ao criar RFQ.');
    return null;
  }
};

export const reopenRfqAgent = async (
  quotationId: string,
  agentId: string,
): Promise<boolean> => {
  try {
    await base_api.post(
      `${BASE_URL}/${quotationId}/rfq/agents/${agentId}/reopen`,
    );

    globalMutate(`${BASE_URL}/${quotationId}/rfq`);
    globalMutate(`${BASE_URL}/${quotationId}/history`);
    toast.success('Agente reaberto. Use "Re-disparar" para reenviar o link.');
    return true;
  } catch {
    toast.error('Erro ao reabrir o agente.');
    return false;
  }
};

export const notifyRfqUpdate = async (
  quotationId: string,
  message?: string,
): Promise<NotifyRfqUpdateResponse | null> => {
  try {
    const response = await base_api.post<NotifyRfqUpdateResponse>(
      `${BASE_URL}/${quotationId}/rfq/notify-update`,
      message ? { message } : {},
    );

    const { agents_sent_count, agents_failed_count } = response.data;

    if (agents_failed_count > 0 && agents_sent_count === 0) {
      toast.error(`Falha ao notificar todos os agentes (${agents_failed_count}).`);
    } else if (agents_failed_count > 0) {
      toast.warn(`${agents_sent_count} agente(s) notificado(s). Falha em ${agents_failed_count}.`);
    } else {
      toast.success(`${agents_sent_count} agente(s) notificado(s) com sucesso!`);
    }

    globalMutate(`${BASE_URL}/${quotationId}/rfq`);
    globalMutate(`${BASE_URL}/${quotationId}/history`);
    return response.data;
  } catch {
    toast.error('Erro ao notificar agentes sobre a atualização da cotação.');
    return null;
  }
};

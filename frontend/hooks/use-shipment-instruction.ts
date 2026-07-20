import useSWR from 'swr';
import { toast } from 'react-toastify';
import type { AxiosInstance } from 'axios';
import base_api from '@/lib/axios-config';
import { mutate as globalMutate } from 'swr';
import type {
  CreateSIPayload,
  SendSIPayload,
  ShipmentInstruction,
  UpdateSIAgentPayload,
} from '@/types/quotation';

// The Shipment Instruction endpoints are shared by the internal analyst app and
// the client portal (ARB-2449): the backend handlers authorize either audience
// via resolve_quotation_actor. The only client-side difference is the axios
// instance (auth) and the route prefix, so callers pass an SIApi to reuse all
// the logic below instead of duplicating it.
export interface SIApi {
  api: AxiosInstance;
  basePath: string;
}

const INTERNAL_SI_API: SIApi = { api: base_api, basePath: '/quotations' };

export const useShipmentInstruction = (
  quotationId: string | null,
  { api, basePath }: SIApi = INTERNAL_SI_API,
) => {
  const key = quotationId ? `${basePath}/${quotationId}/si` : null;
  const { data, error, mutate } = useSWR<{
    shipment_instruction: ShipmentInstruction;
    incoterm_divergence: boolean;
    proposal_validity_warning: boolean;
  }>(
    key,
    async (url: string) => {
      const res = await api.get(url);
      return res.data;
    },
    { shouldRetryOnError: false },
  );
  return {
    si: data?.shipment_instruction ?? null,
    incotermDivergence: data?.incoterm_divergence ?? false,
    proposalValidityWarning: data?.proposal_validity_warning ?? false,
    isLoading: !!quotationId && !error && !data,
    isError: !!error,
    mutate,
  };
};

export const createShipmentInstruction = async (
  quotationId: string,
  payload: CreateSIPayload = {},
  { api, basePath }: SIApi = INTERNAL_SI_API,
): Promise<{ si: ShipmentInstruction; incotermDivergence: boolean; proposalValidityWarning: boolean } | null> => {
  try {
    const res = await api.post<{
      shipment_instruction: ShipmentInstruction;
      incoterm_divergence: boolean;
      proposal_validity_warning: boolean;
    }>(`${basePath}/${quotationId}/si`, payload);
    globalMutate(`${basePath}/${quotationId}/si`);
    return {
      si: res.data.shipment_instruction,
      incotermDivergence: res.data.incoterm_divergence,
      proposalValidityWarning: res.data.proposal_validity_warning,
    };
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { detail?: string; error?: string } } })?.response?.data?.detail
      ?? (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      ?? 'Erro ao criar instrução de embarque.';
    toast.error(msg);
    return null;
  }
};

export const sendShipmentInstruction = async (
  quotationId: string,
  payload: SendSIPayload,
  { api, basePath }: SIApi = INTERNAL_SI_API,
): Promise<boolean> => {
  try {
    await api.post(`${basePath}/${quotationId}/si/send`, payload);
    globalMutate(`${basePath}/${quotationId}`);
    globalMutate(`${basePath}/${quotationId}/si`);
    globalMutate(`${basePath}/kanban`);
    toast.success('Instrução de embarque enviada com sucesso!');
    return true;
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { detail?: string; error?: string } } })?.response?.data?.detail
      ?? (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      ?? 'Erro ao enviar instrução de embarque.';
    toast.error(msg);
    return false;
  }
};

export const updateSIAgentOrigem = async (
  quotationId: string,
  payload: UpdateSIAgentPayload,
  { api, basePath }: SIApi = INTERNAL_SI_API,
): Promise<boolean> => {
  try {
    await api.post(`${basePath}/${quotationId}/si`, payload);
    globalMutate(`${basePath}/${quotationId}/si`);
    toast.success('Agente de origem registrado.');
    return true;
  } catch {
    toast.error('Erro ao registrar agente de origem.');
    return false;
  }
};

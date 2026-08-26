import axios from 'axios';
import useSWR, { mutate as globalMutate } from 'swr';
import { toast } from 'react-toastify';
import portal_api from '@/lib/portal-api';
import { createAction, triggerExtractionAction } from '@/lib/api-actions';
import { uploadFileToS3 } from '@/lib/upload-file';
import type {
  CreatePortalQuotationPayload,
  PortalClientResponse,
  PortalDeclineReason,
  PortalQuotation,
  PortalQuotationAgentsResponse,
  PortalQuotationResponse,
  PortalQuotationsResponse,
  PortalRfqSaveResult,
  SavePortalRfqPayload,
} from '@/types/portal';
import type {
  CreateQuotationResponse,
  QuotationAttachment,
  QuotationLog,
  RecommendationResult,
  ValidationBlock,
} from '@/types/quotation';

const fetchQuotations = async (
  url: string,
): Promise<PortalQuotationsResponse> => {
  const response = await portal_api.get<PortalQuotationsResponse>(url);
  return response.data;
};

const fetchQuotation = async (url: string): Promise<PortalQuotation> => {
  const response = await portal_api.get<PortalQuotationResponse>(url);
  return response.data.quotation;
};

const fetchMyClient = async (url: string): Promise<PortalClientResponse> => {
  const response = await portal_api.get<PortalClientResponse>(url);
  return response.data;
};

export const useMyQuotations = () => {
  const { data, error, mutate } = useSWR<PortalQuotationsResponse>(
    '/portal/quotations',
    fetchQuotations,
  );
  return {
    data,
    isLoading: !error && !data,
    isError: !!error,
    mutate,
  };
};

export const useMyQuotation = (id: string | null) => {
  const key = id ? `/portal/quotations/${id}` : null;
  const { data, error, mutate } = useSWR<PortalQuotation>(key, fetchQuotation);
  return {
    quotation: data,
    isLoading: !error && !data && !!key,
    isError: !!error,
    mutate,
  };
};

export const useMyClient = () => {
  const { data, error, mutate } = useSWR<PortalClientResponse>(
    '/portal/clients/me',
    fetchMyClient,
  );
  return {
    client: data?.client,
    isLoading: !error && !data,
    isError: !!error,
    mutate,
  };
};

const revalidateQuotation = (quotationId: string) => {
  globalMutate('/portal/quotations');
  globalMutate(`/portal/quotations/${quotationId}`);
};

export const approveProposal = async (
  quotationId: string,
  proposalId: string,
): Promise<boolean> => {
  try {
    await portal_api.post(
      `/portal/quotations/${quotationId}/proposals/${proposalId}/approve`,
    );
    toast.success('Proposta aprovada com sucesso!');
    revalidateQuotation(quotationId);
    return true;
  } catch {
    toast.error('Erro ao aprovar proposta.');
    return false;
  }
};

export const declineQuotation = async (
  quotationId: string,
  payload: { decline_reason: PortalDeclineReason; note?: string },
): Promise<boolean> => {
  try {
    await portal_api.post(`/portal/quotations/${quotationId}/decline`, payload);
    toast.success('Cotação reprovada.');
    revalidateQuotation(quotationId);
    return true;
  } catch {
    toast.error('Erro ao reprovar cotação.');
    return false;
  }
};

// Cancel the whole quotation (any non-terminal state). The backend also emails
// every RFQ-targeted agent; the per-agent result is surfaced as a follow-up
// toast, mirroring the analyst transitionQuotation cancel behaviour.
export const cancelQuotation = async (
  quotationId: string,
  payload?: { note?: string },
): Promise<boolean> => {
  try {
    const { data } = await portal_api.post<{
      notifications?: { status: 'sent' | 'failed' }[];
    }>(`/portal/quotations/${quotationId}/cancel`, payload ?? {});
    toast.success('Cotação cancelada.');

    const notifications = data.notifications ?? [];
    const failed = notifications.filter((n) => n.status === 'failed').length;
    const sent = notifications.filter((n) => n.status === 'sent').length;
    if (failed > 0) {
      toast.warn(`Falha ao notificar ${failed} agente(s) do cancelamento.`);
    } else if (sent > 0) {
      toast.info(`${sent} agente(s) notificado(s) do cancelamento.`);
    }

    revalidateQuotation(quotationId);
    return true;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 409) {
      toast.error('Esta cotação não pode mais ser cancelada.');
      return false;
    }
    toast.error('Erro ao cancelar cotação.');
    return false;
  }
};

// ---------------------------------------------------------------------------
// RFQ assembly + dispatch from the portal (ARB-2450 / ARB-2452)
// ---------------------------------------------------------------------------

const fetchQuotationAgents = async (
  url: string,
): Promise<PortalQuotationAgentsResponse> => {
  const response = await portal_api.get<PortalQuotationAgentsResponse>(url);
  return response.data;
};

export const useQuotationAgents = (id: string | null) => {
  const key = id ? `/portal/quotations/${id}/agents` : null;
  const { data, error, mutate } = useSWR<PortalQuotationAgentsResponse>(
    key,
    fetchQuotationAgents,
  );
  return {
    agents: data?.agents ?? [],
    rfqDispatched: data?.rfq_dispatched ?? false,
    selectedAgentIds: data?.selected_agent_ids ?? [],
    isLoading: !error && !data && !!key,
    isError: !!error,
    mutate,
  };
};

/**
 * Persist the RFQ assembly (target agents, deadline, particularities). Returns
 * the validation result so the caller can decide whether to proceed to
 * dispatch, or `null` on an unexpected network error. Hard blocks and invalid
 * agents surface as a toast and the returned `hard_blocks` list.
 */
export const savePortalRfq = async (
  quotationId: string,
  payload: SavePortalRfqPayload,
  options?: { silentValidation?: boolean },
): Promise<PortalRfqSaveResult | null> => {
  try {
    const response = await portal_api.put<{
      soft_warnings?: ValidationBlock[];
    }>(`/portal/quotations/${quotationId}/rfq`, payload);
    return {
      hard_blocks: [],
      soft_warnings: response.data.soft_warnings ?? [],
    };
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 422) {
      const data = err.response.data as {
        error?: string;
        hard_blocks?: ValidationBlock[];
        soft_warnings?: ValidationBlock[];
      };
      // Callers that render the hard blocks inline (the RFQ card) pass
      // silentValidation so we don't also raise a redundant, alarming toast.
      if (!options?.silentValidation) {
        toast.error(data.error ?? 'Não foi possível salvar a solicitação.');
      }
      return {
        hard_blocks: data.hard_blocks ?? [],
        soft_warnings: data.soft_warnings ?? [],
      };
    }
    toast.error('Erro ao salvar a solicitação de cotação.');
    return null;
  }
};

/** Fire the saved RFQ to the pre-set agents. Returns true on success. */
export const dispatchPortalRfq = async (
  quotationId: string,
): Promise<boolean> => {
  try {
    const response = await portal_api.post<{
      agents: { status: 'sent' | 'failed' }[];
    }>(`/portal/quotations/${quotationId}/rfq/dispatch`);
    const agents = response.data.agents ?? [];
    const sent = agents.filter((a) => a.status === 'sent').length;
    const failed = agents.filter((a) => a.status === 'failed').length;
    if (failed > 0 && sent === 0) {
      toast.error('Falha ao enviar a solicitação para os agentes.');
      return false;
    }
    if (failed > 0) {
      toast.warn(
        `Solicitação enviada para ${sent} agente(s). Falha em ${failed}.`,
      );
    } else {
      toast.success('Solicitação de cotação enviada aos agentes!');
    }
    revalidateQuotation(quotationId);
    globalMutate(`/portal/quotations/${quotationId}/agents`);
    return true;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 422) {
      const data = err.response.data as { error?: string };
      toast.error(data.error ?? 'Disparo bloqueado.');
      return false;
    }
    toast.error('Erro ao enviar a solicitação de cotação.');
    return false;
  }
};

const postMyQuotation = createAction<
  CreatePortalQuotationPayload,
  CreateQuotationResponse
>(portal_api, '/portal/quotations', 'Erro ao criar cotação.');

export const createMyQuotation = async (
  payload: CreatePortalQuotationPayload,
): Promise<CreateQuotationResponse | null> => {
  const result = await postMyQuotation(payload);
  if (result) globalMutate('/portal/quotations');
  return result;
};

// ---------------------------------------------------------------------------
// Recommendation, history and documents — portal counterparts of the analyst
// tabs. Read-only recommendation/history; documents also support upload.
// ---------------------------------------------------------------------------

const fetchRecommendation = async (url: string): Promise<RecommendationResult> => {
  const res = await portal_api.get<RecommendationResult>(url);
  return res.data;
};

const fetchHistory = async (url: string): Promise<QuotationLog[]> => {
  const res = await portal_api.get<{ items: QuotationLog[] }>(url);
  return res.data.items;
};

const fetchDocuments = async (url: string): Promise<QuotationAttachment[]> => {
  const res = await portal_api.get<{ items: QuotationAttachment[] }>(url);
  return res.data.items;
};

export const useMyRecommendation = (quotationId: string | null) => {
  const key = quotationId
    ? `/portal/quotations/${quotationId}/recommendation`
    : null;
  const { data, error, mutate } = useSWR<RecommendationResult>(key, fetchRecommendation);
  return {
    recommendation: data,
    isLoading: !error && !data && !!key,
    isError: !!error,
    mutate,
  };
};

export const useMyQuotationHistory = (quotationId: string | null) => {
  const key = quotationId ? `/portal/quotations/${quotationId}/history` : null;
  const { data, error, mutate } = useSWR<QuotationLog[]>(key, fetchHistory);
  return {
    logs: data ?? [],
    isLoading: !error && !data && !!key,
    isError: !!error,
    mutate,
  };
};

export const useMyQuotationDocuments = (quotationId: string | null) => {
  const key = quotationId ? `/portal/quotations/${quotationId}/attachments` : null;
  const { data, error, mutate } = useSWR<QuotationAttachment[]>(key, fetchDocuments);
  return {
    documents: data ?? [],
    isLoading: !error && !data && !!key,
    isError: !!error,
    mutate,
  };
};

/** Upload a document to the quotation (presigned S3 PUT). Returns true on success. */
export const addMyQuotationDocument = async (
  quotationId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<boolean> => {
  try {
    const { data } = await portal_api.post<{ upload_url: string; s3_key: string }>(
      `/portal/quotations/${quotationId}/documents/upload-url`,
      { filename: file.name },
    );
    const uploaded = await uploadFileToS3(data.upload_url, file, onProgress);
    if (!uploaded) return false;
    globalMutate(`/portal/quotations/${quotationId}/attachments`);
    return true;
  } catch {
    toast.error('Erro ao adicionar documento.');
    return false;
  }
};

export const triggerMyQuotationExtraction = triggerExtractionAction(
  portal_api,
  '/portal/quotations',
);

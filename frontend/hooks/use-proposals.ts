import useSWR from 'swr';
import { toast } from 'react-toastify';
import base_api from '@/lib/axios-config';
import { uploadFileToS3 } from '@/lib/upload-file';
import { mutate as globalMutate } from 'swr';
import type {
  AuditFlag,
  CreateProposalPayload,
  CreateProposalResponse,
  NotifyWinnerResponse,
  ProposalAttachmentsResponse,
  QuotationProposal,
  RecommendationResult,
  UploadProposalAttachmentResponse,
} from '@/types/quotation';

const BASE_URL = '/quotations';

const fetchProposals = async (url: string): Promise<QuotationProposal[]> => {
  const response = await base_api.get<{ items: QuotationProposal[]; total: number }>(url);
  return response.data.items;
};

export const useProposals = (quotationId: string | null) => {
  const key = quotationId ? `${BASE_URL}/${quotationId}/proposals` : null;

  const { data: proposals, error, mutate } = useSWR<QuotationProposal[]>(
    key,
    fetchProposals,
    { refreshInterval: 30000 },
  );

  return {
    proposals,
    isLoading: !!quotationId && !error && !proposals,
    isError: !!error,
    mutate,
  };
};

export const useProposalVersions = (quotationId: string | null, proposalId: string | null) => {
  const key =
    quotationId && proposalId
      ? `${BASE_URL}/${quotationId}/proposals/${proposalId}/versions`
      : null;

  const { data: versions, error, mutate } = useSWR<QuotationProposal[]>(
    key,
    async (url: string) => {
      const res = await base_api.get<{ items: QuotationProposal[]; total: number }>(url);
      return res.data.items;
    },
    { revalidateOnFocus: false },
  );

  return {
    versions,
    isLoading: !!(quotationId && proposalId) && !error && !versions,
    isError: !!error,
    mutate,
  };
};

const fetchProposal = async (url: string): Promise<QuotationProposal> => {
  const response = await base_api.get<{ proposal: QuotationProposal }>(url);
  return response.data.proposal;
};

export const useProposal = (
  quotationId: string | null,
  proposalId: string | null,
  poll = false,
) => {
  const key =
    quotationId && proposalId
      ? `${BASE_URL}/${quotationId}/proposals/${proposalId}`
      : null;

  const { data: proposal, error, mutate } = useSWR<QuotationProposal>(
    key,
    fetchProposal,
    {
      refreshInterval: poll ? 3000 : 0,
      revalidateOnFocus: false,
    },
  );

  return {
    proposal,
    isLoading: !!key && !error && !proposal,
    isError: !!error,
    mutate,
  };
};

export const triggerProposalExtraction = async (
  quotationId: string,
  proposalId: string,
): Promise<boolean> => {
  try {
    await base_api.post(`${BASE_URL}/${quotationId}/proposals/${proposalId}/extract`);
    return true;
  } catch {
    toast.error('Erro ao iniciar extração.');
    return false;
  }
};

export const createProposal = async (
  quotationId: string,
  payload: CreateProposalPayload,
): Promise<CreateProposalResponse | null> => {
  try {
    const response = await base_api.post<CreateProposalResponse>(
      `${BASE_URL}/${quotationId}/proposals`,
      payload,
    );
    globalMutate(`${BASE_URL}/${quotationId}/proposals`);
    globalMutate(`${BASE_URL}/${quotationId}`);
    globalMutate(`${BASE_URL}/kanban`);
    toast.success('Proposta registrada com sucesso!');
    return response.data;
  } catch {
    toast.error('Erro ao registrar proposta.');
    return null;
  }
};

export const updateProposal = async (
  quotationId: string,
  proposalId: string,
  payload: CreateProposalPayload,
): Promise<CreateProposalResponse | null> => {
  try {
    const response = await base_api.put<CreateProposalResponse>(
      `${BASE_URL}/${quotationId}/proposals/${proposalId}`,
      payload,
    );
    globalMutate(`${BASE_URL}/${quotationId}/proposals`);
    globalMutate(`${BASE_URL}/${quotationId}`);
    globalMutate(`${BASE_URL}/kanban`);
    toast.success('Proposta atualizada com sucesso!');
    return response.data;
  } catch {
    toast.error('Erro ao atualizar proposta.');
    return null;
  }
};

export const uploadProposalAttachment = async (
  quotationId: string,
  proposalId: string,
  file: File,
  isOriginalEmail = false,
  onProgress?: (percent: number) => void,
): Promise<boolean> => {
  try {
    const { data } = await base_api.post<UploadProposalAttachmentResponse>(
      `${BASE_URL}/${quotationId}/proposals/${proposalId}/upload`,
      { filename: file.name, is_original_email: isOriginalEmail },
    );
    return await uploadFileToS3(data.upload_url, file, onProgress);
  } catch {
    toast.error('Erro ao enviar anexo da proposta.');
    return false;
  }
};

export const fetchProposalAttachments = async (
  quotationId: string,
  proposalId: string,
): Promise<ProposalAttachmentsResponse | null> => {
  try {
    const { data } = await base_api.get<ProposalAttachmentsResponse>(
      `${BASE_URL}/${quotationId}/proposals/${proposalId}/attachments`,
    );
    return data;
  } catch {
    toast.error('Erro ao carregar anexos da proposta.');
    return null;
  }
};

export const fetchProposalFlags = async (
  quotationId: string,
  proposalId: string,
): Promise<AuditFlag[]> => {
  try {
    const { data } = await base_api.get<{ proposal: QuotationProposal; audit_flags: AuditFlag[] }>(
      `${BASE_URL}/${quotationId}/proposals/${proposalId}`,
    );
    return data.audit_flags;
  } catch {
    toast.error('Erro ao carregar flags de auditoria.');
    return [];
  }
};

export const resolveAuditFlag = async (
  quotationId: string,
  proposalId: string,
  flagId: string,
  justification?: string,
): Promise<AuditFlag | null> => {
  try {
    const { data } = await base_api.patch<{ audit_flag: AuditFlag }>(
      `${BASE_URL}/${quotationId}/proposals/${proposalId}/flags/${flagId}/resolve`,
      { justification },
    );
    globalMutate(`${BASE_URL}/${quotationId}/proposals`);
    globalMutate(`${BASE_URL}/${quotationId}/recommendation`);
    toast.success('Flag resolvida com sucesso!');
    return data.audit_flag;
  } catch {
    toast.error('Erro ao resolver flag.');
    return null;
  }
};

export const requestProposalReview = async (
  quotationId: string,
  proposalId: string,
  payload: { reason: string; fields_to_review?: string[] },
): Promise<boolean> => {
  try {
    await base_api.post(
      `${BASE_URL}/${quotationId}/proposals/${proposalId}/request-review`,
      payload,
    );
    globalMutate(`${BASE_URL}/${quotationId}/proposals`);
    globalMutate(`${BASE_URL}/${quotationId}/history`);
    toast.success('Revisao solicitada com sucesso!');
    return true;
  } catch {
    toast.error('Erro ao solicitar revisao.');
    return false;
  }
};

export const invalidateProposal = async (
  quotationId: string,
  proposalId: string,
  reason: string,
): Promise<boolean> => {
  try {
    await base_api.post(`${BASE_URL}/${quotationId}/proposals/${proposalId}/invalidate`, { reason });
    globalMutate(`${BASE_URL}/${quotationId}/proposals`);
    globalMutate(`${BASE_URL}/${quotationId}/recommendation`);
    globalMutate(`${BASE_URL}/${quotationId}/history`);
    toast.success('Proposta excluida com sucesso.');
    return true;
  } catch {
    toast.error('Erro ao excluir proposta.');
    return false;
  }
};

export interface NonWinnerAgent {
  id: string;
  name: string;
}

export interface SelectWinnerResult {
  success: boolean;
  non_winner_agents: NonWinnerAgent[];
}

export const selectWinner = async (
  quotationId: string,
  proposalId: string,
): Promise<SelectWinnerResult> => {
  try {
    const { data } = await base_api.post<{ non_winner_agents: NonWinnerAgent[] }>(
      `${BASE_URL}/${quotationId}/proposals/${proposalId}/select-winner`,
    );
    globalMutate(`${BASE_URL}/${quotationId}/proposals`);
    globalMutate(`${BASE_URL}/${quotationId}`);
    globalMutate(`${BASE_URL}/kanban`);
    toast.success('Proposta aprovada!');
    return { success: true, non_winner_agents: data.non_winner_agents ?? [] };
  } catch {
    toast.error('Erro ao aprovar proposta.');
    return { success: false, non_winner_agents: [] };
  }
};

export const notifyLosers = async (
  quotationId: string,
  agentIds: string[],
  messageBody: string,
): Promise<boolean> => {
  try {
    await base_api.post(`${BASE_URL}/${quotationId}/notify-losers`, {
      agent_ids: agentIds,
      message_body: messageBody,
    });
    globalMutate(`${BASE_URL}/${quotationId}/history`);
    toast.success('Agentes notificados com sucesso!');
    return true;
  } catch {
    toast.error('Erro ao notificar agentes.');
    return false;
  }
};

export interface NotifyWinnerResult {
  agentName: string;
  toEmails: string[];
  ccEmails: string[];
  droppedCc: string[];
  sentAt: string;
}

export const notifyWinner = async (
  quotationId: string,
  proposalId: string,
  messageBody?: string,
  ccEmails?: string[],
  attachProposalPdf?: boolean,
): Promise<NotifyWinnerResult | false> => {
  try {
    const payload: Record<string, unknown> = {};
    if (messageBody) payload.message_body = messageBody;
    if (ccEmails && ccEmails.length > 0) payload.cc_emails = ccEmails;
    if (attachProposalPdf) payload.attach_proposal_pdf = true;
    const { data } = await base_api.post<NotifyWinnerResponse>(
      `${BASE_URL}/${quotationId}/proposals/${proposalId}/notify-winner`,
      payload,
    );
    globalMutate(`${BASE_URL}/${quotationId}/history`);
    const item = data.notified?.[0];
    if (item?.status === 'failed') {
      toast.error('Falha ao enviar o e-mail de notificação. Tente novamente.');
      return false;
    }
    // The closing email auto-closes the quotation (APROVADA -> FECHADA), so
    // refresh the detail view and the kanban to reflect the new state.
    globalMutate(`${BASE_URL}/${quotationId}`);
    globalMutate(`${BASE_URL}/kanban`);
    const droppedCc = item?.dropped_cc ?? [];
    if (droppedCc.length > 0) {
      toast.warn(
        `E-mail enviado, mas alguns endereços em cópia foram recusados pelo servidor: ${droppedCc.join(', ')}`,
      );
    }
    return {
      agentName: item?.agent_name ?? '',
      toEmails: item?.to_emails ?? [],
      ccEmails: item?.cc_emails ?? [],
      droppedCc,
      sentAt: item?.sent_at ?? new Date().toISOString(),
    };
  } catch {
    toast.error('Erro ao notificar vencedor.');
    return false;
  }
};

export const useRecommendation = (quotationId: string | undefined) => {
  const { data, error, mutate } = useSWR<RecommendationResult>(
    quotationId ? `${BASE_URL}/${quotationId}/recommendation` : null,
    async (url: string) => {
      const res = await base_api.get<RecommendationResult>(url);
      return res.data;
    },
    { revalidateOnFocus: false },
  );
  return {
    recommendation: data,
    isLoading: !error && !data,
    isError: !!error,
    mutate,
  };
};

export const overrideRecommendation = async (
  quotationId: string,
  payload: { proposal_id: string; justification: string },
): Promise<boolean> => {
  try {
    await base_api.post(`${BASE_URL}/${quotationId}/recommendation/override`, payload);
    globalMutate(`${BASE_URL}/${quotationId}/recommendation`);
    toast.success('Recomendacao atualizada com sucesso.');
    return true;
  } catch {
    toast.error('Erro ao salvar override da recomendacao.');
    return false;
  }
};

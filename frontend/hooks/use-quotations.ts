import useSWR from 'swr';
import { toast } from 'react-toastify';
import base_api from '@/lib/axios-config';
import { createAction, triggerExtractionAction } from '@/lib/api-actions';
import { uploadFileToS3 } from '@/lib/upload-file';
import { useKanban } from '@/hooks/use-kanban';
import { mutate as globalMutate } from 'swr';
import type {
  AllowedTransitions,
  CotacaoAuditoria,
  CreateQuotationPayload,
  CreateQuotationResponse,
  DuplicateQuotationPayload,
  NotificationResult,
  Quotation,
  QuotationAttachment,
  QuotationFilters,
  QuotationKanban,
  QuotationLog,
  QuotationModal,
  TransitionPayload,
  TransitionResponse,
  UpdateQuotationPayload,
} from '@/types/quotation';

const BASE_URL = '/quotations';

// Shared by every transition whose response can include a best-effort
// per-agent notification result (CANCELADO, COTANDO reopen) — only the two
// message strings differ per caller.
const toastFromNotifications = (
  notifications: NotificationResult[],
  messages: { failed: (count: number) => string; sent: (count: number) => string },
) => {
  const failedCount = notifications.filter((n) => n.status === 'failed').length;
  const sentCount = notifications.filter((n) => n.status === 'sent').length;

  if (failedCount > 0) {
    toast.warning(messages.failed(failedCount));
  } else if (sentCount > 0) {
    toast.info(messages.sent(sentCount));
  }
};

const fetchQuotation = async (url: string): Promise<Quotation> => {
  const response = await base_api.get<{ quotation: Quotation }>(url);
  return response.data.quotation;
};

const buildQuotationsKey = (filters?: QuotationFilters): string => {
  if (!filters) return BASE_URL;
  const params = new URLSearchParams();
  if (filters.state) params.set('state', filters.state);
  if (filters.client_id) params.set('client_id', filters.client_id);
  if (filters.analyst_id) params.set('analyst', filters.analyst_id);
  if (filters.priority_min != null) params.set('priority_min', String(filters.priority_min));
  if (filters.search) params.set('search', filters.search);
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to) params.set('date_to', filters.date_to);
  const qs = params.toString();
  return qs ? `${BASE_URL}?${qs}` : BASE_URL;
};

const fetchQuotations = async (url: string): Promise<Quotation[]> => {
  const response = await base_api.get<{ items: Quotation[]; total: number }>(url);
  return response.data.items;
};

export const useQuotations = (filters?: QuotationFilters) => {
  const key = buildQuotationsKey(filters);

  const {
    data: quotations,
    error,
    mutate,
  } = useSWR<Quotation[]>(key, fetchQuotations);

  return {
    quotations,
    isLoading: !error && !quotations,
    isError: !!error,
    mutate,
  };
};

export const useQuotation = (
  id: string | null,
  pollWhileProcessing = false,
) => {
  const key = id ? `${BASE_URL}/${id}` : null;

  const {
    data: quotation,
    error,
    mutate,
  } = useSWR<Quotation>(key, fetchQuotation, {
    refreshInterval: pollWhileProcessing ? 3000 : 0,
    revalidateOnFocus: false,
  });

  return {
    quotation,
    isLoading: !!id && !error && !quotation,
    isError: !!error,
    mutate,
  };
};

export const createQuotation = createAction<CreateQuotationPayload, CreateQuotationResponse>(
  base_api,
  BASE_URL,
  'Erro ao criar cotação.',
);

export const useQuotationKanban = () => useKanban<QuotationKanban>(BASE_URL);

export const triggerQuotationExtraction = triggerExtractionAction(base_api, BASE_URL);

export const fetchAllowedTransitions = async (
  quotationId: string,
): Promise<AllowedTransitions | null> => {
  try {
    const response = await base_api.get<AllowedTransitions>(
      `${BASE_URL}/${quotationId}/allowed-transitions`,
    );
    return response.data;
  } catch {
    toast.error('Erro ao verificar transicoes permitidas.');
    return null;
  }
};

export const transitionQuotation = async (
  quotationId: string,
  payload: TransitionPayload,
): Promise<boolean> => {
  try {
    const { data } = await base_api.put<TransitionResponse>(`${BASE_URL}/${quotationId}/transition`, payload);
    globalMutate(`${BASE_URL}/kanban`);
    toast.success('Cotacao movida com sucesso!');

    if (payload.target_state === 'CANCELADO' && data.notifications) {
      toastFromNotifications(data.notifications, {
        failed: (count) => `Cotacao cancelada, mas falha ao notificar ${count} agente(s).`,
        sent: (count) => `${count} agente(s) notificado(s) do cancelamento.`,
      });
    }

    if (payload.target_state === 'COTANDO' && data.notifications) {
      toastFromNotifications(data.notifications, {
        failed: () => 'Cotacao reaberta, mas falha ao notificar o agente do fechamento anterior.',
        sent: () => 'Agente do fechamento anterior avisado de que o fechamento foi desfeito.',
      });
    }

    return true;
  } catch (err: unknown) {
    const error = err as { response?: { data?: { blocked_by?: string[] } } };
    const blockedBy = error?.response?.data?.blocked_by;
    if (blockedBy?.length) {
      toast.error(`Transicao bloqueada: ${blockedBy.join(', ')}`);
    } else {
      toast.error('Erro ao mover cotacao.');
    }
    return false;
  }
};

// Guard rail (ARB-2449): analyst release/block of a portal quotation held by the
// guard rail. Both revalidate the kanban so the badge/filter update immediately.
export const releaseGuardRail = async (quotationId: string): Promise<boolean> => {
  try {
    await base_api.post(`${BASE_URL}/${quotationId}/guard-rail/release`);
    globalMutate(`${BASE_URL}/kanban`);
    toast.success('Guard rail liberado. O cliente ja pode aprovar.');
    return true;
  } catch {
    toast.error('Erro ao liberar o guard rail.');
    return false;
  }
};

export const blockGuardRail = async (
  quotationId: string,
  reason: string,
): Promise<boolean> => {
  try {
    await base_api.post(`${BASE_URL}/${quotationId}/guard-rail/block`, { reason });
    globalMutate(`${BASE_URL}/kanban`);
    toast.success('Cotacao bloqueada e cliente notificado.');
    return true;
  } catch {
    toast.error('Erro ao bloquear o guard rail.');
    return false;
  }
};

const fetchLogs = async (url: string): Promise<QuotationLog[]> => {
  const response = await base_api.get<{ items: QuotationLog[]; total: number }>(url);
  return response.data.items;
};

export const useQuotationLogs = (quotationId: string | null) => {
  const key = quotationId ? `${BASE_URL}/${quotationId}/history` : null;

  const { data: logs, error, mutate } = useSWR<QuotationLog[]>(key, fetchLogs, {
    revalidateOnFocus: false,
  });

  return {
    logs: logs ?? [],
    isLoading: !!quotationId && !error && !logs,
    isError: !!error,
    mutate,
  };
};

export const fetchAttachments = async (
  quotationId: string,
): Promise<{ items: QuotationAttachment[]; email_body: string | null }> => {
  try {
    const response = await base_api.get<{ items: QuotationAttachment[]; email_body: string | null }>(
      `${BASE_URL}/${quotationId}/attachments`,
    );
    return { items: response.data.items, email_body: response.data.email_body };
  } catch {
    toast.error('Erro ao carregar anexos.');
    return { items: [], email_body: null };
  }
};

export const fetchOriginalEmailDownloadUrl = async (
  quotationId: string,
): Promise<string | null> => {
  try {
    const response = await base_api.get<{ download_url: string }>(
      `${BASE_URL}/${quotationId}/original-email`,
    );
    return response.data.download_url;
  } catch {
    toast.error('Erro ao obter link de download do email original.');
    return null;
  }
};

export const updateQuotation = async (
  quotationId: string,
  payload: UpdateQuotationPayload,
  silent = false,
): Promise<Quotation | null> => {
  try {
    const response = await base_api.put<{ quotation: Quotation }>(
      `${BASE_URL}/${quotationId}`,
      payload,
    );
    if (silent) {
      // Update cache with server response without triggering a refetch.
      // A full revalidation would run the field-sync useEffect and overwrite
      // any in-progress user input with stale server values.
      globalMutate(
        `${BASE_URL}/${quotationId}`,
        (current: Quotation | undefined) =>
          current ? { ...current, ...response.data.quotation } : response.data.quotation,
        { revalidate: false },
      );
    } else {
      globalMutate(`${BASE_URL}/${quotationId}`);
      toast.success('Cotação atualizada com sucesso!');
    }
    globalMutate(`${BASE_URL}/${quotationId}/extracted-data`);
    return response.data.quotation;
  } catch {
    if (!silent) toast.error('Erro ao atualizar cotação.');
    return null;
  }
};

export const addQuotationNote = async (
  quotationId: string,
  payload: { content: string; proposal_id?: string },
): Promise<boolean> => {
  try {
    await base_api.post(`${BASE_URL}/${quotationId}/notes`, payload);
    globalMutate(`${BASE_URL}/${quotationId}/history`);
    if (payload.proposal_id) {
      globalMutate(`${BASE_URL}/${quotationId}/proposals`);
    }
    toast.success('Nota adicionada com sucesso!');
    return true;
  } catch {
    toast.error('Erro ao adicionar nota.');
    return false;
  }
};

export const duplicateQuotation = async (
  quotationId: string,
  modal?: QuotationModal,
): Promise<Quotation | null> => {
  try {
    const payload: DuplicateQuotationPayload = {};
    if (modal) payload.modal = modal;
    const { data } = await base_api.post<{ quotation: Quotation }>(
      `${BASE_URL}/${quotationId}/duplicate`,
      payload,
    );
    globalMutate(`${BASE_URL}/kanban`);
    toast.success('Cotacao duplicada com sucesso!');
    return data.quotation;
  } catch {
    toast.error('Erro ao duplicar cotacao.');
    return null;
  }
};

export const recotacao = async (
  quotationId: string,
  motivo?: string,
): Promise<Quotation | null> => {
  try {
    const { data } = await base_api.post<{ quotation: Quotation }>(
      `${BASE_URL}/${quotationId}/recotacao`,
      { motivo: motivo || undefined },
    );
    globalMutate(`${BASE_URL}/kanban`);
    toast.success('Re-cotacao criada com sucesso!');
    return data.quotation;
  } catch {
    toast.error('Erro ao criar re-cotacao.');
    return null;
  }
};

export const addQuotationDocument = async (
  quotationId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<boolean> => {
  try {
    const { data } = await base_api.post<{ upload_url: string; s3_key: string; expires_in: number }>(
      `${BASE_URL}/${quotationId}/documents/upload-url`,
      { filename: file.name },
    );
    const uploaded = await uploadFileToS3(data.upload_url, file, onProgress);
    if (!uploaded) return false;
    globalMutate(`${BASE_URL}/${quotationId}/attachments`);
    return true;
  } catch {
    toast.error('Erro ao adicionar documento.');
    return false;
  }
};

export const deleteQuotationDocument = async (
  quotationId: string,
  filename: string,
): Promise<boolean> => {
  try {
    await base_api.delete(`${BASE_URL}/${quotationId}/documents`, { data: { filename } });
    globalMutate(`${BASE_URL}/${quotationId}/attachments`);
    toast.success('Documento excluido com sucesso.');
    return true;
  } catch {
    toast.error('Erro ao excluir documento.');
    return false;
  }
};

export const useQuotationAudit = (quotationId: string | null) => {
  const key = quotationId ? `${BASE_URL}/${quotationId}/audit` : null;
  const { data, error, mutate } = useSWR<{ items: CotacaoAuditoria[] }>(key, async (url: string) => {
    const res = await base_api.get<{ items: CotacaoAuditoria[] }>(url);
    return res.data;
  });
  return {
    records: data?.items ?? [],
    isLoading: !error && !data,
    isError: !!error,
    mutate,
  };
};

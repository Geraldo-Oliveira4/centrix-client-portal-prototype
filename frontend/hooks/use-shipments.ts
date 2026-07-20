import useSWR, { mutate as globalMutate } from 'swr';
import { toast } from 'react-toastify';
import base_api from '@/lib/axios-config';
import { useKanban } from '@/hooks/use-kanban';
import { uploadFileToS3 } from '@/lib/upload-file';
import type {
  BookingDetail,
  CreateFollowupPayload,
  CreateShipmentPayload,
  CreateShipmentResponse,
  EmbarqueDocumentosResponse,
  Followup,
  ShipmentDetail,
  ShipmentKanban,
  ShipmentModal,
  UpdateBookingPayload,
  UpdateShipmentPayload,
  UploadDocumentoPayload,
} from '@/types/shipment';

const BASE_URL = '/shipments';

interface ShipmentKanbanFilters {
  search?: string;
  modal?: ShipmentModal;
  cargaUrgente?: boolean;
}

// All filters are applied server-side: GET /shipments/kanban implements q,
// modal and carga_urgente (and validates them). The board renders whatever the
// endpoint returns, so the count and items stay correct even if the listing is
// paginated or limited in the future.
export const useShipmentKanban = ({ search, modal, cargaUrgente }: ShipmentKanbanFilters = {}) =>
  useKanban<ShipmentKanban>(BASE_URL, {
    search,
    modal,
    carga_urgente: cargaUrgente ? 'true' : undefined,
  });

const fetchShipment = async (url: string): Promise<ShipmentDetail> => {
  const response = await base_api.get<ShipmentDetail>(url);
  return response.data;
};

export const useShipment = (id: string | null) => {
  const key = id ? `${BASE_URL}/${id}` : null;

  const { data: shipment, error, mutate } = useSWR<ShipmentDetail>(
    key,
    fetchShipment,
    { revalidateOnFocus: false },
  );

  return {
    shipment,
    isLoading: !!id && !error && !shipment,
    isError: !!error,
    mutate,
  };
};

export const createShipment = async (
  payload: CreateShipmentPayload,
): Promise<CreateShipmentResponse | null> => {
  try {
    const response = await base_api.post<CreateShipmentResponse>(BASE_URL, payload);
    globalMutate(`${BASE_URL}/kanban`);
    toast.success('Embarque criado com sucesso!');
    return response.data;
  } catch {
    toast.error('Erro ao criar embarque.');
    return null;
  }
};

// ---- Booking (Dados de Frete) — ARB-2378 ----

const fetchBooking = async (url: string): Promise<BookingDetail | null> => {
  const response = await base_api.get<BookingDetail | null>(url);
  return response.data;
};

export const useShipmentBooking = (processId: string | null) => {
  const key = processId ? `${BASE_URL}/${processId}/booking` : null;
  const { data, error, mutate } = useSWR<BookingDetail | null>(key, fetchBooking, {
    revalidateOnFocus: false,
  });
  return {
    booking: data,
    isLoading: !!processId && data === undefined && !error,
    isError: !!error,
    mutate,
  };
};

export const updateShipmentBooking = async (
  processId: string,
  payload: UpdateBookingPayload,
  silent = false,
): Promise<BookingDetail | null> => {
  try {
    const response = await base_api.put<BookingDetail>(
      `${BASE_URL}/${processId}/booking`,
      payload,
    );
    if (silent) {
      globalMutate(
        `${BASE_URL}/${processId}/booking`,
        response.data,
        { revalidate: false },
      );
    } else {
      globalMutate(`${BASE_URL}/${processId}/booking`);
      toast.success('Dados de frete salvos!');
    }
    return response.data;
  } catch {
    if (!silent) toast.error('Erro ao salvar dados de frete.');
    return null;
  }
};

// ---- Followup (Ocorrencias) — ARB-2380 ----

const fetchFollowups = async (url: string): Promise<Followup[]> => {
  const response = await base_api.get<Followup[]>(url);
  return response.data;
};

export const useShipmentFollowups = (processId: string | null) => {
  const key = processId ? `${BASE_URL}/${processId}/followups` : null;
  const { data, error, mutate } = useSWR<Followup[]>(key, fetchFollowups, {
    revalidateOnFocus: false,
  });
  return {
    followups: data ?? [],
    isLoading: !!processId && !data && !error,
    isError: !!error,
    mutate,
  };
};

export const createFollowup = async (
  processId: string,
  payload: CreateFollowupPayload,
): Promise<Followup | null> => {
  try {
    const response = await base_api.post<Followup>(
      `${BASE_URL}/${processId}/followups`,
      payload,
    );
    globalMutate(`${BASE_URL}/${processId}/followups`);
    toast.success('Ocorrência registrada.');
    return response.data;
  } catch {
    toast.error('Erro ao registrar ocorrência.');
    return null;
  }
};

export const deleteFollowup = async (
  processId: string,
  followupId: string,
): Promise<boolean> => {
  try {
    await base_api.delete(`${BASE_URL}/${processId}/followups/${followupId}`);
    globalMutate(`${BASE_URL}/${processId}/followups`);
    toast.success('Ocorrência removida.');
    return true;
  } catch {
    toast.error('Erro ao remover ocorrência.');
    return false;
  }
};

// ---- Documentos Anexados — ARB-2379 ----

const fetchDocumentos = async (url: string): Promise<EmbarqueDocumentosResponse> => {
  const response = await base_api.get<EmbarqueDocumentosResponse>(url);
  return response.data;
};

export const useShipmentDocumentos = (processId: string | null) => {
  const key = processId ? `${BASE_URL}/${processId}/documentos` : null;
  const { data, error, mutate } = useSWR<EmbarqueDocumentosResponse>(key, fetchDocumentos, {
    revalidateOnFocus: false,
  });
  return {
    documentos: data?.items ?? [],
    tiposArquivo: data?.tipos_arquivo ?? { curated: [], outros: [] },
    isLoading: !!processId && !data && !error,
    isError: !!error,
    mutate,
  };
};

// Two-phase upload: presigned S3 PUT (raw axios, never base_api — see
// CLAUDE.md "S3 uploads"), then confirm to persist the record and trigger
// the best-effort Inova sync.
export const uploadShipmentDocumento = async (
  processId: string,
  file: File,
  payload: UploadDocumentoPayload,
  onProgress?: (percent: number) => void,
): Promise<boolean> => {
  try {
    const { data } = await base_api.post<{ upload_url: string; s3_key: string }>(
      `${BASE_URL}/${processId}/documentos/upload-url`,
      { filename: file.name },
    );
    const uploaded = await uploadFileToS3(data.upload_url, file, onProgress);
    if (!uploaded) return false;

    await base_api.post(`${BASE_URL}/${processId}/documentos/confirm`, {
      s3_key: data.s3_key,
      nome_arquivo: file.name,
      tipo_arquivo_label: payload.tipo_arquivo_label,
      tipo_arquivo_codigo: payload.tipo_arquivo_codigo,
      observacao: payload.observacao ?? null,
    });
    globalMutate(`${BASE_URL}/${processId}/documentos`);
    toast.success('Documento anexado com sucesso!');
    return true;
  } catch {
    toast.error('Erro ao anexar documento.');
    return false;
  }
};

export const deleteShipmentDocumento = async (
  processId: string,
  documentoId: string,
): Promise<boolean> => {
  try {
    await base_api.delete(`${BASE_URL}/${processId}/documentos/${documentoId}`);
    globalMutate(`${BASE_URL}/${processId}/documentos`);
    toast.success('Documento removido.');
    return true;
  } catch {
    toast.error('Erro ao remover documento.');
    return false;
  }
};

export const updateShipment = async (
  id: string,
  payload: UpdateShipmentPayload,
  silent = false,
): Promise<ShipmentDetail | null> => {
  try {
    const response = await base_api.put<ShipmentDetail>(`${BASE_URL}/${id}`, payload);
    if (silent) {
      // Update the cache with the server response without triggering a refetch,
      // so in-progress user input is not overwritten by a revalidation.
      globalMutate(
        `${BASE_URL}/${id}`,
        (current: ShipmentDetail | undefined) =>
          current ? { ...current, ...response.data } : response.data,
        { revalidate: false },
      );
    } else {
      globalMutate(`${BASE_URL}/${id}`);
      globalMutate(`${BASE_URL}/kanban`);
      toast.success('Embarque atualizado com sucesso!');
    }
    return response.data;
  } catch {
    if (!silent) toast.error('Erro ao atualizar embarque.');
    return null;
  }
};

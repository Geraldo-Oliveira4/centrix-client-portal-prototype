import useSWR from 'swr';
import { toast } from 'react-toastify';
import base_api from '@/lib/axios-config';
import { mutate as globalMutate } from 'swr';
import type {
  GenerateClientLinkPayload,
  GenerateClientLinkResponse,
  QuotationClientLink,
  SendClientLinkPayload,
  SendClientLinkResponse,
} from '@/types/quotation';

const BASE_URL = '/quotations';

export const useClientLinks = (quotationId: string | null) => {
  const key = quotationId ? `${BASE_URL}/${quotationId}/client-links` : null;
  const { data, error, mutate } = useSWR<{ items: QuotationClientLink[] }>(key, async (url: string) => {
    const res = await base_api.get<{ items: QuotationClientLink[] }>(url);
    return res.data;
  });
  return {
    links: data?.items ?? [],
    isLoading: !error && !data,
    isError: !!error,
    mutate,
  };
};

export const generateClientLink = async (
  quotationId: string,
  payload: GenerateClientLinkPayload,
): Promise<GenerateClientLinkResponse | null> => {
  try {
    const { data } = await base_api.post<GenerateClientLinkResponse>(
      `${BASE_URL}/${quotationId}/client-link`,
      payload,
    );
    globalMutate(`${BASE_URL}/${quotationId}/client-links`);
    return data;
  } catch {
    toast.error('Erro ao gerar link para o cliente.');
    return null;
  }
};

export const sendClientLink = async (
  quotationId: string,
  payload: SendClientLinkPayload,
): Promise<SendClientLinkResponse | null> => {
  try {
    const { data } = await base_api.post<SendClientLinkResponse>(
      `${BASE_URL}/${quotationId}/client-link/send`,
      payload,
    );
    globalMutate(`${BASE_URL}/${quotationId}/client-links`);
    toast.success(`Link enviado para ${data.recipient}`);
    return data;
  } catch {
    toast.error('Erro ao enviar link para o cliente.');
    return null;
  }
};

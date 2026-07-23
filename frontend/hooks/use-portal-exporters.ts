// Client Portal exporters. Mirrors hooks/use-exporters.ts (the analyst
// catalogue) but hits the portal-scoped routes through portal_api, so the list
// only ever contains exporters this client registered themselves.
//
// Self-service is create + list only: the portal has no update/delete endpoint,
// because editing or removing an exporter that is already linked to quotations
// is an analyst decision (see backend/lambdas/client_portal/*_exporter*).

import useSWR, { mutate as globalMutate } from 'swr';
import { toast } from 'react-toastify';
import axios from 'axios';
import portal_api from '@/lib/portal-api';
import type { CreateExporterPayload, Exporter } from '@/types/exporter';

const BASE_URL = '/portal/exporters';

const fetcher = async (url: string): Promise<Exporter[]> => {
  const response = await portal_api.get<{ items: Exporter[]; total: number }>(url);
  return response.data.items;
};

export const useMyExporters = () => {
  const { data, error, mutate } = useSWR<Exporter[]>(BASE_URL, fetcher);
  return {
    exporters: data ?? [],
    isLoading: !error && !data,
    isError: !!error,
    mutate,
  };
};

/**
 * Register an exporter owned by the logged-in client. Returns the created
 * exporter, or null when the request failed. A 409 (duplicate name for this
 * client) gets its own message so the user knows to pick the existing entry
 * from the selector instead of retrying.
 */
export const createMyExporter = async (
  payload: CreateExporterPayload,
): Promise<Exporter | null> => {
  try {
    const response = await portal_api.post<{ exporter: Exporter }>(
      BASE_URL,
      payload,
    );
    globalMutate(BASE_URL);
    toast.success('Exportador cadastrado com sucesso!');
    return response.data.exporter;
  } catch (err) {
    const status = axios.isAxiosError(err) ? err.response?.status : null;
    const data = axios.isAxiosError(err) ? err.response?.data : null;

    if (status === 409) {
      toast.error('Voce ja tem um exportador cadastrado com esse nome.');
    } else if (status === 400 && typeof data?.error === 'string') {
      toast.error(data.error);
    } else {
      toast.error('Erro ao cadastrar exportador.');
    }
    return null;
  }
};

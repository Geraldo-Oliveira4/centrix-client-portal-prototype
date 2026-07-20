import useSWR, { mutate as globalMutate } from 'swr';
import { toast } from 'react-toastify';
import axios from 'axios';
import base_api from '@/lib/axios-config';
import {
  BulkUpdateDnaPayload,
  BulkUpdateDnaResult,
  ClientDna,
  CreateClientPayload,
  QuotationClient,
  ServiceType,
  UpdateClientPayload,
  UpdateDnaPayload,
} from '@/types/client';

const BASE_URL = '/clients';

const fetcher = async () => {
  const response = await base_api.get<{ items: QuotationClient[]; total: number }>(BASE_URL);
  return response.data.items;
};

export const useClients = () => {
  const { data: clients, error } = useSWR<QuotationClient[]>(BASE_URL, fetcher);

  const createClient = async (payload: CreateClientPayload): Promise<QuotationClient | null> => {
    try {
      const response = await base_api.post<{ client: QuotationClient }>(BASE_URL, payload);
      globalMutate(BASE_URL);
      toast.success('Cliente cadastrado com sucesso!');
      return response.data.client;
    } catch {
      toast.error('Erro ao cadastrar cliente.');
      return null;
    }
  };

  const updateClient = async (
    clientId: string,
    payload: UpdateClientPayload,
  ): Promise<QuotationClient | null> => {
    try {
      const response = await base_api.put<{ client: QuotationClient }>(
        `${BASE_URL}/${clientId}`,
        payload,
      );
      globalMutate(BASE_URL);
      globalMutate(`${BASE_URL}/${clientId}`);
      toast.success('Cliente atualizado com sucesso!');
      return response.data.client;
    } catch {
      toast.error('Erro ao atualizar cliente.');
      return null;
    }
  };

  const updateDna = async (
    clientId: string,
    serviceType: ServiceType,
    payload: UpdateDnaPayload,
  ): Promise<boolean> => {
    try {
      await base_api.put(`${BASE_URL}/${clientId}/dna`, {
        ...payload,
        service_type: serviceType,
      });
      globalMutate(BASE_URL);
      globalMutate(`${BASE_URL}/${clientId}`);
      globalMutate(`${BASE_URL}/${clientId}/dna`);
      toast.success('DNA atualizado com sucesso!');
      return true;
    } catch {
      toast.error('Erro ao atualizar DNA.');
      return false;
    }
  };

  const bulkUpdateDna = async (payload: BulkUpdateDnaPayload): Promise<boolean> => {
    try {
      const response = await base_api.patch<BulkUpdateDnaResult>(
        `${BASE_URL}/dna/bulk`,
        payload,
      );
      globalMutate(BASE_URL);
      payload.client_ids.forEach((id) => {
        globalMutate(`${BASE_URL}/${id}`);
        globalMutate(`${BASE_URL}/${id}/dna`);
      });
      const { updated_count, skipped_count, failed_count } = response.data;
      if (failed_count > 0) {
        toast.warning(
          `DNA atualizado em ${updated_count} cliente(s), mas ${failed_count} falharam inesperadamente. Tente novamente para os que falharam.`,
        );
      } else {
        toast.success(
          skipped_count > 0
            ? `DNA atualizado em ${updated_count} cliente(s). ${skipped_count} sem DNA foram ignorados.`
            : `DNA atualizado em ${updated_count} cliente(s).`,
        );
      }
      return true;
    } catch {
      toast.error('Erro ao atualizar DNA em massa.');
      return false;
    }
  };

  const getClientWithDna = async (clientId: string): Promise<QuotationClient | null> => {
    try {
      const response = await base_api.get<{ client: QuotationClient }>(
        `${BASE_URL}/${clientId}`,
      );
      return response.data.client;
    } catch {
      toast.error('Erro ao carregar dados do cliente.');
      return null;
    }
  };

  const deleteClient = async (clientId: string): Promise<boolean> => {
    try {
      await base_api.delete(`${BASE_URL}/${clientId}`);
      globalMutate(BASE_URL);
      globalMutate(`${BASE_URL}/${clientId}`, undefined, { revalidate: false });
      globalMutate(`${BASE_URL}/${clientId}/dna`, undefined, { revalidate: false });
      toast.success('Cliente excluído com sucesso.');
      return true;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        const count: number | undefined = err.response.data?.quotation_count;
        toast.error(
          count
            ? `Este cliente possui ${count} cotação(ões) vinculada(s) e não pode ser excluído.`
            : 'Este cliente possui cotações vinculadas e não pode ser excluído.',
          { autoClose: 7000 },
        );
      } else {
        toast.error('Erro ao excluir cliente.');
      }
      return false;
    }
  };

  return {
    clients,
    isLoading: !error && !clients,
    isError: !!error,
    createClient,
    updateClient,
    updateDna,
    bulkUpdateDna,
    getClientWithDna,
    deleteClient,
  };
};

const fetchDnas = async (url: string): Promise<ClientDna[]> => {
  const response = await base_api.get<{ dnas: ClientDna[] }>(url);
  return response.data.dnas;
};

export const useClientDNA = (clientId: string | null) => {
  const key = clientId ? `${BASE_URL}/${clientId}/dna` : null;

  const { data: dnas, error, mutate } = useSWR<ClientDna[]>(key, fetchDnas, {
    revalidateOnFocus: false,
  });

  return {
    dnas,
    isLoading: !!clientId && !error && !dnas,
    isError: !!error,
    mutate,
  };
};

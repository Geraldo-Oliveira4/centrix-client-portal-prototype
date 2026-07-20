import useSWR, { mutate as globalMutate } from 'swr';
import { toast } from 'react-toastify';
import base_api from '@/lib/axios-config';
import {
  CreateExporterPayload,
  Exporter,
  UpdateExporterPayload,
} from '@/types/exporter';

const BASE_URL = '/exporters';

const fetcher = async () => {
  const response = await base_api.get<{ items: Exporter[]; total: number }>(BASE_URL);
  return response.data.items;
};

export const useExporters = () => {
  const { data: exporters, error } = useSWR<Exporter[]>(BASE_URL, fetcher);

  const createExporter = async (
    payload: CreateExporterPayload,
  ): Promise<Exporter | null> => {
    try {
      const response = await base_api.post<{ exporter: Exporter }>(BASE_URL, payload);
      globalMutate(BASE_URL);
      toast.success('Exportador cadastrado com sucesso!');
      return response.data.exporter;
    } catch {
      toast.error('Erro ao cadastrar exportador.');
      return null;
    }
  };

  const updateExporter = async (
    exporterId: string,
    payload: UpdateExporterPayload,
  ): Promise<Exporter | null> => {
    try {
      const response = await base_api.put<{ exporter: Exporter }>(
        `${BASE_URL}/${exporterId}`,
        payload,
      );
      globalMutate(BASE_URL);
      toast.success('Exportador atualizado com sucesso!');
      return response.data.exporter;
    } catch {
      toast.error('Erro ao atualizar exportador.');
      return null;
    }
  };

  const getExporter = async (exporterId: string): Promise<Exporter | null> => {
    try {
      const response = await base_api.get<{ exporter: Exporter }>(
        `${BASE_URL}/${exporterId}`,
      );
      return response.data.exporter;
    } catch {
      toast.error('Erro ao carregar dados do exportador.');
      return null;
    }
  };

  const deleteExporter = async (exporterId: string): Promise<boolean> => {
    try {
      await base_api.delete(`${BASE_URL}/${exporterId}`);
      globalMutate(BASE_URL);
      toast.success('Exportador excluido com sucesso!');
      return true;
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        toast.error('Exportador possui cotacoes vinculadas e nao pode ser excluido.');
      } else {
        toast.error('Erro ao excluir exportador.');
      }
      return false;
    }
  };

  return {
    exporters,
    isLoading: !error && !exporters,
    isError: !!error,
    createExporter,
    updateExporter,
    getExporter,
    deleteExporter,
  };
};

import useSWR, { mutate as globalMutate } from 'swr';
import { toast } from 'react-toastify';
import axios from 'axios';
import base_api from '@/lib/axios-config';
import { CreatePortalContactPayload, PortalContact } from '@/types/client';

const BASE_URL = '/clients';

const fetchPortalContacts = async (url: string): Promise<PortalContact[]> => {
  const response = await base_api.get<PortalContact[]>(url);
  return response.data;
};

export const usePortalContacts = (clientId: string | null) => {
  const key = clientId ? `${BASE_URL}/${clientId}/portal-contacts` : null;
  const { data, error, mutate } = useSWR<PortalContact[]>(key, fetchPortalContacts, {
    revalidateOnFocus: false,
  });
  return {
    contacts: data ?? [],
    isLoading: !!clientId && !data && !error,
    isError: !!error,
    mutate,
  };
};

export const addPortalContact = async (
  clientId: string,
  payload: CreatePortalContactPayload,
): Promise<PortalContact | null> => {
  try {
    const response = await base_api.post<PortalContact>(
      `${BASE_URL}/${clientId}/portal-contacts`,
      payload,
    );
    globalMutate(`${BASE_URL}/${clientId}/portal-contacts`);
    toast.success('Acesso ao portal adicionado.');
    return response.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 409) {
      toast.error('Este e-mail já está cadastrado como acesso ao portal.');
    } else {
      toast.error('Erro ao adicionar acesso ao portal.');
    }
    return null;
  }
};

export const deletePortalContact = async (
  clientId: string,
  contactId: string,
): Promise<boolean> => {
  try {
    await base_api.delete(`${BASE_URL}/${clientId}/portal-contacts/${contactId}`);
    globalMutate(`${BASE_URL}/${clientId}/portal-contacts`);
    toast.success('Acesso ao portal removido.');
    return true;
  } catch {
    toast.error('Erro ao remover acesso ao portal.');
    return false;
  }
};

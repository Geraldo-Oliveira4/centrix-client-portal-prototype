import useSWR, { mutate } from 'swr';
import { toast } from 'react-toastify';
import { CentrixPreRegisteredUser } from '@/types/centrix-user';
import base_api from '@/lib/axios-config';

const BASE_URL = '/get-pre-registered-users';

const fetcher = async () => {
  const response = await base_api.get(BASE_URL);
  return response.data;
};

export const usePreRegisteredUsers = () => {
  const { data: users, error } = useSWR<CentrixPreRegisteredUser[]>(
    BASE_URL,
    fetcher,
  );

  const addUser = async (newUsers: CentrixPreRegisteredUser[]) => {
    const request = { users: newUsers };
    try {
      await base_api.post('/add-pre-registered-user', request);
      mutate(BASE_URL);
      toast.success('Usuário adicionado com sucesso!');
    } catch {
      toast.error('Erro ao adicionar usuário.');
    }
  };

  const deleteUser = async (userLogins: string[]) => {
    const request = { emails: userLogins };
    try {
      await base_api.post('/delete-pre-registered-user', request);
      mutate(BASE_URL);
      toast.success('Usuário excluído com sucesso!');
    } catch {
      toast.error('Erro ao excluir usuário.');
    }
  };

  return {
    users,
    isLoading: !error && !users,
    isError: !!error,
    addUser,
    deleteUser,
  };
};

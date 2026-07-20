import useSWR, { mutate } from 'swr';
import { toast } from 'react-toastify';
import { CentrixUser } from '@/types/centrix-user';
import base_api from '@/lib/axios-config';
import { UserAddViewModel } from '@/types/user-viewmodel';

const BASE_URL = '/get-users';

const fetcher = async () => {
  const response = await base_api.get(BASE_URL);
  return response.data;
};

export const useUsers = () => {
  const { data: users, error } = useSWR<CentrixUser[]>(BASE_URL, fetcher);

  const addUser = async (newUser: UserAddViewModel) => {
    try {
      await base_api.post(BASE_URL, newUser);
      mutate(BASE_URL);
      toast.success('Usuário adicionado com sucesso!');
    } catch {
      toast.error('Erro ao adicionar usuário.');
    }
  };

  const deleteUser = async (userLogin: string) => {
    const request = { email: userLogin };
    try {
      await base_api.post('/delete-user', request);
      mutate(BASE_URL);
      toast.success('Usuário excluído com sucesso!');
    } catch {
      toast.error('Erro ao excluir usuário.');
    }
  };

  const toggleUserRole = async (email: string) => {
    const request = { email };
    try {
      const response = await base_api.post('/role-toggle', request);
      mutate(BASE_URL);
      const newRole = response.data.newRole;
      toast.success(`Função do usuário alterada para ${newRole} com sucesso!`);
    } catch {
      toast.error('Erro ao alterar função do usuário.');
    }
  };

  return {
    users,
    isLoading: !error && !users,
    isError: !!error,
    addUser,
    deleteUser,
    toggleUserRole,
  };
};

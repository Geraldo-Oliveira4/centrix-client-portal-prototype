'use client';

import { useState } from 'react';
import { Roles } from '@arboria-tech/arboria-ui';
import base_api from '@/lib/axios-config';
import { toast } from 'react-toastify';
import { mutate } from 'swr';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';

interface RoleSelectorProps {
  userEmail: string;
  currentRole: string;
}

export function RoleSelector({ userEmail, currentRole }: RoleSelectorProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleRoleChange = async (newRole: string) => {
    if (newRole === currentRole) return;

    setIsUpdating(true);
    try {
      await base_api.post('/role-toggle', {
        email: userEmail,
      });

      toast.success(`Role alterado para ${newRole}`);
      mutate('/get-users'); // Revalidate users data
    } catch (error: any) {
      console.error('Erro ao alterar role:', error);
      toast.error(error.response?.data?.error || 'Erro ao alterar role');
    } finally {
      setIsUpdating(false);
    }
  };

  const availableRoles = [Roles.Admin, Roles.User];

  return (
    <Select
      value={currentRole}
      onValueChange={handleRoleChange}
      disabled={isUpdating}
    >
      <SelectTrigger className="w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {availableRoles.map((role) => (
          <SelectItem key={role} value={role}>
            {role === Roles.Admin && 'Admin'}
            {role === Roles.User && 'User'}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

'use client';

import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown, Calendar, Mail, User, UserCheck } from 'lucide-react';
import { CentrixUser } from '@/types/centrix-user';
import { UserActionCell } from './user-action-cell';
import { RoleSelector } from './role-selector';
import { Button } from '@/components/ui';

const formatDate = (value: string | null | undefined) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const columns: ColumnDef<CentrixUser>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Nome
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    meta: {
      mobileHeader: <User className="w-6 h-6 mr-3" />,
    },
    cell: ({ row }) => (
      <div className="whitespace-nowrap">{row.getValue('name')}</div>
    ),
  },
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ row }) => (
      <div className="whitespace-nowrap">{row.getValue('email')}</div>
    ),
    meta: {
      mobileHeader: <Mail className="w-6 h-6 mr-3" />,
    },
  },
  {
    accessorKey: 'roles',
    header: 'Funções',
    cell: ({ row }) => {
      const user = row.original;
      const currentRole = user.roles[0] || 'user';
      return <RoleSelector userEmail={user.email} currentRole={currentRole} />;
    },
    meta: {
      mobileHeader: <UserCheck className="w-6 h-6 mr-3" />,
    },
  },
  {
    accessorKey: 'created_at',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Data de Criação
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    sortingFn: 'datetime',
    cell: ({ row }) => (
      <div className="whitespace-nowrap">{formatDate(row.getValue('created_at'))}</div>
    ),
    meta: {
      mobileHeader: <Calendar className="w-6 h-6 mr-3" />,
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const user = row.original;
      return <UserActionCell user={user} />;
    },
  },
];

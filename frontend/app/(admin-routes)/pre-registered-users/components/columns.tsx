'use client';

import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown, Mail, User, UserCheck } from 'lucide-react';
import { CentrixPreRegisteredUser } from '@/types/centrix-user';
import { UserActionCell } from './user-action-cell';
import { Button } from '@/components/ui';

export const columns: ColumnDef<CentrixPreRegisteredUser>[] = [
  {
    accessorKey: 'email',
    header: 'Email',
    meta: {
      mobileHeader: <Mail className="w-6 h-6 mr-3" />,
    },
  },
  {
    accessorKey: 'role',
    header: 'Funções',
    meta: {
      mobileHeader: <UserCheck className="w-6 h-6 mr-3" />,
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

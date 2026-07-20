'use client';

import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown, Mail, MessageSquare, Truck } from 'lucide-react';
import { Button } from '@/components/ui';
import { FreightAgent } from '@/types/freight-agent';
import { ScoreBadge } from './score-badge';

export const columns: ColumnDef<FreightAgent>[] = [
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
    meta: { mobileHeader: <Truck className="w-6 h-6 mr-3" /> },
    cell: ({ row }) => (
      <span className="font-medium whitespace-nowrap">{row.getValue('name')}</span>
    ),
  },
  {
    accessorKey: 'email',
    header: 'Email',
    meta: { mobileHeader: <Mail className="w-6 h-6 mr-3" /> },
    cell: ({ row }) => (
      <span className="text-muted-foreground whitespace-nowrap">{row.getValue('email')}</span>
    ),
  },
  {
    accessorKey: 'preferred_channel',
    header: 'Canal',
    meta: { mobileHeader: <MessageSquare className="w-6 h-6 mr-3" /> },
    cell: ({ row }) => (
      <span className="text-muted-foreground capitalize">
        {row.getValue('preferred_channel') ?? '—'}
      </span>
    ),
  },
  {
    accessorKey: 'reliability_score',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Score
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <ScoreBadge score={row.getValue('reliability_score')} showBar />
    ),
  },
  {
    accessorKey: 'total_quotations',
    header: 'Cotações',
    meta: { mobileHidden: true },
    cell: ({ row }) => (
      <span className="text-muted-foreground tabular-nums">
        {row.getValue('total_quotations')}
      </span>
    ),
  },
  {
    accessorKey: 'error_count',
    header: 'Erros',
    meta: { mobileHidden: true },
    cell: ({ row }) => {
      const errors: number = row.getValue('error_count');
      return (
        <span className={errors > 0 ? 'text-red-600 dark:text-red-400 font-medium tabular-nums' : 'text-muted-foreground tabular-nums'}>
          {errors}
        </span>
      );
    },
  },
];

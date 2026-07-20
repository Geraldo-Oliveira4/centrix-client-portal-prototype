'use client';

import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown, Building2, Mail, ShieldAlert } from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import { CARGO_PROFILE_LABELS, Exporter, ExporterCargoProfile } from '@/types/exporter';

export const columns: ColumnDef<Exporter>[] = [
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
    meta: { mobileHeader: <Building2 className="w-6 h-6 mr-3" /> },
    cell: ({ row }) => (
      <span className="font-medium whitespace-nowrap">{row.getValue('name')}</span>
    ),
  },
  {
    accessorKey: 'endereco',
    header: 'Endereço',
    meta: { mobileHidden: true },
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.getValue('endereco') ?? '—'}</span>
    ),
  },
  {
    accessorKey: 'contact_email',
    header: 'Email de Contato',
    meta: { mobileHeader: <Mail className="w-6 h-6 mr-3" /> },
    cell: ({ row }) => (
      <span className="text-muted-foreground whitespace-nowrap">
        {row.getValue('contact_email') ?? '—'}
      </span>
    ),
  },
  {
    accessorKey: 'cargo_profile',
    header: 'Perfil de Carga',
    cell: ({ row }) => {
      const profile = row.getValue('cargo_profile') as ExporterCargoProfile;
      return profile === 'PERIGOSA' ? (
        <Badge className="gap-1 bg-orange-100 text-orange-700 border border-orange-300 dark:bg-orange-900/30 dark:text-orange-400">
          <ShieldAlert className="w-3 h-3" />
          {CARGO_PROFILE_LABELS[profile]}
        </Badge>
      ) : (
        <span className="text-muted-foreground">{CARGO_PROFILE_LABELS[profile] ?? profile}</span>
      );
    },
  },
];

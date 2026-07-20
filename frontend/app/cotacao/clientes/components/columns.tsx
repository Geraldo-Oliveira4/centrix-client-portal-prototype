'use client';

import { ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, ArrowUpDown, Building, Mail } from 'lucide-react';
import { Badge, Button, Checkbox } from '@/components/ui';
import { QuotationClient } from '@/types/client';

export const columns: ColumnDef<QuotationClient>[] = [
  {
    id: 'select',
    enableSorting: false,
    enableHiding: false,
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Selecionar todos"
      />
    ),
    cell: ({ row }) => (
      // Stop propagation so toggling selection does not open the client modal.
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Selecionar linha"
        />
      </div>
    ),
    meta: { mobileHidden: true },
  },
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
    meta: { mobileHeader: <Building className="w-6 h-6 mr-3" /> },
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="font-medium whitespace-nowrap">{row.getValue('name')}</span>
        {row.original.is_vip && (
          <Badge className="gap-1 bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-400">
            <AlertTriangle className="w-3 h-3" />
            Crítico
          </Badge>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'sector',
    header: 'Setor',
    meta: { mobileHeader: <Building className="w-6 h-6 mr-3" /> },
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.getValue('sector') ?? '—'}</span>
    ),
  },
  {
    accessorKey: 'email',
    header: 'Email',
    meta: { mobileHeader: <Mail className="w-6 h-6 mr-3" /> },
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-muted-foreground">{row.getValue('email')}</span>
    ),
  },
];

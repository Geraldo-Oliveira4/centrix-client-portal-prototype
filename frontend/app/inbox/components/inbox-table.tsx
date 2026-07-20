'use client';

import React, { useState } from 'react';
import {
  flexRender,
  SortingState,
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getExpandedRowModel,
  ExpandedState,
} from '@tanstack/react-table';
import {
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ExpandedQuotationDetail } from './expanded-quotation-detail';
import { columns } from './columns';
import type { Quotation } from '@/types/quotation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';

interface CollapsibleSectionProps {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
  variant?: 'action' | 'waiting';
}

function CollapsibleSection({
  title,
  count,
  defaultOpen = true,
  children,
  variant = 'action',
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  const headerColor =
    variant === 'action'
      ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
      : 'bg-cyan-50 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-800';

  const countColor =
    variant === 'action'
      ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
      : 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300';

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 border-b transition-colors',
          headerColor,
        )}
      >
        <div className="flex items-center gap-3">
          {open ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          <span className="text-sm font-semibold">{title}</span>
          <span
            className={cn(
              'text-xs font-bold px-2 py-0.5 rounded-full',
              countColor,
            )}
          >
            {count}
          </span>
        </div>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

interface SectionTableProps {
  data: Quotation[];
  onRefresh?: () => void;
}

function SectionTable({ data, onRefresh }: SectionTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'priority_score', desc: true },
  ]);
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const table = useReactTable({
    data,
    columns,
    state: { sorting, expanded },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        Nenhuma cotacao nesta secao.
      </div>
    );
  }

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <React.Fragment key={row.id}>
                <TableRow
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => row.toggleExpanded()}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {cell.column.id === 'expander' ? (
                        <div className="p-1">
                          {row.getIsExpanded() ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </div>
                      ) : (
                        flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )
                      )}
                    </TableCell>
                  ))}
                </TableRow>
                {row.getIsExpanded() && (
                  <tr>
                    <td colSpan={columns.length}>
                      <ExpandedQuotationDetail quotation={row.original} onClientLinked={onRefresh} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile */}
      <div className="block md:hidden space-y-3 p-3">
        {table.getRowModel().rows.map((row) => (
          <div
            key={row.id}
            className="border rounded-md p-4 relative bg-background"
            onClick={() => row.toggleExpanded()}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <span className="text-sm font-semibold">
                  {row.original.reference}
                </span>
                {row.original.client?.name && (
                  <p className="text-xs text-muted-foreground">
                    {row.original.client.name}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {row.getIsExpanded() ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {row.original.origin && (row.original.porto_destino?.length || row.original.aeroporto_destino?.length) && (
                <span className="text-xs text-muted-foreground">
                  {row.original.origin} → {row.original.porto_destino?.join(', ') || row.original.aeroporto_destino?.join(', ')}
                </span>
              )}
            </div>
            {row.getIsExpanded() && (
              <div className="mt-3 pt-3 border-t">
                <ExpandedQuotationDetail quotation={row.original} onClientLinked={onRefresh} />
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

interface InboxTableProps {
  quotations: Quotation[];
  onRefresh?: () => void;
}

// States that require analyst action
const ACTION_STATES = new Set([
  'TRIAGEM_IA',
  'AGUARDANDO_DADOS',
  'COTANDO',
  'PARA_ANALISE',
  'REVISAO_AGENTE',
]);

// States waiting on client
const WAITING_STATES = new Set(['ENVIADA_CLIENTE']);

export function InboxTable({ quotations, onRefresh }: InboxTableProps) {
  const actionItems = quotations.filter((q) => ACTION_STATES.has(q.state));
  const waitingItems = quotations.filter((q) => WAITING_STATES.has(q.state));

  return (
    <div className="flex flex-col gap-4">
      <CollapsibleSection
        title="Exige Acao"
        count={actionItems.length}
        defaultOpen={true}
        variant="action"
      >
        <SectionTable data={actionItems} onRefresh={onRefresh} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Aguardando Retorno do Cliente"
        count={waitingItems.length}
        defaultOpen={waitingItems.length > 0}
        variant="waiting"
      >
        <SectionTable data={waitingItems} onRefresh={onRefresh} />
      </CollapsibleSection>
    </div>
  );
}

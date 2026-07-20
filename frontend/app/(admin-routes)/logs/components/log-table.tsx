'use client';

import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { useState } from 'react';
import {
  flexRender,
  SortingState,
  ColumnFiltersState,
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getExpandedRowModel,
  ExpandedState,
  Row,
} from '@tanstack/react-table';

import {
  Printer,
  Search,
  ChevronDown,
  ChevronRight,
  Expand,
} from 'lucide-react';
import { LogEntry } from '@/types/log';
import { CustomColumnDef } from '@/types/table';
import { ExpandedDetails } from './expanded-details';
import {
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';

interface LogTableProps {
  data: LogEntry[];
  columns: CustomColumnDef<LogEntry>[];
  enableFiltering?: boolean;
}

export function LogTable({
  data,
  columns,
  enableFiltering = false,
}: LogTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    {
      id: 'timestamp',
      desc: true,
    },
  ]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>({});

  // Função personalizada de filtragem global que inclui os detalhes
  const globalFilterFn = (
    row: Row<LogEntry>,
    columnId: string,
    filterValue: string,
  ) => {
    const searchValue = filterValue.toLowerCase();

    // Verifica o valor da coluna atual
    const value = row.getValue(columnId);
    if (value && String(value).toLowerCase().includes(searchValue)) {
      return true;
    }

    // Se não encontrou nas colunas normais, procura nos detalhes
    const details = row.original.details;
    if (details) {
      const detailsString = JSON.stringify(details).toLowerCase();
      if (detailsString.includes(searchValue)) {
        return true;
      }
    }

    // Procura também na mensagem (sempre presente)
    const message = row.original.message;
    if (message && message.toLowerCase().includes(searchValue)) {
      return true;
    }

    return false;
  };

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      expanded,
      globalFilter,
      columnFilters,
    },
    onExpandedChange: setExpanded,
    getExpandedRowModel: getExpandedRowModel(),
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn,
  });

  const toggleExpandAll = () => {
    if (Object.keys(expanded).length === 0) {
      // Se nada estiver expandido, expande tudo
      const expandedState: ExpandedState = {};
      table.getRowModel().rows.forEach((row) => {
        expandedState[row.id] = true;
      });
      setExpanded(expandedState);
    } else {
      // Se algo estiver expandido, colapsa tudo
      setExpanded({});
    }
  };

  const printableRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    content: () => printableRef.current,
    pageStyle: `
      @media print {
        body {
          -webkit-print-color-adjust: exact;
          margin: 0;
          padding: 0;
          line-height: 1.6;
        }
        .printableTable {
          display: block !important;
          width: 100% !important;
          overflow: visible !important;
        }
        table {
          width: 100% !important;
          border-collapse: collapse;
        }
        th, td {
          border: 1px solid #000 !important;
          padding: 8px !important;
          text-align: left !important;
          word-wrap: break-word !important;
        }
      }
    `,
  });

  const handleRowClick = (event: React.MouseEvent, row: any) => {
    // Previne a propagação do evento para não conflitar com o clique do ícone
    event.stopPropagation();
    row.toggleExpanded();
  };

  const handleExpanderClick = (event: React.MouseEvent, row: any) => {
    // Previne a propagação do evento para não conflitar com o clique da linha
    event.stopPropagation();
    row.toggleExpanded();
  };

  return (
    <div>
      <div className="flex flex-wrap gap-4 mb-4">
        {enableFiltering && (
          <div className="w-full">
            <div className="flex flex-wrap gap-4">
              <div className="relative w-72">
                <Input
                  placeholder="Pesquisar..."
                  value={globalFilter ?? ''}
                  onChange={(event) => setGlobalFilter(event.target.value)}
                  className="pl-10 pr-4 py-2"
                />
                <div className="absolute left-3 top-2.5">
                  <Search size={20} className="text-gray-500" />
                </div>
              </div>
              <Button
                variant="outline"
                onClick={toggleExpandAll}
                className="flex items-center gap-2"
              >
                <Expand size={20} />
                {Object.keys(expanded).length === 0
                  ? 'Expandir'
                  : 'Colapsar'}{' '}
                Todos
              </Button>
              <Button className="ml-5" variant="ghost" onClick={handlePrint}>
                <Printer size={20} />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Desktop View */}
      <div className="rounded-md border overflow-hidden hidden md:block">
        <div className="overflow-x-auto" ref={printableRef}>
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
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <React.Fragment key={row.id}>
                    <TableRow
                      className="hover:bg-slate-50"
                      onClick={(e) => handleRowClick(e, row)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {cell.column.id === 'expander' ? (
                            <div
                              className="cursor-pointer p-1 hover:bg-slate-200 rounded"
                              onClick={(e) => handleExpanderClick(e, row)}
                            >
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
                          <ExpandedDetails log={row.original} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    Nenhum resultado encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Mobile View */}
      <div className="block md:hidden space-y-4">
        {table.getRowModel().rows?.length ? (
          table.getRowModel().rows.map((row) => (
            <div
              key={row.id}
              className="border rounded-md p-4 relative bg-white"
              onClick={(e) => handleRowClick(e, row)}
            >
              {row.getVisibleCells().map((cell) => {
                const columnDef = cell.column.columnDef;

                // Skip expander column in mobile view
                if (columnDef.id === 'expander') return null;

                // Skip if marked as mobileHidden
                if (columnDef.meta?.mobileHidden) return null;

                return (
                  <div key={cell.id} className="mb-2 flex items-center gap-2">
                    <div className="w-6 flex-shrink-0">
                      {columnDef.meta?.mobileHeader}
                    </div>
                    {flexRender(columnDef.cell, cell.getContext())}
                  </div>
                );
              })}
              <div
                className="absolute top-4 right-4 p-1 hover:bg-slate-100 rounded cursor-pointer"
                onClick={(e) => handleExpanderClick(e, row)}
              >
                {row.getIsExpanded() ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </div>
              {row.getIsExpanded() && (
                <div className="mt-4 pt-4 border-t">
                  <ExpandedDetails log={row.original} />
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center p-4">Nenhum resultado encontrado.</div>
        )}
      </div>
    </div>
  );
}

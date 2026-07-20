'use client';

import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { useState } from 'react';
import '@/styles/table-styles.css';

import {
  flexRender,
  SortingState,
  VisibilityState,
  ColumnFiltersState,
  PaginationState,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  ColumnDef,
  RowSelectionState,
  Row,
} from '@tanstack/react-table';

import { Printer, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  enableFiltering?: boolean;
  enableColumnVisibility?: boolean;
  onRowClick?: (row: TData) => void;
  getRowClassName?: (row: Row<TData>) => string;
  enableRowSelection?: boolean;
  onRowSelectionChange?: (selectedRowIds: string[]) => void;
  selectedRows?: string[];
  enablePagination?: boolean;
  manualPagination?: boolean;
  pageCount?: number;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  enableFiltering = false,
  enableColumnVisibility = false,
  onRowClick,
  getRowClassName,
  enableRowSelection = false,
  onRowSelectionChange,
  selectedRows = [],
  enablePagination = true,
  manualPagination = false,
  pageCount,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const isInternalSelectionChangeRef = useRef(false);

  React.useEffect(() => {
    if (isInternalSelectionChangeRef.current) {
      isInternalSelectionChangeRef.current = false;
      return;
    }
    const newRowSelection: RowSelectionState = {};
    if (selectedRows && selectedRows.length > 0) {
      data.forEach((row: any, index: number) => {
        if (selectedRows.includes(row.id)) {
          newRowSelection[index] = true;
        }
      });
    }
    const currentSelectedIndices = Object.keys(rowSelection).filter((index) => rowSelection[parseInt(index)]);
    const newSelectedIndices = Object.keys(newRowSelection).filter((index) => newRowSelection[parseInt(index)]);
    if (
      currentSelectedIndices.length !== newSelectedIndices.length ||
      !currentSelectedIndices.every((idx) => newSelectedIndices.includes(idx))
    ) {
      setRowSelection(newRowSelection);
    }
  }, [selectedRows, data, rowSelection]);

  const table = useReactTable({
    data,
    columns,
        state: {
      sorting,
      globalFilter,
      columnVisibility,
      columnFilters,
      pagination,
      rowSelection,
    },
    enableRowSelection,
    onRowSelectionChange: (updater) => {
      isInternalSelectionChangeRef.current = true;
      const next = typeof updater === 'function' ? updater(rowSelection) : updater;
      setRowSelection(next);
      // Notify the parent directly from the handler so this does not depend on
      // effect ordering (the selectedRows-sync effect above would otherwise reset
      // the internal-change ref before a notify effect could read it).
      if (onRowSelectionChange) {
        const selectedRowIds = Object.keys(next)
          .filter((index) => next[parseInt(index)])
          .map((index) => (data[parseInt(index)] as { id?: string } | undefined)?.id)
          .filter((id): id is string => Boolean(id));
        onRowSelectionChange(selectedRowIds);
      }
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination,
    pageCount: manualPagination ? pageCount : undefined,
  });

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

  return (
    <>
      <div>
        <div className="flex items-center justify-between">
          {/* Filters */}
          {enableFiltering && (
            <div className="flex items-center justify-between">
              <div className="flex items-center py-4">
                <div className="relative max-w">
                  <Input
                    placeholder="Pesquisar..."
                    value={globalFilter}
                    onChange={(event) => setGlobalFilter(event.target.value)}
                    className="pl-10 pr-4 py-2 w-full"
                  />
                  <div className="absolute top-0 left-0 pl-3 pt-2">
                    <Search size={20} />
                  </div>
                </div>
              </div>
            </div>
          )}
          <Button variant="ghost" onClick={handlePrint}>
            <Printer size={20} />
          </Button>
        </div>

        {/* Column visibility */}
        {enableColumnVisibility && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="ml-auto">
                Colunas
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Table */}
        <div
          className="printableTable rounded-md border hidden md:block overflow-x-auto"
          ref={printableRef}
        >
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    onClick={() => onRowClick && onRowClick(row.original)}
                    className={cn(
                      'cursor-pointer',
                      getRowClassName ? getRowClassName(row) : '',
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    Sem resultados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Cards for Mobile */}
        <div className="block md:hidden">
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <div
                key={row.id}
                className={cn(
                  'border rounded-md p-4 mb-4 relative cursor-pointer',
                  getRowClassName ? getRowClassName(row) : '',
                )}
                onClick={() => onRowClick && onRowClick(row.original)}
              >
                {row.getVisibleCells().map((cell) => {
                  const columnDef = cell.column.columnDef;

                  // Conditionally render the cell content and header based on mobileHidden
                  if (columnDef.meta?.mobileHidden) return null;

                  return cell.column.id === 'actions' ? (
                    <div key={cell.id} className="card-actions">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </div>
                  ) : (
                    <div key={cell.id} className="mb-2 flex">
                      {columnDef.meta?.mobileHeader}
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          ) : (
            <div className="text-center p-4">No results.</div>
          )}
        </div>

        {/* Pagination */}
        {enablePagination && (
        <div className="flex items-center justify-end space-x-2 py-4">
          <Select
            onValueChange={(value) => {
              setPagination((prev) => ({
                ...prev,
                pageSize: Number(value),
              }));
            }}
          >
            <SelectTrigger className="w-50">
              <SelectValue placeholder="Itens por página" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setPagination((prev) => ({
                ...prev,
                pageIndex: Math.max(prev.pageIndex - 1, 0),
              }))
            }
            disabled={!table.getCanPreviousPage()}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setPagination((prev) => ({
                ...prev,
                pageIndex: Math.min(
                  prev.pageIndex + 1,
                  table.getPageCount() - 1,
                ),
              }))
            }
            disabled={!table.getCanNextPage()}
          >
            Próxima
          </Button>
        </div>
        )}
      </div>
    </>
  );
}

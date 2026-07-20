'use client';

import React, { useState } from 'react';
import { Plus, Dna } from 'lucide-react';
import { useClients } from '@/hooks/use-clients';
import { PageTitle } from '@arboria-tech/arboria-ui';
import { DataTable } from '@/components/data-table';
import { LoaderComponent } from '@arboria-tech/arboria-ui';
import { ErrorComponent } from '@arboria-tech/arboria-ui';
import { Button } from '@/components/ui';
import { QuotationClient } from '@/types/client';
import { columns } from './components/columns';
import { ClientModal } from './components/client-modal';
import { BulkDnaModal } from './components/bulk-dna-modal';

export default function ClientesPage() {
  const { clients, isLoading, isError } = useClients();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

  if (isLoading) return <LoaderComponent />;
  if (isError) return <ErrorComponent />;

  const handleRowClick = (client: QuotationClient) => {
    setSelectedClientId(client.id);
    setModalOpen(true);
  };

  const handleCreateClick = () => {
    setSelectedClientId(null);
    setModalOpen(true);
  };

  const selectedClients = (clients ?? []).filter((c) => selectedIds.includes(c.id));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
        <PageTitle title="Clientes" />
        <Button className="whitespace-nowrap" onClick={handleCreateClick}>
          <Plus className="w-4 h-4 mr-2" />
          Cadastrar Cliente
        </Button>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-md border bg-muted/40 px-4 py-3">
          <span className="text-sm text-muted-foreground">
            {selectedIds.length} cliente(s) selecionado(s)
          </span>
          <Button
            variant="outline"
            className="whitespace-nowrap"
            onClick={() => setBulkModalOpen(true)}
          >
            <Dna className="w-4 h-4 mr-2" />
            Atualizar DNA em massa
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={clients ?? []}
        enableFiltering
        enableColumnVisibility={false}
        onRowClick={handleRowClick}
        enableRowSelection
        selectedRows={selectedIds}
        onRowSelectionChange={setSelectedIds}
      />

      <ClientModal
        clientId={selectedClientId ?? undefined}
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setSelectedClientId(null);
        }}
      />

      <BulkDnaModal
        clients={selectedClients}
        open={bulkModalOpen}
        onOpenChange={setBulkModalOpen}
        onApplied={() => setSelectedIds([])}
      />
    </div>
  );
}

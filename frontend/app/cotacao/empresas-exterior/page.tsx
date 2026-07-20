'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useExporters } from '@/hooks/use-exporters';
import { PageTitle } from '@arboria-tech/arboria-ui';
import { DataTable } from '@/components/data-table';
import { LoaderComponent } from '@arboria-tech/arboria-ui';
import { ErrorComponent } from '@arboria-tech/arboria-ui';
import { Button } from '@/components/ui';
import { Exporter } from '@/types/exporter';
import { columns } from './components/columns';
import { ExporterModal } from './components/exporter-modal';

export default function EmpresasExteriorPage() {
  const { exporters, isLoading, isError } = useExporters();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedExporterId, setSelectedExporterId] = useState<string | null>(null);

  if (isLoading) return <LoaderComponent />;
  if (isError) return <ErrorComponent />;

  const handleRowClick = (exporter: Exporter) => {
    setSelectedExporterId(exporter.id);
    setModalOpen(true);
  };

  const handleCreateClick = () => {
    setSelectedExporterId(null);
    setModalOpen(true);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
        <PageTitle title="Empresas Exterior" />
        <Button className="whitespace-nowrap" onClick={handleCreateClick}>
          <Plus className="w-4 h-4 mr-2" />
          Cadastrar Exportador
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={exporters ?? []}
        enableFiltering
        enableColumnVisibility={false}
        onRowClick={handleRowClick}
      />

      <ExporterModal
        exporterId={selectedExporterId ?? undefined}
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setSelectedExporterId(null);
        }}
      />
    </div>
  );
}

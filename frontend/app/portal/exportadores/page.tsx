'use client';

import { useState } from 'react';
import { Plus, ShieldAlert } from 'lucide-react';
import { LoaderComponent, ErrorComponent, EmptyState } from '@arboria-tech/arboria-ui';

import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { useMyExporters } from '@/hooks/use-portal-exporters';
import { CARGO_PROFILE_LABELS } from '@/types/exporter';

import { PortalExporterModal } from '../components/portal-exporter-modal';

export default function PortalExportadoresPage() {
  const { exporters, isLoading, isError } = useMyExporters();
  const [modalOpen, setModalOpen] = useState(false);

  if (isLoading) return <LoaderComponent />;
  if (isError) return <ErrorComponent />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Meus Exportadores</h1>
          <p className="text-sm text-muted-foreground">
            {exporters.length === 0
              ? 'Nenhum exportador cadastrado.'
              : `${exporters.length} ${
                  exporters.length === 1
                    ? 'exportador cadastrado'
                    : 'exportadores cadastrados'
                }.`}
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Novo exportador
        </Button>
      </div>

      {exporters.length === 0 ? (
        <EmptyState message="Cadastre os exportadores que embarcam sua carga na origem. Eles ficam disponíveis para selecionar ao solicitar uma nova cotação." />
      ) : (
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Perfil de carga</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead>Email de contato</TableHead>
                <TableHead>Particularidades de coleta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exporters.map((exporter) => (
                <TableRow key={exporter.id}>
                  <TableCell className="font-medium">{exporter.name}</TableCell>
                  <TableCell>
                    {exporter.cargo_profile === 'PERIGOSA' ? (
                      <span className="inline-flex items-center gap-1 rounded border border-orange-300 bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700">
                        <ShieldAlert className="h-3 w-3" />
                        {CARGO_PROFILE_LABELS[exporter.cargo_profile]}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {CARGO_PROFILE_LABELS[exporter.cargo_profile]}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {exporter.endereco ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {exporter.contact_email ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs">
                    {exporter.particularidades ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <PortalExporterModal open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
}

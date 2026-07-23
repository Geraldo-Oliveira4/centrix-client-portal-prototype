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

import { PagePortalHeader } from '../_shared/page-header';
import { PortalExporterModal } from '../components/portal-exporter-modal';

export default function PortalExportadoresPage() {
  const { exporters, isLoading, isError } = useMyExporters();
  const [modalOpen, setModalOpen] = useState(false);

  if (isLoading) return <LoaderComponent />;
  if (isError) return <ErrorComponent />;

  return (
    <div className="space-y-8">
      <PagePortalHeader
        title="Meus Exportadores"
        subtitle={
          exporters.length === 0
            ? 'Nenhum exportador cadastrado.'
            : `${exporters.length} ${
                exporters.length === 1
                  ? 'exportador cadastrado'
                  : 'exportadores cadastrados'
              }.`
        }
        action={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="mr-2 h-5 w-5" />
            Novo exportador
          </Button>
        }
      />

      {exporters.length === 0 ? (
        <EmptyState message="Cadastre os exportadores que embarcam sua carga na origem. Eles ficam disponíveis para selecionar ao solicitar uma nova cotação." />
      ) : (
        <div className="portal-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="portal-small font-medium text-portal-neutral">Nome</TableHead>
                <TableHead className="portal-small font-medium text-portal-neutral">Perfil de carga</TableHead>
                <TableHead className="portal-small font-medium text-portal-neutral">Endereço</TableHead>
                <TableHead className="portal-small font-medium text-portal-neutral">Email de contato</TableHead>
                <TableHead className="portal-small font-medium text-portal-neutral">Particularidades de coleta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exporters.map((exporter) => (
                <TableRow key={exporter.id}>
                  <TableCell className="portal-body font-medium">{exporter.name}</TableCell>
                  <TableCell>
                    {exporter.cargo_profile === 'PERIGOSA' ? (
                      <span className="portal-small inline-flex items-center gap-1.5 rounded border border-portal-warning/30 bg-portal-warning/10 px-2 py-0.5 font-medium text-portal-warning">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        {CARGO_PROFILE_LABELS[exporter.cargo_profile]}
                      </span>
                    ) : (
                      <span className="portal-body text-portal-neutral">
                        {CARGO_PROFILE_LABELS[exporter.cargo_profile]}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="portal-body text-portal-neutral">
                    {exporter.endereco ?? '—'}
                  </TableCell>
                  <TableCell className="portal-body text-portal-neutral">
                    {exporter.contact_email ?? '—'}
                  </TableCell>
                  <TableCell className="portal-body text-portal-neutral max-w-xs">
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

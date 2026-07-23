'use client';

import Link from 'next/link';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { LoaderComponent, ErrorComponent, EmptyState } from '@arboria-tech/arboria-ui';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { formatShortDate } from '@/lib/portal-formatters';
import { useMyShipments } from '@/hooks/use-portal-shipments';
import { MODAL_LABELS } from '@/types/quotation';
import {
  ESTADO_LABELS,
  SHIPMENT_STEPS,
  EXCEPTION_STATES,
  type EmbarqueEstado,
} from '@/types/portal-shipment';

import { ModalIcon } from '../_shared/modal-icon';
import { EstadoBadge } from './components/estado-badge';

// Summary strip: shipments per state, nothing else. The GE "Torre de Controle"
// KPIs (SLA em risco, documentos pendentes) are not shown because no column
// backs them — there is no deadline to compare against and no notion of which
// documents are required. Counting by state is the one figure the data supports.
function EstadoSummary({ byEstado }: { byEstado: Partial<Record<EmbarqueEstado, number>> }) {
  const shown = [...SHIPMENT_STEPS, ...EXCEPTION_STATES].filter(
    (estado) => (byEstado[estado] ?? 0) > 0,
  );
  if (shown.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {shown.map((estado) => (
        <div
          key={estado}
          className="rounded-md border bg-background px-3 py-2 min-w-24"
        >
          <p className="text-xl font-semibold leading-none">{byEstado[estado]}</p>
          <p className="mt-1 text-xs text-muted-foreground">{ESTADO_LABELS[estado]}</p>
        </div>
      ))}
    </div>
  );
}

export default function PortalEmbarquesPage() {
  const { shipments, byEstado, isLoading, isError } = useMyShipments();

  if (isLoading) return <LoaderComponent />;
  if (isError) return <ErrorComponent />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Meus Embarques</h1>
        <p className="text-sm text-muted-foreground">
          {shipments.length === 0
            ? 'Nenhum embarque em andamento.'
            : `${shipments.length} ${
                shipments.length === 1
                  ? 'embarque em acompanhamento'
                  : 'embarques em acompanhamento'
              }.`}
        </p>
      </div>

      <EstadoSummary byEstado={byEstado} />

      {shipments.length === 0 ? (
        <EmptyState message="Seus embarques aparecem aqui assim que uma cotação aprovada é fechada pela Freitas." />
      ) : (
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referência</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Modal</TableHead>
                <TableHead>Incoterm</TableHead>
                <TableHead>Agente</TableHead>
                <TableHead>Aberto em</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipments.map((shipment) => (
                <TableRow
                  key={shipment.id}
                  className="cursor-pointer hover:bg-muted/50"
                >
                  <TableCell className="font-medium">
                    <Link
                      href={`/portal/embarques/${shipment.id}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      {shipment.referencia}
                      {shipment.carga_urgente && (
                        <span
                          className="inline-flex items-center gap-1 rounded border border-orange-300 bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700"
                          title="Carga urgente"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          Urgente
                        </span>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <EstadoBadge estado={shipment.estado} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <ModalIcon modal={shipment.modal} />
                      {shipment.modal ? MODAL_LABELS[shipment.modal] : '—'}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {shipment.incoterm ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {shipment.agente_nome ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatShortDate(shipment.created_at)}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/portal/embarques/${shipment.id}`}
                      aria-label={`Abrir ${shipment.referencia}`}
                    >
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

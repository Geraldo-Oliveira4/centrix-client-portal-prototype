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
import { cn } from '@/lib/utils';
import { formatShortDate } from '@/lib/portal-formatters';
import { useMyShipments } from '@/hooks/use-portal-shipments';
import { MODAL_LABELS } from '@/types/quotation';
import {
  ESTADO_ACCENT_CLASS,
  ESTADO_LABELS,
  SHIPMENT_STEPS,
  EXCEPTION_STATES,
  type EmbarqueEstado,
} from '@/types/portal-shipment';

import { PagePortalHeader, SectionHeading } from '../_shared/page-header';
import { ModalIcon } from '../_shared/modal-icon';
import { DeadlineBlock } from '../inteligencia/components/deadline-block';
import { EstadoBadge } from './components/estado-badge';
import { ShipmentQuickCheck } from './components/shipment-quick-check';
import { ShipmentWorldMap } from './components/shipment-world-map';

// Summary strip: shipments per state, nothing else. The GE "Torre de Controle"
// KPIs (SLA em risco, documentos pendentes) are not shown because no column
// backs them — there is no deadline to compare against and no notion of which
// documents are required. Counting by state is the one figure the data supports.
//
// Rendered as light tiles, not cards: this is orientation, not the content of
// the screen, so it must not compete with the table below.
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
          className="portal-card-muted min-w-32 flex-1 px-4 py-3 sm:flex-none"
        >
          <p className={cn('text-2xl font-semibold leading-none', ESTADO_ACCENT_CLASS[estado])}>
            {byEstado[estado]}
          </p>
          <p className="portal-small mt-1 text-portal-neutral">
            {ESTADO_LABELS[estado]}
          </p>
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
    <div className="space-y-8">
      <PagePortalHeader
        title="Meus Embarques"
        subtitle={
          shipments.length === 0
            ? 'Nenhum embarque em andamento.'
            : `${shipments.length} ${
                shipments.length === 1
                  ? 'embarque em acompanhamento'
                  : 'embarques em acompanhamento'
              }.`
        }
      />

      {shipments.length === 0 ? (
        <EmptyState message="Seus embarques aparecem aqui assim que uma cotação aprovada é fechada pela Freitas." />
      ) : (
        <>
          {/* Direct lookup by reference — the "just check one shipment" shortcut,
              above everything else. Client-side search over the already-owned
              list, so it cannot reach another client's shipment. */}
          <ShipmentQuickCheck />

          {/* Prazo (bloco do canvas, relocado) — o tracking e o contexto
              natural do "a carga chega no prazo?". Preview: base real (nº de
              embarques), percentual ilustrativo (nao ha ETA neste prototipo). */}
          <DeadlineBlock />

          {/* World-map overview: the origins fanning into Brazil, coloured by
              state. Illustrative (see caption in the component) — it sits above
              the list as the quick read before the precise one. */}
          <section className="portal-card space-y-4 p-6">
            <SectionHeading title="Rota dos embarques" />
            <ShipmentWorldMap shipments={shipments} />
          </section>

          <div className="space-y-4">
            <EstadoSummary byEstado={byEstado} />

          <div className="portal-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="portal-small font-medium text-portal-neutral">
                    Referência
                  </TableHead>
                  <TableHead className="portal-small font-medium text-portal-neutral">
                    Situação
                  </TableHead>
                  <TableHead className="portal-small font-medium text-portal-neutral">
                    Modal
                  </TableHead>
                  <TableHead className="portal-small hidden font-medium text-portal-neutral md:table-cell">
                    Incoterm
                  </TableHead>
                  <TableHead className="portal-small hidden font-medium text-portal-neutral lg:table-cell">
                    Agente
                  </TableHead>
                  <TableHead className="portal-small font-medium text-portal-neutral">
                    Aberto em
                  </TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {shipments.map((shipment) => (
                  <TableRow
                    key={shipment.id}
                    className="cursor-pointer hover:bg-muted/40"
                  >
                    <TableCell>
                      <Link
                        href={`/portal/embarques/${shipment.id}`}
                        className="flex items-center gap-2 font-medium hover:text-primary"
                      >
                        {shipment.referencia}
                        {shipment.carga_urgente && (
                          <span
                            className="portal-small inline-flex items-center gap-1 rounded border border-portal-warning/30 bg-portal-warning/10 px-1.5 py-0.5 font-medium text-portal-warning"
                            title="Carga urgente"
                          >
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Urgente
                          </span>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <EstadoBadge estado={shipment.estado} />
                    </TableCell>
                    <TableCell className="portal-body text-portal-neutral">
                      <span className="inline-flex items-center gap-2">
                        <ModalIcon modal={shipment.modal} className="h-5 w-5" />
                        {shipment.modal ? MODAL_LABELS[shipment.modal] : '—'}
                      </span>
                    </TableCell>
                    <TableCell className="portal-body hidden text-portal-neutral md:table-cell">
                      {shipment.incoterm ?? '—'}
                    </TableCell>
                    <TableCell className="portal-body hidden text-portal-neutral lg:table-cell">
                      {shipment.agente_nome ?? '—'}
                    </TableCell>
                    <TableCell className="portal-body text-portal-neutral">
                      {formatShortDate(shipment.created_at)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/portal/embarques/${shipment.id}`}
                        aria-label={`Abrir ${shipment.referencia}`}
                      >
                        <ChevronRight className="h-5 w-5 text-portal-neutral" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          </div>
        </>
      )}
    </div>
  );
}

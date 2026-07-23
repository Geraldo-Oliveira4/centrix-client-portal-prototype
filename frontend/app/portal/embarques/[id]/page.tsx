'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Container, FileText } from 'lucide-react';
import { LoaderComponent, ErrorComponent } from '@arboria-tech/arboria-ui';

import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { formatShortDate } from '@/lib/portal-formatters';
import { useMyShipment } from '@/hooks/use-portal-shipments';
import { MODAL_LABELS, TIPO_EMBARQUE_LABELS } from '@/types/quotation';

import { ModalIcon } from '../../_shared/modal-icon';
import { SectionHeading } from '../../_shared/page-header';
import { EstadoBadge } from '../components/estado-badge';
import { ShipmentProgress } from '../components/shipment-progress';
import { ShipmentRoute } from '../components/shipment-route';
import { ShipmentTrackingPanel } from '../components/shipment-tracking-panel';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="portal-small text-portal-neutral">{label}</p>
      <p className="portal-body font-medium text-foreground">{children}</p>
    </div>
  );
}

export default function PortalEmbarqueDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { shipment, isLoading, isError } = useMyShipment(params?.id ?? null);

  if (isLoading) return <LoaderComponent />;
  // A shipment owned by another client answers 404 exactly like a non-existent
  // one (anti-enumeration), so both land here.
  if (isError || !shipment) return <ErrorComponent />;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 h-8 px-2 text-portal-neutral hover:text-foreground"
          onClick={() => router.push('/portal/embarques')}
        >
          <ArrowLeft className="mr-2 h-5 w-5" />
          Meus Embarques
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="portal-h1 text-foreground">{shipment.referencia}</h1>
              <EstadoBadge estado={shipment.estado} />
              {shipment.carga_urgente && (
                <span className="portal-small inline-flex items-center gap-1 rounded border border-portal-warning/30 bg-portal-warning/10 px-2 py-0.5 font-medium text-portal-warning">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Carga urgente
                </span>
              )}
            </div>
            <p className="portal-small text-portal-neutral">
              Aberto em {formatShortDate(shipment.created_at)}
            </p>
          </div>
          {shipment.quotation_id && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/portal/cotacao/${shipment.quotation_id}`}>
                <FileText className="mr-2 h-5 w-5" />
                Ver cotação de origem
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Primary: the reason the client opened this screen. The route track sits
          above the steps as the quick read ("where is my cargo, roughly"), with
          the steps below as the precise one. Both are driven by the same
          `estado` — the track adds no information, only legibility, which is why
          it carries an explicit "not GPS" caption. */}
      <section className="portal-card space-y-6 p-6">
        <SectionHeading title="Situação atual" />
        <ShipmentRoute estado={shipment.estado} modal={shipment.modal} />
        <div className="border-t pt-6">
          <ShipmentProgress estado={shipment.estado} />
        </div>
      </section>

      {/* Maritime tracking: the ShipsGo-style fields (vessel, POL/POD, ETD/ETA)
          sit next to the route as part of "where is my cargo". Illustrative —
          the panel carries its own preview seal and the POL matches the port the
          world map plots for this shipment. Only for maritime (or unset) modal;
          air freight tracks differently. */}
      {shipment.modal !== 'AEREO' && (
        <ShipmentTrackingPanel shipment={shipment} />
      )}

      {/* Supporting detail, deliberately quieter than the block above and
          collapsed by default: only "Situação atual" stays open on load, so the
          screen leads with the status/route and the rest is available on demand
          instead of exposed all at once. */}
      <section className="portal-card-muted px-6">
        <Accordion
          type="multiple"
          className="[&>*:last-child]:border-b-0"
        >
          <AccordionItem value="dados">
            <AccordionTrigger className="text-base font-semibold text-foreground hover:no-underline">
              Dados do embarque
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Modal">
                  <span className="inline-flex items-center gap-2">
                    <ModalIcon modal={shipment.modal} className="h-5 w-5" />
                    {shipment.modal ? MODAL_LABELS[shipment.modal] : '—'}
                  </span>
                </Field>
                <Field label="Tipo de embarque">
                  {shipment.tipo_embarque
                    ? TIPO_EMBARQUE_LABELS[shipment.tipo_embarque]
                    : '—'}
                </Field>
                <Field label="Incoterm">{shipment.incoterm ?? '—'}</Field>
                <Field label="Agente de carga">{shipment.agente?.nome ?? '—'}</Field>
                <Field label="Estilo de processo">
                  {shipment.tipo_despacho === 'CONSOLIDADO'
                    ? 'Consolidado'
                    : shipment.tipo_despacho === 'DIRETO'
                      ? 'Direto'
                      : '—'}
                </Field>
                <Field label="Última atualização">
                  {shipment.updated_at ? formatShortDate(shipment.updated_at) : '—'}
                </Field>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="containers">
            <AccordionTrigger className="text-base font-semibold text-foreground hover:no-underline">
              <span className="flex items-center gap-2">
                <Container className="h-5 w-5 text-portal-neutral" />
                Containers
                <span className="portal-small text-portal-neutral">
                  {shipment.containers.length}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              {shipment.containers.length === 0 ? (
                <p className="portal-body text-portal-neutral">
                  Nenhum container informado até o momento.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="portal-small font-medium text-portal-neutral">
                        Número
                      </TableHead>
                      <TableHead className="portal-small font-medium text-portal-neutral">
                        Tipo
                      </TableHead>
                      <TableHead className="portal-small font-medium text-portal-neutral">
                        Tara (kg)
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shipment.containers.map((container, index) => (
                      <TableRow key={container.numero ?? index} className="hover:bg-transparent">
                        <TableCell className="portal-body font-medium">
                          {container.numero ?? '—'}
                        </TableCell>
                        <TableCell className="portal-body text-portal-neutral">
                          {container.tipo ?? '—'}
                        </TableCell>
                        <TableCell className="portal-body text-portal-neutral">
                          {container.tara ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </AccordionContent>
          </AccordionItem>

          {shipment.observacao && (
            <AccordionItem value="observacao">
              <AccordionTrigger className="text-base font-semibold text-foreground hover:no-underline">
                Observação da Freitas
              </AccordionTrigger>
              <AccordionContent>
                <p className="portal-body whitespace-pre-line text-foreground/80">
                  {shipment.observacao}
                </p>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </section>
    </div>
  );
}

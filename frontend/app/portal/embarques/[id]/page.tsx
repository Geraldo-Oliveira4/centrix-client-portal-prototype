'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Container, FileText, RefreshCw } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { formatShortDate } from '@/lib/portal-formatters';
import { buildShipmentUpdateMailto } from '@/lib/portal-state';
import { useMyShipment } from '@/hooks/use-portal-shipments';
import { MODAL_LABELS, TIPO_EMBARQUE_LABELS } from '@/types/quotation';

import { IncompleteDataNote } from '../../_shared/incomplete-data-badge';
import { ModalIcon } from '../../_shared/modal-icon';
import { SectionHeading } from '../../_shared/page-header';
import { ProvenanceBadge } from '../../_shared/provenance-badge';
import { DelayRiskBadge } from '../components/delay-risk-badge';
import { EstadoBadge } from '../components/estado-badge';
import { ShipmentEtaBadge } from '../components/eta-badge';
import { ShipmentTimeline } from '../components/shipment-timeline';
import { ShipmentRoute } from '../components/shipment-route';
import { INCOMPLETE_DATA_COPY, delayRiskFromTracking } from '../lib/delay-risk';
import { ORIGINS, originIndex } from '../lib/shipment-origins';
import { parseVesselFromObservacao } from '../lib/vessel';

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

  // Illustrative origin hub (same source the map and tracking panel use).
  const origin = ORIGINS[originIndex(shipment.referencia)];

  // Delay risk: pure computation over the two carrier ETAs, tested in
  // lib/delay-risk.test.ts. Null tracking -> "pending", never a number.
  const delayRisk = delayRiskFromTracking(shipment.tracking);

  // Real signal, kept from the removed "Rastreamento marítimo" panel: the ship
  // named in the Freitas note. Null when the note names none — the field then
  // does not render at all, rather than showing a guessed vessel.
  const vessel = parseVesselFromObservacao(shipment.observacao);

  // Demo tracking (backend/scripts/topup_tracking_demo.py). Every surface that
  // renders a value from `tracking` must seal it when this is true.
  const isMockTracking = shipment.tracking?.is_mock === true;

  const etaFootnote =
    delayRisk.status === 'pending'
      ? 'Sem rastreamento integrado'
      : delayRisk.status === 'incomplete'
        ? 'A companhia não reportou'
        : shipment.tracking?.eta_is_actual
          ? 'Informado pela companhia'
          : 'Previsão da companhia';

  const riskFootnote =
    delayRisk.status === 'pending'
      ? 'Depende da previsão da companhia'
      : delayRisk.status === 'incomplete'
        ? 'Sem as duas previsões não há cálculo'
        : 'Diferença em dias sobre a primeira previsão';

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
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={buildShipmentUpdateMailto(shipment.referencia)}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Solicitar atualização
              </a>
            </Button>
            {shipment.quotation_id && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/portal/cotacao/${shipment.quotation_id}`}>
                  <FileText className="mr-2 h-4 w-4" />
                  Ver documentos
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Resumo: rota (origem ilustrativa), modal, ETA e risco de atraso.
          Supporting card — quieter than the timeline below, which is the one
          dominant element on this screen.

          ETA e risco vêm do bloco `tracking` (ShipsGo, migração 091). Enquanto
          os campos forem NULL os dois badges dizem "Pendente integração"; o
          cálculo do risco (delta em dias entre a primeira previsão e a previsão
          atual/chegada real) já está pronto em lib/delay-risk.ts e passa a
          mostrar o número exato assim que a fonte existir. */}
      <section className="portal-card-muted space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <p className="portal-small text-portal-neutral">Rota</p>
            <p className="portal-body font-medium text-foreground">
              {origin.name}, {origin.country} → Brasil
            </p>
            <p className="portal-small text-portal-neutral">
              Origem aproximada (ilustrativa)
            </p>
          </div>
          <div className="space-y-1">
            <p className="portal-small text-portal-neutral">Modal</p>
            <p className="portal-body font-medium text-foreground">
              <span className="inline-flex items-center gap-2">
                <ModalIcon modal={shipment.modal} className="h-5 w-5" />
                {shipment.modal ? MODAL_LABELS[shipment.modal] : '—'}
              </span>
            </p>
          </div>
          <div
            className={cn(
              'space-y-1 sm:col-span-2',
              // Demo tracking wears the same dashed frame + seal as every other
              // illustrative surface in the portal.
              isMockTracking &&
                'rounded-lg border border-dashed border-primary/40 bg-primary/[0.03] p-3',
            )}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="portal-small text-portal-neutral">
                  {shipment.tracking?.eta_is_actual
                    ? 'Chegada confirmada'
                    : 'Chegada estimada (ETA)'}
                </p>
                <ShipmentEtaBadge tracking={shipment.tracking} />
                <p className="portal-small text-portal-neutral">{etaFootnote}</p>
              </div>
              <div className="space-y-1">
                <p className="portal-small text-portal-neutral">Risco de atraso</p>
                <DelayRiskBadge risk={delayRisk} />
                <p className="portal-small text-portal-neutral">{riskFootnote}</p>
              </div>
            </div>
            {isMockTracking && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <ProvenanceBadge provenance="preview" />
                <span className="portal-small text-portal-neutral">
                  Rastreamento de demonstração — não vem da companhia marítima.
                </span>
              </div>
            )}
          </div>
        </div>
        {delayRisk.status === 'incomplete' && (
          <IncompleteDataNote>{INCOMPLETE_DATA_COPY}</IncompleteDataNote>
        )}
        <div className="border-t pt-4">
          <ShipmentRoute estado={shipment.estado} modal={shipment.modal} />
        </div>
      </section>

      {/* Primary: the journey timeline — the reason the client opened this screen.
          Real operational states up to the current one, then the downstream
          carrier milestones (Em trânsito, Chegada, Descarregado, Liberado),
          marked "Pendente integração" until the ShipsGo feed exists.

          `customsClearance` is deliberately NOT passed: the "Desembaraçado" tag
          comes from a future Camada 2 (Inova / Portal Único) that is not
          integrated, and it is not guaranteed for every process — so it renders
          nothing at all rather than a permanent grey placeholder. */}
      <section className="portal-card space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionHeading title="Acompanhamento" />
          {/* The post-embarque steps only advance from tracking data, so when
              that data is demo data the whole timeline carries the seal. */}
          {isMockTracking && <ProvenanceBadge provenance="preview" />}
        </div>
        <ShipmentTimeline estado={shipment.estado} tracking={shipment.tracking} />
      </section>

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
                {vessel && (
                  <Field label="Navio">
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {vessel}
                      <ProvenanceBadge provenance="real" />
                    </span>
                  </Field>
                )}
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

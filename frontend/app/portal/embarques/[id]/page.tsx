'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Container, FileText } from 'lucide-react';
import { LoaderComponent, ErrorComponent } from '@arboria-tech/arboria-ui';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { EstadoBadge } from '../components/estado-badge';
import { ShipmentProgress } from '../components/shipment-progress';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{children}</p>
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
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-7 px-2 text-muted-foreground"
            onClick={() => router.push('/portal/embarques')}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Meus Embarques
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{shipment.referencia}</h1>
            <EstadoBadge estado={shipment.estado} />
            {shipment.carga_urgente && (
              <span className="inline-flex items-center gap-1 rounded border border-orange-300 bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700">
                <AlertTriangle className="h-3 w-3" />
                Carga urgente
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Aberto em {formatShortDate(shipment.created_at)}
          </p>
        </div>
        {shipment.quotation_id && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/portal/cotacao/${shipment.quotation_id}`}>
              <FileText className="mr-1.5 h-4 w-4" />
              Ver cotação de origem
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Situação atual</CardTitle>
        </CardHeader>
        <CardContent>
          <ShipmentProgress estado={shipment.estado} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do embarque</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Modal">
            <span className="inline-flex items-center gap-1.5">
              <ModalIcon modal={shipment.modal} />
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Container className="h-4 w-4" />
            Containers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {shipment.containers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum container informado até o momento.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Tara (kg)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shipment.containers.map((container, index) => (
                  <TableRow key={container.numero ?? index}>
                    <TableCell className="font-medium">
                      {container.numero ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {container.tipo ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {container.tara ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {shipment.observacao && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Observação da Freitas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-line">{shipment.observacao}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

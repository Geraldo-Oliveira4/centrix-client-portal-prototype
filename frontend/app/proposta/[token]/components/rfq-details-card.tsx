'use client';

import { Download, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui';
import { formatDeclaredValue, formatLocalDatetime } from '@/utils/quotation-fields';
import { formatWeight, formatVolume, formatDimensions } from '@/lib/portal-formatters';
import {
  MODAL_LABELS,
  SERVICE_TYPE_LABELS,
  TIPO_EMBARQUE_LABELS,
  type ProposalFormQuotation,
} from '@/types/quotation';

interface RFQDetailsData {
  quotation: ProposalFormQuotation;
  rfq: {
    include_insurance: boolean;
    destination_yard: string | null;
  };
}

interface RFQDetailsCardProps {
  data: RFQDetailsData;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
        {label}
      </span>
      <span className="text-sm font-medium truncate">{value}</span>
    </div>
  );
}

function boolLabel(value: boolean | null): string | null {
  if (value === null || value === undefined) return null;
  return value ? 'Sim' : 'Não';
}

export function RFQDetailsCard({ data }: RFQDetailsCardProps) {
  const { quotation, rfq } = data;

  const declaredValue = formatDeclaredValue(quotation);

  const modalLabel = quotation.modal
    ? [
        MODAL_LABELS[quotation.modal] ?? quotation.modal,
        quotation.tipo_embarque
          ? TIPO_EMBARQUE_LABELS[quotation.tipo_embarque] ?? quotation.tipo_embarque
          : null,
      ]
        .filter(Boolean)
        .join(' — ')
    : null;

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-3 px-4 py-3 border-b flex-wrap">
        <span className="font-semibold text-sm">Detalhes da Cotação</span>
        <Badge variant="outline" className="font-mono text-xs">{quotation.reference}</Badge>
        {modalLabel && <Badge variant="secondary" className="text-xs">{modalLabel}</Badge>}
        {quotation.service_type && (
          <Badge variant="outline" className="text-xs">
            {SERVICE_TYPE_LABELS[quotation.service_type] ?? quotation.service_type}
          </Badge>
        )}
      </div>

      <div className="px-4 py-3 flex flex-col gap-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-x-4 gap-y-3">
          <div className="col-span-2">
            <Field label="Origem" value={quotation.origin} />
          </div>
          <div className="col-span-2">
            <Field label="Destino" value={quotation.porto_destino?.join(', ') || quotation.aeroporto_destino?.join(', ')} />
          </div>
          <Field label="Incoterm" value={quotation.incoterm} />
          <Field label="Prazo desejado" value={formatLocalDatetime(quotation.desired_deadline) ?? undefined} />
          <Field label="Seguro solicitado" value={boolLabel(rfq.include_insurance)} />
          {quotation.modal !== 'AEREO' && (
            <Field label="Recinto de destino" value={rfq.destination_yard} />
          )}
          {quotation.incluir_entrega_destino_final && (
            <div className="col-span-2">
              <Field label="Local de entrega" value={quotation.endereco_entrega_final} />
            </div>
          )}
        </div>

        <div className="border-t pt-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-x-4 gap-y-3">
          <div className="col-span-2">
            <Field label="Produto" value={quotation.product} />
          </div>
          <Field
            label="Valor declarado"
            value={declaredValue === 'N/A' ? null : declaredValue}
          />
          <Field label="Empilhável" value={boolLabel(quotation.stackability)} />
        </div>

        {quotation.modal !== 'AEREO' && quotation.equipments && quotation.equipments.length > 0 && (
          <div className="border-t pt-3">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold block mb-2">
              Equipamentos ({quotation.equipments.length})
            </span>
            <div className="flex flex-col gap-2">
              {quotation.equipments.map((eq) => (
                <div key={eq.id} className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span className="font-medium">{eq.quantity}x {eq.tipo_container ?? 'Container'}</span>
                  {eq.peso_bruto !== null && (
                    <span className="text-muted-foreground">
                      Peso: {formatWeight(eq.peso_bruto, eq.peso_unidade)}
                    </span>
                  )}
                  {eq.volume_m3 !== null && (
                    <span className="text-muted-foreground">
                      Volume: {formatVolume(eq.volume_m3)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {quotation.volumes && quotation.volumes.length > 0 && (
          <div className="border-t pt-3">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold block mb-2">
              Volumes ({quotation.volumes.length})
            </span>
            <div className="flex flex-col gap-2">
              {quotation.volumes.map((vol) => (
                <div key={vol.id} className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span className="font-medium">{vol.quantity}x {vol.embalagem ?? 'Volume'}</span>
                  {vol.peso_bruto !== null && (
                    <span className="text-muted-foreground">
                      Peso: {formatWeight(vol.peso_bruto, vol.peso_unidade)}
                    </span>
                  )}
                  {vol.volume_m3 !== null && (
                    <span className="text-muted-foreground">
                      {quotation.modal === 'AEREO'
                        ? `Peso taxado: ${vol.volume_m3} kg`
                        : `Volume: ${formatVolume(vol.volume_m3)}`}
                    </span>
                  )}
                  {(vol.comprimento || vol.largura || vol.altura) && (
                    <span className="text-muted-foreground">
                      Dim: {formatDimensions(vol.comprimento, vol.largura, vol.altura, vol.dimensao_unidade)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {quotation.observations && (
          <div className="border-t pt-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                Observações
              </span>
              <p className="text-sm whitespace-pre-wrap">{quotation.observations}</p>
            </div>
          </div>
        )}

        {Object.keys(quotation.document_urls).length > 0 && (
          <div className="border-t pt-3">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold block mb-2">
              Documentos da Cotação
            </span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(quotation.document_urls).map(([filename, url]) => (
                <Button
                  key={filename}
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                >
                  <FileText className="w-3 h-3" />
                  {filename}
                  <Download className="w-3 h-3 text-muted-foreground" />
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

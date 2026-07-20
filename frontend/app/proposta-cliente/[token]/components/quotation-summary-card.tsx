'use client';

import type { ClientPortalData } from '@/types/quotation';
import { MODAL_LABELS, TIPO_EMBARQUE_LABELS, SERVICE_TYPE_LABELS } from '@/types/quotation';
import { summarizeVolumes, formatPesoByUnit, formatVolumesCount, formatContainerSummary } from '@/utils/quotation-fields';

interface QuotationSummaryCardProps {
  data: ClientPortalData;
  variant?: 'default' | 'sidebar';
}

export function QuotationSummaryCard({ data, variant = 'default' }: QuotationSummaryCardProps) {
  const { quotation, client } = data;

  const containerSummary = formatContainerSummary(quotation.equipments);

  const { totalQty: volumesQty } = summarizeVolumes(quotation.volumes);
  const volumesSummary = formatVolumesCount(volumesQty);

  // Combined across equipments + volumes: a quotation only ever populates one of
  // the two (see getFieldVisibility.showVolumeSection), so summing both scopes
  // here is safe today, but would double-count if that assumption ever changes.
  const { pesoByUnit } = summarizeVolumes([...quotation.equipments, ...quotation.volumes]);
  const pesoSummary = Object.keys(pesoByUnit).length ? formatPesoByUnit(pesoByUnit) : null;

  const fields: { label: string; value: string | null | undefined }[] = [
    { label: 'Referência', value: quotation.reference },
    { label: 'Nº do Pedido', value: quotation.client_reference },
    { label: 'Cliente', value: client?.name },
    { label: 'Serviço', value: quotation.service_type ? SERVICE_TYPE_LABELS[quotation.service_type] : null },
    { label: 'Modal', value: quotation.modal ? MODAL_LABELS[quotation.modal] : null },
    {
      label: 'Tipo de Embarque',
      value: quotation.tipo_embarque ? TIPO_EMBARQUE_LABELS[quotation.tipo_embarque] : null,
    },
    { label: 'Origem', value: quotation.origin },
    { label: 'Destino', value: quotation.destination },
    { label: 'Incoterm', value: quotation.incoterm },
    { label: 'Produto', value: quotation.product },
    { label: 'Volumes', value: volumesSummary },
    { label: 'Container', value: containerSummary },
    { label: 'Peso', value: pesoSummary },
    { label: 'Exportador', value: quotation.exportador },
    { label: 'País de procedência', value: quotation.pais_procedencia },
  ].filter((f) => f.value);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="bg-[#2c2d65] px-4 py-3">
        <p className="text-xs font-semibold text-white/90 uppercase tracking-wide">
          Resumo da Solicitação
        </p>
      </div>
      <div className={variant === 'sidebar' ? 'p-4 flex flex-col gap-3' : 'p-4 grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-3'}>
        {fields.map((f) => (
          <div key={f.label}>
            <p className="text-xs text-muted-foreground">{f.label}</p>
            <p className="text-sm font-medium text-[#2c2d65]">{f.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

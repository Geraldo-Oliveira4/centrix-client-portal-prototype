'use client';

import { TIPO_CONTAINER_LABELS, TIPO_EMBALAGEM_LABELS } from '@/types/quotation';
import { boolDisplay, formatDeclaredValue, formatLocalDatetime, formatPesoByUnit, formatUtcDate, getFieldVisibility, summarizeVolumes } from '@/utils/quotation-fields';
import type { FreightAgent } from '@/types/freight-agent';
import type { Quotation, QuotationVolume, RFQ } from '@/types/quotation';

interface RFQDispatchPreviewProps {
  quotation: Quotation;
  rfq: RFQ;
  agents: FreightAgent[];
}

function computeVolumeTotals(volumes: QuotationVolume[]) {
  const { totalQty, pesoByUnit, totalM3 } = summarizeVolumes(volumes);
  const totalPesoStr = formatPesoByUnit(pesoByUnit);
  const totalM3Str = totalM3 > 0
    ? totalM3.toLocaleString('pt-BR', { minimumFractionDigits: 3 })
    : 'N/A';
  return { totalQty, totalPesoStr, totalM3Str };
}

function VolumesTable({ volumes }: { volumes: QuotationVolume[] }) {
  const { totalQty, totalPesoStr, totalM3Str } = computeVolumeTotals(volumes);
  return (
    <table className="w-full border border-border rounded overflow-hidden text-sm">
      <thead>
        <tr className="bg-muted/60">
          <th className="py-1.5 px-3 text-left font-medium">Embalagem</th>
          <th className="py-1.5 px-3 text-left font-medium">Qtd</th>
          <th className="py-1.5 px-3 text-left font-medium">Peso Bruto</th>
          <th className="py-1.5 px-3 text-left font-medium">Dimensões (C×L×A)</th>
          <th className="py-1.5 px-3 text-left font-medium">Volume (m³)</th>
        </tr>
      </thead>
      <tbody>
        {volumes.map((vol, i) => {
          const emb = vol.embalagem
            ? (TIPO_EMBALAGEM_LABELS[vol.embalagem] ?? vol.embalagem)
            : 'N/A';
          const peso = vol.peso_bruto != null
            ? `${Number(vol.peso_bruto).toLocaleString('pt-BR', { minimumFractionDigits: 3 })} ${vol.peso_unidade}`
            : 'N/A';
          const hasDims = vol.comprimento !== null && vol.largura !== null && vol.altura !== null;
          const dims = hasDims
            ? `${Number(vol.comprimento).toLocaleString('pt-BR', { minimumFractionDigits: 3 })}×${Number(vol.largura).toLocaleString('pt-BR', { minimumFractionDigits: 3 })}×${Number(vol.altura).toLocaleString('pt-BR', { minimumFractionDigits: 3 })} ${vol.dimensao_unidade}`
            : 'N/A';
          const volM3 = vol.volume_m3 != null
            ? Number(vol.volume_m3).toLocaleString('pt-BR', { minimumFractionDigits: 3 })
            : 'N/A';
          return (
            <tr key={vol.id} className={i % 2 === 0 ? '' : 'bg-muted/30'}>
              <td className="py-1.5 px-3">{emb}</td>
              <td className="py-1.5 px-3">{vol.quantity}</td>
              <td className="py-1.5 px-3">{peso}</td>
              <td className="py-1.5 px-3">{dims}</td>
              <td className="py-1.5 px-3">{volM3}</td>
            </tr>
          );
        })}
        <tr className="bg-blue-50 font-semibold border-t border-border">
          <td className="py-1.5 px-3">Total</td>
          <td className="py-1.5 px-3">{totalQty}</td>
          <td className="py-1.5 px-3">{totalPesoStr}</td>
          <td className="py-1.5 px-3">—</td>
          <td className="py-1.5 px-3">{totalM3Str}</td>
        </tr>
      </tbody>
    </table>
  );
}

function formatDestination(quotation: Quotation): string {
  if (quotation.porto_destino?.length) return quotation.porto_destino.join(', ');
  if (quotation.aeroporto_destino?.length) return quotation.aeroporto_destino.join(', ');
  return 'N/A';
}

function formatEmbarque(quotation: Quotation): string {
  if (quotation.modal === 'AEREO' && quotation.aeroporto_embarque) {
    return quotation.aeroporto_embarque;
  }
  if ((quotation.modal === 'MARITIMO' || quotation.modal === 'RODOVIARIO') && quotation.porto_embarque) {
    return quotation.porto_embarque;
  }
  if (quotation.agente_define_aeroporto_embarque || quotation.agente_define_porto_embarque) {
    return 'A definir pelo agente';
  }
  return 'N/A';
}

function formatOrigin(quotation: Quotation): string {
  if (quotation.origin) return quotation.origin;
  if (quotation.agente_define_local_coleta) return 'A definir pelo agente';
  return 'N/A';
}

function formatCargaPerigosa(quotation: Quotation): string {
  if (!quotation.carga_perigosa || quotation.carga_perigosa === 'NAO') return '';
  let result = quotation.carga_perigosa;
  if (quotation.un_number) result += ` (UN: ${quotation.un_number})`;
  if (quotation.imo_class) result += ` (IMO: ${quotation.imo_class})`;
  return result;
}

function formatTemperatura(quotation: Quotation): string {
  const { temperatura_min, temperatura_max } = quotation;
  if (temperatura_min === null && temperatura_max === null) return '';
  const parts: string[] = [];
  if (temperatura_min !== null) parts.push(`min ${Number(temperatura_min).toFixed(1)}°C`);
  if (temperatura_max !== null) parts.push(`max ${Number(temperatura_max).toFixed(1)}°C`);
  return parts.join(' / ');
}

function PreviewRow({
  label,
  value,
  shaded,
}: {
  label: string;
  value: string | null | undefined;
  shaded?: boolean;
}) {
  return (
    <tr className={shaded ? 'bg-muted/40' : ''}>
      <td className="py-1.5 px-3 w-48 font-medium text-sm text-foreground whitespace-nowrap">
        {label}
      </td>
      <td className="py-1.5 px-3 text-sm text-foreground">{value || 'N/A'}</td>
    </tr>
  );
}

export function RFQDispatchPreview({ quotation, rfq, agents }: RFQDispatchPreviewProps) {
  const { isAir, isMaritime, showNcm } = getFieldVisibility(quotation);

  const destination = formatDestination(quotation);
  const subject = `[RFQ] ${quotation.reference} — ${quotation.origin || 'N/A'} → ${destination} | ${quotation.modal || 'N/A'}`;

  const cargaPerigosa = formatCargaPerigosa(quotation);
  const temperatura = formatTemperatura(quotation);

  const equipments = isAir ? [] : (quotation.equipments ?? []);
  const volumes = quotation.volumes ?? [];
  const hasCargoData = equipments.length > 0 || volumes.length > 0;

  const rows: Array<{ label: string; value: string | null | undefined; show: boolean }> = [
    { label: 'Referência', value: quotation.reference, show: true },
    { label: 'Modal', value: quotation.modal, show: true },
    { label: 'Tipo de Embarque', value: quotation.tipo_embarque, show: isMaritime && !!quotation.tipo_embarque },
    { label: 'Tipo de Cotação', value: quotation.tipo_cotacao, show: true },
    { label: 'Data da Cotação', value: formatUtcDate(quotation.data_cotacao), show: true },
    { label: 'Prazo de Retorno', value: formatLocalDatetime(quotation.desired_deadline), show: true },
    { label: 'Ref. Cliente', value: quotation.client_reference || 'N/A', show: true },
    { label: 'Direção', value: quotation.service_type, show: true },
    { label: 'Incoterm', value: quotation.incoterm, show: true },
    { label: 'Origem', value: formatOrigin(quotation), show: true },
    { label: 'Embarque', value: formatEmbarque(quotation), show: true },
    { label: 'Destino', value: destination, show: true },
    { label: 'Entrega Final', value: boolDisplay(quotation.incluir_entrega_destino_final), show: true },
    { label: 'Local de Entrega', value: quotation.endereco_entrega_final || 'N/A', show: !!quotation.incluir_entrega_destino_final },
    { label: 'Mercadoria', value: quotation.product, show: true },
    { label: 'Carga Perigosa', value: cargaPerigosa, show: !!cargaPerigosa },
    { label: 'Temperatura', value: temperatura, show: !!temperatura },
    { label: 'Seguro', value: boolDisplay(rfq.include_insurance), show: true },
    { label: 'Valor Declarado', value: formatDeclaredValue(quotation), show: true },
    { label: 'Empilhável', value: boolDisplay(quotation.stackability), show: true },
    { label: 'Tombável', value: boolDisplay(quotation.carga_tombavel), show: true },
    { label: 'Recinto de Destino', value: quotation.destination_yard || 'N/A', show: !isAir && !!quotation.destination_yard },
    { label: 'PTAX Negociada', value: quotation.ptax_negociada || 'N/A', show: true },
    { label: 'NCM', value: quotation.ncm || 'N/A', show: showNcm },
  ];

  const visibleRows = rows.filter((r) => r.show);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border bg-muted/20 overflow-hidden">
        <div className="border-b bg-muted/50 px-4 py-2.5">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Assunto
          </p>
          <p className="text-sm font-semibold mt-0.5 text-foreground">{subject}</p>
        </div>

        <div className="px-4 py-3 border-b">
          <p className="text-xs text-muted-foreground mb-1">Destinatários</p>
          <div className="flex flex-wrap gap-1">
            {agents.map((agent) => (
              <span
                key={agent.id}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-primary/10 text-primary font-medium"
              >
                {agent.name}
              </span>
            ))}
          </div>
        </div>

        <div className="px-4 py-3">
          <p className="text-sm text-foreground mb-3">
            Prezado(a) <strong>[Agente]</strong>,
          </p>
          <p className="text-sm text-muted-foreground mb-3">
            Solicitamos cotação de frete internacional conforme abaixo:
          </p>

          {quotation.observations && (
            <div className="mb-3">
              <p className="text-sm font-semibold">Observações:</p>
              <p className="text-sm text-foreground whitespace-pre-wrap mt-0.5">
                {quotation.observations}
              </p>
            </div>
          )}

          <table className="w-full border border-border rounded overflow-hidden text-sm mb-4">
            <tbody>
              {visibleRows.map((row, i) => (
                <PreviewRow
                  key={row.label}
                  label={row.label}
                  value={row.value}
                  shaded={i % 2 === 0}
                />
              ))}
            </tbody>
          </table>

          {hasCargoData && (
            <div className="mb-4">
              <p className="text-sm font-semibold mb-2">Dados da Carga:</p>

              {equipments.length > 0 && (
                <table className="w-full border border-border rounded overflow-hidden text-sm mb-2">
                  <thead>
                    <tr className="bg-muted/60">
                      <th className="py-1.5 px-3 text-left font-medium">Container</th>
                      <th className="py-1.5 px-3 text-left font-medium">Qtd</th>
                      <th className="py-1.5 px-3 text-left font-medium">Peso Bruto</th>
                      <th className="py-1.5 px-3 text-left font-medium">Volume (m³)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipments.map((eq, i) => {
                      const label = TIPO_CONTAINER_LABELS[eq.tipo_container] ?? eq.tipo_container;
                      const peso = eq.peso_bruto
                        ? `${Number(eq.peso_bruto).toLocaleString('pt-BR', { minimumFractionDigits: 3 })} ${eq.peso_unidade}`
                        : 'N/A';
                      const volume = eq.volume_m3
                        ? Number(eq.volume_m3).toLocaleString('pt-BR', { minimumFractionDigits: 3 })
                        : 'N/A';
                      return (
                        <tr key={eq.id} className={i % 2 === 0 ? '' : 'bg-muted/30'}>
                          <td className="py-1.5 px-3">{label}</td>
                          <td className="py-1.5 px-3">{eq.quantity}</td>
                          <td className="py-1.5 px-3">{peso}</td>
                          <td className="py-1.5 px-3">{volume}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {volumes.length > 0 && <VolumesTable volumes={volumes} />}
            </div>
          )}

          <div className="mt-3 pt-3 border-t">
            <div className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium opacity-70 cursor-default">
              Enviar proposta pelo portal
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Atenciosamente,
              <br />
              <strong>Equipe Freitas COMEX</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

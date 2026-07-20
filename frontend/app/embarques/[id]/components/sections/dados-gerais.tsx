'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { useAutosave } from '@/hooks/use-autosave';
import { updateShipment } from '@/hooks/use-shipments';
import type { ShipmentDetail } from '@/types/shipment';
import { MODAL_LABELS, TIPO_EMBARQUE_LABELS } from '@/types/quotation';
import { TIPO_DESPACHO_LABELS } from '@/types/shipment';
import { ESTADO_BADGE } from '../../../kanban/constants';
import { AutoSaveIndicator } from '@/components/auto-save-indicator';
import type { UpdateShipmentPayload } from '@/types/shipment';

interface DadosGeraisProps {
  shipment: ShipmentDetail;
}

function LabelValue({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children ?? '—'}</div>
    </div>
  );
}

// Stable references (module scope) so useAutosave's effect doesn't re-run every render.
function buildObservacaoPayload(value: string): UpdateShipmentPayload {
  return { observacao: value };
}

function buildInovaProcessoIdPayload(value: string): UpdateShipmentPayload {
  return { inova_processo_id: value || null };
}

export function DadosGerais({ shipment }: DadosGeraisProps) {
  const [observacao, setObservacao] = useState(shipment.observacao ?? '');
  const { autoSaveStatus: status } = useAutosave({
    id: shipment.id,
    values: observacao,
    buildPayload: buildObservacaoPayload,
    save: updateShipment,
  });

  const [inovaProcessoId, setInovaProcessoId] = useState(shipment.inova_processo_id ?? '');
  const { autoSaveStatus: inovaStatus } = useAutosave({
    id: shipment.id,
    values: inovaProcessoId,
    buildPayload: buildInovaProcessoIdPayload,
    save: updateShipment,
  });

  const estado = ESTADO_BADGE[shipment.estado];

  return (
    <div className="space-y-6">
      {!shipment.inova_processo_id && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900 [&>svg]:text-amber-600">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Sincronização com a Inova inativa — número do processo não preenchido.
            Preencha o campo &quot;Número do processo na Inova&quot; abaixo assim que
            souber.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        <LabelValue label="Referência">{shipment.referencia}</LabelValue>
        <LabelValue label="Estado">
          {estado && (
            <Badge variant="outline" className={cn('text-xs', estado.className)}>
              {estado.label}
            </Badge>
          )}
        </LabelValue>
        <LabelValue label="Carga urgente">
          {shipment.carga_urgente ? (
            <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/30">
              Urgente
            </Badge>
          ) : (
            'Não'
          )}
        </LabelValue>
        <LabelValue label="Cliente">{shipment.cliente.nome}</LabelValue>
        <LabelValue label="Agente">{shipment.agente?.nome ?? '—'}</LabelValue>
        <LabelValue label="Modal">
          {shipment.modal ? MODAL_LABELS[shipment.modal] ?? shipment.modal : '—'}
        </LabelValue>
        <LabelValue label="Incoterm">{shipment.incoterm ?? '—'}</LabelValue>
        <LabelValue label="Tipo de embarque">
          {shipment.tipo_embarque ? TIPO_EMBARQUE_LABELS[shipment.tipo_embarque] ?? shipment.tipo_embarque : '—'}
        </LabelValue>
        <LabelValue label="Estilo de processo">
          {shipment.tipo_despacho ? TIPO_DESPACHO_LABELS[shipment.tipo_despacho] : '—'}
        </LabelValue>
        <LabelValue label="Cotação vinculada">
          {shipment.quotation_id ? (
            <Link
              href={`/cotacao/${shipment.quotation_id}`}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Ver cotação
              <ExternalLink className="h-3 w-3" />
            </Link>
          ) : (
            'Sem cotação'
          )}
        </LabelValue>
        <LabelValue label="Criado em">
          {new Date(shipment.created_at).toLocaleString('pt-BR')}
        </LabelValue>
      </div>

      <div className="space-y-2 max-w-sm">
        <div className="flex items-center justify-between">
          <label htmlFor="inova_processo_id" className="text-xs font-medium text-muted-foreground">
            Número do processo na Inova
          </label>
          <AutoSaveIndicator status={inovaStatus} />
        </div>
        <Input
          id="inova_processo_id"
          value={inovaProcessoId}
          onChange={(e) => setInovaProcessoId(e.target.value)}
          placeholder="Ex: FRT0585.II"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="observacao" className="text-xs font-medium text-muted-foreground">
            Observação
          </label>
          <AutoSaveIndicator status={status} />
        </div>
        <Textarea
          id="observacao"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          rows={4}
          placeholder="Notas internas sobre o embarque..."
        />
      </div>
    </div>
  );
}

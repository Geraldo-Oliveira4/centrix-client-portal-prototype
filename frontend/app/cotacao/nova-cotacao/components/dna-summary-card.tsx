'use client';

import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui';
import type { ClientDna, QuotationClient } from '@/types/client';
import {
  INSURANCE_RESPONSIBILITY_LABELS as INSURANCE_LABEL,
  LOGISTICS_TYPE_LABELS as LOGISTICS_LABEL,
  MODAL_LABELS as MODALITY_LABEL,
  PRICE_OR_PERFORMANCE_LABELS as PRICE_PERF_LABEL,
  TIPO_EMBARQUE_LABELS as TIPO_EMBARQUE_LABEL,
} from '@/types/client';

interface DnaSummaryCardProps {
  client: QuotationClient;
  dna: ClientDna | null | undefined;
}

export function DnaSummaryCard({ client, dna }: DnaSummaryCardProps) {
  const insuranceValue = dna?.insurance_responsibility?.value;

  return (
    <div className="border rounded-lg p-4 bg-muted/30 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">{client.name}</span>
        {client.is_vip && (
          <Badge variant="secondary" className="text-xs">
            Crítico
          </Badge>
        )}
      </div>

      {dna ? (
        <>
          {/* Insurance responsibility — critical field */}
          <div
            className={`flex items-center gap-2 rounded p-2 text-xs font-medium ${
              insuranceValue
                ? 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400'
                : 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400'
            }`}
          >
            {insuranceValue ? (
              <ShieldCheck className="w-4 h-4 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 shrink-0" />
            )}
            <span>
              Seguro:{' '}
              {insuranceValue
                ? INSURANCE_LABEL[insuranceValue] ?? insuranceValue
                : 'Não definido (campo crítico)'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {dna.modality && (
              <span>
                <span className="font-medium text-foreground">Modalidade:</span>{' '}
                {MODALITY_LABEL[dna.modality] ?? dna.modality}
              </span>
            )}
            {dna.tipo_embarque && (
              <span>
                <span className="font-medium text-foreground">Embarque:</span>{' '}
                {TIPO_EMBARQUE_LABEL[dna.tipo_embarque] ?? dna.tipo_embarque}
              </span>
            )}
            {dna.logistics_type && (
              <span>
                <span className="font-medium text-foreground">Logística:</span>{' '}
                {LOGISTICS_LABEL[dna.logistics_type] ?? dna.logistics_type}
              </span>
            )}
            {dna.destination_yard_aereo && (
              <span>
                <span className="font-medium text-foreground">Recinto (Aéreo):</span>{' '}
                {dna.destination_yard_aereo}
              </span>
            )}
            {dna.destination_yard_maritimo_fcl && (
              <span>
                <span className="font-medium text-foreground">Recinto (Marítimo FCL):</span>{' '}
                {dna.destination_yard_maritimo_fcl}
              </span>
            )}
            {dna.destination_yard_maritimo_lcl && (
              <span>
                <span className="font-medium text-foreground">Recinto (Marítimo LCL):</span>{' '}
                {dna.destination_yard_maritimo_lcl}
              </span>
            )}
            {dna.price_or_performance && (
              <span>
                <span className="font-medium text-foreground">Prioridade:</span>{' '}
                {PRICE_PERF_LABEL[dna.price_or_performance] ??
                  dna.price_or_performance}
              </span>
            )}
            {dna.contact_name && (
              <span>
                <span className="font-medium text-foreground">Contato:</span>{' '}
                {dna.contact_name}
              </span>
            )}
            {dna.contact_email && (
              <span className="col-span-2">
                <span className="font-medium text-foreground">Email:</span>{' '}
                {dna.contact_email}
              </span>
            )}
          </div>

          {dna.quotation_particularities && (
            <div className="text-xs border-t pt-2 mt-1">
              <span className="font-medium text-foreground">
                Particularidades:{' '}
              </span>
              <span className="text-muted-foreground">
                {dna.quotation_particularities}
              </span>
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          DNA não cadastrado para este cliente.
        </p>
      )}
    </div>
  );
}

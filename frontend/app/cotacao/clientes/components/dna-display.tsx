'use client';

import { ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui';
import { useFreightAgents } from '@/hooks/use-freight-agents';
import {
  ClientDna,
  INSURANCE_RESPONSIBILITY_LABELS as INSURANCE_LABELS,
  LOGISTICS_TYPE_LABELS,
  MODAL_LABELS,
  PRICE_OR_PERFORMANCE_LABELS,
  TIPO_EMBARQUE_LABELS,
} from '@/types/client';

interface FieldRowProps {
  label: string;
  value: React.ReactNode;
}

function FieldRow({ label, value }: FieldRowProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
        {label}
      </span>
      <span className="text-sm">{value ?? <span className="text-muted-foreground">—</span>}</span>
    </div>
  );
}

interface DnaDisplayProps {
  dna: ClientDna;
}

export function DnaDisplay({ dna }: DnaDisplayProps) {
  const { agents } = useFreightAgents();
  const insuranceValue = dna.insurance_responsibility?.value;

  const preferredAgentNames = dna.default_agents
    ? Object.keys(dna.default_agents).map(id => {
        const agent = agents?.find(a => a.id === id);
        return agent?.name ?? id;
      })
    : [];

  return (
    <div className="flex flex-col gap-4">
      {/* insurance_responsibility — campo crítico (RF-COT-101) */}
      <div className="rounded-md border-2 border-red-400 bg-red-50 dark:bg-red-950/20 p-3 flex flex-col gap-1">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wide">
            Responsabilidade pelo Seguro — Campo Crítico
          </span>
        </div>
        <span className="text-sm font-medium">
          {insuranceValue ? INSURANCE_LABELS[insuranceValue] : <span className="text-muted-foreground">—</span>}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FieldRow
          label="Modalidade"
          value={dna.modality ? MODAL_LABELS[dna.modality] : null}
        />
        {dna.tipo_embarque && (
          <FieldRow
            label="Tipo de Embarque"
            value={TIPO_EMBARQUE_LABELS[dna.tipo_embarque]}
          />
        )}
        <FieldRow
          label="Tipo de Logística"
          value={dna.logistics_type ? LOGISTICS_TYPE_LABELS[dna.logistics_type] : null}
        />
        <FieldRow
          label="Recinto de Destino — Aéreo"
          value={dna.destination_yard_aereo}
        />
        <FieldRow
          label="Recinto de Destino — Marítimo FCL"
          value={dna.destination_yard_maritimo_fcl}
        />
        <FieldRow
          label="Recinto de Destino — Marítimo LCL"
          value={dna.destination_yard_maritimo_lcl}
        />
        <FieldRow
          label="Preço ou Performance"
          value={dna.price_or_performance ? PRICE_OR_PERFORMANCE_LABELS[dna.price_or_performance] : null}
        />
        <FieldRow
          label="Perfil de Carga"
          value={dna.cargo_profile}
        />
        <FieldRow
          label="Shipper Cargas Perigosas"
          value={
            dna.dangerous_cargo_shipper === null ? null : (
              <Badge
                variant="outline"
                className={
                  dna.dangerous_cargo_shipper
                    ? 'border-orange-300 text-orange-700 bg-orange-50'
                    : 'border-green-300 text-green-700 bg-green-50'
                }
              >
                {dna.dangerous_cargo_shipper ? 'Sim' : 'Não'}
              </Badge>
            )
          }
        />
        <FieldRow
          label="Contato Principal"
          value={
            dna.contact_name
              ? `${dna.contact_name}${dna.contact_email ? ` — ${dna.contact_email}` : ''}`
              : null
          }
        />
        <FieldRow
          label="Analista Responsável"
          value={dna.assigned_analyst}
        />
        <FieldRow
          label="Exige OEA"
          value={
            dna.exige_oea === null || dna.exige_oea === undefined ? null : (
              <Badge
                variant="outline"
                className={
                  dna.exige_oea
                    ? 'border-blue-300 text-blue-700 bg-blue-50'
                    : 'border-gray-300 text-gray-700 bg-gray-50'
                }
              >
                {dna.exige_oea ? 'Sim' : 'Não'}
              </Badge>
            )
          }
        />
      </div>

      {preferredAgentNames.length > 0 && (
        <FieldRow
          label="Agentes Preferidos"
          value={
            <div className="flex flex-wrap gap-1.5 mt-0.5">
              {preferredAgentNames.map(name => (
                <Badge
                  key={name}
                  variant="outline"
                  className="border-primary/30 text-foreground bg-primary/5"
                >
                  {name}
                </Badge>
              ))}
            </div>
          }
        />
      )}

      {dna.quotation_particularities && (
        <FieldRow
          label="Particularidades para Cotar"
          value={dna.quotation_particularities}
        />
      )}

      {dna.updated_at && (
        <p className="text-xs text-muted-foreground">
          Atualizado em{' '}
          {new Date(dna.updated_at).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      )}
    </div>
  );
}

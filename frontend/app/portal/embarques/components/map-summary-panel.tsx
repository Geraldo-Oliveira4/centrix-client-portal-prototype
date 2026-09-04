'use client';

import { cn } from '@/lib/utils';
import {
  SEMAFORO_LABELS,
  countBySemaforo,
  type PortalShipment,
  type SemaforoTone,
} from '@/types/portal-shipment';

// Coluna esquerda do Mapa: a leitura agregada da operação inteira.
//
// Deliberadamente NÃO é o mesmo desenho do contador da Lista (`SemaforoCounter`,
// pontinho + número + rótulo numa linha). Ali a pergunta é "quantos de cada tipo
// existem nesta lista que estou filtrando"; aqui é "como está a operação". Por
// isso: número grande na cor do semáforo, empilhado, sem interação — nada aqui
// filtra o mapa, para a regra "mapa = visão geográfica, sem filtro/busca" seguir
// valendo.
//
// A fonte é a MESMA (`countBySemaforo` sobre os embarques do cliente), então os
// dois números nunca podem discordar.

const TONE_TEXT: Record<SemaforoTone, string> = {
  success: 'text-portal-success',
  warning: 'text-portal-warning-ink',
  danger: 'text-portal-danger',
};

// O card fica ao lado do chip "Com atraso" e conta OUTRA coisa: aqui é o estado
// do embarque no GE, lá é o deslize de ETA da companhia. Os rótulos vêm de
// `SEMAFORO_LABELS`, onde a distinção está justificada — e é por isso que nenhum
// deles fala em "atraso".
const TONE_HINT: Record<SemaforoTone, string> = {
  success: 'seguindo o curso normal',
  warning: 'adiados, com nova data em tratativa',
  danger: 'precisam de tratativa',
};

const TONES: SemaforoTone[] = ['success', 'warning', 'danger'];

export function MapSummaryPanel({ shipments }: { shipments: PortalShipment[] }) {
  const counts = countBySemaforo(shipments);

  return (
    // `self-start`: o card abraça o conteúdo em vez de esticar até a altura da
    // linha do grid. Esticado, ele virava uma coluna quase vazia ao lado do
    // mapa — peso visual sem informação.
    <section className="portal-card space-y-5 self-start p-5">
      <div className="space-y-0.5">
        <p className="portal-h3">Visão do todo</p>
        <p className="portal-small text-portal-neutral">
          {shipments.length}{' '}
          {shipments.length === 1
            ? 'embarque em acompanhamento'
            : 'embarques em acompanhamento'}
        </p>
      </div>

      <div className="space-y-4">
        {TONES.map((tone) => (
          <div key={tone} className="flex items-baseline gap-3">
            <span
              className={cn(
                'text-3xl font-semibold leading-none tabular-nums',
                TONE_TEXT[tone],
              )}
            >
              {counts[tone]}
            </span>
            <div className="min-w-0">
              <p className="portal-body font-medium text-foreground">
                {SEMAFORO_LABELS[tone]}
              </p>
              <p className="portal-small text-portal-neutral">{TONE_HINT[tone]}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

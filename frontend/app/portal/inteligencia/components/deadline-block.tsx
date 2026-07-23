'use client';

import { CalendarClock } from 'lucide-react';

import { useMyShipments } from '@/hooks/use-portal-shipments';

import { IntelBlock } from './intel-block';

// MOCK figure. There is no ETA nor arrival history in this prototype
// (processos.datas is NULL and there is no transition-log table), so an
// on-time rate cannot be computed from real data yet.
const MOCK_ON_TIME_PCT = 87;

/**
 * PREVIEW. Illustrative on-time rate. The denominator context (how many
 * shipments the client is currently following) is real, but the percentage is
 * fabricated.
 */
export function DeadlineBlock() {
  const { total } = useMyShipments();

  return (
    <IntelBlock
      icon={<CalendarClock className="h-5 w-5" />}
      title="Prazo"
      question="A carga chegará quando a empresa precisa?"
      provenance="preview"
      footnote="Percentual ilustrativo. Não há ETA nem histórico de datas de chegada neste protótipo, então este indicador ainda não pode ser calculado a partir de dados reais."
    >
      <div className="space-y-2">
        <p className="text-3xl font-semibold leading-none text-foreground">
          {MOCK_ON_TIME_PCT}%
        </p>
        <p className="portal-small text-portal-neutral">
          dos embarques teriam chegado dentro do prazo estimado (ilustrativo)
        </p>
        {total > 0 ? (
          <p className="portal-small text-portal-neutral">
            Base ilustrativa sobre {total} embarque(s) em acompanhamento.
          </p>
        ) : null}
      </div>
    </IntelBlock>
  );
}

'use client';

import { cn } from '@/lib/utils';
import type { PortalShipmentTracking } from '@/types/portal-shipment';

import { IncompleteDataBadge } from '../../_shared/incomplete-data-badge';
import { ProvenanceBadge } from '../../_shared/provenance-badge';
import { delayRiskFromTracking, type DelayRisk } from '../lib/delay-risk';

/**
 * Delay risk badge: 🟢 no prazo / 🟠 atenção +N / 🔴 atraso +N, plus the two
 * no-number states (pending integration, incomplete carrier data).
 *
 * The number IS shown next to the colour, unlike the AI score elsewhere in the
 * portal: this is arithmetic on two dates the carrier published (current ETA
 * minus first ETA), not a model's estimate, so it is reproducible and the
 * client can check it. Nothing is rendered from a guess — with the ShipsGo
 * columns still NULL every shipment lands on "Pendente integração".
 *
 * The colours here are the same three health tones the shipment semáforo uses,
 * and that is intentional: a delay IS shipment health. The INCOMPLETE state is
 * the one that must stay off that scale — it is about the data, not the cargo.
 */

const TONE_CLASS: Record<'on_time' | 'attention' | 'delayed', string> = {
  on_time: 'border-portal-success/25 bg-portal-success/10 text-portal-success',
  attention: 'border-portal-warning/30 bg-portal-warning/10 text-portal-warning-ink',
  delayed: 'border-portal-danger/30 bg-portal-danger/10 text-portal-danger',
};

const DOT_CLASS: Record<'on_time' | 'attention' | 'delayed', string> = {
  on_time: 'bg-portal-success',
  attention: 'bg-portal-warning',
  delayed: 'bg-portal-danger',
};

export function DelayRiskBadge({
  risk,
  className,
}: {
  risk: DelayRisk;
  className?: string;
}) {
  if (risk.status === 'pending') {
    return <ProvenanceBadge provenance="pending" className={className} />;
  }
  if (risk.status === 'incomplete') {
    return <IncompleteDataBadge className={className} />;
  }

  return (
    <span
      className={cn(
        'portal-small inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-medium',
        TONE_CLASS[risk.status],
        className,
      )}
      title={
        risk.basis === 'actual'
          ? 'Comparação entre a chegada real e a primeira previsão da companhia'
          : 'Comparação entre a previsão atual e a primeira previsão da companhia'
      }
    >
      <span className={cn('h-2 w-2 rounded-full', DOT_CLASS[risk.status])} />
      {risk.label}
    </span>
  );
}

/** Same badge, straight from the shipment payload. */
export function ShipmentDelayRiskBadge({
  tracking,
  className,
}: {
  tracking: PortalShipmentTracking | null | undefined;
  className?: string;
}) {
  return (
    <DelayRiskBadge risk={delayRiskFromTracking(tracking)} className={className} />
  );
}

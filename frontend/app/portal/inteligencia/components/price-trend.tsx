'use client';

import { TrendingUp } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { PriceAlert, PriceAlertType, PriceRadarRoute } from '../lib/price-radar';

/**
 * O desenho do semáforo do Radar de Preços, num lugar só.
 *
 * Nasceu dentro de `radar/page.tsx` e saiu de lá em 28/08/2026, quando o bloco
 * "Mercado" do detalhe da cotação passou a mostrar a tendência da rota. Duas
 * telas pintando "Alta significativa" com verdes e vermelhos próprios seria a
 * mesma classificação dizendo coisas diferentes conforme a tela — o oposto do
 * que a fonte única de `price-radar.ts` garante do lado do cálculo.
 *
 * Presentacional puro: nada aqui decide tipo de alerta nem direção de
 * tendência. Isso vem pronto de `price-radar.ts`.
 */

export const PRICE_ALERT_CLASS: Record<PriceAlertType, string> = {
  oportunidade: 'border-portal-success/30 bg-portal-success/10 text-portal-success',
  atencao: 'border-portal-warning/30 bg-portal-warning/10 text-portal-warning',
  alta: 'border-portal-danger/30 bg-portal-danger/10 text-portal-danger',
};

const ALERT_DOT: Record<PriceAlertType, string> = {
  oportunidade: 'bg-portal-success',
  atencao: 'bg-portal-warning',
  alta: 'bg-portal-danger',
};

/** O chip com o rótulo do alerta, na cor do semáforo. */
export function PriceAlertBadge({
  alert,
  className,
}: {
  alert: PriceAlert;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'portal-small inline-flex items-center gap-1.5 whitespace-nowrap rounded border px-2 py-0.5 font-medium',
        PRICE_ALERT_CLASS[alert.type],
        className,
      )}
    >
      <span className={cn('h-2 w-2 rounded-full', ALERT_DOT[alert.type])} />
      {alert.label}
    </span>
  );
}

/**
 * "Subiu 12% nas últimas 2 semanas", com a seta na direção certa.
 *
 * A cor aqui NÃO é o semáforo do alerta: para quem compra frete, subir é ruim e
 * cair é bom, sempre — independentemente de a lane estar ou não numa janela de
 * ação, que é o que o badge acima responde.
 */
export function PriceTrendLine({
  route,
  className,
}: {
  route: Pick<PriceRadarRoute, 'trendPct' | 'trendWindowDays'>;
  className?: string;
}) {
  const rising = route.trendPct > 0;
  const flat = route.trendPct === 0;
  return (
    <p
      className={cn(
        'portal-small flex items-center gap-1.5 text-portal-neutral',
        className,
      )}
    >
      <TrendingUp
        className={cn(
          'h-4 w-4 shrink-0',
          flat ? '' : rising ? 'text-portal-danger' : 'text-portal-success',
          !rising && !flat && 'rotate-180',
        )}
      />
      {flat ? (
        <>Estável nas últimas {route.trendWindowDays / 7} semanas</>
      ) : (
        <>
          <span
            className={cn(
              'font-medium',
              rising ? 'text-portal-danger' : 'text-portal-success',
            )}
          >
            {rising ? 'Subiu' : 'Caiu'} {Math.abs(route.trendPct)}%
          </span>
          nas últimas {route.trendWindowDays / 7} semanas
        </>
      )}
    </p>
  );
}

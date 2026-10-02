'use client';

import { useMemo, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CalendarX,
  Clock3,
  OctagonAlert,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import type { PortalShipment } from '@/types/portal-shipment';

import { collectHomeActions } from '../../home/lib/home-actions';
import { REAL_STEPS } from '../lib/real-steps';
import {
  buildShipmentIndicators,
  SHIPMENT_INDICATOR_DEFINITIONS,
  SHIPMENT_INDICATOR_KEYS,
  SHIPMENT_INDICATOR_LABELS,
  type ShipmentIndicatorKey,
  type ShipmentIndicators,
} from '../lib/shipment-indicators';

/**
 * A fila de ações de embarque + os indicadores, numa chamada. Toda tela que
 * mostra um indicador passa por aqui (ou pelo `buildShipmentIndicators` com a
 * mesma fila), e é isso que faz Panorama, lista, Visão por PO e Home
 * imprimirem o mesmo número. Sem baldes de cotação: indicador de EMBARQUE só
 * conta ação de embarque.
 */
export function useShipmentIndicators(shipments: PortalShipment[], now: Date) {
  return useMemo(() => {
    const actions = collectHomeActions({
      shipments,
      buckets: {},
      realSteps: REAL_STEPS,
      now,
    });
    return {
      actions,
      indicators: buildShipmentIndicators(shipments, actions, now),
    };
  }, [shipments, now]);
}

const ICONS: Record<ShipmentIndicatorKey, LucideIcon> = {
  action: AlertTriangle,
  delayed: Clock3,
  upcoming: CalendarDays,
  no_forecast: CalendarX,
  exception: OctagonAlert,
};

/**
 * A faixa de indicadores — UM desenho para as quatro telas.
 *
 * Cor segue a escala de urgência (`_shared/urgency.ts`): só "Precisam de você"
 * ganha o tom de atenção, e só quando há algo; é o único indicador que pede
 * ação do cliente. Atraso, previsão e exceção são informação: ícone neutro,
 * número na tinta da marca. Nunca vermelho aqui.
 *
 * `onSelect` transforma os cartões em recortes (Panorama, lista, Visão por PO);
 * sem ele a faixa é só leitura (Home). `variant="navy"` é a do banner da Home.
 */
export function ShipmentIndicatorStrip({
  indicators,
  active = null,
  onSelect,
  variant = 'light',
  unit = 'embarques',
  children,
  className,
}: {
  indicators: ShipmentIndicators;
  active?: ShipmentIndicatorKey | null;
  onSelect?: (key: ShipmentIndicatorKey | null) => void;
  variant?: 'light' | 'navy';
  /** Só para o texto de acessibilidade: o número sempre conta embarques. */
  unit?: string;
  /** Um cartão extra no fim da faixa (ex.: "Em análise pela Freitas"). */
  children?: ReactNode;
  className?: string;
}) {
  if (variant === 'navy') {
    return (
      <ul
        className={cn('flex flex-wrap gap-2', className)}
        aria-label="Indicadores dos seus embarques"
      >
        {SHIPMENT_INDICATOR_KEYS.map((key) => {
          const count = indicators[key].size;
          return (
            <li
              key={key}
              className="portal-small flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1 text-white/85"
              title={SHIPMENT_INDICATOR_DEFINITIONS[key]}
            >
              {SHIPMENT_INDICATOR_LABELS[key]}
              <span
                className={cn(
                  'font-semibold tabular-nums',
                  key === 'action' && count > 0
                    ? 'text-portal-warning'
                    : 'text-white',
                )}
              >
                {count}
              </span>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div
      className={cn(
        'grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-3 lg:grid-cols-5',
        children ? 'xl:grid-cols-6' : null,
        className,
      )}
      role="group"
      aria-label="Indicadores dos embarques"
    >
      {SHIPMENT_INDICATOR_KEYS.map((key) => {
        const Icon = ICONS[key];
        const count = indicators[key].size;
        const pressed = active === key;
        const attention = key === 'action' && count > 0;
        const body = (
          <>
            <span className="flex items-start justify-between gap-2">
              <span className="portal-small font-medium text-foreground">
                {SHIPMENT_INDICATOR_LABELS[key]}
              </span>
              <Icon
                className={cn(
                  'mt-0.5 h-4 w-4 shrink-0',
                  attention ? 'text-portal-warning-ink' : 'text-portal-neutral',
                )}
                aria-hidden="true"
              />
            </span>
            <span className="mt-1 flex items-end justify-between">
              <span className="text-3xl font-semibold tabular-nums tracking-tight text-brand-indigo">
                {count}
              </span>
              {onSelect && (
                <ArrowRight
                  className="mb-1 h-4 w-4 text-portal-neutral transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              )}
            </span>
          </>
        );
        const cell =
          'group relative min-w-0 border-b border-r border-border px-4 py-3 text-left';
        return onSelect ? (
          <button
            key={key}
            type="button"
            aria-pressed={pressed}
            aria-label={`${SHIPMENT_INDICATOR_LABELS[key]}: ${count} ${unit}. ${SHIPMENT_INDICATOR_DEFINITIONS[key]}`}
            title={SHIPMENT_INDICATOR_DEFINITIONS[key]}
            onClick={() => onSelect(pressed ? null : key)}
            className={cn(
              cell,
              'transition-colors focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-brand-indigo',
              pressed
                ? 'bg-brand-indigo-100 shadow-[inset_0_-2px_0] shadow-brand-indigo'
                : attention
                  ? 'bg-brand-orange/5 hover:bg-brand-orange/10'
                  : 'hover:bg-muted/50',
            )}
          >
            {body}
          </button>
        ) : (
          <div key={key} className={cell} title={SHIPMENT_INDICATOR_DEFINITIONS[key]}>
            {body}
          </div>
        );
      })}
      {children}
    </div>
  );
}

'use client';

import { Route } from 'lucide-react';

import { cn } from '@/lib/utils';

import { SectionHeading } from '../../../_shared/page-header';
import { ProvenanceBadge } from '../../../_shared/provenance-badge';
import type { RouteDeviation } from '../../lib/shipment-dimensions';

/**
 * "Rotas com maiores desvios" — média de dias de atraso por rota.
 *
 * Selo `preview` desde 12/08/2026 (era `pending`). O CÁLCULO é real — a mesma
 * `computeDelayRisk` que a Lista de embarques usa, reproduzível linha a linha.
 * O que é ilustrativo é o RÓTULO: a maioria dos embarques não tem cotação
 * vinculada, então a rota vem do hub ilustrativo (ver `shipment-dimensions.ts`).
 * Quando a integração ShipsGo e o vínculo com a cotação existirem, este bloco
 * vira `real` sem mudar uma linha do cálculo.
 *
 * Por isso o bloco mostra a contagem de embarques MEDIDOS ao lado de cada média:
 * é o leitor que precisa ver que "+6 dias" veio de um embarque, não de trinta.
 */
export function RouteDeviationsBlock({ routes }: { routes: RouteDeviation[] }) {
  return (
    <section className="space-y-4 rounded-xl border border-dashed border-border bg-muted/20 p-6">
      <SectionHeading
        title="Rotas com maiores desvios"
        hint="média de dias sobre o primeiro ETA"
        icon={<Route className="h-5 w-5" />}
        action={<ProvenanceBadge provenance="preview" />}
      />

      {routes.length === 0 ? (
        <p className="portal-body text-portal-neutral">
          Nenhum embarque seu tem rastreamento da companhia ainda, então não há
          desvio para medir. As rotas aparecem aqui automaticamente quando a
          integração começar a reportar ETA.
        </p>
      ) : (
        <ol className="space-y-3">
          {routes.map((route, index) => (
            <li
              key={route.route}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-dashed pb-3 last:border-0 last:pb-0"
            >
              <span className="inline-flex items-center gap-2">
                <span className="portal-small w-4 shrink-0 text-portal-neutral">
                  {index + 1}.
                </span>
                <span className="portal-body font-medium text-foreground">
                  {route.route}
                </span>
              </span>
              <span className="inline-flex items-center gap-2">
                <span
                  className={cn(
                    'portal-body font-medium',
                    route.avgDeltaDays > 3
                      ? 'text-portal-danger'
                      : route.avgDeltaDays > 0
                        ? 'text-portal-warning-ink'
                        : 'text-portal-success',
                  )}
                >
                  Média:{' '}
                  {route.avgDeltaDays > 0 ? '+' : ''}
                  {route.avgDeltaDays}{' '}
                  {Math.abs(route.avgDeltaDays) === 1 ? 'dia' : 'dias'}
                </span>
                <span className="portal-small text-portal-neutral">
                  ({route.shipments}{' '}
                  {route.shipments === 1 ? 'embarque medido' : 'embarques medidos'})
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}

      <p className="portal-small border-t border-dashed pt-3 text-portal-neutral">
        Desvio = ETA atual (ou chegada real) menos o primeiro ETA publicado pela
        companhia, o mesmo cálculo do risco de atraso na Lista de embarques. A
        rota vem da cotação de origem, não da origem ilustrativa do mapa. Só
        entram embarques com rastreamento — sem dado, o embarque fica de fora em
        vez de contar como zero.
      </p>
    </section>
  );
}

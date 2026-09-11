'use client';

import Link from 'next/link';
import { ArrowRight, Radar } from 'lucide-react';

import type { PriceRadarRoute } from '../../inteligencia/lib/price-radar';
import { formatRadarRoute } from '../../inteligencia/lib/price-radar';
import {
  PriceAlertBadge,
  PriceTrendLine,
} from '../../inteligencia/components/price-trend';

/**
 * "Tendência de preço das suas rotas" — o Radar de Preços condensado em card.
 *
 * ADAPTADO DE `price-trend.tsx`, NÃO DE `market-block.tsx`, e a escolha foi por
 * custo de adaptação: `price-trend` já é presentacional puro (`PriceAlertBadge`
 * + `PriceTrendLine` recebem uma `PriceRadarRoute` e desenham), enquanto
 * `MarketBlock` é escopado a UMA cotação — ele resolve proposta de referência,
 * busca as próprias hooks e cai num ramo de histórico quando a rota está fora
 * do Radar. Nada disso faz sentido numa Home que fala da carteira inteira, e
 * arrancar aquilo seria reescrever o bloco, não reaproveitá-lo.
 *
 * NÃO CALCULA NADA E NÃO CLASSIFICA NADA. As rotas chegam prontas de
 * `computePriceRadar` (a mesma função, o mesmo `limit` e a mesma ordem que a
 * aba Radar roda), e o badge e a linha de tendência são os MESMOS componentes
 * que os cards de lá desenham. Uma segunda classificação aqui faria a mesma
 * rota ser "Oportunidade" na Home e "Atenção" no Radar.
 *
 * A DIVISÃO DO QUE É REAL é a do Radar, sem afrouxar: as ROTAS e a frequência
 * saem dos embarques do cliente e são reais; todo número em dinheiro é
 * ilustrativo. Por isso o card não imprime preço — mostra rota, situação e
 * movimento, e manda para o Radar quem quiser o valor. O selo de proveniência
 * fica lá, na tela que exibe o número.
 */

// Três, e não as seis que o Radar mostra: isto é um card de Home ao lado de
// outros, não a tela do Radar. O corte é declarado no rodapé, nunca silencioso.
const MAX_ROUTES = 3;

export function PriceTrendCard({ routes }: { routes: PriceRadarRoute[] }) {
  const visible = routes.slice(0, MAX_ROUTES);
  const remaining = Math.max(0, routes.length - visible.length);

  return (
    <section className="portal-card flex flex-col gap-4 p-6">
      <div className="flex items-center gap-2">
        <Radar className="h-5 w-5 shrink-0 text-portal-neutral" />
        <p className="portal-small font-medium uppercase tracking-wide text-portal-neutral">
          Tendência de preço das suas rotas
        </p>
      </div>

      {visible.length === 0 ? (
        // Sem embarque não há rota, e sem rota não há tendência. "0%" aqui seria
        // uma afirmação sobre o mercado; a ausência é a resposta certa.
        <p className="portal-small text-portal-neutral">
          Assim que você tiver embarques, as rotas que opera aparecem aqui com a
          variação de frete de cada uma.
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((route) => (
            <li
              key={route.id}
              className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 border-b border-dashed pb-3 last:border-0 last:pb-0"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="portal-body font-medium text-foreground">
                  {formatRadarRoute(route)}
                </p>
                <PriceTrendLine route={route} />
              </div>
              <PriceAlertBadge alert={route.alert} className="shrink-0" />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto space-y-1">
        {remaining > 0 ? (
          <p className="portal-small text-portal-neutral">
            Mais {remaining} {remaining === 1 ? 'rota' : 'rotas'} no Radar.
          </p>
        ) : null}
        <Link
          href="/portal/inteligencia/radar"
          className="portal-small inline-flex items-center gap-1 font-medium text-brand-indigo hover:underline"
        >
          Ver no Radar de Preços
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

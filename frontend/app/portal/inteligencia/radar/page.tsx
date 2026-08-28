'use client';

import Link from 'next/link';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Minus,
  Radar,
} from 'lucide-react';
import { LoadingState } from '@arboria-tech/arboria-ui';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMyQuotations } from '@/hooks/use-portal-quotations';
import { useMyShipments } from '@/hooks/use-portal-shipments';
import { MODAL_LABELS } from '@/types/quotation';

import { ModalIcon } from '../../_shared/modal-icon';
import { PagePortalHeader } from '../../_shared/page-header';
import {
  PRICE_ALERT_CLASS,
  PriceAlertBadge,
  PriceTrendLine,
} from '../components/price-trend';
import { flattenQuotations } from '../lib/intel-helpers';
import {
  HISTORICAL_WINDOW_DAYS,
  OPPORTUNITY_BELOW_PCT,
  TREND_WINDOW_DAYS,
  computePriceRadar,
  quotationPrefillParams,
  type PriceAlertType,
  type PriceRadarRoute,
} from '../lib/price-radar';

/**
 * Radar de Preços — "cotar agora ou esperar?".
 *
 * Proposta do Victor Orsi (14/08/2026): acompanhar o frete das rotas que o
 * cliente mais usa e avisar quando a flutuação abre ou fecha uma janela. O
 * Vinicius pediu para modelar com dado simulado antes de puxar o Lake, para
 * validar o VALOR com dois ou três clientes — esta tela é essa validação, e por
 * isso ela é convincente de propósito.
 *
 * Divisão de trabalho: `lib/price-radar.ts` decide tudo (quais rotas, que
 * preço, qual alerta) e é unit-testado; aqui é só apresentação. As rotas são as
 * MESMAS que o Mapa e "Rotas com maiores desvios" nomeiam — a aba nova não
 * inventa uma segunda geografia.
 *
 * Sem selo de proveniência, seguindo a filosofia vigente do protótipo (dado
 * ilustrativo rico, ver o CLAUDE.md da raiz). O que sustenta a honestidade aqui
 * é a nota de metodologia do rodapé, que declara a janela e o critério de cada
 * número — some ela e a tela passa a afirmar um feed de mercado que não existe.
 */

/** Faixa superior do card, na cor do alerta — a leitura de longe. */
const ALERT_RAIL: Record<PriceAlertType, string> = {
  oportunidade: 'bg-portal-success',
  atencao: 'bg-portal-warning',
  alta: 'bg-portal-danger',
};

function formatMoney(value: number, currency: 'USD'): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency,
    // Contêiner sai em dólar cheio; quilo tem centavos. O próprio valor decide.
    minimumFractionDigits: value < 100 ? 2 : 0,
    maximumFractionDigits: value < 100 ? 2 : 0,
  });
}

const signed = (pct: number) => `${pct > 0 ? '+' : ''}${pct}%`;

/**
 * Comparação com a média histórica. Aqui a cor NÃO é o semáforo do alerta: para
 * quem compra frete, preço abaixo da média é bom e acima é ruim, sempre — e
 * essa leitura é independente de a lane estar ou não numa janela de ação, que é
 * o que o badge do topo responde.
 */
function VariationLine({ route }: { route: PriceRadarRoute }) {
  const below = route.variationPct < 0;
  const Icon = below ? ArrowDownRight : route.variationPct > 0 ? ArrowUpRight : Minus;
  return (
    <p className="portal-small flex items-center gap-1.5 text-portal-neutral">
      <Icon
        className={cn(
          'h-4 w-4 shrink-0',
          below ? 'text-portal-success' : route.variationPct > 0 ? 'text-portal-danger' : '',
        )}
      />
      <span
        className={cn(
          'font-medium',
          below ? 'text-portal-success' : route.variationPct > 0 ? 'text-portal-danger' : 'text-foreground',
        )}
      >
        {Math.abs(route.variationPct)}% {below ? 'abaixo' : 'acima'}
      </span>
      da média de {route.historicalWindowDays} dias (
      {formatMoney(route.historicalAvg, route.currency)})
    </p>
  );
}

function RouteCard({ route }: { route: PriceRadarRoute }) {
  const alert = route.alert;
  return (
    <article className="portal-card flex flex-col overflow-hidden">
      <span className={cn('h-1 w-full shrink-0', ALERT_RAIL[alert.type])} aria-hidden />

      <div className="flex flex-1 flex-col gap-4 p-5">
        <header className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="portal-h3 text-foreground">
              {route.origin} <span className="text-portal-neutral">→</span>{' '}
              {route.destination}
            </h2>
            <PriceAlertBadge alert={alert} />
          </div>
          <p className="portal-small flex flex-wrap items-center gap-x-2 gap-y-1 text-portal-neutral">
            <span className="inline-flex items-center gap-1.5">
              <ModalIcon modal={route.modal} className="h-4 w-4" />
              {route.modal ? MODAL_LABELS[route.modal] : 'Modal não informado'}
            </span>
            <span className="text-border">·</span>
            {route.shipments}{' '}
            {route.shipments === 1 ? 'embarque seu' : 'embarques seus'} nesta rota
          </p>
        </header>

        <div className="space-y-1">
          <p className="portal-small text-portal-neutral">Preço de referência</p>
          <p className="flex flex-wrap items-baseline gap-1.5">
            <span className="portal-h1 text-foreground">
              {formatMoney(route.currentPrice, route.currency)}
            </span>
            <span className="portal-small text-portal-neutral">
              por {route.unit}
            </span>
          </p>
        </div>

        <div className="space-y-1.5">
          <VariationLine route={route} />
          <PriceTrendLine route={route} />
        </div>

        {/* A frase de ação vem do lib junto do tipo do alerta: cor sem
            recomendação obriga o cliente a adivinhar o que fazer com ela. */}
        <p
          className={cn(
            'portal-small rounded-lg border px-3 py-2',
            PRICE_ALERT_CLASS[alert.type],
          )}
        >
          {alert.rationale}
        </p>

        <div className="mt-auto pt-1">
          <Button asChild size="sm" className="w-full gap-2">
            <Link
              href={`/portal/nova-cotacao?${quotationPrefillParams(route).toString()}`}
            >
              Cotar agora
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

export default function PortalRadarPrecosPage() {
  const { shipments, isLoading: loadingShipments } = useMyShipments();
  const { data, isLoading: loadingQuotations } = useMyQuotations();

  if (loadingShipments || loadingQuotations) {
    return <LoadingState spinner message="Carregando o radar..." />;
  }

  const routes = computePriceRadar({
    shipments,
    quotations: flattenQuotations(data),
  });

  return (
    <div className="space-y-6">
      <PagePortalHeader
        title="Radar de Preços"
        subtitle="Como está o frete nas rotas que você mais usa, e quando vale fechar."
      />

      {routes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center">
          <Radar className="mx-auto h-6 w-6 text-portal-neutral" />
          <p className="portal-body mt-2 font-medium text-foreground">
            Ainda não há rotas para acompanhar
          </p>
          <p className="portal-small text-portal-neutral">
            O radar acompanha as rotas dos seus embarques. Assim que o primeiro
            for aberto, ele aparece aqui.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {routes.map((route) => (
              <RouteCard key={route.id} route={route} />
            ))}
          </div>

          {/* Metodologia. É ela que declara a janela e o critério de cada
              número — sem isso os valores acima passariam por cotação firme de
              mercado. Os limiares vêm das constantes do lib, não digitados aqui:
              um número escrito à mão divergiria do cálculo na primeira revisão. */}
          <p className="portal-small text-portal-neutral">
            O preço de referência é a mediana das cotações fechadas na rota nos
            últimos {HISTORICAL_WINDOW_DAYS} dias; a variação compara com a média
            do mesmo período e a tendência olha os últimos {TREND_WINDOW_DAYS}{' '}
            dias. Uma rota entra como oportunidade quando está ao menos{' '}
            {OPPORTUNITY_BELOW_PCT}% abaixo da média e sem pressão de alta. Não é
            cotação firme: o preço final depende de disponibilidade de espaço,
            característica da carga e do agente que responder.
          </p>
        </>
      )}
    </div>
  );
}

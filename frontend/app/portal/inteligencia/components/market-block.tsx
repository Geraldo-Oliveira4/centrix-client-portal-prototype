'use client';

import Link from 'next/link';
import { ArrowRight, TrendingUp } from 'lucide-react';

import type { PortalProposal, PortalQuotation } from '@/types/portal';
import { formatBRL } from '@/lib/portal-formatters';
import { useMyQuotations } from '@/hooks/use-portal-quotations';
import { useMyShipments } from '@/hooks/use-portal-shipments';

import { flattenQuotations } from '../lib/intel-helpers';
import { computePriceRadar, formatRadarRoute } from '../lib/price-radar';
import {
  findQuotationRadarRoute,
  quotationRadarRoute,
} from '../lib/quotation-radar-route';
import { IntelBlock } from './intel-block';
import { PriceAlertBadge, PriceTrendLine } from './price-trend';

// MOCK factor: the illustrative sector benchmark sits 8% above this quotation's
// value, so the reading is a favourable "below market". No price-index feed
// exists in this prototype.
const BENCHMARK_FACTOR = 1.08;

/**
 * Picks the proposal that represents "this quotation's price": the winner if the
 * quotation is closed, otherwise the recommended proposal, otherwise the
 * cheapest. Mirrors what the client is actually looking at in the proposals
 * table.
 */
function referenceProposal(
  proposals: PortalProposal[],
): PortalProposal | undefined {
  const priced = proposals.filter((p) => (p.total_brl ?? 0) > 0);
  if (priced.length === 0) return undefined;
  return (
    priced.find((p) => p.is_winner) ??
    priced.find((p) => p.is_recommended) ??
    [...priced].sort((a, b) => a.total_brl - b.total_brl)[0]
  );
}

/**
 * A tendência da rota desta cotação, vinda do Radar de Preços.
 *
 * NÃO CALCULA NADA. `computePriceRadar` é a mesma função (e o mesmo `limit`)
 * que a aba Radar roda, `findQuotationRadarRoute` só traduz a rota da cotação
 * para a chave que ela usa, e o badge e a linha de tendência são os MESMOS
 * componentes que os cards de lá desenham. Uma segunda classificação aqui faria
 * a mesma rota ser "Oportunidade" numa tela e "Atenção" na outra.
 *
 * As duas hooks são SWR sobre chaves que o portal já usa (`/portal/shipments` e
 * `/portal/quotations`), deduplicadas — não é fetch a mais.
 *
 * Rota fora do Radar não esconde o bloco: ela EXPLICA, no mesmo padrão do feed
 * de eventos do Mapa ("Filtrado por ..."), que o recorte é do Radar e não uma
 * falha. Sumir sem dizer nada deixaria o card com o vazio que este bloco veio
 * preencher, e um erro seria mentira — não há erro nenhum, há uma rota que o
 * Radar não acompanha.
 */
function RouteTrendSection({ quotation }: { quotation?: PortalQuotation }) {
  const { shipments, isLoading: loadingShipments } = useMyShipments();
  const { data, isLoading: loadingQuotations } = useMyQuotations();

  const isLoading = loadingShipments || loadingQuotations;
  const routes = computePriceRadar({
    shipments,
    quotations: flattenQuotations(data),
  });
  const route = findQuotationRadarRoute(quotation, routes);
  const { label } = quotationRadarRoute(quotation);

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="portal-small text-portal-neutral">Tendência da rota</p>
        <p className="portal-small text-portal-neutral">Ilustrativo</p>
      </div>

      {isLoading ? (
        <p className="portal-small text-portal-neutral">Carregando o Radar...</p>
      ) : route ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="portal-body font-medium text-foreground">
              {formatRadarRoute(route)}
            </p>
            <PriceAlertBadge alert={route.alert} />
          </div>
          <PriceTrendLine route={route} />
          <p className="portal-small text-portal-neutral">{route.alert.rationale}</p>
          <Link
            href="/portal/inteligencia/radar"
            className="portal-small inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            Ver no Radar de Preços
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </>
      ) : (
        <p className="portal-small text-portal-neutral">
          {label
            ? `A rota "${label}" ainda não está entre as acompanhadas no Radar de Preços, que segue as rotas com mais embarques seus.`
            : 'Esta cotação ainda não nomeia o porto de origem, então não há rota para procurar no Radar de Preços.'}
        </p>
      )}
    </div>
  );
}

/**
 * MIXED, headline is MOCK. Scoped to a SINGLE quotation: it compares THIS
 * quotation's value (winning proposal, or the recommended/cheapest one while it
 * is still open) against a fabricated sector benchmark. The value is real; the
 * benchmark it is measured against is illustrative.
 */
export function MarketBlock({
  quotation,
  proposals,
  className,
}: {
  /** A cotação aberta — é dela que sai a rota procurada no Radar. */
  quotation?: PortalQuotation;
  proposals: PortalProposal[];
  /** `h-full` quando o bloco divide a linha com a Confiabilidade. */
  className?: string;
}) {
  const ref = referenceProposal(proposals);
  const value = ref?.total_brl ?? null;
  const benchmark = value != null ? Math.round(value * BENCHMARK_FACTOR) : null;
  const deltaPct =
    value != null && benchmark ? Math.round((1 - value / benchmark) * 100) : null;
  const refLabel = ref?.is_winner
    ? 'proposta vencedora'
    : ref?.is_recommended
      ? 'proposta recomendada'
      : 'proposta mais barata';

  return (
    <IntelBlock
      icon={<TrendingUp className="h-5 w-5" />}
      title="Mercado"
      question="O preço está competitivo?"
      provenance="preview"
      className={className}
      footnote="O valor desta cotação é real (proposta recebida). O benchmark do setor e a tendência da rota são ilustrativos — não há base de preços de mercado neste protótipo. A tendência é a mesma do Radar de Preços, calculada uma vez."
    >
      {/* `justify-center` só importa quando este bloco divide a linha com a
          Confiabilidade (que carrega a Evidência dentro e é bem mais alta): o
          grid estica os dois na mesma altura, e sem isto o conteúdo curto
          ficava grudado no topo com ~300px de vazio abaixo — igualar altura sem
          distribuir o conteúdo lê como card truncado, não como par equilibrado.
          Sozinho em largura total o efeito é nulo, porque aí não há altura
          sobrando. */}
      {value == null ? (
        <div className="flex h-full flex-col justify-center gap-4">
          <p className="portal-body text-portal-neutral">
            Esta cotação ainda não tem proposta com valor para comparar.
          </p>
          {/* A tendência não depende de proposta: ela é da ROTA, e o cliente
              sem proposta ainda é justamente quem mais precisa saber se o
              mercado está subindo. */}
          <RouteTrendSection quotation={quotation} />
        </div>
      ) : (
        <div className="flex h-full flex-col justify-center gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="portal-card-muted space-y-1 p-3">
              <p className="portal-small text-portal-neutral">
                Esta cotação ({refLabel})
              </p>
              <p className="portal-body font-semibold text-foreground">
                {formatBRL(value)}
              </p>
              <p className="portal-small text-portal-success">Dado real</p>
            </div>
            <div className="space-y-1 rounded-xl border border-dashed border-border p-3">
              <p className="portal-small text-portal-neutral">Benchmark do setor</p>
              <p className="portal-body font-semibold text-portal-neutral">
                {formatBRL(benchmark ?? 0)}
              </p>
              <p className="portal-small text-portal-neutral">Ilustrativo</p>
            </div>
          </div>
          {deltaPct != null ? (
            <p className="portal-body text-foreground">
              Estimativa: esta cotação está{' '}
              <span className="font-semibold text-portal-success">
                {deltaPct}% abaixo
              </span>{' '}
              do benchmark ilustrativo.
            </p>
          ) : null}

          <RouteTrendSection quotation={quotation} />
        </div>
      )}
    </IntelBlock>
  );
}

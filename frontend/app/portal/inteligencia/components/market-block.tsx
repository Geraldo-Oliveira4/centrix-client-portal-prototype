'use client';

import Link from 'next/link';
import { ArrowRight, TrendingUp } from 'lucide-react';

import type { PortalProposal, PortalQuotation } from '@/types/portal';
import { formatBRL } from '@/lib/portal-formatters';
import { useMyQuotations } from '@/hooks/use-portal-quotations';
import { useMyShipments } from '@/hooks/use-portal-shipments';

import { flattenQuotations } from '../lib/intel-helpers';
import { SHOW_PROPOSAL_PROVENANCE } from '../lib/proposal-provenance';
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

  // Moldura de linha cheia, nao tracejada: a tracejada e a convencao do portal
  // para dado fabricado, e a Comparacao de Propostas parou de marcar isso em
  // 28/08/2026. A borda fica porque a tendencia e uma leitura a parte do preco
  // acima dela, nao porque o numero seja ilustrativo.
  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <p className="portal-body text-portal-neutral">Tendência da rota</p>

      {isLoading ? (
        <p className="portal-body text-portal-neutral">Carregando o Radar...</p>
      ) : route ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="portal-h3 font-normal text-foreground">
              {formatRadarRoute(route)}
            </p>
            <PriceAlertBadge alert={route.alert} />
          </div>
          <PriceTrendLine route={route} />
          <p className="portal-body text-portal-neutral">{route.alert.rationale}</p>
          <Link
            href="/portal/inteligencia/radar"
            className="portal-body inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            Ver no Radar de Preços
            <ArrowRight className="h-4 w-4" />
          </Link>
        </>
      ) : (
        <p className="portal-body text-portal-neutral">
          {label
            ? `A rota "${label}" ainda não está entre as acompanhadas no Radar de Preços, que segue as rotas com mais embarques seus.`
            : 'Esta cotação ainda não nomeia o porto de origem, então não há rota para procurar no Radar de Preços.'}
        </p>
      )}
    </div>
  );
}

/**
 * Rodapé do card. Do texto antigo sobrou só o que NÃO fala de autenticidade: de
 * onde vem a tendência.
 *
 * É transparência funcional, não declaração de proveniência — o bloco termina em
 * "Ver no Radar de Preços" e o cliente precisa saber que vai reencontrar lá o
 * MESMO número, não uma segunda leitura da mesma rota. A ressalva de real x
 * ilustrativo saiu em 28/08/2026 junto com os selos (ver
 * `lib/proposal-provenance.ts`).
 */
const FOOTNOTE =
  'A tendência da rota é a mesma do Radar de Preços, calculada uma vez.';

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
      provenance={SHOW_PROPOSAL_PROVENANCE ? 'preview' : undefined}
      className={className}
      footnote={FOOTNOTE}
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
          <p className="portal-h3 font-normal text-portal-neutral">
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
            {/* Os dois lados vestem a MESMA superficie desde 28/08/2026: a
                muted x tracejada era a distincao real x ilustrativo, e ela saiu
                junto com os rotulos que ficavam sob cada valor. */}
            <div className="portal-card-muted space-y-1 p-3">
              <p className="portal-body text-portal-neutral">
                Esta cotação ({refLabel})
              </p>
              <p className="portal-h3 font-semibold text-foreground">
                {formatBRL(value)}
              </p>
            </div>
            <div className="portal-card-muted space-y-1 p-3">
              <p className="portal-body text-portal-neutral">Benchmark do setor</p>
              <p className="portal-h3 font-semibold text-portal-neutral">
                {formatBRL(benchmark ?? 0)}
              </p>
            </div>
          </div>
          {deltaPct != null ? (
            <p className="portal-h3 font-normal text-foreground">
              Estimativa: esta cotação está{' '}
              <span className="font-semibold text-portal-success">
                {deltaPct}% abaixo
              </span>{' '}
              do benchmark do setor.
            </p>
          ) : null}

          <RouteTrendSection quotation={quotation} />
        </div>
      )}
    </IntelBlock>
  );
}

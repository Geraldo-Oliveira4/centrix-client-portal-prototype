// Radar de Preços — preço de referência por rota, variação contra a média
// histórica e tendência recente. Puro e unit-testado (price-radar.test.ts).
//
// De onde veio a ideia
// --------------------
// Proposta do Victor Orsi na reunião de 14/08/2026: um radar de frete sobre o
// Data Lake, focado nas rotas que o cliente mais usa, com alerta de flutuação,
// para ele cotar no MOMENTO certo em vez de descobrir o preço depois de pedir.
// O Vinicius pediu para modelar com dado simulado primeiro e validar o VALOR da
// proposta com dois ou três clientes antes de puxar dado real. Este arquivo é
// esse modelo.
//
// O que é real e o que é simulado
// --------------------------------
// REAL: quais rotas aparecem e com que frequência — sai dos embarques do próprio
// cliente, pela MESMA resolução de rota que o bloco "Rotas com maiores desvios"
// e o Mapa usam (`routePartsOf`). Não há uma segunda tabela de rotas: a aba nova
// nomeia os mesmos portos que as telas antigas.
//
// SIMULADO: todo número em dinheiro. Preço de referência, média histórica,
// variação e tendência são derivados deterministicamente da rota, porque não
// existe Data Lake neste repositório nem nenhuma tabela de frete de mercado.
//
// Não fechar portas (mesma disciplina de `shipment-documents.ts`)
// ---------------------------------------------------------------
// O shape é o que uma consulta ao Lake devolveria, não o que é conveniente
// desenhar: a rota é identificada pelas duas pontas (não por um rótulo já
// formatado), o preço vem com MOEDA e UNIDADE explícitas (frete marítimo cota
// por contêiner, aéreo por quilo — colapsar os dois num "preço" faria a
// comparação entre modais mentir), e a janela de cada medida é declarada em
// dias. `classifyPriceAlert` recebe só números e não sabe de onde vieram: quando
// o Lake existir, troca-se o gerador e a classificação continua igual.

import type { PortalQuotation } from '@/types/portal';
import type { PortalShipment } from '@/types/portal-shipment';
import type { QuotationModal } from '@/types/quotation';

import { DESTINATION_PORT } from '../../embarques/lib/port-coordinates.ts';
import { seededInt } from './intel-helpers.ts';
import { indexQuotations, routePartsOf } from './shipment-dimensions.ts';

/**
 * Os três desfechos do semáforo. São cores de STATUS, não de marca:
 *   `oportunidade` (verde)  — preço abaixo da média: hora de cotar;
 *   `atencao`      (amarelo) — oscilação sem direção clara;
 *   `alta`         (vermelho) — alta significativa ou situação atípica.
 */
export type PriceAlertType = 'oportunidade' | 'atencao' | 'alta';

export interface PriceAlert {
  type: PriceAlertType;
  label: string;
  /** Uma frase dizendo o que fazer com a informação. */
  rationale: string;
}

export interface PriceRadarRoute {
  /** Chave estável — as duas pontas, não o rótulo formatado. */
  id: string;
  origin: string;
  destination: string;
  modal: QuotationModal | null;
  /** Quantos embarques do cliente correram nesta rota. REAL. */
  shipments: number;
  /** ISO 4217. Frete internacional é cotado em dólar. */
  currency: 'USD';
  /** O que uma unidade custa hoje. SIMULADO. */
  currentPrice: number;
  /** "contêiner 40'" / "kg" — sem isto, dois modais não são comparáveis. */
  unit: string;
  /** Média do mesmo preço na janela histórica. SIMULADO. */
  historicalAvg: number;
  /** Tamanho da janela da média, em dias. */
  historicalWindowDays: number;
  /** Preço atual vs média histórica, em %. Negativo = abaixo da média. */
  variationPct: number;
  /** Variação nas duas últimas semanas, em %. */
  trendPct: number;
  trendWindowDays: number;
  alert: PriceAlert;
}

/**
 * O que `routePartsOf` devolve quando a cotação não nomeia um destino único.
 * Espelha `DEFAULT_DESTINATION` de `shipment-dimensions.ts` — não é importado de
 * lá porque lá ele é detalhe interno daquele ranking, e exportá-lo faria duas
 * telas dependerem de uma constante que existe por outro motivo.
 */
const DEFAULT_DESTINATION_LABEL = 'Brasil';

/** Janelas declaradas uma vez — a tela imprime estes números, não outros. */
export const HISTORICAL_WINDOW_DAYS = 90;
export const TREND_WINDOW_DAYS = 14;

/**
 * Limiares da classificação. Ficam exportados porque a tela cita os números na
 * nota de metodologia: um limiar escrito à mão no texto divergiria do usado no
 * cálculo na primeira revisão.
 */
export const OPPORTUNITY_BELOW_PCT = 8;
export const ANOMALY_ABOVE_PCT = 25;
export const SHARP_RISE_PCT = 15;

const ALERT_LABEL: Record<PriceAlertType, string> = {
  oportunidade: 'Oportunidade',
  atencao: 'Atenção',
  alta: 'Alta significativa',
};

export interface PriceSignals {
  /** Preço atual vs média histórica, em % (negativo = abaixo). */
  variationPct: number;
  /** Variação na janela recente, em %. */
  trendPct: number;
}

/**
 * Classifica a flutuação. Ordem de precedência, e ela importa:
 *
 *  1. ALTA vence tudo — preço muito acima da média (anomalia, peak season) OU
 *     subindo forte agora. Um preço 30% acima da média não vira "atenção" só
 *     porque parou de subir esta semana: o custo já está lá.
 *  2. OPORTUNIDADE exige as duas condições — estar abaixo da média E não estar
 *     subindo forte. Um preço 10% abaixo da média mas +12% em duas semanas está
 *     fechando a janela, e chamá-lo de oportunidade mandaria o cliente cotar
 *     tarde. Este é o ponto do radar inteiro: o momento, não só o nível.
 *  3. ATENÇÃO é o resto — oscilação sem direção que justifique agir.
 */
export function classifyPriceAlert({
  variationPct,
  trendPct,
}: PriceSignals): PriceAlertType {
  if (variationPct >= ANOMALY_ABOVE_PCT || trendPct >= SHARP_RISE_PCT) return 'alta';
  if (variationPct <= -OPPORTUNITY_BELOW_PCT && trendPct < SHARP_RISE_PCT / 2) {
    return 'oportunidade';
  }
  return 'atencao';
}

/** Frase de ação do alerta — o que o cliente faz com o número. */
export function priceAlertRationale(
  type: PriceAlertType,
  { variationPct, trendPct }: PriceSignals,
): string {
  const below = Math.abs(Math.round(variationPct));
  const rising = Math.round(trendPct);
  if (type === 'oportunidade') {
    return `Preço ${below}% abaixo da média de ${HISTORICAL_WINDOW_DAYS} dias e estável — boa janela para fechar.`;
  }
  if (type === 'alta') {
    return variationPct >= ANOMALY_ABOVE_PCT
      ? `Preço ${Math.round(variationPct)}% acima da média do período — patamar atípico para esta rota.`
      : `Alta de ${rising}% em ${TREND_WINDOW_DAYS} dias — se puder esperar, reavalie na próxima semana.`;
  }
  return 'Oscilação dentro do normal da rota — sem urgência para antecipar ou adiar.';
}

export function buildPriceAlert(signals: PriceSignals): PriceAlert {
  const type = classifyPriceAlert(signals);
  return { type, label: ALERT_LABEL[type], rationale: priceAlertRationale(type, signals) };
}

/**
 * Unidade e faixa de preço por modal. Frete marítimo cota por contêiner e aéreo
 * por quilo — as ordens de grandeza são diferentes de propósito, e é por isso
 * que `unit` viaja junto do preço em vez de ser texto na tela.
 */
const PRICING_BY_MODAL: Record<
  string,
  { unit: string; min: number; max: number }
> = {
  MARITIMO: { unit: "contêiner 40'", min: 1650, max: 5400 },
  AEREO: { unit: 'kg', min: 4, max: 13 },
  RODOVIARIO: { unit: 'carreta', min: 2200, max: 6800 },
};

const DEFAULT_PRICING = PRICING_BY_MODAL.MARITIMO;

/**
 * Regime de mercado da lane. É a peça do modelo que MAIS se parece com o que o
 * Lake devolveria: uma consulta de frete por rota não entrega um número solto,
 * entrega uma lane em algum estado — mercado frouxo, estável ou pressionado —
 * e os números caem dentro dele. Sortear variação e tendência de forma
 * independente produziria combinações que não existem no mercado (preço 20%
 * abaixo da média subindo 25% em duas semanas).
 *
 * É também o que garante que a tela mostre os três alertas: com seis rotas e o
 * regime sorteado entre três, a carteira do cliente cobre as três cores sem
 * ninguém chumbar "este card é verde".
 *
 * `classifyPriceAlert` NÃO conhece o regime — ela recebe só os números. O regime
 * gera a entrada, a classificação continua sendo a regra de negócio, e quando o
 * Lake existir sai o gerador e fica a regra.
 */
const MARKET_REGIMES: {
  key: string;
  variation: [number, number];
  trend: [number, number];
}[] = [
  // Mercado frouxo: preço abaixo da média e sem pressão de alta.
  { key: 'frouxo', variation: [-24, -10], trend: [-10, 3] },
  // Estável: oscila em torno da média, sem cruzar nenhum limiar.
  { key: 'estavel', variation: [-6, 14], trend: [-5, 8] },
  // Pressionado: patamar alto, subindo. Nem todo sorteio aqui cruza o limiar de
  // ALTA, e isso é correto — uma lane sob pressão que ainda não estourou é
  // exatamente "atenção".
  { key: 'pressionado', variation: [16, 36], trend: [8, 26] },
];

/**
 * Números de mercado de uma rota. Determinístico pela rota (não pelo embarque):
 * o preço de mercado é da LANE, e derivá-lo do embarque faria a mesma rota
 * mostrar preços diferentes conforme quantas cargas o cliente moveu nela.
 *
 * A média histórica é a âncora e o preço atual é derivado dela pela variação —
 * nunca o contrário. Sorteando os dois em separado, "12% abaixo da média" e os
 * dois valores impressos ao lado poderiam não fechar na conta que o cliente faz
 * de cabeça.
 */
function pricingFor(routeId: string, modal: QuotationModal | null) {
  const pricing = (modal && PRICING_BY_MODAL[modal]) || DEFAULT_PRICING;
  const regime =
    MARKET_REGIMES[seededInt(`radar:regime:${routeId}`, 0, MARKET_REGIMES.length - 1)];
  const historicalAvg = seededInt(`radar:avg:${routeId}`, pricing.min, pricing.max);
  const variationPct = seededInt(`radar:var:${routeId}`, ...regime.variation);
  const trendPct = seededInt(`radar:trend:${routeId}`, ...regime.trend);
  const raw = historicalAvg * (1 + variationPct / 100);
  // Preço em dólar por contêiner é inteiro; por quilo tem centavos.
  const currentPrice =
    pricing.max > 100 ? Math.round(raw) : Math.round(raw * 100) / 100;
  return { unit: pricing.unit, historicalAvg, currentPrice, variationPct, trendPct };
}

/** Modal predominante da rota; empate resolve pelo primeiro encontrado. */
function dominantModal(modals: (QuotationModal | null)[]): QuotationModal | null {
  const counts = new Map<QuotationModal, number>();
  modals.forEach((m) => {
    if (m) counts.set(m, (counts.get(m) ?? 0) + 1);
  });
  let best: QuotationModal | null = null;
  let bestCount = 0;
  counts.forEach((count, modal) => {
    if (count > bestCount) {
      best = modal;
      bestCount = count;
    }
  });
  return best;
}

export interface PriceRadarInput {
  shipments: PortalShipment[];
  quotations: PortalQuotation[];
  /** Quantas rotas cabem na tela. O radar é foco, não catálogo. */
  limit?: number;
}

/**
 * As rotas que o cliente mais move, com os números de mercado de cada uma.
 *
 * Ordena por frequência (a rota com mais embarques primeiro) e desempata pelo
 * nome, para a ordem não oscilar entre renders. O corte existe porque um radar
 * com dez cartões deixa de ser radar: as rotas de uma carga só não sustentam
 * "rota preferida".
 */
export function computePriceRadar({
  shipments,
  quotations,
  limit = 6,
}: PriceRadarInput): PriceRadarRoute[] {
  const byId = indexQuotations(quotations);
  const groups = new Map<
    string,
    { origin: string; destination: string; modals: (QuotationModal | null)[] }
  >();

  for (const shipment of shipments) {
    const parts = routePartsOf(shipment, byId);
    const { origin } = parts;
    // `routePartsOf` devolve "Brasil" quando a cotação não nomeia UM porto de
    // destino (a maioria: o campo é lista e vem vazio). Frete é cotado porto a
    // porto — um card "Hamburgo → Brasil" não tem preço de lane. O radar adota
    // a MESMA representação que o Mapa já adota para a ponta de chegada
    // (`DESTINATION_PORT`, Santos), em vez de escolher um porto por conta
    // própria: quando a cotação nomear o destino, os dois passam a mostrar o
    // porto real juntos.
    const destination =
      parts.destination === DEFAULT_DESTINATION_LABEL
        ? DESTINATION_PORT.name
        : parts.destination;
    const id = `${origin}>${destination}`;
    const entry = groups.get(id) ?? { origin, destination, modals: [] };
    entry.modals.push(shipment.modal ?? null);
    groups.set(id, entry);
  }

  return Array.from(groups, ([id, group]) => {
    const modal = dominantModal(group.modals);
    const pricing = pricingFor(id, modal);
    const signals = {
      variationPct: pricing.variationPct,
      trendPct: pricing.trendPct,
    };
    return {
      id,
      origin: group.origin,
      destination: group.destination,
      modal,
      shipments: group.modals.length,
      currency: 'USD' as const,
      currentPrice: pricing.currentPrice,
      unit: pricing.unit,
      historicalAvg: pricing.historicalAvg,
      historicalWindowDays: HISTORICAL_WINDOW_DAYS,
      variationPct: pricing.variationPct,
      trendPct: pricing.trendPct,
      trendWindowDays: TREND_WINDOW_DAYS,
      alert: buildPriceAlert(signals),
    };
  })
    .sort(
      (a, b) =>
        b.shipments - a.shipments ||
        a.origin.localeCompare(b.origin) ||
        a.destination.localeCompare(b.destination),
    )
    .slice(0, limit);
}

/**
 * Porto como o formulário de Nova Cotação o nomeia (`PORTS_*_OPTIONS` em
 * `constants/ports.ts`).
 *
 * Existe porque as duas tabelas falam línguas diferentes: a de coordenadas usa o
 * nome em português ("Gênova", "Nova York", "Hamburgo") e a do formulário usa o
 * rótulo UN/LOCODE em inglês ("Genova, Italy (ITGOA)"). Sem o mapa explícito, o
 * CTA "Cotar agora" abriria a cotação com o campo de porto vazio — falha
 * silenciosa, que é a pior espécie. O unit test confere cada valor daqui contra
 * as opções reais do formulário, então uma entrada errada quebra o build de
 * teste em vez de quebrar a demo.
 *
 * Porto sem entrada aqui não impede o deep link: o CTA continua levando o modal
 * e o destino, e o cliente escolhe a origem na tela.
 */
export const QUOTATION_PORT_OPTION: Record<string, string> = {
  Shanghai: 'Shanghai, China (CNSHA)',
  Ningbo: 'Ningbo, China (CNNGB)',
  Shenzhen: 'Shenzhen Baoan, China (CNSZX)',
  Hamburgo: 'Hamburg, Germany (DEHAM)',
  Rotterdam: 'Rotterdam, Netherlands (NLRTM)',
  'Gênova': 'Genova, Italy (ITGOA)',
  Izmir: 'Izmir, Turkey (TRIZM)',
  'Ho Chi Minh': 'Ho Chi Minh, Vietnam (VNVIC)',
  Busan: 'Busan, South Korea (KRPUS)',
  Houston: 'Houston, United States (USHOU)',
  'Los Angeles': 'Los Angeles, United States (USLAX)',
  'Nova York': 'New York, United States (USNYC)',
  Singapura: 'Singapore, Singapore (SGSIN)',
};

/** Destino: a tabela de destino do formulário é a de portos brasileiros. */
export const QUOTATION_DESTINATION_OPTION: Record<string, string> = {
  Santos: 'Santos, Brazil (BRSSZ)',
  'Rio de Janeiro': 'Rio de Janeiro, Brazil (BRRIO)',
  Paranaguá: 'Paranagua, Brazil (BRPNG)',
  Itajaí: 'Itajai, Brazil (BRITJ)',
  Navegantes: 'Navegantes, Brazil (BRNVT)',
};

/**
 * Query string do CTA "Cotar agora". Só entram os campos que a rota conhece de
 * fato — o resto da cotação (mercadoria, prazos, incoterm) o cliente preenche,
 * e pré-preencher com palpite seria pior que deixar em branco.
 */
export function quotationPrefillParams(route: PriceRadarRoute): URLSearchParams {
  const params = new URLSearchParams();
  if (route.modal) params.set('modal', route.modal);
  const origin = QUOTATION_PORT_OPTION[route.origin];
  if (origin) params.set('porto_embarque', origin);
  const destination = QUOTATION_DESTINATION_OPTION[route.destination];
  if (destination) params.set('porto_destino', destination);
  // Rótulo só para a tela de destino explicar de onde veio o pré-preenchimento.
  params.set('rota', `${route.origin} → ${route.destination}`);
  return params;
}

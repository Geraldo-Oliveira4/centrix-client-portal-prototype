// A ponte entre UMA cotação e a rota que o Radar de Preços acompanha.
//
// Por que existe
// --------------
// O Radar indexa rotas a partir dos EMBARQUES do cliente
// (`computePriceRadar`). O bloco "Mercado" do detalhe da cotação precisa da
// mesma leitura partindo do outro lado: a cotação aberta na tela. Sem esta
// adaptação, a tela teria de reconstruir a chave da rota à mão — e uma segunda
// construção erraria justamente no caso mais comum (destino não nomeado, que
// vira "Brasil" e o Radar renomeia para o porto de chegada).
//
// Não há CÁLCULO aqui, e não pode haver: quem classifica tendência e alerta é
// `price-radar.ts`, quem resolve as duas pontas da rota é
// `shipment-dimensions.ts`. Este módulo só traduz e procura.
//
// Puro e unit-testado (`quotation-radar-route.test.ts`).

import type { PortalQuotation } from '@/types/portal';

import {
  formatRadarRoute,
  normalizeRadarRoute,
  type PriceRadarRoute,
} from './price-radar.ts';
import { quotationRouteParts } from './shipment-dimensions.ts';

export interface QuotationRadarRoute {
  /**
   * A chave que `computePriceRadar` teria dado a esta rota, ou **null** quando
   * a cotação não nomeia a origem.
   *
   * Null não é falha: `origin` é texto livre e opcional na cotação. O fallback
   * que os embarques têm (hub ilustrativo por referência) não existe aqui —
   * uma cotação não tem embarque, e derivar a origem de outra coisa nomearia
   * uma rota que a cotação não nomeia.
   */
  id: string | null;
  /** "Shanghai → Santos". Null pelo mesmo motivo do `id`. */
  label: string | null;
}

/**
 * A rota desta cotação no vocabulário do Radar — mesma normalização, mesma
 * chave.
 */
export function quotationRadarRoute(
  quotation: PortalQuotation | undefined,
): QuotationRadarRoute {
  const parts = quotationRouteParts(quotation);
  if (!parts.origin) return { id: null, label: null };
  const route = normalizeRadarRoute({
    origin: parts.origin,
    destination: parts.destination,
  });
  return { id: route.id, label: formatRadarRoute(route) };
}

/**
 * A rota do Radar correspondente a esta cotação, ou **null** quando o Radar não
 * acompanha essa rota.
 *
 * `routes` deve ser a MESMA lista que a tela do Radar exibe (`computePriceRadar`
 * com o `limit` padrão): o bloco Mercado convida o cliente a conferir a
 * tendência lá, e afirmar uma tendência sobre uma rota que a grade do Radar não
 * mostra o entregaria numa tela onde ele não acha o que leu. É a mesma
 * disciplina do alerta de preço da aba Alertas.
 *
 * Consequência aceita: uma rota com um embarque só, fora do corte do Radar,
 * cai no estado vazio — pelo mesmo critério, e o estado vazio diz isso.
 */
export function findQuotationRadarRoute(
  quotation: PortalQuotation | undefined,
  routes: PriceRadarRoute[],
): PriceRadarRoute | null {
  const { id } = quotationRadarRoute(quotation);
  if (!id) return null;
  return routes.find((route) => route.id === id) ?? null;
}

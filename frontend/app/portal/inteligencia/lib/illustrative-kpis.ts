// Economia e on-time rate — FONTE ÚNICA para Performance e Executivo.
//
// Este módulo existe por causa de um erro já cometido e corrigido no portal, e
// que não pode voltar: Performance e Executivo respondiam a MESMA pergunta com
// respostas diferentes na mesma sessão (uma tela dizia "não temos como saber", a
// outra dava um valor em reais). Em 05/08/2026 as duas foram zeradas.
//
// Em 12/08/2026, com a mudança de propósito do protótipo (de réplica standalone
// honesta para REFERÊNCIA VISUAL para quem vai construir a versão integrada), o
// número voltou — mas só pode voltar assim: calculado UMA vez, aqui, e consumido
// pelas duas telas. Se você precisar do número numa terceira tela, importe daqui.
// **Não recalcule savings em outro lugar.**
//
// (O fator de benchmark do `MarketBlock`, no detalhe da cotação, é outra
// pergunta em outra tela e continua com a constante própria dele.)

import type { PortalQuotation } from '@/types/portal';
import type { PortalShipment } from '@/types/portal-shipment';

import { delayRiskFromTracking } from '../../embarques/lib/delay-risk.ts';

/**
 * Percentual ilustrativo de economia sobre o valor fechado.
 *
 * ILUSTRATIVO, e não medido: o savings real exige a série completa de propostas
 * por cotação (o portal recebe só a `best_proposal`, sem ordem de chegada) e uma
 * base de preço de mercado, que é o Data Lake. O valor mostra a ORDEM DE GRANDEZA
 * que a tela vai exibir quando a fonte existir.
 */
const SAVINGS_PCT = 0.083;

export interface IllustrativeSavings {
  /** Soma dos valores fechados que serve de base — este número é real. */
  baseBRL: number;
  /** Economia ilustrativa em reais. */
  savingsBRL: number;
  /** O percentual aplicado, para a tela poder exibi-lo junto do valor. */
  pct: number;
}

/**
 * Economia ilustrativa sobre as cotações fechadas.
 *
 * A BASE é real (o que o cliente efetivamente fechou); o percentual é
 * ilustrativo. Devolve null quando não há nenhuma cotação fechada com valor —
 * sem base, não há o que multiplicar, e um "R$ 0" leria como "você não economizou
 * nada", que é uma afirmação, não uma lacuna.
 */
export function computeIllustrativeSavings(
  quotations: PortalQuotation[],
): IllustrativeSavings | null {
  const base = quotations
    .filter((q) => q.state === 'FECHADA')
    .reduce((sum, q) => sum + (q.best_proposal?.total_brl ?? 0), 0);

  if (base <= 0) return null;
  return {
    baseBRL: base,
    savingsBRL: Math.round(base * SAVINGS_PCT),
    pct: SAVINGS_PCT,
  };
}

/**
 * On-time rate: percentual de embarques que chegaram (ou devem chegar) no prazo,
 * entre os que têm desvio calculável.
 *
 * Diferente da economia, este número é CALCULADO — pela mesma `computeDelayRisk`
 * que desenha o badge de cada embarque, sobre as datas de tracking. O que é
 * ilustrativo é o dado de entrada (o tracking do top-up), não a aritmética.
 *
 * Null quando nenhum embarque tem desvio calculável: "0% no prazo" seria uma
 * acusação, não uma ausência — a mesma regra do `onTimePct` por armador.
 */
export interface OnTimeRate {
  pct: number;
  /** Quantos embarques sustentam o percentual. */
  tracked: number;
  /** Total de embarques, para a tela dizer sobre quantos o número fala. */
  total: number;
}

export function computeOnTimeRate(shipments: PortalShipment[]): OnTimeRate | null {
  let tracked = 0;
  let onTime = 0;

  for (const shipment of shipments) {
    const risk = delayRiskFromTracking(shipment.tracking);
    if (risk.deltaDays == null) continue;
    tracked += 1;
    if (risk.status === 'on_time') onTime += 1;
  }

  if (tracked === 0) return null;
  return {
    pct: Math.round((onTime / tracked) * 100),
    tracked,
    total: shipments.length,
  };
}

import type { PortalQuotation, PortalQuotationsResponse } from '@/types/portal';

import { flattenQuotations, seededInt } from './intel-helpers';

// Ranking ilustrativo de agentes para o dashboard Fornecedores.
//
// O que é REAL aqui: o nome do agente, quantas cotações dele chegaram com a
// melhor proposta e as rotas (origens) em que ele apareceu. Tudo isso sai do
// payload de /portal/quotations, que expõe apenas a `best_proposal` de cada
// cotação — logo a leitura é "agente que ofertou o melhor preço", não "todos os
// agentes que responderam". Não há endpoint por agente neste protótipo.
//
// O que é ILUSTRATIVO: as colunas comparativas. Preço e prazo são relativos à
// média do próprio cliente sobre uma amostra pequena (não é benchmark de
// mercado), e a Confiabilidade é um rótulo qualitativo determinístico — ver a
// nota de metodologia em `fornecedores/page.tsx`.

/** Faixa de tolerância em torno da média antes de chamar de acima/abaixo. */
const AVERAGE_BAND_PCT = 5;

export type RelativeTone = 'below' | 'average' | 'above';
export type ReliabilityLabel = 'Alta' | 'Média' | 'Baixa';

export interface SupplierRow {
  name: string;
  /** REAL. Cotações em que este agente trouxe a melhor proposta. */
  quotations: number;
  /** REAL. Origens distintas atendidas, ordenadas. */
  routes: string[];
  /** Relativo à média do cliente. `below` = mais barato. */
  price: RelativeTone;
  /** Relativo à média do cliente. `below` = mais rápido. */
  transit: RelativeTone;
  /** ILUSTRATIVO. Rótulo qualitativo, nunca um score numérico. */
  reliability: ReliabilityLabel;
}

const compareToMean = (value: number, mean: number): RelativeTone => {
  if (mean <= 0) return 'average';
  const deviation = ((value - mean) / mean) * 100;
  if (deviation > AVERAGE_BAND_PCT) return 'above';
  if (deviation < -AVERAGE_BAND_PCT) return 'below';
  return 'average';
};

const mean = (values: number[]): number =>
  values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;

const RELIABILITY_LABELS: ReliabilityLabel[] = ['Alta', 'Média', 'Baixa'];

/**
 * Rótulos qualitativos determinísticos, um por agente. MOCK: não modela nada —
 * existem só para a coluna não ficar vazia enquanto a metodologia real do score
 * de agentes (taxa de erro em janela móvel) não é corrigida.
 *
 * Duas decisões deliberadas: o rótulo é qualitativo (o portal não expõe score
 * numérico de agente ao cliente, mesma regra do `ScoreBadge` da cotação), e a
 * atribuição é por POSIÇÃO numa ordenação semeada, não por `hash % 3` direto —
 * com três agentes o módulo colide quase sempre e a coluna inteira sairia
 * "Média", que leria como se fosse uma medição real de todos iguais.
 */
const illustrativeReliability = (
  names: string[],
): Map<string, ReliabilityLabel> => {
  const ordered = [...names].sort(
    (a, b) =>
      seededInt(`confiabilidade:${a}`, 0, 9999) -
        seededInt(`confiabilidade:${b}`, 0, 9999) || a.localeCompare(b),
  );
  return new Map(
    ordered.map((name, i) => [name, RELIABILITY_LABELS[i % RELIABILITY_LABELS.length]]),
  );
};

/** Origem da cotação, normalizada para "Cidade" (o seed guarda "Cidade, País"). */
const routeOf = (q: PortalQuotation): string | null => {
  const origin = (q.origin ?? '').trim();
  return origin ? origin : null;
};

/**
 * Agrupa as cotações do cliente por agente da melhor proposta. Retorna as
 * linhas ordenadas por volume (mais cotações primeiro), depois por nome para
 * empate — nada de ordenar por um score, que é justamente o que está bloqueado.
 */
export function buildSupplierRanking(
  data?: PortalQuotationsResponse,
): SupplierRow[] {
  const withAgent = flattenQuotations(data).filter(
    (q) => q.best_proposal?.agent?.name,
  );
  if (withAgent.length === 0) return [];

  const overallPrice = mean(
    withAgent
      .map((q) => q.best_proposal?.total_brl ?? 0)
      .filter((v) => v > 0),
  );
  const overallTransit = mean(
    withAgent
      .map((q) => q.best_proposal?.transit_time ?? 0)
      .filter((v) => v > 0),
  );

  const byAgent = new Map<string, PortalQuotation[]>();
  for (const q of withAgent) {
    const name = q.best_proposal!.agent!.name;
    byAgent.set(name, [...(byAgent.get(name) ?? []), q]);
  }

  const reliabilityByAgent = illustrativeReliability(Array.from(byAgent.keys()));

  return Array.from(byAgent, ([name, quotations]) => {
    const prices = quotations
      .map((q) => q.best_proposal?.total_brl ?? 0)
      .filter((v) => v > 0);
    const transits = quotations
      .map((q) => q.best_proposal?.transit_time ?? 0)
      .filter((v) => v > 0);
    const routes = Array.from(
      new Set(quotations.map(routeOf).filter((r): r is string => r != null)),
    ).sort();

    return {
      name,
      quotations: quotations.length,
      routes,
      price: compareToMean(mean(prices), overallPrice),
      transit: compareToMean(mean(transits), overallTransit),
      reliability: reliabilityByAgent.get(name) ?? 'Média',
    };
  }).sort((a, b) => b.quotations - a.quotations || a.name.localeCompare(b.name));
}

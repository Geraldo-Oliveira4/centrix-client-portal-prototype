// Recomendação IA do comparativo de propostas (06/10/2026).
//
// PURO, sem `@/` (roda sob `node --test`). Nenhum resultado chumbado: nota,
// elegibilidade, recomendada e justificativa saem dos dados da cotação.
//
// O QUE ESTA NOTA É. Uma comparação RELATIVA entre as propostas desta cotação,
// de 0 a 100, soma ponderada de seis critérios. Não é nota do agente, não viaja
// para fora desta tela e não aparece no Histórico do agente ("dado, não
// veredito"). Regra do Mauro: o cliente só a vê depois que o analista da Freitas
// aprova a recomendação — ver `recommendationView`.
//
// A RECOMENDADA NÃO É NECESSARIAMENTE A MAIOR NOTA. Entre as elegíveis que
// custam até 10% acima da mais barata elegível, a rota direta tem prioridade e,
// dentro dela, ganha a maior nota. Uma oferta rápida e muito mais cara pode ter
// a maior nota e ainda assim não ser recomendada.

import {
  businessDaysUntil,
  isExpired,
  proposalTotals,
  type ComparisonProposal,
  type ComparisonQuotation,
  type Frequency,
  type RouteKind,
} from './comparison-model.ts';

export type Criterion =
  | 'custo'
  | 'transit'
  | 'rota'
  | 'frequencia'
  | 'freeTime'
  | 'validade';

/** Pesos em pontos percentuais. Somam 100 (travado em teste). */
export const CRITERION_WEIGHTS: Record<Criterion, number> = {
  custo: 28,
  transit: 22,
  rota: 18,
  frequencia: 14,
  freeTime: 10,
  validade: 8,
};

export const CRITERIA: {
  id: Criterion;
  label: string;
  rule: string;
}[] = [
  { id: 'custo', label: 'Custo', rule: 'Menor custo total em BRL, à mesma taxa PTAX' },
  { id: 'transit', label: 'Transit time', rule: 'Menos dias entre portos' },
  { id: 'rota', label: 'Rota', rule: 'Direta 100 · com transbordo 40 · sem informação 0' },
  {
    id: 'frequencia',
    label: 'Frequência',
    rule: 'Diária 100 · semanal 80 · quinzenal 50 · mensal 25 · sem informação 0',
  },
  { id: 'freeTime', label: 'Free time', rule: 'Mais dias livres no destino' },
  { id: 'validade', label: 'Validade', rule: 'Mais dias úteis de validade restantes' },
];

// Tolerâncias de equivalência, sempre relativas ao MELHOR valor do grupo.
// Regra vigente; pode mudar por decisão comercial/de produto.
/** Custo até 2% acima do menor total conta como o melhor. */
export const COST_EQUIVALENCE_PCT = 0.02;
/** Até 1 dia a mais que o menor transit time conta como o melhor. */
export const TRANSIT_EQUIVALENCE_DAYS = 1;
/** Até 2 dias a menos que o maior free time conta como o melhor. */
export const FREE_TIME_EQUIVALENCE_DAYS = 2;
/** Até 2 dias úteis a menos que a maior validade conta como o melhor. */
export const VALIDITY_EQUIVALENCE_BUSINESS_DAYS = 2;

// Janela da recomendação. Regra vigente; pode mudar por decisão comercial/de produto.
/** Concorre à recomendação quem custa até 10% acima da mais barata elegível. */
export const RECOMMENDATION_PRICE_WINDOW_PCT = 0.1;

export const ROUTE_SCORES: Record<RouteKind, number> = {
  direta: 100,
  transbordo: 40,
};

export const FREQUENCY_SCORES: Record<Frequency, number> = {
  diaria: 100,
  semanal: 80,
  quinzenal: 50,
  mensal: 25,
};

export type ExclusionReason =
  | 'Proposta vencida'
  | 'Seguro exigido não incluído'
  | 'Pendência de auditoria alta ou crítica'
  | 'Valor não informado'
  | 'Validade não informada';

export function exclusionReasons(
  p: ComparisonProposal,
  quotation: Pick<ComparisonQuotation['request'], 'insuranceRequired' | 'ptax'>,
  today: string,
): ExclusionReason[] {
  const reasons: ExclusionReason[] = [];
  if (p.validUntil == null) reasons.push('Validade não informada');
  else if (isExpired(p, today)) reasons.push('Proposta vencida');
  if (quotation.insuranceRequired && !p.insuranceIncluded)
    reasons.push('Seguro exigido não incluído');
  if (p.highAuditPending) reasons.push('Pendência de auditoria alta ou crítica');
  if (proposalTotals(p, quotation.ptax).brl == null) reasons.push('Valor não informado');
  return reasons;
}

// --- Normalização relativa ----------------------------------------------------

type Direction = 'lower' | 'higher';

interface RelativeRule {
  direction: Direction;
  /** Tolerância de equivalência contra o melhor valor do grupo. */
  equivalent: (value: number, best: number) => boolean;
}

/**
 * Nota 0-100 de um valor contra a régua do grupo (melhor e pior valor).
 * Equivalente ao melhor = 100; pior = 0; linear no meio. Grupo sem amplitude
 * (todos iguais) = 100 para todos. Fora da régua (uma proposta excluída que não
 * entrou no grupo) é limitado a 0..100.
 */
export function relativeScore(
  value: number,
  group: number[],
  rule: RelativeRule,
): number {
  if (!group.length) return 100;
  const best = rule.direction === 'lower' ? Math.min(...group) : Math.max(...group);
  const worst = rule.direction === 'lower' ? Math.max(...group) : Math.min(...group);
  if (rule.equivalent(value, best)) return 100;
  if (best === worst) return value === best ? 100 : 0;
  const raw = ((value - worst) / (best - worst)) * 100;
  return Math.max(0, Math.min(100, raw));
}

const COST_RULE: RelativeRule = {
  direction: 'lower',
  equivalent: (v, best) => v <= best * (1 + COST_EQUIVALENCE_PCT),
};
const TRANSIT_RULE: RelativeRule = {
  direction: 'lower',
  equivalent: (v, best) => v <= best + TRANSIT_EQUIVALENCE_DAYS,
};
const FREE_TIME_RULE: RelativeRule = {
  direction: 'higher',
  equivalent: (v, best) => v >= best - FREE_TIME_EQUIVALENCE_DAYS,
};
const VALIDITY_RULE: RelativeRule = {
  direction: 'higher',
  equivalent: (v, best) => v >= best - VALIDITY_EQUIVALENCE_BUSINESS_DAYS,
};

export interface ScoredProposal {
  proposal: ComparisonProposal;
  totalBrl: number | null;
  /** Nota por critério, 0-100. */
  criteria: Record<Criterion, number>;
  /** Soma ponderada, 0-100, arredondada a inteiro. */
  score: number;
  reasons: ExclusionReason[];
  eligible: boolean;
  /** Dentro da janela de preço da recomendação (só elegíveis). */
  inPriceWindow: boolean;
  /** % acima da mais barata elegível (null sem elegível ou sem valor). */
  aboveCheapestPct: number | null;
}

export interface RecommendationResult {
  /** Todas as propostas, por nota (maior primeiro); elegíveis antes das excluídas. */
  ranked: ScoredProposal[];
  recommended: ScoredProposal | null;
  /** A maior nota entre as elegíveis (pode não ser a recomendada). */
  highestScore: ScoredProposal | null;
  cheapestEligibleBrl: number | null;
}

/**
 * O motor inteiro. A régua dos critérios relativos é o grupo de propostas
 * ELEGÍVEIS — uma proposta vencida ou sem o seguro exigido não pode definir o
 * "melhor custo" contra o qual as outras são medidas. Sem nenhuma elegível, a
 * régua é o grupo inteiro (a tela continua mostrando notas, sem recomendada).
 */
export function scoreQuotation(
  quotation: ComparisonQuotation,
  today: string,
): RecommendationResult {
  const { request } = quotation;
  const base = quotation.proposals.map((p) => {
    const reasons = exclusionReasons(p, request, today);
    return {
      p,
      reasons,
      eligible: reasons.length === 0,
      totalBrl: proposalTotals(p, request.ptax).brl,
      validity: p.validUntil ? businessDaysUntil(p.validUntil, today) : null,
    };
  });
  const eligibleBase = base.filter((b) => b.eligible);
  const ruler = eligibleBase.length ? eligibleBase : base;

  const numeric = (
    pick: (b: (typeof base)[number]) => number | null,
    rule: RelativeRule,
    missingAs: number | null,
  ) => {
    const groupRaw = ruler.map(pick);
    // Critério ausente em TODAS as propostas é empate: 100 para todas.
    if (base.every((b) => pick(b) == null)) return () => 100;
    const group = groupRaw
      .map((v) => (v == null ? missingAs : v))
      .filter((v): v is number => v != null);
    return (b: (typeof base)[number]) => {
      const v = pick(b) ?? missingAs;
      return v == null ? 0 : relativeScore(v, group, rule);
    };
  };

  const costScore = numeric((b) => b.totalBrl, COST_RULE, null);
  const transitScore = numeric((b) => b.p.transitDays, TRANSIT_RULE, null);
  // Free time ausente conta como 0 dias e passa pela mesma equivalência e
  // normalização — não vira nota 0 automaticamente.
  const freeTimeScore = numeric((b) => b.p.freeTimeDays, FREE_TIME_RULE, 0);
  const validityScore = numeric((b) => b.validity, VALIDITY_RULE, null);
  const allRouteMissing = base.every((b) => b.p.route == null);
  const allFrequencyMissing = base.every((b) => b.p.frequency == null);

  const cheapestEligibleBrl = eligibleBase.length
    ? Math.min(...eligibleBase.map((b) => b.totalBrl as number))
    : null;

  const scored: ScoredProposal[] = base.map((b) => {
    const criteria: Record<Criterion, number> = {
      custo: costScore(b),
      transit: transitScore(b),
      rota: allRouteMissing ? 100 : b.p.route ? ROUTE_SCORES[b.p.route] : 0,
      frequencia: allFrequencyMissing
        ? 100
        : b.p.frequency
          ? FREQUENCY_SCORES[b.p.frequency]
          : 0,
      freeTime: freeTimeScore(b),
      validade: validityScore(b),
    };
    const score = Math.round(
      (Object.keys(CRITERION_WEIGHTS) as Criterion[]).reduce(
        (n, c) => n + (criteria[c] * CRITERION_WEIGHTS[c]) / 100,
        0,
      ),
    );
    const aboveCheapestPct =
      cheapestEligibleBrl != null && b.totalBrl != null
        ? (b.totalBrl - cheapestEligibleBrl) / cheapestEligibleBrl
        : null;
    return {
      proposal: b.p,
      totalBrl: b.totalBrl,
      criteria,
      score,
      reasons: b.reasons,
      eligible: b.eligible,
      inPriceWindow:
        b.eligible &&
        aboveCheapestPct != null &&
        aboveCheapestPct <= RECOMMENDATION_PRICE_WINDOW_PCT + 1e-9,
      aboveCheapestPct,
    };
  });

  const byScore = (a: ScoredProposal, b: ScoredProposal) =>
    b.score - a.score ||
    (a.totalBrl ?? Infinity) - (b.totalBrl ?? Infinity) ||
    a.proposal.id.localeCompare(b.proposal.id);

  const priceWindow = scored.filter((s) => s.inPriceWindow);
  const direct = priceWindow.filter((s) => s.proposal.route === 'direta');
  const pool = direct.length ? direct : priceWindow;
  const recommended = [...pool].sort(byScore)[0] ?? null;

  const eligibleSorted = scored.filter((s) => s.eligible).sort(byScore);
  const ranked = [
    ...eligibleSorted,
    ...scored.filter((s) => !s.eligible).sort(byScore),
  ];

  return {
    ranked,
    recommended,
    highestScore: eligibleSorted[0] ?? null,
    cheapestEligibleBrl,
  };
}

// --- Justificativa -------------------------------------------------------------

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});
const pct = (x: number) => `${Math.round(x * 100)}%`;
const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/**
 * O segundo lugar contra quem a recomendada é comparada: a maior nota entre as
 * outras elegíveis. Quando a maior nota não é a recomendada, é ela.
 */
export function runnerUp(result: RecommendationResult): ScoredProposal | null {
  if (!result.recommended) return null;
  return (
    result.ranked.find(
      (s) => s.eligible && s.proposal.id !== result.recommended?.proposal.id,
    ) ?? null
  );
}

/**
 * O parágrafo de justificativa, montado dos números. `labels` dá o nome de
 * coluna ("Alpha Logistics · Opção 1") para não confundir duas propostas do
 * mesmo agente.
 */
export function justification(
  result: RecommendationResult,
  labels: Record<string, string>,
): string {
  const rec = result.recommended;
  if (!rec) return '';
  const name = labels[rec.proposal.id] ?? rec.proposal.agentName;
  const second = runnerUp(result);
  const parts: string[] = [];

  const isCheapest =
    rec.totalBrl != null && rec.totalBrl === result.cheapestEligibleBrl;
  parts.push(
    `${name} ${isCheapest ? 'é a proposta elegível mais barata' : `custa ${pct(rec.aboveCheapestPct ?? 0)} acima da mais barata elegível, dentro da janela de 10%`}` +
      (rec.proposal.route === 'direta' ? ', com rota direta' : '') +
      '.',
  );

  if (!second) {
    parts.push('É a única proposta elegível desta cotação.');
    return parts.join(' ');
  }

  const secondName = labels[second.proposal.id] ?? second.proposal.agentName;
  const comparisons: string[] = [];
  if (rec.totalBrl != null && second.totalBrl != null) {
    const diff = second.totalBrl - rec.totalBrl;
    if (Math.abs(diff) >= 0.01)
      comparisons.push(
        diff > 0
          ? `custa ${BRL.format(diff)} a menos`
          : `custa ${BRL.format(-diff)} a mais`,
      );
  }
  const rt = rec.proposal.transitDays;
  const st = second.proposal.transitDays;
  if (rt != null && st != null && rt !== st)
    comparisons.push(
      rt < st
        ? `chega ${plural(st - rt, 'dia', 'dias')} antes`
        : `leva ${plural(rt - st, 'dia', 'dias')} a mais no trânsito`,
    );
  if (rec.proposal.route !== second.proposal.route && second.proposal.route)
    comparisons.push(
      second.proposal.route === 'transbordo'
        ? `não tem o transbordo${second.proposal.transshipment ? ` em ${second.proposal.transshipment}` : ''}`
        : 'tem transbordo, enquanto a outra é direta',
    );
  if (comparisons.length)
    parts.push(`Contra ${secondName}, ${comparisons.join(', ')}.`);

  if (second.score >= rec.score) {
    const scoreText =
      second.score > rec.score
        ? `tem a nota mais alta (${second.score} contra ${rec.score})`
        : `empata na nota (${second.score})`;
    const why =
      !second.inPriceWindow && second.aboveCheapestPct != null
        ? `, mas custa ${pct(second.aboveCheapestPct)} acima da mais barata elegível, fora da janela de 10%.`
        : second.proposal.route !== 'direta' && rec.proposal.route === 'direta'
          ? ', mas a rota direta tem prioridade dentro da janela de preço.'
          : ', e o desempate é pelo menor custo.';
    parts.push(`${secondName} ${scoreText}${why}`);
  }

  // Quando a recomendada não é a mais barata, diz por que a mais barata perdeu.
  if (!isCheapest) {
    const cheapest = result.ranked.find(
      (s) => s.eligible && s.totalBrl === result.cheapestEligibleBrl,
    );
    if (
      cheapest &&
      cheapest.proposal.id !== second.proposal.id &&
      cheapest.proposal.route !== 'direta' &&
      rec.proposal.route === 'direta'
    ) {
      const cheapestName = labels[cheapest.proposal.id] ?? cheapest.proposal.agentName;
      parts.push(
        `A mais barata elegível, ${cheapestName}, tem ${cheapest.proposal.route === 'transbordo' ? `transbordo${cheapest.proposal.transshipment ? ` em ${cheapest.proposal.transshipment}` : ''}` : 'rota sem informação'}; dentro da janela de 10%, a rota direta tem prioridade.`,
      );
    }
  }
  return parts.join(' ');
}

// --- Portão do analista ----------------------------------------------------------

export type RecommendationView =
  | { state: 'em_revisao' }
  | {
      state: 'disponivel';
      result: RecommendationResult;
      recommended: ScoredProposal;
      justification: string;
    }
  | { state: 'sem_recomendacao'; result: RecommendationResult };

/**
 * O que o cliente pode ver. Antes da aprovação do analista: NADA além do estado
 * — nem nota, nem ranking, nem dica de qual é. O objeto devolvido não carrega o
 * resultado, para que nenhum componente consiga vazá-lo por engano.
 */
export function recommendationView(
  quotation: ComparisonQuotation,
  today: string,
  analystApproved: boolean,
  labels: Record<string, string>,
): RecommendationView {
  if (!analystApproved) return { state: 'em_revisao' };
  const result = scoreQuotation(quotation, today);
  if (!result.recommended) return { state: 'sem_recomendacao', result };
  return {
    state: 'disponivel',
    result,
    recommended: result.recommended,
    justification: justification(result, labels),
  };
}

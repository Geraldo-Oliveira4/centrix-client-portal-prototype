// Mapa comparativo VERTICAL do detalhe da cotação (/portal/cotacao/[id]):
// uma coluna por proposta, atributos em linhas alinhadas, e a recomendação
// DENTRO da coluna recomendada (pedido do Orsi para a demonstração comercial).
//
// Este módulo decide TUDO o que a tela afirma: a ordem das colunas, quem leva
// os selos "menor custo" / "menor prazo" e a frase do motivo. O componente só
// desenha.
//
// Regras que sustentam a honestidade da frase (as mesmas de
// `recommendation-gap.ts`, agora contra TODAS as rivais válidas):
//
//  1. SÓ COMPETE QUEM É VÁLIDA. Proposta com `proposalIssue` (vencida, sem
//     valor, sem validade) não leva selo, não serve de rival e vai para o fim.
//  2. PRAZO SÓ ENTRA QUANDO É VANTAGEM. "Chega N dias antes" exige chegar antes
//     da rival válida MAIS RÁPIDA. Recomendada mais lenta: a frase cala sobre o
//     prazo, que continua visível na linha "Transit time".
//  3. CUSTO ENTRA NOS DOIS SENTIDOS. "R$ X acima da mais barata" é dito com a
//     mesma naturalidade de "menor custo entre as propostas" — esconder o
//     sobrepreço transformaria a frase em propaganda.
//  4. HISTÓRICO É O MESMO DA LINHA "N de M no prazo" (`illustrativeAgentHistory`
//     + `SMALL_SAMPLE`). Amostra pequena não vira fração.
//
// ILUSTRATIVO aqui: o histórico do agente (amostra estável por agente) e o free
// time quando o payload não traz `free_time_dias`. Chegada prevista é conta
// (carga pronta + transit time; sem carga pronta, hoje + transit time), não
// data confirmada pelo agente.
//
// "CHEGA A TEMPO" É FATO, NÃO CRITÉRIO: `onTime` compara a chegada prevista com
// a necessidade do cliente e marca a célula. Ele NÃO entra na ordem das colunas,
// na recomendação nem na frase — a recomendada pode chegar depois da
// necessidade, e a tela mostra as duas coisas lado a lado.
//
// PURO, sem `@/`: roda sob `node --test` (comparison-map-model.test.ts).

import { addDays, isValidDay } from '../../../../lib/demo-clock.ts';
import { seededInt } from '../../inteligencia/lib/intel-helpers.ts';
import { SMALL_SAMPLE, type AgentRouteHistory } from './agent-history-line.ts';
import { illustrativeAgentHistory, proposalIssue } from './detail-model.ts';

/** O mínimo de `PortalProposal` que o mapa lê. */
export interface MapProposal {
  id: string;
  agent_id?: string | null;
  total_brl: number;
  transit_time?: number | null;
  validity: string | null;
  /** Ainda não existe no DTO do portal; quando vier, vence o valor ilustrativo. */
  free_time_dias?: number | null;
}

export interface MapFreeTime {
  days: number;
  /** `true` quando o número não veio do payload. */
  illustrative: boolean;
}

export interface MapColumn<P extends MapProposal> {
  proposal: P;
  /** Motivo de a proposta não poder ser escolhida, ou `null`. */
  issue: string | null;
  recommended: boolean;
  cheapest: boolean;
  fastest: boolean;
  /** `AAAA-MM-DD`: carga pronta (ou hoje) + transit time. `null` sem trânsito. */
  arrival: string | null;
  /** Chega até a necessidade do cliente? `null` sem chegada ou sem necessidade. */
  onTime: boolean | null;
  freeTime: MapFreeTime | null;
  history: AgentRouteHistory | null;
}

export interface ComparisonMap<P extends MapProposal> {
  columns: MapColumn<P>[];
  /** Id da coluna destacada; `null` quando não há recomendação válida. */
  recommendedId: string | null;
  /** A frase do motivo; `null` junto com `recommendedId`. */
  reason: string | null;
}

export interface ComparisonMapOptions {
  recommendedId: string | null | undefined;
  /** `AAAA-MM-DD`. */
  today: string;
  /** Carga pronta (`data_prontidao`): de onde a chegada parte. Ausente: hoje. */
  readyDate?: string | null;
  /** Necessidade de chegada do cliente (`data_limite_necessidade`). */
  needBy?: string | null;
  /** Injetável para teste; o padrão é a fonte da linha de histórico da tela. */
  historyOf?: (agentId: string) => AgentRouteHistory | null;
}

const transitOf = (p: MapProposal): number | null =>
  typeof p.transit_time === 'number' &&
  Number.isFinite(p.transit_time) &&
  p.transit_time > 0
    ? p.transit_time
    : null;

const brl = (value: number) =>
  'R$ ' + Math.round(value).toLocaleString('pt-BR');

const days = (n: number) => (n === 1 ? '1 dia' : `${n} dias`);

/**
 * As marcas "ilustrativo" da tela. Desligadas em 27/11/2026 SÓ para a
 * demonstração comercial: os valores continuam ilustrativos (free time sem
 * `free_time_dias`, referência de mercado), apenas sem o rótulo. Reverter é
 * trocar para `true`.
 */
export const SHOW_ILLUSTRATIVE_MARKS = false;

/** O dia (`AAAA-MM-DD`) de uma data ISO com ou sem hora; `null` se inválida. */
const dayOf = (iso: string | null | undefined): string | null => {
  const day = iso ? iso.slice(0, 10) : null;
  return isValidDay(day) ? day : null;
};

/**
 * Chegada prevista: carga pronta + transit time. Sem carga pronta (ou com data
 * inválida) parte de hoje, que era a regra anterior — assim cotação sem
 * `data_prontidao` continua mostrando uma data.
 */
export function arrivalDate(
  transitDays: number | null | undefined,
  readyDate: string | null | undefined,
  today: string,
): string | null {
  if (
    typeof transitDays !== 'number' ||
    !Number.isFinite(transitDays) ||
    transitDays <= 0
  )
    return null;
  return addDays(dayOf(readyDate) ?? today, transitDays);
}

/**
 * A chegada atende a necessidade? Chegar NO dia conta como a tempo. `null`
 * quando falta um dos lados: sem necessidade informada não há o que marcar.
 */
export function onTime(
  arrival: string | null | undefined,
  need: string | null | undefined,
): boolean | null {
  const a = dayOf(arrival);
  const n = dayOf(need);
  if (!a || !n) return null;
  return a <= n;
}

/** Free time do payload quando existe; senão um valor estável por agente. */
export function freeTimeOf(p: MapProposal): MapFreeTime | null {
  if (
    typeof p.free_time_dias === 'number' &&
    Number.isFinite(p.free_time_dias) &&
    p.free_time_dias >= 0
  )
    return { days: p.free_time_dias, illustrative: false };
  if (!p.agent_id) return null;
  return {
    days: seededInt(p.agent_id + ':freetime', 7, 21),
    illustrative: true,
  };
}

function joinParts(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return parts.slice(0, -1).join(', ') + ' e ' + parts[parts.length - 1];
}

/** A frase sob o selo "Recomendada pela IA". Só afirma o que as linhas mostram. */
export function recommendationReason<P extends MapProposal>(
  recommended: MapColumn<P>,
  rivals: MapColumn<P>[],
): string {
  const parts: string[] = [];

  if (rivals.length === 0) {
    parts.push('única proposta válida no momento');
  } else {
    const cheapestRival = Math.min(...rivals.map((c) => c.proposal.total_brl));
    const over = Math.round(recommended.proposal.total_brl - cheapestRival);
    if (over > 0) parts.push(`${brl(over)} acima da mais barata`);
    else if (over === 0) parts.push('empata no menor custo entre as propostas');
    else parts.push('menor custo entre as propostas');

    const own = transitOf(recommended.proposal);
    const rivalTransits = rivals
      .map((c) => transitOf(c.proposal))
      .filter((t): t is number => t != null);
    if (own != null && rivalTransits.length > 0) {
      const ahead = Math.min(...rivalTransits) - own;
      if (ahead > 0)
        parts.push(
          `chega ${days(ahead)} antes` +
            (rivals.length > 1 ? ' da segunda mais rápida' : ''),
        );
    }
  }

  const h = recommended.history;
  parts.push(
    h && h.completed >= SMALL_SAMPLE
      ? `este agente cumpriu o prazo em ${h.onTime} de ${h.completed} embarques desta rota`
      : 'ainda sem histórico suficiente deste agente nesta rota',
  );

  return `Recomendada: ${joinParts(parts)}.`;
}

/**
 * Monta o mapa: recomendada primeiro, válidas na ordem do payload, propostas
 * com `issue` no fim. A recomendação só vale se apontar para proposta válida.
 */
export function buildComparisonMap<P extends MapProposal>(
  proposals: P[],
  options: ComparisonMapOptions,
): ComparisonMap<P> {
  const historyOf = options.historyOf ?? illustrativeAgentHistory;
  const issues = new Map(
    proposals.map((p) => [p.id, proposalIssue(p, options.today)]),
  );
  const valid = proposals.filter((p) => !issues.get(p.id));
  const recommendedId =
    valid.find((p) => p.id === options.recommendedId)?.id ?? null;

  // Selo é comparação: com uma válida só não há contra quem ser "menor".
  const compares = valid.length > 1;
  const minCost = Math.min(...valid.map((p) => p.total_brl));
  const transits = valid
    .map(transitOf)
    .filter((t): t is number => t != null);
  const minTransit = transits.length ? Math.min(...transits) : null;

  const rank = (p: P) =>
    p.id === recommendedId ? 0 : issues.get(p.id) ? 2 : 1;

  const columns = proposals
    .map((p, index) => ({ p, index }))
    .sort((a, b) => rank(a.p) - rank(b.p) || a.index - b.index)
    .map(({ p }): MapColumn<P> => {
      const issue = issues.get(p.id) ?? null;
      const transit = transitOf(p);
      const arrival = arrivalDate(transit, options.readyDate, options.today);
      return {
        proposal: p,
        issue,
        recommended: p.id === recommendedId,
        cheapest: compares && !issue && p.total_brl === minCost,
        fastest:
          compares && !issue && transit != null && transit === minTransit,
        arrival,
        onTime: onTime(arrival, options.needBy),
        freeTime: freeTimeOf(p),
        history: p.agent_id ? historyOf(p.agent_id) : null,
      };
    });

  const recommended = columns.find((c) => c.recommended) ?? null;
  return {
    columns,
    recommendedId,
    reason: recommended
      ? recommendationReason(
          recommended,
          columns.filter((c) => !c.recommended && !c.issue),
        )
      : null,
  };
}

// Histórico do agente no detalhe da cotação: linha na tabela + gaveta
// (07/10/2026). Substitui o bloco "Raio X do agente de cargas" e o seletor
// "Consultar agente": o histórico passa a aparecer EM CADA OFERTA, para os
// agentes serem comparados de relance, e o detalhe abre numa gaveta.
//
// FATOS, SEM NOTA ("dado, não veredito"). A fonte NÃO mudou: o detalhe real
// continua usando `illustrativeAgentHistory` (detail-model.ts) e a prévia os
// campos `onTime/completed/audited/discrepancies` da própria oferta. Este
// módulo só redige — as duas telas passam a dizer a mesma coisa do mesmo jeito.
//
// PURO, sem `@/`: roda sob `node --test` (agent-history-line.test.ts).

export interface AgentRouteHistory {
  /** Chegadas no prazo entre os embarques concluídos. */
  onTime: number;
  /** Embarques concluídos nesta rota. */
  completed: number;
  /** Fretes conferidos (cotado × cobrado). */
  audited: number;
  /** Divergências confirmadas entre os conferidos. */
  discrepancies: number;
}

/** Abaixo disto a amostra é pequena (mesmo limite da Inteligência). */
export const SMALL_SAMPLE = 3;

export type HistoryLineKind = 'sem_historico' | 'amostra_pequena' | 'normal';

export interface HistoryLine {
  kind: HistoryLineKind;
  text: string;
}

const divergences = (n: number) =>
  n === 1 ? '1 divergência' : `${n} divergências`;

/**
 * A linha curta sob o nome do agente, por oferta:
 *   "8 de 10 no prazo nesta rota · 1 divergência"
 *   "Sem histórico nesta rota"
 *   "Amostra pequena (n=2)"
 */
export function agentHistoryLine(h: AgentRouteHistory | null | undefined): HistoryLine {
  if (!h || h.completed <= 0)
    return { kind: 'sem_historico', text: 'Sem histórico nesta rota' };
  if (h.completed < SMALL_SAMPLE)
    return { kind: 'amostra_pequena', text: `Amostra pequena (n=${h.completed})` };
  const base = `${h.onTime} de ${h.completed} no prazo nesta rota`;
  return {
    kind: 'normal',
    text: h.discrepancies > 0 ? `${base} · ${divergences(h.discrepancies)}` : base,
  };
}

export interface HistoryFact {
  term: string;
  value: string;
  unit: string | null;
  note: string;
}

/** Os três fatos da gaveta, os mesmos que o Raio X mostrava. */
export function agentHistoryFacts(
  h: AgentRouteHistory | null | undefined,
  routeLabel: string,
): HistoryFact[] {
  const done = h && h.completed > 0 ? h : null;
  const audited = h && h.audited > 0 ? h : null;
  return [
    {
      term: 'Cumprimento de prazo',
      value: done ? `${done.onTime} de ${done.completed}` : 'Sem histórico',
      unit: done ? 'chegadas no prazo' : null,
      note: done
        ? `Após o previsto no porto: ${done.completed - done.onTime} de ${done.completed}.`
        : 'Ainda não há chegadas para avaliar.',
    },
    {
      term: 'Cotado × cobrado',
      value: audited
        ? audited.discrepancies === 0
          ? 'Nenhuma'
          : String(audited.discrepancies)
        : 'Sem auditorias',
      unit: audited
        ? audited.discrepancies === 1
          ? 'divergência confirmada'
          : 'divergências confirmadas'
        : null,
      note: audited
        ? `${audited.audited} fretes conferidos nesta amostra.`
        : 'Ainda não há cobranças conferidas.',
    },
    {
      term: 'Experiência nesta rota',
      value: done ? String(done.completed) : 'Sem histórico',
      unit: done ? 'embarques concluídos' : null,
      note: routeLabel,
    },
  ];
}

/** Sempre impresso na gaveta, com ou sem histórico. */
export const HISTORY_DISCLAIMER =
  'A pontualidade observada não garante a próxima chegada.';

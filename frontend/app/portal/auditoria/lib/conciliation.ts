// Camadas 1 e 2 da Auditoria — conciliação determinística e árvore de decisão.
//
// CONCEITUAL POR INTEIRO. Nada aqui lê dado do backend, e isso é deliberado:
//
//  - o gatilho real da auditoria é a chegada do embarque, e `EmbarqueState`
//    (shared/database/models/shipment/enums.py) termina em `embarcado` — não
//    existe estado de chegada/desembaraço/entrega neste schema;
//  - o lado "realizado" viria da NF final, e não existe model de nota fiscal,
//    fatura ou invoice em lugar nenhum do repositório.
//
// Como as duas pontas faltam, os embarques abaixo são exemplos fictícios e
// rotulados como tal na UI. Preferimos um exemplo declaradamente inventado a
// pendurar números fabricados na referência de um embarque real do cliente —
// isso faria a tela parecer mais completa do que o dado é.
//
// A árvore de decisão (`evaluateLine`) é if/else puro: nenhuma chamada de IA.

/** Mesmo limite de divergência do backend (app/audit_preview.py). */
export const DIVERGENCE_THRESHOLD_PCT = 5;

export type LineKind = 'currency' | 'days';

export interface ConciliationLine {
  /** "Frete", "Taxa THC", "Prazo"... */
  item: string;
  kind: LineKind;
  /** Do que foi contratado na cotação. */
  planned: number;
  /** Do que veio na NF final / no fechamento do embarque. */
  realized: number;
}

export interface ConciliationExample {
  reference: string;
  route: string;
  agent: string;
  lines: ConciliationLine[];
}

export type LineStatus = 'match' | 'divergent';

export interface EvaluatedLine extends ConciliationLine {
  /** realized - planned. Positivo = cobraram/levaram mais do que o combinado. */
  difference: number;
  /** Variação percentual sobre o planejado, arredondada a 1 casa. */
  variationPct: number;
  status: LineStatus;
  /**
   * Árvore de decisão (Camada 2): sugerimos contestar quando a diferença passa
   * do limite PARA CIMA. Uma variação para baixo também é divergência (a linha
   * fica marcada), mas não há o que contestar quando veio a menos.
   */
  suggestContest: boolean;
}

export function evaluateLine(line: ConciliationLine): EvaluatedLine {
  const difference = line.realized - line.planned;
  const variationPct =
    line.planned !== 0
      ? Math.round((difference / line.planned) * 1000) / 10
      : 0;
  const divergent = Math.abs(variationPct) > DIVERGENCE_THRESHOLD_PCT;

  return {
    ...line,
    difference,
    variationPct,
    status: divergent ? 'divergent' : 'match',
    suggestContest: divergent && variationPct > 0,
  };
}

export const evaluateExample = (example: ConciliationExample): EvaluatedLine[] =>
  example.lines.map(evaluateLine);

/**
 * Exemplos fictícios. As referências usam o prefixo EXEMPLO- justamente para
 * nunca colidirem com uma referência real de embarque do cliente.
 *
 * O primeiro tem duas divergências (uma acima do limite para cima -> sugere
 * contestação, uma no prazo), o segundo fecha limpo — para a tela mostrar os
 * dois desfechos da árvore de decisão.
 */
export const CONCILIATION_EXAMPLES: ConciliationExample[] = [
  {
    reference: 'EXEMPLO-0001',
    route: 'Shanghai (CNSHA) → Santos (BRSSZ)',
    agent: 'Agente de exemplo',
    lines: [
      { item: 'Frete', kind: 'currency', planned: 18400, realized: 18400 },
      { item: 'Taxa THC', kind: 'currency', planned: 1250, realized: 1610 },
      { item: 'Prazo', kind: 'days', planned: 32, realized: 39 },
    ],
  },
  {
    reference: 'EXEMPLO-0002',
    route: 'Ningbo (CNNGB) → Itapoá (BRIOA)',
    agent: 'Agente de exemplo',
    lines: [
      { item: 'Frete', kind: 'currency', planned: 15900, realized: 15900 },
      { item: 'Taxa THC', kind: 'currency', planned: 1250, realized: 1250 },
      { item: 'Prazo', kind: 'days', planned: 28, realized: 29 },
    ],
  },
];

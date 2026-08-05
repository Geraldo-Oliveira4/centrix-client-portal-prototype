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

export interface ConciliationSummary {
  example: ConciliationExample;
  /** Linhas com status `divergent` — o número que o badge da lista mostra. */
  divergences: number;
  /** Alguma linha divergiu PARA CIMA, isto é, existe o que contestar. */
  hasContestable: boolean;
}

/**
 * Resumo por embarque para a lista compacta. Roda a mesma `evaluateLine` do
 * detalhe de propósito: o badge da lista e a leitura da tabela não podem
 * discordar, então nenhum dos dois recalcula o limite por conta própria.
 */
export const summarizeExample = (
  example: ConciliationExample,
): ConciliationSummary => {
  const lines = evaluateExample(example);
  return {
    example,
    divergences: lines.filter((l) => l.status === 'divergent').length,
    hasContestable: lines.some((l) => l.suggestContest),
  };
};

export interface DivergenceCause {
  /** "Taxa THC", "Prazo", "Frete"... — o item conciliado. */
  item: string;
  /** Embarques em que ESTE item divergiu. */
  count: number;
  /** Participação sobre o total de divergências, 0-100, uma casa decimal. */
  sharePct: number;
}

/**
 * Camada 1, leitura agregada: quais itens mais divergem.
 *
 * DENOMINADOR = total de linhas divergentes, não de embarques. A pergunta é
 * "das divergências que aconteceram, quais itens as causaram", então as fatias
 * somam 100% e as barras são comparáveis entre si. Usar "embarques" como
 * denominador daria percentuais que não somam nada e um mesmo embarque com três
 * itens divergentes contaria três vezes contra um universo de um.
 *
 * GENÉRICA DE PROPÓSITO: recebe os exemplos como argumento e reusa
 * `evaluateLine`, o mesmo if/else da tabela de detalhe. Nada aqui conhece
 * `CONCILIATION_EXAMPLES`, o prefixo EXEMPLO- ou a quantidade de itens — quando
 * a fonte virar embarque real com NF final, troca-se o argumento e a função
 * continua correta. Ela também não sabe quais itens existem: item novo
 * ("Armazenagem", "Sobrestadia") entra sozinho no ranking.
 *
 * Empate é resolvido pelo nome do item, para a ordem não oscilar entre renders.
 */
export function computeDivergenceCauses(
  examples: ConciliationExample[],
): DivergenceCause[] {
  const counts = new Map<string, number>();

  for (const example of examples) {
    for (const line of evaluateExample(example)) {
      if (line.status !== 'divergent') continue;
      counts.set(line.item, (counts.get(line.item) ?? 0) + 1);
    }
  }

  const total = Array.from(counts.values()).reduce((sum, n) => sum + n, 0);
  if (total === 0) return [];

  return Array.from(counts, ([item, count]) => ({
    item,
    count,
    sharePct: Math.round((count / total) * 1000) / 10,
  })).sort((a, b) => b.count - a.count || a.item.localeCompare(b.item));
}

/**
 * Exemplos fictícios. As referências usam o prefixo EXEMPLO- justamente para
 * nunca colidirem com uma referência real de embarque do cliente.
 *
 * Os cinco cobrem todos os desfechos possíveis da árvore de decisão, que é a
 * razão de existirem — sem eles a tela mostra só um caminho e a leitura "bate x
 * diverge x diverge e vale contestar" não fica visível:
 *
 *   0001  divergência para cima em duas linhas       -> Diverge + contestar
 *   0002  fecha limpo, tudo igual ao planejado       -> Bate
 *   0003  várias divergências grandes para cima      -> Diverge + contestar
 *   0004  diferenças reais mas ABAIXO do limite      -> Bate (apesar de ≠ 0)
 *   0005  divergência acima do limite para BAIXO     -> Diverge, SEM contestar
 *
 * 0004 e 0005 são os dois casos que separam "diferente" de "contestável": no
 * primeiro a variação existe mas cabe no limite; no segundo passa do limite e
 * mesmo assim não há o que contestar, porque veio a menos.
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
  {
    reference: 'EXEMPLO-0003',
    route: 'Shenzhen (CNSZX) → Paranaguá (BRPNG)',
    agent: 'Agente de exemplo',
    lines: [
      { item: 'Frete', kind: 'currency', planned: 22000, realized: 25300 },
      { item: 'Taxa THC', kind: 'currency', planned: 1400, realized: 1750 },
      { item: 'Armazenagem', kind: 'currency', planned: 900, realized: 1440 },
      { item: 'Prazo', kind: 'days', planned: 30, realized: 41 },
    ],
  },
  {
    reference: 'EXEMPLO-0004',
    route: 'Hamburgo (DEHAM) → Santos (BRSSZ)',
    agent: 'Agente de exemplo',
    lines: [
      { item: 'Frete', kind: 'currency', planned: 16800, realized: 17200 },
      { item: 'Taxa THC', kind: 'currency', planned: 1250, realized: 1290 },
      { item: 'Prazo', kind: 'days', planned: 30, realized: 31 },
    ],
  },
  {
    reference: 'EXEMPLO-0005',
    route: 'Roterdã (NLRTM) → Itajaí (BRITJ)',
    agent: 'Agente de exemplo',
    lines: [
      { item: 'Frete', kind: 'currency', planned: 19500, realized: 17600 },
      { item: 'Taxa THC', kind: 'currency', planned: 1250, realized: 1250 },
      { item: 'Prazo', kind: 'days', planned: 34, realized: 30 },
    ],
  },
];

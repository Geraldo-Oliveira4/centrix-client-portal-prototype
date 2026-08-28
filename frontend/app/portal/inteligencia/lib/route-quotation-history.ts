// O histórico do próprio cliente numa rota — o que preenche o bloco "Mercado"
// quando o Radar de Preços não acompanha aquela rota.
//
// POR QUE ESTE ARQUIVO EXISTE (28/08/2026)
// ----------------------------------------
// Rota fora do Radar caía numa frase de duas linhas explicando a ausência, e o
// card ficava com ~200px de vazio abaixo dela. Não era layout: era falta de
// conteúdo REAL naquele ramo. E existe conteúdo real ali — o cliente já fechou
// cotações naquela mesma rota, e o preço que ELE pagou é a única referência de
// mercado honesta que este repositório tem para uma rota que o Radar ignora.
//
// A regra que mantém isso honesto é a de sempre: reusar, não reproduzir.
//
//  - a rota de cada cotação sai de `quotationRadarRoute`, a MESMA ponte que a
//    busca no Radar usa (`quotationRouteParts` + `normalizeRadarRoute`). Uma
//    segunda forma de comparar rota erraria calada justamente no caso mais
//    comum, o do destino não nomeado que vira "Brasil" e depois porto de
//    chegada — e o bloco mostraria "nenhuma cotação anterior" para um cliente
//    que tem cinco;
//  - o valor é `best_proposal.total_brl` da cotação FECHADA, o mesmo campo que
//    o card "Esta cotação" imprime logo acima e que a Economia soma. Nada aqui
//    é derivado, estimado ou arredondado para efeito.
//
// O que este módulo NÃO faz: tendência, média, comparação contra benchmark.
// Duas cotações do próprio cliente em meses diferentes não são uma série de
// preço de mercado, e transformá-las numa seta de tendência seria inventar a
// leitura que o Radar existe para dar.
//
// Puro e unit-testado (`route-quotation-history.test.ts`).

import type { PortalQuotation } from '@/types/portal';

import { quotationRadarRoute } from './quotation-radar-route.ts';

/**
 * Quantas cotações a lista mostra. O MESMO critério do `EVIDENCE_WINDOW` da
 * Evidência: a lista é curta porque o bloco é um complemento, não a tela de
 * Histórico. Quando há mais do que isto, o corte é DECLARADO (`total` abaixo) —
 * truncar em silêncio leria como "é só isso".
 */
export const ROUTE_HISTORY_WINDOW = 3;

export interface RouteQuotationHistoryItem {
  id: string;
  reference: string;
  /** Valor da proposta vencedora, em BRL. Sempre > 0 — ver `pickValue`. */
  valueBRL: number;
  /** Quando fechou (ISO). */
  closedAt: string;
}

export interface RouteQuotationHistory {
  /** As mais recentes primeiro, no máximo `ROUTE_HISTORY_WINDOW`. */
  items: RouteQuotationHistoryItem[];
  /** Quantas existem na rota ao todo. Igual a `items.length` sem corte. */
  total: number;
  /** Frase de abertura, já no singular/plural certo. */
  headline: string;
}

interface RouteQuotationHistoryInput {
  /** A cotação aberta na tela — define a rota e nunca entra no resultado. */
  quotation: PortalQuotation | undefined;
  /** Todas as cotações do cliente (`flattenQuotations` da resposta do portal). */
  quotations: PortalQuotation[];
}

/**
 * O valor fechado, ou null quando não há um.
 *
 * Cotação FECHADA sem `best_proposal` com valor existe (fechamento registrado
 * fora do fluxo de proposta) e fica de FORA da lista em vez de entrar com
 * "R$ 0,00": a linha existe para mostrar quanto custou, e uma linha sem preço
 * não responde nada.
 */
function pickValue(q: PortalQuotation): number | null {
  const value = q.best_proposal?.total_brl ?? 0;
  return value > 0 ? value : null;
}

/**
 * Quando a cotação fechou.
 *
 * É `resolveClosedAt` (lib/portal-state.ts) restrito ao caso FECHADA — o ramo
 * `declined_at` daquela função não se aplica a nada que chegue aqui. Mesma
 * restrição que `computeSavingsTrend` faz, e pelo mesmo motivo: importar o
 * helper do alias `@/` quebraria o runner nativo do Node em que este módulo é
 * testado.
 */
function closedAtOf(q: PortalQuotation): string {
  return q.closed_at ?? q.updated_at ?? q.created_at;
}

function buildHeadline(total: number, shown: number): string {
  const base =
    total === 1
      ? 'Você já fechou uma cotação nesta rota.'
      : `Você já fechou ${total} cotações nesta rota.`;
  // O corte só é anunciado quando existe: dizer "mostrando as 3 mais recentes"
  // com 3 no total seria ruído, e o cliente confere a conta na lista.
  return shown < total ? `${base} Abaixo, as ${shown} mais recentes.` : base;
}

/**
 * As cotações FECHADAS do cliente na MESMA rota desta cotação.
 *
 * Devolve **null** — e não uma lista vazia — quando não há o que mostrar
 * (cotação sem origem, ou nenhuma fechada na rota). O ramo de fallback do bloco
 * "Mercado" continua sendo a frase que explica a ausência: sem histórico, o
 * certo é dizer que não há, não forçar conteúdo.
 */
export function findRouteQuotationHistory(
  input: RouteQuotationHistoryInput,
): RouteQuotationHistory | null {
  const { quotation, quotations } = input;
  const { id: routeId } = quotationRadarRoute(quotation);
  if (!routeId) return null;

  const matches: RouteQuotationHistoryItem[] = [];
  for (const q of quotations) {
    if (q.id === quotation?.id) continue;
    if (q.state !== 'FECHADA') continue;
    const value = pickValue(q);
    if (value == null) continue;
    if (quotationRadarRoute(q).id !== routeId) continue;
    matches.push({
      id: q.id,
      reference: q.reference,
      valueBRL: value,
      closedAt: closedAtOf(q),
    });
  }

  if (matches.length === 0) return null;

  // Mais recente primeiro; data inválida vai para o fim, mesma disciplina do
  // `byRecency` da Evidência. A referência desempata para a ordem não oscilar
  // entre renders quando duas fecham no mesmo instante.
  matches.sort((a, b) => {
    const ta = Date.parse(a.closedAt);
    const tb = Date.parse(b.closedAt);
    const va = Number.isNaN(ta) ? -Infinity : ta;
    const vb = Number.isNaN(tb) ? -Infinity : tb;
    if (va !== vb) return vb - va;
    return a.reference.localeCompare(b.reference);
  });

  const items = matches.slice(0, ROUTE_HISTORY_WINDOW);
  return {
    items,
    total: matches.length,
    headline: buildHeadline(matches.length, items.length),
  };
}

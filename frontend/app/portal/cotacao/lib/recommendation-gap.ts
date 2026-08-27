// A diferenca concreta entre a proposta recomendada e a segunda colocada.
//
// POR QUE ESTE ARQUIVO EXISTE (segunda rodada, 27/08/2026)
// --------------------------------------------------------
// Na primeira rodada a Recomendacao perdeu a "Pontuacao geral: X/100" e as seis
// barras (risco reputacional ZO4 — ver o comentario de
// `components/recommendation-view.tsx`). O que sobrou foi so qualitativo:
// "melhor equilibrio entre custo, prazo e condicoes". Sem placar E sem fato, a
// secao virou opiniao sem lastro — raso, nao minimalista.
//
// A correcao NAO e devolver o placar: e devolver FATO. E o fato ja esta na
// tela, na tabela comparativa logo acima — o cliente consegue conferir a
// subtracao com os olhos. Este modulo so faz a conta que ele faria.
//
// Tres regras que sustentam a honestidade da frase:
//
//  1. NADA DE FONTE NOVA. Entram os mesmos `total_brl` e `transit_time` que a
//     tabela imprime, e o mesmo ranking que a propria recomendacao devolveu.
//     Nenhum calculo de score acontece aqui.
//  2. SO SE FOR VANTAGEM. Uma dimensao entra na frase apenas quando a
//     recomendada e MELHOR nela. Na COT-2026-0001 a recomendada e R$ 600 mais
//     barata e 4 dias MAIS LENTA: a frase fala do preco e cala sobre o prazo.
//     Dizer "chega antes" ali seria mentira, e dizer "chega 4 dias depois"
//     seria transformar a recomendacao em advertencia contra ela mesma — quem
//     quiser ver o prazo tem a tabela, que mostra os dois numeros lado a lado.
//  3. SEM VANTAGEM MENSURAVEL, SEM FRASE. A recomendada pode vencer por rota,
//     frequencia, free time ou validade e perder em preco e prazo. Nesse caso a
//     funcao devolve `null` e a tela cai na frase qualitativa — melhor generico
//     do que um numero torcido para parecer vantagem.

/** Uma linha de score, como o endpoint de recomendacao a devolve. */
export interface GapScore {
  proposal_id: string;
  agent_name: string;
  is_eligible: boolean;
  total_score: number | null;
}

/** Os dois numeros que a tabela comparativa ja mostra por proposta. */
export interface GapProposal {
  id: string;
  total_brl: number;
  transit_time: number;
}

export interface RecommendationGapInput {
  recommendedProposalId: string | null | undefined;
  scores: GapScore[];
  proposals: GapProposal[];
}

export interface RecommendationGap {
  agentName: string;
  runnerUpName: string;
  /** Dias a menos de transito. Preenchido SO quando a recomendada e mais rapida. */
  transitDaysSaved: number | null;
  /** Reais a menos no total. Preenchido SO quando a recomendada e mais barata. */
  brlSaved: number | null;
}

/**
 * A "segunda opcao": a elegivel de maior score que NAO e a recomendada.
 *
 * Nao e simplesmente `sorted[1]` porque a recomendada pode nao ser a primeira
 * (override manual do analista). O desempate por id existe so para a frase nao
 * trocar de agente entre dois renders com o mesmo dado.
 */
function findRunnerUp(
  scores: GapScore[],
  recommendedProposalId: string,
): GapScore | null {
  const others = scores.filter(
    (s) =>
      s.proposal_id !== recommendedProposalId &&
      s.is_eligible &&
      s.total_score != null,
  );
  if (others.length === 0) return null;
  return [...others].sort((a, b) => {
    const delta = (b.total_score ?? 0) - (a.total_score ?? 0);
    return delta !== 0 ? delta : a.proposal_id.localeCompare(b.proposal_id);
  })[0];
}

/**
 * Devolve as vantagens mensuraveis da recomendada sobre a segunda colocada, ou
 * `null` quando nao ha o que afirmar. Pura: nao le rede, relogio nem DOM.
 */
export function computeRecommendationGap(
  input: RecommendationGapInput,
): RecommendationGap | null {
  const { recommendedProposalId, scores, proposals } = input;
  if (!recommendedProposalId) return null;

  const recommendedScore = scores.find(
    (s) => s.proposal_id === recommendedProposalId,
  );
  if (!recommendedScore) return null;

  const runnerUp = findRunnerUp(scores, recommendedProposalId);
  if (!runnerUp) return null;

  const best = proposals.find((p) => p.id === recommendedProposalId);
  const second = proposals.find((p) => p.id === runnerUp.proposal_id);
  if (!best || !second) return null;

  const daysSaved = second.transit_time - best.transit_time;
  const brlSaved = second.total_brl - best.total_brl;

  const transitDaysSaved =
    Number.isFinite(daysSaved) && daysSaved > 0 ? daysSaved : null;
  // Centavos de diferenca nao sao vantagem: arredonda para o real antes de
  // decidir, senao "custa R$ 0,00 a menos" entra na frase.
  const savings =
    Number.isFinite(brlSaved) && Math.round(brlSaved) > 0
      ? Math.round(brlSaved)
      : null;

  if (transitDaysSaved == null && savings == null) return null;

  return {
    agentName: recommendedScore.agent_name,
    runnerUpName: runnerUp.agent_name,
    transitDaysSaved,
    brlSaved: savings,
  };
}

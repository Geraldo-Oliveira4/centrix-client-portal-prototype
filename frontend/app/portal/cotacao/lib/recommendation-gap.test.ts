// Unit test da diferenca concreta da Recomendacao. Mesmo runner dos outros libs:
//
//     npm run test:unit
//
// O que erra em silencio aqui: afirmar vantagem que nao existe. A recomendada da
// COT-2026-0001 e mais barata E MAIS LENTA que a segunda colocada; uma funcao
// que devolvesse os dois deltas sem sinal faria a tela dizer "chega 4 dias
// antes" sobre a proposta que chega 4 dias depois. Por isso cada dimensao so
// sai preenchida quando e VANTAGEM, e o teste do cenario real esta abaixo.

import test from 'node:test';
import assert from 'node:assert/strict';

import { computeRecommendationGap } from './recommendation-gap.ts';

const score = (id, name, total, eligible = true) => ({
  proposal_id: id,
  agent_name: name,
  is_eligible: eligible,
  total_score: total,
});

const proposal = (id, brl, transit) => ({
  id,
  total_brl: brl,
  transit_time: transit,
});

test('COT-2026-0001: mais barata e mais lenta -> so o preco vira fato', () => {
  const gap = computeRecommendationGap({
    recommendedProposalId: 'alpha',
    scores: [score('alpha', 'AGENTE ALPHA', 75.2), score('beta', 'AGENTE BETA', 69.2)],
    proposals: [proposal('alpha', 6050, 32), proposal('beta', 6650, 28)],
  });
  assert.equal(gap.agentName, 'AGENTE ALPHA');
  assert.equal(gap.runnerUpName, 'AGENTE BETA');
  assert.equal(gap.brlSaved, 600);
  assert.equal(gap.transitDaysSaved, null, 'chega DEPOIS — nunca vira vantagem');
});

test('mais rapida e mais cara -> so o prazo vira fato', () => {
  const gap = computeRecommendationGap({
    recommendedProposalId: 'a',
    scores: [score('a', 'A', 80), score('b', 'B', 70)],
    proposals: [proposal('a', 7000, 25), proposal('b', 6500, 30)],
  });
  assert.equal(gap.transitDaysSaved, 5);
  assert.equal(gap.brlSaved, null);
});

test('melhor nas duas -> as duas viram fato', () => {
  const gap = computeRecommendationGap({
    recommendedProposalId: 'a',
    scores: [score('a', 'A', 90), score('b', 'B', 60)],
    proposals: [proposal('a', 6000, 20), proposal('b', 6800, 27)],
  });
  assert.equal(gap.transitDaysSaved, 7);
  assert.equal(gap.brlSaved, 800);
});

test('pior nas duas -> null, e a tela cai na frase qualitativa', () => {
  const gap = computeRecommendationGap({
    recommendedProposalId: 'a',
    scores: [score('a', 'A', 90), score('b', 'B', 60)],
    proposals: [proposal('a', 7000, 40), proposal('b', 6000, 30)],
  });
  assert.equal(gap, null);
});

test('empate nas duas nao e vantagem', () => {
  const gap = computeRecommendationGap({
    recommendedProposalId: 'a',
    scores: [score('a', 'A', 90), score('b', 'B', 60)],
    proposals: [proposal('a', 6000, 30), proposal('b', 6000, 30)],
  });
  assert.equal(gap, null);
});

test('diferenca de centavos nao vira "R$ 0 a menos"', () => {
  const gap = computeRecommendationGap({
    recommendedProposalId: 'a',
    scores: [score('a', 'A', 90), score('b', 'B', 60)],
    proposals: [proposal('a', 6000.1, 30), proposal('b', 6000.4, 30)],
  });
  assert.equal(gap, null);
});

test('proposta unica nao tem segunda opcao', () => {
  const gap = computeRecommendationGap({
    recommendedProposalId: 'a',
    scores: [score('a', 'A', 90)],
    proposals: [proposal('a', 6000, 30)],
  });
  assert.equal(gap, null);
});

test('inelegivel nao serve de segunda opcao', () => {
  const gap = computeRecommendationGap({
    recommendedProposalId: 'a',
    scores: [score('a', 'A', 90), score('b', 'B', null, false)],
    proposals: [proposal('a', 6000, 20), proposal('b', 9000, 40)],
  });
  assert.equal(gap, null);
});

test('override: a segunda opcao e a melhor OUTRA, mesmo pontuando acima da recomendada', () => {
  const gap = computeRecommendationGap({
    recommendedProposalId: 'c',
    scores: [score('a', 'A', 95), score('b', 'B', 70), score('c', 'C', 50)],
    proposals: [proposal('a', 7000, 30), proposal('b', 6800, 28), proposal('c', 6000, 25)],
  });
  assert.equal(gap.agentName, 'C');
  assert.equal(gap.runnerUpName, 'A', 'a de maior score entre as outras');
  assert.equal(gap.brlSaved, 1000);
  assert.equal(gap.transitDaysSaved, 5);
});

test('sem recomendada, sem frase', () => {
  assert.equal(
    computeRecommendationGap({
      recommendedProposalId: null,
      scores: [score('a', 'A', 90), score('b', 'B', 60)],
      proposals: [proposal('a', 6000, 20), proposal('b', 6800, 27)],
    }),
    null,
  );
});

test('score sem proposta correspondente na tabela -> null, nunca numero parcial', () => {
  const gap = computeRecommendationGap({
    recommendedProposalId: 'a',
    scores: [score('a', 'A', 90), score('b', 'B', 60)],
    proposals: [proposal('a', 6000, 20)],
  });
  assert.equal(gap, null);
});

test('empate de score desempata por id, para a frase nao trocar de agente entre renders', () => {
  const args = {
    recommendedProposalId: 'z',
    scores: [score('z', 'Z', 90), score('b', 'B', 70), score('a', 'A', 70)],
    proposals: [proposal('z', 6000, 20), proposal('b', 6500, 25), proposal('a', 6500, 25)],
  };
  assert.equal(computeRecommendationGap(args).runnerUpName, 'A');
});

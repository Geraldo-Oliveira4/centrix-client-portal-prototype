import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CRITERION_WEIGHTS,
  COST_EQUIVALENCE_PCT,
  TRANSIT_EQUIVALENCE_DAYS,
  FREE_TIME_EQUIVALENCE_DAYS,
  VALIDITY_EQUIVALENCE_BUSINESS_DAYS,
  RECOMMENDATION_PRICE_WINDOW_PCT,
  justification,
  recommendationView,
  relativeScore,
  scoreQuotation,
} from './recommendation-engine.ts';
import {
  addDays,
  proposalLabels,
  type ComparisonProposal,
  type ComparisonQuotation,
} from './comparison-model.ts';
import { comparisonFixtures } from './fixtures.ts';

const TODAY = '2026-10-06'; // terça-feira

function proposal(over: Partial<ComparisonProposal> & { id: string }): ComparisonProposal {
  return {
    agentId: over.id,
    agentName: over.id.toUpperCase(),
    shipmentType: 'LCL',
    incoterm: 'FOB',
    portOfLoading: 'Origem',
    portOfDischarge: 'Destino',
    route: 'direta',
    transshipment: null,
    frequency: 'semanal',
    freeTimeDays: 10,
    transitDays: 30,
    departureInDays: 0,
    carrier: null,
    validUntil: addDays(TODAY, 14),
    insuranceIncluded: false,
    insurance: null,
    originCharges: [],
    freightCharges: [{ label: 'Frete', currency: 'BRL', amount: 1000 }],
    destinationCharges: [],
    observations: null,
    documents: [],
    highAuditPending: false,
    ...over,
  };
}

function quotation(
  proposals: ComparisonProposal[],
  insuranceRequired = false,
): ComparisonQuotation {
  const [a, b] = comparisonFixtures(TODAY);
  void b;
  return {
    request: { ...a.request, insuranceRequired, ptax: { USD: 5, EUR: 6, BRL: 1 } },
    proposals,
    chosenProposalId: null,
  };
}

const freight = (amount: number) => [{ label: 'Frete', currency: 'BRL' as const, amount }];
const byId = (r: ReturnType<typeof scoreQuotation>, id: string) =>
  r.ranked.find((s) => s.proposal.id === id)!;

test('pesos somam 100', () => {
  assert.equal(
    Object.values(CRITERION_WEIGHTS).reduce((a, b) => a + b, 0),
    100,
  );
});

test('normalização relativa: melhor 100, pior 0, linear no meio', () => {
  const rule = { direction: 'lower' as const, equivalent: (v: number, b: number) => v <= b };
  assert.equal(relativeScore(100, [100, 200], rule), 100);
  assert.equal(relativeScore(200, [100, 200], rule), 0);
  assert.equal(relativeScore(150, [100, 200], rule), 50);
  // Grupo sem amplitude: todos 100.
  assert.equal(relativeScore(100, [100, 100], rule), 100);
  // Mesma proposta, grupos diferentes, notas diferentes: a régua é o grupo.
  const r1 = scoreQuotation(
    quotation([proposal({ id: 'a', freightCharges: freight(1000) }), proposal({ id: 'b', freightCharges: freight(2000) })]),
    TODAY,
  );
  const r2 = scoreQuotation(
    quotation([proposal({ id: 'a', freightCharges: freight(1000) }), proposal({ id: 'b', freightCharges: freight(1200) })]),
    TODAY,
  );
  assert.equal(byId(r1, 'b').criteria.custo, 0);
  assert.equal(byId(r2, 'b').criteria.custo, 0);
  const r3 = scoreQuotation(
    quotation([
      proposal({ id: 'a', freightCharges: freight(1000) }),
      proposal({ id: 'b', freightCharges: freight(1500) }),
      proposal({ id: 'c', freightCharges: freight(2000) }),
    ]),
    TODAY,
  );
  assert.equal(byId(r3, 'b').criteria.custo, 50);
});

test('tolerância de custo: até 2% acima do menor total conta como o melhor', () => {
  assert.equal(COST_EQUIVALENCE_PCT, 0.02);
  const r = scoreQuotation(
    quotation([
      proposal({ id: 'a', freightCharges: freight(1000) }),
      proposal({ id: 'b', freightCharges: freight(1020) }),
      proposal({ id: 'c', freightCharges: freight(1021) }),
      proposal({ id: 'd', freightCharges: freight(2000) }),
    ]),
    TODAY,
  );
  assert.equal(byId(r, 'b').criteria.custo, 100);
  assert.ok(byId(r, 'c').criteria.custo < 100);
});

test('tolerância de transit time: até 1 dia a mais conta como o melhor', () => {
  assert.equal(TRANSIT_EQUIVALENCE_DAYS, 1);
  const r = scoreQuotation(
    quotation([
      proposal({ id: 'a', transitDays: 30 }),
      proposal({ id: 'b', transitDays: 31 }),
      proposal({ id: 'c', transitDays: 32 }),
      proposal({ id: 'd', transitDays: 40 }),
    ]),
    TODAY,
  );
  assert.equal(byId(r, 'b').criteria.transit, 100);
  assert.equal(byId(r, 'c').criteria.transit, 80);
  assert.equal(byId(r, 'd').criteria.transit, 0);
});

test('tolerância de free time: até 2 dias a menos que o maior conta como o melhor', () => {
  assert.equal(FREE_TIME_EQUIVALENCE_DAYS, 2);
  const r = scoreQuotation(
    quotation([
      proposal({ id: 'a', freeTimeDays: 14 }),
      proposal({ id: 'b', freeTimeDays: 12 }),
      proposal({ id: 'c', freeTimeDays: 11 }),
      proposal({ id: 'd', freeTimeDays: 7 }),
    ]),
    TODAY,
  );
  assert.equal(byId(r, 'b').criteria.freeTime, 100);
  assert.ok(byId(r, 'c').criteria.freeTime < 100);
  assert.equal(byId(r, 'd').criteria.freeTime, 0);
});

test('tolerância de validade: até 2 dias úteis a menos que a maior conta como a melhor', () => {
  assert.equal(VALIDITY_EQUIVALENCE_BUSINESS_DAYS, 2);
  // Hoje terça 06/10. Dias úteis: até 16/10 (sex) = 8; 14/10 (qua) = 6; 13/10 (ter) = 5; 07/10 = 1.
  const r = scoreQuotation(
    quotation([
      proposal({ id: 'a', validUntil: '2026-10-16' }),
      proposal({ id: 'b', validUntil: '2026-10-14' }),
      proposal({ id: 'c', validUntil: '2026-10-13' }),
      proposal({ id: 'd', validUntil: '2026-10-07' }),
    ]),
    TODAY,
  );
  assert.equal(byId(r, 'b').criteria.validade, 100);
  assert.ok(byId(r, 'c').criteria.validade < 100);
  assert.equal(byId(r, 'd').criteria.validade, 0);
});

test('free time ausente conta como 0 dia e passa pela equivalência (não vira 0 automático)', () => {
  // Grupo: 0 (ausente), 1, 10. Ausente = 0 dias; 0 está a 10 do melhor, logo 0.
  const r1 = scoreQuotation(
    quotation([
      proposal({ id: 'a', freeTimeDays: null }),
      proposal({ id: 'b', freeTimeDays: 1 }),
      proposal({ id: 'c', freeTimeDays: 10 }),
    ]),
    TODAY,
  );
  assert.equal(byId(r1, 'a').criteria.freeTime, 0);
  // Grupo: ausente (0) e 2 dias. 0 >= 2 - 2: equivalente ao melhor.
  const r2 = scoreQuotation(
    quotation([
      proposal({ id: 'a', freeTimeDays: null }),
      proposal({ id: 'b', freeTimeDays: 2 }),
    ]),
    TODAY,
  );
  assert.equal(byId(r2, 'a').criteria.freeTime, 100);
  // Ausente (0) entre 4 e 10: normaliza contra a régua [0..10], não é zerado à força.
  const r3 = scoreQuotation(
    quotation([
      proposal({ id: 'a', freeTimeDays: 4 }),
      proposal({ id: 'b', freeTimeDays: null }),
      proposal({ id: 'c', freeTimeDays: 10 }),
    ]),
    TODAY,
  );
  assert.equal(byId(r3, 'a').criteria.freeTime, 40);
});

test('critério ausente em TODAS as propostas é empate: 100 para todas', () => {
  const r = scoreQuotation(
    quotation([
      proposal({ id: 'a', freeTimeDays: null, frequency: null, route: null, transitDays: null }),
      proposal({ id: 'b', freeTimeDays: null, frequency: null, route: null, transitDays: null }),
    ]),
    TODAY,
  );
  for (const s of r.ranked) {
    assert.equal(s.criteria.freeTime, 100);
    assert.equal(s.criteria.frequencia, 100);
    assert.equal(s.criteria.rota, 100);
    assert.equal(s.criteria.transit, 100);
  }
});

test('rota e frequência: tabelas fixas, sem informação = 0', () => {
  const r = scoreQuotation(
    quotation([
      proposal({ id: 'a', route: 'direta', frequency: 'diaria' }),
      proposal({ id: 'b', route: 'transbordo', frequency: 'quinzenal' }),
      proposal({ id: 'c', route: null, frequency: null }),
      proposal({ id: 'd', route: 'direta', frequency: 'mensal' }),
    ]),
    TODAY,
  );
  assert.deepEqual(
    ['a', 'b', 'c', 'd'].map((id) => [byId(r, id).criteria.rota, byId(r, id).criteria.frequencia]),
    [[100, 100], [40, 50], [0, 0], [100, 25]],
  );
});

test('elegibilidade: vencida, seguro exigido sem seguro e auditoria alta ficam de fora', () => {
  const props = [
    proposal({ id: 'ok', insuranceIncluded: true }),
    proposal({ id: 'vencida', validUntil: addDays(TODAY, -1), insuranceIncluded: true }),
    proposal({ id: 'hoje', validUntil: TODAY, insuranceIncluded: true }),
    proposal({ id: 'sem-seguro', insuranceIncluded: false }),
    proposal({ id: 'auditoria', insuranceIncluded: true, highAuditPending: true }),
  ];
  const r = scoreQuotation(quotation(props, true), TODAY);
  assert.deepEqual(byId(r, 'vencida').reasons, ['Proposta vencida']);
  assert.deepEqual(byId(r, 'hoje').reasons, []);
  assert.deepEqual(byId(r, 'sem-seguro').reasons, ['Seguro exigido não incluído']);
  assert.deepEqual(byId(r, 'auditoria').reasons, ['Pendência de auditoria alta ou crítica']);
  assert.notEqual(r.recommended?.proposal.id, 'sem-seguro');
  // Sem seguro exigido, a mesma proposta sem seguro é elegível.
  const free = scoreQuotation(quotation(props, false), TODAY);
  assert.deepEqual(byId(free, 'sem-seguro').reasons, []);
});

test('excluída mais barata nunca é recomendada nem define a régua', () => {
  const r = scoreQuotation(
    quotation(
      [
        proposal({ id: 'barata-sem-seguro', freightCharges: freight(500) }),
        proposal({ id: 'a', freightCharges: freight(1000), insuranceIncluded: true }),
        proposal({ id: 'b', freightCharges: freight(2000), insuranceIncluded: true }),
      ],
      true,
    ),
    TODAY,
  );
  assert.equal(r.recommended?.proposal.id, 'a');
  assert.equal(r.cheapestEligibleBrl, 1000);
  assert.equal(byId(r, 'a').criteria.custo, 100);
});

test('janela de 10% e prioridade da rota direta', () => {
  assert.equal(RECOMMENDATION_PRICE_WINDOW_PCT, 0.1);
  // Transbordo mais barato e de nota maior; direta 8% acima: a direta ganha.
  const r = scoreQuotation(
    quotation([
      proposal({ id: 'transbordo', route: 'transbordo', freightCharges: freight(1000), transitDays: 20 }),
      proposal({ id: 'direta', route: 'direta', freightCharges: freight(1080), transitDays: 40 }),
    ]),
    TODAY,
  );
  assert.equal(r.recommended?.proposal.id, 'direta');
  // Direta fora da janela (11% acima): volta para a transbordo.
  const r2 = scoreQuotation(
    quotation([
      proposal({ id: 'transbordo', route: 'transbordo', freightCharges: freight(1000) }),
      proposal({ id: 'direta', route: 'direta', freightCharges: freight(1110) }),
    ]),
    TODAY,
  );
  assert.equal(r2.recommended?.proposal.id, 'transbordo');
  // Exatamente 10% acima ainda entra.
  const r3 = scoreQuotation(
    quotation([
      proposal({ id: 'transbordo', route: 'transbordo', freightCharges: freight(1000) }),
      proposal({ id: 'direta', route: 'direta', freightCharges: freight(1100) }),
    ]),
    TODAY,
  );
  assert.equal(r3.recommended?.proposal.id, 'direta');
});

test('entre diretas da janela, ganha a maior nota (não a mais barata)', () => {
  const r = scoreQuotation(
    quotation([
      proposal({ id: 'a', freightCharges: freight(1000), transitDays: 40 }),
      proposal({ id: 'b', freightCharges: freight(1015), transitDays: 20 }),
    ]),
    TODAY,
  );
  assert.ok(byId(r, 'b').score > byId(r, 'a').score);
  assert.equal(r.recommended?.proposal.id, 'b');
});

// O dia da semana muda a contagem de dias úteis; o invariante da fixture B tem
// de valer em qualquer um deles.
const WEEK = Array.from({ length: 7 }, (_, i) => addDays(TODAY, i));

test('COT-DEMO-B: recomendada != maior nota, em qualquer dia da semana', () => {
  for (const day of WEEK) {
    const [, b] = comparisonFixtures(day);
    const r = scoreQuotation(b, day);
    assert.equal(r.recommended?.proposal.id, 'b-beta', day);
    assert.equal(r.highestScore?.proposal.id, 'b-delta', day);
    assert.ok(r.highestScore!.score > r.recommended!.score, day);
    assert.ok((byId(r, 'b-delta').aboveCheapestPct ?? 0) > 0.1, day);
    assert.deepEqual(byId(r, 'b-gamma').reasons, ['Seguro exigido não incluído']);
    // A excluída é a mais barata de todas: o motor a ignora de propósito.
    const all = r.ranked.map((s) => s.totalBrl as number);
    assert.equal(byId(r, 'b-gamma').totalBrl, Math.min(...all));
    assert.equal(b.chosenProposalId, 'b-delta');
  }
});

test('COT-DEMO-A: vencida excluída, recomendada é direta dentro da janela', () => {
  for (const day of WEEK) {
    const [a] = comparisonFixtures(day);
    const r = scoreQuotation(a, day);
    assert.deepEqual(byId(r, 'a-delta').reasons, ['Proposta vencida']);
    assert.equal(r.recommended?.proposal.route, 'direta', day);
    assert.ok(r.recommended!.inPriceWindow);
    assert.equal(r.recommended?.proposal.id, 'a-alpha-1', day);
  }
});

test('justificativa sai dos dados e cita a maior nota fora da janela', () => {
  const [, b] = comparisonFixtures(TODAY);
  const r = scoreQuotation(b, TODAY);
  const text = justification(r, proposalLabels(b.proposals));
  assert.match(text, /^Beta Cargo é a proposta elegível mais barata, com rota direta\./);
  assert.match(text, /Contra Delta Shipping, custa R\$\s?[\d.]+,\d{2} a menos/);
  assert.match(text, /leva 20 dias a mais no trânsito/);
  assert.match(text, /Delta Shipping tem a nota mais alta \(\d+ contra \d+\), mas custa \d+% acima da mais barata elegível, fora da janela de 10%\./);
  // Muda o dado, muda o texto: nada chumbado.
  const cheaper = structuredClone(b);
  cheaper.proposals.find((p) => p.id === 'b-delta')!.transitDays = 30;
  const text2 = justification(scoreQuotation(cheaper, TODAY), proposalLabels(b.proposals));
  assert.match(text2, /leva 14 dias a mais no trânsito/);
});

test('portão: antes da aprovação do analista não sai nota nem dica', () => {
  const [, b] = comparisonFixtures(TODAY);
  const labels = proposalLabels(b.proposals);
  const before = recommendationView(b, TODAY, false, labels);
  assert.deepEqual(before, { state: 'em_revisao' });
  assert.ok(!JSON.stringify(before).includes('score'));
  const after = recommendationView(b, TODAY, true, labels);
  assert.equal(after.state, 'disponivel');
  if (after.state === 'disponivel') {
    assert.equal(after.recommended.proposal.id, 'b-beta');
    assert.ok(after.recommended.score >= 0 && after.recommended.score <= 100);
    assert.ok(after.justification.length > 0);
  }
});

test('sem nenhuma elegível não há recomendada', () => {
  const r = recommendationView(
    quotation([proposal({ id: 'a', validUntil: addDays(TODAY, -2) })]),
    TODAY,
    true,
    {},
  );
  assert.equal(r.state, 'sem_recomendacao');
});

test('chave do analista: padrão desligado, só `true` liga', async () => {
  const { parseAnalystApproval } = await import('./analyst-approval.ts');
  assert.equal(parseAnalystApproval(null), false);
  assert.equal(parseAnalystApproval('true'), true);
  assert.equal(parseAnalystApproval('"true"'), false);
  assert.equal(parseAnalystApproval('{corrompido'), false);
});

// Unit test dos cenarios de demonstracao. Mesmo runner dos outros libs:
//
//     npm run test:unit
//
// O QUE ERRA EM SILENCIO AQUI:
//
//   1. Duas etapas na MESMA cotacao. O Kanban mostraria um cartao so, e a
//      demonstracao perderia justamente a variedade que este botao existe para
//      produzir.
//   2. `released` cair numa cotacao sem proposta. A comparacao abriria vazia
//      com a faixa dizendo que a Freitas liberou propostas.
//   3. O historico do cenario nao bater com a etapa: um cartao "Devolvida" sem
//      o evento de devolucao nao teria motivo para mostrar.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SCENARIO_ORDER,
  SCENARIO_RETURN_REASON,
  buildDemoScenarios,
  buildScenario,
  buildScenarioStore,
  type ScenarioQuotation,
} from './quotation-v2-scenarios.ts';
import {
  V2_CLIENT_ACTION_STAGES,
  countV2ClientActions,
  mergeQuotationV2,
  type V2Stage,
} from './quotation-review.ts';

const NOW = Date.parse('2026-09-24T18:00:00.000Z');

const quotation = (
  id: string,
  proposals: { id: string; total_brl?: number | null }[] = [],
): ScenarioQuotation => ({ id, reference: `COT-2026-${id}`, proposals });

const NINE: ScenarioQuotation[] = [
  quotation('0001'),
  quotation('0002', [
    { id: 'p1', total_brl: 6490 },
    { id: 'p2', total_brl: 7120 },
  ]),
  quotation('0003', [{ id: 'p3', total_brl: 5000 }]),
  quotation('0004'),
  quotation('0005'),
  quotation('0006'),
  quotation('0007'),
  quotation('0008'),
  quotation('0009'),
];

test('as seis etapas entram, uma por cotacao', () => {
  const store = buildScenarioStore(NINE, NOW);
  assert.equal(Object.keys(store).length, 6);
  assert.deepEqual(
    Object.values(store)
      .map((r) => r.stage)
      .sort(),
    [...SCENARIO_ORDER].sort(),
  );
});

test('nenhuma cotacao recebe duas etapas', () => {
  const store = buildScenarioStore(NINE, NOW);
  assert.equal(new Set(Object.keys(store)).size, Object.keys(store).length);
});

test('"liberada" cai na cotacao com MAIS propostas com preco', () => {
  const store = buildScenarioStore(NINE, NOW);
  const releasedId = Object.entries(store).find(
    ([, r]) => r.stage === 'released',
  )?.[0];
  assert.equal(releasedId, '0002');
  assert.deepEqual(store['0002'].releasedProposalIds, ['p1', 'p2']);
});

test('proposta sem preco nao e liberada', () => {
  const store = buildScenarioStore(
    [quotation('a', [{ id: 'p1', total_brl: 100 }, { id: 'p2', total_brl: 0 }])],
    NOW,
  );
  assert.deepEqual(store.a.releasedProposalIds, ['p1']);
});

test('a devolvida traz o motivo, e o cartao tem o que mostrar', () => {
  const store = buildScenarioStore(NINE, NOW);
  const returned = Object.values(store).find((r) => r.stage === 'returned');
  assert.equal(returned?.returnReason, SCENARIO_RETURN_REASON);
  assert.equal(returned?.history.at(-1)?.kind, 'returned');
});

test('cada cenario chega com um historico coerente com a etapa', () => {
  const expected: Record<V2Stage, string[]> = {
    draft: [],
    entry_review: ['submitted'],
    returned: ['submitted', 'returned'],
    awaiting_quotes: ['submitted', 'entry_approved'],
    exit_review: ['submitted', 'entry_approved', 'quotes_arrived'],
    released: [
      'submitted',
      'entry_approved',
      'quotes_arrived',
      'proposals_released',
    ],
  };
  for (const stage of SCENARIO_ORDER) {
    const review = buildScenario(stage, ['p1'], NOW);
    assert.equal(review.stage, stage);
    assert.deepEqual(
      review.history.map((e) => e.kind),
      expected[stage],
      stage,
    );
  }
});

test('o historico do cenario anda para a frente no tempo', () => {
  const review = buildScenario('released', ['p1'], NOW);
  const times = review.history.map((e) => Date.parse(e.at));
  for (let i = 1; i < times.length; i += 1) {
    assert.ok(times[i] > times[i - 1], 'os eventos precisam ser crescentes');
  }
  assert.ok(times.at(-1)! <= NOW, 'nenhum evento no futuro');
});

test('"liberada" sem proposta nenhuma PARA na revisao de saida', () => {
  const review = buildScenario('released', [], NOW);
  assert.equal(review.stage, 'exit_review');
  assert.equal(review.releasedProposalIds, undefined);
});

test('menos de seis cotacoes: entram as primeiras etapas da ordem', () => {
  const store = buildScenarioStore(NINE.slice(0, 3), NOW);
  assert.equal(Object.keys(store).length, 3);
  assert.deepEqual(
    Object.values(store)
      .map((r) => r.stage)
      .sort(),
    [...SCENARIO_ORDER.slice(0, 3)].sort(),
  );
});

test('sem cotacao nenhuma, o botao nao produz nada', () => {
  assert.deepEqual(buildScenarioStore([], NOW), {});
  assert.deepEqual(buildDemoScenarios(undefined, NOW), {});
  assert.deepEqual(buildDemoScenarios({ buckets: {} }, NOW), {});
});

test('buildDemoScenarios le os baldes da resposta do portal', () => {
  const store = buildDemoScenarios(
    {
      buckets: {
        aguardando_dados: [quotation('0001')],
        aguardando_aprovacao: [
          quotation('0002', [{ id: 'p1', total_brl: 100 }]),
        ],
      },
    },
    NOW,
  );
  assert.equal(Object.keys(store).length, 2);
  assert.equal(store['0002'].stage, 'released');
});

test('os cenarios deixam o contador em 3: rascunho, devolvida e liberada', () => {
  const store = buildScenarioStore(NINE, NOW);
  assert.equal(countV2ClientActions(store), V2_CLIENT_ACTION_STAGES.length);
});

test('o cenario liberado passa pelo merge com as duas propostas visiveis', () => {
  const store = buildScenarioStore(NINE, NOW);
  const merged = mergeQuotationV2(
    { id: '0002', proposals: [{ id: 'p1' }, { id: 'p2' }] },
    store['0002'],
  );
  assert.deepEqual(
    merged.visibleProposals.map((p) => p.id),
    ['p1', 'p2'],
  );
  assert.equal(merged.column, 'aguardando_aprovacao');
});

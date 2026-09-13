import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createQuote,
  recommend,
  decisionError,
  confirmChoice,
  validateCargo,
  dayDelta,
  money,
} from './model.ts';

test('indicação atende o prazo com escopo completo; preço parcial não é menor total', () => {
  const q = createQuote('comparar');
  assert.equal(recommend(q)?.id, 'beta');
  assert.equal(q.selected, null);
  assert.match(decisionError(q, 'gamma')!, /taxas de destino/);
  assert.equal(q.offers[2].total < q.offers[0].total, true);
});
test('recomendação independe da escolha do cliente', () => {
  const q = createQuote('comparar');
  q.selected = 'alpha';
  assert.equal(recommend(q)?.id, 'beta');
  assert.equal(decisionError(q, 'alpha'), null);
});
test('ofertas vencidas ou sem validade não são indicadas ou aprovadas', () => {
  for (const scenario of ['vencidas', 'sem-dados']) {
    const q = createQuote(scenario);
    assert.equal(recommend(q), undefined);
    assert.ok(decisionError(q, 'beta'));
    assert.throws(() => confirmChoice(q, 'beta'));
  }
});
test('comparação sem necessidade não inventa melhor equilíbrio', () => {
  const q = createQuote('comparar');
  q.needDate = '';
  assert.equal(recommend(q), undefined);
});
test('resposta parcial não permite contratar', () => {
  const q = createQuote('parciais');
  assert.match(decisionError(q, 'alpha')!, /liberada/);
  assert.throws(() => confirmChoice(q, 'alpha'));
});
test('confirmar escolha leva à revisão, mantém condições e preserva o registro anterior', () => {
  const q = createQuote('comparar');
  const result = confirmChoice(q, 'beta');
  assert.equal(q.stage, 'ready');
  assert.equal(result.stage, 'review');
  assert.equal(result.selected, 'beta');
  assert.equal(result.offers[1].total, 23400);
  assert.equal(result.events.length, q.events.length + 1);
  assert.ok(decisionError(result, 'alpha'));
});
test('a data de chegada é fonte da oferta; trânsito não é somado a hoje', () => {
  const q = createQuote('comparar');
  assert.equal(q.offers[1].arrival, '2026-10-16');
  assert.equal(dayDelta(q.offers[1].arrival!, q.needDate), -2);
  assert.equal(dayDelta(q.offers[0].arrival!, q.needDate), 2);
});
test('proposta sem ETA não é recomendada', () => {
  const q = createQuote('comparar');
  q.offers.forEach((o) => (o.arrival = null));
  assert.equal(recommend(q), undefined);
});
test('composição de custo fecha nos totais informados', () => {
  const q = createQuote('comparar');
  for (const offer of q.offers) {
    assert.equal(
      offer.charges.reduce((sum, c) => sum + (c.amount ?? 0), 0),
      offer.total,
    );
  }
  assert.equal(q.offers[2].complete, false);
});
test('preparo não é envio e lista de destinatários é explícita', () => {
  const q = createQuote('rascunho');
  assert.equal(q.sentAt, null);
  assert.equal(q.stage, 'draft');
  assert.deepEqual(q.targetAgents, [
    'Alpha Cargo',
    'Beta Logistics',
    'Gamma Comex',
  ]);
  assert.equal(q.offers.length, 0);
});
test('peso e volume aceitam decimais e recusam zero, negativos, expoentes e texto', () => {
  for (const pair of [
    ['12400', '52'],
    ['12,5', '0.9'],
  ])
    assert.equal(validateCargo(...pair), true);
  for (const value of ['', '0', '-5', 'abc', 'Infinity', '1e3', '12.400,50'])
    assert.equal(validateCargo(value, '52'), false);
});
test('revisão, liberação e fechamento permanecem estados distintos', () => {
  assert.equal(createQuote('analise').stage, 'review');
  assert.equal(createQuote('liberada').stage, 'released');
  assert.equal(createQuote('fechada').stage, 'closed');
  assert.equal(createQuote('devolvida').selected, null);
});

test('oferta única pode ser revisada, mas não produz ranking ou recomendação', () => {
  const q = createQuote('comparar');
  q.offers = [q.offers[1]];
  assert.equal(recommend(q), undefined);
  assert.equal(decisionError(q, 'beta'), null);
});

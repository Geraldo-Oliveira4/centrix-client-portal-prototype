// Unit test dos cenarios de demonstracao da jornada por PO. Mesmo runner.
//
// O QUE ERRA EM SILENCIO AQUI:
//
//   1. Nenhum cenario ATIVO SEM COTACAO — a Tela 9 (vincular cotacao) ficaria
//      inalcancavel sem esperar uma validacao inteira.
//   2. Referencia colidindo com o seed (EMB-2026-0001..0013).
//   3. Historico incoerente com a etapa: um cartao "Devolvido" sem o evento de
//      devolucao nao tem motivo para mostrar.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PO_SCENARIO_ORDER,
  PO_SCENARIO_RETURN_FIELDS,
  PO_SCENARIO_RETURN_REASON,
  buildPoScenarioStore,
} from './shipment-po-scenarios.ts';
import {
  countPoInReview,
  isPoDraft,
  type PoStage,
} from './shipment-po-review.ts';
import { mergePoShipments } from './shipment-po-merge.ts';

const NOW = Date.parse('2026-09-24T18:00:00.000Z');

test('os quatro estados entram, um por embarque', () => {
  const store = buildPoScenarioStore([], NOW);
  assert.equal(Object.keys(store).length, 4);
  assert.deepEqual(
    Object.values(store)
      .map((e) => e.stage)
      .sort(),
    [...PO_SCENARIO_ORDER].sort(),
  );
});

test('ha um ATIVO SEM COTACAO — e o que abre a Tela 9', () => {
  const active = Object.values(buildPoScenarioStore([], NOW)).filter(
    (e) => e.stage === 'active',
  );
  assert.equal(active.length, 1);
  assert.equal(active[0].linkedQuotationId, undefined);
});

test('o devolvido traz motivo e DOIS campos a corrigir', () => {
  const returned = Object.values(buildPoScenarioStore([], NOW)).find(
    (e) => e.stage === 'returned',
  );
  assert.equal(returned?.returnReason, PO_SCENARIO_RETURN_REASON);
  assert.deepEqual(returned?.fieldsToFix, PO_SCENARIO_RETURN_FIELDS);
  assert.equal(returned?.fieldsToFix.length, 2);
  assert.equal(returned?.history.at(-1)?.kind, 'returned');
});

test('nenhuma referencia colide com o seed nem entre si', () => {
  const refs = Object.values(buildPoScenarioStore([], NOW)).map(
    (e) => e.reference,
  );
  assert.equal(new Set(refs).size, 4);
  for (const reference of refs) {
    const n = Number(/^EMB-2026-(\d{4})$/.exec(reference)![1]);
    assert.ok(n >= 101, `${reference} invade a faixa do seed`);
  }
});

test('referencias ja usadas no backend sao respeitadas', () => {
  const refs = Object.values(
    buildPoScenarioStore(['EMB-2026-0101', 'EMB-2026-0102'], NOW),
  ).map((e) => e.reference);
  assert.equal(refs.includes('EMB-2026-0101'), false);
  assert.equal(refs.includes('EMB-2026-0102'), false);
});

test('cada cenario tem historico coerente com a etapa', () => {
  const expected: Record<PoStage, string[]> = {
    draft: ['created', 'saved'],
    awaiting_review: ['created', 'saved', 'submitted'],
    returned: ['created', 'saved', 'submitted', 'returned'],
    active: ['created', 'saved', 'submitted', 'validated'],
  };
  for (const entry of Object.values(buildPoScenarioStore([], NOW))) {
    assert.deepEqual(
      entry.history.map((e) => e.kind),
      expected[entry.stage],
      entry.stage,
    );
  }
});

test('o historico anda para a frente e nao chega ao futuro', () => {
  for (const entry of Object.values(buildPoScenarioStore([], NOW))) {
    const times = entry.history.map((e) => Date.parse(e.at));
    for (let i = 1; i < times.length; i += 1) {
      assert.ok(times[i] > times[i - 1], entry.stage);
    }
    assert.ok(times.at(-1)! <= NOW, entry.stage);
  }
});

test('o cenario manual nao tem anexo nem confianca por campo', () => {
  const manual = Object.values(buildPoScenarioStore([], NOW)).find(
    (e) => e.origin === 'manual',
  );
  assert.ok(manual, 'falta um cenario manual');
  assert.equal(manual!.attachmentName, null);
  assert.deepEqual(manual!.confidence, {});
});

test('os vindos de PO guardam o anexo e a confianca da leitura', () => {
  for (const entry of Object.values(buildPoScenarioStore([], NOW))) {
    if (entry.origin !== 'po') continue;
    assert.ok(entry.attachmentName?.endsWith('.pdf'), entry.reference);
    assert.equal(Object.keys(entry.confidence).length, 10, entry.reference);
  }
});

test('os cenarios deixam "Em analise" em 2, e o rascunho fora da carteira', () => {
  const store = buildPoScenarioStore([], NOW);
  assert.equal(countPoInReview(store), 2);
  const merged = mergePoShipments([], store);
  assert.equal(merged.length, 3, 'o rascunho nao entra na carteira');
  assert.equal(
    Object.values(store).filter(isPoDraft).length,
    1,
  );
});

test('todo cenario tem PO e REF preenchidos — o cartao tem o que mostrar', () => {
  for (const entry of Object.values(buildPoScenarioStore([], NOW))) {
    assert.ok(entry.data.poNumbers.length > 0, entry.reference);
    assert.ok(entry.data.clientRef.length > 0, entry.reference);
    assert.ok(entry.data.exporter.length > 0, entry.reference);
    assert.ok(entry.data.items.length > 0, entry.reference);
  }
});

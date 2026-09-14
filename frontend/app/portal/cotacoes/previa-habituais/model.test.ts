import test from 'node:test';
import assert from 'node:assert/strict';
import {
  reusableDraft,
  startRequest,
  habitFromRequest,
  initialHabits,
  routes,
} from './model.ts';

test('new remittance retains stable context but never carries transaction data', () => {
  const source = structuredClone(initialHabits[0]);
  Object.assign(source.draft.values, {
    data_prontidao: '2026-01-01',
    desired_deadline: '2026-01-02',
    client_reference: 'OLD-PO',
    declared_value: '1234',
    ptax_negociada: '5.1',
    observations: 'Previous invoice',
    data_limite_necessidade: '2026-02-01',
  });
  source.draft.equipments = [
    {
      quantity: 2,
      tipo_container: 'HIGH_CUBE_40',
      peso_bruto: 24000,
      volume_m3: 104,
    },
  ];
  const q = startRequest(source);
  assert.equal(q.supplier, source.supplier);
  assert.equal(q.manualDraft?.values.porto_embarque, routes[0].origin);
  assert.equal(q.manualDraft?.values.incoterm, 'FOB');
  for (const key of [
    'client_reference',
    'data_prontidao',
    'data_limite_necessidade',
    'declared_value',
    'ptax_negociada',
    'observations',
    'desired_deadline',
  ])
    assert.equal(q.manualDraft?.values[key], '');
  assert.deepEqual(q.manualDraft?.equipments, []);
  assert.deepEqual(q.offers, []);
  assert.deepEqual(q.targetAgents, []);
  assert.equal(q.sentAt, null);
  assert.equal(q.selected, null);
  assert.equal(q.scheduledFor, null);
  assert.equal(source.draft.equipments.length, 1);
});
test('route-only request does not invent a supplier, cargo or incoterm', () => {
  const q = startRequest(null, 'busan-santos');
  assert.equal(q.supplier, '');
  assert.equal(q.product, '');
  assert.equal(q.incoterm, '');
  assert.equal(q.manualDraft?.values.porto_embarque, routes[0].origin);
});
test('using the same route preserves the chosen supplier and cargo', () => {
  const a = startRequest(initialHabits[0]),
    b = startRequest(initialHabits[2]);
  assert.equal(a.origin, b.origin);
  assert.notEqual(a.supplier, b.supplier);
  assert.notEqual(a.product, b.product);
});
test('occurrence edits do not mutate a saved model', () => {
  const q = startRequest(initialHabits[0]);
  q.manualDraft!.values.porto_destino!.push('Another port');
  assert.equal(initialHabits[0].draft.values.porto_destino!.length, 1);
});
test('saving a habit removes volatile fields, validates context and creates a separate model', () => {
  const q = startRequest(initialHabits[0]);
  q.manualDraft!.values.client_reference = 'NEW-PO';
  const h = habitFromRequest(q, 'Another name', 'new-id');
  assert.equal(h.id, 'new-id');
  assert.equal(h.draft.values.client_reference, undefined);
  assert.equal(h.routeId, 'busan-santos');
  assert.throws(() => habitFromRequest(q, '', 'id'));
  assert.throws(() => habitFromRequest({ ...q, supplier: '' }, 'Name', 'id'));
});
test('reusable draft preserves conditional flags without sharing mutable state', () => {
  const source = structuredClone(initialHabits[0].draft);
  source.flags = { agenteDefineLocalColeta: true };
  const next = reusableDraft(source);
  next.flags!.agenteDefineLocalColeta = false;
  assert.equal(source.flags.agenteDefineLocalColeta, true);
});

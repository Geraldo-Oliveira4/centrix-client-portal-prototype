import test from 'node:test';
import assert from 'node:assert/strict';
import {
  editableQuotation,
  mergeInvitations,
  usesPreparationDetail,
} from './preparation-model.ts';

test('editing keeps PO, dates and cargo dimensions instead of starting another remittance', () => {
  const source = {
    id: 'q1',
    reference: 'COT-1',
    state: 'AGUARDANDO_DADOS',
    client_reference: 'PO-123',
    product: 'Peças',
    origin: 'Valencia',
    porto_destino: ['Santos'],
    modal: 'MARITIMO',
    tipo_embarque: 'FCL',
    incoterm: 'FOB',
    declared_value: 1200,
    data_prontidao: '2026-09-20',
    data_limite_necessidade: '2026-10-20',
    equipments: [
      {
        quantity: 2,
        tipo_container: 'HIGH_CUBE_40',
        volume_m3: 40,
        peso_bruto: 1000,
      },
    ],
    totals: { weight_kg: 1000, volume_m3: 40 },
  };
  const edited = editableQuotation(source);
  assert.equal(edited.id, 'q1');
  assert.equal(edited.po, 'PO-123');
  assert.equal(edited.manualDraft.values.data_prontidao, '2026-09-20');
  assert.equal(edited.manualDraft.values.declared_value, '1200');
  assert.equal(edited.manualDraft.equipments[0].quantity, 2);
  edited.manualDraft.values.porto_destino.push('Outro');
  assert.deepEqual(source.porto_destino, ['Santos']);
});
test('early states open their dedicated workspace without taking over comparisons or history', () => {
  for (const state of [
    'AGUARDANDO_DADOS',
    'TRIAGEM_IA',
    'COTANDO',
    'PARA_ANALISE',
  ])
    assert.ok(usesPreparationDetail(state));
  for (const state of [
    'ENVIADA_CLIENTE',
    'APROVADA_PELO_CLIENTE',
    'FECHADA',
    'CANCELADO',
  ])
    assert.equal(usesPreparationDetail(state), false);
});
test('additional invitations preserve previous recipients and never duplicate them', () => {
  const existing = ['alpha', 'beta'];
  assert.deepEqual(mergeInvitations(existing, ['beta', 'gamma']), [
    'alpha',
    'beta',
    'gamma',
  ]);
  assert.deepEqual(existing, ['alpha', 'beta']);
});

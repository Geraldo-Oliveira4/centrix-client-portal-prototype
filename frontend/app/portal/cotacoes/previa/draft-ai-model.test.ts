import test from 'node:test';
import assert from 'node:assert/strict';
import { applySuggestions, simulateSuggestions } from './draft-ai-model.ts';

test('demonstration only recognizes labelled fields and valid Incoterms', () => {
  assert.deepEqual(simulateSuggestions('Acho que vai chegar amanhã.\nIncoterm: errado'), []);
  assert.deepEqual(simulateSuggestions('Mercadoria: Peças\nIncoterm: fob'), [{ field: 'product', value: 'Peças' }, { field: 'incoterm', value: 'FOB' }]);
});
test('applying suggestions preserves unselected fields and unsaved cargo edits', () => {
  const draft = { values: { product: 'Produto atual', client_reference: 'PO-EDITADA', observations: 'Nota ainda não salva' }, equipments: [{ quantity: 2, tipo_container: 'HIGH_CUBE_40' }], volumes: [], flags: { agenteDefinePortoDestino: true } };
  const result = applySuggestions(draft, 'Fornecedor atual', [{ field: 'supplier', value: 'Outro' }, { field: 'product', value: 'Novo' }], ['product']);
  assert.equal(result.supplier, 'Fornecedor atual');
  assert.equal(result.draft.values.product, 'Novo');
  assert.equal(result.draft.values.client_reference, 'PO-EDITADA');
  assert.equal(result.draft.values.observations, 'Nota ainda não salva');
  assert.deepEqual(result.draft.equipments, draft.equipments);
  assert.deepEqual(result.draft.flags, draft.flags);
  assert.equal(draft.values.product, 'Produto atual');
});
test('nothing changes without explicit selection', () => {
  const draft = { values: { product: 'Original' }, equipments: [], volumes: [] };
  assert.deepEqual(applySuggestions(draft, '', [{ field: 'product', value: 'Novo' }], []).draft, draft);
});

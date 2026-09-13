import test from 'node:test';
import assert from 'node:assert/strict';
import { cardPresentation } from './card-presentation.ts';

const offer = {
  total_brl: 9230,
  validity: '2026-09-20',
  is_recommended: true,
  agent: { name: 'Agente de cargas' },
};
const quote = (patch = {}) => ({
  reference: 'COT-TESTE',
  state: 'ENVIADA_CLIENTE',
  product: 'Motores',
  proposals_count: 2,
  best_proposal: offer,
  ...patch,
});
const view = (patch = {}) => cardPresentation(quote(patch), '2026-09-13');

test('partial responses do not present price or recommendation as an available decision', () => {
  const card = view({ state: 'COTANDO', proposals_count: 1 });
  assert.equal(card.status, '1 proposta recebida');
  assert.equal(card.best, undefined);
  assert.equal(card.showPrice, false);
  assert.equal(card.recommended, false);
});
test('missing information takes precedence even when an old offer remains in payload', () => {
  const card = view({ state: 'AGUARDANDO_DADOS' });
  assert.equal(card.needsInfo, true);
  assert.equal(card.showPrice, false);
  assert.equal(card.status, 'Complete as informações solicitadas');
});
test('only a released, explicitly recommended, valid offer gets the recommendation label', () => {
  assert.equal(view().recommended, true);
  assert.equal(
    view({
      best_proposal: { ...offer, is_recommended: null, score: { total: 90 } },
    }).recommended,
    false,
  );
  assert.equal(
    view({ best_proposal: { ...offer, validity: '2026-09-12' } }).recommended,
    false,
  );
});
test('cargo need is not used as proposal validity', () => {
  const card = view({
    data_limite_necessidade: '2026-10-20',
    best_proposal: { ...offer, validity: null },
  });
  assert.equal(card.issue, 'Validade a confirmar');
  assert.equal(card.recommended, false);
});
test('supplier is the goods exporter; never inferred from the freight agent', () => {
  assert.equal(
    view({ exporter_name: 'Fornecedor da carga' }).title,
    'Fornecedor da carga',
  );
  assert.equal(view().title, 'Motores');
  assert.equal(view().supplier, null);
  assert.equal(view({ product: null }).title, 'COT-TESTE');
});
test('a submitted choice stays review/released, without soliciting a second decision', () => {
  assert.equal(
    view({ state: 'APROVADA_PELO_CLIENTE', guard_rail_active: true }).status,
    'Sua escolha está em análise',
  );
  const released = view({
    state: 'APROVADA_PELO_CLIENTE',
    guard_rail_active: false,
  });
  assert.equal(released.status, 'Sua escolha foi liberada');
  assert.equal(released.deciding, false);
  assert.equal(released.showPrice, false);
});
test('zero/missing price remains absent rather than displayed as a free offer', () => {
  for (const total_brl of [null, 0, undefined])
    assert.equal(
      view({ best_proposal: { ...offer, total_brl } }).showPrice,
      false,
    );
});

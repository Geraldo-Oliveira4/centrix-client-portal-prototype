import test from 'node:test';
import assert from 'node:assert/strict';
import { isApprovedQuotation, openingStage } from './approved-model.ts';

test('approved workspace includes client approvals and closures, never refusals or pending offers', () => {
  assert.ok(isApprovedQuotation({ state: 'APROVADA_PELO_CLIENTE' }));
  assert.ok(isApprovedQuotation({ state: 'FECHADA' }));
  for (const state of ['DECLINADA', 'CANCELADO', 'ENVIADA_CLIENTE'])
    assert.equal(isApprovedQuotation({ state }), false);
});
test('a linked shipment takes precedence over a local opening request', () => {
  assert.equal(openingStage(true, false, false, true), 'linked');
});
test('review guard and sent instruction prevent duplicate opening requests', () => {
  assert.equal(openingStage(false, true, false, true), 'review');
  assert.equal(openingStage(false, false, true, true), 'sent');
  assert.equal(openingStage(false, false, false, true), 'local');
  assert.equal(openingStage(false, false, false, false), 'ready');
});

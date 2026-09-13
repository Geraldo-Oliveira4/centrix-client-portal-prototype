import test from 'node:test';
import assert from 'node:assert/strict';
import { proposalIssue, illustrativeMarketReference } from './detail-model.ts';

test('offer remains eligible through its validity day; expires the following day', () => {
  const p = { total_brl: 9230, validity: '2026-09-13' };
  assert.equal(proposalIssue(p, '2026-09-13'), null);
  assert.equal(proposalIssue(p, '2026-09-14'), 'Proposta vencida');
});
test('missing or invalid validity cannot authorize approval', () => {
  for (const validity of [null, '', 'invalid'])
    assert.equal(
      proposalIssue({ total_brl: 9230, validity }),
      'Validade a confirmar',
    );
});
test('missing, zero, negative or nonfinite BRL totals never turn into selectable free offers', () => {
  for (const total_brl of [undefined, null, 0, -1, NaN, Infinity])
    assert.equal(
      proposalIssue({ total_brl, validity: '2099-01-01' }),
      'Valor a confirmar',
    );
});
test('market context uses one reference for the quote, independent of array order', () => {
  const proposals = [
    { id: 'a', total_brl: 10000 },
    { id: 'b', total_brl: 11000, is_recommended: true },
  ];
  assert.equal(illustrativeMarketReference(proposals), 11880);
  assert.equal(illustrativeMarketReference([...proposals].reverse()), 11880);
  assert.equal(illustrativeMarketReference([]), null);
  assert.equal(illustrativeMarketReference([{ total_brl: null }]), null);
});

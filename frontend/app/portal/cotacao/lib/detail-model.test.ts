import test from 'node:test';
import assert from 'node:assert/strict';
import {
  proposalIssue,
  illustrativeAgentHistory,
  illustrativeMarketReference,
  palletCargoSummary,
} from './detail-model.ts';
import { agentHistoryFacts, agentHistoryLine } from './agent-history-line.ts';

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

test('demo: a Gamma tem histórico fixo, "10 de 11 no prazo nesta rota", sem divergências', () => {
  const gamma = illustrativeAgentHistory('demo-agent-gamma');
  assert.deepEqual(gamma, { completed: 11, onTime: 10, audited: 9, discrepancies: 0 });
  assert.deepEqual(agentHistoryLine(gamma), {
    kind: 'normal',
    text: '10 de 11 no prazo nesta rota',
  });
  // A gaveta "Ver histórico" lê a mesma fonte.
  const facts = agentHistoryFacts(gamma, 'Shanghai → Santos');
  assert.equal(facts[0].value, '10 de 11');
  assert.equal(facts[1].value, 'Nenhuma');
  // Cópia nova a cada chamada: ninguém altera o override por referência.
  gamma.onTime = 0;
  assert.equal(illustrativeAgentHistory('demo-agent-gamma').onTime, 10);
});

test('demo: os outros agentes seguem sorteados por semente (Alpha: 13 de 14)', () => {
  const alpha = illustrativeAgentHistory('demo-agent-alpha');
  assert.equal(agentHistoryLine(alpha).text, '13 de 14 no prazo nesta rota');
  assert.deepEqual(illustrativeAgentHistory('demo-agent-alpha'), alpha);
});

test('carga por extenso: "2 pallets, 850 kg" só quando todos os volumes são pallets', () => {
  const pallet = (quantity: number) => ({ quantity, embalagem: 'PALLET' });
  assert.equal(
    palletCargoSummary({ volumes: [pallet(2)], totals: { weight_kg: 850 } }),
    '2 pallets, 850 kg',
  );
  assert.equal(
    palletCargoSummary({ volumes: [pallet(1), pallet(2)], totals: { weight_kg: 1250 } }),
    '3 pallets, 1.250 kg',
  );
  assert.equal(palletCargoSummary({ volumes: [pallet(1)], totals: { weight_kg: null } }), '1 pallet');
  // Qualquer outro caso cai no formatTotals da tela.
  assert.equal(palletCargoSummary({ volumes: [], totals: { weight_kg: 850 } }), null);
  assert.equal(palletCargoSummary({ totals: { weight_kg: 850 } }), null);
  assert.equal(
    palletCargoSummary({ volumes: [pallet(2), { quantity: 1, embalagem: 'CAIXA' }], totals: { weight_kg: 850 } }),
    null,
  );
  assert.equal(palletCargoSummary({ volumes: [{ quantity: 2, embalagem: null }] }), null);
});

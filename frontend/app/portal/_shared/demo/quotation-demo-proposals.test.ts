// Unit test das propostas de demonstracao. Mesmo runner dos outros libs:
//
//     npm run test:unit
//
// O QUE ERRA EM SILENCIO AQUI:
//
//   1. Proposta de demonstracao entrando numa cotacao que TEM proposta real.
//      Seriam duas linhas na mesma tabela, uma aprovavel e outra nao, sem nada
//      distinguindo as duas.
//   2. Id instavel. A lista liberada guarda ids; se eles mudarem entre renders,
//      a comparacao abre vazia depois de um reload.
//   3. Nenhuma proposta com preco. Era o bug original: `releaseProposals([])`
//      nao libera, e a cotacao trava na revisao de saida para sempre.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  demoProposalsFor,
  effectiveProposals,
  isDemoProposal,
  releasableProposalIds,
} from './quotation-demo-proposals.ts';

const NOW = Date.parse('2026-09-24T12:00:00.000Z');

test('sao tres agentes, com nome, preco e prazo distintos', () => {
  const rows = demoProposalsFor('q1', NOW);
  assert.equal(rows.length, 3);
  assert.equal(new Set(rows.map((p) => p.agent?.name)).size, 3);
  assert.equal(new Set(rows.map((p) => p.transit_time)).size, 3);
  for (const row of rows) {
    assert.ok(row.agent?.name?.length, 'agente sem nome');
    assert.equal(row.quotation_id, 'q1');
  }
});

test('ha mais de uma moeda entre elas', () => {
  const currencies = new Set(
    demoProposalsFor('q1', NOW).map((p) => p.moeda_original),
  );
  assert.ok(currencies.size > 1, 'as moedas precisam variar');
});

test('UMA delas e bloqueada: sem preco, para exercitar o "nao liberado"', () => {
  const rows = demoProposalsFor('q1', NOW);
  const blocked = rows.filter((p) => !(p.total_brl > 0));
  assert.equal(blocked.length, 1);
  assert.equal(blocked[0].validity, null);
});

test('as liberaveis sao as COM preco — e existe pelo menos uma', () => {
  const ids = releasableProposalIds(demoProposalsFor('q1', NOW));
  assert.equal(ids.length, 2);
  assert.ok(ids.length > 0, 'sem isto, a revisao de saida trava');
});

test('os ids sao estaveis e escopados a cotacao', () => {
  assert.deepEqual(
    demoProposalsFor('q1', NOW).map((p) => p.id),
    demoProposalsFor('q1', NOW + 999_999).map((p) => p.id),
  );
  const a = demoProposalsFor('q1', NOW).map((p) => p.id);
  const b = demoProposalsFor('q2', NOW).map((p) => p.id);
  assert.equal(a.some((id) => b.includes(id)), false);
});

test('toda proposta de demonstracao se declara como tal', () => {
  for (const row of demoProposalsFor('q1', NOW)) {
    assert.equal(row.is_demo, true);
    assert.equal(isDemoProposal(row), true);
  }
  assert.equal(isDemoProposal({ id: 'a-real-uuid' }), false);
});

test('a validade sai do relogio injetado, nao do relogio real', () => {
  const rows = demoProposalsFor('q1', NOW);
  assert.equal(rows[0].validity, '2026-10-10');
  assert.equal(rows[1].validity, '2026-10-12');
});

test('PROPOSTA REAL GANHA SEMPRE — nem uma linha de demonstracao entra', () => {
  const real = [{ id: 'real-1' }, { id: 'real-2' }];
  const rows = effectiveProposals({ id: 'q1', proposals: real }, NOW);
  assert.equal(rows, real);
  assert.equal(rows.some(isDemoProposal), false);
});

test('uma UNICA proposta real ja basta para segurar a demonstracao fora', () => {
  const rows = effectiveProposals({ id: 'q1', proposals: [{ id: 'r' }] }, NOW);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'r');
});

test('payload vazio ou ausente cai nas de demonstracao', () => {
  for (const quotation of [
    { id: 'q1', proposals: [] },
    { id: 'q1', proposals: null },
    { id: 'q1' },
  ]) {
    const rows = effectiveProposals(quotation, NOW);
    assert.equal(rows.length, 3);
    assert.equal(rows.every(isDemoProposal), true);
  }
});

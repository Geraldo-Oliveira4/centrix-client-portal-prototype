import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HISTORY_DISCLAIMER,
  agentHistoryFacts,
  agentHistoryLine,
} from './agent-history-line.ts';
import { illustrativeAgentHistory } from './detail-model.ts';

const h = (onTime: number, completed: number, audited: number, discrepancies: number) => ({
  onTime,
  completed,
  audited,
  discrepancies,
});

test('linha normal: N de M no prazo nesta rota', () => {
  assert.deepEqual(agentHistoryLine(h(12, 14, 12, 0)), {
    kind: 'normal',
    text: '12 de 14 no prazo nesta rota',
  });
});

test('com divergência: acrescenta "· 1 divergência" (plural quando mais)', () => {
  assert.equal(agentHistoryLine(h(8, 10, 8, 1)).text, '8 de 10 no prazo nesta rota · 1 divergência');
  assert.equal(agentHistoryLine(h(8, 10, 8, 2)).text, '8 de 10 no prazo nesta rota · 2 divergências');
});

test('sem histórico: "Sem histórico nesta rota", nunca "0 de 0"', () => {
  for (const x of [null, undefined, h(0, 0, 0, 0)])
    assert.deepEqual(agentHistoryLine(x), { kind: 'sem_historico', text: 'Sem histórico nesta rota' });
});

test('menos de 3 embarques: amostra pequena, sem percentual de pontualidade', () => {
  assert.deepEqual(agentHistoryLine(h(2, 2, 1, 0)), { kind: 'amostra_pequena', text: 'Amostra pequena (n=2)' });
  assert.equal(agentHistoryLine(h(3, 3, 0, 0)).kind, 'normal');
});

test('gaveta: os três fatos do antigo Raio X, sem nota', () => {
  const facts = agentHistoryFacts(h(8, 10, 8, 1), 'Ningbo → Itajaí · Marítimo');
  assert.deepEqual(facts.map((f) => f.term), ['Cumprimento de prazo', 'Cotado × cobrado', 'Experiência nesta rota']);
  assert.deepEqual(facts[0], { term: 'Cumprimento de prazo', value: '8 de 10', unit: 'chegadas no prazo', note: 'Após o previsto no porto: 2 de 10.' });
  assert.equal(facts[1].value, '1');
  assert.equal(facts[1].unit, 'divergência confirmada');
  assert.equal(facts[1].note, '8 fretes conferidos nesta amostra.');
  assert.equal(facts[2].value, '10');
  assert.equal(facts[2].note, 'Ningbo → Itajaí · Marítimo');
  assert.doesNotMatch(JSON.stringify(facts), /score|nota|ranking|\/100/i);
  assert.match(HISTORY_DISCLAIMER, /não garante a próxima chegada/);
});

test('gaveta sem histórico e sem auditoria diz isso em palavras', () => {
  const facts = agentHistoryFacts(h(0, 0, 0, 0), 'Rota');
  assert.deepEqual(facts.map((f) => f.value), ['Sem histórico', 'Sem auditorias', 'Sem histórico']);
  assert.ok(facts.every((f) => f.unit === null));
  assert.equal(agentHistoryFacts(h(5, 5, 4, 0), 'Rota')[1].value, 'Nenhuma');
});

test('fonte inalterada: a linha do detalhe real sai de illustrativeAgentHistory, por agente', () => {
  const a = agentHistoryLine(illustrativeAgentHistory('agente-a'));
  const b = agentHistoryLine(illustrativeAgentHistory('agente-b'));
  assert.equal(a.kind, 'normal');
  assert.equal(a.text, agentHistoryLine(illustrativeAgentHistory('agente-a')).text);
  assert.notEqual(a.text, b.text);
});

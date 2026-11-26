import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildComparisonMap,
  freeTimeOf,
  type MapProposal,
} from './comparison-map-model.ts';
import { illustrativeAgentHistory } from './detail-model.ts';
import { agentHistoryLine } from './agent-history-line.ts';

const TODAY = '2026-11-26';
const VALID = '2026-12-20';
const EXPIRED = '2026-11-25';

const p = (
  id: string,
  total_brl: number,
  transit_time: number | null,
  validity: string | null = VALID,
): MapProposal => ({ id, agent_id: 'agent-' + id, total_brl, transit_time, validity });

const history = (onTime: number, completed: number) => () => ({
  onTime,
  completed,
  audited: Math.max(completed - 2, 0),
  discrepancies: 0,
});

const build = (
  proposals: MapProposal[],
  recommendedId: string | null,
  historyOf = history(8, 10),
) => buildComparisonMap(proposals, { recommendedId, today: TODAY, historyOf });

const ids = (map: ReturnType<typeof build>) =>
  map.columns.map((c) => c.proposal.id);

test('ordem: recomendada primeiro, válidas na ordem do payload, com problema no fim', () => {
  const map = build(
    [
      p('vencida', 5000, 20, EXPIRED),
      p('a', 9000, 30),
      p('sem-valor', 0, 25),
      p('rec', 8000, 28),
      p('b', 7000, 35),
    ],
    'rec',
  );
  assert.deepEqual(ids(map), ['rec', 'a', 'b', 'vencida', 'sem-valor']);
  assert.equal(map.recommendedId, 'rec');
  assert.deepEqual(
    map.columns.map((c) => c.issue),
    [null, null, null, 'Proposta vencida', 'Valor a confirmar'],
  );
});

test('vencida não compete: não leva selo nem serve de rival, mesmo sendo a mais barata e a mais rápida', () => {
  const map = build(
    [p('vencida', 1000, 5, EXPIRED), p('rec', 8000, 28), p('b', 9000, 30)],
    'rec',
  );
  const [rec, b, vencida] = map.columns;
  assert.equal(vencida.cheapest, false);
  assert.equal(vencida.fastest, false);
  assert.equal(rec.cheapest, true);
  assert.equal(rec.fastest, true);
  assert.equal(b.cheapest, false);
  assert.equal(
    map.reason,
    'Recomendada: menor custo entre as propostas, chega 2 dias antes e este agente cumpriu o prazo em 8 de 10 embarques desta rota.',
  );
});

test('recomendação que aponta para proposta inválida não destaca coluna nenhuma', () => {
  const map = build([p('x', 5000, 20, EXPIRED), p('a', 9000, 30)], 'x');
  assert.equal(map.recommendedId, null);
  assert.equal(map.reason, null);
  assert.ok(map.columns.every((c) => !c.recommended));
  assert.deepEqual(ids(map), ['a', 'x']);
  assert.equal(build([p('a', 9000, 30)], null).reason, null);
});

test('empate marca todas as empatadas', () => {
  const map = build([p('a', 7000, 30), p('b', 7000, 30), p('c', 9000, 31)], null);
  assert.deepEqual(
    map.columns.map((c) => [c.cheapest, c.fastest]),
    [
      [true, true],
      [true, true],
      [false, false],
    ],
  );
});

test('frase com vantagem de prazo e sobrepreço: os dois sentidos do custo', () => {
  const map = build([p('barata', 6800, 35), p('rec', 8000, 29)], 'rec');
  assert.equal(
    map.reason,
    'Recomendada: R$ 1.200 acima da mais barata, chega 6 dias antes e este agente cumpriu o prazo em 8 de 10 embarques desta rota.',
  );
  // O selo de custo fica com a rival; o de prazo, com a recomendada.
  assert.deepEqual(
    map.columns.map((c) => [c.proposal.id, c.cheapest, c.fastest]),
    [
      ['rec', false, true],
      ['barata', true, false],
    ],
  );
});

test('frase sem vantagem de prazo: mais lenta cala sobre o prazo', () => {
  const map = build([p('rec', 6490, 29), p('rapida', 7120, 27)], 'rec');
  assert.equal(
    map.reason,
    'Recomendada: menor custo entre as propostas e este agente cumpriu o prazo em 8 de 10 embarques desta rota.',
  );
  assert.doesNotMatch(map.reason!, /chega|antes|depois/);
  // Empate de prazo também não é vantagem.
  assert.doesNotMatch(
    build([p('rec', 6490, 27), p('b', 7120, 27)], 'rec').reason!,
    /chega/,
  );
});

test('prazo: a vantagem é medida contra a rival válida MAIS RÁPIDA', () => {
  const map = build(
    [p('rec', 8000, 25), p('b', 7000, 40), p('c', 9000, 28)],
    'rec',
  );
  assert.match(map.reason!, /chega 3 dias antes da segunda mais rápida/);
  assert.match(
    build([p('rec', 8000, 26), p('b', 7000, 27)], 'rec').reason!,
    /chega 1 dia antes e /,
  );
});

test('custo empatado com a mais barata não vira "menor custo" sozinho', () => {
  assert.match(
    build([p('rec', 7000, 30), p('b', 7000, 30)], 'rec').reason!,
    /^Recomendada: empata no menor custo entre as propostas e /,
  );
});

test('amostra pequena: sem fração, "ainda sem histórico suficiente"', () => {
  for (const historyOf of [history(2, 2), history(0, 0), () => null]) {
    const map = build([p('rec', 6490, 29), p('b', 7120, 27)], 'rec', historyOf);
    assert.equal(
      map.reason,
      'Recomendada: menor custo entre as propostas e ainda sem histórico suficiente deste agente nesta rota.',
    );
    assert.doesNotMatch(map.reason!, /\d+ de \d+/);
  }
  assert.match(
    build([p('rec', 6490, 29), p('b', 7120, 27)], 'rec', history(3, 3)).reason!,
    /cumpriu o prazo em 3 de 3 embarques/,
  );
});

test('sem rival: não compara custo nem prazo e não distribui selo', () => {
  const map = build([p('rec', 6490, 29), p('vencida', 100, 2, EXPIRED)], 'rec');
  assert.equal(
    map.reason,
    'Recomendada: única proposta válida no momento e este agente cumpriu o prazo em 8 de 10 embarques desta rota.',
  );
  assert.ok(map.columns.every((c) => !c.cheapest && !c.fastest));
});

test('histórico padrão é o mesmo da linha "N de M no prazo" da tela', () => {
  const map = buildComparisonMap([p('rec', 6490, 29), p('b', 7120, 27)], {
    recommendedId: 'rec',
    today: TODAY,
  });
  const h = illustrativeAgentHistory('agent-rec');
  assert.deepEqual(map.columns[0].history, h);
  assert.match(
    map.reason!,
    new RegExp(`cumpriu o prazo em ${h.onTime} de ${h.completed} embarques`),
  );
  assert.ok(agentHistoryLine(h).text.startsWith(`${h.onTime} de ${h.completed} no prazo`));
});

test('chegada prevista = hoje + transit time; sem trânsito, sem chegada', () => {
  const map = build([p('a', 7000, 29), p('b', 8000, null)], null);
  assert.equal(map.columns[0].arrival, '2026-12-25');
  assert.equal(map.columns[1].arrival, null);
  assert.equal(map.columns[1].fastest, false);
});

test('free time: payload vence; senão valor ilustrativo estável por agente, entre 7 e 21', () => {
  assert.deepEqual(freeTimeOf({ ...p('a', 1, 1), free_time_dias: 14 }), {
    days: 14,
    illustrative: false,
  });
  const first = freeTimeOf(p('a', 1, 1))!;
  assert.equal(first.illustrative, true);
  assert.ok(first.days >= 7 && first.days <= 21);
  assert.deepEqual(freeTimeOf(p('a', 999, 50)), first);
  assert.equal(freeTimeOf({ ...p('a', 1, 1), agent_id: null }), null);
});

// Unit test for the timeline step rule. Same runner as delay-risk.test.ts:
//
//     npm run test:unit
//
// It exists because the post-departure half of the timeline is driven entirely
// by carrier data that is NULL on a normal database — the interesting cases
// (milestone reported, carrier INCOMPLETE) only appear with the demo top-up, so
// without a test they would be verified by hand once and never again.

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildTimelineSteps, firstBlockedKey } from './timeline-steps.ts';

const REAL_STEPS = [
  { key: 'solicitado', label: 'Solicitado', description: '' },
  { key: 'aguardando_prontidao', label: 'Aguardando prontidão', description: '' },
  { key: 'coletado', label: 'Coletado', description: '' },
  { key: 'analise_booking', label: 'Em análise de booking', description: '' },
  { key: 'embarcado', label: 'Embarcado', description: '' },
];

const build = (overrides = {}) =>
  buildTimelineSteps({
    estado: 'embarcado',
    realSteps: REAL_STEPS,
    isException: false,
    ...overrides,
  });

const statusOf = (steps, key) => steps.find((s) => s.key === key)?.status;

test('the line always has 5 real steps + 4 carrier milestones', () => {
  const steps = build();
  assert.equal(steps.length, 9);
  assert.deepEqual(
    steps.slice(5).map((s) => s.key),
    ['em_transito', 'chegada', 'descarregado', 'liberado'],
  );
});

test('no carrier data -> every downstream step is pending', () => {
  const steps = build();
  assert.equal(statusOf(steps, 'embarcado'), 'current');
  for (const key of ['em_transito', 'chegada', 'descarregado', 'liberado']) {
    assert.equal(statusOf(steps, key), 'pending');
  }
  assert.equal(firstBlockedKey(steps), null);
});

test('mid-journey state marks earlier steps done and later ones upcoming', () => {
  const steps = build({ estado: 'coletado' });
  assert.equal(statusOf(steps, 'solicitado'), 'done');
  assert.equal(statusOf(steps, 'coletado'), 'current');
  assert.equal(statusOf(steps, 'embarcado'), 'upcoming');
});

test('DISCHARGE milestone fills Descarregado and moves "current" onto it', () => {
  const steps = build({ milestone: 'DISCHARGE' });
  // The cargo is past every operational stage the GE module tracks.
  assert.equal(statusOf(steps, 'embarcado'), 'done');
  assert.equal(statusOf(steps, 'em_transito'), 'done');
  assert.equal(statusOf(steps, 'chegada'), 'done');
  assert.equal(statusOf(steps, 'descarregado'), 'current');
  // Nothing beyond the reported milestone is claimed.
  assert.equal(statusOf(steps, 'liberado'), 'pending');
  // Exactly one "Etapa atual" on the whole line.
  assert.equal(steps.filter((s) => s.status === 'current').length, 1);
});

test('first milestone only advances the first downstream step', () => {
  const steps = build({ milestone: 'OCEAN_TRANSIT' });
  assert.equal(statusOf(steps, 'em_transito'), 'current');
  assert.equal(statusOf(steps, 'chegada'), 'pending');
});

test('INCOMPLETE blocks the downstream steps and flags the first one', () => {
  const steps = build({ dataStatus: 'INCOMPLETE' });
  assert.equal(statusOf(steps, 'em_transito'), 'blocked');
  assert.equal(statusOf(steps, 'liberado'), 'blocked');
  assert.equal(firstBlockedKey(steps), 'em_transito');
});

test('INCOMPLETE after a milestone blocks only what is still unknown', () => {
  const steps = build({ dataStatus: 'INCOMPLETE', milestone: 'ARRIVAL' });
  assert.equal(statusOf(steps, 'em_transito'), 'done');
  assert.equal(statusOf(steps, 'chegada'), 'current');
  assert.equal(statusOf(steps, 'descarregado'), 'blocked');
  assert.equal(firstBlockedKey(steps), 'descarregado');
});

test('an exception freezes the line and ignores any milestone', () => {
  const steps = build({ estado: 'postergado', isException: true, milestone: 'DISCHARGE' });
  assert.equal(steps.filter((s) => s.status === 'done').length, 0);
  assert.equal(steps.filter((s) => s.status === 'current').length, 0);
  assert.equal(statusOf(steps, 'descarregado'), 'pending');
});

test('Chegada is the only step tagged as the arrival anchor', () => {
  const anchors = build().filter((s) => s.isArrival);
  assert.equal(anchors.length, 1);
  assert.equal(anchors[0].key, 'chegada');
});

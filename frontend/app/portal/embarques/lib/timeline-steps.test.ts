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

test('no carrier data and no ETA -> no forecast, the pending badge stays', () => {
  const steps = build();
  assert.ok(steps.slice(5).every((s) => s.forecastAt === undefined));
});

test('a pending downstream step carries the forecast, and only the text changes', () => {
  const steps = build({
    estado: 'coletado',
    currentEta: '2026-09-02T00:00:00Z',
    now: new Date('2026-08-13T00:00:00Z'),
  });
  const chegada = steps.find((s) => s.key === 'chegada');
  assert.equal(chegada.status, 'pending');
  assert.equal(chegada.forecastAt.slice(0, 10), '2026-09-02');
  // The filled/empty rule is untouched: "Etapa atual" is still the real state.
  assert.equal(statusOf(steps, 'coletado'), 'current');
  assert.equal(steps.filter((s) => s.status === 'current').length, 1);
  assert.equal(steps.filter((s) => s.status === 'done').length, 2);
});

test('a reached milestone is never given a forecast date', () => {
  const steps = build({
    milestone: 'ARRIVAL',
    currentEta: '2026-09-02T00:00:00Z',
    now: new Date('2026-08-13T00:00:00Z'),
  });
  assert.equal(statusOf(steps, 'chegada'), 'current');
  assert.equal(steps.find((s) => s.key === 'chegada').forecastAt, undefined);
  assert.equal(steps.find((s) => s.key === 'em_transito').forecastAt, undefined);
  // Only what is still unknown gets one.
  assert.ok(steps.find((s) => s.key === 'liberado').forecastAt);
});

test('INCOMPLETE keeps its own badge instead of a forecast', () => {
  const steps = build({
    dataStatus: 'INCOMPLETE',
    currentEta: '2026-09-02T00:00:00Z',
    now: new Date('2026-08-13T00:00:00Z'),
  });
  assert.ok(steps.slice(5).every((s) => s.status === 'blocked'));
  assert.ok(steps.slice(5).every((s) => s.forecastAt === undefined));
});

test('Chegada is the only step tagged as the arrival anchor', () => {
  const anchors = build().filter((s) => s.isArrival);
  assert.equal(anchors.length, 1);
  assert.equal(anchors[0].key, 'chegada');
});

// --- Datas de realização (18/08/2026) --------------------------------------
// O ponto destes testes não é o caminho feliz, é o que NÃO deve ganhar data:
// sem tabela de transição, uma data a mais aqui é uma data inventada.

const dateOf = (steps, key) => steps.find((s) => s.key === key)?.occurredAt;

test('Solicitado carrega a abertura do processo, e só ele', () => {
  const steps = build({ createdAt: '2026-07-22T10:00:00Z' });
  assert.equal(dateOf(steps, 'solicitado'), '2026-07-22T10:00:00Z');
  // As outras quatro etapas operacionais estão concluídas e continuam sem data:
  // não existe fonte de "concluído em" para nenhuma delas.
  for (const key of ['aguardando_prontidao', 'coletado', 'analise_booking']) {
    assert.equal(dateOf(steps, key), undefined, key);
  }
});

test('sem created_at ninguem e datado', () => {
  assert.equal(dateOf(build(), 'solicitado'), undefined);
});

test('etapa que ainda nao aconteceu nao tem quando', () => {
  const steps = build({ estado: 'solicitado', createdAt: '2026-07-22T10:00:00Z' });
  assert.equal(statusOf(steps, 'solicitado'), 'current');
  // Current tambem "aconteceu" (esta acontecendo), entao e datavel.
  assert.equal(dateOf(steps, 'solicitado'), '2026-07-22T10:00:00Z');
  assert.equal(dateOf(steps, 'embarcado'), undefined);
});

test('exceção congela a linha e apaga as datas junto', () => {
  // Sem saber qual estágio precedeu a exceção, nada é `done`/`current` e nada
  // pode ser afirmado como tendo acontecido.
  const steps = build({
    isException: true,
    estado: 'postergado',
    createdAt: '2026-07-22T10:00:00Z',
    milestoneAt: '2026-08-15T00:00:00Z',
    milestone: 'AVAILABLE',
  });
  assert.ok(steps.every((s) => s.occurredAt === undefined));
});

test('last_milestone_at data o marco reportado, nunca os anteriores', () => {
  const steps = build({
    milestone: 'DISCHARGE',
    milestoneAt: '2026-08-15T00:00:00Z',
    createdAt: '2026-07-22T10:00:00Z',
  });
  assert.equal(statusOf(steps, 'descarregado'), 'current');
  assert.equal(dateOf(steps, 'descarregado'), '2026-08-15T00:00:00Z');
  // Em trânsito e Chegada estão `done` porque o marco os ultrapassou, mas a
  // companhia não disse QUANDO cada um aconteceu — herdar a data para trás
  // inventaria duas datas a partir de uma.
  assert.equal(statusOf(steps, 'em_transito'), 'done');
  assert.equal(dateOf(steps, 'em_transito'), undefined);
  assert.equal(dateOf(steps, 'chegada'), undefined);
});

test('milestone sem data reportada continua sem data', () => {
  // Legal no schema (migração 093): a companhia nomeia o estágio sem datá-lo.
  const steps = build({ milestone: 'DISCHARGE' });
  assert.equal(statusOf(steps, 'descarregado'), 'current');
  assert.equal(dateOf(steps, 'descarregado'), undefined);
});

test('data de realizacao e previsao nunca coexistem na mesma etapa', () => {
  const steps = build({
    milestone: 'ARRIVAL',
    milestoneAt: '2026-08-15T00:00:00Z',
    createdAt: '2026-07-22T10:00:00Z',
    currentEta: '2026-09-02T00:00:00Z',
    now: new Date('2026-08-18T00:00:00Z'),
  });
  assert.ok(steps.every((s) => !(s.occurredAt && s.forecastAt)));
});

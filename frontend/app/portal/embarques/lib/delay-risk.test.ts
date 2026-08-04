// Unit test for the delay-risk rule. Runs on the Node test runner with native
// TypeScript stripping (Node >= 22.18):
//
//     npm run test:unit
//
// It is the only automated test in this frontend, on purpose: the rule is the
// one piece of logic here that produces a number a client will act on, and it
// has to keep behaving before the ShipsGo integration can feed it real dates.
// The file is excluded from tsconfig (the `.ts` import specifier the Node
// runtime needs is not valid under the app's module settings).

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DELAY_ATTENTION_MAX_DAYS,
  computeDelayRisk,
  delayRiskFromTracking,
} from './delay-risk.ts';

const iso = (day: number) =>
  new Date(Date.UTC(2026, 7, day, 12, 0, 0)).toISOString();

test('no tracking data at all -> pending, no number', () => {
  const risk = computeDelayRisk({ firstEta: null, currentEta: null });
  assert.equal(risk.status, 'pending');
  assert.equal(risk.deltaDays, null);
  assert.equal(risk.label, 'Pendente integração');
});

test('carrier reported INCOMPLETE -> incomplete, even with dates present', () => {
  const risk = computeDelayRisk({
    firstEta: iso(1),
    currentEta: iso(20),
    dataStatus: 'INCOMPLETE',
  });
  assert.equal(risk.status, 'incomplete');
  assert.equal(risk.deltaDays, null);
});

test('COMPLETE but a missing date -> incomplete, not pending', () => {
  const risk = computeDelayRisk({
    firstEta: iso(1),
    currentEta: null,
    dataStatus: 'COMPLETE',
  });
  assert.equal(risk.status, 'incomplete');
});

test('unparseable dates never produce a number', () => {
  const risk = computeDelayRisk({ firstEta: 'not-a-date', currentEta: iso(3) });
  assert.equal(risk.status, 'pending');
  assert.equal(risk.deltaDays, null);
});

test('same ETA -> on time', () => {
  const risk = computeDelayRisk({ firstEta: iso(10), currentEta: iso(10) });
  assert.equal(risk.status, 'on_time');
  assert.equal(risk.deltaDays, 0);
  assert.equal(risk.label, 'No prazo');
});

test('earlier than first ETA -> on time with a negative delta', () => {
  const risk = computeDelayRisk({ firstEta: iso(10), currentEta: iso(6) });
  assert.equal(risk.status, 'on_time');
  assert.equal(risk.deltaDays, -4);
});

test('1 to 3 days late -> attention, exact number in the label', () => {
  assert.equal(
    computeDelayRisk({ firstEta: iso(10), currentEta: iso(11) }).label,
    'Atenção, +1 dia',
  );
  const three = computeDelayRisk({ firstEta: iso(10), currentEta: iso(13) });
  assert.equal(three.status, 'attention');
  assert.equal(three.deltaDays, DELAY_ATTENTION_MAX_DAYS);
  assert.equal(three.label, 'Atenção, +3 dias');
});

test('more than 3 days late -> delayed', () => {
  const risk = computeDelayRisk({ firstEta: iso(10), currentEta: iso(14) });
  assert.equal(risk.status, 'delayed');
  assert.equal(risk.deltaDays, 4);
  assert.equal(risk.label, 'Atraso, +4 dias');
});

test('time of day does not create a delay', () => {
  const risk = computeDelayRisk({
    firstEta: '2026-08-10T23:30:00Z',
    currentEta: '2026-08-11T00:30:00Z',
  });
  // One hour apart, but a different calendar day: still exactly one day late,
  // never rounded to two.
  assert.equal(risk.deltaDays, 1);
  assert.equal(risk.status, 'attention');
});

test('IsActual switches the basis to a real arrival', () => {
  const estimated = computeDelayRisk({ firstEta: iso(10), currentEta: iso(12) });
  assert.equal(estimated.basis, 'estimated');
  const actual = computeDelayRisk({
    firstEta: iso(10),
    currentEta: iso(12),
    etaIsActual: true,
  });
  assert.equal(actual.basis, 'actual');
  assert.equal(actual.deltaDays, 2);
});

test('the payload wrapper matches the raw call', () => {
  assert.deepEqual(
    delayRiskFromTracking({
      first_eta: iso(10),
      current_eta: iso(15),
      eta_is_actual: true,
      data_status: 'COMPLETE',
    }),
    computeDelayRisk({
      firstEta: iso(10),
      currentEta: iso(15),
      etaIsActual: true,
      dataStatus: 'COMPLETE',
    }),
  );
  // Today's real payload: every field null.
  assert.equal(
    delayRiskFromTracking({
      first_eta: null,
      current_eta: null,
      eta_is_actual: null,
      data_status: null,
    }).status,
    'pending',
  );
  assert.equal(delayRiskFromTracking(null).status, 'pending');
});

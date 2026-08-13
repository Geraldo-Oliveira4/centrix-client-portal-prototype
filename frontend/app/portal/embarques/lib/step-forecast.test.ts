// Unit test for the downstream forecast rule. Same runner as the other libs:
//
//     npm run test:unit
//
// It exists because the forecast is what replaced the "Pendente integração"
// badge on the lower half of the timeline: a wrong offset here does not throw,
// it just prints a plausible-looking date that contradicts the ETA shown at the
// top of the same screen.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEPARTURE_LEAD_DAYS,
  POST_ARRIVAL_OFFSET_DAYS,
  forecastDownstreamDates,
} from './step-forecast.ts';

const NOW = new Date('2026-08-13T00:00:00Z');
const day = (iso) => iso.slice(0, 10);

const forecast = (overrides = {}) =>
  forecastDownstreamDates({
    estado: 'aguardando_prontidao',
    currentEta: '2026-09-02T00:00:00Z',
    now: NOW,
    ...overrides,
  });

test('Chegada is the ETA itself, never a second invented date', () => {
  assert.equal(day(forecast().chegada), '2026-09-02');
});

test('the two stages after arrival sit at their nominal offsets', () => {
  const f = forecast();
  assert.equal(POST_ARRIVAL_OFFSET_DAYS.descarregado, 2);
  assert.equal(POST_ARRIVAL_OFFSET_DAYS.liberado, 5);
  assert.equal(day(f.descarregado), '2026-09-04');
  assert.equal(day(f.liberado), '2026-09-07');
});

test('no ETA -> no forecast at all (the caller keeps its pending badge)', () => {
  assert.deepEqual(forecast({ currentEta: null }), {});
  assert.deepEqual(forecast({ currentEta: undefined, firstEta: null }), {});
});

test('first_eta backs up a missing current_eta', () => {
  const f = forecast({ currentEta: null, firstEta: '2026-08-30T00:00:00Z' });
  assert.equal(day(f.chegada), '2026-08-30');
});

test('departure follows the state: the earlier the stage, the later it departs', () => {
  const at = (estado) => day(forecast({ estado }).em_transito);
  // 20 days to the arrival, so the halfway cap (10) does not bind below it.
  assert.equal(at('solicitado'), '2026-08-23'); // lead 12 -> capped at halfway
  assert.equal(at('aguardando_prontidao'), '2026-08-21'); // lead 8
  assert.equal(at('coletado'), '2026-08-17'); // lead 4
  assert.equal(at('analise_booking'), '2026-08-15'); // lead 2
  assert.equal(at('embarcado'), '2026-08-14'); // lead 1
});

test('the lead table has no entry for the exception states', () => {
  assert.equal(DEPARTURE_LEAD_DAYS.postergado, undefined);
  assert.equal(DEPARTURE_LEAD_DAYS.booking_divergente, undefined);
});

test('an exception state still forecasts, at the halfway point', () => {
  // The frozen line does not say which stage preceded the exception, so there is
  // no lead to apply — halfway to the arrival is the only defensible answer.
  assert.equal(day(forecast({ estado: 'postergado' }).em_transito), '2026-08-23');
});

test('departure is always before the arrival, even on a near ETA', () => {
  for (const eta of ['2026-08-13', '2026-08-14', '2026-08-15', '2026-08-20']) {
    const f = forecast({ estado: 'solicitado', currentEta: `${eta}T00:00:00Z` });
    assert.ok(
      new Date(f.em_transito) < new Date(f.chegada),
      `departure not before arrival for ETA ${eta}`,
    );
  }
});

test('a stale ETA already in the past keeps the pair in order', () => {
  const f = forecast({ currentEta: '2026-08-01T00:00:00Z' });
  assert.ok(new Date(f.em_transito) < new Date(f.chegada));
  assert.equal(day(f.em_transito), '2026-07-31');
});

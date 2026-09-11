import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildShipmentOverview, compareShipmentOverview, hasArrived } from './shipment-overview.ts';
import { collectHomeActions } from '../../home/lib/home-actions.ts';
import {
  SHIPMENT_STEPS,
  ESTADO_LABELS,
  ESTADO_DESCRIPTIONS,
} from '../../../../types/portal-shipment.ts';

const now = new Date('2026-09-08T15:00:00Z');
const realSteps = SHIPMENT_STEPS.map((key) => ({
  key,
  label: ESTADO_LABELS[key],
  description: ESTADO_DESCRIPTIONS[key],
}));
const ship = (id, eta = '2026-09-10', overrides = {}) => ({
  id,
  referencia: id,
  estado: 'coletado',
  carga_urgente: false,
  created_at: '2026-08-01T12:00:00Z',
  tracking: {
    first_eta: '2026-09-08',
    current_eta: eta,
    data_status: 'COMPLETE',
    eta_is_actual: false,
    last_milestone: null,
    is_mock: true,
  },
  ...overrides,
});
const action = (id, recordId, module = 'embarque') => ({
  id,
  recordId,
  module,
});

test('map and list prioritize actions, urgent loads within each group, then arrivals', () => {
  const data = [ship('normal', null), ship('delayed'), ship('action'), ship('urgent-action', '2026-09-14', { carga_urgente: true })];
  const { groups } = buildShipmentOverview(data, [action('a', 'action'), action('b', 'urgent-action')], now);
  assert.deepEqual([...data].sort((a,b) => compareShipmentOverview(a,b,groups,now)).map(s=>s.id), ['urgent-action','action','delayed','normal']);
  assert.equal(data[0].id, 'normal');
});

test('upcoming mode uses ETA before urgency and unknown dates sort last', () => {
  const data = [ship('unknown', null), ship('urgent', '2026-09-14', { carga_urgente: true }), ship('soon', '2026-09-10')];
  const { groups } = buildShipmentOverview(data, [], now);
  assert.deepEqual([...data].sort((a,b) => compareShipmentOverview(a,b,groups,now,'upcoming')).map(s=>s.id), ['soon','urgent','unknown']);
});

test('equal or missing dates have deterministic reference ordering', () => {
  const data = [ship('Z', null), ship('A', null)];
  const { groups } = buildShipmentOverview(data, [], now);
  assert.deepEqual(data.sort((a,b) => compareShipmentOverview(a,b,groups,now)).map(s=>s.id), ['A','Z']);
});
test('counts each shipment once and allows overlap between all three indicators', () => {
  const s = ship('one');
  const { groups } = buildShipmentOverview(
    [s],
    [
      action('doc', 'one'),
      action('booking', 'one'),
      action('quote', 'other', 'cotacao'),
    ],
    now,
  );
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(groups).map(([k, v]) => [k, Array.from(v)]),
    ),
    { action: ['one'], delayed: ['one'], upcoming: ['one'] },
  );
});
test('seven calendar days includes today and day six, excluding yesterday and day seven', () => {
  const { groups } = buildShipmentOverview(
    [
      ship('yesterday', '2026-09-07'),
      ship('today', '2026-09-08'),
      ship('last', '2026-09-14'),
      ship('outside', '2026-09-15'),
    ],
    [],
    now,
  );
  assert.deepEqual(Array.from(groups.upcoming), ['today', 'last']);
});
test('Brazilian today is stable after UTC midnight', () => {
  const { groups } = buildShipmentOverview(
    [ship('today', '2026-09-08')],
    [],
    new Date('2026-09-09T01:00:00Z'),
  );
  assert.equal(groups.upcoming.size, 1);
});
test('confirmed arrivals and later carrier milestones are excluded from open arrival indicators', () => {
  for (const milestone of ['ARRIVAL', 'DISCHARGE', 'AVAILABLE']) {
    const s = ship(milestone);
    s.tracking.last_milestone = milestone;
    assert.equal(hasArrived(s, now), true);
    const { groups } = buildShipmentOverview([s], [action('doc', s.id)], now);
    assert.equal(groups.delayed.size, 0);
    assert.equal(groups.upcoming.size, 0);
    assert.equal(groups.action.size, 1);
  }
  const s = ship('actual', '2026-09-07');
  s.tracking.eta_is_actual = true;
  assert.equal(buildShipmentOverview([s], [], now).groups.upcoming.size, 0);
});
test('missing, invalid and insufficient tracking never create a zero-day or invented arrival', () => {
  const incomplete = ship('incomplete');
  incomplete.tracking.data_status = 'INCOMPLETE';
  const { groups } = buildShipmentOverview(
    [
      ship('null', null),
      ship('bad', 'not-a-date'),
      ship('absent', null, { tracking: null }),
      incomplete,
    ],
    [],
    now,
  );
  assert.equal(groups.upcoming.size, 0);
  assert.equal(groups.delayed.size, 0);
});
test('one-day ETA slip counts, unchanged or earlier arrivals do not', () => {
  const { groups } = buildShipmentOverview(
    [
      ship('same', '2026-09-08'),
      ship('early', '2026-09-07'),
      ship('late', '2026-09-09'),
    ],
    [],
    now,
  );
  assert.deepEqual(Array.from(groups.delayed), ['late']);
});
test('pending count and destinations reuse the real detail/Home action pipeline', () => {
  const shipments = [
    ship('booking', null, { estado: 'analise_booking' }),
    ship('docs', null, { estado: 'solicitado' }),
    ship('collected', null),
  ];
  const actions = collectHomeActions({
    shipments,
    buckets: {},
    realSteps,
    now,
  });
  const { groups, actionsByShipment } = buildShipmentOverview(
    shipments,
    actions,
    now,
  );
  assert.deepEqual(Array.from(groups.action), ['booking', 'docs']);
  assert.equal(actionsByShipment.get('booking')[0].ctaLabel, 'Aprovar booking');
  assert.ok(
    actionsByShipment
      .get('booking')[0]
      .href.startsWith('/portal/embarques/booking'),
  );
});

test('a future ETA marked actual is still an upcoming arrival', () => {
  const s = ship('future');
  s.tracking.eta_is_actual = true;
  assert.equal(hasArrived(s, now), false);
  const { groups } = buildShipmentOverview([s], [], now);
  assert.equal(groups.upcoming.size, 1);
  assert.equal(groups.delayed.size, 1);
});

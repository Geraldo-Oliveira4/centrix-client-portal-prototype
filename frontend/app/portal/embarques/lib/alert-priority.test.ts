// Unit test for the alert feed ordering. Same runner as delay-risk.test.ts:
//
//     npm run test:unit
//
// It exists because the priority rule is invisible in the common case: with no
// demurrage alert in the feed the order is plain chronological, so a regression
// that silently drops the priority branch looks completely normal on screen.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isPriorityType,
  sortAlertsForFeed,
  PRIORITY_ALERT_TYPES,
} from './alert-priority.ts';

const alert = (id, type, timestamp) => ({
  id,
  type,
  tone: 'success',
  shipmentId: id,
  referencia: id,
  title: id,
  description: '',
  timestamp,
});

const ids = (list) => list.map((a) => a.id);

// An old demurrage alert against newer routine ones — the case the rule exists
// for. Chronological order alone would put it last.
const FEED = [
  alert('novo', 'confirmado', '2026-08-04T10:00:00Z'),
  alert('medio', 'excecao', '2026-08-02T10:00:00Z'),
  alert('liberado', 'demurrage', '2026-07-15T10:00:00Z'),
  alert('antigo', 'confirmado', '2026-07-01T10:00:00Z'),
];

test('demurrage is the only priority type', () => {
  assert.deepEqual([...PRIORITY_ALERT_TYPES], ['demurrage']);
  assert.equal(isPriorityType('demurrage'), true);
  ['confirmado', 'eta', 'excecao'].forEach((t) =>
    assert.equal(isPriorityType(t), false),
  );
});

test('an unread demurrage alert leads the feed despite being the oldest', () => {
  assert.deepEqual(ids(sortAlertsForFeed(FEED, new Set())), [
    'liberado',
    'novo',
    'medio',
    'antigo',
  ]);
});

test('once read it falls back to its chronological slot', () => {
  assert.deepEqual(ids(sortAlertsForFeed(FEED, new Set(['liberado']))), [
    'novo',
    'medio',
    'liberado',
    'antigo',
  ]);
});

test('the other three types never jump the queue, read or unread', () => {
  const routine = FEED.filter((a) => a.type !== 'demurrage');
  const expected = ['novo', 'medio', 'antigo'];
  assert.deepEqual(ids(sortAlertsForFeed(routine, new Set())), expected);
  assert.deepEqual(ids(sortAlertsForFeed(routine, new Set(['novo']))), expected);
});

test('two unread demurrage alerts stay newest-first between themselves', () => {
  const feed = [
    alert('velho', 'demurrage', '2026-07-01T10:00:00Z'),
    alert('recente', 'demurrage', '2026-07-20T10:00:00Z'),
    alert('rotina', 'confirmado', '2026-08-04T10:00:00Z'),
  ];
  assert.deepEqual(ids(sortAlertsForFeed(feed, new Set())), [
    'recente',
    'velho',
    'rotina',
  ]);
});

test('sorting does not mutate the input array', () => {
  const before = ids(FEED);
  sortAlertsForFeed(FEED, new Set());
  assert.deepEqual(ids(FEED), before);
});

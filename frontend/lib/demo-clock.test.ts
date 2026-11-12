import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  addDays,
  daysBetween,
  demoToday,
  isValidDay,
  shiftIso,
} from './demo-clock.ts';

test('?hoje= válido vence o relógio; inválido cai na data local', () => {
  const now = new Date(2026, 10, 12, 9, 0);
  assert.equal(demoToday('?hoje=2026-09-13', now), '2026-09-13');
  assert.equal(demoToday('?hoje=2026-02-30', now), '2026-11-12');
  assert.equal(demoToday('', now), '2026-11-12');
  assert.equal(demoToday(null, now), '2026-11-12');
});

test('aritmética de dias atravessa mês e ano', () => {
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
  assert.equal(daysBetween('2026-09-13', '2026-11-12'), 60);
  assert.equal(isValidDay('2026-13-01'), false);
});

test('shiftIso desloca data e data-hora preservando hora e fuso', () => {
  assert.equal(
    shiftIso('2026-09-10', '2026-09-13', '2026-09-23'),
    '2026-09-20',
  );
  assert.equal(
    shiftIso('2026-09-10T14:00:00-03:00', '2026-09-13', '2026-09-23'),
    '2026-09-20T14:00:00-03:00',
  );
  assert.equal(
    shiftIso('2026-09-10', '2026-09-13', '2026-09-13'),
    '2026-09-10',
  );
  assert.equal(shiftIso('sem data', '2026-09-13', '2026-09-23'), 'sem data');
});

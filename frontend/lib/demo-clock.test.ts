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

test('hojeParam repassa só um ?hoje= válido', async () => {
  const { hojeParam } = await import('./demo-clock.ts');
  assert.equal(hojeParam('?hoje=2026-11-12&x=1'), '&hoje=2026-11-12');
  assert.equal(hojeParam('?hoje=2026-02-30'), '');
  assert.equal(hojeParam(''), '');
});

test('shiftDateText desloca os formatos de texto e preserva o que não é data', async () => {
  const { shiftDateText, shiftFixture } = await import('./demo-clock.ts');
  const base = '2026-09-13';
  const today = '2026-11-12'; // +60 dias
  assert.equal(
    shiftDateText('13/09/2026 às 09:40', base, today),
    '12/11/2026 às 09:40',
  );
  assert.equal(
    shiftDateText('Solicitado em 12/09', base, today),
    'Solicitado em 11/11',
  );
  assert.equal(
    shiftDateText('18 set. → 21 set. · Santos', base, today),
    '17 nov. → 20 nov. · Santos',
  );
  assert.equal(
    shiftDateText('A chegada mudou de 18 para 21 set.', base, today),
    'A chegada mudou de 17 para 20 nov.',
  );
  assert.equal(
    shiftDateText('aprovada em 28 ago. 2026', base, today),
    'aprovada em 27 out. 2026',
  );
  assert.equal(
    shiftDateText('de 28 para 30 set.', base, '2026-09-18'),
    'de 03 para 05 out.',
  );
  assert.equal(
    shiftDateText('de 30 para 2 out.', base, '2026-09-14'),
    'de 01 para 3 out.',
  );
  assert.equal(
    shiftDateText('PO-2026-1183 · 1 × 40 HC · R$ 1.200', base, today),
    'PO-2026-1183 · 1 × 40 HC · R$ 1.200',
  );
  assert.equal(shiftDateText('13/09', base, base), '13/09');
  const fixture = shiftFixture(
    { id: '2026-09-13', eta: '2026-09-21', note: 'Até 14 set.' },
    base,
    today,
  );
  assert.deepEqual(fixture, {
    id: '2026-09-13',
    eta: '2026-11-20',
    note: 'Até 13 nov.',
  });
});

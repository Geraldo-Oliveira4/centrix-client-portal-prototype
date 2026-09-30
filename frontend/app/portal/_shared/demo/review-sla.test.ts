import { test } from 'node:test';
import assert from 'node:assert/strict';

import { REVIEW_SLA, reviewDueAt, reviewSlaLabel } from './review-sla.ts';

test('o prazo vigente é 1 hora corrida (decisão do Orsi, 29/09)', () => {
  assert.deepEqual(REVIEW_SLA, { hours: 1, clock: 'corrido' });
  assert.equal(reviewSlaLabel(), 'até 1 hora');
});

test('o rótulo concorda em número e diz quando a hora é útil', () => {
  assert.equal(reviewSlaLabel({ hours: 2, clock: 'corrido' }), 'até 2 horas');
  assert.equal(reviewSlaLabel({ hours: 1, clock: 'util' }), 'até 1 hora útil');
  assert.equal(
    reviewSlaLabel({ hours: 4, clock: 'util' }),
    'até 4 horas úteis',
  );
});

test('em horário corrido o vencimento é a entrada mais o prazo', () => {
  const due = reviewDueAt('2026-09-30T10:15:00.000Z');
  assert.equal(due?.toISOString(), '2026-09-30T11:15:00.000Z');
});

test('horário útil e data inválida não inventam um vencimento', () => {
  assert.equal(
    reviewDueAt('2026-09-30T10:15:00.000Z', { hours: 1, clock: 'util' }),
    null,
  );
  assert.equal(reviewDueAt('ontem'), null);
});

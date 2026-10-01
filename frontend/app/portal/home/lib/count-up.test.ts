import { test } from 'node:test';
import assert from 'node:assert/strict';

import { easeOutCubic, formatCountable, parseCountable } from './count-up.ts';

test('só número puro entra na contagem', () => {
  assert.deepEqual(parseCountable('12'), {
    prefix: '',
    value: 12,
    decimals: 0,
    suffix: '',
  });
  assert.deepEqual(parseCountable('R$ 1.270,00'), {
    prefix: 'R$ ',
    value: 1270,
    decimals: 2,
    suffix: '',
  });
  assert.equal(parseCountable('35%')?.value, 35);
  assert.equal(parseCountable('Chega em 3 dias'), null);
  assert.equal(parseCountable('0'), null, 'zero não tem o que contar');
  assert.equal(parseCountable('R$ 0,00'), null);
  assert.equal(parseCountable('2026'), null, 'ano sozinho não é contagem');
});

test('o fim da contagem reproduz o texto original', () => {
  for (const text of ['12', 'R$ 1.270,00', '35%', 'R$ 15.300,00', '7']) {
    const c = parseCountable(text)!;
    assert.equal(formatCountable(c, c.value), text);
  }
});

test('a curva vai de 0 a 1 e satura', () => {
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  assert.equal(easeOutCubic(2), 1);
  assert.ok(easeOutCubic(0.5) > 0.5);
});

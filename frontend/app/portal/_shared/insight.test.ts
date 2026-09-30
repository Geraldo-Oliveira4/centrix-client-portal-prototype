import { test } from 'node:test';
import assert from 'node:assert/strict';

import { variationOf } from './insight.ts';

const pp = {
  kind: 'pp' as const,
  higherIsBetter: true,
  previousLabel: 'o mês passado',
};
const pct = {
  kind: 'pct' as const,
  higherIsBetter: true,
  previousLabel: 'o mês passado',
};

test('taxa varia em pontos, com o lado bom certo', () => {
  assert.deepEqual(variationOf(70, 55, pp), {
    delta: 15,
    direction: 'up',
    tone: 'good',
    text: '15 pontos acima do mês passado',
  });
  assert.equal(variationOf(40, 45, pp)?.tone, 'bad');
  assert.equal(variationOf(41, 40, pp)?.text, '1 ponto acima do mês passado');
});

test('valor varia em %, e a mesma conta do iframe da Inteligência', () => {
  assert.equal(
    variationOf(11700, 13500, { ...pct, higherIsBetter: null })?.text,
    '13% abaixo do mês passado',
  );
  assert.equal(
    variationOf(11700, 13500, { ...pct, higherIsBetter: null })?.tone,
    'neutral',
  );
});

test('KPI comercial em queda não fica vermelho', () => {
  assert.equal(
    variationOf(80, 100, { ...pct, badTone: 'neutral' })?.tone,
    'neutral',
  );
  assert.equal(
    variationOf(120, 100, { ...pct, badTone: 'neutral' })?.tone,
    'good',
  );
});

test('sem os dois lados, ou com base zero, não há variação', () => {
  assert.equal(variationOf(null, 10, pp), null);
  assert.equal(variationOf(10, undefined, pp), null);
  assert.equal(variationOf(10, 0, pct), null);
  assert.equal(variationOf(10, 10, pp)?.tone, 'neutral');
  assert.equal(variationOf(10, 10, pp)?.text, 'igual ao mês passado');
});

test('rótulo sem artigo usa a preposição simples', () => {
  assert.equal(
    variationOf(80, 65, { ...pp, previousLabel: 'julho' })?.text,
    '15 pontos acima de julho',
  );
});

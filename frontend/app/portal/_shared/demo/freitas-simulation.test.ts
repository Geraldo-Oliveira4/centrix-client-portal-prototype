// Unit test dos ajustes do analista simulado. Mesmo runner dos outros libs:
//
//     npm run test:unit
//
// O QUE ERRA EM SILENCIO AQUI: um tempo de resposta fora da janela. Abaixo de
// tres segundos a resposta chega antes de quem assiste terminar de ler o que
// acabou de ser enviado, e a demonstracao deixa de mostrar que houve uma troca;
// acima de um minuto ninguem numa reuniao espera. E o clamp acontece na leitura
// tambem, nao so na escrita: o valor no disco pode ter sido gravado por uma
// versao anterior, com outra janela.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_FREITAS_DELAY_SECONDS,
  DEFAULT_FREITAS_SIMULATION,
  MAX_FREITAS_DELAY_SECONDS,
  MIN_FREITAS_DELAY_SECONDS,
  clampFreitasDelay,
  normalizeFreitasSimulation,
  parseFreitasSimulation,
} from './freitas-simulation.ts';

test('o padrao e desligado, em 8 segundos', () => {
  assert.deepEqual(DEFAULT_FREITAS_SIMULATION, {
    autoRespond: false,
    delaySeconds: 8,
  });
  assert.equal(DEFAULT_FREITAS_DELAY_SECONDS, 8);
  assert.ok(DEFAULT_FREITAS_DELAY_SECONDS >= MIN_FREITAS_DELAY_SECONDS);
  assert.ok(DEFAULT_FREITAS_DELAY_SECONDS <= MAX_FREITAS_DELAY_SECONDS);
});

test('o clamp prende nas duas pontas e arredonda', () => {
  assert.equal(clampFreitasDelay(0), MIN_FREITAS_DELAY_SECONDS);
  assert.equal(clampFreitasDelay(-40), MIN_FREITAS_DELAY_SECONDS);
  assert.equal(clampFreitasDelay(3), 3);
  assert.equal(clampFreitasDelay(12.4), 12);
  assert.equal(clampFreitasDelay(60), 60);
  assert.equal(clampFreitasDelay(3600), MAX_FREITAS_DELAY_SECONDS);
});

test('numero que nao e numero volta ao padrao', () => {
  assert.equal(clampFreitasDelay(Number.NaN), DEFAULT_FREITAS_DELAY_SECONDS);
  assert.equal(
    clampFreitasDelay(Number.POSITIVE_INFINITY),
    DEFAULT_FREITAS_DELAY_SECONDS,
  );
});

test('a leitura tambem prende: valor fora da janela no disco e corrigido', () => {
  assert.deepEqual(
    parseFreitasSimulation('{"autoRespond":true,"delaySeconds":900}'),
    { autoRespond: true, delaySeconds: MAX_FREITAS_DELAY_SECONDS },
  );
});

test('campo de tipo errado nao liga o analista de volta', () => {
  assert.deepEqual(normalizeFreitasSimulation({ delaySeconds: 'rapido' }), {
    autoRespond: false,
    delaySeconds: DEFAULT_FREITAS_DELAY_SECONDS,
  });
});

test('ausente ou corrompido e o estado de fabrica', () => {
  assert.deepEqual(parseFreitasSimulation(null), DEFAULT_FREITAS_SIMULATION);
  assert.deepEqual(
    parseFreitasSimulation('{nao e json'),
    DEFAULT_FREITAS_SIMULATION,
  );
  assert.deepEqual(parseFreitasSimulation('[]'), DEFAULT_FREITAS_SIMULATION);
});

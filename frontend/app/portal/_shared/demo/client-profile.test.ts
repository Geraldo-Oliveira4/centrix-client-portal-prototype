import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_MODULE_FLAGS } from './feature-flags.ts';
import {
  effectiveClientKind,
  effectiveFlags,
  parseClientKind,
  parseViewingAs,
} from './client-profile.ts';

test('seletor do painel: ausente ou lixo vira "com operação Freitas"', () => {
  assert.equal(parseClientKind(null), 'freitas');
  assert.equal(parseClientKind('"saas"'), 'saas');
  assert.equal(parseClientKind('nao-json'), 'freitas');
  assert.equal(parseClientKind('"outro"'), 'freitas');
});

test('SaaS puro funciona só pelo seletor, sem "ver como"', () => {
  assert.equal(effectiveClientKind('saas', null), 'saas');
  assert.deepEqual(
    effectiveFlags(DEFAULT_MODULE_FLAGS, null),
    DEFAULT_MODULE_FLAGS,
  );
});

test('"ver como" ativo manda no tipo e nos módulos', () => {
  const viewing = parseViewingAs(
    JSON.stringify({
      id: 'e1',
      name: 'Empresa',
      kind: 'freitas',
      exceptions: { radar: false, x: 'lixo' },
    }),
  )!;
  assert.equal(effectiveClientKind('saas', viewing), 'freitas');
  assert.equal(effectiveFlags(DEFAULT_MODULE_FLAGS, viewing).radar, false);
  assert.equal(effectiveFlags(DEFAULT_MODULE_FLAGS, viewing).cotacao, true);
});

test('retrato antigo (só o id, formato anterior) é descartado', () => {
  assert.equal(parseViewingAs('"emp-aurora"'), null);
  assert.equal(parseViewingAs('{"id":""}'), null);
});

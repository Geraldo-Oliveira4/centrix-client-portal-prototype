import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CLIENT_KIND_LABELS, parseClientKind } from './client-profile.ts';

test('seletor do painel: ausente ou lixo vira "com operação Freitas"', () => {
  assert.equal(parseClientKind(null), 'freitas');
  assert.equal(parseClientKind('"saas"'), 'saas');
  assert.equal(parseClientKind('nao-json'), 'freitas');
  assert.equal(parseClientKind('"outro"'), 'freitas');
});

test('os dois tipos têm rótulo', () => {
  assert.deepEqual(Object.keys(CLIENT_KIND_LABELS), ['freitas', 'saas']);
});

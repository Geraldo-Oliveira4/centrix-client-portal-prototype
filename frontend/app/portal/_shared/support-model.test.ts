import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseSequence,
  protocolFor,
  reportIssue,
  screenName,
} from './support-model.ts';

test('protocolo sequencial com quatro dígitos', () => {
  assert.equal(protocolFor(7, 2026), 'BUG-2026-0007');
  assert.equal(protocolFor(0, 2026), 'BUG-2026-0001');
});

test('sequência gravada inválida recomeça do zero', () => {
  assert.equal(parseSequence(null), 0);
  assert.equal(parseSequence('3'), 3);
  assert.equal(parseSequence('"lixo"'), 0);
  assert.equal(parseSequence('-2'), 0);
});

test('a tela atual vem preenchida pelo prefixo mais específico', () => {
  assert.equal(
    screenName('/portal/cotacoes'),
    'Minhas Cotações (/portal/cotacoes)',
  );
  assert.equal(
    screenName('/portal/cotacao/abc'),
    'Detalhe da cotação (/portal/cotacao/abc)',
  );
  assert.equal(
    screenName('/portal/embarques/novo'),
    'Novo embarque (/portal/embarques/novo)',
  );
  assert.equal(screenName('/portal/desconhecida'), '/portal/desconhecida');
});

test('o relato pede o mínimo e diz quanto falta', () => {
  assert.match(reportIssue('') ?? '', /Conte/);
  assert.match(reportIssue('erro') ?? '', /Faltam 6 caracteres/);
  assert.equal(reportIssue('O botão de enviar não responde'), null);
});

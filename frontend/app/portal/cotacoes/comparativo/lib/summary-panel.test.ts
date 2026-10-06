import test from 'node:test';
import assert from 'node:assert/strict';

import { SUMMARY_OPEN_MIN_WIDTH, parseSummaryOpen, summaryOpen } from './summary-panel.ts';

test('sem escolha gravada: recolhido abaixo de 1536px, aberto a partir dele', () => {
  assert.equal(SUMMARY_OPEN_MIN_WIDTH, 1536);
  assert.equal(summaryOpen(null, 1440), false);
  assert.equal(summaryOpen(null, 390), false);
  assert.equal(summaryOpen(null, 1536), true);
  assert.equal(summaryOpen(null, 1920), true);
});

test('a escolha do cliente vence a largura', () => {
  assert.equal(summaryOpen(true, 390), true);
  assert.equal(summaryOpen(false, 1920), false);
});

test('valor gravado inválido ou corrompido conta como "nunca escolheu"', () => {
  assert.equal(parseSummaryOpen(null), null);
  assert.equal(parseSummaryOpen('true'), true);
  assert.equal(parseSummaryOpen('false'), false);
  assert.equal(parseSummaryOpen('"sim"'), null);
  assert.equal(parseSummaryOpen('{x'), null);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('./intel-folds.js');

// A2 (17/11/2026): recolher "Evolução" recolhia também "Performance". Cada
// dobra tem a própria chave; os quatro estados (aberta/recolhida de cada uma).
test('padrão: Evolução e Performance abertas, Compromissos recolhido', () => {
  assert.deepEqual(F.defaults(), { evo: true, perf: true, commitments: false });
});
test('recolher Evolução não recolhe Performance', () => {
  const s = F.setOpen(F.defaults(), 'evo', false);
  assert.equal(F.isOpen(s, 'evo'), false);
  assert.equal(F.isOpen(s, 'perf'), true);
});
test('recolher Performance não recolhe Evolução', () => {
  const s = F.setOpen(F.defaults(), 'perf', false);
  assert.equal(F.isOpen(s, 'perf'), false);
  assert.equal(F.isOpen(s, 'evo'), true);
});
test('expandir Evolução de novo não mexe em Performance recolhida', () => {
  let s = F.setOpen(F.defaults(), 'perf', false);
  s = F.setOpen(F.setOpen(s, 'evo', false), 'evo', true);
  assert.equal(F.isOpen(s, 'evo'), true);
  assert.equal(F.isOpen(s, 'perf'), false);
});
test('Compromissos é independente das dobras da Visão geral', () => {
  const s = F.setOpen(F.defaults(), 'commitments', true);
  assert.deepEqual(s, { evo: true, perf: true, commitments: true });
});
test('id desconhecido não muda o estado', () => {
  assert.deepEqual(F.setOpen(F.defaults(), 'outra', false), F.defaults());
});

const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('./intel-folds.js');

// A2 (17/11/2026): recolher "Evolução" recolhia também "Performance". Cada
// dobra tem a própria chave; os quatro estados (aberta/recolhida de cada uma).
// B3 (17/11/2026): na Visão geral, EXPANDIR uma recolhe a outra (acordeão).
const both = { evo: true, perf: true, commitments: false };
test('padrão: Evolução aberta; Performance e Compromissos recolhidos (uma aberta por vez)', () => {
  assert.deepEqual(F.defaults(), { evo: true, perf: false, commitments: false });
});
test('recolher Evolução não recolhe Performance', () => {
  const s = F.setOpen(both, 'evo', false);
  assert.equal(F.isOpen(s, 'evo'), false);
  assert.equal(F.isOpen(s, 'perf'), true);
});
test('recolher Performance não recolhe Evolução', () => {
  const s = F.setOpen(both, 'perf', false);
  assert.equal(F.isOpen(s, 'perf'), false);
  assert.equal(F.isOpen(s, 'evo'), true);
});
test('expandir Performance recolhe Evolução (acordeão)', () => {
  const s = F.setOpen(F.defaults(), 'perf', true);
  assert.deepEqual([F.isOpen(s, 'evo'), F.isOpen(s, 'perf')], [false, true]);
  assert.deepEqual(F.closedBy('perf'), ['evo']);
});
test('expandir Evolução recolhe Performance (acordeão)', () => {
  const s = F.setOpen(F.setOpen(F.defaults(), 'perf', true), 'evo', true);
  assert.deepEqual([F.isOpen(s, 'evo'), F.isOpen(s, 'perf')], [true, false]);
});
test('recolher não abre ninguém: as duas podem ficar recolhidas', () => {
  const s = F.setOpen(F.defaults(), 'evo', false);
  assert.deepEqual([F.isOpen(s, 'evo'), F.isOpen(s, 'perf')], [false, false]);
});
test('Compromissos é independente do acordeão da Visão geral', () => {
  const s = F.setOpen(F.defaults(), 'commitments', true);
  assert.deepEqual(s, { evo: true, perf: false, commitments: true });
  assert.deepEqual(F.closedBy('commitments'), []);
});
test('id desconhecido não muda o estado', () => {
  assert.deepEqual(F.setOpen(F.defaults(), 'outra', false), F.defaults());
});

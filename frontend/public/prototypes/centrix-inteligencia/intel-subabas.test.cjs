'use strict';
// Subabas v2 (Agentes de carga, Exportadores, Rotas): base primeiro, fato do
// recorte, contexto de rota, cruzamentos entre fichas. Tudo sobre a fixture.
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('./data.js');
const E = require('./intel-engine.js');
const T = require('./intel-tabs.js');
const S = require('./intel-sim.js');

// O recorte padrão da tela: últimos 90 dias até o corte (a data-base da fixture, no Node).
const range = { start: S.addDays(D.cutoff, -89), end: D.cutoff };
const cur = E.inRange(D.operations, range);
const rate = (good, base) => ({ rate: base ? Math.round((good / base) * 100) : null, good, base });
const row = (id, n, port) => ({ id, name: id, n, port, ready: rate(0, 0), docs: rate(0, 0), final: rate(0, 0), audit: rate(0, 0) });

test('item 1: coluna de taxa ordena pelo percentual e desempata pela base maior', () => {
  const rows = [row('um-de-um', 9, rate(1, 1)), row('quatro-de-quatro', 2, rate(4, 4)), row('tres-de-quatro', 5, rate(3, 4)), row('sem-base', 7, rate(0, 0))];
  // 100% empata: 4 de 4 vem antes de 1 de 1, mesmo com menos embarques.
  assert.deepEqual(T.sortRows(rows, { key: 'port', dir: 'desc' }).map((r) => r.id), ['quatro-de-quatro', 'um-de-um', 'tres-de-quatro', 'sem-base']);
  // No sentido crescente o empate continua favorecendo a base maior, e "sem registro" continua no fim.
  assert.deepEqual(T.sortRows(rows, { key: 'port', dir: 'asc' }).map((r) => r.id), ['tres-de-quatro', 'quatro-de-quatro', 'um-de-um', 'sem-base']);
  // A ordem padrão (volume) não muda.
  assert.deepEqual(T.sortRows(rows).map((r) => r.id), ['um-de-um', 'sem-base', 'tres-de-quatro', 'quatro-de-quatro']);
});

test('item 1: as colunas de taxa das três subabas estão cobertas pelo desempate', () => {
  for (const dim of ['exp', 'ag', 'rota']) {
    const r = T.entityRows(D, cur, dim)[0];
    for (const [key] of T.COLUMNS[dim]) if (r[key] && typeof r[key] === 'object' && 'base' in r[key]) assert.ok(T.RATE_KEYS.includes(key), `${dim}.${key}`);
  }
});

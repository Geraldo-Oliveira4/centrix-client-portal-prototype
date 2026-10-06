import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import {
  DEFAULT_BLOCK_ORDER,
  DEFAULT_INTEL_VIEW_ID,
  DEFAULT_INTEL_VIEW_NAME,
  INTEL_ROUTE_BY_PAIR,
  blockOrderFor,
  buildDefaultIntelView,
  parseIntelViews,
  routeFilterValue,
  upsertDefaultView,
} from './onboarding-intel.ts';

const require = createRequire(import.meta.url);
const D = require('../../../public/prototypes/centrix-inteligencia/data.js');
const L = require('../../../public/prototypes/centrix-inteligencia/intel-layout.js');
const E = require('../../../public/prototypes/centrix-inteligencia/intel-engine.js');

const rotaQuery = (query: string) => new URLSearchParams(query).get('rota')?.split(',') ?? [];

test('mapa de rotas confere com a fixture da Inteligência (mesmos portos)', () => {
  for (const [pair, id] of Object.entries(INTEL_ROUTE_BY_PAIR)) {
    const [from, to] = pair.split('>');
    const r = D.routes.find((x: { id: string }) => x.id === id);
    assert.ok(r, `rota ${id} existe`);
    assert.equal(D.locations[r.from].code, from);
    assert.equal(D.locations[r.to].code, to);
  }
});

test('rotas viram UM filtro de rota (OU dentro do filtro); prioridade só ordena', () => {
  const view = buildDefaultIntelView(
    [
      { origin: 'CNSHA', destination: 'BRSSZ' },
      { origin: 'CNNGB', destination: 'BRITJ' },
    ],
    'custo',
  );
  assert.equal(view.id, DEFAULT_INTEL_VIEW_ID);
  assert.equal(view.name, DEFAULT_INTEL_VIEW_NAME);
  assert.deepEqual(rotaQuery(view.query), ['shanghai', 'ningbo']);
  assert.deepEqual(view.hidden, { completa: [], objetiva: [] });
  assert.equal(view.mode, 'completa');
  // O motor da Inteligência aplica exatamente esse filtro.
  const ops = E.applyFilters(D.operations, E.readFilters(new URLSearchParams(view.query)));
  assert.ok(ops.length > 0);
  assert.ok(ops.every((o: { route: string }) => ['shanghai', 'ningbo'].includes(o.route)));
});

test('prioridade define o que aparece primeiro, sem esconder nada', () => {
  assert.deepEqual(blockOrderFor('custo').completa.slice(0, 2), ['graficos', 'precos']);
  assert.equal(blockOrderFor('custo').objetiva[0], 'q_frete');
  assert.deepEqual(blockOrderFor('prazo').completa.slice(0, 2), ['destaque', 'funil']);
  assert.equal(blockOrderFor('prazo').objetiva[0], 'q_prazo');
  assert.equal(blockOrderFor('visibilidade').completa[0], 'kpis');
  assert.equal(blockOrderFor('visibilidade').objetiva[1], 'q_perda');
  assert.deepEqual(blockOrderFor(''), DEFAULT_BLOCK_ORDER);
  for (const p of ['custo', 'prazo', 'visibilidade'] as const) {
    const o = blockOrderFor(p);
    assert.deepEqual([...o.completa].sort(), [...DEFAULT_BLOCK_ORDER.completa].sort());
    assert.deepEqual([...o.objetiva].sort(), [...DEFAULT_BLOCK_ORDER.objetiva].sort());
  }
});

test('a ordem gerada é a que a Inteligência desenha ao abrir a visão', () => {
  const view = buildDefaultIntelView([{ origin: 'CNSHA', destination: 'BRSSZ' }], 'custo');
  const { layout } = L.restoreView(view);
  assert.deepEqual(L.visibleBlocks(layout), view.order.completa);
  // Nossa ordem padrão é a mesma da Inteligência.
  assert.deepEqual(DEFAULT_BLOCK_ORDER.completa, L.BLOCKS.completa.map((b: { id: string }) => b.id));
  assert.deepEqual(DEFAULT_BLOCK_ORDER.objetiva, L.BLOCKS.objetiva.map((b: { id: string }) => b.id));
});

test('rota sem embarques na fixture entra no filtro e leva ao estado "0 no recorte"', () => {
  assert.equal(routeFilterValue({ origin: 'FRA', destination: 'GRU' }), 'Frankfurt>Guarulhos');
  const view = buildDefaultIntelView([{ origin: 'FRA', destination: 'GRU' }], 'prazo');
  const ops = E.applyFilters(D.operations, E.readFilters(new URLSearchParams(view.query)));
  assert.equal(ops.length, 0);
});

test('sem rota, a visão não filtra nada; rota repetida entra uma vez', () => {
  assert.equal(buildDefaultIntelView([], '').query, '');
  const dup = buildDefaultIntelView(
    [
      { origin: 'CNSHA', destination: 'BRSSZ' },
      { origin: 'CNSHA', destination: 'BRSSZ' },
    ],
    '',
  );
  assert.deepEqual(rotaQuery(dup.query), ['shanghai']);
});

test('refazer recria "Minha operação" sem tocar nas visões do cliente', () => {
  const mine = { id: 'v1', name: 'Só Hamburgo', query: 'rota=hamburgo' };
  const first = upsertDefaultView([mine], buildDefaultIntelView([{ origin: 'CNSHA', destination: 'BRSSZ' }], 'custo'));
  assert.deepEqual(first.map((v) => v.id), [DEFAULT_INTEL_VIEW_ID, 'v1']);
  const redo = upsertDefaultView(first, buildDefaultIntelView([{ origin: 'DEHAM', destination: 'BRITJ' }], 'prazo'));
  assert.deepEqual(redo.map((v) => v.id), [DEFAULT_INTEL_VIEW_ID, 'v1']);
  assert.deepEqual(rotaQuery(redo[0].query as string), ['hamburgo']);
  assert.equal(parseIntelViews('lixo').length, 0);
  assert.equal(parseIntelViews(JSON.stringify([mine, { semId: true }])).length, 1);
});

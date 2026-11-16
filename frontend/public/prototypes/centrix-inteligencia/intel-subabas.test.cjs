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

// ------------------------------------------------------------------ item 2 ---
const JUDGE = /melhor|pior|lidera|ranking|\bnota\b|recomend|\bbom\b|\bruim\b|vence|destaque|pre[çc]o/i;
const named = (name, port, extra = {}) => ({ id: name, name, n: 5, port, ready: rate(0, 0), docs: rate(0, 0), ...extra });

test('item 2: intervalo com a base de cada ponta', () => {
  const rows = [named('Alpha', rate(4, 7)), named('Gamma', rate(4, 5)), named('Delta', rate(3, 4))];
  const r = T.rateRange(rows, 'port');
  assert.deepEqual(r.min, { id: 'Alpha', name: 'Alpha', rate: 57, good: 4, base: 7 });
  assert.deepEqual(r.max, { id: 'Gamma', name: 'Gamma', rate: 80, good: 4, base: 5 });
  assert.equal(T.recortFact('ag', rows).text, 'Chegada ao destino no prazo vai de 57% (Alpha, 4 de 7) a 80% (Gamma, 4 de 5) entre os agentes com base de 3 ou mais.');
  assert.equal(T.recortFact('rota', rows).text, 'Chegada ao destino no prazo vai de 57% (Alpha, 4 de 7) a 80% (Gamma, 4 de 5) entre as rotas com base de 3 ou mais.');
});

test('item 2: base da MÉTRICA menor que 3 fica fora, mesmo com muitos embarques', () => {
  const rows = [named('Alpha', rate(4, 7)), named('Gamma', rate(4, 5)), { ...named('Beta', rate(0, 2)), n: 40 }, { ...named('Zeta', rate(2, 2)), n: 40 }];
  const r = T.rateRange(rows, 'port');
  assert.equal(r.count, 2);
  assert.equal(r.min.name, 'Alpha');
  assert.equal(r.max.name, 'Gamma');
  assert.ok(!/Beta|Zeta/.test(T.recortFact('ag', rows).text));
});

test('item 2: empate nas pontas fica com a base maior; taxa igual em todos não vira intervalo falso', () => {
  const tied = [named('Pequeno', rate(3, 4)), named('Grande', rate(6, 8)), named('Topo', rate(5, 5))];
  assert.equal(T.rateRange(tied, 'port').min.name, 'Grande');
  const flat = [named('A', rate(3, 4)), named('B', rate(6, 8))];
  assert.equal(T.rateRange(flat, 'port').flat, true);
  assert.equal(T.recortFact('ag', flat).text, 'Chegada ao destino no prazo é de 75% em ambos entre os agentes com base de 3 ou mais.');
  assert.equal(T.recortFact('rota', [...flat, named('C', rate(9, 12))]).text, 'Chegada ao destino no prazo é de 75% em todas entre as rotas com base de 3 ou mais.');
});

test('item 2: um só item com base, ou nenhum, mostra a frase neutra', () => {
  assert.equal(T.rateRange([named('Só', rate(4, 7)), named('Beta', rate(1, 2))], 'port'), null);
  assert.equal(T.recortFact('ag', [named('Só', rate(4, 7)), named('Beta', rate(1, 2))]).text, 'Poucos itens com base de 3 ou mais neste recorte.');
  assert.equal(T.recortFact('exp', []).text, T.FACT_EMPTY);
  assert.equal(T.recortFact('rota', [named('X', rate(0, 0))]).text, T.FACT_EMPTY);
});

test('item 2: exportadores juntam Prontidão e Documentação; com uma só métrica, só ela', () => {
  const both = [named('East', rate(0, 0), { ready: rate(5, 6), docs: rate(6, 7) }), named('Yang', rate(0, 0), { ready: rate(7, 7), docs: rate(4, 7) })];
  assert.equal(T.recortFact('exp', both).text, 'Prontidão no prazo vai de 83% (East, 5 de 6) a 100% (Yang, 7 de 7) e Documentação sem correção, de 57% (Yang, 4 de 7) a 86% (East, 6 de 7), entre os exportadores com base de 3 ou mais.');
  const one = both.map((r) => ({ ...r, docs: rate(1, 2) }));
  assert.equal(T.recortFact('exp', one).text, 'Prontidão no prazo vai de 83% (East, 5 de 6) a 100% (Yang, 7 de 7) entre os exportadores com base de 3 ou mais.');
});

test('item 2: na fixture, as três frases são calculadas, sem palavra de julgamento e só com base de 3 ou mais', () => {
  for (const dim of ['ag', 'exp', 'rota']) {
    const rows = T.entityRows(D, cur, dim), f = T.recortFact(dim, rows);
    assert.ok(f.ranges.length >= 1, dim);
    assert.doesNotMatch(f.text, JUDGE);
    for (const r of f.ranges) for (const e of [r.min, r.max]) {
      assert.ok(e.base >= 3);
      const src = rows.find((x) => x.id === e.id)[r.key];
      assert.deepEqual([e.rate, e.good, e.base], [src.rate, src.good, src.base]);
      assert.ok(f.text.includes(`${e.rate}% (${e.name}, ${e.good} de ${e.base})`));
    }
  }
  assert.equal(T.recortFact('ag', T.entityRows(D, cur, 'ag')).text, 'Chegada ao destino no prazo vai de 57% (Alpha Logistics, 4 de 7) a 80% (Gamma Freight, 4 de 5) entre os agentes com base de 3 ou mais.');
});

test('item 2: a frase responde ao recorte (filtro muda o texto; recorte vazio cai na frase neutra)', () => {
  const full = T.recortFact('ag', T.entityRows(D, cur, 'ag')).text;
  const one = E.applyFilters(cur, { rota: ['shanghai'] });
  assert.notEqual(T.recortFact('ag', T.entityRows(D, one, 'ag')).text, full);
  assert.equal(T.recortFact('ag', T.entityRows(D, [], 'ag')).text, T.FACT_EMPTY);
});

test('item 2: a linha de concentração preserva o que os três cartões diziam', () => {
  assert.equal(T.concentrationLine('ag', T.entityRows(D, cur, 'ag'), cur.length), '4 agentes · 26 embarques · maior participação 35% (Alpha Logistics, 9 de 26) · os 2 maiores somam 62%');
  assert.match(T.concentrationLine('exp', T.entityRows(D, cur, 'exp'), cur.length), /^5 exportadores · 26 embarques · maior participação 27% \(.+, 7 de 26\) · os 2 maiores somam 54%/);
  assert.match(T.concentrationLine('rota', T.entityRows(D, cur, 'rota'), cur.length), /^5 rotas · 26 embarques · maior participação 35% \(Shanghai → Santos, 9 de 26\) · os 2 maiores somam 54%$/);
  assert.equal(T.concentrationLine('ag', [named('Só', rate(1, 1))].map((r) => ({ ...r, n: 1, share: 100, small: true })), 1), '1 agente · 1 embarque · maior participação 100% (Só, 1 de 1) · 1 com amostra pequena (menos de 3 embarques)');
});

// ------------------------------------------------------------- reconciliação ---
// Os totais do recorte padrão NÃO mudam com as subabas v2 (regra do pedido).
const TOTALS = {
  ag: { alpha: 9, gamma: 7, delta: 6, beta: 4 },
  rota: { shanghai: 9, ningbo: 5, genova: 4, hamburgo: 4, newyork: 4 },
  exp: { east: 7, yang: 7, nord: 4, lig: 4, hud: 4 },
};
const sumBy = (rows, key) => rows.reduce((m, r) => { m[r[key]] = (m[r[key]] || 0) + r.n; return m; }, {});

test('reconciliação: embarques por agente, rota e exportador são os de sempre e somam 26', () => {
  assert.equal(cur.length, 26);
  for (const dim of ['ag', 'rota', 'exp']) {
    const got = Object.fromEntries(T.entityRows(D, cur, dim).map((r) => [r.id, r.n]));
    assert.deepEqual(got, TOTALS[dim], dim);
    assert.equal(Object.values(got).reduce((a, b) => a + b, 0), 26);
  }
});

test('reconciliação: os cruzamentos das fichas somam os mesmos totais', () => {
  const pairs = T.pairStats(D, cur);
  assert.deepEqual(sumBy(pairs, 'agent'), TOTALS.ag);
  assert.deepEqual(sumBy(pairs, 'route'), TOTALS.rota);
  for (const id of Object.keys(TOTALS.ag)) assert.equal(T.agentRouteContext(D, cur, id).reduce((n, r) => n + r.n, 0), TOTALS.ag[id]);
  for (const id of Object.keys(TOTALS.rota)) assert.equal(T.routeAgents(D, cur, id).reduce((n, r) => n + r.n, 0), TOTALS.rota[id]);
});

// ------------------------------------------------------------------ item 3 ---
test('item 3: trânsito por rota do agente: mediana do agente, da rota e diferença', () => {
  const beta = T.agentRouteContext(D, cur, 'beta');
  assert.deepEqual(beta.map((r) => r.route), ['shanghai']); // o Beta Cargo só opera Shanghai → Santos
  for (const id of Object.keys(TOTALS.ag)) {
    const rows = T.agentRouteContext(D, cur, id);
    assert.equal(rows.length, T.entityRows(D, cur, 'ag').find((r) => r.id === id).routes);
    for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].n >= rows[i].n, 'ordem por embarques do agente');
    for (const r of rows) {
      const mine = cur.filter((o) => o.route === r.route && o.agent === id), all = cur.filter((o) => o.route === r.route);
      assert.equal(r.transitMedian, T.median(T.transitDays(D, mine)));
      assert.equal(r.routeMedian, T.median(T.transitDays(D, all)));
      assert.equal(r.routeN, T.transitDays(D, all).length);
      assert.equal(r.small, r.transitN < 3);
      if (r.transitMedian != null) assert.equal(r.diff, Math.round((r.transitMedian - r.routeMedian) * 10) / 10);
      else assert.equal(r.diff, null);
    }
  }
});

test('item 3: as duas fichas dizem o mesmo número para o mesmo par', () => {
  for (const agent of Object.keys(TOTALS.ag)) for (const a of T.agentRouteContext(D, cur, agent)) {
    const b = T.routeAgents(D, cur, a.route).find((r) => r.agent === agent);
    assert.deepEqual([b.n, b.transitMedian, b.transitN, b.port], [a.n, a.transitMedian, a.transitN, a.port]);
  }
  // Agente de uma rota só: o trânsito da rota na ficha é o trânsito mediano da linha dele na tabela.
  const row = T.entityRows(D, cur, 'ag').find((r) => r.id === 'beta'), ctx = T.agentRouteContext(D, cur, 'beta')[0];
  assert.deepEqual([ctx.transitMedian, ctx.transitN], [row.transitMedian, row.transitN]);
});

test('item 3: mesma conta do Simulador (mesmo par, mesma mediana, mesmo N) sobre os mesmos embarques', () => {
  for (const ops of [cur, D.operations]) {
    const sim = S.simulate(D, ops, {}).rows, pairs = T.pairStats(D, ops);
    assert.equal(sim.length, pairs.length);
    for (const p of pairs) {
      const r = sim.find((x) => x.route === p.route && x.agent === p.agent);
      assert.equal(r.n, p.transitN);
      assert.equal(r.shipments, p.n);
      assert.equal(r.small, p.small);
      if (!r.small) assert.equal(r.median, p.transitMedian);
    }
  }
});

// ------------------------------------------------------------------ item 4 ---
test('item 4: grupos de Exportadores cobrem colunas vizinhas e deixam identidade e volume de fora', () => {
  const keys = T.COLUMNS.exp.map(([k]) => k), groups = T.COLUMN_GROUPS.exp;
  assert.deepEqual(groups.map((g) => g.label), ['Depende do exportador', 'Resultado da operação']);
  assert.deepEqual(groups[0].keys, ['ready', 'docs']);
  assert.deepEqual(groups[1].keys, ['port', 'freightAvg']);
  for (const g of groups) { const i = keys.indexOf(g.keys[0]); assert.ok(i >= 0); assert.deepEqual(keys.slice(i, i + g.keys.length), g.keys); }
  const grouped = groups.flatMap((g) => g.keys);
  assert.deepEqual(keys.filter((k) => !grouped.includes(k)), ['name', 'country', 'n']);
  assert.match(groups[1].tip, /Um desvio sozinho não atribui responsabilidade\./);
  assert.equal(T.COLUMN_GROUPS.ag, undefined);
  assert.equal(T.COLUMN_GROUPS.rota, undefined);
});

test('item 4: "Quem atende este exportador" sai dos embarques existentes e reconcilia', () => {
  let total = 0;
  for (const id of Object.keys(TOTALS.exp)) {
    const rows = T.exporterServers(D, cur, id), mine = cur.filter((o) => o.supplier === id);
    assert.equal(rows.reduce((n, r) => n + r.n, 0), TOTALS.exp[id]);
    total += rows.reduce((n, r) => n + r.n, 0);
    for (const r of rows) {
      const g = mine.filter((o) => o.agent === r.agent && o.route === r.route);
      assert.equal(r.n, g.length);
      assert.deepEqual(r.port, { rate: D.metric('port', g).rate, good: D.metric('port', g).good, base: D.metric('port', g).eligible.length });
      assert.equal(r.transitMedian, T.median(T.transitDays(D, g)));
    }
    for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].n >= rows[i].n);
  }
  assert.equal(total, 26);
  assert.deepEqual(T.exporterServers(D, cur, 'nao-existe'), []);
});

// ------------------------------------------------------------------ item 5 ---
test('item 5: a origem do link entre fichas é lida de `de`, validada, e nunca aponta para a própria ficha', () => {
  const p = (s) => new URLSearchParams(s), sel = { dim: 'ag', id: 'alpha' };
  assert.equal(T.originParam('rota', 'shanghai'), 'rota:shanghai');
  assert.deepEqual(T.readOrigin(D, p('aba=agentes&sel=alpha&de=rota:shanghai'), sel), { dim: 'rota', id: 'shanghai', tab: 'rotas', tabLabel: 'Rotas', name: 'Shanghai → Santos' });
  assert.deepEqual(T.readOrigin(D, p('de=exp:east'), sel).tabLabel, 'Exportadores');
  assert.equal(T.readOrigin(D, p('de=rota:nao-existe'), sel), null);
  assert.equal(T.readOrigin(D, p('de=preco:x'), sel), null);
  assert.equal(T.readOrigin(D, p('de=ag:alpha'), sel), null);
  assert.equal(T.readOrigin(D, p(''), sel), null);
  assert.equal(T.readOrigin(D, p('de=rota:shanghai'), null), null);
  for (const [tab, dim] of Object.entries(T.DIM_OF_TAB)) assert.equal(T.TAB_OF_DIM[dim], tab);
});

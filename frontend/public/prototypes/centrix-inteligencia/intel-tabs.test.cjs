const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('./data.js');
const E = require('./intel-engine.js');
const L = require('./intel-layout.js');
const T = require('./intel-tabs.js');

const q = (s) => new URLSearchParams(s);
const keys = E.FILTERS.map((f) => f.key);

test('aba na URL: lida de `aba`, escrita sem ocupar a URL na Visão geral', () => {
  assert.equal(T.readTab(q('aba=agentes&exp=east')), 'agentes');
  assert.equal(T.readTab(q('aba=rotas')), 'rotas');
  assert.equal(T.readTab(q('')), 'geral');
  assert.equal(T.readTab(q('aba=xpto')), 'geral');
  assert.equal(T.readTab({ aba: 'exportadores' }), 'exportadores');
  // Aba extra (o Simulador) só vale quando a página a declara.
  assert.equal(T.readTab(q('aba=simulador')), 'geral');
  assert.equal(T.readTab(q('aba=simulador'), ['simulador']), 'simulador');
  const p = T.writeTab(q('exp=east'), 'rotas');
  assert.equal(p.toString(), 'exp=east&aba=rotas');
  assert.equal(T.writeTab(p, 'geral').toString(), 'exp=east');
});

test('hashes antigos sem ficha abrem a aba equivalente', () => {
  assert.equal(T.LEGACY_SECTION_TAB.agentes, 'agentes');
  assert.equal(T.LEGACY_SECTION_TAB.exportadores, 'exportadores');
  assert.equal(T.LEGACY_SECTION_TAB.rotas, 'rotas');
  assert.equal(T.LEGACY_SECTION_TAB.compromissos, 'agentes');
  assert.equal(T.LEGACY_SECTION_TAB.executivo, undefined);
});

test('visão salva guarda a aba; visão antiga (sem aba) abre na Visão geral', () => {
  const v = L.captureView('Agentes FOB', q('period=year&aba=agentes&inc=FOB&sel=alpha'), L.defaults(), keys, 'v1');
  assert.equal(T.readTab(q(L.restoreView(v).query)), 'agentes');
  // O painel aberto (`sel`) não entra na visão: ela é o recorte, não um clique.
  assert.ok(!q(v.query).has('sel'));
  const old = { id: 'v0', name: 'Antiga', query: 'period=days90&exp=east', mode: 'completa', hidden: { completa: [], objetiva: [] } };
  assert.equal(T.readTab(q(L.restoreView(old).query)), 'geral');
  assert.ok(L.isActiveView(v, q('period=year&aba=agentes&inc=FOB'), L.defaults(), keys));
  assert.ok(!L.isActiveView(v, q('period=year&inc=FOB'), L.defaults(), keys), 'mesma visão em outra aba não é a visão ativa');
});

test('Visão geral enxuta: só números, gráficos, evolução e performance por etapa', () => {
  assert.deepEqual(L.BLOCKS.completa.map((b) => b.id), ['destaque', 'funil', 'kpis', 'graficos', 'performance']);
  // Layout salvo antes das abas, com os blocos que migraram, não quebra.
  const n = L.normalize({ mode: 'completa', hidden: { completa: ['precos', 'kpis'] }, order: { completa: ['compromissos', 'graficos'] } });
  assert.deepEqual(n.hidden.completa, ['kpis']);
  assert.deepEqual(n.order.completa.slice(0, 1), ['graficos']);
});

test('linhas de comparação: só fatos do recorte, sem nota nem ranking', () => {
  const rows = T.entityRows(D, D.operations, 'ag');
  assert.equal(rows.length, 4);
  assert.equal(rows.reduce((n, r) => n + r.n, 0), D.operations.length);
  const alpha = rows.find((r) => r.id === 'alpha');
  assert.equal(alpha.n, D.operations.filter((o) => o.agent === 'alpha').length);
  assert.equal(alpha.port.base, D.metric('port', D.operations.filter((o) => o.agent === 'alpha')).eligible.length);
  for (const r of rows) {
    for (const k of Object.keys(r)) assert.ok(!/score|nota|rank|melhor|pior|recomend/i.test(k), `coluna proibida: ${k}`);
  }
  const cols = Object.values(T.COLUMNS).flat().map(([, label]) => label).join(' ');
  assert.ok(!/score|nota|ranking|melhor|pior|recomendad/i.test(cols));
});

test('trânsito mediano sai de saída e chegada realizadas; sem as duas, fica de fora', () => {
  const ops = D.operations.filter((o) => o.route === 'shanghai' && o.agent === 'beta');
  const days = ops.filter((o) => o.depart && o.arrive).map((o) => D.days(o.depart, o.arrive));
  assert.deepEqual(T.transitDays(D, ops).sort((a, b) => a - b), days.sort((a, b) => a - b));
  assert.equal(T.median([3, 1, 2]), 2);
  assert.equal(T.median([4, 1, 3, 2]), 2.5);
  assert.equal(T.median([]), null);
  const r = T.entityRows(D, ops.filter((o) => !o.arrive), 'ag')[0];
  assert.equal(r.transitMedian, null);
  assert.equal(r.transitN, 0);
});

test('ordenação: volume por padrão; ausente sempre no fim; clique inverte', () => {
  const rows = [
    { id: 'a', name: 'Alfa', n: 2, ready: { rate: 50 }, freightAvg: null },
    { id: 'b', name: 'Beta', n: 9, ready: { rate: null }, freightAvg: 2000 },
    { id: 'c', name: 'Gama', n: 5, ready: { rate: 80 }, freightAvg: 1000 },
  ];
  assert.deepEqual(T.sortRows(rows).map((r) => r.id), ['b', 'c', 'a']);
  assert.deepEqual(T.sortRows(rows, { key: 'ready', dir: 'desc' }).map((r) => r.id), ['c', 'a', 'b']);
  assert.deepEqual(T.sortRows(rows, { key: 'ready', dir: 'asc' }).map((r) => r.id), ['a', 'c', 'b']);
  assert.deepEqual(T.sortRows(rows, { key: 'freightAvg', dir: 'asc' }).map((r) => r.id), ['c', 'b', 'a']);
  assert.deepEqual(T.sortRows(rows, { key: 'name', dir: 'asc' }).map((r) => r.id), ['a', 'b', 'c']);
  assert.deepEqual(T.nextSort(T.DEFAULT_SORT, 'n'), { key: 'n', dir: 'asc' });
  assert.deepEqual(T.nextSort({ key: 'n', dir: 'asc' }, 'n'), { key: 'n', dir: 'desc' });
  assert.deepEqual(T.nextSort(T.DEFAULT_SORT, 'name'), { key: 'name', dir: 'asc' });
  assert.deepEqual(T.nextSort(T.DEFAULT_SORT, 'port'), { key: 'port', dir: 'desc' });
  // Empate de valor desempata por volume e nome: estável entre renders.
  const tie = [{ id: 'x', name: 'Xis', n: 1, port: { rate: 50 } }, { id: 'y', name: 'Ypsilon', n: 3, port: { rate: 50 } }];
  assert.deepEqual(T.sortRows(tie, { key: 'port', dir: 'desc' }).map((r) => r.id), ['y', 'x']);
});

test('amostra pequena: n < 3 marca a linha, n = 3 não', () => {
  const two = D.operations.filter((o) => o.supplier === 'east').slice(0, 2);
  const three = D.operations.filter((o) => o.supplier === 'east').slice(0, 3);
  assert.equal(T.entityRows(D, two, 'exp')[0].small, true);
  assert.equal(T.entityRows(D, three, 'exp')[0].small, false);
  const sum = T.tabSummary(T.entityRows(D, [...two, ...D.operations.filter((o) => o.supplier === 'nord').slice(0, 5)], 'exp'), 7);
  assert.equal(sum.smallCount, 1);
});

test('resumo da aba: quantas entidades e concentração por volume', () => {
  const rows = T.entityRows(D, D.operations, 'rota');
  const sum = T.tabSummary(rows, D.operations.length);
  assert.equal(sum.count, 5);
  assert.equal(sum.top.name, 'Shanghai → Santos');
  const shanghai = D.operations.filter((o) => o.route === 'shanghai').length;
  assert.equal(sum.top.n, shanghai);
  const second = T.sortRows(rows)[1].n;
  assert.equal(sum.top2Share, Math.round(((shanghai + second) / D.operations.length) * 100));
  assert.equal(T.tabSummary([], 0).top, null);
  assert.equal(T.tabSummary(rows.slice(0, 1), rows[0].n).top2Share, null);
});

test('"Filtrar por este...": substitui só o filtro daquela dimensão', () => {
  const gf = E.readFilters(q('exp=east,nord&inc=FOB'));
  const next = T.filterByEntity(gf, 'exp', 'yang');
  assert.deepEqual(next.exp, ['yang']);
  assert.deepEqual(next.inc, ['FOB']);
  assert.deepEqual(gf.exp, ['east', 'nord'], 'não muta o filtro de origem');
  assert.deepEqual(T.filterByEntity(gf, 'ag', 'beta').ag, ['beta']);
  assert.equal(E.reportContext(T.filterByEntity({}, 'exp', 'east')).exporter, 'east');
  assert.equal(E.reportContext(T.filterByEntity({}, 'rota', 'ningbo')).plannedRouteAgent, true);
});

test('detalhe pela URL: `sel` só vale na aba da mesma dimensão e para id conhecido', () => {
  assert.deepEqual(T.readSelection(D, q('aba=exportadores&sel=east'), 'exportadores'), { dim: 'exp', id: 'east' });
  assert.deepEqual(T.readSelection(D, q('sel=beta'), 'agentes'), { dim: 'ag', id: 'beta' });
  assert.equal(T.readSelection(D, q('sel=east'), 'agentes'), null);
  assert.equal(T.readSelection(D, q('sel=sumiu'), 'rotas'), null);
  assert.equal(T.readSelection(D, q('sel=east'), 'geral'), null);
  assert.equal(T.tabMention(D, 'exportadores', { dim: 'exp', id: 'east' }), 'Aba Exportadores · Eastbridge Components');
  assert.equal(T.tabMention(D, 'rotas', null), 'Aba Rotas');
  assert.equal(T.tabMention(D, 'geral', null), '');
});

test('SKUs do exportador e da rota: SKU é do item, conta em todo embarque que o contém', () => {
  const east = D.operations.filter((o) => o.supplier === 'east');
  const skus = T.skuRows(D, east);
  assert.deepEqual(skus.map((s) => s.sku).sort(), ['EC-240', 'EC-310']);
  const with240 = east.filter((o) => o.items.some((i) => i.sku === 'EC-240')).length;
  assert.equal(skus.find((s) => s.sku === 'EC-240').n, with240);
  const shanghai = T.skuRows(D, D.operations.filter((o) => o.route === 'shanghai'));
  assert.ok(shanghai.some((s) => s.exporters.includes('east')) && shanghai.some((s) => s.exporters.includes('yang')));
  assert.deepEqual(T.skuRows(D, []), []);
});

test('uso e impacto do agente: participação, prazo e cotado × cobrado só do que existe', () => {
  const imp = T.agentImpact(D, D.operations, 'beta');
  const beta = D.operations.filter((o) => o.agent === 'beta');
  assert.equal(imp.n, beta.length);
  assert.equal(imp.share, Math.round((beta.length / D.operations.length) * 100));
  assert.deepEqual(imp.routes, ['shanghai']);
  const audit = D.metric('audit', beta);
  assert.equal(imp.auditBase, audit.eligible.length);
  assert.equal(imp.auditDiffCount, audit.eligible.length - audit.good);
  assert.equal(imp.auditDiffUsd, imp.auditDiffCount * 195);
  assert.ok(imp.transitOverPlan > 0, 'a Beta Cargo perde prazo no trânsito em jul/ago na fixture');
  const none = T.agentImpact(D, [], 'beta');
  assert.equal(none.n, 0);
  assert.equal(none.transitMedian, null);
});

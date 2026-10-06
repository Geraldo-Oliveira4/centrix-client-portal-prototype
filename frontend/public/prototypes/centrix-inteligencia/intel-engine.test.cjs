const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('./data.js');
const E = require('./intel-engine.js');
const L = require('./intel-layout.js');

const ids = (ops) => ops.map((o) => o.id).sort();
const f = (q) => E.readFilters(new URLSearchParams(q));

test('fixture: ~60 embarques de março a setembro com os seis campos dos filtros', () => {
  assert.equal(D.operations.length, 60);
  assert.equal(D.operations[0].readyPlan.slice(0, 7), '2026-03');
  assert.equal(D.operations.at(-1).readyPlan.slice(0, 7), '2026-09');
  for (const o of D.operations) {
    assert.ok(o.supplier && o.agent && o.route && o.incoterm && o.country);
    assert.ok(o.items.length >= 1 && o.items.every((i) => D.skus[i.sku]));
  }
  const count = (fn) => new Set(D.operations.flatMap(fn)).size;
  assert.equal(count((o) => [o.supplier]), 5);
  assert.equal(count((o) => [o.agent]), 4);
  assert.equal(count((o) => [o.route]), 5);
  assert.deepEqual([...new Set(D.operations.map((o) => o.incoterm))].sort(), ['CIF', 'EXW', 'FOB']);
  assert.deepEqual([...new Set(D.operations.map((o) => o.country))].sort(), ['Alemanha', 'China', 'EUA', 'Itália']);
  const skus = count((o) => o.items.map((i) => i.sku));
  assert.ok(skus >= 8 && skus <= 10);
  for (const name of ['Eastbridge Components', 'Yangtze Polymers', 'Nordwerk Industrial', 'Liguria Valvole']) assert.ok(D.companies.some((c) => c.name === name), name);
});

test('opções saem dos dados, com contagem, e não de lista fixa', () => {
  const ops = D.operations.filter((o) => o.supplier === 'nord');
  assert.deepEqual(E.options(D, ops, 'pais').map((x) => x.value), ['Alemanha']);
  assert.deepEqual(E.options(D, ops, 'exp').map((x) => [x.value, x.count]), [['nord', ops.length]]);
});

test('OU dentro de um filtro, E entre filtros', () => {
  const ops = D.operations;
  const either = E.applyFilters(ops, f('exp=east,nord'));
  assert.deepEqual(ids(either), ids(ops.filter((o) => ['east', 'nord'].includes(o.supplier))));
  const both = E.applyFilters(ops, f('exp=east,nord&ag=alpha'));
  assert.deepEqual(ids(both), ids(ops.filter((o) => ['east', 'nord'].includes(o.supplier) && o.agent === 'alpha')));
  assert.equal(E.applyFilters(ops, f('')).length, ops.length);
  assert.equal(E.activeCount(f('exp=east,nord&ag=alpha')), 2);
});

test('filtro sem resultado devolve vazio, e a URL ida e volta preserva os filtros', () => {
  assert.equal(E.applyFilters(D.operations, f('exp=nord&pais=China')).length, 0);
  const p = E.writeFilters(new URLSearchParams('period=days90'), f('exp=east,yang&sku=EC-240'));
  assert.equal(p.get('exp'), 'east,yang');
  assert.equal(p.get('period'), 'days90');
  assert.equal(p.has('ag'), false);
  assert.deepEqual(E.readFilters(p).exp, ['east', 'yang']);
});

test('SKU é do item: o embarque entra se tiver o SKU, e o frete continua o do embarque', () => {
  const withSku = E.applyFilters(D.operations, f('sku=EC-310'));
  assert.ok(withSku.length > 0);
  assert.ok(withSku.every((o) => o.items.some((i) => i.sku === 'EC-310')));
  assert.ok(withSku.some((o) => o.items.length > 1), 'há embarque com mais de um SKU');
  const total = withSku.reduce((n, o) => n + o.freight, 0);
  assert.equal(E.kpi(D, 'freight', withSku, []).value, total);
});

test('amostra pequena: menos de 3 embarques esconde a variação e marca o selo', () => {
  const two = D.operations.slice(0, 2);
  const k = E.kpi(D, 'count', two, D.operations.slice(10, 20));
  assert.equal(k.small, true);
  assert.equal(k.variation, null);
  assert.equal(E.kpi(D, 'count', [], D.operations).small, false, 'zero é vazio, não amostra pequena');
  const ok = E.kpi(D, 'count', D.operations.slice(0, 5), D.operations.slice(5, 9));
  assert.equal(ok.small, false);
  assert.ok(ok.variation);
});

test('uma base de comparação: o período anterior tem a mesma duração e termina na véspera', () => {
  assert.deepEqual(E.previousRange({ start: '2026-06-16', end: '2026-09-13' }), { start: '2026-03-18', end: '2026-06-15', days: 90 });
  assert.deepEqual(E.previousRange({ start: '2026-09-01', end: '2026-09-30' }), { start: '2026-08-02', end: '2026-08-31', days: 30 });
  assert.match(E.comparisonCaption({ start: '2026-06-16', end: '2026-09-13' }), /18\/03\/2026 a 15\/06\/2026, 90 dias/);
  const range = { start: '2026-06-16', end: '2026-09-13' };
  const cur = E.inRange(D.operations, range), prev = E.inRange(D.operations, E.previousRange(range));
  const k = E.kpi(D, 'ready', cur, prev);
  assert.equal(k.variation.delta, D.metric('ready', cur).rate - D.metric('ready', prev).rate);
  assert.match(k.variation.text, /do período anterior$/);
});

test('série mensal: 6 meses terminando no mês do fim do período, calculada dos dados', () => {
  const s = E.monthly(D, 'freight', D.operations, '2026-09-13');
  assert.deepEqual(s.map((m) => m.ym), ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
  for (const m of s) assert.equal(m.value, D.operations.filter((o) => o.readyPlan.startsWith(m.ym)).reduce((n, o) => n + o.freight, 0) || null);
});

test('perguntas da Objetiva: uma linha por pergunta, sem score de IA', () => {
  const range = { start: '2026-06-16', end: '2026-09-13' };
  const q = E.questions(D, E.inRange(D.operations, range), E.inRange(D.operations, E.previousRange(range)));
  assert.deepEqual(Object.keys(q), ['prazo', 'frete', 'parceiros', 'perda']);
  for (const v of Object.values(q)) { assert.ok(v.metric); assert.ok(v.conclusion.length > 10); assert.doesNotMatch(v.conclusion, /score|pontuação/i); }
});

test('compromissos do serviço: só leitura, sem CTA, desvio contra o combinado', () => {
  const rows = E.commitments(D, D.operations);
  assert.equal(rows.length, D.operations.length);
  const beta = rows.filter((r) => r.o.agent === 'beta' && r.o.readyPlan >= '2026-07');
  assert.ok(beta.every((r) => r.status === 'deviation'));
});

test('layout: padrão tudo visível em Completa; alternar, restaurar e descartar bloco desconhecido', () => {
  let s = L.defaults();
  assert.equal(s.mode, 'completa');
  assert.deepEqual(L.visibleBlocks(s), L.BLOCKS.completa.map((b) => b.id));
  s = L.setVisible(s, 'completa', 'precos', false);
  assert.ok(!L.visibleBlocks(s).includes('precos'));
  s = L.setMode(s, 'objetiva');
  assert.deepEqual(L.visibleBlocks(s), L.BLOCKS.objetiva.map((b) => b.id));
  const r = L.reset(s);
  assert.equal(r.mode, 'objetiva');
  assert.deepEqual(r.hidden, { completa: [], objetiva: [] });
  const n = L.normalize({ mode: 'xpto', hidden: { completa: ['sumiu', 'kpis'] } });
  assert.equal(n.mode, 'completa');
  assert.deepEqual(n.hidden, { completa: ['kpis'], objetiva: [] });
  assert.deepEqual(n.order, L.defaults().order);
  const mem = { v: null, getItem() { return this.v; }, setItem(k, v) { this.v = v; } };
  L.save(mem, s);
  assert.deepEqual(L.load(mem), s);
});

test('layout: ordem guardada manda no desenho; id desconhecido sai e bloco novo entra no fim', () => {
  const s = L.normalize({ mode: 'completa', order: { completa: ['precos', 'sumiu', 'graficos'], objetiva: ['q_frete'] } });
  assert.deepEqual(L.visibleBlocks(s).slice(0, 2), ['precos', 'graficos']);
  assert.equal(L.visibleBlocks(s).length, L.BLOCKS.completa.length);
  assert.deepEqual(L.visibleBlocks(s, 'objetiva')[0], 'q_frete');
  assert.deepEqual(L.orderedBlocks(s).map((b) => b.id), L.visibleBlocks(s));
  // Ocultar continua valendo dentro da ordem.
  assert.ok(!L.visibleBlocks(L.setVisible(s, 'completa', 'precos', false)).includes('precos'));
  // Visão antiga, sem `order`, abre na ordem padrão.
  const old = L.restoreView({ id: 'v', name: 'Antiga', query: '', mode: 'completa', hidden: { completa: [], objetiva: [] } });
  assert.deepEqual(old.layout.order, L.defaults().order);
  // A ordem viaja com a visão e conta para "visão ativa".
  const view = L.captureView('Minha', new URLSearchParams('rota=shanghai'), s, E.FILTERS.map((f) => f.key));
  assert.deepEqual(view.order.completa.slice(0, 2), ['precos', 'graficos']);
  assert.ok(L.isActiveView(view, new URLSearchParams('rota=shanghai'), s, E.FILTERS.map((f) => f.key)));
  assert.ok(!L.isActiveView(view, new URLSearchParams('rota=shanghai'), L.defaults(), E.FILTERS.map((f) => f.key)));
});

test('rota sem par na fixture: chip legível e zero embarques (estado "0 no recorte")', () => {
  const rota = E.FILTERS.find((f) => f.key === 'rota');
  assert.equal(rota.name(D, 'Shanghai>Itajaí'), 'Shanghai → Itajaí');
  assert.equal(E.applyFilters(D.operations, { rota: ['Shanghai>Itajaí'] }).length, 0);
  // OU dentro do filtro: a rota que existe continua trazendo os embarques dela.
  assert.ok(E.applyFilters(D.operations, { rota: ['Shanghai>Itajaí', 'shanghai'] }).length > 0);
});

const RANGE = { start: '2026-06-16', end: '2026-09-13' };
const PERIOD = () => E.inRange(D.operations, RANGE);

test('opções do dropdown: lista e contagem da base INTEIRA, nunca somem', () => {
  const opts = E.filterOptions(D, D.operations, PERIOD(), f('exp=hud'), 'rota');
  assert.equal(opts.length, 5, 'as cinco rotas continuam na lista');
  const sh = opts.find((o) => o.value === 'shanghai');
  assert.equal(sh.count, D.operations.filter((o) => o.route === 'shanghai').length);
  assert.equal(sh.label, 'Shanghai → Santos');
});

test('opção com 0 no período + outros filtros fica desabilitada (mas marcada nunca)', () => {
  const opts = E.filterOptions(D, D.operations, PERIOD(), f('exp=hud'), 'rota');
  assert.equal(opts.find((o) => o.value === 'shanghai').disabled, true);
  assert.equal(opts.find((o) => o.value === 'shanghai').available, 0);
  assert.equal(opts.find((o) => o.value === 'newyork').disabled, false);
  const marked = E.filterOptions(D, D.operations, PERIOD(), f('exp=hud&rota=shanghai'), 'rota');
  assert.equal(marked.find((o) => o.value === 'shanghai').disabled, false, 'marcada continua desmarcável');
  // O próprio filtro não se restringe: com Exportador=hud, as outras opções de Exportador seguem disponíveis.
  assert.ok(E.filterOptions(D, D.operations, PERIOD(), f('exp=hud'), 'exp').every((o) => !o.disabled));
});

test('combinações: dois filtros deixam base útil, três chegam à amostra pequena', () => {
  const n = (q) => E.applyFilters(PERIOD(), f(q)).length;
  assert.ok(n('rota=shanghai&inc=FOB') >= 5);
  assert.ok(n('pais=China&inc=FOB') >= 5);
  const three = E.applyFilters(PERIOD(), f('exp=hud&inc=EXW&sku=HP-520'));
  assert.ok(three.length > 0 && three.length < E.MIN_SAMPLE);
  assert.equal(E.kpi(D, 'count', three, []).small, true);
});

test('resumo da visão', () => {
  assert.equal(E.viewSummary(D, f('rota=shanghai&inc=FOB'), 'Este ano', 14), 'Rota Shanghai → Santos · FOB · Este ano · 14 embarques');
  assert.equal(E.viewSummary(D, f('exp=east,yang'), 'Últimos 90 dias', 1), 'Exportador: Eastbridge Components, Yangtze Polymers · Últimos 90 dias · 1 embarque');
});

test('visão salva: captura e restaura período, filtros, modo e blocos', () => {
  const keys = E.FILTERS.map((x) => x.key);
  const params = new URLSearchParams('period=custom&start=2026-04-01&end=2026-06-30&exp=east&inc=FOB&variant=direto');
  const state = L.setVisible(L.setMode(L.defaults(), 'objetiva'), 'objetiva', 'q_frete', false);
  const v = L.captureView('  Eastbridge FOB ', params, state, keys, 'v1');
  assert.equal(v.name, 'Eastbridge FOB');
  assert.equal(new URLSearchParams(v.query).get('variant'), null, 'só período e filtros globais');
  const r = L.restoreView(JSON.parse(JSON.stringify(v)));
  assert.deepEqual(Object.fromEntries(new URLSearchParams(r.query)), { period: 'custom', start: '2026-04-01', end: '2026-06-30', exp: 'east', inc: 'FOB' });
  assert.equal(r.layout.mode, 'objetiva');
  assert.deepEqual(r.layout.hidden.objetiva, ['q_frete']);
  assert.equal(L.isActiveView(v, new URLSearchParams(r.query), r.layout, keys), true);
  assert.equal(L.isActiveView(v, new URLSearchParams(r.query + '&ag=beta'), r.layout, keys), false);
  let list = [v, L.captureView('Outra', new URLSearchParams(''), L.defaults(), keys, 'v2')];
  list = L.renameView(list, 'v1', 'Nova');
  assert.equal(list[0].name, 'Nova');
  assert.equal(L.renameView(list, 'v1', '  ')[0].name, 'Nova', 'nome vazio não apaga');
  assert.deepEqual(L.deleteView(list, 'v1').map((x) => x.id), ['v2']);
  const mem = { v: null, getItem() { return this.v; }, setItem(k, val) { this.v = val; } };
  L.saveViews(mem, list);
  assert.deepEqual(L.loadViews(mem), list);
});

test('Preparar relatório: atalho de conversa por estado do filtro', () => {
  assert.deepEqual(E.reportContext(f('')), { exporter: null, plannedRouteAgent: false, hint: true });
  assert.deepEqual(E.reportContext(f('exp=east')), { exporter: 'east', plannedRouteAgent: false, hint: false });
  assert.deepEqual(E.reportContext(f('exp=east,yang')), { exporter: null, plannedRouteAgent: false, hint: true }, 'dois exportadores = nenhum');
  assert.deepEqual(E.reportContext(f('ag=beta')), { exporter: null, plannedRouteAgent: true, hint: false });
  assert.deepEqual(E.reportContext(f('rota=shanghai&exp=nord')), { exporter: 'nord', plannedRouteAgent: true, hint: false });
});

const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('./data.js');
const E = require('./intel-engine.js');
const L = require('./intel-layout.js');

const ids = (ops) => ops.map((o) => o.id).sort();
const f = (q) => E.readFilters(new URLSearchParams(q));

test('fixture: 60 embarques de março a setembro + 19 anteriores (histórico do Simulador), com os seis campos dos filtros', () => {
  assert.equal(D.operations.length, 79);
  const main = D.operations.slice(0, 60), older = D.operations.slice(60);
  assert.equal(main[0].readyPlan.slice(0, 7), '2026-03');
  assert.equal(main.at(-1).readyPlan.slice(0, 7), '2026-09');
  assert.ok(older.every((o) => o.readyPlan < '2026-03-01'), 'o histórico anterior fica antes da série principal');
  assert.ok(older.every((o) => o.readyPlan < '2026-06-15'), 'e fora dos últimos 90 dias');
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
  assert.match(E.comparisonCaption({ start: '2026-06-16', end: '2026-09-13' }), /18\/03\/2026 a 15\/06\/2026, 90 dias/);
  const range = { start: '2026-06-16', end: '2026-09-13' };
  const cur = E.inRange(D.operations, range), prev = E.inRange(D.operations, E.previousRange(range));
  const k = E.kpi(D, 'ready', cur, prev);
  assert.equal(k.variation.delta, D.metric('ready', cur).rate - D.metric('ready', prev).rate);
  assert.match(k.variation.text, /do período anterior$/);
});

// A1 (17/11/2026): "Mês passado" comparado com "mês anterior" é mês FECHADO.
test('mês de calendário compara com o mês anterior inteiro (meses de 30 e 31 dias)', () => {
  // setembro (30) contra agosto (31): o mês anterior inteiro, não os 30 dias antes
  assert.deepEqual(E.previousRange({ start: '2026-09-01', end: '2026-09-30' }), { start: '2026-08-01', end: '2026-08-31', days: 31, calendar: 'month' });
  // outubro (31) contra setembro (30)
  assert.deepEqual(E.previousRange({ start: '2026-10-01', end: '2026-10-31' }), { start: '2026-09-01', end: '2026-09-30', days: 30, calendar: 'month' });
  // março contra fevereiro (28) e janeiro contra dezembro do ano anterior
  assert.deepEqual(E.previousRange({ start: '2026-03-01', end: '2026-03-31' }), { start: '2026-02-01', end: '2026-02-28', days: 28, calendar: 'month' });
  assert.deepEqual(E.previousRange({ start: '2026-01-01', end: '2026-01-31' }), { start: '2025-12-01', end: '2025-12-31', days: 31, calendar: 'month' });
  assert.match(E.comparisonCaption({ start: '2026-10-01', end: '2026-10-31' }), /mês anterior inteiro \(01\/09\/2026 a 30\/09\/2026, 30 dias\)/);
  assert.match(E.periodStrip({ start: '2026-10-01', end: '2026-10-31' }, 'Mês passado', 5), /comparado com 01\/09\/2026 a 30\/09\/2026/);
});
test('mês até o corte compara com o mesmo trecho do mês anterior, limitado ao fim dele', () => {
  assert.deepEqual(E.previousRange({ start: '2026-11-01', end: '2026-11-13' }), { start: '2026-10-01', end: '2026-10-13', days: 13, calendar: 'month-to-date' });
  assert.deepEqual(E.previousRange({ start: '2026-03-01', end: '2026-03-30' }), { start: '2026-02-01', end: '2026-02-28', days: 28, calendar: 'month-to-date' });
});
test('janela móvel continua comparando com a janela anterior de mesmo tamanho', () => {
  assert.deepEqual(E.previousRange({ start: '2026-08-16', end: '2026-11-13' }), { start: '2026-05-18', end: '2026-08-15', days: 90 });
  assert.deepEqual(E.previousRange({ start: '2026-10-15', end: '2026-11-13' }), { start: '2026-09-15', end: '2026-10-14', days: 30 });
  // atravessar a virada do mês não faz da janela um mês de calendário
  assert.deepEqual(E.previousRange({ start: '2026-09-01', end: '2026-10-15' }), { start: '2026-07-18', end: '2026-08-31', days: 45 });
  assert.equal(E.calendarMonth({ start: '2026-09-02', end: '2026-09-30' }), null);
});
test('mês fechado: a variação compara os dois meses inteiros, com os embarques de cada um', () => {
  const cur = { start: '2026-09-01', end: '2026-09-30' }, prev = E.previousRange(cur);
  const a = E.inRange(D.operations, cur), b = E.inRange(D.operations, prev);
  assert.ok(b.every((o) => o.readyPlan.startsWith('2026-08')));
  assert.equal(b.length, D.operations.filter((o) => o.readyPlan.startsWith('2026-08')).length, 'o mês anterior entra inteiro, do dia 1 ao 31');
  const k = E.kpi(D, 'port', a, b);
  if (k.variation) assert.equal(k.variation.delta, D.metric('port', a).rate - D.metric('port', b).rate);
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
  s = L.setVisible(s, 'completa', 'performance', false);
  assert.ok(!L.visibleBlocks(s).includes('performance'));
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
  const s = L.normalize({ mode: 'completa', order: { completa: ['performance', 'sumiu', 'graficos'], objetiva: ['q_frete'] } });
  assert.deepEqual(L.visibleBlocks(s).slice(0, 2), ['performance', 'graficos']);
  assert.equal(L.visibleBlocks(s).length, L.BLOCKS.completa.length);
  assert.deepEqual(L.visibleBlocks(s, 'objetiva')[0], 'q_frete');
  assert.deepEqual(L.orderedBlocks(s).map((b) => b.id), L.visibleBlocks(s));
  // Ocultar continua valendo dentro da ordem.
  assert.ok(!L.visibleBlocks(L.setVisible(s, 'completa', 'performance', false)).includes('performance'));
  // Visão antiga, sem `order`, abre na ordem padrão.
  const old = L.restoreView({ id: 'v', name: 'Antiga', query: '', mode: 'completa', hidden: { completa: [], objetiva: [] } });
  assert.deepEqual(old.layout.order, L.defaults().order);
  // A ordem viaja com a visão e conta para "visão ativa".
  const view = L.captureView('Minha', new URLSearchParams('rota=shanghai'), s, E.FILTERS.map((f) => f.key));
  assert.deepEqual(view.order.completa.slice(0, 2), ['performance', 'graficos']);
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

test('Selecionar todos: só opções com embarque no recorte; marcada fica; desabilitada fica de fora', () => {
  const period = E.inRange(D.operations, { start: '2026-08-01', end: '2026-08-31' });
  const gf = f('rota=' + D.operations.find((o) => o.readyPlan.startsWith('2026-08')).route);
  const opts = E.filterOptions(D, D.operations, period, gf, 'exp');
  const all = E.selectAllValues(D, D.operations, period, gf, 'exp');
  assert.deepEqual(all, opts.filter((o) => !o.disabled).map((o) => o.value));
  assert.ok(opts.some((o) => o.disabled), 'o recorte precisa ter ao menos uma opção desabilitada');
  for (const o of opts.filter((x) => x.disabled)) assert.ok(!all.includes(o.value));
  // Uma opção já marcada sem embarque no recorte continua marcada (dá para desmarcar).
  const dead = opts.find((o) => o.disabled).value;
  const kept = E.selectAllValues(D, D.operations, period, { ...gf, exp: [dead] }, 'exp');
  assert.ok(kept.includes(dead));
  // Não mexe nos outros filtros.
  assert.deepEqual(gf.rota.length, 1);
});

test('Limpar um filtro tira só aquela chave', () => {
  const gf = f('exp=east,nord&rota=x&inc=FOB');
  const out = E.clearFilter(gf, 'exp');
  assert.deepEqual(out.exp, []);
  assert.deepEqual(out.rota, ['x']);
  assert.deepEqual(out.inc, ['FOB']);
  assert.deepEqual(gf.exp, ['east', 'nord'], 'não muta a entrada');
  const q = E.writeFilters(new URLSearchParams('exp=east&inc=FOB&period=days30'), out);
  assert.equal(q.get('exp'), null);
  assert.equal(q.get('inc'), 'FOB');
  assert.equal(q.get('period'), 'days30');
});

test('faixa do período: período, base de comparação e N', () => {
  const r = { start: '2026-06-16', end: '2026-09-13' };
  assert.equal(E.periodStrip(r, 'Últimos 90 dias', 42), 'Mostrando: Últimos 90 dias (16/06/2026 a 13/09/2026) · comparado com 18/03/2026 a 15/06/2026 · 42 embarques');
  assert.match(E.periodStrip(r, 'X', 1), /· 1 embarque$/);
});

test('Como é calculado: todo KPI tem as quatro linhas preenchidas', () => {
  for (const key of ['ready', 'port', 'freight', 'count']) {
    const lines = E.kpiDefinition(D, key, f(''));
    assert.deepEqual(lines.map((l) => l.label), ['Fonte', 'Fórmula', 'Período', 'Filtros que se aplicam']);
    for (const l of lines) assert.ok(l.text && l.text.trim().length > 10, `${key}/${l.label}`);
  }
  assert.match(E.kpiDefinition(D, 'ready', f(''))[1].text, /pronta para embarque na origem dentro do prazo combinado/);
  assert.match(E.kpiDefinition(D, 'port', f(''))[1].text, /porto ou aeroporto de descarga/);
  const withExp = E.kpiDefinition(D, 'port', f('exp=nord'))[3].text;
  assert.match(withExp, /Exportador \(Nordwerk Industrial\)/);
});

// C1 (17/11/2026): minigráfico de barras por subperíodo do recorte.
test('minigráfico: por mês acima de 45 dias, com as bases somando a do período', () => {
  const r = { start: '2026-06-16', end: '2026-09-13' }, cur = E.inRange(D.operations, r);
  const s = E.subSeries(D, 'port', D.operations, r);
  assert.equal(s.grain, 'month'); assert.equal(s.legend, 'por mês');
  assert.deepEqual(s.bars.map((b) => [b.start, b.end]), [['2026-06-16', '2026-06-30'], ['2026-07-01', '2026-07-31'], ['2026-08-01', '2026-08-31'], ['2026-09-01', '2026-09-13']]);
  assert.equal(s.bars.reduce((n, b) => n + b.base, 0), D.metric('port', cur).eligible.length);
  assert.equal(s.bars.reduce((n, b) => n + (b.good || 0), 0), D.metric('port', cur).good);
  assert.match(E.barText('port', s.bars[1]), /^Jul 2026: \d+ de \d+ \(\d+%\)$/);
  assert.match(E.barText('port', s.bars[0]), /^Jun 2026 \(16\/06 a 30\/06\)/);
});
test('minigráfico: por semana num mês (segunda a domingo), contagem e frete somam o período', () => {
  const r = { start: '2026-08-01', end: '2026-08-31' }, cur = E.inRange(D.operations, r);
  const s = E.subSeries(D, 'count', D.operations, r);
  assert.equal(s.grain, 'week'); assert.equal(s.legend, 'por semana');
  assert.equal(s.bars[0].start, '2026-08-01'); assert.equal(s.bars[1].start, '2026-08-03', 'a segunda semana começa numa segunda');
  assert.equal(s.bars.at(-1).end, '2026-08-31');
  assert.equal(s.bars.reduce((n, b) => n + b.value || n, 0), cur.length);
  const f = E.subSeries(D, 'freight', D.operations, r);
  assert.equal(f.bars.reduce((n, b) => n + (b.value || 0), 0), D.metric('freight', cur).total || 0);
});
test('minigráfico: período curto vira duas barras, anterior × atual, iguais quando os valores são iguais', () => {
  const r = { start: '2026-09-08', end: '2026-09-13' };
  const s = E.subSeries(D, 'count', D.operations, r);
  assert.equal(s.grain, 'compare'); assert.equal(s.bars.length, 2);
  assert.deepEqual([s.bars[0].start, s.bars[0].end], [E.previousRange(r).start, E.previousRange(r).end]);
  const twin = D.operations.slice(0, 4).map((o, i) => ({ ...o, readyPlan: i < 2 ? '2026-09-03' : '2026-09-10' }));
  const t = E.subSeries(D, 'count', twin, r);
  assert.equal(t.bars[0].value, t.bars[1].value);
});

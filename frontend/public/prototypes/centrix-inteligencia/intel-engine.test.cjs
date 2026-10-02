const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('./data.js');
const E = require('./intel-engine.js');
const L = require('./intel-layout.js');

const ids = (ops) => ops.map((o) => o.id).sort();
const f = (q) => E.readFilters(new URLSearchParams(q));

test('fixture: ~40 embarques de março a setembro com os seis campos dos filtros', () => {
  assert.equal(D.operations.length, 40);
  assert.equal(D.operations[0].readyPlan.slice(0, 7), '2026-03');
  assert.equal(D.operations.at(-1).readyPlan.slice(0, 7), '2026-09');
  for (const o of D.operations) {
    assert.ok(o.supplier && o.agent && o.route && o.incoterm && o.country);
    assert.ok(o.items.length >= 1 && o.items.every((i) => D.skus[i.sku]));
  }
  const count = (fn) => new Set(D.operations.flatMap(fn)).size;
  assert.ok(count((o) => [o.supplier]) >= 3);
  assert.equal(count((o) => [o.agent]), 3);
  assert.equal(count((o) => [o.route]), 4);
  assert.equal(count((o) => [o.incoterm]), 3);
  assert.equal(count((o) => [o.country]), 3);
  assert.ok(count((o) => o.items.map((i) => i.sku)) >= 6);
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
  assert.deepEqual(L.normalize({ mode: 'xpto', hidden: { completa: ['sumiu', 'kpis'] } }), { mode: 'completa', hidden: { completa: ['kpis'], objetiva: [] } });
  const mem = { v: null, getItem() { return this.v; }, setItem(k, v) { this.v = v; } };
  L.save(mem, s);
  assert.deepEqual(L.load(mem), s);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('./data.js');
const S = require('./intel-sim.js');
const L = require('./intel-layout.js');
const E = require('./intel-engine.js');

const TODAY = D.cutoff; // 2026-09-13: a DATA-BASE da fixture (no Node, D não é deslocado; o relógio é injetado)
const all = D.operations;
const row = (r, route, agent) => r.rows.find((x) => x.route === route && x.agent === agent);

test('percentil (posto mais próximo) e mediana', () => {
  assert.equal(S.percentile([34, 34, 34, 34, 34, 34, 36, 37], 90), 37);
  assert.equal(S.percentile([32, 32, 32, 32, 33], 90), 33);
  assert.equal(S.percentile([10], 90), 10);
  assert.equal(S.percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90), 9);
  assert.equal(S.percentile([], 90), null);
  assert.equal(S.median([5, 1, 3]), 3);
  assert.equal(S.median([1, 2, 3, 4]), 2.5);
  // P90 é sempre um trânsito que aconteceu, nunca interpolado.
  const v = [18, 18, 19, 22, 40];
  assert.ok(v.includes(S.percentile(v, 90)));
});

test('janela de semanas: segunda-feira da semana, nunca o dia', () => {
  assert.equal(S.weekStart('2026-09-13'), '2026-09-07'); // domingo -> segunda anterior
  assert.equal(S.weekStart('2026-10-12'), '2026-10-12'); // segunda
  assert.equal(S.weekStart('2026-10-15'), '2026-10-12');
  assert.equal(S.weekLabel('2026-10-15'), 'semana de 12/10');
  assert.equal(S.weekWindow('2026-10-15', '2026-10-16'), 'na semana de 12/10');
  assert.equal(S.weekWindow('2026-10-17', '2026-10-20'), 'entre a semana de 12/10 e a de 19/10');
});

test('amostra pequena: menos de 3 trânsitos não estima; 3 já estima', () => {
  const pair = all.filter((o) => o.route === 'genova' && o.agent === 'alpha' && o.depart && o.arrive);
  const two = S.simulate(D, pair.slice(0, 2), { arriveBy: '2026-11-30', today: TODAY });
  assert.equal(two.rows[0].small, true);
  assert.equal(two.rows[0].median, null);
  const three = S.simulate(D, pair.slice(0, 3), { arriveBy: '2026-11-30', today: TODAY });
  assert.equal(three.rows[0].small, false);
  // Embarque sem chegada conta como embarque, não como trânsito.
  const open = all.filter((o) => o.route === 'genova' && o.agent === 'alpha');
  const r = S.simulate(D, open, { arriveBy: '2026-11-30', today: TODAY });
  assert.equal(r.rows[0].shipments, open.length);
  assert.equal(r.rows[0].n, open.filter((o) => o.depart && o.arrive).length);
});

test('rota opcional restringe; filtros globais já chegam aplicados nos embarques', () => {
  const r = S.simulate(D, all, { route: 'shanghai', arriveBy: '2026-10-31', today: TODAY });
  assert.deepEqual(r.rows.map((x) => x.agent).sort(), ['alpha', 'beta', 'delta']);
  const fob = E.applyFilters(all, E.readFilters(new URLSearchParams('inc=CIF')));
  assert.ok(S.simulate(D, fob, { arriveBy: '2026-10-31', today: TODAY }).rows.every((x) => fob.some((o) => o.route === x.route && o.agent === x.agent)));
});

test('janela do Simulador: 6 meses, 12 meses (padrão) e todo o histórico, pela data de saída', () => {
  assert.equal(S.DEFAULT_WINDOW, '12m');
  assert.equal(S.windowStart('6m', '2026-09-13'), '2026-03-13');
  assert.equal(S.windowStart('12m', '2026-09-13'), '2025-09-13');
  assert.equal(S.windowStart('12m', '2026-03-31'), '2025-03-31');
  assert.equal(S.windowStart('6m', '2026-08-31'), '2026-02-28'); // fevereiro não tem 31
  assert.equal(S.windowStart('tudo', '2026-09-13'), null);
  const n = (k) => S.inWindow(all, k, TODAY).length;
  assert.ok(n('6m') < n('12m') && n('12m') < n('tudo'), `${n('6m')} < ${n('12m')} < ${n('tudo')}`);
  assert.equal(n('tudo'), all.length);
  for (const o of S.inWindow(all, '6m', TODAY)) assert.ok((o.depart || o.readyPlan) >= '2026-03-13');
  // Nada depois de hoje entra.
  assert.equal(S.inWindow([{ depart: '2026-09-20' }], 'tudo', TODAY).length, 0);
  assert.equal(S.windowLabel('6m'), 'Últimos 6 meses');
});

test('12 meses sustentam o Simulador: ao menos 3 rotas com 3 agentes de n>=3', () => {
  const r = S.simulate(D, S.inWindow(all, '12m', TODAY));
  const byRoute = {};
  for (const x of r.rows.filter((x) => x.n >= 3)) byRoute[x.route] = (byRoute[x.route] || 0) + 1;
  assert.ok(Object.values(byRoute).filter((k) => k >= 3).length >= 3, JSON.stringify(byRoute));
  // Nova York × Gamma só existe a mais de 12 meses: aparece só em "Todo o histórico".
  assert.ok(!r.rows.some((x) => x.route === 'newyork' && x.agent === 'gamma'));
  const tudo = S.simulate(D, S.inWindow(all, 'tudo', TODAY));
  assert.ok(tudo.rows.some((x) => x.route === 'newyork' && x.agent === 'gamma' && !x.small));
});

test('janela na URL e na visão salva; visão antiga (sem janela) abre com 12 meses', () => {
  assert.equal(S.readWindow(new URLSearchParams('janela=6m')), '6m');
  assert.equal(S.readWindow(new URLSearchParams('janela=tudo')), 'tudo');
  assert.equal(S.readWindow(new URLSearchParams('janela=xpto')), '12m');
  const old = { id: 'v0', name: 'Simulador antigo', query: 'aba=simulador&srota=genova&chegada=2026-11-02', mode: 'completa', hidden: { completa: [], objetiva: [] } };
  assert.equal(S.readWindow(new URLSearchParams(L.restoreView(old).query)), '12m');
  const v = L.captureView('6 meses', new URLSearchParams('aba=simulador&janela=6m&period=days30'), L.defaults(), E.FILTERS.map((f) => f.key));
  assert.equal(new URLSearchParams(L.restoreView(v).query).get('janela'), '6m');
  // A janela não é o período: trocar o período do painel não mexe nela.
  assert.equal(S.readWindow(new URLSearchParams('period=days30')), '12m');
});

test('relógio injetado: ?hoje= fixa o dia; sem ele vale a data local do relógio passado', () => {
  assert.equal(D.demoToday('?hoje=2027-01-15', new Date(2030, 0, 1)), '2027-01-15');
  assert.equal(D.demoToday('?embed=1&hoje=2026-02-30', new Date(2026, 9, 24, 9)), '2026-10-24'); // data inválida é ignorada
  assert.equal(D.demoToday('', new Date(2026, 9, 24, 23, 30)), '2026-10-24');
  // No Node o dataset fica na data-base, qualquer que seja o relógio real.
  assert.equal(D.cutoff, '2026-09-13');
  assert.equal(D.offsetDays, 0);
});

test('deslocamento: o corte vira o hoje e TODAS as diferenças entre datas se preservam', () => {
  const X = D.shift('2026-10-24');
  assert.equal(X.cutoff, '2026-10-24');
  assert.equal(X.offsetDays, 41);
  assert.equal(X.operations.length, D.operations.length);
  for (let i = 0; i < D.operations.length; i++) {
    const a = D.operations[i], b = X.operations[i];
    for (const k of D.DATE_FIELDS) {
      assert.equal(a[k] == null, b[k] == null, `${a.id} ${k}: nulo continua nulo`);
      if (a[k]) assert.equal(D.days(a[k], b[k]), 41, `${a.id} ${k}`);
    }
    if (a.depart && a.arrive) assert.equal(D.days(b.depart, b.arrive), D.days(a.depart, a.arrive));
    assert.equal(b.freight, a.freight);
  }
  assert.equal(D.operations[0].readyPlan, '2026-03-02', 'a fonte não muda');
  // Para trás também funciona, e a classificação do Simulador é a mesma.
  const Y = D.shift('2026-01-01');
  const res = (DD) => { const p = S.plan(DD, S.inWindow(DD.operations, '12m', DD.cutoff), S.readTask(DD, new URLSearchParams(''), DD.cutoff), DD.cutoff); return [p.state, p.coverToday, p.coverP90, p.coverMedian, S.diffDays(DD.cutoff, p.limitP90)]; };
  assert.deepEqual(res(X), res(D));
  assert.deepEqual(res(Y), res(D));
});

test('deslocado, o período padrão de 90 dias continua com os mesmos embarques e a base anterior', () => {
  const X = D.shift('2026-10-24');
  const range = (cut) => ({ start: S.addDays(cut, -89), end: cut });
  const cur = (DD) => E.inRange(DD.operations, range(DD.cutoff)).map((o) => o.id).sort();
  assert.deepEqual(cur(X), cur(D));
  assert.ok(cur(D).length >= 20);
  const prev = (DD) => E.inRange(DD.operations, E.previousRange(range(DD.cutoff))).map((o) => o.id).sort();
  assert.deepEqual(prev(X), prev(D));
  assert.ok(prev(D).length >= 20);
});

// v4 (13/11/2026): a coluna Resultado traz UMA frase com o porquê de cada linha.

// S3 (17/11/2026): cobertura empírica, a de b (F3: sem faixa "de 10").
test('cobertura: fração dos trânsitos que couberam na margem, inclusiva', () => {
  assert.deepEqual(S.coverage([30, 31, 32, 40], 32), { good: 3, base: 4, pct: 75 });
  assert.deepEqual(S.coverage([30, 31, 32, 40], 29), { good: 0, base: 4, pct: 0 });
  assert.deepEqual(S.coverage([], 10), { good: null, base: 0, pct: null });
  // F3: a escala "de 10" saiu; cobertura é sempre a contagem real a de b.
  assert.equal(S.coverageBand, undefined);
});
test('resultado padrão: exemplo preenchido, com limites P90/mediana e cobertura contada', () => {
  const t = S.readTask(D, new URLSearchParams(''), TODAY);
  const r = S.plan(D, S.inWindow(all, '12m', TODAY), t, TODAY);
  assert.equal(r.state, 'ok');
  assert.ok(r.coverP90.good / r.coverP90.base >= 0.9);
  assert.ok(r.coverMedian.good / r.coverMedian.base >= 0.5);
  assert.ok(r.limitP90 <= r.limitMedian);
  assert.ok(!/cabe|apertado|recomend|melhor|pior/i.test(JSON.stringify(Object.keys(r))));
});

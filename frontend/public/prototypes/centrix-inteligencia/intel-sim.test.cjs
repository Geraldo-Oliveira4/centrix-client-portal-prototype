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

test('classificação: Cabe (P90 cabe), Apertado (só a mediana), Não cabe (nem a mediana)', () => {
  assert.equal(S.classify(32, 32, 32), 'cabe');
  assert.equal(S.classify(32, 32, 33), 'apertado');
  assert.equal(S.classify(32, 33, 35), 'nao_cabe');
  const r = S.simulate(D, all, { arriveBy: '2026-10-15', today: TODAY }); // 32 dias
  assert.equal(r.state, 'ok');
  assert.equal(r.available, 32);
  assert.equal(row(r, 'ningbo', 'alpha').status, 'apertado'); // 32 / 33
  assert.equal(row(r, 'ningbo', 'gamma').status, 'cabe'); // 32 / 32
  assert.equal(row(r, 'shanghai', 'beta').status, 'nao_cabe'); // 34 / 37
  assert.equal(row(r, 'newyork', 'delta').status, 'cabe');
  assert.deepEqual(r.counts, { cabe: 10, apertado: 2, nao_cabe: 3, small: 0 });
});

test('data limite de embarque = data desejada − P90 (com folga) e − mediana (no limite)', () => {
  const r = S.simulate(D, all, { arriveBy: '2026-10-31', today: TODAY });
  const beta = row(r, 'shanghai', 'beta');
  assert.equal(beta.median, 34);
  assert.equal(beta.p90, 37);
  assert.equal(beta.departBySafe, '2026-09-24');
  assert.equal(beta.departByMedian, '2026-09-27');
  assert.equal(beta.arrivalFrom, S.addDays(TODAY, 34));
  assert.equal(beta.arrivalTo, S.addDays(TODAY, 37));
  assert.deepEqual(S.departureLabel('2026-09-24', TODAY), { text: 'Até a semana de 21/09', passed: false });
  assert.deepEqual(S.departureLabel(TODAY, TODAY), { text: 'Esta semana', passed: false }); // ainda dá para embarcar nesta semana
  assert.deepEqual(S.departureLabel('2026-09-01', TODAY), { text: 'Já passou', passed: true });
  // Mediana fracionária arredonda para cima nas datas (lado conservador).
  const frac = S.simulate(D, [{ route: 'ningbo', agent: 'alpha', depart: '2026-01-01', arrive: '2026-01-11' }, { route: 'ningbo', agent: 'alpha', depart: '2026-01-01', arrive: '2026-01-12' }, { route: 'ningbo', agent: 'alpha', depart: '2026-01-01', arrive: '2026-01-11' }, { route: 'ningbo', agent: 'alpha', depart: '2026-01-01', arrive: '2026-01-12' }], { arriveBy: '2026-10-01', today: TODAY });
  assert.equal(frac.rows[0].median, 10.5);
  assert.equal(frac.rows[0].departByMedian, S.addDays('2026-10-01', -11));
});

test('amostra pequena: menos de 3 trânsitos não estima; 3 já estima', () => {
  const pair = all.filter((o) => o.route === 'genova' && o.agent === 'alpha' && o.depart && o.arrive);
  const two = S.simulate(D, pair.slice(0, 2), { arriveBy: '2026-11-30', today: TODAY });
  assert.equal(two.rows[0].small, true);
  assert.equal(two.rows[0].status, 'small');
  assert.equal(two.rows[0].median, null);
  assert.equal(two.state, 'all_small');
  const three = S.simulate(D, pair.slice(0, 3), { arriveBy: '2026-11-30', today: TODAY });
  assert.equal(three.rows[0].small, false);
  assert.equal(three.rows[0].status, 'cabe');
  // Embarque sem chegada conta como embarque, não como trânsito.
  const open = all.filter((o) => o.route === 'genova' && o.agent === 'alpha');
  const r = S.simulate(D, open, { arriveBy: '2026-11-30', today: TODAY });
  assert.equal(r.rows[0].shipments, open.length);
  assert.equal(r.rows[0].n, open.filter((o) => o.depart && o.arrive).length);
});

test('estados vazios: sem data, data passada, sem histórico, tudo pequeno, nada cabe', () => {
  assert.equal(S.simulate(D, all, { arriveBy: '', today: TODAY }).state, 'no_date');
  assert.equal(S.simulate(D, all, { arriveBy: '2026-13-40', today: TODAY }).state, 'no_date');
  assert.equal(S.simulate(D, all, { arriveBy: TODAY, today: TODAY }).state, 'past');
  assert.equal(S.simulate(D, all, { arriveBy: '2026-09-01', today: TODAY }).state, 'past');
  const beta = all.filter((o) => o.agent === 'beta');
  const none = S.simulate(D, beta, { route: 'ningbo', arriveBy: '2026-10-18', today: TODAY });
  assert.equal(none.state, 'no_history');
  assert.deepEqual(none.rows, []);
  assert.equal(S.simulate(D, [], { arriveBy: '2026-10-18', today: TODAY }).state, 'no_history');
  const last90 = all.filter((o) => o.readyPlan >= '2026-06-16');
  assert.equal(S.simulate(D, last90, { arriveBy: '2026-10-18', today: TODAY }).state, 'all_small');
  const close = S.simulate(D, all, { arriveBy: '2026-09-30', today: TODAY }); // 17 dias: nada chega
  assert.equal(close.state, 'all_nao_cabe');
  assert.equal(close.earliestArrival, S.addDays(TODAY, 18)); // Nova York, mediana 18
});

test('rota opcional restringe; filtros globais já chegam aplicados nos embarques', () => {
  const r = S.simulate(D, all, { route: 'shanghai', arriveBy: '2026-10-31', today: TODAY });
  assert.deepEqual(r.rows.map((x) => x.agent).sort(), ['alpha', 'beta', 'delta']);
  const fob = E.applyFilters(all, E.readFilters(new URLSearchParams('inc=CIF')));
  assert.ok(S.simulate(D, fob, { arriveBy: '2026-10-31', today: TODAY }).rows.every((x) => fob.some((o) => o.route === x.route && o.agent === x.agent)));
});

test('ordenação: volume por padrão, amostra pequena no fim, clique inverte', () => {
  const r = S.simulate(D, all, { arriveBy: '2026-10-31', today: TODAY });
  const sorted = S.sortSimRows(r.rows);
  assert.equal(sorted[0].route + sorted[0].agent, 'shanghaibeta'); // 10 embarques
  for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i - 1].shipments >= sorted[i].shipments);
  const byMed = S.sortSimRows(r.rows, { key: 'median', dir: 'asc' });
  assert.equal(byMed[0].route, 'newyork');
  const withSmall = [...r.rows, { route: 'x', agent: 'y', routeName: 'Aaa', agentName: 'Zz', shipments: 99, n: 1, small: true, median: null, p90: null }];
  assert.equal(S.sortSimRows(withSmall, { key: 'median', dir: 'desc' }).at(-1).small, true);
  assert.equal(S.sortSimRows(withSmall, { key: 'median', dir: 'asc' }).at(-1).small, true);
  assert.deepEqual(S.nextSort(S.DEFAULT_SORT, 'shipments'), { key: 'shipments', dir: 'asc' });
  assert.deepEqual(S.nextSort(S.DEFAULT_SORT, 'route'), { key: 'route', dir: 'asc' });
});

test('dado, não veredito: nada de custo, score ou recomendação no resultado', () => {
  const r = S.simulate(D, all, { arriveBy: '2026-10-15', today: TODAY });
  // Os nomes da fixture ("Gamma Freight") ficam fora: o que se checa são as CHAVES e os rótulos.
  const text = JSON.stringify(r.rows.map((x) => Object.keys(x))) + JSON.stringify(S.STATUS) + JSON.stringify(S.COLUMNS);
  assert.ok(!/freight|saving|economia|custo|score|recomend|melhor|pior/i.test(text));
  assert.ok(!r.rows.some((x) => 'freight' in x || 'cost' in x));
});

test('entradas na URL: rota válida, data desejada com padrão de 32 dias; viajam na visão salva', () => {
  const p = new URLSearchParams('aba=simulador&srota=genova&chegada=2026-11-02');
  assert.deepEqual(S.readInputs(D, p), { route: 'genova', arriveBy: '2026-11-02', explicit: true, window: '12m' });
  assert.deepEqual(S.readInputs(D, new URLSearchParams('srota=lua')), { route: '', arriveBy: S.addDays(TODAY, 32), explicit: false, window: '12m' });
  const v = L.captureView('Meu cenário', p, L.defaults(), E.FILTERS.map((f) => f.key));
  assert.equal(new URLSearchParams(v.query).get('chegada'), '2026-11-02');
  assert.equal(new URLSearchParams(v.query).get('srota'), 'genova');
  const how = S.howCalculated(D, {}, 'Este ano').map((l) => l.label);
  assert.deepEqual(how, ['Fonte', 'Fórmula', 'Histórico', 'Filtros que se aplicam']);
});

// ---------------------------------------------------------------------------
// Janela própria do Simulador e relógio da demonstração (24/10/2026)

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
  const r = S.simulate(D, S.inWindow(all, '12m', TODAY), { arriveBy: '2026-10-31', today: TODAY });
  const byRoute = {};
  for (const x of r.rows.filter((x) => x.n >= 3)) byRoute[x.route] = (byRoute[x.route] || 0) + 1;
  assert.ok(Object.values(byRoute).filter((k) => k >= 3).length >= 3, JSON.stringify(byRoute));
  assert.equal(r.state, 'ok');
  // Nova York × Gamma só existe a mais de 12 meses: aparece só em "Todo o histórico".
  assert.ok(!r.rows.some((x) => x.route === 'newyork' && x.agent === 'gamma'));
  const tudo = S.simulate(D, S.inWindow(all, 'tudo', TODAY), { arriveBy: '2026-10-31', today: TODAY });
  assert.ok(tudo.rows.some((x) => x.route === 'newyork' && x.agent === 'gamma' && !x.small));
});

test('12 meses abre com os três resultados (Cabe, Apertado, Não cabe) na data padrão relativa', () => {
  const r = S.simulate(D, S.inWindow(all, '12m', TODAY), { arriveBy: S.readInputs(D, new URLSearchParams('')).arriveBy, today: TODAY });
  assert.ok(r.counts.cabe > 0 && r.counts.apertado > 0 && r.counts.nao_cabe > 0, JSON.stringify(r.counts));
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
  const rx = S.simulate(X, S.inWindow(X.operations, '12m', X.cutoff), { arriveBy: S.addDays(X.cutoff, 32), today: X.cutoff });
  const ry = S.simulate(Y, S.inWindow(Y.operations, '12m', Y.cutoff), { arriveBy: S.addDays(Y.cutoff, 32), today: Y.cutoff });
  const base = S.simulate(D, S.inWindow(all, '12m', TODAY), { arriveBy: S.addDays(TODAY, 32), today: TODAY });
  assert.deepEqual(rx.counts, base.counts);
  assert.deepEqual(ry.counts, base.counts);
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

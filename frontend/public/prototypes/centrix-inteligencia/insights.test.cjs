const { test } = require('node:test');
const assert = require('node:assert/strict');
const D = require('./data.js');
const Insights = require('./insights.js');

test('variação de taxa em pontos, com o lado bom certo', () => {
  assert.deepEqual(Insights.variation(80, 65, 'pp', true, 'julho'), {
    delta: 15, direction: 'up', tone: 'good', text: '15 pontos acima de julho',
  });
  assert.equal(Insights.variation(40, 45, 'pp', true, 'julho').tone, 'bad');
  assert.equal(Insights.variation(40, 40, 'pp', true, 'julho').text, 'igual a julho');
  assert.equal(Insights.variation(41, 40, 'pp', true, 'julho').text, '1 ponto acima de julho');
});

test('frete não tem lado bom: seta sem cor', () => {
  const v = Insights.variation(30000, 33000, 'pct', null, 'julho');
  assert.equal(v.tone, 'neutral');
  assert.equal(v.text, '9% abaixo de julho');
});

test('sem os dois lados não há comparação, e nunca vira zero', () => {
  assert.equal(Insights.variation(null, 50, 'pp', true, 'julho'), null);
  assert.equal(Insights.variation(50, null, 'pp', true, 'julho'), null);
  assert.equal(Insights.variation(50, 0, 'pct', null, 'julho'), null);
});

test('o número do card é o mesmo D.metric de sempre', () => {
  const ops = D.operations;
  for (const key of ['ready', 'port', 'final']) {
    assert.equal(Insights.card(D, key, ops).value, D.metric(key, ops).rate, key);
  }
  assert.equal(Insights.card(D, 'freight', ops).value, D.metric('freight', ops).total);
});

test('a variação é a do gráfico de evolução: último par de meses com base', () => {
  const ops = D.operations;
  const [prev, cur] = Insights.comparablePair(D, 'ready', ops);
  const rate = (m) => D.metric('ready', ops.filter((o) => o.readyPlan.slice(5, 7) === m)).rate;
  const card = Insights.card(D, 'ready', ops);
  assert.equal(card.latest.value, rate(cur));
  assert.equal(card.variation.delta, rate(cur) - rate(prev));
  assert.match(card.sentence, new RegExp(`${card.value}%`));
});

test('todas as frases em linguagem do cliente, sem "undefined"', () => {
  for (const key of ['ready', 'port', 'final', 'freight', 'docs']) {
    const c = Insights.card(D, key, D.operations);
    assert.ok(c.sentence.length > 20, key);
    assert.ok(!/undefined|NaN/.test(c.sentence), key);
  }
});

test('a rota que pesa mais tem taxa abaixo do total e base mínima', () => {
  const ops = D.operations;
  const overall = D.metric('port', ops).rate;
  const worst = Insights.worstRoute(D, 'port', ops, overall);
  if (worst) {
    assert.ok(worst.rate < overall);
    assert.ok(worst.eligible >= 2);
    assert.match(worst.text, /no prazo/);
  }
});

test('recorte vazio diz que falta base, sem número', () => {
  const c = Insights.card(D, 'ready', []);
  assert.equal(c.value, null);
  assert.match(c.sentence, /Sem base/);
});

test('mês com menos de 3 elegíveis não entra na comparação', () => {
  const ops = D.operations;
  const pair = Insights.comparablePair(D, 'port', ops);
  for (const m of pair) {
    const n = D.metric('port', ops.filter((o) => o.readyPlan.slice(5, 7) === m)).eligible.length;
    assert.ok(n >= Insights.MIN_BASE, m);
  }
  const card = Insights.card(D, 'port', ops);
  assert.match(card.detail, /de \d+ no prazo/);
});

// --- Conclusões (Inteligência em blocos, 01/10/2026) -----------------------

test('a conclusão sai da variação, nunca de texto fixo', () => {
  const up = Insights.variation(80, 65, 'pp', true, 'julho');
  const down = Insights.variation(40, 53, 'pp', true, 'junho');
  assert.match(Insights.conclude('ready', up), /melhorando/);
  assert.match(Insights.conclude('port', down), /piorando/);
  assert.match(Insights.conclude('final', Insights.variation(40, 40, 'pp', true, 'julho')), /estável/);
  assert.equal(Insights.conclude('ready', null), Insights.NO_CHANGE);
  // Frete não tem lado bom: descreve, não julga.
  const freight = Insights.conclude('freight', Insights.variation(30000, 33000, 'pct', null, 'julho'));
  assert.match(freight, /menos frete/);
  assert.doesNotMatch(freight, /melhorando|piorando/);
});

test('os quatro cards do Resumo: métrica + variação + conclusão no resumo', () => {
  for (const key of ['ready', 'port', 'final', 'freight']) {
    const c = Insights.card(D, key, D.operations);
    assert.ok(c.conclusion && !/undefined|NaN/.test(c.summary), key);
    if (c.variation) assert.ok(c.summary.includes(c.variation.text), key);
    else assert.ok(c.summary.includes('sem comparação'), key);
  }
});

test('prazos: o trecho que mais estoura, com a conta conferível', () => {
  const ops = D.operations;
  const s = Insights.stageInsight(D, ops);
  const stage = D.stages.find((x) => x.label === s.title);
  const done = ops.filter((o) => o[stage.from] && o[stage.to]);
  const over = done.filter((o) => D.days(o[stage.from], o[stage.to]) > stage.plan(o));
  assert.equal(s.value, Math.round((over.length / done.length) * 100));
  assert.ok(s.metric.startsWith(`${over.length} de ${done.length}`));
  for (const other of D.stages) {
    const d = ops.filter((o) => o[other.from] && o[other.to]);
    const n = d.filter((o) => D.days(o[other.from], o[other.to]) > other.plan(o)).length;
    if (d.length) assert.ok(Math.round((n / d.length) * 100) <= s.value, other.id);
  }
  assert.equal(Insights.stageInsight(D, []).conclusion, Insights.NO_CHANGE);
});

test('fornecedores: sem variação mensal comparável, não inventa piora', () => {
  const s = Insights.supplierInsight(D, D.operations);
  const anyChange = D.companies.some((c) => Insights.card(D, 'ready', D.operations.filter((o) => o.supplier === c.id)).variation);
  if (!anyChange) assert.equal(s.conclusion, Insights.NO_CHANGE);
  assert.match(s.metric, /Eastbridge/);
});

test('agentes: concentração, nunca nota de agente', () => {
  const a = Insights.agentInsight(D, D.operations);
  assert.match(a.metric, /concentrou \d+ de \d+ contratações/);
  assert.doesNotMatch(`${a.metric} ${a.conclusion}`, /no prazo|pontual|confiab|nota|score/i);
  if (a.variation) assert.equal(a.variation.tone, 'neutral');
});

test('rotas: a que mais trava tem o maior desvio médio; abaixo de 1 dia não é trava', () => {
  const r = Insights.routeInsight(D, D.operations);
  if (r.relevant) assert.match(r.metric, /desvio médio de \+\d/);
  const none = Insights.routeInsight(D, D.operations.map((o) => ({ ...o, arrive: o.arrive && o.arrivePlan })));
  assert.equal(none.conclusion, Insights.NO_CHANGE);
});

test('locais: só afirma espera quando o excesso médio passa de 1 dia', () => {
  const l = Insights.localInsight(D, D.operations);
  assert.match(l.metric, /entre a chegada e o gate out \(previsto 3\)/);
  const avg = Number(l.metric.match(/média de ([\d,]+) dias/)[1].replace(',', '.'));
  assert.equal(l.relevant, avg - 3 >= 1);
  if (!l.relevant) assert.equal(l.conclusion, Insights.NO_CHANGE);
});

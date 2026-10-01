const { test } = require('node:test');
const assert = require('node:assert/strict');
const D = require('./data.js');
const Insights = require('./insights.js');

const MONTHS = { '06': 'junho', '07': 'julho', '08': 'agosto' };
const cap = (t) => t[0].toUpperCase() + t.slice(1);
const monthOf = (o) => o.readyPlan.slice(5, 7);
const ALL = ['stageInsight', 'supplierInsight', 'agentInsight', 'routeInsight', 'localInsight'];

// --- Variação -----------------------------------------------------------------

test('variação de taxa em p.p., com o lado bom certo', () => {
  assert.deepEqual(Insights.variation(80, 65, 'pp', true, 'julho'), {
    delta: 15, direction: 'up', tone: 'good', stable: false, text: '15 p.p. acima de julho',
  });
  assert.equal(Insights.variation(40, 45, 'pp', true, 'julho').tone, 'bad');
  assert.equal(Insights.variation(40, 40, 'pp', true, 'julho').text, 'igual a julho');
  assert.equal(Insights.variation(41, 40, 'pp', true, 'julho').text, '1 p.p. acima de julho');
});

test('abaixo de 5 a variação é estável: seta sem cor', () => {
  const v = Insights.variation(43, 40, 'pp', true, 'junho');
  assert.equal(v.stable, true);
  assert.equal(v.tone, 'neutral');
  assert.equal(Insights.conclude('port', v), 'Estável.');
  assert.equal(Insights.variation(45, 40, 'pp', true, 'junho').stable, false);
});

test('frete não tem lado bom: seta sem cor, conclusão descritiva', () => {
  const v = Insights.variation(30000, 33000, 'pct', null, 'julho');
  assert.equal(v.tone, 'neutral');
  assert.equal(v.text, '9% abaixo de julho');
  assert.equal(Insights.conclude('freight', v), 'Menos frete que no mês anterior.');
});

test('sem os dois lados não há comparação, e nunca vira zero', () => {
  assert.equal(Insights.variation(null, 50, 'pp', true, 'julho'), null);
  assert.equal(Insights.variation(50, null, 'pp', true, 'julho'), null);
  assert.equal(Insights.variation(50, 0, 'pct', null, 'julho'), null);
  assert.equal(Insights.conclude('ready', null), Insights.NO_CHANGE);
});

// --- Mês de referência ----------------------------------------------------------

test('o mês de referência é o último mês fechado; o anterior vem logo antes', () => {
  const ops = D.operations;
  const [prev, cur] = Insights.referencePair(D);
  assert.ok(ops.filter((o) => monthOf(o) === cur).every((o) => o.final), 'fechado');
  const later = ops.filter((o) => monthOf(o) > cur);
  assert.ok(!later.length || later.some((o) => !o.final), 'nenhum mês depois dele está fechado');
  assert.ok(prev < cur);
});

test('os quatro cards do Resumo usam o MESMO mês e o mesmo formato', () => {
  const [prev, cur] = Insights.referencePair(D);
  for (const key of ['ready', 'port', 'final', 'freight']) {
    const c = Insights.card(D, key, D.operations);
    assert.ok(c.summary.startsWith(`${cap(MONTHS[cur])}: `), key);
    assert.ok(c.summary.endsWith(c.conclusion), key);
    if (c.variation) assert.ok(c.summary.includes(`, ${c.variation.text}. `) && c.variation.text.endsWith(MONTHS[prev]), key);
  }
});

test('o número do card continua sendo o D.metric do período', () => {
  const ops = D.operations;
  for (const key of ['ready', 'port', 'final']) assert.equal(Insights.card(D, key, ops).value, D.metric(key, ops).rate, key);
  assert.equal(Insights.card(D, 'freight', ops).value, D.metric('freight', ops).total);
});

test('a variação do card é a do mês de referência contra o anterior', () => {
  const ops = D.operations;
  const [prev, cur] = Insights.referencePair(D);
  const rate = (k, m) => D.metric(k, ops.filter((o) => monthOf(o) === m)).rate;
  for (const key of ['ready', 'port', 'final']) {
    const c = Insights.card(D, key, ops);
    assert.equal(c.latest.value, rate(key, cur), key);
    assert.equal(c.variation.delta, rate(key, cur) - rate(key, prev), key);
  }
});

test('o fixture deixa o Resumo misto: melhora, estável, piora e frete', () => {
  const c = (k) => Insights.card(D, k, D.operations);
  assert.equal(c('ready').conclusion, 'Melhorando.');
  assert.equal(c('port').conclusion, 'Estável.');
  assert.ok(Math.abs(c('port').variation.delta) < Insights.STABLE_BELOW);
  assert.equal(c('final').conclusion, 'Piorando.');
  assert.match(c('freight').conclusion, /frete que no mês anterior/);
});

test('sem comparação, a frase diz o motivo em vez de omitir', () => {
  const [, cur] = Insights.referencePair(D);
  const keep = D.operations.find((o) => monthOf(o) === cur);
  const thin = D.operations.filter((o) => monthOf(o) !== cur || o === keep);
  const c = Insights.card(D, 'port', thin);
  assert.equal(c.variation, null);
  assert.match(c.summary, /^Julho: .*; sem comparação com junho: o mês tem menos de 3 operações elegíveis\. /);
  assert.equal(c.conclusion, Insights.NO_CHANGE);
});

test('recorte vazio diz que falta base, sem número', () => {
  const c = Insights.card(D, 'ready', []);
  assert.equal(c.value, null);
  assert.match(c.summary, /Sem base/);
});

// --- Cards de conclusão -----------------------------------------------------------

test('todo card tem frase "<Mês>: <valor>, <variação>. <Conclusão>." ou o motivo', () => {
  const [, cur] = Insights.referencePair(D);
  for (const f of ALL) {
    const x = Insights[f](D, D.operations);
    assert.ok(x.summary.startsWith(`${cap(MONTHS[cur])}: `), f);
    assert.ok(x.summary.endsWith(x.conclusion), f);
    assert.ok(x.variation ? x.summary.includes(x.variation.text) : /sem comparação com/.test(x.summary), f);
    assert.ok(!/undefined|NaN/.test(`${x.summary} ${x.note}`), f);
  }
});

test('prazos: o trecho do título é o que mais estoura no período', () => {
  const ops = D.operations;
  const s = Insights.stageInsight(D, ops);
  const rate = (st) => {
    const d = ops.filter((o) => o[st.from] && o[st.to]);
    return d.length ? d.filter((o) => D.days(o[st.from], o[st.to]) > st.plan(o)).length / d.length : 0;
  };
  const stage = D.stages.find((x) => x.label === s.title);
  for (const other of D.stages) assert.ok(rate(other) <= rate(stage), other.id);
  assert.ok(s.summary.includes(stage.label.toLowerCase()));
  assert.match(s.note, /No período/);
});

test('agentes: concentração, nunca nota de agente', () => {
  const a = Insights.agentInsight(D, D.operations);
  assert.match(a.summary, /das contratações \(\d+ de \d+\)/);
  assert.doesNotMatch(`${a.summary} ${a.note}`, /no prazo|pontual|confiab|nota|score/i);
  if (a.variation) assert.equal(a.variation.tone, 'neutral');
});

test('amostra pequena: a frase traz a contagem e a conclusão é linguagem de dado', () => {
  for (const f of ['routeInsight', 'localInsight']) {
    const x = Insights[f](D, D.operations);
    assert.match(x.summary, /\(\d+ (chegadas?|passagens?)\)/, f);
    assert.doesNotMatch(`${x.summary} ${x.note}`, /trava|sua operação/, f);
  }
  const r = Insights.routeInsight(D, D.operations);
  assert.match(r.note, /maior desvio médio/);
  const n = Number(r.note.match(/em (\d+) operações/)?.[1] ?? Insights.SMALL_SAMPLE);
  assert.ok(n < Insights.SMALL_SAMPLE || !/em \d+ operações/.test(r.note));
});

test('rotas: abaixo de 1 dia de desvio médio não é achado', () => {
  const none = Insights.routeInsight(D, D.operations.map((o) => ({ ...o, arrive: o.arrive && o.arrivePlan })));
  assert.equal(none.conclusion, Insights.NO_CHANGE);
});

test('a rota que pesa mais tem taxa abaixo do total e base mínima', () => {
  const ops = D.operations;
  const overall = D.metric('port', ops).rate;
  const worst = Insights.worstRoute(D, 'port', ops, overall);
  if (worst) {
    assert.ok(worst.rate < overall);
    assert.ok(worst.eligible >= 2);
  }
});

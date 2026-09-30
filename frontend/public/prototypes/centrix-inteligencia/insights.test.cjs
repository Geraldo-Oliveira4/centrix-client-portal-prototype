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

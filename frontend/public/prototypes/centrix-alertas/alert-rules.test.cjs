const { test } = require('node:test');
const assert = require('node:assert/strict');
const rules = require('./alert-rules.js');
const data = require('./alert-data.js');
test('Delay needs a passed captured deadline; an ETA revision alone is insufficient', () => {
  const now = '2026-09-11T09:20:00-03:00';
  assert.equal(rules.matchesJob(data.find(x => x.id === 'docs'), 'delays', now), true);
  assert.equal(rules.matchesJob(data.find(x => x.id === 'eta'), 'delays', now), false);
  assert.equal(rules.matchesJob(data.find(x => x.id === 'booking'), 'delays', now), false);
  assert.equal(rules.matchesJob({...data[0], deadlineAt:'2026-09-12T14:00:00-03:00'}, 'delays', now), false);
  assert.equal(rules.matchesJob({...data[0], group:'history'}, 'delays', now), false);
});
test('No cost risk is inferred from discharge or unknown free time', () => {
  assert.equal(data.some(x => rules.matchesJob(x, 'costs', '2026-09-11T09:20:00-03:00')), false);
});
test('Quotation alert opens its quotation without requiring a shipment', () => {
  const quote = data.find(x => x.id === 'quote-offer');
  assert.equal(quote.shipment, null);
  assert.deepEqual(rules.destination(quote), {kind:'cotacao', reference:'COT-DEMO-140', label:'Ver cotação', href:'#cotacao/quote-offer'});
});
test('Explicit alert context wins even when both quotation and shipment are linked', () => {
  const item = {id:'mixed',context:'cotacao',quote:'Q-1',shipment:'S-1'};
  assert.equal(rules.destination(item).kind, 'cotacao');
  assert.equal(rules.destination({...item,context:'embarque'}).reference, 'S-1');
});
test('A missing linked record does not invent an alternate destination', () => {
  assert.equal(rules.destination({context:'cotacao',shipment:'S-1'}), null);
  assert.equal(rules.destination({context:'unknown',quote:'Q-1'}), null);
});
const task = { id: 'docs', type: 'documentos', group: 'action', owner: 'client', deadline: 'Hoje, até 14h', shipment: 'A', rank: 1 };
test('Marking read preserves color and operational priority', () => {
  const seen = { ...task, read: true };
  assert.equal(rules.tone(seen), rules.tone(task));
  assert.equal(rules.tier(seen), rules.tier(task));
});
test('Missing free time and responsibility must not imply urgency', () => {
  assert.equal(rules.tone({ type: 'demurrage', group: 'action', owner: 'unknown', deadline: null }), 'blue');
});
test('Green document event means upload received, without a presumed content review', () => {
  const received = data.find(x => x.id === 'done');
  assert.equal(rules.tone(received), 'green');
  assert.match(received.title, /anexada/);
  assert.match(received.impact, /não conteúdo aprovado/);
});
test('Every displayed alert identifies capture data, trigger and outstanding integration dependency', () => {
  for (const x of data) {
    for (const field of ['source', 'fields', 'trigger', 'dependency']) assert.ok(x[field]?.length > 15, `${x.id}: ${field}`);
    assert.notEqual(x.person, 'Operação Freitas');
    assert.notEqual(x.owner, 'external');
  }
});
test('No price or demurrage alert is generated without a validated source', () => {
  assert.equal(data.filter(x => ['demurrage', 'preco'].includes(x.type)).length, 0);
});
test('Discharge never supplies arrival, pickup availability or a manual release action', () => {
  const discharge = data.find(x => x.id === 'release');
  assert.match(discharge.fields, /event = DISC, status = ACT, timestamp/);
  assert.equal(discharge.arrival, null);
  assert.equal(discharge.group, 'change');
  assert.match(discharge.explain, /Não informa disponibilidade/);
});
test('Action comes before updates on a priority shipment', () => {
  const update = { group: 'change', type: 'eta', shipment: 'B', rank: 1 };
  assert.ok(rules.compare(task, update, new Set(['B'])) < 0);
});
test('Completed occurrences remain after open tasks even if their shipment is priority', () => {
  assert.ok(rules.compare({ ...task, group: 'history' }, { ...task, shipment: 'B' }, new Set(['A'])) > 0);
});
test('Radar is distinct from operational completion and client approval without deadline is amber', () => {
  assert.equal(rules.tone({ group: 'change', type: 'preco' }), 'purple');
  assert.equal(rules.tone({ ...task, type: 'aprovacao', deadline: null }), 'amber');
});

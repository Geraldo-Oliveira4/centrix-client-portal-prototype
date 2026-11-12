// Relógio da Central de trabalho: o "hoje" é injetado pelo `location.search` do
// contexto (?hoje=), e nenhum teste depende da data real.
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');

const root = resolve(__dirname, '../../../../public/prototypes/centrix-visao-geral');

function scenario(search) {
  const context = vm.createContext(
    search === undefined ? {} : { location: { search }, URLSearchParams },
  );
  vm.runInContext(readFileSync(resolve(root, 'data.js'), 'utf8') + `
    const processes = INITIAL_PROCESSES;
    const state = {eventReviews:[],drafts:{},read:[],owner:'all',workModule:'all',workKind:'all',flag:'all',search:''};
  ` + readFileSync(resolve(root, 'work.js'), 'utf8'), context);
  return (code) => vm.runInContext(code, context);
}

test('sem location (testes): a carteira fica na data-base', () => {
  const run = scenario();
  assert.equal(run('DEMO_DAY'), '2026-09-10');
  assert.equal(run("processes.find(p=>p.id==='PR-26043').waiting.expected"), '2026-09-11T09:00:00-03:00');
});

test('?hoje= desloca datas ISO, previsões e textos pelo mesmo número de dias', () => {
  const run = scenario('?hoje=2026-11-12');
  assert.equal(run('DEMO_DAY'), '2026-11-12');
  assert.equal(run('NOW.toISOString()'), '2026-11-12T13:30:00.000Z');
  assert.equal(run("processes.find(p=>p.id==='PR-26043').waiting.expected"), '2026-11-13T09:00:00-03:00');
  const reprogrammed = run("JSON.stringify(processes.find(p=>p.id==='PR-26018').events[0])");
  assert.match(reprogrammed, /A nova previsão é 19\/11/);
  assert.match(reprogrammed, /"before":"16 nov","after":"19 nov"/);
  assert.equal(run("demoText('15 set 2026')"), '17 nov 2026');
  assert.equal(run("demoText('PO 1861 · R$ 1.200')"), 'PO 1861 · R$ 1.200');
});

test('nenhum "hoje" congelado: nada da carteira fica em setembro de 2026', () => {
  const run = scenario('?hoje=2026-11-12');
  const all = run('JSON.stringify(processes)');
  assert.doesNotMatch(all, /2026-09|\b\d{2}\/09\b|\b\d{1,2} set\b/);
});

test('mesma fila e mesmos vencimentos em qualquer dia: as diferenças não mudam', () => {
  for (const search of [undefined, '?hoje=2026-11-12', '?hoje=2027-03-01']) {
    const run = scenario(search);
    assert.equal(run('workItems().length'), 9, String(search));
    assert.equal(run("workItems().filter(w=>urgency(w)==='overdue').length"), 2, String(search));
    assert.equal(run("workItems().filter(w=>urgency(w)==='today').length") > 0, true, String(search));
  }
});

test('?hoje= inválido cai na data local, nunca na data-base', () => {
  const run = scenario('?hoje=2026-02-30');
  assert.notEqual(run('DEMO_DAY'), '2026-02-30');
  assert.match(run('DEMO_DAY'), /^\d{4}-\d{2}-\d{2}$/);
});

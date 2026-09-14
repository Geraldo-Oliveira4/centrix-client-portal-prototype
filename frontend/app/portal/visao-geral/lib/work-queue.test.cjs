const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');

function scenario() {
  const root = resolve(__dirname, '../../../../public/prototypes/centrix-visao-geral');
  const context = vm.createContext({});
  vm.runInContext(readFileSync(resolve(root, 'data.js'), 'utf8') + `
    const processes = INITIAL_PROCESSES;
    const state = {eventReviews:[],drafts:{},read:[],owner:'all',workModule:'all',workKind:'all',flag:'all',search:''};
  ` + readFileSync(resolve(root, 'work.js'), 'utf8'), context);
  return code => vm.runInContext(code, context);
}

test('fila contém trabalho dos três módulos, sem transformar trânsito normal em tarefa', () => {
  const run = scenario();
  assert.equal(run('workItems().length'), 9);
  assert.equal(run('new Set(workItems().map(w=>w.module)).size'), 3);
  assert.equal(run("workItems().some(w=>w.p.id==='PR-26035')"), false);
});
test('falta de prazo de resposta não gera vencimento nem herda data da viagem', () => {
  const run = scenario();
  assert.equal(run("urgency(workItems().find(w=>w.p.id==='PR-26006'))"), 'undated');
  assert.equal(run("workItems().filter(w=>urgency(w)==='overdue').length"), 2);
});
test('rascunho e leitura não concluem espera nem inventam um contato realizado', () => {
  const run = scenario();
  run("state.drafts['PR-26027']={recipient:'teste@example.com',message:'Pedido'};state.read=['PR-26027'];");
  assert.equal(run('workItems().length'), 9);
  assert.equal(run("processes.find(p=>p.id==='PR-26027').waiting.lastContact"), '2026-09-09T15:00:00-03:00');
});
test('revisar chegada remove só a revisão e uma nova previsão a reabre', () => {
  const run = scenario();
  run("const p=processes.find(p=>p.id==='PR-26018');state.eventReviews.push(changeKey(p));");
  assert.equal(run('workItems().length'), 8);
  assert.equal(run('p.risk'), true);
  run("p.date='2026-09-18';");
  assert.equal(run('workItems().length'), 9);
});
test('filtros combinam módulo, responsável e busca sem acento', () => {
  const run = scenario();
  run("state.workModule='Auditoria';state.owner='Beatriz';state.search='fatura';");
  assert.equal(run('filteredWork().length'), 1);
  assert.equal(run('filteredWork()[0].p.id'), 'PR-26006');
  run("state.flag='overdue';");
  assert.equal(run('filteredWork().length'), 0);
  run("state.flag='all';state.owner='all';state.workModule='Cotações';state.search='orcamento';");
  assert.equal(run('filteredWork().length'), 1);
});

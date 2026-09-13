const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {resolve} = require('node:path');
const vm = require('node:vm');
function scenario(){
  const root=resolve(__dirname,'../../../../public/prototypes/centrix-visao-geral');
  const context=vm.createContext({document:{addEventListener(){}}});
  vm.runInContext(readFileSync(resolve(root,'data.js'),'utf8')+`
    const processes=INITIAL_PROCESSES;
    const state={profile:'Mariana',opScope:'all',eventReviews:[],drafts:{},read:[],owner:'all',workModule:'all',workKind:'all',flag:'all',search:''};
    const dayDiff=(a,b)=>Math.round((new Date(a+'T12:00:00-03:00')-new Date(b+'T12:00:00-03:00'))/86400000);
  `+readFileSync(resolve(root,'work.js'),'utf8')+readFileSync(resolve(root,'operation.js'),'utf8'),context);
  return code=>vm.runInContext(code,context);
}
test('panorama includes quiet records and counts lots separately from POs',()=>{
  const run=scenario();
  assert.equal(run('operationRecords().length'),16);
  assert.equal(run('operationFronts().reduce((n,f)=>n+f.items.length,0)'),16);
  assert.equal(run('operationFronts().reduce((n,f)=>n+f.pending.length+f.quiet+f.missing.length,0)'),16);
  assert.equal(run('new Set(operationRecords().map(p=>p.po)).size'),15);
  assert.equal(run('operationWork().length'),9);
});
test('solo scope changes portfolio and dependencies without changing personal work state',()=>{
  const run=scenario();run("state.opScope='mine';");
  assert.equal(run('operationRecords().every(p=>p.owner===state.profile)'),true);
  assert.equal(run('operationGroups().team'),false);
  assert.equal(run('operationGroups().groups.reduce((n,g)=>n+g.items.length,0)'),2);
  assert.equal(run('workItems().length'),9);
  assert.equal(run('filteredWork().every(w=>w.p.owner===state.profile)'),true);
  run("state.opExecutor='Financeiro da Aurora';");
  assert.equal(run('filteredWork().length'),1);
});
test('agenda omits past, realized and undated commitments and distinguishes predictions',()=>{
  const run=scenario();
  assert.equal(run("operationAgenda().some(e=>e.p.actual&&e.type==='Previsão registrada')"),false);
  assert.equal(run("operationAgenda().some(e=>e.p.id==='PR-26028'&&e.type==='Prazo de decisão')"),false);
  assert.equal(run("operationAgenda().some(e=>e.p.id==='PR-26018'&&e.type==='Previsão registrada')"),true);
  assert.equal(run("operationAgenda().some(e=>e.p.id==='PR-26006')"),false);
  assert.equal(run("operationAgenda().every(e=>e.date>='2026-09-10'&&e.date<='2026-09-17')"),true);
});
test('multiple tasks in a record do not inflate portfolio and unknown data is not quiet',()=>{
  const run=scenario();run("processes[0].stale=true;processes[2].stale=true;processes[0].action={title:'Complemento',owner:'Mariana'};");
  assert.equal(run('operationRecords().length'),16);
  assert.equal(run("operationFronts().find(f=>f.name==='Embarques').missing.length"),1);
  assert.equal(run('operationFronts().reduce((n,f)=>n+f.pending.length+f.quiet+f.missing.length,0)'),16);
});
test('arrival review leaves the changed-arrival portfolio signal visible',()=>{
  const run=scenario();run("state.eventReviews.push(changeKey(processes.find(p=>p.id==='PR-26018')));");
  assert.equal(run('operationWork().length'),8);
  assert.equal(run('operationRecords().filter(p=>p.risk).length'),1);
});

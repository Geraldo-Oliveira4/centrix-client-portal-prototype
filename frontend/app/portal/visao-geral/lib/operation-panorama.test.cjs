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
    const icon=()=>'',esc=v=>String(v??''),empty=t=>'<div class="empty">'+t+'</div>',dateLabel=d=>d||'Sem previsão';
    const tasks=()=>processes.filter(p=>p.action&&p.action.owner===state.profile),waits=()=>processes.filter(p=>p.waiting&&p.owner===state.profile);
    const due=p=>!p.action?.deadline?'later':new Date(p.action.deadline)<NOW?'overdue':p.action.deadline.startsWith('2026-09-10')?'today':'later';
    const dueLabel=()=>'',person=n=>n;
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
  assert.equal(run('workItems().length'),9);
  assert.equal(run('filteredWork().every(w=>w.p.owner===state.profile)'),true);
  run("state.opExecutor='Financeiro da Aurora';");
  assert.equal(run('filteredWork().length'),1);
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

// Foco (Orsi, 02/10/2026): menos blocos, nenhuma lista de tarefas paralela.
test('Operação: uma camada de resumo, Onde intervir (máx. 4) e Atualizações; sem No horizonte nem frentes',()=>{
  const run=scenario();
  const html=run('renderOperation()');
  assert.equal((html.match(/class="op-overview"/g)||[]).length,1);
  assert.doesNotMatch(html,/No horizonte|op-fronts|op-distribution/);
  assert.match(html,/Onde intervir/);
  assert.ok((html.match(/class="op-priority"/g)||[]).length<=4);
  assert.match(html,/id="updates-title">Atualizações</);
  assert.doesNotMatch(html,/Já vi/);
});
test('Meu dia: frase + Fazer agora; sem cards de resumo, sem Mudanças relevantes; retornos recolhidos',()=>{
  const run=scenario();
  const html=run('renderDay()');
  // A frase e a lista contam a MESMA coisa.
  const sentence=Number(html.match(/<strong>(\d+)<\/strong> itens? para fazer agora/)[1]);
  assert.equal(sentence,(html.match(/class="task-row/g)||[]).length);
  assert.match(html,/1 com prazo vencido.*2 vencem hoje.*1 sem vencimento hoje/);
  assert.match(html,/<h2>Fazer agora<\/h2>/);
  assert.doesNotMatch(html,/class="metrics"|Prazo vencido<\/span>|Mudanças relevantes/);
  assert.match(html,/<details class="surface waiting" id="waiting-list" >/);
});
test('o feed ordena do mais recente e não mostra contador nem ação',()=>{
  const run=scenario();
  const html=run("updatesFeed(processes.flatMap(p=>p.events.map(e=>({p,e}))),{max:2})");
  const titles=[...html.matchAll(/<strong>([^<]+)<\/strong>/g)].map(m=>m[1]);
  assert.deepEqual(titles,['Carga aguarda confirmação financeira','Chegada ao porto mudou em 3 dias']);
  assert.match(html,/Mostrando as 2 mais recentes de 4/);
  assert.doesNotMatch(html,/class="count"/);
});

/* The panorama uses the same fictional records and pending work as the detail. */
const OP_MODULES = ['Cotações','Embarques','Auditoria'];
function operationRecords(){return processes.filter(p=>state.opScope!=='mine'||p.owner===state.profile);}
function operationWork(){const ids=new Set(operationRecords().map(p=>p.id));return workItems().filter(w=>ids.has(w.p.id));}
function operationFronts(){
  const records=operationRecords(),work=operationWork();
  return OP_MODULES.map(name=>{
    const items=records.filter(p=>moduleOf(p)===name);
    const pending=items.filter(p=>work.some(w=>w.p.id===p.id));
    const missing=items.filter(p=>p.stale&&!pending.includes(p));
    return {name,items,pending,missing,quiet:items.length-pending.length-missing.length};
  });
}
function operationAgenda(){
  const today=NOW.toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
  const work=operationWork();
  const events=work.filter(w=>w.deadline&&new Date(w.deadline)>=NOW).map(w=>({p:w.p,date:w.deadline.slice(0,10),title:w.title,type:w.kind==='waiting'?'Retorno combinado':'Prazo de decisão',cmd:w.cmd}));
  for(const p of operationRecords()){
    if(p.date&&!p.actual&&moduleOf(p)==='Embarques')events.push({p,date:p.date,title:p.milestone,type:'Previsão registrada',cmd:'detail'});
  }
  return events.filter(e=>dayDiff(e.date,today)>=0&&dayDiff(e.date,today)<=7).sort((a,b)=>a.date.localeCompare(b.date));
}
function operationGroups(){
  const work=operationWork(),owners=[...new Set(operationRecords().map(p=>p.owner))];
  const team=owners.length>1;
  const names=team?owners:[...new Set(work.filter(w=>w.kind==='waiting').map(w=>w.executor||'Responsável não informado'))];
  return {team,groups:names.map(name=>({name,items:work.filter(w=>team?w.owner===name:w.kind==='waiting'&&(w.executor||'Responsável não informado')===name)})).sort((a,b)=>b.items.length-a.items.length)};
}
function opDrill(opts={}){
  Object.assign(state,{owner:'all',flag:'all',search:'',workModule:'all',workKind:'all',opExecutor:'all',opQueue:true},opts);
  closeDrawer();render();const target=$('#operation-detail');target?.scrollIntoView({block:'start',behavior:'smooth'});target?.focus({preventScroll:true});
}
function opRecordList(kind){
  const records=operationRecords().filter(p=>kind==='all'||kind==='risk'&&p.risk||moduleOf(p)===kind);
  drawerProcess=null;
  showDrawer(kind==='risk'?'Chegadas alteradas':kind==='all'?'Carteira acompanhada':kind,`${records.length} registros neste recorte`,records.map(p=>`<button class="answer-result" data-cmd="detail" data-id="${p.id}"><strong>${esc(p.supplier)} · ${p.po}</strong><small>${esc(p.name)}</small><small>${esc(p.status)} · ${p.owner}</small></button>`).join('')||empty('Nenhum registro','Não há registros neste recorte.'));
}
function opAgendaList(date){
  const events=operationAgenda().filter(e=>e.date===date);drawerProcess=null;
  showDrawer('Compromissos e previsões',dateLabel(date),`<p class="small muted">Prazos de decisão, retornos e marcos previstos têm significados diferentes. Chegada ao porto não é entrega na fábrica.</p>${events.map(e=>`<button class="answer-result" data-cmd="${e.cmd}" data-id="${e.p.id}"><small>${e.type}</small><strong>${esc(e.title)}</strong><small>${e.p.po} · ${esc(e.p.supplier)}</small></button>`).join('')}`);
}
function renderOperation(){
  const records=operationRecords(),work=operationWork(),fronts=operationFronts();
  const late=work.filter(w=>urgency(w)==='overdue'),today=work.filter(w=>urgency(w)==='today'),wait=work.filter(w=>w.kind==='waiting'),risk=records.filter(p=>p.risk);
  const priority=work.filter(w=>urgency(w)==='overdue'||urgency(w)==='today'||w.kind==='review').sort((a,b)=>({overdue:0,review:1,today:2}[urgency(a)==='overdue'?'overdue':a.kind==='review'?'review':'today'])-({overdue:0,review:1,today:2}[urgency(b)==='overdue'?'overdue':b.kind==='review'?'review':'today'])||workSort(a,b));
  const agenda=operationAgenda(),dates=[...new Set(agenda.map(e=>e.date))],distribution=operationGroups(),max=Math.max(1,...distribution.groups.map(g=>g.items.length));
  const metric=(label,n,kind,value,tone)=>`<button class="op-signal ${tone||''}" data-cmd="${kind}" data-value="${value}"><strong>${n}</strong><span>${label}</span>${icon('chevron')}</button>`;
  return `<div class="op-dashboard">
    <header class="op-heading"><div><span class="eyebrow">PANORAMA DA CARTEIRA</span><h2>A operação em um olhar</h2><p>Onde estão os processos e o que precisa avançar.</p></div><div class="op-scope" aria-label="Carteira exibida"><button data-cmd="opscope" data-value="mine" aria-pressed="${state.opScope==='mine'}">Minha carteira</button><button data-cmd="opscope" data-value="all" aria-pressed="${state.opScope!=='mine'}">Toda a carteira</button></div></header>
    <section class="op-overview" aria-label="Resumo da carteira"><div class="op-volume"><button data-cmd="oprecords" data-value="all"><strong>${records.length}</strong><span>registros<br>acompanhados ${icon('arrow')}</span></button><small>Visão atual · ${dateLabel('2026-09-10')}</small></div><div class="op-signals">${metric('Pendências vencidas',late.length,'opflag','overdue','is-late')}${metric('Pendências para hoje',today.length,'opflag','today','is-today')}${metric('Aguardando retorno',wait.length,'opflag','waiting','')}${metric('Chegadas alteradas',risk.length,'oprecords','risk','is-change')}</div></section>
    <div class="op-fronts">${fronts.map((f,i)=>`<section class="op-front op-front-${i}"><div class="op-front-head"><span class="op-module-icon">${icon(['file','ship','shield'][i])}</span><h3>${f.name}</h3><button class="link-button" data-cmd="oprecords" data-value="${f.name}" aria-label="Ver registros de ${f.name}">${icon('arrow')}</button></div><button class="op-front-volume" data-cmd="oprecords" data-value="${f.name}"><strong>${f.items.length}</strong><span>${f.items.length===1?'registro acompanhado':'registros acompanhados'}</span></button><div class="op-health" role="img" aria-label="${f.pending.length} com pendência, ${f.quiet} sem pendência registrada, ${f.missing.length} desatualizados"><span class="has-work" style="flex:${f.pending.length}"></span><span class="no-work" style="flex:${f.quiet}"></span><span class="missing" style="flex:${f.missing.length}"></span></div><button class="op-front-pending" data-cmd="opmodule" data-value="${f.name}"><span><i class="op-dot has-work"></i>Com pendência</span><strong>${f.pending.length} ${icon('chevron')}</strong></button><div class="op-front-quiet"><span><i class="op-dot no-work"></i>Sem pendência registrada</span><strong>${f.quiet}</strong></div>${f.missing.length?`<small>${f.missing.length} com dados desatualizados</small>`:''}</section>`).join('')}</div>
    <p class="op-caption">Cada registro aparece em uma frente neste cenário. Um pedido pode ter mais de um lote; os volumes não representam pedidos únicos. Ausência de pendência registrada não confirma que tudo está em dia.</p>
    <div class="op-middle"><section class="op-panel"><div class="op-panel-heading"><div><span class="eyebrow">ATENÇÃO AGORA</span><h3>Onde intervir</h3></div><span class="op-counter">${Math.min(4,priority.length)} de ${priority.length}</span></div><div class="op-priorities">${priority.slice(0,4).map(w=>`<button class="op-priority" data-cmd="${w.cmd}" data-id="${w.p.id}"><span class="op-priority-mark ${urgency(w)==='overdue'?'late':'attention'}">${icon(w.kind==='review'?'ship':'clock')}</span><span class="op-priority-body"><span class="eyebrow">${w.p.po} · ${esc(w.p.supplier)}</span><strong>${w.title}</strong><small>${esc(w.p.action?.effect||w.p.waiting?.effect||'Nova previsão de chegada ao porto. Confira o impacto no planejamento.')}</small><span class="op-priority-meta">${w.owner} · ${w.kind==='review'?'Chegada em '+dateLabel(w.p.date):workDeadline(w)}</span></span>${icon('chevron')}</button>`).join('')||empty('Nenhuma intervenção sinalizada','Consulte a cobertura e os demais acompanhamentos.')}</div><button class="op-panel-link" data-cmd="opqueue">Ver todas as ${work.length} pendências ${icon('arrow')}</button></section>
    <section class="op-panel"><div class="op-panel-heading"><div><span class="eyebrow">HOJE + PRÓXIMOS 7 DIAS</span><h3>No horizonte</h3></div>${icon('clock')}</div><div class="op-agenda">${dates.map(date=>{const items=agenda.filter(e=>e.date===date);return `<button class="op-agenda-day" data-cmd="opagenda" data-value="${date}"><span class="op-calendar"><strong>${date.slice(8)}</strong><small>SET</small></span><span><strong>${date==='2026-09-10'?'Hoje':new Date(date+'T12:00:00-03:00').toLocaleDateString('pt-BR',{weekday:'long',timeZone:'America/Sao_Paulo'})}</strong><small>${[...new Set(items.map(e=>e.type==='Previsão registrada'?e.title:e.type))].join(' · ')}</small></span><b>${items.length}</b>${icon('chevron')}</button>`;}).join('')||'<p class="op-caption">Sem compromisso ou previsão registrada neste horizonte.</p>'}</div><p class="op-panel-note">Somente datas registradas. Previsões logísticas não são prazos de resposta; chegadas referem-se ao porto.</p></section></div>
    <section class="op-panel op-distribution"><div class="op-panel-heading"><div><span class="eyebrow">${distribution.team?'DISTRIBUIÇÃO DO TRABALHO':'DEPENDÊNCIAS DA SUA CARTEIRA'}</span><h3>${distribution.team?'Como estão as pendências da equipe':'De quem depende avançar'}</h3></div><span class="op-legend"><i class="op-dot late"></i>Vencidas <i class="op-dot attention"></i>Hoje <i class="op-dot remaining"></i>Demais</span></div><div class="op-bars">${distribution.groups.map(g=>{const a=g.items.filter(w=>urgency(w)==='overdue').length,b=g.items.filter(w=>urgency(w)==='today').length;return `<button class="op-person" data-cmd="${distribution.team?'opowner':'opexecutor'}" data-value="${esc(g.name)}" aria-label="${esc(g.name)}: ${g.items.length} ${g.items.length===1?'pendência':'pendências'}, ${a} vencidas, ${b} para hoje"><span>${distribution.team?avatar(g.name):icon('clock')}<strong>${esc(g.name)}</strong></span><span class="op-person-track"><span class="op-person-fill" style="width:${g.items.length/max*100}%"><i class="late" style="flex:${a}"></i><i class="attention" style="flex:${b}"></i><i class="remaining" style="flex:${g.items.length-a-b}"></i></span></span><b>${g.items.length}</b>${icon('chevron')}</button>`;}).join('')||'<p class="op-caption">Nenhum retorno pendente registrado.</p>'}</div><p class="op-panel-note">${distribution.team?'Volume de pendências por responsável. Não mede capacidade ou produtividade.':'Dependências dos retornos registrados. Suas decisões continuam em Meu dia e na fila abaixo.'}</p></section>
    <details class="op-detail" id="operation-detail" tabindex="-1" ${state.opQueue?'open':''}><summary><span>Explorar a fila de trabalho <small>${work.length} pendências neste escopo</small></span>${icon('list')}</summary><div class="op-detail-body">${renderWorkQueue()}</div></details>
    <p class="op-caption">Cobertura do cenário: cotações, marcos logísticos e pendências registradas. Produção, desembaraço e entrega na fábrica não têm cobertura completa.</p>
  </div>`;
}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-cmd]');if(!b)return;const v=b.dataset.value;
  switch(b.dataset.cmd){
    case 'opscope':state.opScope=v;Object.assign(state,{owner:'all',flag:'all',search:'',workModule:'all',workKind:'all',opExecutor:'all',opQueue:false});render();break;
    case 'opflag':opDrill({flag:v});break;
    case 'opmodule':opDrill({workModule:v});break;
    case 'opowner':opDrill({owner:v});break;
    case 'opexecutor':opDrill({opExecutor:v,workKind:'waiting'});break;
    case 'opqueue':opDrill();break;
    case 'oprecords':opRecordList(v);break;
    case 'opagenda':opAgendaList(v);break;
  }
});
document.addEventListener('toggle',e=>{if(e.target.id==='operation-detail'&&e.target.isConnected){state.opQueue=e.target.open;save();}},true);

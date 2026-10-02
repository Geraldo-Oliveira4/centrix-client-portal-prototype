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
function opDrill(opts={}){
  Object.assign(state,{owner:'all',flag:'all',search:'',workModule:'all',workKind:'all',opExecutor:'all',opQueue:true},opts);
  closeDrawer();render();const target=$('#operation-detail');target?.scrollIntoView({block:'start',behavior:'smooth'});target?.focus({preventScroll:true});
}
function opRecordList(kind){
  const records=operationRecords().filter(p=>kind==='all'||kind==='risk'&&p.risk||moduleOf(p)===kind);
  drawerProcess=null;
  showDrawer(kind==='risk'?'Chegadas alteradas':kind==='all'?'Carteira acompanhada':kind,`${records.length} registros neste recorte`,records.map(p=>`<button class="answer-result" data-cmd="detail" data-id="${p.id}"><strong>${esc(p.supplier)} · ${p.po}</strong><small>${esc(p.name)}</small><small>${esc(p.status)} · ${p.owner}</small></button>`).join('')||empty('Nenhum registro','Não há registros neste recorte.'));
}
function renderOperation(){
  const records=operationRecords(),work=operationWork(),fronts=operationFronts();
  const late=work.filter(w=>urgency(w)==='overdue'),today=work.filter(w=>urgency(w)==='today'),wait=work.filter(w=>w.kind==='waiting'),risk=records.filter(p=>p.risk);
  const priority=work.filter(w=>urgency(w)==='overdue'||urgency(w)==='today'||w.kind==='review').sort((a,b)=>({overdue:0,review:1,today:2}[urgency(a)==='overdue'?'overdue':a.kind==='review'?'review':'today'])-({overdue:0,review:1,today:2}[urgency(b)==='overdue'?'overdue':b.kind==='review'?'review':'today'])||workSort(a,b));
  const events=records.flatMap(p=>p.events.map(e=>({p,e})));
  const metric=(label,n,kind,value,tone)=>`<button class="op-signal ${tone||''}" data-cmd="${kind}" data-value="${value}"><strong>${n}</strong><span>${label}</span>${icon('chevron')}</button>`;
  // "Chegadas alteradas" (e nao "Com chegada atrasada") de proposito: este
  // cenario e ficticio e separado de /portal/shipments, entao usar o rotulo da
  // fonte unica de indicadores mostraria outro numero com o mesmo nome.
  // FOCO (Orsi, 02/10/2026): UMA camada de resumo (a faixa escura, com a
  // distribuicao por frente embutida em vez dos tres cartoes que repetiam os
  // mesmos numeros), "Onde intervir" (no maximo 4) e o feed Atualizacoes.
  // "No horizonte" saiu: as chegadas da semana sao o indicador "Chegam nos
  // proximos 7 dias" do Panorama de Embarques, e prazo de decisao/retorno ja
  // esta na fila. A distribuicao por pessoa saiu junto; a fila (recolhida) e o
  // destino dos atalhos, nao um bloco a mais.
  return `<div class="op-dashboard">
    <header class="op-heading"><div><span class="eyebrow">PANORAMA DA CARTEIRA</span><h2>A operação em um olhar</h2><p>Onde estão os processos e o que precisa avançar.</p></div><div class="op-scope" aria-label="Carteira exibida"><button data-cmd="opscope" data-value="mine" aria-pressed="${state.opScope==='mine'}">Minha carteira</button><button data-cmd="opscope" data-value="all" aria-pressed="${state.opScope!=='mine'}">Toda a carteira</button></div></header>
    <section class="op-overview" aria-label="Resumo da carteira"><div class="op-volume"><button data-cmd="oprecords" data-value="all"><strong>${records.length}</strong><span>registros<br>acompanhados ${icon('arrow')}</span></button><p class="op-split">${fronts.map(f=>`<button data-cmd="oprecords" data-value="${f.name}">${f.name} <b>${f.items.length}</b></button>`).join('')}</p><small>Visão atual · ${dateLabel('2026-09-10')}</small></div><div class="op-signals">${metric('Pendências vencidas',late.length,'opflag','overdue','is-late')}${metric('Pendências para hoje',today.length,'opflag','today','is-today')}${metric('Aguardando retorno',wait.length,'opflag','waiting','')}${metric('Chegadas alteradas',risk.length,'oprecords','risk','is-change')}</div></section>
    <div class="op-middle"><section class="op-panel"><div class="op-panel-heading"><div><span class="eyebrow">ATENÇÃO AGORA</span><h3>Onde intervir</h3></div><span class="op-counter">${Math.min(4,priority.length)} de ${priority.length}</span></div><div class="op-priorities">${priority.slice(0,4).map(w=>`<button class="op-priority" data-cmd="${w.cmd}" data-id="${w.p.id}"><span class="op-priority-mark ${urgency(w)==='overdue'?'late':urgency(w)==='today'?'attention':'neutral'}">${icon(w.kind==='review'?'ship':'clock')}</span><span class="op-priority-body"><span class="eyebrow">${w.p.po} · ${esc(w.p.supplier)}</span><strong>${w.title}</strong><small>${esc(w.p.action?.effect||w.p.waiting?.effect||'Nova previsão de chegada ao porto. Confira o impacto no planejamento.')}</small><span class="op-priority-meta">${w.owner} · ${w.kind==='review'?'Chegada em '+dateLabel(w.p.date):workDeadline(w)}</span></span>${icon('chevron')}</button>`).join('')||empty('Nenhuma intervenção sinalizada','Consulte a cobertura e os demais acompanhamentos.')}</div><button class="op-panel-link" data-cmd="opqueue">Ver todas as ${work.length} pendências ${icon('arrow')}</button></section>
    ${updatesFeed(events,{max:5,description:'O que mudou na carteira. Só leitura: o que pede ação está em “Onde intervir”.'})}</div>
    <details class="op-detail" id="operation-detail" tabindex="-1" ${state.opQueue?'open':''}><summary><span>Explorar a fila de trabalho <small>${work.length} pendências neste escopo</small></span>${icon('list')}</summary><div class="op-detail-body">${renderWorkQueue()}</div></details>
    <p class="op-caption">Cobertura do cenário: cotações, marcos logísticos e pendências registradas. Um pedido pode ter mais de um lote; ausência de pendência registrada não confirma que tudo está em dia. Produção, desembaraço e entrega na fábrica não têm cobertura completa.</p>
  </div>`;
}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-cmd]');if(!b)return;const v=b.dataset.value;
  switch(b.dataset.cmd){
    case 'opscope':state.opScope=v;Object.assign(state,{owner:'all',flag:'all',search:'',workModule:'all',workKind:'all',opExecutor:'all',opQueue:false});render();break;
    case 'opflag':opDrill({flag:v});break;
    case 'opmodule':opDrill({workModule:v});break;
    case 'opqueue':opDrill();break;
    case 'oprecords':opRecordList(v);break;
  }
});
document.addEventListener('toggle',e=>{if(e.target.id==='operation-detail'&&e.target.isConnected){state.opQueue=e.target.open;save();}},true);

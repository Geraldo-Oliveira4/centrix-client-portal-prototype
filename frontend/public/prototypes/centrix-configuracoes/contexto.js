// Context belongs to the customer's operation; catalog identity belongs to Centrix.
const isCatalog=id=>seed.agents.some(a=>a.id===id);
function analyticalPreview(kind,id){
  // Full connected profiles are a separate, unpublished preview. Keep this entity's local coverage entry.
  return '';
}
function analyticalAction(kind,id){const url=analyticalPreview(kind,id);return url?`<a class="button secondary" href="${url}" target="_blank" rel="noopener">Ver ficha analítica ↗</a>`:`<a class="button secondary" href="#inteligencia/${Object.keys(meta).find(k=>meta[k][2]===kind)}/${id}">Ver ficha analítica</a>`}
function preferenceButton(section,x){return `<button class="button secondary quick-preference" data-action="quick-preference" data-section="${section}" data-id="${x.id}" aria-pressed="${x.preferred}" aria-label="${x.preferred?'Remover preferência de':'Preferir'} ${esc(section==='rotas'?routeName(x):x.name)}">${x.preferred?(section==='agentes'?'★ Preferido na empresa':'★ Preferida'):'☆ Preferir'}</button>`}
function catalogAgentForm(id){
  const x=agent(id),c=seed.agents.find(a=>a.id===id);
  formShell('agent',id,'Personalizar agente',`<div class="field full">${note(`<b>${esc(c.name)} · catálogo Centrix</b><p>${esc(c.modes.join(' · '))} · ${esc(c.country)}. Identidade e serviços mantidos pela plataforma.</p>`)}</div>${field('Seu contato neste agente','contact',x.contact)}${field('E-mail do seu contato','email',x.email,'email')}${field('Telefone do seu contato','phone',x.phone)}${selectField('Seu relacionamento','relationship',['Em avaliação','Parceiro cadastrado','Relacionamento pausado'],x.relationship)}<label class="check"><input name="active" type="checkbox" ${x.active?'checked':''}>Disponível para sua operação</label><label class="check"><input name="preferred" type="checkbox" ${x.preferred?'checked':''}>Preferido da sua empresa</label>${textArea('Orientações para trabalhar com este agente','description',x.description)}${textArea('Motivo da preferência ou restrição','reason',x.reason)}<div class="field full"><small>Estas escolhas pertencem à Aurora Indústria. Não alteram o catálogo, outras empresas ou o desempenho do agente.</small></div>`);
}
function catalogValues(id,values){
  const c=seed.agents.find(a=>a.id===id);if(!c)return values;
  return {...values,name:c.name,country:c.country,modes:[...c.modes]};
}
function contextEnhance(section,id){
  if(section==='inicio'){
    $('#heading p').textContent='Administre o contexto que orienta sua operação no Centrix.';
    $('#content').insertAdjacentHTML('afterbegin',`<section class="context-banner"><div><h2>Seu contexto, conectado</h2><p>Empresas e locais dizem quem e onde. Preferências e regras dizem como você quer trabalhar.</p></div><div class="actions">${btn('Conectar preferências','connect-context','',true)}${btn('Trazer empresas de uma planilha','import-context','empresas',true)}</div></section>`);
  }
  if(!id&&['empresas','locais'].includes(section))$('#heading').insertAdjacentHTML('beforeend',btn('Importar / preencher com assistência','import-context',section,true));
  if(!id&&['rotas','agentes'].includes(section))$('#heading').insertAdjacentHTML('beforeend',btn('Conectar preferências','connect-context','',true));
  if(section==='agentes'&&!id){
    $('#heading p').textContent='Agentes do catálogo Centrix. Personalize seu relacionamento e suas preferências.';
    const add=$('#heading [data-action="agent-form"]');if(add)add.textContent='+ Adicionar agente · teste';
    $('#content').insertAdjacentHTML('afterbegin',note('<b>Catálogo da plataforma, contexto da sua empresa.</b><p>A identidade do agente é mantida pelo Centrix. Contatos da sua equipe, preferência e participação são escolhas da sua operação. Adicionar agente está disponível apenas para testar o conceito.</p>'));
  }
  if(!id||!meta[section])return;
  const x=section==='locais'?loc(id):state[meta[section][3]].find(x=>x.id===id);if(!x)return;
  if(['rotas','agentes'].includes(section))$('#heading .actions').insertAdjacentHTML('afterbegin',preferenceButton(section,x));
  if(section==='agentes'){
    $('#heading p').textContent=isCatalog(id)?'Catálogo Centrix · personalização da Aurora Indústria':'Agente adicionado para teste · sem inclusão no catálogo real';
    $('#heading [data-action="agent-form"]').textContent=isCatalog(id)?'Personalizar':'Editar agente de teste';
  }
  const kind=section==='empresas'?'company':section==='agentes'?'agent':section==='rotas'?'route':'location';
  const cta=section==='empresas'?btn('Preparar rota para esta empresa','route-for-company',id,true):section==='agentes'?btn('Preferir este agente em uma rota','connect-context',`agent:${id}`,true):section==='rotas'?btn('Escolher agente para esta rota','connect-context',`route:${id}`,true):'';
  const source=x.provenance;
  const body=`<p>${source?`${esc(source.name)}${source.sheet?' · '+esc(source.sheet):''}${source.row?' · linha '+source.row:''}`:isCatalog(id)&&section==='agentes'?'Catálogo Centrix · identidade demonstrativa':'Exemplo local ou cadastro manual'}</p><small>${source?.reviewedAt?'Revisado nesta prévia em '+new Date(source.reviewedAt).toLocaleString('pt-BR'):'Sem data de revisão registrada'}</small><p>${section==='agentes'?'Sua preferência é uma escolha comercial, não um indicador de qualidade.':section==='rotas'?'Percurso e preferências descrevem o planejamento; eventos realizados têm origem própria.':'Esse cadastro fornece identidade e contexto. Histórico e métricas dependem de operações vinculadas.'}</p>${source?.columns?`<details><summary>Campos recebidos da fonte</summary><p>${esc(source.columns.join(', '))}</p></details>`:''}${source?.excerpt?`<details><summary>Trecho recebido</summary><pre class="source-text">${esc(source.excerpt)}</pre></details>`:''}${cta?`<div class="actions detail-notes">${cta}</div>`:''}`;
  $('#content>.split>.stack').insertAdjacentHTML('beforeend',panel('Origem e uso deste contexto',body));
  if(analyticalPreview(kind,id))$('#content>.split>.stack').insertAdjacentHTML('beforeend',note('A ficha analítica abre a prévia de Inteligência com o mesmo ID de exemplo. Ela usa um snapshot próprio; alterações feitas aqui ainda não são sincronizadas entre as prévias.'));
}
function connectContext(hint=''){
  const [type,id]=hint.split(':');
  const r=type==='route'?route(id):state.routes.find(r=>type!=='agent'||agent(id)?.modes.includes(r.mode));
  openDrawer('Conectar preferências','Uma escolha de rota e agente, no mesmo lugar.',`<form id="connect-form"><div class="fields">${selectField('Rota','routeId',state.routes.map(r=>[r.id,`${routeName(r)} · ${r.equipment||r.mode}`]),r?.id)}<div class="field full" id="connect-options"></div></div><p id="connect-error" class="error" role="alert"></p><div class="drawer-actions">${btn('Cancelar','close','',true)}<button class="button" type="submit">Salvar preferências</button></div></form>`);
  connectionOptions(r?.id,type==='agent'?id:undefined);
}
function connectionOptions(id,preferredId){
  const r=route(id);if(!r){$('#connect-options').innerHTML='Cadastre uma rota para começar.';return}
  const available=state.agents.filter(a=>a.active&&a.modes.includes(r.mode));
  $('#connect-options').innerHTML=`<p>${link('empresas',r.company,company(r.company).name)}${r.supplier?' · '+link('empresas',r.supplier,company(r.supplier).name):''}</p>${selectField('Agente preferido nesta rota','agentId',[['','Sem preferência'],...available.map(a=>[a.id,a.name])],available.some(a=>a.id===(preferredId??r.agent))?(preferredId??r.agent):'')}<label class="check detail-notes"><input name="routePreferred" type="checkbox" ${r.preferred?'checked':''}>Deixar esta rota entre as preferidas</label><label class="check"><input name="companyPreferred" type="checkbox">Também preferir este agente para a empresa</label>${selectField('Prioridade para esta rota','reason',['Previsibilidade','Prazo','Custo','Relacionamento'],r.reason)}${note(`${r.agent&&!available.some(a=>a.id===r.agent)?'O agente anterior está bloqueado ou não atende este modal. Salvar substituirá essa preferência. ':''}A preferência por rota é específica; a preferência da empresa é geral. Nenhuma delas altera participação, histórico ou acompanhamento no Radar.`)}`;
}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-action]');if(!b)return;const {action,id,section}=b.dataset;
  if(action==='quick-preference'){const x=section==='rotas'?route(id):agent(id);x.preferred=!x.preferred;save();render();toast(x.preferred?'Preferência salva para sua empresa.':'Preferência removida. Vínculos mantidos.');}
  if(action==='connect-context')connectContext(id);
  if(action==='route-for-company'){
    const c=company(id);routeForm('',{mode:'Marítimo',company:c.roles.includes('Importador')?id:'aurora',supplier:c.roles.some(r=>['Fornecedor','Exportador'].includes(r))?id:'',pickup:c.locations?.[0]||'',delivery:'',from:'',to:'',via:[],preferred:true,reason:'Previsibilidade'});
  }
});
document.addEventListener('change',e=>{if(e.target.name==='routeId'&&e.target.closest('#connect-form'))connectionOptions(e.target.value)});
document.addEventListener('submit',e=>{
  if(e.target.id!=='connect-form')return;e.preventDefault();const f=new FormData(e.target),r=route(f.get('routeId')),a=agent(f.get('agentId'));
  if(!r||a&&(!a.active||!a.modes.includes(r.mode))){$('#connect-error').textContent='Selecione uma rota e um agente disponível para o modal.';return}
  r.agent=a?.id||'';r.preferred=f.has('routePreferred');r.reason=f.get('reason');if(a&&f.has('companyPreferred'))a.preferred=true;
  save();closeDrawer();render();toast('Rota e agente conectados. Preferências salvas somente nesta prévia.');
});

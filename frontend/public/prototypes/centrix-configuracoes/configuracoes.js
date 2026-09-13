'use strict';
// The same entity IDs are used by settings, related records and analytical entry points.
Object.assign(locations, {
  'east-factory': {name:'Eastbridge · unidade Ningbo',code:'',country:'China',city:'Ningbo',type:'Coleta / entrega',description:'Local demonstrativo de coleta da mercadoria.',company:'east'},
  'aurora-factory': {name:'Aurora · unidade Joinville',code:'',country:'Brasil',city:'Joinville',type:'Coleta / entrega',description:'Destino final demonstrativo. Entrega mediante agendamento.',company:'aurora'}
});
Object.values(locations).forEach(l=>{if(!l.city)l.city=l.name;});
seed.locations=structuredClone(locations);
seed.companies.filter(c=>c.roles.includes('Exportador')).forEach(c=>c.roles.push('Fornecedor'));
seed.companies.forEach(c=>{c.email='';c.phone='';c.locations=c.id==='east'?['east-factory']:c.id==='aurora'?['aurora-factory']:[];});
seed.routes.forEach(r=>Object.assign(r,{supplier:r.id==='ningbo'?'east':r.id==='hamburgo'?'nord':'',pickup:r.id==='ningbo'?'east-factory':'',delivery:r.id==='ningbo'?'aurora-factory':'',via:[]}));
seed.agents.forEach(a=>Object.assign(a,{email:'',phone:'',country:'Brasil',relationship:'Parceiro cadastrado',reason:'',modes:a.id==='beta'?['Marítimo','Aéreo']:['Marítimo']}));
try{state=JSON.parse(localStorage.getItem(KEY))||structuredClone(seed)}catch{state=structuredClone(seed)}
Object.assign(locations,state.locations);
const meta={empresas:['Empresas','Nova empresa','company','companies'],rotas:['Rotas','Nova rota','route','routes'],locais:['Locais','Novo local','location','locations'],agentes:['Agentes de carga','Cadastrar agente','agent','agents']};
const labels={Importador:'Importador',Fornecedor:'Fornecedor da mercadoria',Exportador:'Exportador da mercadoria'};
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const loc=id=>state.locations[id];
const link=(section,id,label)=>`<a class="link" href="#${section}/${encodeURIComponent(id)}">${esc(label)}</a>`;
const routeLinks=rs=>rs.length?rs.map(r=>`<a class="route-preview" href="#rotas/${r.id}"><strong>${esc(routeName(r))}</strong><small>${esc(r.mode)} · ${esc(r.equipment||'Condição a definir')}</small></a>`).join(''):'<div class="empty">Nenhuma rota vinculada.<small>O cadastro pode ser utilizado mesmo sem operações.</small></div>';
const pointIds=r=>[r.pickup,r.from,...r.via,r.to,r.delivery].filter(Boolean);
const relatedRoutes=(type,id)=>state.routes.filter(r=>type==='empresas'?(r.company===id||r.supplier===id):type==='agentes'?r.agent===id:pointIds(r).includes(id));
const note=s=>`<div class="note">${s}</div>`;
const datum=(label,value)=>`<div><small>${esc(label)}</small><div>${value||'Não informado'}</div></div>`;
const panel=(title,body)=>`<section class="panel"><div class="panel-head"><h2>${title}</h2></div><div class="pad">${body}</div></section>`;
const listState={};
let previousHash='',returnTargets={},pendingRoute=null;
function field(label,name,value='',type='text',required=false){return `<label class="field">${label}<input name="${name}" value="${esc(value)}" type="${type}" ${required?'required':''}></label>`}
function selectField(label,name,values,selected){return `<label class="field">${label}<select name="${name}">${values.map(v=>{const [id,text]=Array.isArray(v)?v:[v,v];return `<option value="${esc(id)}" ${id===selected?'selected':''}>${esc(text)}</option>`}).join('')}</select></label>`}
function checks(title,name,options,selected=[]){return `<fieldset class="field full choices"><legend>${title}</legend>${options.map(([value,label])=>`<label class="check"><input name="${name}" type="checkbox" value="${value}" ${selected.includes(value)?'checked':''}>${label}</label>`).join('')}</fieldset>`}
function textArea(label,name,value=''){return `<label class="field full">${label}<textarea name="${name}">${esc(value)}</textarea></label>`}
function actions(kind,id){return `<div class="actions">${btn(isCatalog(id)&&kind==='agent'?'Personalizar':'Editar cadastro',kind+'-form',id,true)}${analyticalAction(kind,id)}</div>`}
function render(){
  const hash=decodeURIComponent(location.hash.slice(1))||'inicio';
  if(previousHash!==hash){if(listState[previousHash])listState[previousHash].scroll=window.scrollY;if(previousHash&&returnTargets[previousHash]!==hash)returnTargets[hash]=previousHash;previousHash=hash;}
  current=hash;const [section,id,analyticId]=hash.split('/');
  document.querySelector('.user').innerHTML=`<span class="avatar">${esc(state.settings.name.split(/\s+/).map(s=>s[0]).slice(0,2).join(''))}</span>${esc(state.settings.name)}`;
  $('#tabs').innerHTML=[['inicio','Visão geral'],['perfil','Perfil e operação'],['alertas','Alertas'],['empresas','Empresas'],['rotas','Rotas e locais'],['agentes','Agentes']].map(([s,label])=>`<a href="#${s}" class="${s===(section==='locais'?'rotas':section)?'active':''}" ${s===(section==='locais'?'rotas':section)?'aria-current="page"':''}>${label}</a>`).join('');
  if(section==='inicio')overview();else if(section==='geral'){location.replace('#perfil');profile();}else if(section==='perfil')profile();else if(section==='alertas')alerts();else if(section==='inteligencia')analytical(id,analyticId);else if(meta[section]&&id)detail(section,id);else if(meta[section])list(section);else missing();
  contextEnhance(section,id);
  if(listState[hash])requestAnimationFrame(()=>window.scrollTo(0,listState[hash].scroll||0));
}
function overview(){
  heading('Configurações','Sua base de empresas, percursos e parceiros.');
  $('#content').innerHTML=`<div class="split"><section class="panel"><div class="panel-head"><div><h2>Sua base de trabalho</h2><p>Organize os dados que sua operação reutiliza.</p></div></div>${[['empresas','company','Empresas','Importadores, fornecedores e exportadores no mesmo cadastro.',state.companies.length+' empresas'],['rotas','route','Rotas e locais','Percurso, coleta, conexões e destino final.',state.routes.length+' rotas'],['agentes','agent','Agentes de carga','Relacionamento, participação e preferências.',state.agents.length+' agentes'],['perfil','settings','Perfil e operação','Seu perfil, padrões e orientações que viram regras.','Orientações e regras'],['alertas','settings','Alertas','Tipos de aviso, sensibilidade e acompanhamento.','Preferências pessoais']].map(([s,i,t,d,c])=>`<a class="category" href="#${s}">${icon(i)}<div class="grow"><h3>${t}</h3><p>${d}</p></div><span class="count">${c} ›</span></a>`).join('')}</section><div class="stack"><section class="panel"><div class="panel-head"><div><h2>Rotas preferidas</h2><p>Preferências da Aurora Indústria</p></div></div>${routeLinks(state.routes.filter(r=>r.preferred))}</section>${note('<b>Cadastro e desempenho têm lugares próprios.</b><p>Identidade, vínculos e preferências ficam aqui. A ficha analítica reúne os registros disponíveis em Inteligência.</p>')}${note('<b>Comece pelo fornecedor</b><p>Explore Eastbridge → Ningbo–Itajaí → local de coleta → Alpha Logistics. Todos são exemplos demonstrativos.</p>')}${link('empresas','east','Abrir Eastbridge Components →')}</div></div>`;
}
function subnav(section){return `<nav class="subtabs" aria-label="Rotas e locais"><a class="${section==='rotas'?'active':''}" href="#rotas">Rotas</a><a class="${section==='locais'?'active':''}" href="#locais">Locais</a></nav>`}
function list(section){
  const m=meta[section];const saved=listState[section]||{q:'',f:'Todos',scroll:0};listState[section]=saved;
  const filters=section==='empresas'?['Todos','Importador','Fornecedor / exportador']:section==='rotas'?['Todos','Preferidas','Marítimo','Aéreo','Rodoviário']:section==='locais'?['Todos','Porto','Aeroporto','Terminal','Armazém','Coleta / entrega']:['Todos','Preferidos','Com participação','Bloqueados'];
  heading(m[0],{empresas:'Um registro por empresa. Papéis descrevem sua participação na operação.',rotas:'Percursos planejados e preferências da empresa.',locais:'Um catálogo reutilizável de portos, aeroportos e demais pontos.',agentes:'Defina como sua empresa se relaciona com cada agente.'}[section],btn('+ '+m[1],m[2]+'-form'));
  $('#content').innerHTML=`${['rotas','locais'].includes(section)?subnav(section):''}<div class="toolbar"><label class="search"><input id="search" type="search" aria-label="Buscar ${m[0].toLowerCase()}" placeholder="Buscar nome, local, código ou contato" value="${esc(saved.q)}"></label>${selectField('Filtrar','filter',filters,saved.f)}<span id="results-count" class="small muted" aria-live="polite"></span></div><div id="results"></div>`;
  $('#search').addEventListener('input',()=>{saved.q=$('#search').value;rows(section)});
  $('[name=filter]').addEventListener('change',()=>{saved.f=$('[name=filter]').value;rows(section)});rows(section);
}
function rows(section){
  const {q,f}=listState[section],m=meta[section];const all=section==='locais'?Object.entries(state.locations).map(([id,l])=>({id,...l})):state[m[3]];
  const items=all.filter(x=>{const text=section==='rotas'?[routeName(x),x.mode,x.equipment,company(x.supplier)?.name,...pointIds(x).map(i=>loc(i).code)]:Object.values(x).flat();if(!normalize(text.join(' ')).includes(normalize(q)))return false;return f==='Todos'||f==='Importador'&&x.roles.includes(f)||f==='Fornecedor / exportador'&&x.roles.some(r=>['Fornecedor','Exportador'].includes(r))||['Preferidas','Preferidos'].includes(f)&&x.preferred||f==='Com participação'&&x.active||f==='Bloqueados'&&!x.active||x.mode===f||x.type===f;});
  $('#results-count').textContent=`${items.length} de ${all.length} registros`;
  if(!items.length){$('#results').innerHTML=`<div class="panel empty"><h2>Nenhum cadastro encontrado</h2><p>Revise a busca ou os filtros.</p>${btn('Limpar busca e filtros','clear-list',section,true)}</div>`;return}
  const headers=section==='empresas'?['Empresa','Papéis','Localização']:section==='rotas'?['Percurso','Empresa e fornecedor','Preferências']:section==='locais'?['Local','Tipo e código','País / cidade']:['Agente','Relacionamento','Participação'];
  $('#results').innerHTML=`<div class="panel table-wrap"><table><thead><tr>${[...headers,''].map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${items.map(x=>{const cells=section==='empresas'?[`${link(section,x.id,x.name)}<small>${esc(x.legal||x.contact||'')}</small>`,x.roles.map(r=>pill(labels[r]||r,'purple')).join(' '),`${esc(x.city)}<small>${esc(x.country)}</small>`]:section==='rotas'?[`${link(section,x.id,routeName(x))}<small>${esc(x.mode)} · ${esc(x.equipment||'Condição a definir')} · ${pointIds(x).length} pontos</small>`,`${esc(company(x.company)?.name||'Não definida')}<small>${esc(company(x.supplier)?.name||'Fornecedor não definido')}</small>`,`${preferenceButton(section,x)}<small>${esc(agent(x.agent)?.name||'Agente a definir')}${x.agent&&!agent(x.agent)?.active?' · bloqueado':''}</small>`]:section==='locais'?[link(section,x.id,x.name),`${pill(x.type)}<small>${esc(x.code||'Sem código externo')}</small>`,`${esc(x.country)}<small>${esc(x.city||'')}</small>`]:[`${link(section,x.id,x.name)}<small>${esc(x.contact||'Contato não informado')}</small>`,`${esc(x.relationship)}<small>${preferenceButton(section,x)}</small>`,pill(x.active?'Disponível para seleção':'Bloqueado',x.active?'green':'')];return `<tr>${cells.map((c,i)=>`<td data-label="${headers[i]}">${c}</td>`).join('')}<td>${link(section,x.id,'Abrir →')}</td></tr>`}).join('')}</tbody></table></div>`;
}
function detail(section,id){
  const m=meta[section],x=section==='locais'?loc(id):state[m[3]].find(x=>x.id===id);if(!x)return missing();
  heading(section==='rotas'?routeName(x):x.name,'Cadastro demonstrativo · Aurora Indústria',actions(m[2],id));
  const back=returnTargets[current]||section;
  $('#heading').insertAdjacentHTML('afterbegin',`<a class="back context-back" href="#${esc(back)}">‹ Voltar</a>`);
  let data='';let related='';
  if(section==='empresas'){
    data=`<div class="fields">${datum('Razão social',esc(x.legal))}${datum('Identificador fiscal',esc(x.taxid))}${datum('Localização',esc([x.city,x.country].filter(Boolean).join(' · ')))}${datum('Contato',esc(x.contact))}${datum('E-mail',esc(x.email))}${datum('Telefone',esc(x.phone))}${datum('Papéis',x.roles.map(r=>pill(labels[r]||r,'purple')).join(' '))}</div><p class="detail-notes">${esc(x.notes||'Nenhuma particularidade registrada.')}</p>`;
    related=panel('Locais vinculados',x.locations?.length?x.locations.map(i=>`<p>${link('locais',i,loc(i).name)}</p>`).join(''):'Nenhum local vinculado.')+panel('Rotas relacionadas',routeLinks(relatedRoutes(section,id)));
  }else if(section==='agentes'){
    data=`<div class="fields">${datum('Relacionamento',esc(x.relationship))}${datum('Contato',esc(x.contact))}${datum('País',esc(x.country))}${datum('Modalidades',esc(x.modes.join(' · ')))}${datum('E-mail',esc(x.email))}${datum('Telefone',esc(x.phone))}${datum('Preferência da empresa',x.preferred?'Preferido':'Sem preferência')}${datum('Participação',pill(x.active?'Disponível para novas seleções':'Bloqueado',x.active?'green':''))}</div><p class="detail-notes">${esc(x.description||'Sem notas de relacionamento.')}</p>${note(x.active?'Estar disponível permite selecionar o parceiro; não envia convites ou solicitações.':'Bloqueio impede novas seleções nesta prévia. Vínculos anteriores continuam identificados.')}<p>${esc(x.reason||'Nenhum motivo adicional registrado.')}</p>`;
    related=panel('Preferência por rota',routeLinks(relatedRoutes(section,id)));
  }else if(section==='locais'){
    data=`<div class="fields">${datum('Tipo',esc(x.type))}${datum('Código externo',esc(x.code))}${datum('País',esc(x.country))}${datum('Cidade',esc(x.city))}</div><p class="detail-notes">${esc(x.description||'Sem observações.')}</p>${note('O local identifica um ponto do percurso. Chegada ao porto ou aeroporto não significa entrega à unidade.')}`;
    related=panel('Empresas vinculadas',state.companies.filter(c=>c.locations?.includes(id)).map(c=>`<p>${link('empresas',c.id,c.name)}</p>`).join('')||'Nenhuma empresa vinculada.')+panel('Rotas que usam este local',routeLinks(relatedRoutes(section,id)));
  }else{
    data=`<ol class="path">${[[x.pickup,'Coleta'],[x.from,'Origem internacional'],...x.via.map(i=>[i,'Conexão']),[x.to,'Chegada internacional'],[x.delivery,'Entrega final']].map(([i,t])=>`<li><small>${t}</small>${i?link('locais',i,loc(i).name):'<span class="muted">Não definida</span>'}${i?`<small>${esc(loc(i).type)} · ${esc(loc(i).code||loc(i).country)}</small>`:''}</li>`).join('')}</ol>${note('Percurso planejado. Não comprova serviço contratado, prazo ou passagem de uma carga.')}<div class="fields detail-notes">${datum('Modal',esc(x.mode))}${datum('Condição habitual',esc(x.equipment))}${datum('Importador',link('empresas',x.company,company(x.company).name))}${datum('Fornecedor / exportador',x.supplier?link('empresas',x.supplier,company(x.supplier).name):'Não definido')}</div>`;
    related=panel('Preferências da empresa',`<div class="pills">${pill(x.preferred?'Rota preferida':'Sem preferência',x.preferred?'orange':'')}${pill(x.reason||'Prioridade não definida')}</div><p class="detail-notes">${x.agent?link('agentes',x.agent,agent(x.agent).name):'Agente não definido'}</p>${x.agent&&!agent(x.agent).active?note('Agente vinculado está bloqueado. Não elegível para nova seleção.'):''}<p>${esc(x.notes||'Sem particularidades.')}</p>`);
  }
  $('#content').innerHTML=`<div class="split">${panel(section==='rotas'?'Percurso':section==='agentes'?'Relacionamento e participação':'Dados cadastrais',data)}<div class="stack">${related}${note('<b>Desempenho em Inteligência</b><p>A ficha analítica usa esta mesma identidade. Novo cadastro começa sem histórico, qualidade ou score.</p>')}</div></div>`;
}
function missing(){heading('Cadastro não encontrado','Selecione um registro na base de trabalho.');$('#content').innerHTML='<a class="button secondary" href="#inicio">Voltar para Configurações</a>'}
function analytical(section,id){
  const m=meta[section];if(!m)return missing();const x=section==='locais'?loc(id):state[m[3]].find(x=>x.id===id);if(!x)return missing();
  const rs=section==='rotas'?[x]:relatedRoutes(section,id);
  // Explicit fixture links, never inferred from a newly created name or preference.
  const supplierByRoute={ningbo:'east',hamburgo:'nord'};
  const ops=operations.filter(o=>section==='empresas'?(o.company===id||supplierByRoute[o.route]===id):section==='agentes'?o.agent===id:section==='rotas'?o.route===id:pointIds(route(o.route)).includes(id));
  heading(section==='rotas'?routeName(x):x.name,'Inteligência · ficha compartilhada demonstrativa',btn('Editar cadastro',m[2]+'-form',id,true));
  $('#content').innerHTML=`<a class="back" href="#${section}/${id}">‹ Voltar ao cadastro</a>${note('<b>Prévia da ligação com Inteligência</b><p>Mesmo registro cadastral. Esta entrada demonstra identidade e cobertura; a análise completa ainda será integrada. Nenhum histórico é criado ao cadastrar.</p>')}<div class="split detail-notes"><div class="stack">${panel('Cobertura disponível',ops.length?`<h3>${ops.length} casos selecionados de demonstração</h3><p>Agosto–setembro de 2026 · Aurora Indústria. Amostra ilustrativa, sem métricas consolidadas.</p>`:'<h3>Sem operações vinculadas</h3><p>O cadastro já pode ser usado. Vincule operações com identidade confirmada para iniciar a análise.</p>')}${panel('Registros demonstrativos',ops.length?ops.map(o=>`<article class="evidence"><b>${esc(o.id)} · ${esc(o.cargo)}</b><p>${esc(o.status)} · ${esc(o.date)}</p><div class="actions">${link('rotas',o.route,routeName(route(o.route)))}${link('agentes',o.agent,agent(o.agent).name)}</div></article>`).join(''):'Nenhum histórico disponível.')}</div><div class="stack">${panel('Qualidade e desempenho','<h3>Ainda não medidos nesta ficha</h3><p>Sem dados suficientes de prontidão, recebimento ou ofertas comparáveis. Preferência e cadastro não geram score.</p>')}${panel('Percursos relacionados',routeLinks(rs))}</div></div>`;
}
function formShell(kind,id,title,body){openDrawer(title,'Dados demonstrativos · alterações somente neste navegador',`<form id="entity-form" data-kind="${kind}" data-id="${esc(id||'')}"><div class="fields">${body}</div><p id="form-error" role="alert" class="error"></p><div class="drawer-actions">${btn('Cancelar','close','',true)}<button class="button" type="submit">Salvar ${kind==='company'?'empresa':kind==='route'?'rota':kind==='agent'?'agente':'local'}</button></div></form>`)}
function companyForm(id){const x=company(id)||{roles:[],locations:[]};formShell('company',id,id?'Editar empresa':'Nova empresa',`${field('Nome de exibição *','name',x.name,'text',true)}${field('Razão social','legal',x.legal)}${field('País *','country',x.country,'text',true)}${field('Cidade / unidade *','city',x.city,'text',true)}${field('Identificador fiscal','taxid',x.taxid)}${field('Contato','contact',x.contact)}${field('E-mail','email',x.email,'email')}${field('Telefone','phone',x.phone)}${checks('Papéis na operação *','roles',Object.entries(labels),x.roles)}<div class="field full"><small>Fornecedor vende a mercadoria; exportador realiza a exportação. Podem ser a mesma empresa. O papel não concede acesso a outra organização.</small></div>${checks('Locais de coleta / entrega vinculados','locations',Object.entries(state.locations).map(([i,l])=>[i,l.name]),x.locations)}${textArea('Particularidades','notes',x.notes)}`)}
function agentForm(id){if(isCatalog(id))return catalogAgentForm(id);const x=agent(id)||{active:true,modes:[],relationship:'Em avaliação'};formShell('agent',id,id?'Editar agente':'Cadastrar agente',`${field('Nome do agente *','name',x.name,'text',true)}${field('Contato','contact',x.contact)}${field('País','country',x.country)}${selectField('Relacionamento','relationship',['Em avaliação','Parceiro cadastrado','Relacionamento pausado'],x.relationship)}${field('E-mail','email',x.email,'email')}${field('Telefone','phone',x.phone)}${checks('Modalidades atendidas *','modes',['Marítimo','Aéreo','Rodoviário'].map(x=>[x,x]),x.modes)}<label class="check"><input name="active" type="checkbox" ${x.active?'checked':''}>Disponível para novas seleções</label><label class="check"><input name="preferred" type="checkbox" ${x.preferred?'checked':''}>Preferido da empresa</label>${textArea('Sobre o relacionamento','description',x.description)}${textArea('Motivo da preferência ou do bloqueio','reason',x.reason)}<div class="field full">${note('Disponibilidade define participação em novas seleções. Preferência não indica qualidade. Vínculos existentes são preservados ao bloquear.')}</div>`)}
function routeForm(id,draft){
  const x=draft||route(id)||{mode:'Marítimo',company:'aurora',via:[],from:'',to:'',reason:'Previsibilidade'};
  const all=[['','Não definido'],...Object.entries(state.locations).map(([i,l])=>[i,`${l.name} · ${l.code||l.type}`])];
  formShell('route',id,id?'Editar rota':'Nova rota',`${selectField('Modal','mode',['Marítimo','Aéreo','Rodoviário'],x.mode)}${selectField('Importador *','company',state.companies.filter(c=>c.roles.includes('Importador')).map(c=>[c.id,c.name]),x.company)}${selectField('Fornecedor / exportador','supplier',[['','Não definido'],...state.companies.filter(c=>c.roles.some(r=>['Fornecedor','Exportador'].includes(r))).map(c=>[c.id,c.name])],x.supplier)}${field('Equipamento / serviço','equipment',x.equipment)}<div class="field full form-section"><h3>Percurso planejado</h3><small>Locais reutilizados. Pontos desconhecidos permanecem explícitos.</small></div>${selectField('Local de coleta','pickup',all,x.pickup)}${selectField('Origem internacional *','from',all,x.from)}<div class="field full" id="connections">${x.via.map((i,n)=>connectionField(all,i,n)).join('')}</div><div class="field full actions">${btn('+ Adicionar conexão','add-connection','',true)}${btn('+ Cadastrar local','route-new-location','',true)}</div>${selectField('Chegada internacional *','to',all,x.to)}${selectField('Entrega final','delivery',all,x.delivery)}${selectField('O que pesa mais','reason',['Previsibilidade','Prazo','Custo','Relacionamento'],x.reason)}${selectField('Agente preferido nesta rota','agent',[['','Sem preferência'],...state.agents.filter(a=>(a.active&&a.modes.includes(x.mode))||a.id===x.agent).map(a=>[a.id,`${a.name}${!a.active?' · bloqueado (vínculo anterior)':''}`])],x.agent||'')}<label class="check field full"><input name="preferred" type="checkbox" ${x.preferred?'checked':''}>Rota preferida da empresa</label>${textArea('Particularidades','notes',x.notes)}<div class="field full">${note('Alterar um percurso com casos vinculados exige nova rota. Preferências não reescrevem histórico.')}</div>`);
}
function connectionField(options,id,n){return `<div class="connection-row">${selectField('Conexão '+(n+1),'via',options,id)}${btn('Remover','remove-connection','',true)}</div>`}
function locationForm(id){const x=loc(id)||{type:'Porto'};formShell('location',id,id?'Editar local':'Novo local',`${field('Nome do local *','name',x.name,'text',true)}${selectField('Tipo','type',['Porto','Aeroporto','Terminal','Armazém','Coleta / entrega'],x.type)}${field('Código externo (opcional)','code',x.code)}${field('País *','country',x.country,'text',true)}${field('Cidade *','city',x.city,'text',true)}${textArea('Endereço / observações','description',x.description)}<div class="field full">${note('Use UN/LOCODE para porto ou IATA para aeroporto, quando conhecido. Não invente um código para completar o cadastro. Editar um local atualiza sua identidade nas rotas vinculadas.')}</div>`)}
function formValues(form){const f=new FormData(form),v=Object.fromEntries(f);Object.keys(v).forEach(k=>v[k]=v[k].trim());if(form.dataset.kind==='route'){v.via=f.getAll('via');v.preferred=f.has('preferred')}if(form.dataset.kind==='company'){v.roles=f.getAll('roles');v.locations=f.getAll('locations')}if(form.dataset.kind==='agent'){v.active=f.has('active');v.preferred=f.has('preferred');v.modes=f.getAll('modes')}return v}
function validate(kind,v,id){
  if(kind!=='route'&&!v.name)return 'Informe um nome.';
  if(kind==='company'){
    if(!v.roles.length)return 'Selecione ao menos um papel para a empresa.';
    if(state.companies.some(c=>c.id!==id&&v.taxid&&normalize(c.taxid)===normalize(v.taxid)&&normalize(c.country)===normalize(v.country)))return 'Este identificador fiscal já está cadastrado neste país. Abra a empresa existente.';
    if(state.companies.some(c=>c.id!==id&&normalize(c.name)===normalize(v.name)&&normalize(c.city)===normalize(v.city)&&normalize(c.country)===normalize(v.country)&&(!v.taxid||!c.taxid)))return 'Há uma empresa com o mesmo nome e local. Revise o cadastro existente; identifique fiscalmente empresas distintas antes de duplicar.';
    if(state.routes.some(r=>r.company===id)&&!v.roles.includes('Importador'))return 'Empresa usada como importador em uma rota. Preserve esse papel ou revise os vínculos primeiro.';
    if(state.routes.some(r=>r.supplier===id)&&!v.roles.some(r=>['Fornecedor','Exportador'].includes(r)))return 'Empresa usada como fornecedor/exportador em uma rota. Preserve um desses papéis ou revise os vínculos primeiro.';
  }
  if(kind==='agent'){if(!v.modes.length)return 'Selecione ao menos uma modalidade.';if(state.agents.some(a=>a.id!==id&&normalize(a.name)===normalize(v.name)))return 'Já existe um agente com esse nome. Abra o cadastro para revisar.';}
  if(kind==='location'){
    if(state.locations[id]&&state.locations[id].type!==v.type&&state.routes.some(r=>pointIds(r).includes(id)))return 'Este local está em rotas. Preserve o tipo ou cadastre outro ponto.';
    if(Object.entries(state.locations).some(([i,l])=>i!==id&&((v.code&&normalize(l.code)===normalize(v.code)&&l.type===v.type)||normalize(l.name)===normalize(v.name)&&normalize(l.country)===normalize(v.country)&&normalize(l.city)===normalize(v.city)&&l.type===v.type)))return 'Local já cadastrado. Reutilize o registro existente.';
  }
  if(kind==='route'){
    if(!company(v.company)?.roles.includes('Importador'))return 'Selecione uma empresa com papel Importador.';
    if(!v.from||!v.to)return 'Selecione a origem e a chegada internacional.';
    if(v.via.some(i=>!i))return 'Selecione o local de cada conexão ou remova a linha vazia.';
    const ids=pointIds(v);if(new Set(ids).size!==ids.length)return 'Use pontos diferentes no percurso; há um local repetido.';
    const expected=v.mode==='Marítimo'?'Porto':v.mode==='Aéreo'?'Aeroporto':null;
    if(expected&&[v.from,v.to,...v.via].some(i=>loc(i).type!==expected))return `No trecho ${v.mode.toLowerCase()}, origem, conexões e chegada devem ser ${expected==='Porto'?'portos':'aeroportos'}. Coleta e entrega são trechos separados.`;
    const old=route(id);if(v.agent&&(!agent(v.agent).active||!agent(v.agent).modes.includes(v.mode))&&!(old?.agent===v.agent&&old?.mode===v.mode))return 'O agente está bloqueado ou não atende este modal. Escolha outro agente ou deixe sem preferência.';
    if(old&&operations.some(o=>o.route===id)&&(JSON.stringify(pointIds(old))!==JSON.stringify(ids)||old.mode!==v.mode||old.company!==v.company||old.supplier!==v.supplier))return 'Esta rota tem casos demonstrativos vinculados. Cadastre outro percurso para preservar a identidade do histórico.';
    if(state.routes.some(r=>r.id!==id&&JSON.stringify(pointIds(r))===JSON.stringify(ids)&&r.mode===v.mode&&r.company===v.company&&r.supplier===v.supplier&&normalize(r.equipment)===normalize(v.equipment)))return 'Esta rota já está cadastrada com o mesmo percurso e condição. Abra o registro existente.';
  }
  return '';
}
document.addEventListener('submit',e=>{
  if(e.target.id!=='entity-form')return;e.preventDefault();const {kind,id}=e.target.dataset,v=kind==='agent'?catalogValues(id,formValues(e.target)):formValues(e.target),error=validate(kind,v,id);
  if(error){$('#form-error').textContent=error;$('#form-error').scrollIntoView({block:'nearest'});return}
  const newId=id||kind+'-'+crypto.randomUUID();
  if(kind==='location'){state.locations[newId]={...state.locations[newId],...v};Object.assign(locations,state.locations)}else{const a=state[kind==='company'?'companies':kind==='route'?'routes':'agents'];if(id)Object.assign(a.find(x=>x.id===id),v);else a.push({id:newId,...v});}
  save();
  if(kind==='location'&&pendingRoute){const draft=pendingRoute;pendingRoute=null;routeForm(draft.id,draft.values);toast('Local salvo. Selecione-o no percurso; seu rascunho foi preservado.');return}
  closeDrawer();if(id)render();else location.hash=`${Object.keys(meta).find(k=>meta[k][2]===kind)}/${newId}`;toast('Cadastro salvo neste navegador.');
});
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-action]');if(!b)return;const {action,id}=b.dataset;
  if(action==='close'){if(pendingRoute){const draft=pendingRoute;pendingRoute=null;routeForm(draft.id,draft.values)}else closeDrawer()}
  if(action==='company-form')companyForm(id);if(action==='agent-form')agentForm(id);if(action==='route-form')routeForm(id);if(action==='location-form')locationForm(id);
  if(action==='clear-list'){listState[id]={q:'',f:'Todos',scroll:0};list(id)}
  if(action==='add-connection'){const all=[['','Selecione um local'],...Object.entries(state.locations).map(([i,l])=>[i,`${l.name} · ${l.code||l.type}`])];$('#connections').insertAdjacentHTML('beforeend',connectionField(all,'',$('#connections').children.length));}
  if(action==='remove-connection'){b.closest('.connection-row').remove();document.querySelectorAll('#connections .field').forEach((l,n)=>l.firstChild.textContent='Conexão '+(n+1));}
  if(action==='route-new-location'){const f=$('#entity-form');pendingRoute={id:f.dataset.id,values:formValues(f)};locationForm('')}
});
document.addEventListener('change',e=>{if(e.target.name==='mode'&&e.target.closest('#entity-form')?.dataset.kind==='route'){const f=$('#entity-form'),v=formValues(f);if(v.agent&&!agent(v.agent).modes.includes(v.mode))v.agent='';routeForm(f.dataset.id,v)}});
$('#drawer').addEventListener('cancel',e=>{if(pendingRoute){e.preventDefault();const draft=pendingRoute;pendingRoute=null;routeForm(draft.id,draft.values)}});
$('#reset').addEventListener('click',()=>openDrawer('Reiniciar exemplo','Somente esta demonstração',`<p>Cadastros e preferências desta demonstração voltarão ao cenário inicial.</p><div class="drawer-actions">${btn('Cancelar','close','',true)}<button class="button" id="confirm-reset">Reiniciar exemplo</button></div>`));
document.addEventListener('click',e=>{if(e.target.id==='confirm-reset'){state=structuredClone(seed);Object.keys(locations).forEach(k=>delete locations[k]);Object.assign(locations,state.locations);Object.keys(listState).forEach(k=>delete listState[k]);returnTargets={};save();closeDrawer();location.hash='inicio';render();toast('Exemplo reiniciado.')}});
window.addEventListener('hashchange',()=>{closeDrawer();pendingRoute=null;render();if(!listState[current])window.scrollTo(0,0)});
render();

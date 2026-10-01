/* Estado por etapa da entrada e rascunhos por registro. Puro: a UI só renderiza o que sai daqui. */
(function(root){
  const E=typeof module!=='undefined'&&module.exports?require('./entry.js'):root.EntryAudit;
  const STEPS=['Localizar operação','Conferir contexto','Reunir fontes','Escopo e início'];
  const STATE_LABELS={nao_iniciada:'Não iniciada',em_andamento:'Em andamento',pendente_documento:'Pendente de documento',concluida:'Concluída',com_divergencia:'Com divergência'};
  const REQUIRED=['Obrigatório','Obrigatório por controle','Alternativa necessária'];
  const CONTEXT_KEYS=['supplier','direction','modal','origin','destination','incoterm','namedPlace','contractor','owner'];
  const clampStep=n=>Math.min(STEPS.length,Math.max(1,Number(n)||1));
  const visited=(d,n)=>(d.visited||[]).includes(n)||d.step===n;
  function bound(d){return !!(d.recordKey||d.opId||d.external);}
  function pendingDocuments(d){
    return d.sources.filter(s=>!s.linked&&REQUIRED.includes(E.requirement(s,d.fields))&&['Pendente','Arquivo selecionado'].includes(s.status)).map(s=>({id:s.id,name:s.name,status:s.status}));
  }
  function divergences(d,ops){
    const out=[];
    if(!d.opId&&E.duplicates(ops||[],d).length&&(!d.fields.distinctConfirmed||!String(d.fields.distinctReason||'').trim()))out.push({step:2,text:'Documento ou booking coincide com uma operação já cadastrada.'});
    const seen=new Set();
    for(const c of d.charges){const k=String(c.id||'').trim().toLowerCase()+'|'+String(c.issuer||'').trim().toLowerCase();if(c.id&&c.issuer&&seen.has(k)){out.push({step:3,text:'Cobrança repetida para o mesmo emissor.'});break;}seen.add(k);}
    return out;
  }
  // O que falta em cada etapa, em frases curtas; cada item diz a etapa e, quando há, o documento.
  function missing(d,n,ops){
    if(n===1)return bound(d)?[]:[{step:1,text:'Escolha uma cotação, um embarque ou cadastre uma operação externa.'}];
    if(n===2)return E.errors(d,2).map(text=>({step:2,text}));
    if(n===3)return E.errors(d,3).map(text=>({step:3,text})).concat(pendingDocuments(d).map(s=>({step:3,doc:s.id,text:(s.status==='Arquivo selecionado'?'Aguardando leitura: ':'Falta documento: ')+s.name+'.'})));
    return [1,2,3].flatMap(k=>k===3?E.errors(d,3).map(text=>({step:3,text})):missing(d,k,ops));
  }
  function touched(d,n){
    if(n===1)return !!String(d.query||'').trim()||bound(d);
    if(n===2)return CONTEXT_KEYS.some(k=>String(d.fields[k]||'').trim());
    if(n===3)return d.charges.length>0||d.events.length>0||d.sources.some(s=>!s.linked&&(s.files.length||s.status!=='Pendente'||s.reason||s.owner));
    return visited(d,4);
  }
  function stepState(d,n,ops){
    if(divergences(d,ops).some(x=>x.step===n))return 'com_divergencia';
    if(n===4){if(!visited(d,4))return 'nao_iniciada';return missing(d,4,ops).length?'em_andamento':'concluida';}
    if(n>1&&!bound(d)&&!touched(d,n)&&!visited(d,n))return 'nao_iniciada';
    const gaps=missing(d,n,ops);
    if(!gaps.length&&(n!==3||visited(d,3)||touched(d,3)))return n===1||touched(d,n)||visited(d,n)?'concluida':'nao_iniciada';
    if(n===3&&gaps.length&&gaps.every(g=>g.doc))return 'pendente_documento';
    return touched(d,n)||(n>1&&visited(d,n))?'em_andamento':'nao_iniciada';
  }
  function summary(d,ops){return STEPS.map((label,i)=>{const n=i+1;return {n,label,state:stepState(d,n,ops),missing:missing(d,n,ops)};});}
  // Navegação livre: nenhuma etapa bloqueia a outra. Só a conclusão valida (E.create).
  // Voltar à etapa 1 para trocar o vínculo não apaga onde o trabalho parou: resumeStep guarda isso.
  function go(d,n){const step=clampStep(n);const v=new Set(d.visited||[]);v.add(d.step);v.add(step);d.visited=[...v].sort();if(step===1&&d.step>1)d.resumeStep=d.step;else if(step>1)d.resumeStep=null;d.step=step;return d;}
  function resumeStep(d){return d.step===1&&d.resumeStep?d.resumeStep:d.step>1?d.step:2;}
  function draftKey(d){return d.recordKey||(d.opId?'op:'+d.opId:d.draftId||'');}
  function newDraftId(drafts){let n=1;while(drafts['novo:'+n])n++;return 'novo:'+n;}
  // Guarda o rascunho corrente na coleção; devolve a chave usada. Rascunho vazio não ocupa lugar.
  function stash(drafts,d){
    if(!d||!d.schema)return '';
    if(!bound(d)&&!touched(d,2)&&!touched(d,3))return '';
    if(!draftKey(d))d.draftId=newDraftId(drafts);
    const key=draftKey(d);drafts[key]=JSON.parse(JSON.stringify(d));return key;
  }
  function resume(drafts,key){return drafts[key]?JSON.parse(JSON.stringify(drafts[key])):null;}
  function discard(drafts,key){delete drafts[key];return drafts;}
  function list(drafts,ops){return Object.entries(drafts).map(([key,d])=>({key,title:d.fields.supplier||'Operação externa sem fornecedor',po:d.fields.po,step:resumeStep(d),savedAt:d.savedAt,steps:summary(d,ops)})).sort((a,b)=>String(b.savedAt||'').localeCompare(String(a.savedAt||'')));}
  // "Rever documento": lembra de onde o usuário saiu, para voltar ao mesmo lugar.
  function reviewDocument(d,docId,from){go(d,3);for(const s of d.sources)if(s.id===docId)s.open=true;d.returnTo={...from,doc:docId};return d;}
  function returnTarget(d){const r=d.returnTo;d.returnTo=null;return r||null;}
  const api={STEPS,STATE_LABELS,clampStep,resumeStep,bound,pendingDocuments,divergences,missing,stepState,summary,go,draftKey,stash,resume,discard,list,reviewDocument,returnTarget};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.EntrySteps=api;
})(typeof globalThis==='undefined'?this:globalThis);

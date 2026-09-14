/* Jornada demonstrativa; arquivos ficam apenas identificados na sessão. */
(function(root){
  const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const copy=o=>JSON.parse(JSON.stringify(o));
  const defaults={supplier:'',po:'',bl:'',booking:'',issuer:'',direction:'',modal:'',origin:'',destination:'',incoterm:'',incotermVersion:'2020',namedPlace:'',contractor:'',payment:'Não confirmado',agent:'',relation:'Participação operacional da Freitas',shipmentOrigin:'Externo',quoteOrigin:'Externa',quoteId:'',period:'Em preparação',operationDate:'',paymentState:'Não informado',owner:'',referenceApprover:'',referenceDate:'',referenceEvidence:'',referenceNote:'',scope:'both',absenceReason:'',contextConfirmed:false,referenceConfirmed:false};
  const docs=[['reference','Referência comercial','Cotação, contrato, proposta ou proforma e aceite.'],['booking','Booking e instruções','Serviço, equipamento, datas e condições confirmadas.'],['transport','Documento de transporte','BL / HBL / MBL, AWB / HAWB / MAWB ou CRT.'],['invoice','Cobranças de frete','Faturas / debit notes; separar da invoice da mercadoria.'],['events','Eventos e comunicação','Tracking, confirmações, revisões de ETA e e-mails.'],['cargo','Invoice e packing list','Dados de carga, peso, volume e bases de cálculo.'],['insurance','Seguro','Apólice e cobertura quando aplicáveis.'],['export','Documentos de exportação','NF-e, DU-E e documentos exigidos pelo contexto.'],['credit','Crédito / estorno e pagamento','Fatura original, credit note e comprovação financeira.']];
  function fresh(){return {schema:1,step:1,query:'',history:false,kind:'all',recordKey:'',opId:'',fields:{...defaults},sources:docs.map(([id,name,help])=>({id,name,help,status:'Pendente',files:[],reason:'',owner:'',deadline:'',linked:false})),charges:[],events:[],savedAt:null,sourceReviewPending:false};}
  function catalogue(ops){
    const records=ops.map(o=>({key:'op:'+o.id,kind:'operation',id:o.id,title:o.supplier,reference:o.reference,po:o.po,bl:o.bl,agent:o.agent,route:o.route,date:o.entryContext?.operationDate||o.timeline?.[0]?.date||o.opened,history:o.entryContext?.period?o.entryContext.period==='Concluída':o.id!=='0008'&&!o.external,op:o}));
    return records.concat([
      {key:'quote:Q-DEMO-01',kind:'quote',id:'Q-DEMO-01',title:'Fornecedor de exemplo · cotação aprovada',reference:'Q-DEMO-01 · v1',po:'PO-DEMO-01',bl:'',agent:'Agente demo',route:'Shanghai → Santos',date:'2026-09-10',history:false},
      {key:'shipment:E-DEMO-02',kind:'shipment',id:'E-DEMO-02',title:'Fornecedor de exemplo · embarque cadastrado',reference:'Referência comercial ainda não vinculada',po:'PO-DEMO-02',bl:'HBL-DEMO-02',agent:'Agente demo',route:'Hamburgo → Santos',date:'2026-09-01',history:false},
      {key:'legacy:H-DEMO-2025',kind:'history',id:'H-DEMO-2025',title:'Fornecedor de exemplo · operação de 2025',reference:'Acervo demonstrativo · referência pendente',po:'PO-DEMO-2025',bl:'HBL-DEMO-2025',agent:'Agente demo',route:'Busan → Navegantes',date:'2025-11-06',history:true}
    ]).map(r=>({...r,already:ops.find(o=>o.entryRecordKey===r.key)}));
  }
  function search(ops,d){const q=normalize(d.query);return catalogue(ops).filter(r=>(d.history||!r.history)&&(d.kind==='all'?!(r.already&&!r.op):r.kind===d.kind)&&(q===''||normalize([r.id,r.title,r.reference,r.po,r.bl,r.route,r.agent].join(' ')).includes(q)));}
  function select(record){
    if(record.already&&!record.op)return select({...record,kind:'operation',op:record.already});
    const d=fresh(),o=record.op,c=o?.entryContext||{},f=o?.freight?.context||{};
    const [origin,destination]=record.route.split(' → ');
    d.step=2;d.recordKey=record.key;d.opId=o?.id||record.already?.id||'';
    d.fields={...defaults,supplier:record.title,po:record.po||'',bl:record.bl||'',origin:origin||'',destination:destination||'',agent:record.agent||'',quoteOrigin:record.kind==='quote'||o&&!o.external?'Centrix':'Externa',quoteId:record.kind==='quote'?record.reference:o?.reference||'',shipmentOrigin:record.kind==='quote'?'Ainda não registrado':record.kind==='history'?'Externo':o?.external?'Externo':'Centrix',period:record.history?'Concluída':record.kind==='quote'?'Em preparação':'Em andamento',operationDate:record.date,direction:f.direction||'',modal:f.modal||'',incoterm:f.incoterm?.split(' · ')[0]||'',namedPlace:f.place||'',contractor:f.contractor||'',payment:f.payment||'Não confirmado',...c,contextConfirmed:false};
    if(o?.entrySources)d.sources=copy(o.entrySources);
    else if(o){for(const s of d.sources){if(s.id==='reference'&&o.checks.some(x=>x.original)||s.id==='transport'&&o.bl||s.id==='events'&&o.timeline.length||s.id==='invoice'&&o.invoices.some(i=>i.available)){s.status='Vinculado';s.linked=true;s.files=[s.id==='reference'?o.reference:s.id==='transport'?o.bl:s.id==='invoice'?o.invoices.filter(i=>i.available).map(i=>i.id).join(', '):'Eventos demonstrativos da operação'];}}}
    if(record.kind==='quote'){Object.assign(d.fields,{direction:'Importação',modal:'Marítimo FCL',incoterm:'FOB',namedPlace:'Shanghai',contractor:'Comprador / cliente',payment:'Collect',referenceApprover:'Cliente demo',referenceDate:'2026-09-10',referenceEvidence:'Aceite DEMO Q-DEMO-01'});d.sources[0]={...d.sources[0],status:'Vinculado',linked:true,files:[record.reference+' · aceite DEMO de 10/09/2026']};}
    if(record.kind==='shipment'){d.sources.find(s=>s.id==='transport').status='Vinculado';d.sources.find(s=>s.id==='transport').linked=true;d.sources.find(s=>s.id==='transport').files=[record.bl+' · documento DEMO'];}
    d.contextTrace=copy(o?.entryContextTrace||{});for(const [key,value] of Object.entries(d.fields)){if(value&&typeof value!=='boolean'&&!d.contextTrace[key])d.contextTrace[key]={source:o?.entryContext?'Contexto registrado na operação':'Registro demonstrativo · '+record.id,status:'A revisar'};}
    d.assist={text:'',files:copy(d.sources.find(s=>s.id==='context')?.files||[]),candidates:[],issues:[],history:copy(o?.entryAssistHistory||[])};
    d.charges=copy(o?.entryCharges||[]);d.events=copy(o?.entryEvents||[]);
    return d;
  }
  function requirement(s,f){
    if(s.id==='reference')return f.quoteOrigin==='Sem referência formal'?'Alternativa necessária':'Obrigatório';
    if(s.id==='invoice')return f.scope==='performance'?'Fora do recorte':'Condicional';
    if(s.id==='export')return f.direction==='Exportação'?'Condicional':'Não aplicável';
    if(s.id==='insurance')return ['CIF','CIP'].includes(f.incoterm)?'Condicional · seguro':'Condicional';
    if(s.id==='credit')return f.paymentState==='Pago'||f.period==='Concluída'?'Condicional · conferir histórico':'Opcional';
    if(s.id==='events')return f.scope==='preco'?'Fora do recorte':'Obrigatório por controle';
    if(s.id==='transport')return f.period==='Em preparação'?'Aguardando emissão':'Obrigatório por controle';
    return 'Condicional';
  }
  function errors(d,step){
    const f=d.fields,errors=[];
    if(step===2){
      for(const [k,l] of [['supplier','Fornecedor / exportador'],['direction','Direção'],['modal','Modal'],['origin','Origem'],['destination','Destino'],['incoterm','Incoterm'],['incotermVersion','Versão do Incoterm'],['namedPlace','Local nomeado'],['contractor','Contratante do frete'],['owner','Responsável pela auditoria']])if(!String(f[k]||'').trim())errors.push('Informe '+l.toLowerCase()+'.');
      if(f.incoterm==='NA'&&!f.absenceReason.trim())errors.push('Justifique o Incoterm não aplicável.');
      if(f.period==='Concluída'&&!f.operationDate)errors.push('Informe a data original da operação histórica.');
      if(!f.contextConfirmed)errors.push('Confirme o contexto da operação.');
      if(f.quoteOrigin==='Centrix'&&!f.quoteId)errors.push('Vincule a cotação aprovada da Centrix.');
    }
    if(step===3){
      if(f.referenceConfirmed&&(!f.referenceApprover.trim()||!f.referenceDate||!f.referenceEvidence.trim()))errors.push('A confirmação da referência exige aprovador, data e evidência do aceite comercial.');
      if(f.referenceConfirmed&&!d.sources.find(s=>s.id==='reference').files.length)errors.push('Identifique a fonte da referência antes de confirmar.');
      if(f.quoteOrigin==='Sem referência formal'&&!f.absenceReason.trim())errors.push('Explique a ausência de referência formal.');
      for(const s of d.sources){if(['Indisponível','Não aplicável','Substituto para revisão','Dispensa solicitada'].includes(s.status)&&!s.reason.trim())errors.push('Justifique: '+s.name+'.');if(s.status==='Arquivo selecionado'&&!s.files.length)errors.push('Selecione o arquivo de '+s.name+'.');}
      const ids=new Set();for(const c of d.charges){if(!c.id.trim()||!c.issuer.trim())errors.push('Identifique número e emissor de cada cobrança.');const id=normalize(c.id)+'|'+normalize(c.issuer);if(ids.has(id))errors.push('Há uma cobrança repetida para o mesmo emissor. Revise número e versão.');ids.add(id);}
      for(const e of d.events){if(!e.name.trim()||!e.date||!e.source.trim())errors.push('Cada marco precisa de nome, data e fonte.');}
    }
    return [...new Set(errors)];
  }
  function duplicates(ops,d){if(d.opId)return [];const f=d.fields;if(!f.bl.trim()&&!f.booking.trim())return [];return ops.filter(o=>(f.bl.trim()&&normalize(o.bl)===normalize(f.bl))||(f.booking.trim()&&normalize(o.entryContext?.booking)===normalize(f.booking)));}
  function create(ops,d,today){
    const invalid=[...errors(d,2),...errors(d,3)];if(invalid.length)return {errors:invalid};
    let op=ops.find(o=>o.id===d.opId||d.recordKey&&o.entryRecordKey===d.recordKey);
    if(!op&&duplicates(ops,d).length&&(!d.fields.distinctConfirmed||!d.fields.distinctReason?.trim()))return {errors:['Possível operação existente. Revise o vínculo ou justifique a operação distinta antes de cadastrar.']};
    const f=copy(d.fields),existing=!!op;
    if(!op){let n=1;while(ops.some(o=>o.id==='AUD-EXT-'+String(n).padStart(3,'0')))n++;
      op={id:'AUD-EXT-'+String(n).padStart(3,'0'),supplier:f.supplier.trim(),po:f.po.trim(),bl:f.bl.trim(),agent:f.agent.trim()||'Agente não informado',route:f.origin+' → '+f.destination,reference:f.quoteId||'Referência externa · validação pendente',external:f.shipmentOrigin!=='Centrix',opened:today,updated:today,version:1,requested:f.scope==='both'?['preco','performance']:[f.scope],invoices:[],checks:[],timeline:[],logs:[{date:today,text:'Registro criado para auditoria. Data original '+(f.operationDate||'não informada')+'. Arquivos e dados informados aguardam integração/validação; nenhum despacho ou acompanhamento criado.'}],operationalRecipient:''};ops.push(op);
    }
    const requested=f.scope==='both'?['preco','performance']:[f.scope];
    if(existing&&requested.some(dim=>!op.requested.includes(dim))){op.requested=[...new Set([...op.requested,...requested])];op.version++;}
    op.entryContext=f;op.entryContextTrace=copy(d.contextTrace||{});op.entryAssistHistory=copy(d.assist?.history||op.entryAssistHistory||[]);op.entrySources=copy(d.sources);op.entryCharges=copy(d.charges);op.entryEvents=copy(d.events);op.entryRecordKey=op.entryRecordKey||d.recordKey||'';
    op.entryPending=true;op.updated=today;
    op.logs.push({date:today,text:(existing?'Contexto e fontes complementares registrados na mesma operação.':'Jornada de entrada concluída. Apuração aguardando fontes validadas.')+' Dados declarados e arquivos selecionados não foram extraídos. Referências e resultados existentes preservados.'});
    return {op,existing,errors:[]};
  }
  const api={fresh,catalogue,search,select,requirement,errors,duplicates,create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.EntryAudit=api;
})(typeof globalThis==='undefined'?this:globalThis);

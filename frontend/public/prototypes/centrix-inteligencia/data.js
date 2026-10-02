'use strict';
// IDs e identidades da fixture de Configurações de 13/09 (v2). Não lê nem grava seu localStorage.
const D = (() => {
  const cutoff = '2026-09-13';
  // FIXTURE FICTÍCIA (02/10/2026, Inteligência personalizável). Repo público:
  // nenhum nome real. 40 embarques de março a setembro de 2026, com os seis
  // campos dos filtros (exportador, agente, rota, incoterm, país de origem e SKU
  // por ITEM) e variedade suficiente para os filtros mudarem o relatório.
  const companies = [
    {id:'east',name:'Eastbridge Components',legal:'Eastbridge Components Ltd.',country:'China',city:'Ningbo',roles:['Exportador','Exportador'],contact:'Lin Chen',notes:'Confirmar prontidão antes da coleta.'},
    {id:'yang',name:'Yangtze Polymers',legal:'Yangtze Polymers Co.',country:'China',city:'Shanghai',roles:['Exportador'],contact:'Wei Zhang',notes:'Resinas e filmes técnicos; lotes mensais.'},
    {id:'nord',name:'Nordwerk Industrial',legal:'Nordwerk Industrial GmbH',country:'Alemanha',city:'Hamburgo',roles:['Importador','Exportador','Exportador'],contact:'Anna Weber',notes:'Peças e retorno de componentes para manutenção.'},
    {id:'lig',name:'Liguria Valvole',legal:'Liguria Valvole S.r.l.',country:'Itália',city:'Gênova',roles:['Exportador'],contact:'Marco Rossi',notes:'Válvulas sob encomenda; prontidão sensível.'}
  ];
  const agents = [{id:'alpha',name:'Alpha Logistics',initial:'AL',contact:'Camila Santos',preferred:true},{id:'beta',name:'Beta Cargo',initial:'BC',contact:'Ricardo Lima',preferred:false},{id:'gamma',name:'Gamma Freight',initial:'GF',contact:'Juliana Alves',preferred:false}];
  const locations = {
    ningbo:{name:'Ningbo',code:'CNNGB',type:'Porto',country:'China'},shanghai:{name:'Shanghai',code:'CNSHA',type:'Porto',country:'China'},itajai:{name:'Itajaí',code:'BRITJ',type:'Porto',country:'Brasil'},santos:{name:'Santos',code:'BRSSZ',type:'Porto',country:'Brasil'},hamburgo:{name:'Hamburgo',code:'DEHAM',type:'Porto',country:'Alemanha'},genova:{name:'Gênova',code:'ITGOA',type:'Porto',country:'Itália'},
    singapore:{name:'Singapura',code:'SGSIN',type:'Porto de conexão',country:'Singapura',extension:true},'east-factory':{name:'Eastbridge · unidade Ningbo',code:'',type:'Coleta / entrega',country:'China'},nordsite:{name:'Nordwerk · Hamburgo',code:'DEMO-COLETA-NORD',type:'Local de coleta',country:'Alemanha',extension:true},'aurora-factory':{name:'Aurora · unidade Joinville',code:'',type:'Coleta / entrega',country:'Brasil'}
  };
  const routes = [{id:'ningbo',from:'ningbo',to:'itajai',collection:'east-factory',final:'aurora-factory',mode:'Marítimo',equipment:'FCL · 40 HC',preferred:true,agent:'alpha'},{id:'shanghai',from:'shanghai',to:'santos',collection:null,final:'aurora-factory',mode:'Marítimo',equipment:'FCL · 40 HC',preferred:false,agent:'beta'},{id:'hamburgo',from:'hamburgo',to:'itajai',collection:'nordsite',final:'aurora-factory',mode:'Marítimo',equipment:'LCL',preferred:true,agent:'gamma'},{id:'genova',from:'genova',to:'santos',collection:null,final:'aurora-factory',mode:'Marítimo',equipment:'FCL · 20 DC',preferred:false,agent:'alpha'}];
  const skus = {
    'EC-240':{desc:'Conectores industriais',exporter:'east'},'EC-310':{desc:'Chicotes elétricos',exporter:'east'},
    'YP-115':{desc:'Resina PP granulada',exporter:'yang'},'YP-220':{desc:'Filme técnico',exporter:'yang'},
    'NW-610':{desc:'Peças de reposição',exporter:'nord'},'NW-720':{desc:'Rolamentos',exporter:'nord'},
    'LG-050':{desc:'Válvulas de controle',exporter:'lig'}
  };
  const add = (date,n) => new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
  const days = (a,b) => a && b ? Math.round((Date.parse(b)-Date.parse(a))/86400000) : null;
  // Um ciclo fixo de exportador/rota/agente/incoterm (determinístico: a mesma
  // fixture em todo navegador e em todo teste) e desvios que contam uma história:
  // a Eastbridge melhora a prontidão ao longo do ano, a Beta Cargo perde prazo no
  // trânsito em julho/agosto, Santos segura a liberação em agosto, e o frete sobe
  // ~8% a partir de julho.
  const plan = [
    ['east','ningbo','alpha','FOB',['EC-240']],['yang','shanghai','beta','FOB',['YP-115']],['nord','hamburgo','gamma','EXW',['NW-610']],['lig','genova','alpha','CIF',['LG-050']],
    ['east','shanghai','beta','FOB',['EC-310','EC-240']],['yang','shanghai','beta','CIF',['YP-115','YP-220']],['east','ningbo','alpha','FOB',['EC-240','EC-310']],['nord','hamburgo','gamma','FOB',['NW-610','NW-720']],
    ['lig','genova','gamma','CIF',['LG-050']],['yang','shanghai','alpha','FOB',['YP-220']]
  ];
  const transitPlans = {ningbo:32,shanghai:34,hamburgo:22,genova:26};
  const baseFreight = {ningbo:3200,shanghai:3400,hamburgo:1800,genova:2600};
  const condition = ['integra','integra','integra','avaria','integra','integra','integra','integra'];
  const operations = Array.from({length:40},(_,i)=>{
    const [supplier,route,agent,incoterm,itemSkus] = plan[i%plan.length];
    const readyPlan = add('2026-03-02',Math.round(i*4.75));
    const month = Number(readyPlan.slice(5,7));
    const h = (i*37+11)%17;
    const readyDelay = i%13===7 ? null
      : supplier==='east' ? (month<=5 ? (h%3?2:0) : month<=7 ? (h%4===0?1:0) : 0)
      : supplier==='yang' ? (h%4===0?2:0)
      : supplier==='lig' ? (h%5===0?4:0) : (h%7===0?1:0);
    const transitExtra = agent==='beta' ? (month>=7 ? 3+h%3 : h%4===0?2:0) : agent==='gamma' ? (h%6===0?2:0) : (h%9===0?1:0);
    const portExtra = route==='shanghai'||route==='genova' ? (month===8 ? 2+h%2 : h%8===0?1:0) : 0;
    const variant = route==='ningbo' && i%3===0 ? 'conexao' : 'direto';
    const transitPlan = transitPlans[route];
    const actualReady = add(readyPlan,readyDelay||0), collect=add(actualReady,2), depart=add(collect,4), arrive=add(depart,transitPlan+transitExtra),gate=add(arrive,3+portExtra), final=add(gate,2);
    const known = date=>date<=cutoff?date:null;
    const num=String(i+1).padStart(3,'0');
    const items = itemSkus.map((sku,k)=>({sku,desc:skus[sku].desc,qty:k?400:1000}));
    const docs = i%11===4 ? null : i%5===2 ? 'corrigida' : 'correta';
    const receipt = i%9===5 ? 'parcial' : 'completo';
    const audit = i%12===0 ? 'divergencia' : i%7===3 ? 'inconclusiva' : i%6===5 ? 'nao-auditada' : 'conforme';
    const freight = Math.round(baseFreight[route]*(month>=7?1.08:1)+(i%3)*60);
    const freeTime = {agreed:21,granted:agent==='beta'&&month>=7?14:21};
    const bookingHours = agent==='beta' ? (month>=7?60:30) : agent==='gamma' ? 36 : 20;
    return {id:'DEMO-'+num,po:'PO '+(4521+i),sku:items[0].sku,cargo:items[0].desc,items,incoterm,country:companies.find(c=>c.id===supplier).country,supplier,route,agent,variant,readyPlan,ready:readyDelay===null?null:known(actualReady),collect:known(collect),depart:known(depart),arrive:known(arrive),gate:known(gate),final:known(final),collectPlan:add(readyPlan,2),departPlan:add(readyPlan,6),arrivePlan:add(readyPlan,6+transitPlan),finalPlan:add(readyPlan,11+transitPlan),arriveForecast:arrive,finalForecast:final,transitPlan,docs,ordered:items[0].qty,received:known(final)&&receipt?(receipt==='parcial'?Math.round(items[0].qty*0.95):items[0].qty):null,condition:known(final)?condition[i%condition.length]:null,freight,cargoValue:i%10===3?null:({east:24000,yang:18000,nord:42000,lig:36000})[supplier],audit:known(arrive)?audit:'nao-auditada',extra:audit==='divergencia'?195:null,responseHours:bookingHours,freeTime,connectionIn:variant==='conexao'?known(add(depart,7)):null,connectionOut:variant==='conexao'?known(add(depart,10)):null};
  });
  const metrics = {
    ready:{label:'Prontidão no prazo',source:'Compromisso da PO + confirmação do exportador',definition:'Prontidão realizada até o compromisso original, em dias corridos. Não mede transporte.',eligible:o=>!!o.ready,ok:o=>o.ready<=o.readyPlan,value:o=>`${o.readyPlan} → ${o.ready||'sem confirmação'}`},
    docs:{label:'Documentação sem correção',source:'Checklist da primeira versão documental',definition:'Primeira versão aceita sem correção entre entregas com checklist. Ausência de checklist não significa conformidade.',eligible:o=>!!o.docs,ok:o=>o.docs==='correta',value:o=>o.docs==='correta'?'Primeira versão aceita':o.docs==='corrigida'?'Correção de packing list registrada':'Checklist ausente'},
    quantity:{label:'Quantidade completa',source:'PO + comprovante de recebimento',definition:'Recebimentos com quantidade igual à pedida, por PO e SKU, entre registros com quantidade recebida. Não é OTIF.',eligible:o=>o.received!==null,ok:o=>o.received===o.ordered,value:o=>o.received===null?'Quantidade recebida não informada':`${o.received} / ${o.ordered} un. · ${o.sku}`},
    condition:{label:'Mercadoria íntegra',source:'Inspeção de recebimento',definition:'Inspeções sem avaria entre registros inspecionados. A ocorrência não define o responsável.',eligible:o=>!!o.condition,ok:o=>o.condition==='integra',value:o=>o.condition==='integra'?'Inspeção sem avaria':o.condition==='avaria'?'Embalagem amassada · causa não apurada':'Inspeção ausente'},
    port:{label:'Chegada ao porto no prazo',source:'Primeiro ETA contratado + evento de chegada',definition:'Chegada internacional realizada até o primeiro ETA contratado. Resultado da cadeia, sem atribuição automática ao exportador ou agente.',eligible:o=>!!o.arrive,ok:o=>o.arrive<=o.arrivePlan,value:o=>o.arrive?`${o.arrivePlan} → ${o.arrive} · ${Math.max(0,days(o.arrivePlan,o.arrive))} d de desvio`:'Chegada ainda prevista'},
    final:{label:'Entrega final no prazo',source:'Compromisso final + comprovante de entrega',definition:'Entrega em Joinville realizada até o compromisso final original, entre operações com comprovante. Não usa ETA portuária.',eligible:o=>!!o.final,ok:o=>o.final<=o.finalPlan,value:o=>o.final?`${o.finalPlan} → ${o.final}`:'Entrega ainda prevista'},
    audit:{label:'Cobrança sem diferença',source:'Proposta aceita + fatura + conferência',definition:'Conferências concluídas sem diferença entre casos com conclusão financeira. Em esclarecimento e não auditados ficam fora do denominador.',eligible:o=>['conforme','divergencia'].includes(o.audit),ok:o=>o.audit==='conforme',value:o=>({'conforme':'Conforme no escopo conferido','divergencia':'USD 195 fundamentados · não recuperados','inconclusiva':'Escopo em esclarecimento','nao-auditada':'Ainda não auditada'}[o.audit])},
    freight:{label:'Frete internacional contratado',source:'Proposta aceita',definition:'Soma em USD do frete internacional contratado. Exclui taxas, tributos e trecho terrestre; não é custo logístico total.',eligible:o=>o.freight!==null,amount:o=>o.freight,value:o=>`USD ${o.freight}`},
    cargo:{label:'Valor da mercadoria',source:'Commercial invoice',definition:'Soma em USD dos valores comerciais documentados das POs no recorte. Valores ausentes são excluídos; não mede toda a compra da empresa.',eligible:o=>o.cargoValue!==null,amount:o=>o.cargoValue,value:o=>o.cargoValue===null?'Commercial invoice ausente':`USD ${o.cargoValue}`}
  };
  const stages=[{id:'pre',label:'Prontidão → coleta',from:'ready',to:'collect',plan:()=>2,source:'Confirmação de prontidão + recibo de coleta'},{id:'origin',label:'Coleta → embarque',from:'collect',to:'depart',plan:()=>4,source:'Recibo de coleta + evento de saída'},{id:'sea',label:'Trânsito internacional',from:'depart',to:'arrive',plan:o=>o.transitPlan,source:'Eventos de saída e chegada'},{id:'port',label:'Chegada → gate out',from:'arrive',to:'gate',plan:()=>3,source:'Eventos de chegada + gate out'},{id:'land',label:'Gate out → destino final',from:'gate',to:'final',plan:()=>2,source:'Gate out + comprovante de entrega'}];
  const connectionStages=[{id:'sea-first',label:'Ningbo → Singapura',from:'depart',to:'connectionIn',plan:()=>7,source:'Saída de Ningbo + entrada em Singapura'},{id:'connection',label:'Permanência em Singapura',from:'connectionIn',to:'connectionOut',plan:()=>3,source:'Entrada + saída da conexão'},{id:'sea-last',label:'Singapura → Itajaí',from:'connectionOut',to:'arrive',plan:()=>22,source:'Saída de Singapura + chegada a Itajaí'}];
  function metric(key,ops){const m=metrics[key],eligible=ops.filter(m.eligible),excluded=ops.filter(o=>!m.eligible(o));return {m,eligible,excluded,good:m.ok?eligible.filter(m.ok).length:null,total:m.amount?eligible.reduce((n,o)=>n+m.amount(o),0):null,rate:m.ok&&eligible.length?Math.round(eligible.filter(m.ok).length/eligible.length*100):null};}
  return {cutoff,companies,agents,locations,routes,skus,operations,metrics,stages,connectionStages,add,days,metric};
})();
if(typeof module!=='undefined')module.exports=D;

'use strict';
// IDs e identidades da fixture de Configurações de 13/09 (v2). Não lê nem grava seu localStorage.
const D = (() => {
  const cutoff = '2026-09-13';
  const companies = [{id:'east',name:'Eastbridge Components',legal:'Eastbridge Components Ltd.',country:'China',city:'Ningbo',roles:['Exportador','Fornecedor'],contact:'Lin Chen',notes:'Confirmar prontidão antes da coleta.'},{id:'nord',name:'Nordwerk Industrial',legal:'Nordwerk Industrial GmbH',country:'Alemanha',city:'Hamburgo',roles:['Importador','Exportador','Fornecedor'],contact:'Anna Weber',notes:'Peças e retorno de componentes para manutenção.'}];
  const agents = [{id:'alpha',name:'Alpha Logistics',initial:'AL',contact:'Camila Santos',preferred:true},{id:'beta',name:'Beta Cargo',initial:'BC',contact:'Ricardo Lima',preferred:false},{id:'gamma',name:'Gamma Freight',initial:'GF',contact:'Juliana Alves',preferred:false}];
  const locations = {
    ningbo:{name:'Ningbo',code:'CNNGB',type:'Porto',country:'China'},shanghai:{name:'Shanghai',code:'CNSHA',type:'Porto',country:'China'},itajai:{name:'Itajaí',code:'BRITJ',type:'Porto',country:'Brasil'},santos:{name:'Santos',code:'BRSSZ',type:'Porto',country:'Brasil'},hamburgo:{name:'Hamburgo',code:'DEHAM',type:'Porto',country:'Alemanha'},frankfurt:{name:'Frankfurt',code:'FRA',type:'Aeroporto',country:'Alemanha'},gru:{name:'Guarulhos',code:'GRU',type:'Aeroporto',country:'Brasil'},
    singapore:{name:'Singapura',code:'SGSIN',type:'Porto de conexão',country:'Singapura',extension:true},'east-factory':{name:'Eastbridge · unidade Ningbo',code:'',type:'Coleta / entrega',country:'China'},nordsite:{name:'Nordwerk · Hamburgo',code:'DEMO-COLETA-NORD',type:'Local de coleta',country:'Alemanha',extension:true},'aurora-factory':{name:'Aurora · unidade Joinville',code:'',type:'Coleta / entrega',country:'Brasil'}
  };
  const routes = [{id:'ningbo',from:'ningbo',to:'itajai',collection:'east-factory',final:'aurora-factory',mode:'Marítimo',equipment:'FCL · 40 HC',preferred:true,agent:'alpha'},{id:'shanghai',from:'shanghai',to:'santos',collection:'east-factory',final:'aurora-factory',mode:'Marítimo',equipment:'FCL · 40 HC',preferred:false,agent:'beta'},{id:'hamburgo',from:'hamburgo',to:'itajai',collection:'nordsite',final:'aurora-factory',mode:'Marítimo',equipment:'LCL',preferred:true,agent:'gamma'},{id:'frankfurt',from:'frankfurt',to:'gru',collection:null,final:null,mode:'Aéreo',equipment:'Carga geral',preferred:false,agent:'beta'}];
  const add = (date,n) => new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
  const days = (a,b) => a && b ? Math.round((Date.parse(b)-Date.parse(a))/86400000) : null;
  // supplier, rota, agente, compromisso original, atraso prontidão, trânsito adicional,
  // liberação adicional, variante, documentação, recebimento, inspeção, cobrança.
  const rows = [
    ['east','ningbo','alpha','2026-06-04',3,5,3,'conexao','corrigida','completo','integra','divergencia'],
    ['east','ningbo','alpha','2026-06-18',0,4,0,'conexao','correta','parcial','avaria','conforme'],
    ['east','ningbo','alpha','2026-07-01',2,0,0,'direto','corrigida','completo','integra','conforme'],
    ['east','shanghai','beta','2026-07-10',0,3,4,'direto','correta',null,null,'inconclusiva'],
    ['east','ningbo','alpha','2026-07-20',0,0,0,'direto','correta','completo','integra','conforme'],
    ['east','ningbo','alpha','2026-08-01',0,0,0,'direto','correta','completo','integra','conforme'],
    ['east','ningbo','alpha','2026-08-08',null,2,0,'conexao',null,null,null,'nao-auditada'],
    ['east','shanghai','beta','2026-08-25',0,0,0,'direto','correta',null,null,'nao-auditada'],
    ['nord','hamburgo','gamma','2026-06-10',0,0,0,'direto','correta','completo','integra','conforme'],
    ['nord','hamburgo','gamma','2026-07-05',0,2,1,'direto','correta','completo','integra','conforme'],
    ['nord','hamburgo','gamma','2026-07-24',1,0,0,'direto','corrigida','completo',null,'nao-auditada'],
    ['nord','hamburgo','gamma','2026-08-15',0,0,0,'direto',null,null,null,'nao-auditada']
  ];
  const operations = rows.map((x,i) => {
    const [supplier,route,agent,readyPlan,readyDelay,transitExtra,portExtra,variant,docs,receipt,condition,audit] = x;
    const transitPlan = route==='hamburgo'?22:32;
    const actualReady = add(readyPlan,readyDelay||0), collect=add(actualReady,2), depart=add(collect,4), arrive=add(depart,transitPlan+transitExtra),gate=add(arrive,3+portExtra), final=add(gate,2);
    const known = date=>date<=cutoff?date:null;
    const num=String(i+1).padStart(3,'0');
    return {id:'DEMO-'+num,po:'PO '+(4521+i),sku:supplier==='east'?'EC-240':'NW-610',cargo:supplier==='east'?'Conectores industriais':'Peças de reposição',supplier,route,agent,variant,readyPlan,ready:readyDelay===null?null:known(actualReady),collect:known(collect),depart:known(depart),arrive:known(arrive),gate:known(gate),final:known(final),collectPlan:add(readyPlan,2),departPlan:add(readyPlan,6),arrivePlan:add(readyPlan,6+transitPlan),finalPlan:add(readyPlan,11+transitPlan),arriveForecast:arrive,finalForecast:final,transitPlan,docs,ordered:1000,received:known(final)&&receipt?(receipt==='parcial'?950:1000):null,condition:known(final)?condition:null,freight:route==='hamburgo'?1800:3200+(i%3)*100,cargoValue:i===3||i===6?null:(supplier==='east'?24000:42000),audit:known(arrive)?audit:'nao-auditada',extra:audit==='divergencia'?195:null,responseHours:12+i*2,connectionIn:variant==='conexao'?known(add(depart,7)):null,connectionOut:variant==='conexao'?known(add(depart,10)):null};
  });
  const metrics = {
    ready:{label:'Prontidão no prazo',source:'Compromisso da PO + confirmação do exportador',definition:'Prontidão realizada até o compromisso original, em dias corridos. Não mede transporte.',eligible:o=>!!o.ready,ok:o=>o.ready<=o.readyPlan,value:o=>`${o.readyPlan} → ${o.ready||'sem confirmação'}`},
    docs:{label:'Documentação sem correção',source:'Checklist da primeira versão documental',definition:'Primeira versão aceita sem correção entre entregas com checklist. Ausência de checklist não significa conformidade.',eligible:o=>!!o.docs,ok:o=>o.docs==='correta',value:o=>o.docs==='correta'?'Primeira versão aceita':o.docs==='corrigida'?'Correção de packing list registrada':'Checklist ausente'},
    quantity:{label:'Quantidade completa',source:'PO + comprovante de recebimento',definition:'Recebimentos com quantidade igual à pedida, por PO e SKU, entre registros com quantidade recebida. Não é OTIF.',eligible:o=>o.received!==null,ok:o=>o.received===o.ordered,value:o=>o.received===null?'Quantidade recebida não informada':`${o.received} / ${o.ordered} un. · ${o.sku}`},
    condition:{label:'Mercadoria íntegra',source:'Inspeção de recebimento',definition:'Inspeções sem avaria entre registros inspecionados. A ocorrência não define o responsável.',eligible:o=>!!o.condition,ok:o=>o.condition==='integra',value:o=>o.condition==='integra'?'Inspeção sem avaria':o.condition==='avaria'?'Embalagem amassada · causa não apurada':'Inspeção ausente'},
    port:{label:'Chegada ao porto no prazo',source:'Primeiro ETA contratado + evento de chegada',definition:'Chegada internacional realizada até o primeiro ETA contratado. Resultado da cadeia, sem atribuição automática ao fornecedor ou agente.',eligible:o=>!!o.arrive,ok:o=>o.arrive<=o.arrivePlan,value:o=>o.arrive?`${o.arrivePlan} → ${o.arrive} · ${Math.max(0,days(o.arrivePlan,o.arrive))} d de desvio`:'Chegada ainda prevista'},
    final:{label:'Entrega final no prazo',source:'Compromisso final + comprovante de entrega',definition:'Entrega em Joinville realizada até o compromisso final original, entre operações com comprovante. Não usa ETA portuária.',eligible:o=>!!o.final,ok:o=>o.final<=o.finalPlan,value:o=>o.final?`${o.finalPlan} → ${o.final}`:'Entrega ainda prevista'},
    audit:{label:'Cobrança sem diferença',source:'Proposta aceita + fatura + conferência',definition:'Conferências concluídas sem diferença entre casos com conclusão financeira. Em esclarecimento e não auditados ficam fora do denominador.',eligible:o=>['conforme','divergencia'].includes(o.audit),ok:o=>o.audit==='conforme',value:o=>({'conforme':'Conforme no escopo conferido','divergencia':'USD 195 fundamentados · não recuperados','inconclusiva':'Escopo em esclarecimento','nao-auditada':'Ainda não auditada'}[o.audit])},
    freight:{label:'Frete internacional contratado',source:'Proposta aceita',definition:'Soma em USD do frete internacional contratado. Exclui taxas, tributos e trecho terrestre; não é custo logístico total.',eligible:o=>o.freight!==null,amount:o=>o.freight,value:o=>`USD ${o.freight}`},
    cargo:{label:'Valor da mercadoria',source:'Commercial invoice',definition:'Soma em USD dos valores comerciais documentados das POs no recorte. Valores ausentes são excluídos; não mede toda a compra da empresa.',eligible:o=>o.cargoValue!==null,amount:o=>o.cargoValue,value:o=>o.cargoValue===null?'Commercial invoice ausente':`USD ${o.cargoValue}`}
  };
  const stages=[{id:'pre',label:'Prontidão → coleta',from:'ready',to:'collect',plan:()=>2,source:'Confirmação de prontidão + recibo de coleta'},{id:'origin',label:'Coleta → embarque',from:'collect',to:'depart',plan:()=>4,source:'Recibo de coleta + evento de saída'},{id:'sea',label:'Trânsito internacional',from:'depart',to:'arrive',plan:o=>o.transitPlan,source:'Eventos de saída e chegada'},{id:'port',label:'Chegada → gate out',from:'arrive',to:'gate',plan:()=>3,source:'Eventos de chegada + gate out'},{id:'land',label:'Gate out → destino final',from:'gate',to:'final',plan:()=>2,source:'Gate out + comprovante de entrega'}];
  const connectionStages=[{id:'sea-first',label:'Ningbo → Singapura',from:'depart',to:'connectionIn',plan:()=>7,source:'Saída de Ningbo + entrada em Singapura'},{id:'connection',label:'Permanência em Singapura',from:'connectionIn',to:'connectionOut',plan:()=>3,source:'Entrada + saída da conexão'},{id:'sea-last',label:'Singapura → Itajaí',from:'connectionOut',to:'arrive',plan:()=>22,source:'Saída de Singapura + chegada a Itajaí'}];
  function metric(key,ops){const m=metrics[key],eligible=ops.filter(m.eligible),excluded=ops.filter(o=>!m.eligible(o));return {m,eligible,excluded,good:m.ok?eligible.filter(m.ok).length:null,total:m.amount?eligible.reduce((n,o)=>n+m.amount(o),0):null,rate:m.ok&&eligible.length?Math.round(eligible.filter(m.ok).length/eligible.length*100):null};}
  return {cutoff,companies,agents,locations,routes,operations,metrics,stages,connectionStages,add,days,metric};
})();
if(typeof module!=='undefined')module.exports=D;

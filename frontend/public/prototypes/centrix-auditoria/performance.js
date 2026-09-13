/* Matriz funcional v1.1. Fixtures ilustrativas; nenhum conector ou score produtivo. */
(function(root){
  const catalogue=[
    ['readiness','Prontidão da carga','Preparação e booking','date','dias','Cotação / PO + confirmação do exportador'],
    ['booking','Confirmação do booking','Preparação e booking','max','h','Solicitação + SLA + booking confirmation'],
    ['capacity','Espaço e equipamento disponíveis','Preparação e booking','equal','','Cotação + confirmação do agente / armador'],
    ['equipment','Equipamento realizado','Preparação e booking','equal','','Cotação + booking + EIR / BL'],
    ['pickup','Coleta / inland','Preparação e booking','date','dias','Ordem + agendamento + comprovante'],
    ['cutoff','Gate-in / cut-off','Preparação e booking','date','dias','Booking + cut-off + registro do terminal'],
    ['etd','Partida — ETD','Partida e serviço','date','dias','Cotação + booking + partida realizada'],
    ['rollover','Rollover','Partida e serviço','max','ocorrências','Booking original + novo booking + tracking'],
    ['cancel','Blank sailing / cancelamento','Partida e serviço','max','ocorrências','Serviço contratado + comunicação do transportador'],
    ['service','Navio / voo / companhia','Partida e serviço','equal','','Cotação + booking + BL / AWB'],
    ['route','Rota contratada','Partida e serviço','equal','','Cotação + booking + percurso realizado'],
    ['transship','Transbordos','Trânsito e chegada','max','transbordos','Cotação + escalas / tracking'],
    ['transit','Trânsito até o porto de destino','Trânsito e chegada','max','dias','Referência de trânsito + partida / chegada realizadas'],
    ['eta','Chegada — ETA e revisões','Trânsito e chegada','date','dias','ETA original + histórico de revisões + chegada realizada'],
    ['free','Free time concedido','Trânsito e chegada','min','dias','Cotação + confirmação armador / terminal'],
    ['discharge','Chegada / descarga / disponibilidade','Trânsito e chegada','date','dias','Tracking + terminal + arrival notice'],
    ['docs','Entrega e qualidade documental','Documentos, comunicação e fechamento','max','h','SLA + instrução + drafts + documento final'],
    ['communication','Comunicação da exceção','Documentos, comunicação e fechamento','max','h','Evento conhecido + SLA + e-mail / ticket'],
    ['tracking','Qualidade e atualização do tracking','Documentos, comunicação e fechamento','max','h','Evento de origem + recebimento / divergências de API'],
    ['release','Liberação documental','Documentos, comunicação e fechamento','date','dias','BL / AWB / CE e documentos de liberação'],
    ['delivery','Entrega final','Documentos, comunicação e fechamento','date','dias','Compromisso door-to-door + entrega / ocorrência'],
    ['exception','Gestão da exceção','Documentos, comunicação e fechamento','max','h','Ocorrência + plano de ação + alternativas e histórico'],
    ['dna','Regras do cliente — DNA','Documentos, comunicação e fechamento','equal','','Instrução do DNA versionada + comprovação de execução']
  ];
  const labels={clean:'Conforme',deviation:'Desvio identificado',authorized:'Alteração autorizada',tolerance:'Dentro da tolerância',pending:'Aguardando realizado',missing:'Falta evidência / regra',na:'Não aplicável'};
  const responsibilities=['Agente de cargas','Armador / companhia aérea','Exportador','Importador','Transportadora','Terminal / armazém','Autoridade / anuente','Força maior','Compartilhada','Inconclusiva'];
  const validChange=c=>!!(c?.approved&&c.evidence&&c.approver&&c.date&&c.reason);
  const present=v=>v!==null&&v!==undefined&&v!=='';
  const round=n=>Math.round((n+Number.EPSILON)*100)/100;
  function inspect(c){
    const change=validChange(c.change), expected=change?c.change.value:c.agreed;
    const base={...c,expected,delta:null,percent:null,scoreEligible:false};
    if(c.applicable===false && c.scopeEvidence) return {...base,state:'na'};
    if(!present(expected)||!c.original||!c.referenceEvidence||!Number.isFinite(c.tolerance)||c.tolerance<0||!c.rule) return {...base,state:'missing'};
    if(c.estimated||c.future) return {...base,state:'pending'};
    if(!present(c.actual)||!c.actualEvidence) return {...base,state:'missing'};
    let delta;
    if(c.kind==='date') {if(!Number.isFinite(Date.parse(c.actual))||!Number.isFinite(Date.parse(expected))) return {...base,state:'missing'};delta=round((Date.parse(c.actual)-Date.parse(expected))/86400000);}
    else if(c.kind==='equal') delta=c.actual===expected?0:1;
    else {if(!Number.isFinite(c.actual)||!Number.isFinite(expected))return {...base,state:'missing'};delta=round(c.actual-expected);}
    const difference=c.kind==='min'?-delta:delta;
    const state=difference>c.tolerance?'deviation':change?'authorized':difference>0?'tolerance':'clean';
    return {...base,delta,percent:typeof expected==='number'&&expected!==0?round(delta/Math.abs(expected)*100):null,state:c.limited?'missing':state};
  }
  function evaluate(op){
    const requested=op.requested.includes('performance');
    const checks=requested?(op.performanceAudit?.controls||[]).map(inspect):[];
    const applicable=checks.filter(c=>c.state!=='na'), ignored=checks.filter(c=>c.state==='na');
    const evaluated=applicable.filter(c=>!['missing','pending'].includes(c.state));
    const deviations=checks.filter(c=>c.state==='deviation'), missing=checks.filter(c=>c.state==='missing'),pending=checks.filter(c=>c.state==='pending');
    return {requested,checks,applicable,ignored,evaluated,deviations,missing,pending,complete:requested&&applicable.length>0&&evaluated.length===applicable.length,percent:applicable.length?Math.round(evaluated.length/applicable.length*100):null,status:!requested?'outside':deviations.length?'deviation':missing.length||!checks.length?'missing':pending.length?'pending':'clean'};
  }
  function enrich(operations){
    operations.forEach(op=>{
      if(op.performanceAudit?.schema===1)return;
      const controls=catalogue.map(([id,name,group,kind,unit,source])=>({id,name,group,kind,unit,source,agreed:null,actual:null,original:false,tolerance:null,rule:'',referenceEvidence:'',actualEvidence:'',cause:'Causa ainda não comprovada.',responsibility:'Inconclusiva',confidence:'Insuficiente para atribuir responsabilidade',impact:'Impacto ainda não quantificado.',action:'Vincular compromisso, regra e evidência do realizado.',deadline:'Prazo a confirmar',owner:'Responsável pela fonte a confirmar'}));
      for(const old of op.checks){
        const id=/trânsito|prazo/i.test(old.name)?'transit':/transbord/i.test(old.name)?'transship':/free time/i.test(old.name)?'free':null;
        const c=controls.find(c=>c.id===id);if(!c)continue;
        Object.assign(c,{agreed:old.agreed,actual:old.actual,original:old.original,estimated:old.estimated,future:old.pending,tolerance:0,rule:'Confrontar a referência preservada com o realizado; tolerância zero no exemplo DEMO.',referenceEvidence:old.original?op.reference:'',actualEvidence:old.actual!==null?old.source:'',source:old.source,note:old.note,owner:'Agente / transportador — apresentar evidência',deadline:'Antes do fechamento da auditoria',action:'Esclarecer o desvio e vincular evidências da causa.',impact:id==='transit'?'Dias de diferença no trânsito; custo e impacto na fábrica não apurados.':id==='free'?'Risco de custo adicional; não equivale a demurrage já cobrada.':'Mudança de percurso; impacto total ainda não apurado.'});
      }
      const detailed=['0007','0011'].includes(op.id)&&!op.external;
      if(detailed){
        const late=op.id==='0007', departure=late?'2026-07-14':'2026-07-27', arrival=late?'2026-08-26':'2026-08-31', expectedArrival=late?'2026-08-18':'2026-08-31';
        const set=(id,agreed,actual,extra={})=>Object.assign(controls.find(c=>c.id===id),{agreed,actual,original:true,tolerance:0,rule:'Condição preservada; tolerância zero na amostra DEMO. Igualdade ou cumprimento antecipado é conforme.',referenceEvidence:op.reference+' · condição '+id+' DEMO',actualEvidence:'EV-'+op.id+'-'+id+' · evidência ilustrativa',owner:'Agente / detentor da evidência',deadline:'Antes do fechamento da auditoria',action:'Confirmar a causa e a ação corretiva com as fontes do caso.',...extra});
        set('readiness',late?'2026-07-10':'2026-07-23',late?'2026-07-10':'2026-07-23',{impact:'Prontidão anterior à partida; não explica automaticamente atrasos posteriores.'});
        set('booking',48,late?72:24,{rule:'Confirmação em até 48 horas corridas após a solicitação · SLA DEMO.',impact:'Tempo adicional para obter confirmação de espaço; reflexo no embarque não comprovado.',events:late?[{at:'2026-07-09T12:00:00Z',text:'Booking solicitado'},{at:'2026-07-12T12:00:00Z',text:'Booking confirmado'}]:[{at:'2026-07-22T12:00:00Z',text:'Booking solicitado'},{at:'2026-07-23T12:00:00Z',text:'Booking confirmado'}]});
        set('capacity','Espaço e 40HC confirmados','Espaço e 40HC confirmados',{impact:'Disponibilidade confirmada no cenário; não garante execução futura.'});
        set('equipment','1 × 40HC','1 × 40HC',{impact:'Tipo e quantidade do documento compatíveis com o contratado.'});
        set('pickup',null,null,{original:false,referenceEvidence:'',actualEvidence:'',rule:'Janela de coleta exige ordem e comprovante próprios.',impact:'Não inferir coleta a partir da partida marítima.'});
        set('cutoff',late?'2026-07-13':'2026-07-26',late?'2026-07-13':'2026-07-26',{impact:'Prazo do terminal atendido na granularidade diária do exemplo.'});
        set('etd',departure,departure,{impact:'Partida sem atraso em relação à referência desta amostra.'});
        set('rollover',0,0,{rule:'Comparar bookings original e final; cobertura restrita ao histórico DEMO completo do caso.',impact:'Nenhuma transferência no conjunto demonstrativo.'});
        set('cancel',0,0,{impact:'Nenhum cancelamento registrado na série demonstrativa do serviço.'});
        set('service','Serviço A','Serviço A',{impact:'Serviço comparado à condição aprovada.'});
        if(late)set('service','Serviço A','Serviço B',{change:{value:'Serviço B',approved:true,date:'2026-07-12',approver:'Cliente demo',reason:'Alternativa comercial aceita',evidence:'ACEITE-SERVICO-0007-DEMO'},impact:'Mudança aprovada somente do serviço. Não altera ETD, ETA ou prazo contratado.'});
        set('route',op.route,op.route,{impact:'Mesma origem e destino na evidência DEMO; sequência de escalas em Transbordos.'});
        set('eta',expectedArrival,arrival,{rule:'Chegada realizada comparada à ETA original estimada; revisões não substituem a referência.',impact:'Desvio de previsibilidade no porto; não comprova atraso de entrega na fábrica.',note:'Referência estimada, não garantia contratual.',revisions:late?[{at:'2026-07-09',value:'2026-08-18',text:'ETA original preservada'},{at:'2026-08-18',value:'2026-08-25',text:'Previsão revisada — não altera compromisso'},{at:'2026-08-26',value:'2026-08-26',text:'Chegada realizada'}]:[{at:'2026-07-22',value:'2026-08-31',text:'ETA original preservada'},{at:'2026-08-31',value:'2026-08-31',text:'Chegada realizada'}]});
        set('discharge',null,late?'2026-08-27':'2026-09-01',{original:false,referenceEvidence:'',rule:'Comparar chegada, descarga e disponibilidade como marcos distintos.',impact:'Descarga demonstrada; disponibilidade não confirmada. Falta prazo acordado para concluir aderência.',note:'Chegada '+arrival+'; descarga '+(late?'27/08':'01/09')+'; disponibilidade pendente.'});
        set('docs',24,24,{rule:'Entrega do draft em até 24h corridas após instrução completa · SLA DEMO.',impact:'Prazo do draft conferido; qualidade e retrabalho documental ainda sem checklist completo.',note:'Resultado restrito ao prazo: qualidade documental pendente.',limited:true});
        set('communication',24,late?72:12,{rule:'Comunicar mudança conhecida de ETA em até 24h corridas · SLA DEMO.',impact:'Atraso de comunicação reduz tempo de reação; dano financeiro não quantificado.',events:late?[{at:'2026-08-18T12:00:00Z',text:'Mudança de ETA conhecida'},{at:'2026-08-21T12:00:00Z',text:'Comunicação enviada ao cliente'}]:[{at:'2026-08-20T12:00:00Z',text:'Atualização conhecida'},{at:'2026-08-21T00:00:00Z',text:'Atualização comunicada'}]});
        set('tracking',6,null,{actualEvidence:'',rule:'Latência máxima de 6h no cenário; comparar ocorrência na origem × recebimento.',impact:'Sem horários de recepção integrados; não inferir SLA pela data exibida no portal.'});
        set('release',null,null,{original:false,referenceEvidence:'',actualEvidence:'',impact:'Sem prazo/documento de liberação; pagamento ou fatura não comprovam carga liberada.'});
        set('delivery',null,null,{applicable:false,scopeEvidence:'Escopo DEMO contratado até o porto',note:'Entrega final não contratada neste cenário. Não integra a cobertura.',impact:'Nenhuma conclusão sobre entrega, quantidade recebida ou avaria.'});
        set('exception',24,null,{actualEvidence:'',rule:'Plano de ação em até 24h após registro da ocorrência · SLA DEMO.',impact:'Ausência do plano na prévia não prova ausência de atuação do agente.'});
        set('dna',null,null,{original:false,referenceEvidence:'',actualEvidence:'',impact:'Instrução de DNA versionada não vinculada; não presumir cumprimento.'});
      }
      op.performanceAudit={schema:1,controls,detailed};op.version++;
      op.logs.push({date:'2026-09-13',text:'Performance ampliada conforme matriz v1.1: 23 controles, regras/evidências e cobertura explícitas. Novos detalhes são DEMO. Referências originais e log preservados; nenhuma responsabilidade ou pontuação atribuída.'});
    });return operations;
  }
  function display(value,c){
    if(!present(value))return 'Não informado';
    if(c.kind==='date')return String(value).slice(0,10).split('-').reverse().join('/');
    return `${value}${c.unit?' '+c.unit:''}`;
  }
  function deltaText(c){if(c.delta===null)return 'Não concluído';if(c.kind==='equal')return c.delta?'Condição diferente':'Mesma condição';return `${c.delta>0?'+':''}${c.delta} ${c.unit}`;}
  function evidence(op,id){
    const c=evaluate(op).checks.find(c=>c.id===id);if(!c)return 'Controle não localizado.';
    return `PERFORMANCE — EVIDÊNCIA DEMONSTRATIVA\n${op.id} · ${op.po} · ${op.bl}\n${c.name}\nCompromisso original: ${display(c.agreed,c)}\nReferência vigente: ${display(c.expected,c)}\n${c.estimated?'Previsão atual (não realizado)':'Realizado'}: ${display(c.actual,c)}\nResultado: ${labels[c.state]}; desvio: ${deltaText(c)}; percentual: ${c.percent===null?'não aplicável':c.percent+'%'}\nRegra: ${c.rule||'Não definida'}\nTolerância: ${c.tolerance??'não definida'} ${c.unit}\nReferência: ${c.referenceEvidence||'Ausente'}\nRealizado: ${c.actualEvidence||'Ausente'}\n${c.change?'Alteração: '+JSON.stringify(c.change):'Nenhuma alteração aprovada vinculada.'}\n${c.note||''}\nCausa: ${c.cause}\nResponsabilidade: ${c.responsibility}\nConfiança: ${c.confidence}\nImpacto: ${c.impact}\nAção: ${c.action}\nResponsável pela próxima ação: ${c.owner}; prazo: ${c.deadline}\nScore não alterado; não há motor de atribuição produtivo.\n${(c.events||[]).map(e=>e.at+' · '+e.text).join('\n')}\n${(c.revisions||[]).map(e=>e.at+' · '+e.text+': '+e.value).join('\n')}`;
  }
  function question(op){const r=evaluate(op);return r.deviations.length?`Solicitamos esclarecimento dos desvios abaixo:\n${r.deviations.map(c=>`• ${c.name}: referência ${display(c.expected,c)}, realizado ${display(c.actual,c)}, desvio ${deltaText(c)}. ${c.note||''}`).join('\n')}\n\nEnvie evidências da causa, eventuais alterações aprovadas e as medidas adotadas. Os desvios não comprovam responsabilidade do agente. ETA e trânsito podem refletir o mesmo atraso e não devem ser somados. ${r.missing.length+r.pending.length} controles permanecem inconclusivos e não compõem este pedido.`:'Ainda não há desvio fundamentado; complete somente as fontes necessárias.';}
  const api={catalogue,labels,responsibilities,inspect,evaluate,enrich,display,deltaText,evidence,question};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PerformanceAudit=api;
})(typeof globalThis==='undefined'?this:globalThis);

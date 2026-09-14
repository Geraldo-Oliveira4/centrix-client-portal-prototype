/* Regras calculadas sobre evidências DEMO. Não consulta BCB nem valida documentos reais. */
(function(root) {
  const round = (n, digits = 2) => Math.round((n + Number.EPSILON) * 10 ** digits) / 10 ** digits;
  const finite = Number.isFinite;
  const labels = {clean:'Conforme', tolerance:'Dentro da tolerância', lower:'A menor', deviation:'Divergência', authorized:'Alteração autorizada', pending:'Pendente de validação', na:'Não aplicável'};
  function charge(line) {
    const approved = line.change?.approved && line.change?.evidence && line.change?.approver && line.change?.date && line.change?.reason;
    const expected = approved ? line.change.amount : line.agreed;
    if (!finite(expected) || !finite(line.billed)) return {status:'pending', expected:null, delta:null, percent:null, question:0};
    const delta = round(line.billed - expected);
    const tolerance = line.tolerance ?? null;
    const status = !delta ? approved ? 'authorized' : 'clean' : tolerance === null ? 'pending' : Math.abs(delta) <= tolerance ? 'tolerance' : delta < 0 ? 'lower' : 'deviation';
    return {status, expected, delta, percent:expected ? round(delta / Math.abs(expected) * 100) : null, question:status === 'deviation' ? delta : 0};
  }
  function exchange(op, invoice) {
    const fx = op.freight?.fx?.[invoice.id];
    if (fx?.applicable === false) return {status:'na', reason:fx.reason, question:0};
    const pending = reason => ({status:'pending',reason,question:0});
    if (!fx) return pending('Regra de conversão e moeda de liquidação ainda não vinculadas.');
    if (!invoice.available || !invoice.reference) return pending('Fatura ou referência comercial ainda pendente.');
    if (!fx.approved || !fx.ruleEvidence || !fx.referenceDate || !fx.appliedDate || !fx.bulletin || !fx.side || !fx.eventDate || !fx.referenceEvidence || !fx.appliedEvidence || fx.from !== invoice.currency || fx.to !== 'BRL' || !finite(fx.referenceRate) || !finite(fx.spread) || !finite(fx.appliedRate) || !finite(fx.tolerance)) return pending('Faltam regra aprovada, boletim, data, lado da cotação ou tolerância. Nenhuma taxa atual substitui a referência ausente.');
    if (invoice.lines.some(l=>!finite(l.billed))) return pending('A base em moeda de origem não está completa.');
    if (!['percent','absolute'].includes(fx.spreadType)) return pending('Forma de aplicação do spread não confirmada.');
    const expectedRate = round(fx.spreadType === 'percent' ? fx.referenceRate * (1 + fx.spread / 100) : fx.referenceRate + fx.spread, 4);
    const base = round(invoice.lines.reduce((n,l)=>n+l.billed,0));
    const expected = round(base * expectedRate), billed = round(base * fx.appliedRate);
    const delta = round(billed-expected), rateDelta=round(fx.appliedRate-expectedRate,4);
    const dateMismatch = fx.referenceDate !== fx.appliedDate;
    const status = Math.abs(delta) > fx.tolerance ? delta > 0 ? 'deviation' : 'lower' : dateMismatch ? 'pending' : delta ? 'tolerance' : 'clean';
    return {status, base, expectedRate, expected, billed, delta, rateDelta, dateMismatch, percent:round(rateDelta/expectedRate*100), question:status === 'deviation' ? delta : 0, reason:dateMismatch ? 'Data aplicada difere da data contratual; justificar ou retificar.' : ''};
  }
  function enrich(operations) {
    operations.forEach(op=>{
      if (op.freight?.schema === 1) return;
      const detailed = ['0011','0007'].includes(op.id) && !op.external;
      op.freight = {schema:1, detailed, fx:{}, context:null, records:[]};
      if (detailed) {
        const isA = op.id === '0011';
        op.freight.context = {direction:'Importação',modal:'Marítimo FCL',incoterm:'FOB · 2020',place:isA?'Shanghai':'Gênova',contractor:'Comprador / cliente',payment:'Collect',origin:'Cotação da plataforma',scope:'Frete principal e taxas apresentadas ao cliente',equipment:'1 × 40HC',weight:'12.000 kg',volume:'48 m³',quoteVersion:isA?'v3':'v2',accepted:isA?'2026-07-22':'2026-07-09',approver:'Cliente demo · aceite ilustrativo',validUntil:isA?'2026-07-31':'2026-07-20',shipment:isA?'2026-07-27':'2026-07-14'};
        if (!isA && op.invoices[0]?.lines.length === 1 && op.invoices[0].lines[0].agreed === 3960 && op.invoices[0].lines[0].billed === 3960) {
          op.invoices[0].lines = [{name:'Frete marítimo',agreed:3300,billed:3300},{name:'THC destino',agreed:500,billed:500},{name:'Documentation Fee',agreed:100,billed:100},{name:'ISPS',agreed:60,billed:60}];
        }
        op.invoices.forEach(invoice=>{
          invoice.lines.forEach((line,index)=>Object.assign(line,{group:index===0?'Frete principal':'Destino',unit:index<2?'contêiner 40HC':'BL',quantity:1,actualQuantity:1,unitPrice:line.agreed,billedUnitPrice:line.billed,originalName:line.name==='Documentation Fee'?'DOC FEE':line.name,normalizationEvidence:line.name==='Documentation Fee'?'CAT-DEMO v1 · DOC FEE = Documentation Fee':'Correspondência literal',tolerance:0,note:line.note || ''}));
          op.freight.fx[invoice.id] = {applicable:true,approved:true,from:'USD',to:'BRL',event:'Emissão da fatura',eventDate:'2026-09-08',dateRule:'Fechamento do dia útil anterior à emissão',calendar:'Calendário da regra DEMO: 07/09 sem boletim; referência em 04/09',referenceDate:'2026-09-04',appliedDate:'2026-09-04',bulletin:'Fechamento PTAX',side:'Venda',referenceRate:5,spread:2,spreadType:'percent',appliedRate:isA?5.2:5.1,tolerance:0.01,ruleEvidence:'Cláusula CAMBIO-DEMO v1 · aprovada com a cotação',referenceEvidence:'BOLETIM-DEMO-0409 · taxa fictícia, não consultada no BCB',appliedEvidence:invoice.id+' · quadro de conversão DEMO'};
        });
        op.freight.records = [{id:'QUOTE',name:op.reference,type:'Cotação e aceite',requirement:'Obrigatório',availability:'Recebido',source:'Versão e aceite demonstrativos',impact:'Condição comercial e regra de câmbio'}, {id:'BL',name:op.bl,type:'BL final',requirement:'Obrigatório',availability:'Recebido',source:'Transporte e quantidade demonstrativos',impact:'Identidade, equipamento e unidade'}, {id:'FX',name:'BOLETIM-DEMO-0409',type:'Referência PTAX',requirement:'Condicional · conversão USD/BRL',availability:'Recebido',source:'Taxa 5,0000 fictícia',impact:'Câmbio e memória de cálculo'}, {id:'EXTRA',name:'Memória de custos extraordinários',type:'Ocorrência / aprovação',requirement:'Condicional',availability:isA?'Pendente':'Não aplicável',source:isA?'Não recebida do agente':'Nenhuma cobrança extraordinária na amostra',impact:isA?'Causa e justificativa da taxa adicional':'Fora do denominador'}];
      }
      op.version++;
      op.logs.push({date:'2026-09-13',text:'Escopo de frete ampliado na prévia: regras, PTAX, bases, documentos e limitações agora explícitos. Cenários e evidências são demonstrativos; resultados anteriores preservados no histórico.'});
    });
    return operations;
  }
  const clusters = [
    ['version','Versão da cotação','Cotação e alterações','Versão aprovada × versão da referência usada.'],
    ['charges','Frete principal e taxas','Cobranças','Cada rubrica confrontada com a condição vigente.'],
    ['names','Nomenclatura de taxas','Cobranças','Descrição original, equivalente normalizado e catálogo.'],
    ['base','Base de cálculo','Bases e carga','Quantidade × tarifa; unidade contratada × faturada.'],
    ['equipment','Quantidade e equipamento','Bases e carga','Cotação × booking × BL × fatura.'],
    ['weight','Peso e volume','Bases e carga','Base taxável do LCL/aéreo; mínimo e fator quando aplicáveis.'],
    ['currency','Moeda','Câmbio e PTAX','Moeda de origem × moeda de liquidação autorizada.'],
    ['fx','Câmbio e PTAX','Câmbio e PTAX','Data, boletim, compra/venda, spread e taxa aplicada.'],
    ['validity','Validade da tarifa','Cotação e alterações','Embarque dentro da validade; reajuste exige aceite.'],
    ['change','Alterações autorizadas','Cotação e alterações','Original preservado; mudança válida tem aprovador, data, justificativa e evidência.'],
    ['payment','Prepaid / collect','Responsabilidade e documentos','Pagamento e contratante confirmados; sem deduzir pelo Incoterm.'],
    ['location','Origem / frete / destino','Cobranças','Separar parcelas, emissores e responsáveis.'],
    ['extra','Custos extraordinários','Exceções e encerramento','Ocorrência, aprovação, período e memória de cálculo.'],
    ['duplicates','Duplicidade','Exceções e encerramento','Comparar taxa + serviço + período + BL em todas as faturas.'],
    ['complement','Fatura complementar','Exceções e encerramento','Vincular cobrança original e complemento sem somar duas vezes.'],
    ['credit','Credit note / estorno','Exceções e encerramento','Identificado, contestado, reconhecido e recuperado são estados diferentes.'],
    ['discount','Descontos e condições','Exceções e encerramento','Descontos, vencimento e condição aprovada.'],
    ['tax','Tributos e gross-up','Exceções e encerramento','Memória tributária e validação fiscal, se aplicável.'],
    ['links','Vínculo documental','Responsabilidade e documentos','Cotação, booking, BL, contêiner e fatura do mesmo processo.']
  ];
  function controls(op) {
    const completeInvoices = op.invoices.filter(i=>i.available && i.reference);
    const lines = completeInvoices.flatMap(i=>i.lines);
    const results=lines.map(charge), fx=op.invoices.map(i=>exchange(op,i));
    const detailed=op.freight?.detailed;
    const classify = values => values.includes('deviation')?'deviation':values.includes('pending')?'pending':values.includes('authorized')?'authorized':values.includes('tolerance')?'tolerance':values.includes('lower')?'lower':'clean';
    return clusters.map(([id,name,group,rule])=>{
      let status='pending', finding='Evidência ou regra ainda não vinculada; não presumir conformidade.', evidence='Pendente', action='Vincular a referência e a evidência necessárias.', owner='Cliente / agente', deadline='Antes do pagamento';
      if(id==='charges') {status=completeInvoices.length===op.invoices.length && lines.length ? classify(results.map(r=>r.status)):'pending';finding=`${completeInvoices.length}/${op.invoices.length} faturas com referência; diferenças e tolerâncias por item abaixo.`;evidence=completeInvoices.map(i=>i.id).join(', ') || 'Fatura pendente';}
      if(id==='fx') {status=fx.length?fx.every(r=>r.status==='na')?'na':classify(fx.filter(r=>r.status!=='na').map(r=>r.status)):'pending';finding='Memória por fatura: taxa esperada conforme spread aprovado, comparada à aplicada sobre a mesma base.';evidence=detailed?'Cláusula CAMBIO-DEMO v1 + BOLETIM-DEMO-0409 + fatura':'Regra cambial / boletim pendentes';}
      if(detailed) {
        const c=op.freight.context;
        if(id==='version') {status='clean';finding=`${c.quoteVersion} aceita em ${c.accepted}; mantida como referência original.`;evidence=op.reference+' · '+c.approver;}
        if(id==='names') {status='clean';finding='DOC FEE reconhecida como Documentation Fee; nomes originais preservados.';evidence='CAT-DEMO v1 + descrições das faturas';}
        if(id==='base') {status='clean';finding='1 unidade × tarifa por rubrica; aritmética consistente. Divergência da tarifa continua em Cobranças.';evidence='Fatura + BL DEMO';}
        if(id==='equipment') {status='clean';finding=c.equipment+' na referência e no BL demonstrativo.';evidence='Cotação + booking + BL DEMO';}
        if(id==='weight') {status='na';finding=`${c.weight} / ${c.volume} registrados. Nesta cotação FCL, as rubricas usam contêiner ou BL, sem tarifa por peso/CBM.`;evidence='Base contratada DEMO';}
        if(id==='currency') {status='clean';finding='USD na contratação; conversão para BRL expressamente prevista. A taxa é validada separadamente.';evidence='Cláusula cambial DEMO';}
        if(id==='validity') {status=c.shipment<=c.validUntil?'clean':'pending';finding=`Partida ${c.shipment}; validade até ${c.validUntil}.`;evidence='Cotação + evento DEMO';}
        if(id==='change') {status=op.id==='0011'?'pending':'clean';finding=op.id==='0011'?'Nenhum aceite vinculado à taxa adicional; aumento unilateral não altera a referência.':'Nenhuma revisão posterior no histórico disponível.';evidence='Histórico comercial DEMO';}
        if(id==='payment') {status='clean';finding='Collect e comprador confirmados como campos independentes do FOB.';evidence='Contexto confirmado + BL DEMO';}
        if(id==='location') {status='clean';finding='Frete principal e destino separados por rubrica. Custos de origem não apresentados nesta cobrança.';evidence='Fatura + escopo da cotação DEMO';}
        if(id==='extra') {status=op.id==='0011'?'pending':'na';finding=op.id==='0011'?'Taxa adicional de USD 150 sem memória/ocorrência. Não prevista comercialmente; causa e eventual autorização pendentes.':'Nenhum custo extraordinário cobrado na amostra.';evidence=op.id==='0011'?'Fatura recebida; memória pendente':'Fatura DEMO';}
        if(id==='duplicates') {status='pending';finding='Sem repetição dentro da fatura. Histórico completo de outras cobranças não integrado; duplicidade entre faturas inconclusiva.';evidence='Fatura atual; histórico anterior pendente';}
        if(id==='complement') {status='pending';finding='Conjunto conhecido sem complemento. Confirmar se há debit note ou faturamento adicional.';evidence='Confirmação do emissor pendente';}
        if(id==='credit') {status='na';finding='Nenhuma contestação enviada ou crédito reconhecido neste exemplo. Valores abaixo permanecem sem recuperação.';evidence='Log da sessão';}
        if(id==='discount') {status='clean';finding='Condição demonstrativa sem desconto negociado; nenhuma dedução automática das diferenças positivas.';evidence=op.reference;}
        if(id==='tax') {status='na';finding='Sem imposto/gross-up destacado nesta fatura demonstrativa. Não é validação fiscal do processo.';evidence='Fatura DEMO';}
        if(id==='links') {status='clean';finding=`${op.po} · ${op.bl} · ${op.invoices.map(i=>i.id).join(', ')} vinculados ao mesmo caso.`;evidence='Identificadores demonstrativos';}
      }
      if(status==='clean'||status==='tolerance'||status==='na'||status==='authorized'||status==='lower') {action=status==='na'?'Manter a justificativa de não aplicação.':'Nenhuma ação necessária neste controle.';owner='—';deadline='—';}
      if(status==='deviation') action='Revisar a diferença e preparar o pedido de retificação com evidências.';
      return {id,name,group,rule,status,finding,evidence,action,owner,deadline};
    });
  }
  function coverage(op) {
    const items=controls(op), applicable=items.filter(c=>c.status!=='na'), evaluated=applicable.filter(c=>c.status!=='pending');
    return {items,known:applicable.length,checked:evaluated.length,pending:applicable.length-evaluated.length,na:items.length-applicable.length,percent:applicable.length?Math.round(evaluated.length/applicable.length*100):null};
  }
  const api={round,charge,exchange,enrich,controls,coverage,labels};
  if(typeof module!=='undefined' && module.exports) module.exports=api; else root.FreightAudit=api;
})(typeof globalThis==='undefined'?this:globalThis);

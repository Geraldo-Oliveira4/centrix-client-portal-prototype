/* Demonstração de revisão assistida por IA. Parser local de rótulos; sem LLM/OCR. */
(function(root){
  const normal=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const fields=[['supplier','Fornecedor',['fornecedor','exportador']],['po','PO',['po']],['booking','Booking',['booking']],['bl','BL / AWB',['bl','awb']],['agent','Agente',['agente']],['direction','Direção',['direcao']],['modal','Modal',['modal']],['origin','Origem',['origem']],['destination','Destino',['destino']],['incoterm','Incoterm',['incoterm']],['incotermVersion','Versão do Incoterm',['versao do incoterm']],['namedPlace','Local nomeado',['local nomeado']],['contractor','Contratante do frete',['contratante','quem contrata']],['payment','Pagamento do frete',['pagamento do frete','prepaid/collect']],['owner','Responsável pela auditoria',['responsavel pela auditoria']],['equipment','Equipamento',['equipamento']],['weight','Peso',['peso']],['volume','Volume',['volume']],['referenceFx','Regra de câmbio',['regra de cambio','ptax']],['referenceFreeTime','Free time',['free time']],['referenceTransit','Transit time',['transit time']]];
  const enums={direction:['Importação','Exportação'],modal:['Marítimo FCL','Marítimo LCL','Aéreo','Rodoviário','Multimodal'],incoterm:['EXW','FCA','FAS','FOB','CFR','CIF','CPT','CIP','DAP','DPU','DDP','NA'],contractor:['Vendedor / exportador','Comprador / cliente','Cliente exportador','Terceiro'],payment:['Prepaid','Collect','Misto','Não confirmado']};
  function extract(text,current,source='Texto informado'){
    const candidates=[],issues=[];
    String(text||'').split(/\r?\n/).forEach((line,index)=>{
      const split=line.indexOf(':');if(split<0)return;const label=normal(line.slice(0,split)),value=line.slice(split+1).trim();if(!value)return;
      const field=fields.find(x=>x[2].includes(label));if(!field)return;const [key,name]=field;
      const canonical=enums[key]?enums[key].find(x=>normal(x)===normal(value)):value;
      if(!canonical){issues.push(name+': formato não reconhecido no exemplo. Confirme manualmente.');return;}
      const existing=candidates.find(c=>c.key===key);
      if(existing){if(existing.value!==canonical){existing.conflict=true;existing.selected=false;issues.push(name+': há valores diferentes no texto. Escolha a referência correta.');}return;}
      const before=String(current[key]||'');candidates.push({key,name,before,value:canonical,source:source+' · linha '+(index+1),selected:!before,conflict:false});
    });
    return {candidates,issues};
  }
  function apply(d){
    const applied=[],skipped=[];d.contextTrace=d.contextTrace||{};d.assist.history=d.assist.history||[];
    for(const c of d.assist.candidates||[]){if(!c.selected||c.conflict)continue;
      if(String(d.fields[c.key]||'')!==c.before){skipped.push(c.name);continue;}
      if(c.before===c.value)continue;
      const change={key:c.key,before:c.before,value:c.value,source:c.source};d.fields[c.key]=c.value;d.contextTrace[c.key]={source:c.source,status:'Sugestão aplicada para revisão'};d.assist.history.push(change);applied.push(c.name);
    }
    if(applied.length)d.fields.contextConfirmed=false;
    d.assist.candidates=[];return {applied,skipped};
  }
  const example='Fornecedor: Fornecedor demonstrativo\nDireção: Importação\nModal: Marítimo FCL\nOrigem: Shanghai\nDestino: Santos\nIncoterm: FOB\nVersão do Incoterm: 2020\nLocal nomeado: Shanghai\nContratante: Comprador / cliente\nPagamento do frete: Collect\nEquipamento: 1 × 40HC\nResponsável pela auditoria: Analista demo';
  const api={fields,extract,apply,example};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ContextAssist=api;
})(typeof globalThis==='undefined'?this:globalThis);

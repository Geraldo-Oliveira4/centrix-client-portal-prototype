let importSession=null,importReadToken=0;
const importColumns={empresas:{nome:'name',empresa:'name',razaosocial:'legal',pais:'country',cidade:'city',contato:'contact',email:'email',telefone:'phone',cnpj:'taxid',identificadorfiscal:'taxid',papeis:'roles',papel:'roles',observacoes:'notes'},locais:{nome:'name',local:'name',tipo:'type',codigo:'code',pais:'country',cidade:'city',endereco:'description',observacoes:'description'}};
const importSamples={empresas:[['Nome','País','Cidade','Papéis','Contato'],['Atlas Componentes Demo','Brasil','Curitiba','Fornecedor','Ana · demonstração'],['Eastbridge Components','China','Ningbo','Fornecedor; Exportador','Lin Chen']],locais:[['Nome','Tipo','Código','País','Cidade','Observações'],['Centro de distribuição Demo','Armazém','','Brasil','Joinville','Agendar recebimento'],['Ningbo','Porto','CNNGB','China','Ningbo','Porto já existente: reutilizar']]};
const headerKey=s=>normalize(s).replace(/[^a-z0-9]/g,'');
function openImport(section){
  importReadToken++;importSession={section,records:[],name:'',sheet:'',columns:[]};
  openDrawer(section==='empresas'?'Trazer empresas para o Centrix':'Preencher locais com assistência','Receber dados → revisar → incorporar ao contexto.',`<div class="import-file"><label class="field">Anexar planilha ou texto<input id="context-file" type="file" accept=".xlsx,.csv,.txt"></label><p>Excel (.xlsx), CSV ou texto (.txt), até 5 MB. Primeira aba, cabeçalho na primeira linha, até 100 registros.</p></div><div class="actions detail-notes"><a class="link" href="assets/modelo-${section}.xlsx" download>Baixar modelo Excel</a>${btn('Ver exemplo de revisão','import-example',section,true)}</div><p class="small muted">Leitura local, sem enviar o arquivo. A IA e o OCR de PDFs/imagens ainda não estão conectados. Nenhum cadastro é criado antes de sua confirmação.</p><details class="detail-notes"><summary>Como preencher os dados</summary><p>${section==='empresas'?'Nome, País, Cidade e Papéis. Papéis: Importador, Fornecedor ou Exportador, separados por ponto e vírgula.':'Nome, Tipo, País e Cidade. Tipos: Porto, Aeroporto, Terminal, Armazém ou Coleta / entrega. Código externo é opcional.'}</p><p>Outras colunas reconhecidas: ${Object.keys(importColumns[section]).map(esc).join(', ')}.</p><p>Texto: um campo por linha, como “Nome: Centro de distribuição”. Separe registros por uma linha vazia. Campo desconhecido permanece no trecho de origem para revisão.</p></details><p id="import-message" class="import-status" role="status"></p>`);
}
function parseCSV(text){
  const first=text.split(/\r?\n/)[0],separator=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===separator&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}else cell+=c;}
  if(quoted)throw Error('Há aspas abertas no CSV. Revise o arquivo.');row.push(cell);if(row.some(x=>x.trim()))rows.push(row);return rows;
}
function parseContextText(text){
  const records=text.split(/\r?\n\s*\r?\n/).filter(s=>s.trim()).map(block=>Object.fromEntries(block.split(/\r?\n/).map(line=>{const colon=line.indexOf(':');return colon>0?[line.slice(0,colon).trim(),line.slice(colon+1).trim()]:['Trecho não estruturado',line]})));
  const headers=[...new Set(records.flatMap(r=>Object.keys(r)))];return [headers,...records.map(r=>headers.map(h=>r[h]||''))];
}
async function readXlsx(buffer){
  const zip=await JSZip.loadAsync(buffer);let expanded=0;
  for(const entry of Object.values(zip.files)){expanded+=entry._data?.uncompressedSize||0;if(expanded>20*1024*1024)throw Error('Planilha expandida muito grande para esta prévia. Use um arquivo menor.');}
  const xml=async name=>{const f=zip.file(name);if(!f)throw Error('Estrutura Excel não reconhecida. Use o modelo .xlsx.');const doc=new DOMParser().parseFromString(await f.async('string'),'application/xml');if(doc.querySelector('parsererror'))throw Error('XML da planilha inválido.');return doc;};
  const book=await xml('xl/workbook.xml'),sheet=book.querySelector('sheet');if(!sheet)throw Error('Não há aba na planilha.');
  const rid=sheet.getAttribute('r:id'),rels=await xml('xl/_rels/workbook.xml.rels');
  const rel=[...rels.getElementsByTagName('Relationship')].find(r=>r.getAttribute('Id')===rid);if(!rel||rel.getAttribute('TargetMode')==='External')throw Error('Aba externa não suportada.');
  const target=rel.getAttribute('Target');const sheetPath=target.startsWith('/')?target.slice(1):'xl/'+target;
  if(sheetPath.includes('..'))throw Error('Caminho de aba não suportado.');
  const strings=zip.file('xl/sharedStrings.xml')?[...(await xml('xl/sharedStrings.xml')).getElementsByTagName('si')].map(s=>[...s.getElementsByTagName('t')].map(t=>t.textContent).join('')):[];
  const data=await xml(sheetPath),rows=[];for(const row of data.getElementsByTagName('row')){
    const values=[];for(const cell of row.getElementsByTagName('c')){
      if(cell.getElementsByTagName('f').length)throw Error('A planilha contém fórmulas. Exporte uma cópia somente com os valores cadastrais para revisar.');
      const address=cell.getAttribute('r')||'',letters=address.replace(/[0-9]/g,'');let col=0;for(const char of letters)col=col*26+char.charCodeAt(0)-64;
      if(col>100)throw Error('Use no máximo 100 colunas.');const type=cell.getAttribute('t');
      const raw=cell.getElementsByTagName('v')[0]?.textContent||'';values[Math.max(0,col-1)]=type==='s'?(strings[Number(raw)]||''):type==='inlineStr'?[...cell.getElementsByTagName('t')].map(t=>t.textContent).join(''):raw;
    }
    if(values.some(v=>String(v).trim()))rows.push({values,row:Number(row.getAttribute('r'))});if(rows.length>101)throw Error('Limite de 100 registros por revisão. Divida a planilha.');
  }
  return {rows:rows.map(r=>r.values),rowNumbers:rows.map(r=>r.row),sheet:sheet.getAttribute('name')};
}
function stageImport(rows,name,sheet='',rowNumbers){
  if(rows.length<2)throw Error('Não encontrei linhas de dados após o cabeçalho.');if(rows.length>101)throw Error('Limite de 100 registros por revisão. Divida o arquivo.');
  const section=importSession.section,headers=rows[0].map(s=>String(s).replace(/^\uFEFF/,'').trim()),columns=headers.map(h=>importColumns[section][headerKey(h)]||'');
  if(!columns.includes('name'))throw Error('Não encontrei a coluna Nome. Use o modelo ou renomeie o cabeçalho.');
  const used=columns.filter(Boolean);if(new Set(used).size!==used.length)throw Error('Duas colunas correspondem ao mesmo campo. Mantenha uma coluna por campo para evitar sobrescrita.');
  importSession={section,name,sheet,columns:headers,records:rows.slice(1).map((row,n)=>{
    const values=section==='empresas'?{name:'',legal:'',country:'',city:'',contact:'',email:'',phone:'',taxid:'',roles:[],locations:[],notes:''}:{name:'',type:'',code:'',country:'',city:'',description:''};
    columns.forEach((key,i)=>{if(key)values[key]=String(row[i]??'').trim()});
    if(section==='empresas')values.roles=String(values.roles).split(/[;,|/]/).map(r=>Object.keys(labels).find(k=>normalize(k)===normalize(r))).filter(Boolean);
    else values.type=['Porto','Aeroporto','Terminal','Armazém','Coleta / entrega'].find(t=>normalize(t)===normalize(values.type))||values.type;
    return {values,row:rowNumbers?.[n+1]??n+2,selected:true,source:headers.map((h,i)=>`${h}: ${row[i]??''}`).join('\n')};
  })};renderImport();
}
function importError(record,index){
  const v=record.values,kind=importSession.section==='empresas'?'company':'location';
  if(!v.name||!v.country||!v.city)return 'Complete nome, país e cidade.';
  if(kind==='location'&&!['Porto','Aeroporto','Terminal','Armazém','Coleta / entrega'].includes(v.type))return 'Revise o tipo do local.';
  if(v.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))return 'Revise o e-mail.';
  const error=validate(kind,v,'');if(error)return error;
  if(importSession.records.some((r,i)=>i<index&&r.selected&&((normalize(r.values.name)===normalize(v.name)&&normalize(r.values.country)===normalize(v.country)&&normalize(r.values.city)===normalize(v.city))||(v.taxid&&normalize(r.values.taxid)===normalize(v.taxid)&&normalize(r.values.country)===normalize(v.country))||(v.code&&normalize(r.values.code)===normalize(v.code)&&r.values.type===v.type))))return 'Possível duplicidade com outra linha deste lote. Revise antes de incluir.';
  return '';
}
function renderImport(){
  const s=importSession;const ready=s.records.filter((r,i)=>r.selected&&!importError(r,i)).length;
  openDrawer('Revisar antes de incorporar',`${s.name}${s.sheet?' · '+s.sheet:''}`,`<p>${ready} ${ready===1?'registro pronto selecionado':'registros prontos selecionados'} · ${s.records.length} recebidos. Linhas com pendência ou duplicidade não serão incluídas.</p>${note('Revise os dados recebidos. Importar cadastro não cria histórico, qualidade, regra ativa ou preferência. Registros existentes são preservados.')}<div class="import-review detail-notes">${s.records.map((r,i)=>{const error=importError(r,i);return `<article class="import-record"><label class="check"><input type="checkbox" data-import-select="${i}" ${r.selected?'checked':''} ><b>${esc(r.values.name||'Sem nome')}</b></label><small>Linha ${r.row} · ${esc(r.values.city||'Cidade ausente')} · ${esc(r.values.country||'País ausente')}</small>${pill(s.section==='empresas'?(r.values.roles.join(' / ')||'Papel ausente'):(r.values.type||'Tipo ausente'))}<p class="${error?'error':'good'}">${esc(error||'Pronto para sua confirmação')}</p><details><summary>Ver trecho da fonte</summary><pre class="source-text">${esc(r.source)}</pre></details><div class="actions">${btn('Revisar campos','import-edit',String(i),true)}</div></article>`}).join('')}</div><div class="drawer-actions">${btn('Cancelar','import-cancel','',true)}<button class="button" data-action="import-confirm" ${ready?'':'disabled'}>Incorporar ${ready} ${ready===1?'registro':'registros'}</button></div>`);
}
function editImport(index){
  const r=importSession.records[index],v=r.values,isCompany=importSession.section==='empresas';
  openDrawer('Revisar campos',`Linha ${r.row} · ${importSession.name}`,`<form id="import-row-form" data-index="${index}"><div class="fields">${field('Nome *','name',v.name,'text',true)}${field('País *','country',v.country,'text',true)}${field('Cidade *','city',v.city,'text',true)}${isCompany?field('Razão social','legal',v.legal)+field('Identificador fiscal','taxid',v.taxid)+field('Contato','contact',v.contact)+field('E-mail','email',v.email,'email')+field('Telefone','phone',v.phone)+checks('Papéis *','roles',Object.entries(labels),v.roles)+textArea('Observações','notes',v.notes):selectField('Tipo','type',[['','Selecione'],...['Porto','Aeroporto','Terminal','Armazém','Coleta / entrega']],v.type)+field('Código externo','code',v.code)+textArea('Endereço / observações','description',v.description)}</div><details class="detail-notes"><summary>Trecho original</summary><pre class="source-text">${esc(r.source)}</pre></details><div class="drawer-actions">${btn('Voltar sem alterar','import-back','',true)}<button type="submit" class="button">Guardar revisão</button></div></form>`);
}
document.addEventListener('change',async e=>{
  if(e.target.dataset.importSelect!==undefined){importSession.records[Number(e.target.dataset.importSelect)].selected=e.target.checked;renderImport();}
  if(e.target.id!=='context-file')return;const file=e.target.files[0];if(!file)return;const token=++importReadToken,session=importSession;$('#import-message').textContent='Lendo o arquivo localmente…';
  try{
    if(file.size>5*1024*1024)throw Error('Limite de 5 MB por arquivo.');
    const ext=file.name.split('.').pop().toLowerCase();let data;
    if(ext==='xlsx')data=await readXlsx(await file.arrayBuffer());else if(ext==='csv')data={rows:parseCSV(await file.text())};else if(ext==='txt')data={rows:parseContextText(await file.text())};else throw Error('Use .xlsx, .csv ou .txt. PDF/OCR ainda não integrado.');
    if(token!==importReadToken||session!==importSession||!$('#drawer').open)return;
    stageImport(data.rows,file.name,data.sheet,data.rowNumbers);
  }catch(error){if(token===importReadToken&&$('#import-message'))$('#import-message').textContent=error.message;}
});
document.addEventListener('submit',e=>{if(e.target.id!=='import-row-form')return;e.preventDefault();const f=new FormData(e.target),r=importSession.records[Number(e.target.dataset.index)];Object.assign(r.values,Object.fromEntries([...f].map(([k,v])=>[k,v.trim()])));if(importSession.section==='empresas')r.values.roles=f.getAll('roles');renderImport();});
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-action]');if(!b)return;const {action,id}=b.dataset;
  if(action==='import-context')openImport(id);
  if(action==='import-example')stageImport(importSamples[id],'Exemplo demonstrativo','Dados');
  if(action==='import-edit')editImport(Number(id));if(action==='import-back')renderImport();
  if(action==='import-cancel'){importReadToken++;importSession=null;closeDrawer();}
  if(action==='import-confirm'){
    const s=importSession,eligible=s.records.filter((r,i)=>r.selected&&!importError(r,i));if(!eligible.length)return;
    for(const r of eligible){const id=(s.section==='empresas'?'company':'location')+'-'+crypto.randomUUID();const v={...r.values,provenance:{name:s.name,sheet:s.sheet,row:r.row,columns:s.columns,excerpt:r.source,reviewedAt:new Date().toISOString()}};
      if(s.section==='empresas')state.companies.push({id,...v});else {state.locations[id]=v;locations[id]=v;}
    }
    save();importSession=null;closeDrawer();if(current===s.section)render();else location.hash=s.section;toast(`${eligible.length} ${eligible.length===1?'registro incorporado':'registros incorporados'}. Fonte registrada; históricos preservados.`);
  }
});

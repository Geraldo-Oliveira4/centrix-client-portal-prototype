'use strict';
// Availability review, distinct from missing values in the fictional sample.
const DATA_HELP = {
  identity: ['Parceiros e operações', 'Centrix e Inova têm campos para fornecedor/exportador e agente.', 'Confirmar preenchimento e vínculo de cada parceiro com o processo, embarque e PO. Conciliar nomes duplicados e cargas divididas ou consolidadas. Cadastro não comprova histórico de desempenho.'],
  ready: ['Prontidão no prazo', 'O contrato proposto do Inova prevê prontidão prevista e realizada.', 'Confirmar retorno e preenchimento das datas; preservar o compromisso original e suas revisões, com fonte. A previsão atual pode ter sido alterada e não comprova a promessa original.'],
  collect: ['Coleta', 'O contrato proposto do Inova prevê coleta prevista e realizada.', 'Confirmar data e local da coleta, fonte do evento e compromisso original. Não deduzir prontidão ou coleta a partir da partida do navio.'],
  port: ['Transporte e chegada ao porto', 'Inova e ShipsGo têm campos ou eventos de transporte internacional.', 'Confirmar integração, cobertura por embarque/contêiner e eventos previstos versus realizados. Preservar a primeira previsão de chegada. Chegada, descarga e saída do terminal são marcos diferentes.'],
  final: ['Entrega no destino final', 'O comprovante de entrega pode vir da operação, transportador ou cliente.', 'Identificar a fonte integrada e obter local, data real e compromisso original da entrega. O contrato Inova examinado não mapeia esse evento. Chegada ao porto ou gate out não comprovam entrega na fábrica.'],
  docs: ['Qualidade documental', 'O Centrix possui anexos e identificação de documentos.', 'Registrar primeira versão enviada, versões corrigidas, critérios de conferência, resultado e data do aceite. Um documento anexado não comprova que estava correto na primeira entrega.'],
  quantity: ['Quantidade recebida', 'A fonte pode ser o recebimento do cliente ou seu ERP/WMS; ainda não está mapeada.', 'Obter quantidade pedida e efetivamente recebida por item e unidade, com entregas parciais e vínculo à PO. Packing list e BL descrevem a carga, mas não comprovam o que foi recebido.'],
  condition: ['Condição da mercadoria', 'A fonte pode ser a inspeção de recebimento do cliente; ainda não está mapeada.', 'Obter resultado da inspeção, data, itens afetados e evidências de avaria ou integridade. Ausência de reclamação não comprova mercadoria íntegra; responsabilidade depende de apuração.'],
  freight: ['Frete contratado', 'O Centrix possui valores, moedas e versões de propostas.', 'Ligar a versão efetivamente aceita ao embarque e confirmar escopo e moeda. Há fretes contratados fora do Centrix. Evitar repetir o valor quando uma proposta atende vários embarques.'],
  cargo: ['Valor da mercadoria', 'A cotação possui valor declarado e moeda; invoice pode comprovar o valor documental.', 'Obter invoice vinculada à operação e conferir valor, moeda e itens. Enquanto houver apenas declaração, identificar como valor declarado. Confirmar alocação em cargas divididas/consolidadas.'],
  audit: ['Auditoria financeira', 'Existem propostas versionadas e registros de auditoria de cotação.', 'Confirmar fatura e linhas cobradas, escopo, moeda e contrato aceito da mesma operação. Auditoria de cotação não comprova conciliação de frete. Recuperação exige crédito ou baixa comprovados.'],
  stages: ['Tempos e desvios por trecho', 'Os intervalos podem ser calculados quando há dois eventos válidos da mesma operação.', 'Obter início e fim de cada trecho e o prazo combinado para ele, com fonte e histórico. Os tempos-alvo desta prévia são ilustrativos. Maior duração não comprova atraso sem uma referência acordada.'],
  route: ['Rotas, variantes e locais', 'Configurações define o percurso declarado; eventos de transporte podem mostrar o realizado.', 'Confirmar locais de coleta/entrega, portos, conexões e sequência real por embarque. Identificar eventos de entrada e saída. Rota cadastrada não comprova o trajeto percorrido nem o desempenho geral de um porto.'],
  cause: ['Causa e responsabilidade', 'Relatórios históricos incluem categorias e apurações de desvios.', 'Obter evidência e conclusão de apuração ligadas à ocorrência. Associação com um parceiro ou etapa não prova responsabilidade. Atraso e avaria permanecem sem atribuição enquanto isso não for confirmado.']
};
const HELP_LABELS = {
  'Fornecedor / origem':'identity','Fornecedor / rota':'identity','Entregas na base':'identity','Entrega / mercadoria':'quantity',
  'Prontidão':'ready','Prontidão no prazo':'ready','Compromisso':'ready','Chegada ao porto':'port','Porto no prazo':'port','Destino final':'final',
  'Frete contratado':'freight','Entrega / contratação':'freight','Execução':'port','Conferência':'audit','Frete / cobrança':'audit','Performance / responsabilidade':'cause',
  'Onde os tempos excedem o previsto':'stages','Dentro do trânsito via Singapura':'stages','Como o desempenho evolui':'ready',
  'Percursos utilizados':'route','Variantes deste corredor':'route','Locais da operação':'route','Passagens e fontes':'route','Movimentações':'route',
  'Passagens registradas':'route','Intervalo observado':'stages','Entrada realizada':'route','Saída realizada':'route',
  'Agentes neste recorte':'audit','Fornecimento por parceiro':'docs','Contratação e auditoria':'audit',
  'Previsto':'stages','Realizado':'stages','Desvio':'stages'
};
function dataHelp(key){return DATA_HELP[key]?`<button type="button" class="data-help" data-help="${key}" aria-label="Dados a confirmar: ${DATA_HELP[key][0]}" aria-expanded="false"><span aria-hidden="true">i</span></button>`:'';}
function dataLabel(label,key=HELP_LABELS[label]){return label+dataHelp(key);}

let helpAnchor=null, helpPinned=false, helpTimer=null;
const helpTip=document.createElement('div');
helpTip.id='data-help-tip';helpTip.className='data-help-tip';helpTip.setAttribute('role','tooltip');helpTip.setAttribute('popover','manual');
function closeDataHelp(){clearTimeout(helpTimer);if(helpAnchor){helpAnchor.setAttribute('aria-expanded','false');helpAnchor.removeAttribute('aria-describedby');}if(helpTip.matches(':popover-open'))helpTip.hidePopover();helpAnchor=null;helpPinned=false;}
function positionDataHelp(){if(!helpAnchor?.isConnected){closeDataHelp();return;}const r=helpAnchor.getBoundingClientRect(),t=helpTip.getBoundingClientRect();helpTip.style.left=Math.max(12,Math.min(r.left,document.documentElement.clientWidth-t.width-12))+'px';helpTip.style.top=Math.max(12,Math.min(r.bottom+8+t.height>innerHeight?r.top-t.height-8:r.bottom+8,innerHeight-t.height-12))+'px';}
function showDataHelp(button,pinned=false){clearTimeout(helpTimer);if(helpAnchor!==button)closeDataHelp();helpAnchor=button;helpPinned=pinned||helpPinned;const [title,known,missing]=DATA_HELP[button.dataset.help];helpTip.replaceChildren();for(const [tag,text] of [['small','Dados a confirmar'],['h3',title],['p',known],['strong','O que falta'],['p',missing],['small','Disponibilidade em produção ainda não validada. Valores desta prévia são demonstrativos.']]){const item=document.createElement(tag);item.textContent=text;helpTip.append(item);}const host=button.closest('dialog')||document.body;if(helpTip.parentElement!==host)host.append(helpTip);if(!helpTip.matches(':popover-open'))helpTip.showPopover();button.setAttribute('aria-expanded','true');button.setAttribute('aria-describedby',helpTip.id);positionDataHelp();}
function scheduleDataHelpClose(){clearTimeout(helpTimer);if(!helpPinned)helpTimer=setTimeout(closeDataHelp,180);}
document.addEventListener('pointerover',e=>{const b=e.target.closest('[data-help]');if(b&&e.pointerType!=='touch')showDataHelp(b);else if(helpTip.contains(e.target))clearTimeout(helpTimer);});
document.addEventListener('pointerout',e=>{if(e.target.closest('[data-help]')||helpTip.contains(e.target))scheduleDataHelpClose();});
document.addEventListener('focusin',e=>{if(e.target.matches('[data-help]'))showDataHelp(e.target);else if(!helpTip.contains(e.target))closeDataHelp();});
document.addEventListener('focusout',e=>{if(e.target.matches('[data-help]')&&!helpTip.contains(e.relatedTarget))scheduleDataHelpClose();});
document.addEventListener('click',e=>{const b=e.target.closest('[data-help]');if(b){e.preventDefault();e.stopImmediatePropagation();if(helpAnchor===b&&helpPinned)closeDataHelp();else showDataHelp(b,true);}else if(!helpTip.contains(e.target))closeDataHelp();},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&helpAnchor){closeDataHelp();e.preventDefault();e.stopImmediatePropagation();}},true);
window.addEventListener('hashchange',closeDataHelp);
window.addEventListener('resize',closeDataHelp);
document.addEventListener('scroll',e=>{if(helpAnchor&&!helpTip.contains(e.target)){const r=helpAnchor.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight)closeDataHelp();else positionDataHelp();}},true);
function dataHelpReportNotes(article){const keys=[...new Set([...article.querySelectorAll('[data-help]')].map(b=>b.dataset.help))];if(!keys.length)return;const section=document.createElement('section');section.className='report-section data-help-notes';const title=document.createElement('h2');title.textContent='Dados a confirmar para integração';section.append(title);for(const key of keys){const [name,known,missing]=DATA_HELP[key],p=document.createElement('p'),b=document.createElement('b');b.textContent=name+': ';p.append(b,known+' O que falta: '+missing);p.className='spaced';section.append(p);}article.append(section);}
window.addEventListener('beforeprint',()=>{closeDataHelp();const article=document.querySelector('#report-document');if(article&&!article.querySelector('.data-help-notes'))dataHelpReportNotes(article);});
window.addEventListener('afterprint',()=>document.querySelector('#report-document .data-help-notes')?.remove());

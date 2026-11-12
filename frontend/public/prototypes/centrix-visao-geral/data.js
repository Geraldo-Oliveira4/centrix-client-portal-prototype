/* All records below are fictional. No API calls. */
// RELÓGIO DA DEMONSTRAÇÃO (12/11/2026), mesma regra da Inteligência: a carteira é
// escrita contra a DATA-BASE 10/09/2026 e DESLOCADA inteira para o hoje da
// demonstração — a data atual, ou `?hoje=AAAA-MM-DD`. Diferenças entre datas
// (prazo vencido, previsão alterada, dias parado) não mudam; a hora do cenário
// continua 10h30. Datas ISO e textos "DD/MM", "DD/MM/AAAA" e "D set [2026]" são
// deslocados em memória; o arquivo-fonte nunca muda. Sem `location` (testes), o
// hoje é a data-base; o teste que quer outro hoje põe `location.search` no contexto.
const BASE_DAY = '2026-09-10';
const DEMO_CLOCK = (() => {
  const MONTHS = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const validDay = d => /^\d{4}-\d{2}-\d{2}$/.test(d||'') && new Date(d+'T12:00:00Z').toISOString().slice(0,10) === d;
  const add = (d, n) => new Date(Date.parse(d+'T12:00:00Z') + n*864e5).toISOString().slice(0,10);
  const days = (a, b) => Math.round((Date.parse(b+'T12:00:00Z') - Date.parse(a+'T12:00:00Z'))/864e5);
  function today(search, now){
    const q = new URLSearchParams(search||'').get('hoje');
    if (validDay(q)) return q;
    const n = now instanceof Date ? now : new Date();
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
  }
  const day = typeof location !== 'undefined' && location ? today(location.search, new Date()) : BASE_DAY;
  const offset = days(BASE_DAY, day);
  const shiftIso = v => typeof v === 'string' && validDay(v.slice(0,10)) ? add(v.slice(0,10), offset) + v.slice(10) : v;
  // Textos: só os formatos que o cenário usa, e só meses do cenário (ago-out), para
  // não tocar em número que não é data (PO, valores, contêiner).
  const year = BASE_DAY.slice(0,4);
  const moved = (dd, mm, yyyy) => add(`${yyyy||year}-${mm}-${dd.padStart(2,'0')}`, offset);
  function shiftText(s){
    if (typeof s !== 'string' || !offset) return s;
    return s
      .replace(/\b(\d{2})\/(0[89]|10)(\/(\d{4}))?\b/g, (_, dd, mm, withYear, yyyy) => {
        const d = moved(dd, mm, yyyy);
        return `${d.slice(8,10)}/${d.slice(5,7)}` + (withYear ? `/${d.slice(0,4)}` : '');
      })
      .replace(/\b(\d{1,2}) (ago|set|out)( (\d{4}))?\b/g, (_, dd, mon, withYear, yyyy) => {
        const d = moved(dd, String(MONTHS.indexOf(mon)+1).padStart(2,'0'), yyyy);
        return `${Number(d.slice(8,10))} ${MONTHS[Number(d.slice(5,7))-1]}` + (withYear ? ` ${d.slice(0,4)}` : '');
      });
  }
  // Uma carteira inteira: ISO onde é data, texto onde é frase. Ids não mudam.
  function shiftDeep(value, key){
    if (Array.isArray(value)) return value.map(v => shiftDeep(v));
    if (value && typeof value === 'object') { for (const k of Object.keys(value)) value[k] = shiftDeep(value[k], k); return value; }
    if (typeof value !== 'string' || key === 'id') return value;
    return /^\d{4}-\d{2}-\d{2}/.test(value) ? shiftIso(value) : shiftText(value);
  }
  return {day, offset, today, shiftIso, shiftText, shiftDeep};
})();
const DEMO_DAY = DEMO_CLOCK.day;
const NOW = new Date(DEMO_DAY + 'T10:30:00-03:00');
/** Atalhos para os literais de data em work.js/app.js/operation.js. */
const demoDate = DEMO_CLOCK.shiftIso, demoText = DEMO_CLOCK.shiftText;
const STAGES = ['Em cotação','Aguardando embarque','Em transporte','Chegada ao destino'];
const STAGE_NOTES = ['Propostas e decisão no Centrix','Contratação e reserva do transporte','Tracking do trecho internacional','Chegada ao porto ou aeroporto'];
function record(id,name,po,stage,owner,status,opts={}){return {id,name,po,stage,owner,status,supplier:'Lumen Industrial',route:'Shanghai → Santos',modal:'Marítimo',since:'2026-09-07',milestone:'Chegada ao porto',date:'2026-09-24',baseline:'2026-09-24',blocked:false,risk:false,stale:false,source:'Atualização do agente',updated:'10/09 às 09h40',events:[],...opts};}
const INITIAL_PROCESSES = [
record('PR-26043','Filme de proteção','PO 1861',1,'Mariana','Pronto; aguardando janela de coleta',{supplier:'Eastpack',date:'2026-09-12',baseline:'2026-09-12',ready:'2026-09-08',milestone:'Coleta na origem',since:'2026-09-08',updated:'09/09 às 16h10',source:'Confirmação do fornecedor',waiting:{executor:'Agente de carga',title:'Confirmar janela de coleta',followup:'2026-09-11T09:00',effect:'Fornecedor confirmou a prontidão; o agente está organizando a coleta.'}}),
record('PR-26034','Componentes eletrônicos','PO 1826',0,'Mariana','Propostas prontas para decisão',{supplier:'Nova Circuits',quote:'COT-DEMO-034',modal:'Aéreo',route:'Taipei → Guarulhos',date:'2026-09-10',milestone:'Validade da proposta',baseline:'2026-09-10',since:'2026-09-08',action:{type:'quote',title:'Escolher proposta de frete',cta:'Comparar propostas',owner:'Mariana',deadline:'2026-09-10T14:00:00-03:00',reason:'As três propostas vencem hoje às 14h.',effect:'A decisão permite confirmar a reserva de transporte.'}}),
record('PR-26035','Válvulas de controle','PO 1831',2,'Beatriz','Em trânsito; previsão mantida',{supplier:'Flowtech',since:'2026-08-29',date:'2026-09-20',milestone:'Chegada ao porto',baseline:'2026-09-20'}),
record('PR-26036','Matriz para injeção','PO 1833',0,'Rafael','Exceção de orçamento para aprovar',{supplier:'Tooling Works',route:'Hamburgo → Santos',date:'2026-09-10',milestone:'Decisão de contratação',baseline:'2026-09-10',blocked:true,action:{type:'budget',title:'Revisar exceção de orçamento',cta:'Revisar decisão',owner:'Rafael',deadline:'2026-09-10T16:00:00-03:00',reason:'Proposta R$ 1.200 acima do orçamento de R$ 18.000.',effect:'Analista aguarda decisão para prosseguir com a contratação.'}}),
record('PR-26027','Rolamentos industriais','PO 1808',1,'Mariana','Material pronto; pagamento pendente',{supplier:'Orient Bearings',shipment:'EMB-DEMO-027',date:'2026-09-11',milestone:'Janela de coleta',baseline:'2026-09-11',blocked:true,since:'2026-09-04',ready:'2026-09-04',waiting:{executor:'Financeiro da Aurora',title:'Confirmar pagamento ao fornecedor',followup:'2026-09-10T11:00',effect:'Fornecedor condiciona a liberação da carga ao pagamento.'},events:[{time:'Hoje, 09h20',title:'Carga aguarda confirmação financeira',text:'Fornecedor confirmou o material pronto em 04/09. Não há liberação para coleta.',source:'E-mail do fornecedor'}]}),
record('PR-26028','Sensores de pressão','PO 1814',1,'Mariana','Booking aguardando sua aprovação',{supplier:'Sense Components',shipment:'EMB-DEMO-028',date:'2026-09-12',milestone:'Coleta na origem',baseline:'2026-09-12',blocked:true,action:{type:'booking',title:'Aprovar booking para liberar coleta',cta:'Revisar booking',owner:'Mariana',deadline:'2026-09-10T09:00:00-03:00',reason:'Aprovação prevista para hoje às 09h.',effect:'Agente aguarda aceite para confirmar a coleta de 12/09.'}}),
record('PR-26029','Cabos de conexão','PO 1817',1,'Beatriz','Coleta prevista; embarque a confirmar',{supplier:'Nex Wire',date:'2026-09-11',milestone:'Coleta na origem',baseline:'2026-09-11',since:'2026-09-09'}),
record('PR-26018','Motores elétricos','PO 1774',2,'Mariana','Chegada ao porto reprogramada',{supplier:'Motion Electric',shipment:'EMB-DEMO-018',date:'2026-09-17',baseline:'2026-09-14',risk:true,since:'2026-08-27',events:[{time:'Hoje, 09h05',title:'Chegada ao porto mudou em 3 dias',text:'A nova previsão é 17/09. O agente informa alteração na escala; disponibilidade na fábrica ainda não informada.',before:'14 set',after:'17 set',source:'Comunicado do agente'}]}),
record('PR-26019A','Chapas de alumínio · lote 1','PO 1782',2,'Beatriz','Em trânsito; previsão mantida',{supplier:'Aluform',shipment:'EMB-DEMO-019A',split:'PO 1782 · 2 lotes em acompanhamento',date:'2026-09-16',baseline:'2026-09-16',since:'2026-08-25'}),
record('PR-26019B','Chapas de alumínio · lote 2','PO 1782',2,'Beatriz','Em trânsito; previsão mantida',{supplier:'Aluform',shipment:'EMB-DEMO-019B',split:'PO 1782 · 2 lotes em acompanhamento',date:'2026-09-22',baseline:'2026-09-22',since:'2026-08-30'}),
record('PR-26012','Bombas hidráulicas','PO 1749',3,'Mariana','Complemento documental solicitado',{supplier:'Hydra Works',shipment:'EMB-DEMO-012',date:'2026-09-08',baseline:'2026-09-08',milestone:'Chegada realizada ao porto',blocked:true,since:'2026-09-08',action:{type:'document',title:'Complementar a commercial invoice',cta:'Ver documento',owner:'Mariana',deadline:'2026-09-10T12:00:00-03:00',reason:'A invoice recebida não informa o Incoterm.',effect:'Despachante aguarda a versão corrigida para seguir com a análise.'}}),
record('PR-26013','Embalagens industriais','PO 1752',3,'Mariana','Descarga confirmada; entrega não acompanhada',{supplier:'Packwell',shipment:'EMB-DEMO-013',date:'2026-09-09',baseline:'2026-09-09',milestone:'Descarga realizada',since:'2026-09-09',waiting:{executor:'Transportadora Horizonte',title:'Consultar possibilidade de acompanhamento da entrega',followup:'2026-09-10T15:00',effect:'Tracking confirma a descarga. A entrega na fábrica ainda não tem uma fonte de acompanhamento neste exemplo.'}}),
record('PR-26014','Conectores pneumáticos','PO 1758',3,'Rafael','Chegada ao porto confirmada',{supplier:'Airlink',date:'2026-09-10',baseline:'2026-09-10',milestone:'Chegada realizada ao porto',since:'2026-09-09'}),
record('PR-26005','Redutores de velocidade','PO 1711',3,'Mariana','Caso de divergência pronto',{supplier:'Gear Systems',shipment:'EMB-DEMO-005',audit:{planned:9250,billed:9820,questionable:570,status:'Caso pronto'},date:'2026-09-08',milestone:'Chegada realizada ao porto',baseline:'2026-09-08',since:'2026-09-08',action:{type:'audit',title:'Revisar caso de cobrança',cta:'Ver caso pronto',owner:'Mariana',deadline:null,reason:'R$ 570 em cobranças sem respaldo na proposta aceita.',effect:'Caso preparado para você avaliar e conduzir o envio ao agente.'},events:[{time:'Hoje, 08h45',title:'Conferência preparou um caso',text:'Taxa documental de R$ 120 e taxa adicional de R$ 450 não constam da proposta aceita.',source:'Conferência demonstrativa da fatura'}]}),
record('PR-26006','Terminais industriais','PO 1720',3,'Beatriz','Aguardando fatura final',{supplier:'Terminal Tech',shipment:'EMB-DEMO-006',date:'2026-09-09',milestone:'Chegada realizada ao porto',baseline:'2026-09-09',since:'2026-09-09',waiting:{executor:'Agente de carga',title:'Receber fatura final',followup:'2026-09-11T10:00',effect:'Conferência depende da documentação final.'}}),
record('PR-26007','Juntas de vedação','PO 1725',3,'Rafael','Conferência em processamento',{supplier:'Seal Works',date:'2026-09-10',milestone:'Chegada realizada ao porto',baseline:'2026-09-10',since:'2026-09-10',source:'Rotina de conferência'})
];
for (const p of INITIAL_PROCESSES) {
  p.coverage = p.stage===0 ? 'Centrix · cotação' : p.stage===1 ? 'Origem: complemento Inova' : 'Marco: tracking ShipsGo';
  p.source = p.stage<2 ? 'Centrix · cenário demonstrativo' : 'ShipsGo · cenário demonstrativo';
  p.coverageNote = p.stage===1 ? 'Prontidão e coleta são informações complementares do exemplo Inova. Não são etapas obrigatórias; sua exibição depende da cobertura integrada.' : p.stage===3 ? 'O acompanhamento confirma apenas o marco no porto ou aeroporto. Desembaraço e entrega na fábrica não estão acompanhados nesta prévia.' : 'A etapa reúne os dados de cotação ou tracking disponíveis neste cenário.';
  if (p.id==='PR-26013') delete p.waiting;
  if (p.id==='PR-26014') p.since='2026-09-10';
  if (p.stage===3 && /realizada|realizado/.test(p.milestone)) p.actual=true;
}

// Explicit fictional commitments: tracking does not infer contacts or reply deadlines.
const RETURN_CONTEXT = {
 'PR-26043': {since:'2026-09-09',expected:'2026-09-11T09:00:00-03:00',lastContact:'2026-09-09T16:10:00-03:00',contact:'operacao@agente.example',module:'Embarques'},
 'PR-26027': {since:'2026-09-09',expected:'2026-09-10T10:00:00-03:00',lastContact:'2026-09-09T15:00:00-03:00',contact:'financeiro@aurora.example',module:'Embarques'},
 'PR-26006': {since:'2026-09-09',expected:null,lastContact:null,contact:null,module:'Auditoria'}
};
for(const p of INITIAL_PROCESSES){if(p.waiting)Object.assign(p.waiting,RETURN_CONTEXT[p.id]);}
INITIAL_PROCESSES.find(p=>p.id==='PR-26035').events.push({time:'Hoje, 08h20',title:'Posição de trânsito atualizada',text:'Previsão de chegada mantida. Nenhuma decisão solicitada.',source:'Tracking demonstrativo',informational:true});
// Desloca a carteira inteira (datas, previsões, eventos) para o hoje da demonstração.
DEMO_CLOCK.shiftDeep(INITIAL_PROCESSES);

'use strict';
// Fixtures locais: não são preços, preferências ou ofertas de produção.
const priceRoutes = [
 {id:'r1',preferred:true,name:'Shanghai → Santos',origin:'CNSHA',destination:'BRSSZ',equipment:'40HC',service:'1 conexão',currency:'USD',scope:'Frete marítimo internacional',source:'DEMO-FRETE-01',updated:'12/09/2026 · 16:00 BRT',
 windows:[
 {start:'20/07',end:'26/07',median:2800},{start:'27/07',end:'02/08',median:2720},
 {start:'03/08',end:'09/08',median:2600},{start:'10/08',end:'16/08',median:2530},
 {start:'17/08',end:'23/08',median:2480},{start:'24/08',end:'30/08',median:2520},
 {start:'01/09',end:'06/09',median:2450},{start:'07/09',end:'12/09',median:2250}
 ],
 own:[
 {id:'DEMO-CTR-18',type:'Contratado',agent:'Vértice Cargo',value:2400,date:'28/08/2026',comparable:true,scope:'40HC · 1 conexão · frete marítimo',validity:'Contratação histórica; não é oferta atual.'},
 {id:'DEMO-PROP-21',type:'Proposta recebida',agent:'Vértice Cargo',value:2350,date:'12/09/2026',comparable:true,scope:'40HC · 1 conexão · frete marítimo',validity:'Validade fictícia até 14/09/2026. Espaço e saída a confirmar.'},
 {id:'DEMO-PROP-22',type:'Proposta recebida',agent:'Vértice Cargo',value:2290,date:'12/09/2026',comparable:false,scope:'40HC · serviço direto · frete marítimo',validity:'Serviço diferente: excluída da comparação de preço. Validade fictícia até 14/09/2026.'}
 ],need:'n1'},
 {id:'r2',preferred:true,name:'Hamburgo → Itapoá',origin:'DEHAM',destination:'BRIOA',equipment:'40HC',service:'Direto',currency:'USD',scope:'Frete marítimo internacional',source:null,updated:null,windows:[],
 own:[
 {id:'DEMO-CTR-09',type:'Contratado',agent:'Vértice Cargo',value:1800,date:'02/08/2026',comparable:true,scope:'40HC · direto · frete marítimo',validity:'Contratação histórica; não é oferta atual.'},
 {id:'DEMO-PROP-15',type:'Proposta recebida',agent:'Vértice Cargo',value:1910,date:'05/09/2026',comparable:true,scope:'40HC · direto · frete marítimo',validity:'Validade encerrada em 10/09/2026 no exemplo. Revalidar antes de avaliar contratação.'}
 ],need:null}
];
let pricePeriod=4, selectedWindow=null;
const money = value => value==null?'—':'USD '+value.toLocaleString('pt-BR',{maximumFractionDigits:0});
const pct = (current,base) => current!=null && base>0 ? (current/base-1)*100 : null;
const percent = value => value==null?'—':(value>0?'+':'')+value.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';
const observations = w => [-150,-100,-50,50,100,150].map(offset=>w.median+offset);
const currentPrice = r => mode==='sem-fontes'||!r.windows.length?null:r.windows.at(-1).median;
const priceOrigins=[{code:'CNSHA',name:'Shanghai'},{code:'DEHAM',name:'Hamburgo'},{code:'CNNGB',name:'Ningbo'}];
const priceDestinations=[{code:'BRSSZ',name:'Santos'},{code:'BRIOA',name:'Itapoá'},{code:'BRPNG',name:'Paranaguá'}];
function ensurePriceRoute({origin,destination,equipment,service}) {
 const from=priceOrigins.find(p=>p.code===origin),to=priceDestinations.find(p=>p.code===destination);
 if(!from||!to||!['40HC','20GP','40GP'].includes(equipment)||!['1 conexão','Direto'].includes(service))return null;
 const existing=priceRoutes.find(r=>r.origin===origin&&r.destination===destination&&r.equipment===equipment&&r.service===service);
 if(existing)return existing;
 const r={id:'local-'+(priceRoutes.length+1),preferred:false,name:from.name+' → '+to.name,origin,destination,equipment,service,currency:'USD',scope:'Frete marítimo internacional',source:null,updated:null,windows:[],own:[],need:null};
 priceRoutes.push(r);return r;
}
function priceSource(r,index) {
 const windows=r.windows.slice(-pricePeriod), w=windows[index];
 openDrawer('Origem da referência','<span class="pill purple">Amostra inteiramente fictícia</span><div class="data-block"><h3>'+r.name+'</h3><p>'+r.scope+' · USD / '+r.equipment+' · '+r.service+'</p><p><strong>'+w.start+'–'+w.end+'/2026</strong> · '+r.source+'</p><p>Seis referências sintéticas: '+observations(w).map(money).join(' · ')+'.</p><p>Mediana: média dos dois valores centrais = '+money(w.median)+'. Faixa observada: '+money(observations(w)[0])+' a '+money(observations(w).at(-1))+'.</p></div><div class="data-block"><h3>O que entra na comparação</h3><p>Mesma rota, sentido, modal marítimo, equipamento 40HC, moeda USD, serviço com uma conexão e escopo de frete internacional. Valores sem taxas locais, seguro, coleta ou entrega final. Cada janela tem seis referências; a população ilustrativa não representa o mercado inteiro.</p></div><div class="note">Fonte de demonstração montada para esta prévia. Não há fornecedor de dados conectado, oferta reservável, preço previsto ou economia realizada. As janelas são as datas indicadas, sem amostra em 31/08.</div><p style="margin-top:16px">Corte do conjunto: '+r.updated+'. Dados reais exigiriam origem licenciada/autorizada, metodologia, validade e revisões por observação.</p>');
}
function priceChart(r) {
 const windows=r.windows.slice(-pricePeriod);
 if(!windows.length||mode==='sem-fontes')return '<div class="price-chart-empty"><div>'+icon('market')+'</div><h3>'+(mode==='sem-fontes'?'Fonte indisponível neste cenário':'Sem série de mercado para esta rota')+'</h3><p>'+(mode==='sem-fontes'?'A consulta fictícia está indisponível. Não exibimos a referência anterior como preço atual.':r.own.length?'O histórico da Atlas aparece abaixo, identificado como dado da empresa. Ele não representa uma cotação de mercado.':'Rota adicionada ao Radar. Ainda não há fonte de preços para este percurso, equipamento e serviço.')+'</p><button class="button secondary" data-coverage>Ver dados necessários</button></div>';
 const idx=selectedWindow==null?windows.length-1:Math.min(selectedWindow,windows.length-1);
 const w=windows[idx], low=Math.floor(Math.min(...windows.map(x=>x.median-150))/200)*200, high=Math.ceil(Math.max(...windows.map(x=>x.median+150))/200)*200;
 const chartWidth=window.matchMedia('(max-width:700px)').matches?340:750;
 const x=i=>48+i*(chartWidth-72)/(windows.length-1), y=v=>215-(v-low)/(high-low)*170;
 const line=windows.map((v,i)=>x(i)+','+y(v.median)).join(' ');
 const band=windows.map((v,i)=>x(i)+','+y(v.median+150)).concat(windows.map((v,i)=>x(i)+','+y(v.median-150)).reverse()).join(' ');
 const axis=Array.from({length:(high-low)/200+1},(_,i)=>low+i*200);
 return '<div class="chart-legend"><span><i class="legend-line"></i>Mediana da referência</span><span><i class="legend-band"></i>Menor–maior observado</span><span>USD / 40HC · 2026</span></div><svg class="price-chart" viewBox="0 0 '+chartWidth+' 270" role="img" aria-label="Mediana e faixa de preço em '+windows.length+' janelas. Valores disponíveis nos botões e na tabela abaixo.">'+axis.map(v=>'<line x1="46" y1="'+y(v)+'" x2="'+(chartWidth-20)+'" y2="'+y(v)+'" stroke="#e9e8f0"/><text x="40" y="'+(y(v)+4)+'" text-anchor="end">'+Math.round(v).toLocaleString('pt-BR')+'</text>').join('')+'<polygon points="'+band+'" fill="#eeebf7"/><polyline points="'+line+'" fill="none" stroke="#474277" stroke-width="3"/>'+windows.map((v,i)=>'<circle cx="'+x(i)+'" cy="'+y(v.median)+'" r="'+(i===idx?'6':'4')+'" fill="'+(i===idx?'#b26c13':'#474277')+'"/><text x="'+x(i)+'" y="246" text-anchor="middle">'+v.end+'</text>').join('')+'</svg><div class="window-buttons" role="group" aria-label="Explorar janelas de preço">'+windows.map((v,i)=>'<button data-window="'+i+'" aria-pressed="'+(i===idx)+'" class="'+(i===idx?'selected':'')+'"><small>'+v.start+'–'+v.end+'</small><strong>'+money(v.median)+'</strong></button>').join('')+'</div><div class="window-evidence" aria-live="polite"><div><strong>'+w.start+'–'+w.end+'/2026 · '+money(w.median)+'</strong><small>6 referências · faixa '+money(w.median-150)+'–'+money(w.median+150)+' · fonte fictícia '+r.source+'</small></div><button class="link" id="price-source">Conferir amostra</button></div><details class="price-data-table"><summary>Ver valores em tabela</summary><table><caption>Referências fictícias · USD por 40HC</caption><thead><tr><th>Janela / 2026</th><th>Mediana</th><th>Faixa</th><th>Amostra</th></tr></thead><tbody>'+windows.map(v=>'<tr><td>'+v.start+'–'+v.end+'</td><td>'+money(v.median)+'</td><td>'+money(v.median-150)+'–'+money(v.median+150)+'</td><td>6</td></tr>').join('')+'</tbody></table></details>';
}
function renderPriceDetail(r) {
 const current=currentPrice(r), prior=r.windows.length?r.windows.at(-2).median:null, windows=r.windows.slice(-pricePeriod), ownContract=r.own.find(o=>o.type==='Contratado');
 const change=pct(current,prior);
 const unavailable=current==null;
 return '<section class="price-detail" aria-label="Detalhe de preço da rota"><div class="price-route-heading"><div><div class="eyebrow">Rota selecionada · '+r.origin+' → '+r.destination+'</div><h2>'+r.name+'</h2><p>Marítimo · '+r.equipment+' · '+r.service+' · '+r.scope+'</p></div><button class="link" id="price-route-connection">Ver ficha da rota →</button></div><div class="price-metrics"><div><small>Referência mais recente</small><b>'+money(current)+'</b><span>'+(unavailable?'Sem avaliação atual':r.windows.at(-1).start+'–'+r.windows.at(-1).end+'/2026 · 6 referências')+'</span></div><div><small>Variação entre as últimas janelas</small><b class="'+(!unavailable&&change<0?'price-down':'')+'">'+(unavailable?'—':percent(change))+'</b><span>'+(unavailable?'Sem base de comparação':money(prior)+' → '+money(current))+'</span></div><div><small>Faixa observada · '+pricePeriod+' janelas</small><b class="price-range">'+(unavailable?'—':money(Math.min(...windows.map(v=>v.median-150)))+'–'+Math.max(...windows.map(v=>v.median+150)).toLocaleString('pt-BR'))+'</b><span>'+(unavailable?'Cobertura não disponível':windows.length*6+' referências · menor–maior, não previsão')+'</span></div></div><div class="price-detail-grid"><div class="panel price-chart-panel"><div class="section-heading"><div><h3>Evolução do preço</h3><p>Referência de mercado · exemplo fictício</p></div><div class="period-picker" role="group" aria-label="Período do gráfico">'+[4,8].map(n=>'<button data-period="'+n+'" aria-pressed="'+(pricePeriod===n)+'">'+n+' janelas</button>').join('')+'</div></div>'+priceChart(r)+'</div><aside class="panel price-next"><div class="eyebrow">Da referência à decisão</div><h3>'+(r.need?'Vale avaliar para a NEC-041?':'Primeiro, obtenha uma condição atual')+'</h3><p>'+(r.need?'Componentes de montagem · 1.200 peças em Joinville até 20/10. Há revisão de prontidão, mas saída, espaço e prazo útil ainda precisam de confirmação.':r.own.length?'Há registros da Atlas nesta rota, mas não temos série de mercado ou proposta válida no corte fictício. Revalidar é o próximo passo antes de concluir que uma condição é boa.':'Ainda não há preços ou histórico vinculados. Uma cotação pode ajudar a obter uma condição para este percurso.')+'</p><div class="note">'+(unavailable?'Falta uma fonte atual para avaliar a condição de preço.':'A referência está '+percent(pct(current,ownContract.value))+' em relação à última contratação equivalente da Atlas. Essa diferença não é economia realizada e compara datas diferentes.')+'</div><div class="action-stack">'+(r.need?'<a class="button" href="#sinal/c1">Avaliar necessidade relacionada →</a>':'')+'<button class="button secondary" id="price-quote-connection">Ver conexão com Cotações</button></div><small>Decisão humana. Nenhuma cotação é criada nesta prévia.</small></aside></div><section class="panel own-prices"><div class="section-heading"><div><h3>Preços da Atlas nesta rota</h3><p>Contratação e propostas são registros próprios. Não entram na série de mercado.</p></div><span class="pill">Histórico fictício</span></div><div class="price-table-wrap"><table><thead><tr><th>Origem e registro</th><th>Valor / '+r.equipment+'</th><th>Comparação com a referência</th><th>Condições e validade</th></tr></thead><tbody>'+r.own.map(o=>'<tr><td><strong>'+o.type+'</strong><small>'+o.id+' · '+o.date+'<br>'+o.agent+'</small></td><td><strong>'+money(o.value)+'</strong></td><td>'+(unavailable?'Sem referência de mercado':!o.comparable?'Não comparável':'<strong>'+percent(pct(o.value,current))+'</strong><small>Preço próprio vs. referência de '+money(current)+'</small>')+'</td><td>'+o.scope+'<small>'+o.validity+'</small>'+(!o.comparable?'<span class="pill amber">Serviço diferente</span>':'')+'</td></tr>').join('')+'</tbody></table></div><p class="price-table-note">Comparamos apenas o frete marítimo em USD para o mesmo percurso, equipamento e serviço. Taxas locais, seguro, coleta e entrega final não estão incluídos. Datas e validade permanecem separadas.</p></section></section>';
}
function addPriceRoute() {
 openDrawer('Adicionar rota','<p>Escolha o percurso para acompanhar o preço do frete.</p><form id="add-price-route"><div class="route-add-fields"><label>Origem<select name="origin" required><option value="">Selecione o porto</option>'+priceOrigins.map(p=>'<option value="'+p.code+'">'+p.name+' · '+p.code+'</option>').join('')+'</select></label><label>Destino<select name="destination" required><option value="">Selecione o porto</option>'+priceDestinations.map(p=>'<option value="'+p.code+'">'+p.name+' · '+p.code+'</option>').join('')+'</select></label><label>Equipamento<select name="equipment"><option>40HC</option><option>20GP</option><option>40GP</option></select></label><label>Serviço<select name="service"><option>1 conexão</option><option>Direto</option></select></label></div><small>Marítimo · frete internacional · USD por contêiner.</small><div class="note" style="margin-top:20px">Adicionar não garante cobertura de preços. A rota fica neste Radar durante a sessão, sem alterar suas preferências comerciais ou Configurações.</div><div class="drawer-actions"><button type="button" class="button secondary" id="cancel-add-price">Cancelar</button><button class="button" type="submit">Ver detalhes da rota</button></div></form>');
 $('#cancel-add-price').onclick=()=>$('#drawer').close();
 $('#add-price-route').onsubmit=e=>{
  e.preventDefault();
  const r=ensurePriceRoute(Object.fromEntries(new FormData(e.target)));
  if(!r)return;
  selectedWindow=null;$('#drawer').close();
  const hash='radar/mercado/'+r.id;
  if(route()===hash)renderPrices();else location.hash=hash;
  $('#status').textContent='Rota '+r.name+' selecionada. Preferências comerciais preservadas.';
 };
}
function priceRouteCard(r) {
 const current=currentPrice(r), latest=r.windows.at(-1), prior=r.windows.at(-2);
 const change=pct(current,prior?.median);
 let trend='<div class="freight-no-series"><strong>Sem referência de mercado</strong><p>'+(r.own.length?'Há registros próprios no detalhe, mas falta uma fonte atual para avaliar o preço.':'Ainda não há fonte ou histórico vinculado a esta rota.')+'</p></div>';
 if(current!=null){
  const values=r.windows.map(w=>w.median), low=Math.min(...values), span=Math.max(...values)-low||1;
  const points=values.map((v,i)=>(8+i*284/Math.max(1,values.length-1))+','+(65-(v-low)/span*50)).join(' ');
  trend='<div class="freight-value"><strong>'+money(current)+'</strong><span>/ '+r.equipment+'</span></div><p class="freight-change '+(change<0?'price-down':'')+'">'+percent(change)+' <span>vs. janela anterior</span></p><svg class="freight-sparkline" viewBox="0 0 300 80" role="img" aria-label="Evolução fictícia de '+money(values[0])+' a '+money(current)+' em '+values.length+' janelas; detalhes ao abrir a rota."><polyline points="'+points+'" fill="none" stroke="#474277" stroke-width="2.5" stroke-linejoin="round"/><circle cx="292" cy="'+(65-(current-low)/span*50)+'" r="4" fill="#b26c13"/></svg><div class="freight-dates"><span>'+r.windows[0].end+'/2026</span><span>'+latest.end+'/2026</span></div><small class="freight-source">'+latest.start+'–'+latest.end+'/2026 · 6 referências<br>Fonte fictícia '+r.source+' · '+r.updated+'</small>';
 }
 return '<article class="panel freight-card"><div><h3>'+r.name+'</h3><p class="freight-spec">Marítimo · '+r.equipment+' · '+r.service+'</p></div>'+trend+'<a class="button secondary" href="#radar/mercado/'+r.id+'">Ver detalhes da rota →<span class="sr-only"> '+r.name+'</span></a></article>';
}
function renderFreightOverview(content) {
 $('.heading p').textContent='Como está o preço nas suas rotas preferidas.';
 const preferred=priceRoutes.filter(r=>r.preferred),added=priceRoutes.filter(r=>!r.preferred);
 content.innerHTML='<div class="section-heading freight-heading"><div><h2>Rotas preferidas</h2><p>Escolha uma rota para explorar o preço e as condições.</p></div><button class="button secondary" id="add-price-route-button">+ Adicionar rota</button></div><div class="freight-cards">'+preferred.map(priceRouteCard).join('')+'</div>'+(added.length?'<div class="section-heading freight-added"><div><h2>Adicionadas neste Radar</h2><p>Disponíveis nesta sessão.</p></div></div><div class="freight-cards">'+added.map(priceRouteCard).join('')+'</div>':'')+'<div class="freight-footnote"><p>Valores e preferências fictícios. Referências de frete internacional em USD, sem taxas locais, seguro, coleta ou entrega. Variação compara as duas últimas janelas de cada rota; não é previsão nem oferta para contratação.</p><button class="link" data-coverage>Fontes e dados necessários</button></div>';
 $('#add-price-route-button').onclick=addPriceRoute;
 wireCommon();
}
function renderPrices() {
 renderList();
 $('.heading p').textContent='Escolha uma rota e acompanhe o preço do frete.';
 $('.heading [data-universe]').remove();
 $('.universe').remove();
 $('.block-nav').classList.add('price-blocknav');
 const content=$('.content-grid');
 content.className='prices-content';
 const requested=route().split('/')[2];
 if(!requested){renderFreightOverview(content);return;}
 const selected=priceRoutes.find(r=>r.id===requested)||priceRoutes[0];
 const options=rows=>rows.map(r=>'<option value="'+r.id+'" '+(selected.id===r.id?'selected':'')+'>'+r.name+' · '+r.equipment+' · '+r.service+'</option>').join('');
 content.innerHTML='<div class="price-route-picker"><label>Rota<select id="price-route-select"><optgroup label="Rotas preferidas">'+options(priceRoutes.filter(r=>r.preferred))+'</optgroup>'+(priceRoutes.some(r=>!r.preferred)?'<optgroup label="Adicionadas neste Radar">'+options(priceRoutes.filter(r=>!r.preferred))+'</optgroup>':'')+'</select></label><button class="button secondary" id="add-price-route-button">+ Adicionar rota</button></div>'+renderPriceDetail(selected)+'<details class="review-tools"><summary>Cenários para revisão</summary><label for="price-mode">Disponibilidade da fonte fictícia</label><select id="price-mode"><option value="parcial" '+(mode!=='sem-fontes'?'selected':'')+'>Referência disponível no exemplo</option><option value="sem-fontes" '+(mode==='sem-fontes'?'selected':'')+'>Sem fontes disponíveis</option></select><p>Preferências e preços fictícios. Nenhum cadastro comercial foi alterado.</p></details>';
 $('#price-route-select').onchange=e=>{selectedWindow=null;location.hash='radar/mercado/'+e.target.value;};
 content.insertAdjacentHTML('afterbegin','<a class="link freight-back" href="#radar/mercado">← Visão geral de fretes</a>');
 $('#add-price-route-button').onclick=addPriceRoute;
 $('#price-mode').onchange=e=>{mode=e.target.value;renderPrices();};
 document.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>{pricePeriod=Number(b.dataset.period);selectedWindow=null;renderPrices();document.querySelector('[data-period="'+pricePeriod+'"]').focus({preventScroll:true});});
 document.querySelectorAll('[data-window]').forEach(b=>b.onclick=()=>{selectedWindow=Number(b.dataset.window);renderPrices();document.querySelector('[data-window="'+selectedWindow+'"]').focus({preventScroll:true});});
 const needLink=$('.price-next a[href="#sinal/c1"]');
 if(needLink&&!eligible().some(s=>s.id==='c1'))needLink.onclick=e=>{e.preventDefault();handoff('Inteligência · cenário relacionado',signals.find(s=>s.id==='c1'));};
 if($('#price-source'))$('#price-source').onclick=()=>priceSource(selected,selectedWindow==null?selected.windows.slice(-pricePeriod).length-1:selectedWindow);
 if(entity(selected.id))$('#price-route-connection').onclick=()=>handoff('Inteligência · Rotas e locais',null,selected.id);
 else $('#price-route-connection').remove();
 $('#price-quote-connection').onclick=()=>{handoff('Minhas Cotações · revisão',{title:'Avaliar condição em '+selected.name,entityLabel:selected.name,entities:entity(selected.id)?[selected.id,...(selected.need?[selected.need]:[])]:[],source:selected.source||(selected.own.length?'Registros próprios da Atlas · fictícios':'Sem fonte vinculada'),date:selected.updated||'Corte em 13/09/2026; sem referência atual',next:'Confirmar oferta para '+selected.name+', '+selected.equipment+', '+selected.service+', frete marítimo em USD; prontidão e prazo útil. Nenhuma solicitação foi criada.'});$('#return-signal').textContent='Voltar aos preços';};
 if(!selected.own.length)$('.own-prices').innerHTML='<div class="empty"><h3>Ainda sem propostas ou contratações nesta rota</h3><p>A rota está pronta para acompanhamento. Preços só aparecem quando houver uma fonte compatível com rota, equipamento e serviço.</p></div>';
 wireCommon();
}


window.matchMedia('(max-width:700px)').addEventListener('change',()=>{if(route().startsWith('radar/mercado'))renderPrices();});

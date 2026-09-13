'use strict';
const M = AuditModel;
const F = FreightAudit;
const P = PerformanceAudit;
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const money = (n, currency = 'USD') => n == null ? 'Não disponível' : `${currency} ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = value => value ? value.split('-').reverse().join('/') : '—';
const ref = op => op.external || op.id.startsWith('AUD-EXT-') ? op.id : `EMB-2026-${op.id}`;
const iconPaths = { home:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>', gauge:'<path d="M3 17a9 9 0 1 1 18 0M12 13l4-4"/>', file:'<path d="M14 2H6v20h12V7zM14 2v6h5M8 13h7M8 17h7"/>', ship:'<path d="M12 3v3M8 6h8v5M5 12V9h14v3M3 13l9-3 9 3-3 6M6 19l-3-6M3 21c2-2 4 2 6 0s4 2 6 0 4 2 6 0"/>', chart:'<path d="M3 3v18h18M7 16v-5M12 16V7M17 16v-8"/>', shield:'<path d="M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6"/>', settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>', search:'<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>', close:'<path d="m6 6 12 12M6 18 18 6"/>', arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>', back:'<path d="M19 12H5m5-5-5 5 5 5"/>', filter:'<path d="M4 7h16M7 12h10M10 17h4"/>' };
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name] || iconPaths.file}</svg>`;
const badge = (text, tone = '') => `<span class="tag ${tone}">${esc(text)}</span>`;
const button = (label, action, attributes = '', cls = '') => `<button class="btn ${cls}" data-action="${action}" ${attributes}>${label}</button>`;
const blankFilters = () => ({ query:'', agent:'', supplier:'', from:'', to:'', preset:'all', expanded:false, scroll:0 });
const storageKey = 'centrix-audit-review-v1';
let saved;
try { saved = JSON.parse(sessionStorage.getItem(storageKey)); } catch { saved = null; }
let operations = P.enrich(F.enrich(saved?.operations || M.seed()));
let drafts = saved?.drafts || {};
let lists = saved?.lists || { preco:blankFilters(), performance:blankFilters() };
let route, drawerContext, drawerTrigger, timer, intake = saved?.intake || {}, demoError = false;
function persist() { sessionStorage.setItem(storageKey, JSON.stringify({ operations, drafts, lists, intake })); }
function operation() { return operations.find(o => o.id === route.id); }
const detailUrl = (op, dim) => `#auditoria/${encodeURIComponent(op.id)}/${dim === 'preco' ? 'frete' : 'performance'}`;
function parseRoute() {
  const p = location.hash.slice(1).split('/');
  if (['cotacao','embarque'].includes(p[0])) return {page:'journey', journey:p[0], id:decodeURIComponent(p[1] || ''), tab:p[2] || 'frete', dim:p[3] === 'performance' ? 'performance' : 'preco'};
  if (p[0] === 'main') return { page:'list', dim:'preco' };
  if (p[1] === 'entrada') return { page:'intake', dim:['preco','performance'].includes(p[2])?p[2]:intake.dimension||route?.dim||'preco' };
  if (['preco','performance'].includes(p[1]) || !p[1]) return { page:'list', dim:p[1] || 'preco' };
  return { page:'detail', id:decodeURIComponent(p[1]), tab:['documentos','historico'].includes(p[2]) ? p[2] : p[2] === 'performance' ? 'performance' : 'frete', dim:p[2] === 'performance' || p[3] === 'performance' ? 'performance' : 'preco', panel:p[2] === 'resultado' ? 'resultado' : null };
}
function nav() {
  const base = 'https://centrix-client-portal-prototype.vercel.app/portal/';
  const items = [['Início','home','home'],['Visão Geral','gauge','visao-geral'],['Minhas Cotações','file','cotacoes'],['Meus Embarques','ship','embarques'],['Inteligência','chart','inteligencia'],['Auditoria','shield',null],['Configurações','settings','preferencias']];
  $('#sidebar').innerHTML = `<a class="brand" href="#auditoria/preco"><img class="logo" src="assets/centrix.svg" alt="Freitas Centrix"><small>Portal do Cliente</small></a><nav class="nav" aria-label="Navegação principal">${items.map(([label,i,path]) => `<a href="${path ? base+path : '#auditoria/'+(route.dim || 'preco')}" ${path ? 'target="_blank" rel="noopener" title="Abrir módulo publicado em outra aba"' : 'class="active" aria-current="page"'}>${icon(i)}${label}</a>`).join('')}</nav><div class="side-note">Conferência de valores e compromissos.<br><br>Demais módulos abrem o portal publicado.</div>`;
}
function result(op, dim = route.dim) { return dim === 'preco' ? M.financial(op) : M.operational(op); }
function status(op, dim = route.dim) {
  const r = result(op, dim);
  return ({ deviation:[dim === 'preco' ? 'Caso pronto' : 'Desvio identificado','amber'], missing:['Falta informação','blue'], pending:['Em acompanhamento','blue'], clean:[dim === 'preco' ? 'Sem divergência' : 'Sem desvio','green'], outside:['Fora do escopo',''] })[r.status];
}
function tabs(op) {
  if (op) return `<nav class="audit-tabs detail-tabs" aria-label="Detalhe da auditoria">${[['frete','Preço do frete'],['performance','Performance'],['documentos','Documentos e vínculos'],['historico','Trilha automática']].map(([tab,label]) => `<a href="${auditTabUrl(op,tab)}" class="${route.tab === tab ? 'active' : ''}" ${route.tab === tab ? 'aria-current="page"' : ''}>${label}${['frete','performance'].includes(tab) ? `<span class="tab-status">${badge(...status(op,tab === 'frete' ? 'preco' : 'performance'))}</span>` : ''}</a>`).join('')}</nav>`;
  return `<nav class="audit-tabs ${op ? 'detail-tabs' : ''}" aria-label="Tipo de auditoria">${[['preco','Preço do frete'],['performance','Performance']].map(([dim,label]) => `<a href="${op ? detailUrl(op,dim) : '#auditoria/'+dim}" class="${route.dim === dim ? 'active' : ''}" ${route.dim === dim ? 'aria-current="page"' : ''}>${label}${op ? `<span class="tab-status">${badge(...status(op,dim))}</span>` : ''}</a>`).join('')}</nav>`;
}
function render() {
  route = parseRoute();
  if ($('#drawer').open) $('#drawer').close();
  document.body.classList.remove('menu-open');
  nav();
  const op = operation();
  $('#main').innerHTML = route.page === 'intake' ? intakePage() : ['detail','journey'].includes(route.page) ? op ? route.page === 'journey' ? journeyPage(op) : detail(op) : `<div class="empty"><h1>Operação não encontrada</h1><p>O link não corresponde aos exemplos desta prévia.</p><a class="btn" href="#auditoria/preco">Voltar à Auditoria</a></div>` : overview();
  if (route.page === 'list') updateList();
  document.title = `Centrix · ${route.dim === 'performance' ? 'Performance' : 'Preço do frete'}${op ? ' · '+ref(op) : ''}`;
  if (op && route.page === 'journey') document.title = `Centrix · ${route.journey === 'cotacao' ? 'Cotação aprovada' : 'Embarque'} · ${ref(op)}`;
  if (op && route.panel) setTimeout(() => route.panel === 'resultado' ? openCommunication(op) : openSources(op, route.panel === 'historico' ? 'history' : 'all'), 0);
}
function presets() { return route.dim === 'preco' ? [['all','Todos'],['deviation','Com caso pronto'],['missing','Falta informação'],['clean','Sem divergência']] : [['all','Todos'],['deviation','Com desvio'],['missing','Falta informação'],['pending','Em acompanhamento'],['clean','Sem desvio']]; }
function overview() {
  const f = lists[route.dim];
  const optionList = (values, current) => `<option value="">Todos</option>${[...new Set(values)].sort().map(v => `<option ${v === current ? 'selected' : ''} value="${esc(v)}">${esc(v)}</option>`).join('')}`;
  return `<div class="heading"><div><h1>Auditoria</h1><p>Confira valores e compromissos das suas operações.</p></div><a class="btn" href="#auditoria/entrada/${route.dim}">Adicionar à auditoria ${icon('arrow')}</a></div>${tabs()}<p class="tab-description">${route.dim === 'preco' ? 'Compare o contratado com o faturado e prepare a contestação das diferenças.' : 'Confira prazos e condições do serviço e esclareça os desvios.'}</p><div id="summary"></div><div class="list-toolbar"><div class="presets" id="presets"></div><div class="search-tools"><label class="searchbox">${icon('search')}<input id="search" type="search" aria-label="Buscar PO, fornecedor, embarque ou agente" placeholder="PO, fornecedor, embarque ou agente" value="${esc(f.query)}"></label>${button(`${icon('filter')} Filtros`, 'filters', `id="filter-toggle" aria-expanded="${f.expanded}" aria-controls="filter-fields"`, 'small')}</div></div><div id="filter-fields" class="filter-fields" ${f.expanded ? '' : 'hidden'}><label class="field">Agente<select id="filter-agent">${optionList(operations.map(o => o.agent),f.agent)}</select></label><label class="field">Fornecedor<select id="filter-supplier">${optionList(operations.map(o => o.supplier),f.supplier)}</select></label><label class="field">Abertura a partir de<input id="filter-from" type="date" value="${esc(f.from)}"></label><label class="field">Abertura até<input id="filter-to" type="date" value="${esc(f.to)}"></label><div class="filter-note">Período pela abertura da auditoria. ${button('Limpar filtros','clear','','text small')}</div></div><div id="table-meta" class="table-meta"></div><div id="list-results"></div>`;
}
function updateList() {
  const dim = route.dim, f = lists[dim];
  const base = M.filterOperations(operations, f);
  const selected = base.filter(op => M.matches(op,dim,f.preset));
  const order = { deviation:0, missing:1, pending:2, clean:3, outside:4 };
  selected.sort((a,b) => order[result(a).status] - order[result(b).status] || b.updated.localeCompare(a.updated));
  const s = M.summary(selected,dim);
  $('#summary').innerHTML = `<div class="summary-line">${dim === 'preco' ? `<div class="summary-cell"><small>Valor para questionar</small><strong class="summary-value">${Object.entries(s.totals).length ? Object.entries(s.totals).map(([c,n]) => `<span class="currency">${money(n,c)}</span>`).join('') : '—'}</strong><small>Diferenças positivas · por moeda</small></div><div class="summary-cell"><small>Casos prontos</small><strong class="summary-value">${s.cases}</strong><small>Por cobrança e destinatário</small></div>` : `<div class="summary-cell"><small>Operações com desvio</small><strong class="summary-value">${s.deviations}</strong><small>Referência × realizado</small></div><div class="summary-cell"><small>Pedidos prontos</small><strong class="summary-value">${s.cases}</strong><small>Esclarecimentos por operação</small></div>`}<div class="summary-cell"><small>Cobertura do recorte</small><strong class="summary-value">${s.checked} <span class="muted">/ ${s.known}</span></strong><button data-action="coverage">${dim === 'preco' ? 'Cobranças com valores disponíveis' : 'Operações com verificação concluída'} · ver base</button></div></div>`;
  $('#presets').innerHTML = presets().map(([key,label]) => `<button class="preset ${f.preset === key ? 'active' : ''}" id="preset-${key}" data-action="preset" data-preset="${key}" aria-pressed="${f.preset === key}">${label}<span>${base.filter(op => M.matches(op,dim,key)).length}</span></button>`).join('');
  $('#table-meta').innerHTML = `<span>${selected.length} ${selected.length === 1 ? 'operação' : 'operações'}${Object.entries(f).some(([k,v]) => ['query','agent','supplier','from','to'].includes(k) && v) ? ' · recorte aplicado' : ''}${f.preset !== 'all' ? ' · '+presets().find(([key]) => key === f.preset)?.[1] : ''}</span><span>Atualização da amostra: 13/09/2026</span>`;
  if (f.from && f.to && f.from > f.to) { $('#list-results').innerHTML = `<div class="empty"><h3>Revise o período</h3><p>A data inicial deve ser anterior ou igual à final.</p></div>`; return; }
  if (demoError) { $('#list-results').innerHTML = `<div class="empty"><h3>Não foi possível concluir a consulta</h3><p>Falha simulada. Fontes e resultados anteriores foram preservados.</p>${button('Tentar novamente','retry','','primary')}</div>`; return; }
  $('#list-results').innerHTML = selected.length ? `<section class="panel table-wrap"><table class="audit-table"><thead><tr><th>Fornecedor / PO</th><th>Embarque / agente</th><th>${dim === 'preco' ? 'Diferença' : 'Desvio / compromisso'}</th><th>Situação</th><th><span class="muted">Próxima ação</span></th></tr></thead><tbody>${selected.map(row).join('')}</tbody></table></section>` : `<div class="empty"><h3>${operations.length ? 'Nenhuma operação neste recorte' : 'Ainda não há operações para conferir'}</h3><p>${operations.length ? 'Ajuste a busca ou limpe os filtros para voltar à carteira.' : 'Adicione uma operação ou use um exemplo demonstrativo.'}</p>${operations.length ? button('Limpar filtros','clear','','primary') : '<a class="btn primary" href="#auditoria/entrada/${route.dim}">Adicionar à auditoria</a>'}</div>`;
}
function row(op) {
  const r = result(op), dim = route.dim;
  let value, note, action;
  if (dim === 'preco') {
    value = Object.entries(r.totals).map(([c,n]) => money(n,c)).join('<br>') || (r.complete ? 'Sem diferença' : 'Ainda não conferido');
    note = r.rulePending ? `${r.rulePending} controles com regra ou fonte pendente` : r.invoices.length > 1 ? `${r.checked.length}/${r.invoices.length} cobranças conferidas` : r.missing ? 'Fatura ou referência pendente' : 'Contratado × faturado';
    action = r.cases.length ? 'Revisar caso' : r.rulePending ? 'Ver controles' : r.missing ? 'Completar fonte' : 'Ver conferência';
  } else {
    const c = r.deviations[0];
    value = c ? `${esc(P.deltaText(c))}${r.deviations.length > 1 ? ' · +'+(r.deviations.length-1)+' controles' : ''}` : r.status === 'pending' ? 'Aguardando realizado' : r.complete ? 'Condições verificadas' : 'Referência insuficiente';
    note = c?.name || (r.status === 'pending' ? 'Previsão atual separada do compromisso' : `${r.evaluated.length}/${r.applicable?.length ?? r.checks.length} condições verificadas`);
    action = c ? 'Ver desvio' : r.status === 'missing' ? 'Completar fonte' : 'Ver conferência';
  }
  return `<tr><td><a href="${detailUrl(op,dim)}">${esc(op.supplier)}</a><small>${esc(op.po || 'PO não informada')}</small>${op.external ? '<small>Operação externa</small>' : ''}${op.entryContext ? '<small>Responsável: '+esc(op.entryContext.owner)+' · '+esc(op.entryContext.period)+'</small>' : ''}</td><td><strong>${esc(op.agent)}</strong><span class="operation-ref">${esc(ref(op))}</span><small>${esc(op.route)}</small></td><td data-label="${dim === 'preco' ? 'Diferença' : 'Desvio / compromisso'}"><span class="value">${value}</span><small>${esc(note)}</small></td><td>${badge(...status(op))}${!r.complete && r.status === 'deviation' ? '<small>Cobertura parcial</small>' : ''}</td><td><a class="btn small" href="${detailUrl(op,dim)}" aria-label="${esc(action+' · '+ref(op))}">${action} ${icon('arrow')}</a></td></tr>`;
}
function detail(op) {
  return `<nav class="breadcrumb" aria-label="Caminho"><a href="#auditoria/${route.dim}">${icon('back')} ${route.dim === 'preco' ? 'Preço do frete' : 'Performance'}</a><span>› ${esc(ref(op))}</span></nav><div class="heading"><div><h1>${esc(op.supplier)}</h1><p>${esc(op.po || 'PO não informada')} · ${esc(op.route)}</p></div>${journeyLinks(op)}</div><div class="detail-context"><span>${esc(op.agent)}</span><span>BL ${esc(op.bl||'a informar')}</span><span>Abertura ${date(op.opened)}</span><button data-action="source" data-key="reference">${esc(op.reference)}</button></div>${tabs(op)}${entryManagement(op)}${route.tab === 'documentos' ? documentsPage(op) : route.tab === 'historico' ? trailPage(op) : route.dim === 'preco' ? priceDetail(op) : performanceDetail(op)}<div class="detail-bottom"><span class="small muted">Fontes demonstrativas · revisão ${op.version} · dados não integrados</span></div>`;
}
function auditTabUrl(op, tab) { return `#auditoria/${encodeURIComponent(op.id)}/${tab}${['documentos','historico'].includes(tab) ? '/'+route.dim : ''}`; }
function journeyUrl(op, target) { return `#${target}/${encodeURIComponent(op.id)}/${route.tab || 'frete'}/${route.dim}`; }
function journeyLinks(op) {
  const internalQuote=op.entryContext?op.entryContext.quoteOrigin==='Centrix':!op.external;
  return `<div class="journey-links">${internalQuote?`<a class="btn small" href="${journeyUrl(op,'cotacao')}">${icon('file')} Ver cotação ↗</a>`:button(`${icon('file')} Referência externa`,'source','data-key="reference"','small')}<a class="btn small" href="${journeyUrl(op,'embarque')}">${icon('ship')} ${op.external?'Ver operação externa':'Ver embarque'} ↗</a></div>`;
}
function documentsPage(op) {
  const f = M.financial(op), p = M.operational(op);
  const sourceRow = (title,subtitle,key,available=true,invoiceId='') => `<div class="document-link-row"><div>${icon('file')}<div><strong>${esc(title)}</strong><small>${esc(subtitle)}</small></div></div><div>${badge(available ? 'Vinculado' : 'Falta fonte',available ? 'green' : 'blue')}${available ? button('Ver fonte','source',`data-key="${esc(key)}"`,'small') : `<a class="btn small" href="${detailUrl(op,invoiceId ? 'preco' : 'performance')}">Completar fonte</a>`}</div></div>`;
  return `<p class="tab-description">As fontes e os vínculos da operação, reunidos para conferir o caso sem perder a jornada.</p><section class="panel"><div class="panel-head"><h2>Contratação e aceite</h2></div><div class="panel-body">${sourceRow(op.reference,'Condição comercial e aceite usados nas verificações disponíveis.','reference', op.invoices.some(i => i.reference) || op.checks.some(c => c.original))}</div></section><section class="panel gap"><div class="panel-head"><h2>Cobranças e documentos financeiros</h2><span class="small muted">${f.checked.length}/${f.invoices.length} conferidas</span></div><div class="panel-body">${op.invoices.length ? op.invoices.map(i => sourceRow(i.id,`${i.issuer || op.agent} · ${i.currency}${i.reference ? '' : ' · aceite pendente'}`,`invoice:${i.id}:0`,i.available,i.id)).join('') : '<p class="small muted">Auditoria financeira fora do escopo desta operação.</p>'}</div></section>${performanceDocuments(op)}${freightDocuments(op)}<p class="small muted gap">Nesta prévia, Ver fonte abre a representação demonstrativa. Documentos originais e vínculos produtivos dependem de integração.</p>`;
}
function trailPage(op) {
  const f=M.financial(op), p=M.operational(op);
  return `<p class="tab-description">O que entrou, o que foi conferido e o que mudou — com acesso às evidências de cada conclusão.</p><section class="panel"><div class="panel-head"><h2>Trilha automática</h2><a class="btn small" href="${auditTabUrl(op,'documentos')}">Documentos e vínculos</a></div><ol class="audit-trail-list">${op.logs.map((event,index) => `<li class="trail-event ${index === op.logs.length-1 ? 'blue' : ''}"><details ${index === op.logs.length-1 ? 'open' : ''}><summary><span class="trail-date">${date(event.date)}</span><span><strong class="trail-title">${index === 0 ? 'Operação e fontes vinculadas' : /exportado/.test(event.text) ? 'Material exportado' : /Complemento/.test(event.text) ? 'Fonte complementada' : 'Conferência registrada'}</strong><span class="trail-description">${esc(event.text)}</span></span><span class="trail-chevron">⌄</span></summary><div class="trail-detail"><p class="small gap">${esc(event.text)}</p><div class="source-actions gap"><a class="btn small" href="${auditTabUrl(op,'documentos')}">Conferir fontes vinculadas</a></div></div></details></li>`).join('')}</ol></section><section class="panel gap"><div class="panel-head"><h2>Resultado atual da conferência</h2><span class="small muted">Fontes · revisão ${op.version}</span></div><div class="trail-current"><div><strong>Preço do frete</strong>${badge(...status(op,'preco'))}<p>${f.checked.length}/${f.invoices.length} cobranças conferidas. ${f.missing ? `${f.missing} com fonte pendente.` : f.rulePending ? `${f.rulePending} controles com regra ou fonte pendente.` : 'Verificações disponíveis concluídas.'}</p><a href="${detailUrl(op,'preco')}">Ver comparação financeira →</a></div><div><strong>Performance</strong>${badge(...status(op,'performance'))}<p>${p.evaluated.length}/${p.applicable?.length ?? p.checks.length} condições verificadas. ${p.deviations.length ? 'Desvio e causa permanecem separados.' : p.pending.length ? 'Marcos realizados ainda pendentes.' : 'Cobertura indicada pelas fontes disponíveis.'}</p><a href="${detailUrl(op,'performance')}">Ver comparação de performance →</a></div></div></section><p class="small muted gap">O log conserva os eventos da sessão. Exportação não significa envio, resposta ou recuperação de valor.</p>`;
}
function journeyPage(op) {
  const quote = route.journey === 'cotacao';
  const back = auditTabUrl(op,route.tab);
  const quoteIds = {'0011':'COT-2026-0001','0012':'COT-2026-0002','0010':'COT-2026-0003','0009':'COT-2026-0004','0008':'COT-2026-0005','0007':'COT-2026-0006'};
  const totals={};
  op.invoices.filter(i=>i.reference).forEach(i=>{totals[i.currency]=(totals[i.currency] || 0)+i.lines.reduce((n,l)=>n+(l.agreed || 0),0);});
  return `<nav class="breadcrumb"><a href="${back}">${icon('back')} Voltar à auditoria</a></nav><div class="heading"><div><h1>${quote ? 'Cotação aprovada' : op.external ? 'Operação externa' : 'Embarque'}${quote ? quoteIds[op.id] ? ' · '+quoteIds[op.id] : '' : ' · '+esc(ref(op))}</h1><p>${esc(op.supplier)} · ${esc(op.po || 'PO não informada')}</p></div><a class="btn" href="${back}">Retomar auditoria ${icon('arrow')}</a></div><p class="tab-description">Contexto vinculado ao mesmo caso nesta prévia. Os dados e as fontes abaixo são demonstrativos.</p><section class="panel"><div class="panel-head"><h2>${quote ? 'Condição contratada' : 'Dados do embarque'}</h2></div><div class="panel-body"><dl class="facts"><div><dt>Agente</dt><dd>${esc(op.agent)}</dd></div><div><dt>Rota</dt><dd>${esc(op.route)}</dd></div><div><dt>${quote ? 'Referência aceita' : 'Documento de transporte'}</dt><dd>${esc(quote ? op.reference : op.bl)}</dd></div>${quote ? `<div><dt>Valores na referência disponível</dt><dd>${Object.entries(totals).map(([currency,value])=>money(value,currency)).join(' · ') || 'Não informado'}<small class="muted"> · por moeda; escopo das cobranças identificadas</small></dd></div>` : `<div><dt>Vínculo da contratação</dt><dd>${esc(op.reference)}</dd></div>`}</dl></div></section>${quote ? `<section class="panel gap"><div class="panel-head"><h2>Condições preservadas</h2></div><div class="panel-body">${P.evaluate(op).checks.filter(c=>c.original).map(c=>`<div class="document-link-row"><div><div><strong>${esc(c.name)}</strong><small>Original: ${esc(P.display(c.agreed,c))}${c.change?' · vigente: '+esc(P.display(c.expected,c)):''}</small></div></div><div>${performanceButton(c)}</div></div>`).join('') || '<p>Condições de performance não vinculadas.</p>'}</div></section>` : `<section class="panel gap"><div class="panel-head"><h2>Eventos disponíveis</h2></div><ol class="chronology">${op.timeline.map(e=>`<li><time>${date(e.date)}</time><span>${esc(e.text)}</span></li>`).join('') || '<li>Sem eventos vinculados a esta operação.</li>'}</ol><div class="section-tail">Porto de destino e entrega final são marcos diferentes. Não inferir eventos ausentes.</div></section>`}<div class="detail-bottom"><a class="btn small" href="${auditTabUrl(op,'documentos')}">Documentos e vínculos</a><a class="btn small" href="${auditTabUrl(op,'historico')}">Trilha automática</a></div>`;
}
function priceDetail(op) { return freightDetail(op); }
function outside(dim) { return `<div class="empty"><h2>Auditoria de ${dim} fora do escopo</h2><p>Essa operação foi adicionada para outra dimensão. A ausência de verificação não significa conformidade.</p><a class="btn" href="#auditoria/entrada/${route.dim}">Consultar operação e fontes</a></div>`; }
function performanceDetail(op) { return performanceDetailView(op); }
function question(op) { return P.question(op); }
function toast(text) { clearTimeout(timer); $('#toast').textContent = text; $('#toast').classList.add('visible'); timer = setTimeout(() => $('#toast').classList.remove('visible'), 4000); }
function openDrawer(title, body, footer = '', context = {}) {
  const d = $('#drawer');
  if (!d.open) drawerTrigger = document.activeElement;
  drawerContext = context;
  d.innerHTML = `<div class="drawer-head"><div><div class="eyebrow">AUDITORIA</div><h2 id="dialog-title">${esc(title)}</h2></div><button class="icon-btn" aria-label="Fechar painel" data-action="close">${icon('close')}</button></div><div class="drawer-body">${body}</div>${footer ? `<div class="drawer-footer">${footer}</div>` : ''}`;
  if (!d.open) d.showModal();
  d.scrollTop = 0;
}
function closeDrawer() { $('#drawer').close(); }
$('#drawer').addEventListener('close', () => { persist(); if (drawerTrigger?.isConnected) drawerTrigger.focus({preventScroll:true}); });
function sourceText(op, key) {
  if (key.startsWith('perf:')) return P.evidence(op,key.slice(5));
  if (key.startsWith('fx:') || key.startsWith('freight-line:') || key === 'freight-context') return freightEvidenceText(op,key);
  const heading = `FONTE DEMONSTRATIVA — NÃO É DOCUMENTO ORIGINAL\n${ref(op)} · BL ${op.bl}\n${op.reference}\n`;
  if (key.startsWith('invoice:')) {
    const [,id,index] = key.split(':'); const i = op.invoices.find(x => x.id === id), l = i?.lines[Number(index)];
    return heading + (l ? `${i.id} · ${i.issuer || op.agent}\n${l.name}\nContratado: ${money(l.agreed,i.currency)}\nFaturado: ${i.available ? money(l.billed,i.currency) : 'fonte ainda ausente'}\nRegra: confrontar mesma rubrica, moeda e unidade com a versão aceita.\n${l.note || 'Nenhuma alteração aprovada adicional consta neste exemplo.'}` : 'Cobrança não localizada.');
  }
  if (key.startsWith('check:')) { const c = op.checks[Number(key.split(':')[1])]; return heading + `${c.name}\nReferência original: ${c.original ? c.agreed+' '+c.unit : 'ausente'}\n${c.estimated ? 'Previsão atual' : 'Realizado'}: ${c.actual ?? 'ausente'} ${c.unit}\nFonte: ${c.source}\n${c.note || ''}\n${op.cause || 'Nenhuma responsabilidade apurada neste exemplo.'}`; }
  return heading + `Versão de fontes desta prévia: ${op.version}\nCondição contratada e aceite preservados quando disponíveis.\nAbertura: ${date(op.opened)}\nNão há arquivos originais de cliente integrados a esta prévia. As representações servem somente à revisão da experiência.`;
}
function openSources(op, key = 'all') {
  const focused = !['all','history'].includes(key);
  const r = result(op);
  let body = `<p>${esc(ref(op))} · ${esc(op.supplier)} · ${esc(op.po)}</p><div class="intro-note">Fontes ilustrativas. Os documentos originais e os eventos de produção ainda precisam ser integrados.</div>`;
  if (focused) body += `<pre class="source-pre">${esc(sourceText(op,key))}</pre>${button('Baixar representação demonstrativa','download-source',`data-key="${esc(key)}"`,'small')}`;
  if (key !== 'history') body += `<h3>Evidências e cobertura</h3><div class="source-block"><strong>${esc(op.reference)}</strong><small>Condição aceita · versão preservada quando disponível</small>${button('Consultar referência','source','data-key="reference"','text small')}</div>${route.dim === 'preco' ? op.invoices.map(i => `<div class="source-block"><strong>${esc(i.id)} · ${esc(i.currency)}</strong><p>${i.available ? 'Fatura demonstrativa disponível' : 'Fatura ainda ausente'}${!i.reference ? ' · aceite não localizado' : ''}</p><small>Emissor: ${esc(i.issuer || op.agent)}</small>${i.available ? button('Ver exemplo de item','source',`data-key="invoice:${esc(i.id)}:0"`,'text small') : button('Completar fonte','missing',`data-invoice="${esc(i.id)}"`,'text small')}</div>`).join('') : performanceSources(op)}<p class="small muted">${route.dim === 'preco' ? `${r.checked.length}/${r.invoices.length} cobranças` : `${r.evaluated.length}/${r.applicable?.length ?? r.checks.length} condições`} verificadas. Fonte ausente não significa conformidade.</p>`;
  body += `<h3>Histórico da auditoria</h3><ol class="chronology">${op.logs.map(e => `<li><time>${date(e.date)}</time><span>${esc(e.text)}</span></li>`).join('')}</ol>`;
  openDrawer(focused ? 'Evidência da comparação' : 'Fontes e histórico',body,button('Voltar à comparação','close'),{type:'sources',opId:op.id});
}
function coverage() {
  const f = lists[route.dim], ops = M.filterOperations(operations,f).filter(o => M.matches(o,route.dim,f.preset));
  const s = M.summary(ops,route.dim);
  openDrawer('Cobertura deste recorte',`<p>Lista e indicadores usam a mesma busca, filtros e período de abertura.</p><div class="source-block"><strong>${s.checked} / ${s.known} ${route.dim === 'preco' ? 'cobranças conferidas' : 'operações com verificação concluída'}</strong><p>${route.dim === 'preco' ? 'Uma operação pode conter várias cobranças. Cada cobrança requer referência aceita e fatura comparável.' : `Todas as condições previstas precisam de referência e realizado. ${s.partial} operações têm verificações parciais; previsões não contam como realizado.`}</p></div><p>O denominador cobre apenas registros conhecidos por esta prévia, não toda a carteira real.</p>${ops.map(op => { const r = result(op); return `<div class="source-block"><a href="${detailUrl(op,route.dim)}">${esc(ref(op))} · ${esc(op.supplier)}</a><small>${route.dim === 'preco' ? `${r.checked.length}/${r.invoices.length} cobranças` : `${r.evaluated.length}/${r.applicable?.length ?? r.checks.length} condições`} · ${esc(status(op)[0])}</small></div>`; }).join('')}`,button('Fechar','close'));
}
function defaultMessage(op, dim, invoiceId) {
  if (dim === 'performance') return `Solicitamos esclarecimento sobre a operação ${ref(op)}, BL ${op.bl}, ${op.po}.\n\nReferência preservada: ${op.reference}.\n\n${question(op)}\n\nAs referências e a cronologia estão reunidas no material anexo.\n\nAgradecemos o retorno.`;
  const i=op.invoices.find(i=>i.id===invoiceId), fx=F.exchange(op,i);
  const items=i.lines.map(l=>({l,q:F.charge(l)})).filter(({q})=>q.question>0);
  return `Solicitamos revisão de ${i.id} · ${ref(op)} · BL ${op.bl} · ${op.po}.\nReferência aceita: ${op.reference}.\n\n${items.map(({l,q})=>`${l.name}: original ${money(l.agreed,i.currency)}, vigente ${money(q.expected,i.currency)}, faturado ${money(l.billed,i.currency)}; diferença ${money(q.delta,i.currency)} (${q.percent===null?'base zero; percentual não aplicável':q.percent+'%'}). Tolerância DEMO ${money(l.tolerance,i.currency)}. ${l.note||''}`).join('\n')}\n${fx.question>0?`Câmbio/PTAX: taxa esperada ${rate(fx.expectedRate)}, aplicada ${rate(op.freight.fx[i.id].appliedRate)} BRL/USD. Sobre ${money(fx.base,i.currency)}, diferença cambial de ${money(fx.delta,'BRL')}. Memória, data, spread e convenção anexos.`:''}\n\nPedimos retificação ou condição aprovada que justifique as diferenças acima. Demais controles pendentes não foram concluídos e não representam divergência confirmada. Valores a menor e alterações autorizadas não integram este pedido.\n\nMaterial DEMO; nenhum envio realizado.`;
}
function attachments(op,dim,id) {
  return dim==='preco' ? [{key:'reference',name:'Referência aceita e vínculo'},{key:'freight-context',name:'Contexto e cobertura'},...op.invoices.find(i=>i.id===id).lines.map((l,n)=>({key:`freight-line:${id}:${n}`,name:`${id} · ${l.name}`})),{key:`fx:${id}`,name:`${id} · regra cambial e PTAX`}] : [{key:'reference',name:'Compromisso original'},...P.evaluate(op).deviations.map(c=>({key:`perf:${c.id}`,name:c.name}))];
}
function draftFor(op, dim, id) {
  const key = `${op.id}:${dim}:${id || 'operacional'}`;
  if (!drafts[key]) { const i = op.invoices.find(i => i.id === id); drafts[key] = { key, version:op.version, recipient: dim === 'preco' ? i?.recipient || '' : op.operationalRecipient, subject:`${dim === 'preco' ? 'Revisão de cobrança '+id : 'Esclarecimento de performance'} | ${ref(op)}`, message:defaultMessage(op,dim,id), attachments:attachments(op,dim,id).map(a => a.key), exported:false, previousMessage:null }; }
  return drafts[key];
}
function openCommunication(op, invoiceId) {
  const dim = route.dim, r = result(op);
  const id = dim === 'preco' ? invoiceId || r.cases[0]?.id : null;
  if (dim === 'preco' ? !r.cases.some(i => i.id === id) : !r.deviations.length) { toast('Ainda não há um caso fundamentado nesta dimensão.'); return; }
  const d = draftFor(op,dim,id), stale = d.version !== op.version;
  openDrawer(dim === 'preco' ? 'Revisar contestação' : 'Revisar pedido de esclarecimento',`<p>${esc(ref(op))} · ${esc(op.po)}${id ? ' · '+esc(id) : ''}</p><div class="intro-note">A mensagem está preparada. Revise o destinatário e o conteúdo se precisar. Nesta prévia, o material pode ser baixado; não há envio real.</div>${stale ? `<div class="status-warning">As fontes mudaram após a preparação. Seu texto foi preservado. Atualize a base antes de exportar.${button('Atualizar com as novas fontes','refresh-draft','','text small')}</div>` : ''}<label class="field">Destinatário${dim === 'preco' ? ' financeiro' : ' operacional'}<input id="draft-recipient" type="email" placeholder="nome@empresa.com" value="${esc(d.recipient)}"></label><p class="small muted">Sugestão do caso · confira a organização. Endereços .example são fictícios. Alterar aqui não modifica o cadastro.</p><label class="field">Assunto<input id="draft-subject" value="${esc(d.subject)}" maxlength="180"></label><label class="field">Mensagem<textarea id="draft-message">${esc(d.message)}</textarea></label>${d.previousMessage ? `<details><summary>Seu texto anterior, preservado</summary><pre class="source-pre">${esc(d.previousMessage)}</pre></details>` : ''}<h3>Evidências selecionadas</h3>${attachments(op,dim,id).map(a => `<label class="attachment"><input type="checkbox" data-attachment="${esc(a.key)}" ${d.attachments.includes(a.key) ? 'checked' : ''}><span>${esc(a.name)}<small>Representação demonstrativa · não é documento original</small></span></label>`).join('')}<p class="small muted">Dossiê inclui contexto e mensagem. Selecione apenas evidências pertinentes ao destinatário.</p><p id="draft-error" class="error-message" role="alert"></p><p class="communication-status" id="communication-status">${d.exported ? 'Rascunho exportado. Envio e resposta não confirmados.' : 'Rascunho preparado · não enviado.'}</p>`,`${button('Copiar mensagem','copy-draft','','small')}${button('Baixar dossiê','dossier','','small')}${button('Baixar e-mail + evidências','email','','primary')}`,{type:'communication',opId:op.id,dim,invoiceId:id,draftKey:d.key});
  persist();
}
function saveDraftField(target) {
  if (drawerContext?.type !== 'communication') return;
  const d = drafts[drawerContext.draftKey];
  if (target.id === 'draft-recipient') d.recipient = target.value;
  if (target.id === 'draft-subject') d.subject = target.value;
  if (target.id === 'draft-message') d.message = target.value;
  if (target.dataset.attachment) d.attachments = [...$('#drawer').querySelectorAll('[data-attachment]:checked')].map(el => el.dataset.attachment);
  persist();
}
function validateDraft(email = false) {
  const d = drafts[drawerContext.draftKey], op = operations.find(o => o.id === drawerContext.opId);
  let error = d.version !== op.version ? 'Atualize o caso com as novas fontes antes de exportar.' : !d.message.trim() || !d.subject.trim() ? 'Preencha assunto e mensagem.' : '';
  if (!error && email && (!d.recipient.trim() || !$('#draft-recipient').checkValidity() || /[\r\n]/.test(d.recipient+d.subject))) error = 'Informe um endereço válido para o destinatário do rascunho.';
  $('#draft-error').textContent = error;
  if (error) $('#draft-error').scrollIntoView({block:'nearest'});
  return !error;
}
function download(name, content, type) { const url = URL.createObjectURL(new Blob([content], {type})); const a = document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function b64(text) { return btoa(Array.from(new TextEncoder().encode(text), b => String.fromCharCode(b)).join('')); }
function dossierHtml(op,d) { return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Dossiê demonstrativo ${esc(ref(op))}</title><style>body{font:16px/1.6 system-ui;max-width:850px;margin:40px auto;padding:24px;color:#272b43}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;border-top:1px solid #ddd;padding-top:16px}small{color:#626880}</style><h1>${esc(d.subject)}</h1><p>PRÉVIA DEMONSTRATIVA · não é documento comercial real · nenhum envio confirmado.</p><p>${esc(ref(op))} · ${esc(op.supplier)} · ${esc(op.po)}</p><p>Destinatário sugerido: ${esc(d.recipient || 'não informado')}</p><pre>${esc(d.message)}</pre><h2>Evidências demonstrativas selecionadas</h2>${d.attachments.map(key => `<pre>${esc(sourceText(op,key))}</pre>`).join('')}<small>Fontes revisão ${d.version}. Valores questionados não representam recuperação. Exportação não equivale a envio.</small></html>`; }
function exportDraft(kind) {
  if (!validateDraft(kind === 'email')) return;
  const d = drafts[drawerContext.draftKey], op = operations.find(o => o.id === drawerContext.opId);
  const caseName = `${ref(op)}-${drawerContext.invoiceId || 'performance'}`;
  if (kind === 'dossier') download(`Dossie-${caseName}-DEMO.html`,dossierHtml(op,d),'text/html;charset=utf-8');
  else {
    const boundary = `centrix-${op.id}-${Date.now()}`;
    const part = (type,name,body) => `--${boundary}\r\nContent-Type: ${type}; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n${name ? `Content-Disposition: attachment; filename="${name}"\r\n` : ''}\r\n${b64(body).match(/.{1,76}/g)?.join('\r\n') || ''}\r\n`;
    const content = `X-Unsent: 1\r\nTo: ${d.recipient.trim()}\r\nSubject: =?UTF-8?B?${b64(d.subject)}?=\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n${part('text/plain','',d.message)}${part('text/html',`Dossie-${op.id}-DEMO.html`,dossierHtml(op,d))}${d.attachments.map((key,n) => part('text/plain',`Evidencia-${n+1}-DEMO.txt`,sourceText(op,key))).join('')}--${boundary}--\r\n`;
    download(`Rascunho-${caseName}-DEMO.eml`,content,'message/rfc822');
  }
  d.exported = true;
  op.logs.push({date:'2026-09-13',text:`${kind === 'email' ? 'Rascunho de e-mail' : 'Dossiê'} demonstrativo exportado para ${drawerContext.dim === 'preco' ? 'revisão financeira' : 'esclarecimento operacional'}. Envio não confirmado.`});
  $('#communication-status').textContent = 'Rascunho exportado. Envio e resposta não confirmados.';
  persist(); toast('Material demonstrativo baixado. Nenhum envio realizado.');
}
function missing(op, invoiceId) {
  if(route.dim === 'performance') return performanceMissing(op);
  const dim = route.dim, r = result(op);
  const missingItems = dim === 'preco' ? r.invoices.filter(i => (!invoiceId || i.id === invoiceId) && !r.checked.includes(i)).map(i => `${i.id}: ${!i.available ? 'fatura' : 'condição contratada com aceite'}`) : r.missing.map(c => `${c.name}: ${!c.original ? 'compromisso original' : 'evento realizado'}`);
  openDrawer('Completar somente a fonte pendente',`<p>${esc(ref(op))} · ${esc(op.po)}</p><div class="source-block"><strong>Informação necessária</strong><p>${missingItems.map(esc).join('<br>') || 'Fontes ainda não identificadas.'}</p></div><p>As verificações da outra dimensão permanecem disponíveis. O histórico e a versão anterior serão preservados.</p><label class="field">Arquivo para vincular<input id="complement-file" type="file" accept=".pdf,.png,.jpg,.xlsx,.csv,.eml,.txt"></label><p id="complement-file-note" class="small muted">A seleção é apenas local. Leitura automática e upload não estão integrados.</p><div class="sample-options"><strong>Revisar o fluxo com uma fonte de exemplo</strong><p class="small">O complemento abaixo usa dados demonstrativos conhecidos; não interpreta o arquivo selecionado.</p></div>`,button('Simular complemento da fonte','complement',`data-invoice="${esc(invoiceId || '')}"`,'primary'),{type:'missing',opId:op.id,dim,invoiceId});
}
function intakePage() { return entryPage(); }
function demoPanel() {
  openDrawer('Cenários de revisão',`<p>Dados demonstrativos. Os cenários não alteram o portal publicado.</p><div class="demo-options">${[['0011','preco','Diferenças financeiras','Dois itens, um caso de USD 195'],['0007','performance','Preço correto, performance divergente','Oito dias; causa não comprovada'],['0012','preco','Fatura ausente','Performance já disponível'],['0013','preco','Moedas e cobranças distintas','USD e BRL; cobertura parcial; mesma PO em outro BL'],['0013','performance','Compromisso original ausente','Sem comparação artificial pela ETA'],['0008','performance','Em acompanhamento','Previsão separada de realizado']].map(([id,dim,title,sub]) => `<a href="${detailUrl(operations.find(o => o.id === id) || {id},dim)}">${title}<small>${sub}</small></a>`).join('')}</div><div class="source-actions">${button('Simular falha da lista','demo-error','','small')}${button('Reiniciar esta prévia','reset','','small')}</div><p class="small muted gap">Reiniciar restaura apenas os dados locais desta demonstração.</p>`,button('Fechar','close'));
}
document.addEventListener('click', async event => {
  const anchor = event.target.closest('a[href^="#"]');
  if (anchor && route.page === 'list') { lists[route.dim].scroll = window.scrollY; persist(); }
  const b = event.target.closest('[data-action]'); if (!b) return;
  event.preventDefault();
  const action = b.dataset.action, op = operation();
  switch (action) {
    case 'menu': document.body.classList.toggle('menu-open'); break;
    case 'close': closeDrawer(); break;
    case 'filters': lists[route.dim].expanded = !lists[route.dim].expanded; $('#filter-fields').hidden = !lists[route.dim].expanded; b.setAttribute('aria-expanded',String(lists[route.dim].expanded)); persist(); break;
    case 'preset': lists[route.dim].preset = b.dataset.preset; updateList(); $('#preset-'+b.dataset.preset).focus({preventScroll:true}); persist(); break;
    case 'clear': lists[route.dim] = blankFilters(); persist(); render(); $('#search')?.focus({preventScroll:true}); break;
    case 'coverage': coverage(); break;
    case 'sources': openSources(op); break;
    case 'source': openSources(op,b.dataset.key); break;
    case 'communication': openCommunication(op,b.dataset.invoice); break;
    case 'missing': missing(op,b.dataset.invoice); break;
    case 'download-source': download(`Fonte-${op.id}-DEMO.txt`,sourceText(op,b.dataset.key),'text/plain;charset=utf-8'); toast('Representação demonstrativa baixada.'); break;
    case 'complement': {
      const ctx = {...drawerContext};
      M.complement(op,ctx.dim,ctx.invoiceId);
      persist(); render(); toast('Fonte de exemplo vinculada. Histórico preservado; confira o resultado.'); break;
    }
    case 'refresh-draft': {
      const ctx = {...drawerContext}, d = drafts[ctx.draftKey]; d.previousMessage = d.message; d.message = defaultMessage(op,ctx.dim,ctx.invoiceId); d.version = op.version; d.attachments = attachments(op,ctx.dim,ctx.invoiceId).map(a=>a.key); d.exported = false; persist(); openCommunication(op,ctx.invoiceId); break;
    }
    case 'copy-draft': if (validateDraft()) { try { await navigator.clipboard.writeText(drafts[drawerContext.draftKey].message); toast('Mensagem copiada.'); } catch { $('#draft-message').select(); toast('Selecione e copie a mensagem no campo.'); } } break;
    case 'email': exportDraft('email'); break;
    case 'dossier': exportDraft('dossier'); break;
    case 'demo': demoPanel(); break;
    case 'demo-error': closeDrawer(); demoError = true; if (route.page === 'list') updateList(); else location.hash = '#auditoria/'+route.dim; break;
    case 'retry': demoError = false; updateList(); toast('Consulta refeita com os dados preservados.'); break;
    case 'reset': operations = P.enrich(F.enrich(M.seed())); drafts={}; lists={preco:blankFilters(),performance:blankFilters()}; intake={}; demoError=false; persist(); closeDrawer(); if (location.hash === '#auditoria/preco') render(); else location.hash='#auditoria/preco'; break;
  }
});
document.addEventListener('input', event => {
  const t = event.target;
  saveDraftField(t);
  if (t.id === 'search') {lists[route.dim].query=t.value; updateList(); persist();}

});
document.addEventListener('change', event => {
  const t = event.target;
  saveDraftField(t);
  if (t.id.startsWith('filter-') && t.id !== 'filter-toggle') {lists[route.dim][t.id.slice(7)] = t.value; updateList(); persist();}

  if (t.id === 'complement-file') $('#complement-file-note').textContent=`${t.files[0]?.name || 'Nenhum arquivo'} · seleção local; sem leitura, upload ou conferência automática.`;
});
window.addEventListener('hashchange', () => { const previous = route; render(); if (route.page === 'list' && previous?.page === 'detail') window.scrollTo(0,lists[route.dim].scroll || 0); else window.scrollTo(0,0); $('#main').focus({preventScroll:true}); });
persist();
render();

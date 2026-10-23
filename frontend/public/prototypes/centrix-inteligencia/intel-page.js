'use strict';
/* Inteligência personalizável (02/10/2026, feedback do Orsi): UMA página contínua,
   dois modos (Completa | Objetiva), blocos que o cliente liga e desliga como na
   Home, e uma barra de filtros global que muda TODO bloco nos dois modos.

   Este arquivo só desenha. Os números saem de intel-engine.js (puro, testado) e
   a visibilidade dos blocos de intel-layout.js (puro, testado). Usa os helpers de
   app.js (esc, money, link, panel, table, periodRange, params...) em tempo de
   chamada, por isso é carregado ANTES de app.js e não executa nada sozinho. */

const IE = window.IntelEngine, IL = window.IntelLayout, IT = window.IntelTabs, IS = window.IntelSim;
/* Completa/Objetiva escondido (23/10/2026, a confirmar com o Orsi): com a chave
   desligada a página fica sempre na Completa, inclusive para quem tinha salvo a
   Objetiva. O código dos dois modos continua inteiro; religar é trocar a chave. */
const MODE_SWITCH = typeof CLIENT_FLAGS === 'undefined' || CLIENT_FLAGS.modeSwitch !== false;
const effectiveLayout = l => (MODE_SWITCH ? l : IL.setMode(l, 'completa'));
let intelLayout = effectiveLayout((() => { try { return IL.load(localStorage); } catch { return IL.defaults(); } })());
const tableSort = new Map();       // ordenação de cada tabela de aba (dim -> {key, dir}), preservada entre renders
let reportEntity = null;           // entidade do painel de detalhe que abriu o relatório
let simSort = null;                // ordenação da tabela do Simulador, preservada entre renders
let openFilterKey = null;          // dropdown de filtro aberto, preservado entre renders
const openKpiHow = new Set();      // "Como é calculado" abertos, preservados entre renders
let customizeDraft = null;          // rascunho do "Personalizar" até Salvar
let intelViews = (() => { try { return IL.loadViews(localStorage); } catch { return []; } })();
const FILTER_KEYS = IE.FILTERS.map(f => f.key);
function saveViews(next) { intelViews = next; try { IL.saveViews(localStorage, intelViews); } catch {} }
/* "Primeiros passos" do portal: salvar ou editar uma visão conclui o passo
   "Salvar uma visão". O host (IntelligencePreview) ouve e marca. */
function notifyViewSaved() { try { if (window.parent !== window) window.parent.postMessage({ type: 'centrix:first-step', id: 'visao' }, location.origin); } catch {} }

function saveIntelLayout(next) { intelLayout = effectiveLayout(IL.normalize(next)); try { IL.save(localStorage, intelLayout); } catch {} }

/* ---------------------------------------------------------------- dados --- */
function intelScope() {
  const range = periodRange(), gf = IE.readFilters(params);
  const all = range.valid ? IE.inRange(D.operations, range) : [];
  const base = IE.applyFilters(D.operations, gf);
  const cur = range.valid ? IE.inRange(base, range) : [];
  const prev = range.valid ? IE.inRange(base, IE.previousRange(range)) : [];
  return { range, gf, all, cur, prev, active: IE.activeCount(gf) };
}

/* ------------------------------------------------------------- desenhos --- */
const pctTxt = v => (v == null ? '—' : v + '%');
function variationChip(k) {
  if (!k || k.small || !k.variation) return '';
  const v = k.variation, arrow = v.direction === 'up' ? '↑' : v.direction === 'down' ? '↓' : '→';
  // Escala de urgência: melhora verde, piora âmbar, neutro cinza. Nunca vermelho
  // aqui: vermelho é só para ação do cliente, e uma variação não é ação.
  const tone = v.tone === 'good' ? 'good' : v.tone === 'bad' ? 'warn' : 'neutral';
  return `<span class="variation ${tone}"><span aria-hidden="true">${arrow}</span> ${esc(v.text)}</span>`;
}
const smallTag = n => `<span class="sample-tag" title="Com menos de 3 embarques a variação não é mostrada">Amostra pequena (n=${n})</span>`;
function spark(series) {
  const pts = series.map((m, i) => ({ i, v: m.value })).filter(p => p.v != null);
  if (pts.length < 2) return '<svg class="spark" viewBox="0 0 100 28" aria-hidden="true"></svg>';
  const max = Math.max(...pts.map(p => p.v)), min = Math.min(...pts.map(p => p.v)), span = max - min || 1;
  const xy = pts.map(p => `${(p.i / (series.length - 1)) * 96 + 2},${24 - ((p.v - min) / span) * 20}`).join(' ');
  return `<svg class="spark" viewBox="0 0 100 28" aria-hidden="true"><polyline points="${xy}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
function kpiValue(key, k) { return k.value == null ? '—' : key === 'freight' ? money(k.value) : key === 'count' ? String(k.value) : k.value + '%'; }
/* "Chegada ao destino" = porto ou aeroporto de descarga: o escopo do Centrix vai
   da cotação até ali. O termo leva a dica em `title` e por extenso para leitor de tela. */
const destTerm = (t) => `<span class="term" title="${IE.DESTINATION_HINT}">${t}</span><span class="sr-only"> (${IE.DESTINATION_HINT.toLowerCase()})</span>`;
const KPI_LABELS = { ready: 'Prontidão no prazo', port: `${destTerm('Chegada ao destino')} no prazo`, freight: 'Frete contratado', count: 'Embarques no recorte' };
/** "ⓘ Como é calculado": fonte, fórmula, período e filtros (intel-engine.js::kpiDefinition). */
function kpiHow(key, gf) {
  const id = 'kpi-how-' + key, open = openKpiHow.has(key);
  const lines = IE.kpiDefinition(D, key, gf);
  return `<button type="button" class="kpi-how" data-action="kpi-how" data-id="${key}" aria-expanded="${open}" aria-controls="${id}"><span aria-hidden="true">ⓘ</span> Como é calculado</button><div class="kpi-how-body" id="${id}" ${open ? '' : 'hidden'}><span class="example-tag">Dado de exemplo</span><dl>${lines.map(l => `<dt>${esc(l.label)}</dt><dd>${esc(l.text)}</dd>`).join('')}</dl></div>`;
}
function kpiCard(key, s, withSpark) {
  const k = IE.kpi(D, key, s.cur, s.prev), series = withSpark ? IE.monthly(D, key, s.cur.length ? IE.applyFilters(D.operations, s.gf) : [], s.range.end) : null;
  const a = key === 'count' ? null : D.metric(key, s.cur);
  const base = key === 'count' ? `${s.cur.length} de ${s.all.length} no período` : a.m.amount ? `${a.eligible.length} de ${s.cur.length} com valor` : `${a.good} de ${a.eligible.length} elegíveis`;
  return `<article class="kpi"><span class="kpi-label">${KPI_LABELS[key]}</span><b>${kpiValue(key, k)}</b>${k.small ? smallTag(k.n) : variationChip(k)}<small>${base}</small><small class="kpi-period">No período selecionado</small>${withSpark ? spark(series) : ''}${kpiHow(key, s.gf)}</article>`;
}
function lineChart(series, keys) {
  const W = 560, H = 190, L = 34, B = 26, T = 10, R = 10, n = series[0].length;
  const x = i => L + (i / (n - 1)) * (W - L - R), y = v => T + (1 - v / 100) * (H - T - B);
  const grid = [0, 50, 100].map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}%</text>`).join('');
  const lines = keys.map(([key, , cls], s) => { const pts = series[s].map((m, i) => (m.value == null ? null : `${x(i)},${y(m.value)}`)).filter(Boolean); return `<polyline class="series ${cls}" points="${pts.join(' ')}"/>` + series[s].map((m, i) => (m.value == null ? '' : `<circle class="series ${cls}" cx="${x(i)}" cy="${y(m.value)}" r="3"><title>${keys[s][1]} · ${m.label}: ${m.value}% (n=${m.base})</title></circle>`)).join(''); }).join('');
  const labels = series[0].map((m, i) => `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${m.label}</text>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Prazo por etapa nos últimos 6 meses">${grid}${lines}${labels}</svg><div class="chart-legend">${keys.map(([, label, cls]) => `<span><i class="${cls}"></i>${label}</span>`).join('')}</div>`;
}
function barChart(series) {
  const W = 560, H = 190, L = 50, B = 26, T = 10, R = 10, n = series.length, max = Math.max(1, ...series.map(m => m.value || 0));
  const bw = (W - L - R) / n * 0.6, x = i => L + (i + 0.5) * ((W - L - R) / n), y = v => T + (1 - v / max) * (H - T - B);
  const bars = series.map((m, i) => (m.value == null ? '' : `<rect class="bar" x="${x(i) - bw / 2}" y="${y(m.value)}" width="${bw}" height="${H - B - y(m.value)}" rx="3"><title>${m.label}: ${money(m.value)} (n=${m.n})</title></rect>`)).join('');
  const labels = series.map((m, i) => `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${m.label}</text>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Frete contratado por mês">${[0, max].map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v ? Math.round(v / 1000) + 'k' : 0}</text>`).join('')}${bars}${labels}</svg>`;
}

/* --------------------------------------------------------------- blocos --- */
function blockHead(id, title, sub) { return `<div class="block-head"><div><h2 id="t-${id}">${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div></div>`; }
function heroBlock(s) {
  const k = IE.kpi(D, 'final', s.cur, s.prev), a = D.metric('final', s.cur), series = IE.monthly(D, 'final', IE.applyFilters(D.operations, s.gf), s.range.end);
  return `<section class="block hero" id="bloco-destaque" aria-labelledby="t-destaque">${blockHead('destaque', 'Entrega final no prazo', 'Entregas no destino até o compromisso final original, entre as que têm comprovante.')}<div class="hero-body"><b class="hero-number">${pctTxt(k.value)}</b><div>${k.small ? smallTag(k.n) : variationChip(k)}<small>${a.good} de ${a.eligible.length} entregas com comprovante · ${s.cur.length - a.eligible.length} ainda em curso</small></div>${spark(series)}</div><p class="chart-caption">A linha mostra a taxa mês a mês nos últimos 6 meses, pelo mês do compromisso de prontidão.</p></section>`;
}
function funnelBlock(s) {
  const f = IE.funnel(D, s.cur);
  return `<section class="block" id="bloco-funil" aria-labelledby="t-funil">${blockHead('funil', 'Onde o prazo se perde', 'A mesma carteira em três momentos: quanto chega no prazo a cada etapa.')}<ol class="funnel">${f.steps.map(st => `<li><span>${st.key === 'port' ? destTerm(st.label) : st.label}</span><div class="funnel-track"><span style="width:${st.rate || 0}%"></span></div><b>${pctTxt(st.rate)}</b><small>${st.good ?? 0} de ${st.base}</small></li>`).join('')}</ol><p class="insight-line">${f.drop ? `A maior queda é de <strong>${f.drop.from}</strong> para <strong>${f.drop.to}</strong>: −${f.drop.points} pontos.` : 'Nenhuma queda de prazo entre as etapas neste recorte.'}</p></section>`;
}
function kpisBlock(s, withSpark) {
  return `<section class="block" id="bloco-kpis" aria-label="Indicadores"><div class="kpis">${['ready', 'port', 'freight', 'count'].map(k => kpiCard(k, s, withSpark)).join('')}</div>${withSpark ? '<p class="chart-caption">Cada linha mostra o indicador mês a mês nos últimos 6 meses.</p>' : ''}</section>`;
}
function chartsBlock(s) {
  const base = IE.applyFilters(D.operations, s.gf);
  const keys = [['ready', 'Prontidão', 's1'], ['port', 'Chegada ao destino', 's2'], ['final', 'Entrega final', 's3']];
  return `<section class="block" id="bloco-graficos" aria-labelledby="t-graficos">${blockHead('graficos', 'Evolução', '')}<div class="charts"><div class="chart-card"><h3>Prazo por etapa · últimos 6 meses</h3>${lineChart(keys.map(([k]) => IE.monthly(D, k, base, s.range.end)), keys)}<p class="chart-caption">Percentual no prazo em cada etapa, por mês do compromisso de prontidão. Meses recentes ainda têm cargas em curso.</p></div><div class="chart-card"><h3>Frete por mês</h3>${barChart(IE.monthly(D, 'freight', base, s.range.end))}<p class="chart-caption">Frete internacional contratado (USD) por mês do compromisso de prontidão. Exclui taxas e trecho terrestre.</p></div></div></section>`;
}
function performanceBlock(s) {
  // Abas (23/10/2026): na Visão geral fica só a leitura por ETAPA. As tabelas de
  // Exportadores e Agentes moraram aqui e agora são as abas de mesmo nome.
  return `<section class="block" id="bloco-performance" aria-labelledby="t-performance">${blockHead('performance', 'Performance', 'Onde os tempos excedem o previsto em cada etapa da cadeia. Por parceiro e por rota, veja as abas acima.')}${stagePanel(s.cur)}</section>`;
}
function commitmentsBlock(s) {
  // Mora na aba Agentes de carga desde 23/10/2026: é o combinado com o AGENTE.
  const rows = IE.commitments(D, s.cur).sort((a, b) => (a.status === 'deviation' ? 0 : 1) - (b.status === 'deviation' ? 0 : 1)), LABEL = { deviation: 'Desvio identificado', clean: 'Sem desvio', missing: 'Falta informação' };
  const dev = rows.filter(r => r.status === 'deviation').length;
  const ctl = c => `${esc(c.name)}: ${c.actual} ${c.unit} <small>combinado ${c.agreed} ${c.unit}</small>`;
  return `<section class="block" id="bloco-compromissos" aria-labelledby="t-compromissos">${blockHead('compromissos', 'Compromissos do serviço', `Prazos e condições combinados com o agente × o realizado. ${dev} de ${rows.length} com desvio. Relatório de leitura: um desvio sozinho não atribui responsabilidade.`)}${rows.length ? table(['Exportador / PO', 'Agente / rota', 'Desvios', 'Situação'], rows.map(({ o, deviations, status }) => `<tr><td>${esc(company(o.supplier).name)}<small>${esc(o.po)} · ${esc(o.id)}</small></td><td>${esc(agent(o.agent).name)}<small>${esc(routeName(route(o.route)))}</small></td><td>${deviations.length ? deviations.map(ctl).join('<br>') : '—'}</td><td><span class="pill ${status === 'clean' ? 'good' : ''}">${LABEL[status]}</span></td></tr>`).join('')) : '<p class="muted">Nenhum embarque neste recorte.</p>'}</section>`;
}
function questionBlock(id, title, q, target) {
  return `<section class="block question" id="bloco-${id}" aria-labelledby="t-${id}"><h2 id="t-${id}">${title}</h2><div class="q-metric"><b>${esc(q.metric)}</b>${q.kpi ? (q.kpi.small ? smallTag(q.kpi.n) : variationChip(q.kpi)) : ''}</div><p class="insight-line">${esc(q.conclusion)}</p><button class="link-button" data-action="intel-details" data-id="${target}">Ver detalhes →</button></section>`;
}

/* ------------------------------------------------------------ cabeçalho --- */
/** Nas fichas (fora da visão geral) os filtros globais continuam valendo: os chips dizem isso. */
function globalFilterChips() {
  const gf = IE.readFilters(params);
  return IE.FILTERS.flatMap(f => (gf[f.key] || []).map(v => `<button class="filter-chip" data-action="gfilter-remove" data-key="${f.key}" data-value="${esc(v)}" aria-label="Remover filtro ${esc(f.label)}">${esc(f.label)}: ${esc(f.name(D, v))} ×</button>`)).join('');
}
function filterBar(s) {
  const chips = IE.FILTERS.flatMap(f => (s.gf[f.key] || []).map(v => `<button class="filter-chip" data-action="gfilter-remove" data-key="${f.key}" data-value="${esc(v)}" aria-label="Remover filtro ${esc(f.label)}: ${esc(f.name(D, v))}">${esc(f.label)}: ${esc(f.name(D, v))} ×</button>`));
  const dropdown = f => {
    // Lista e contagem da base INTEIRA (todos os períodos); desabilitada quando não
    // sobra embarque no período + outros filtros. Opção nunca some.
    const sel = s.gf[f.key] || [], opts = IE.filterOptions(D, D.operations, s.all, s.gf, f.key);
    return `<details class="fsel" data-fkey="${f.key}" ${openFilterKey === f.key ? 'open' : ''}><summary>${f.label}${sel.length ? ` <b>${sel.length}</b>` : ''}</summary><div class="fsel-menu" role="group" aria-label="${f.label}"><div class="fsel-actions"><button type="button" class="text-button" data-action="gfilter-all" data-key="${f.key}" aria-label="Selecionar todas as opções de ${f.label} com embarques no recorte">Selecionar todos</button><button type="button" class="text-button" data-action="gfilter-clear-one" data-key="${f.key}" aria-label="Limpar o filtro ${f.label}" ${sel.length ? '' : 'disabled'}>Limpar</button></div><p class="fsel-hint">Entre parênteses, embarques em toda a base.</p>${opts.map(o => `<label class="${o.disabled ? 'is-disabled' : ''}" title="${o.available} no recorte atual"><input type="checkbox" data-gfilter="${f.key}" value="${esc(o.value)}" ${o.selected ? 'checked' : ''} ${o.disabled ? 'disabled' : ''}> <span>${esc(o.label)} (${o.count})</span>${o.disabled ? '<small>0 no recorte</small>' : ''}</label>`).join('')}</div></details>`;
  };
  return `<section class="filterbar" aria-label="Filtros do relatório"><div class="filter-row">${IE.FILTERS.map(dropdown).join('')}<span class="fcount" aria-live="polite"><b>${s.cur.length}</b> de ${s.all.length} embarques</span></div>${chips.length ? `<div class="filter-chips">${chips.join('')}<button class="text-button" data-action="gfilter-clear" aria-label="Limpar todos os filtros">Limpar filtros</button>${raioX(s.gf)}</div>` : ''}${(s.gf.sku || []).length ? '<p class="note-small">Filtro de SKU: entra o embarque que contém o SKU; frete e prazos continuam sendo do embarque inteiro.</p>' : ''}</section>`;
}
/* Atalho para o Raio X do exportador: só com UM exportador marcado. Desde as abas
   (23/10/2026) o Raio X é o DETALHE da aba Exportadores, aberto em painel com o
   período e os filtros de agora; a ficha antiga continua no link do painel. */
function raioX(gf) {
  const exp = gf.exp || [];
  if (exp.length !== 1 || !company(exp[0])) return '';
  return `<span class="raio-x">${link('executivo', `Ver Raio X do exportador <span class="sr-only">${esc(company(exp[0]).name)}</span> →`, { aba: 'exportadores', sel: exp[0] })}</span>`;
}
/** A faixa "Mostrando: … · comparado com … · N embarques", logo abaixo do título. */
function periodStripLine(s) {
  const label = periodNames[params.get('period') || 'days90'] || 'Personalizado';
  return s.range.valid ? IE.periodStrip(s.range, label, s.cur.length) : 'Período inválido — revise as datas';
}
function periodBar() {
  const r = periodRange();
  return `<div class="context"><label>Período <select id="period" aria-label="Período">${Object.entries(periodNames).map(([v, t]) => `<option value="${v}" ${(params.get('period') || 'days90') === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label><span class="period-range">${r.valid ? fullDate(r.start) + ' a ' + fullDate(r.end) : 'Revise as datas'}</span>${params.get('period') === 'custom' ? action('Editar datas', 'edit-period', '', 'text-button') : ''}<span class="base">Base: compromisso de prontidão no período</span></div>${periodEditor()}`;
}
function modeSwitch() {
  return `<div class="segmented" role="radiogroup" aria-label="Modo de leitura">${IL.MODES.map(([m, label]) => `<button role="radio" aria-checked="${intelLayout.mode === m}" data-action="intel-mode" data-id="${m}">${label}</button>`).join('')}</div>`;
}

/* ESTADO DE CLIENTE NOVO (07/10/2026). Este protótipo não tem embarques reais
   ligados à Inteligência: o que aparece é sempre a fixture fictícia de data.js.
   O selo é FIXO e diz isso; quando houver embarques, os dados reais entram no
   lugar do exemplo (spec-onboarding-backend.md). */
const EXAMPLE_NOTE = '<p class="example-note"><span class="example-tag">Exemplo ilustrativo</span> Seus dados reais substituem este exemplo assim que houver embarques.</p>';

/* ---------------------------------------------------------------- abas --- */
/* Abas (23/10/2026, semanal de produto). Período e filtros ficam ACIMA das abas
   e valem para todas; a aba entra na URL (`aba=`) e nas visões salvas. Sem
   `aba`, Visão geral — é o que faz visões antigas abrirem como sempre. */
function currentTab() { return IT.readTab(params, extraTabs()); }
/** Abas fora da família do retrovisor: o Simulador (o caminho do futuro). */
function extraTabs() { return ['simulador']; }
function tabNav(tab) {
  const item = ([id, label], cls = '') => `<a href="${esc(url('executivo', { aba: id === 'geral' ? null : id, sel: null }))}" class="intel-tab${cls}${tab === id ? ' active' : ''}" data-tab="${id}" ${tab === id ? 'aria-current="page"' : ''}>${label}</a>`;
  // O passado (o que aconteceu) e o futuro (o que decidir agora) ficam em dois
  // grupos, separados por um divisor; o futuro leva o selo "Prévia".
  return `<nav class="intel-tabs" aria-label="Abas da Inteligência"><div class="intel-tabs-past" role="group" aria-label="O que aconteceu">${IT.TABS.map(t => item(t)).join('')}</div><div class="intel-tabs-future" role="group" aria-label="O que decidir agora"><span class="tabs-divider" aria-hidden="true"></span>${item(['simulador', 'Simulador <span class="preview-tag">Prévia</span>'], ' future')}</div></nav>`;
}
/* Cabeçalho ordenável: botão por coluna, `aria-sort` no th. */
function sortableHead(dim, sort) {
  return IT.COLUMNS[dim].map(([key, label]) => {
    const on = sort.key === key, dir = on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
    const arrow = on ? (sort.dir === 'asc' ? '↑' : '↓') : '↕';
    const head = /^Chegada ao destino/.test(label) ? destTerm('Chegada ao destino') + label.slice('Chegada ao destino'.length) : label;
    return `<th scope="col" aria-sort="${dir}"><button type="button" class="sort-button${on ? ' active' : ''}" data-action="tab-sort" data-dim="${dim}" data-key="${key}">${head} <span aria-hidden="true">${arrow}</span></button></th>`;
  }).join('');
}
const rateCell = m => (m.base ? `${pctTxt(m.rate)}<small>${m.good ?? 0} de ${m.base}</small>` : '—<small>sem registro</small>');
const transitCell = r => (r.transitMedian == null ? '—<small>sem saída e chegada</small>' : `${String(r.transitMedian).replace('.', ',')} dias<small>${r.transitN} com saída e chegada</small>`);
function cellOf(dim, key, r) {
  if (key === 'name') {
    const sub = dim === 'exp' ? `${esc(company(r.id)?.city || '')}` : dim === 'ag' ? (agent(r.id)?.preferred ? 'Preferido no cadastro' : '') : esc(route(r.id)?.equipment || '');
    return `<button type="button" class="row-open" data-action="entity-open" data-dim="${dim}" data-id="${esc(r.id)}"><b>${esc(r.name)}</b></button>${sub ? `<small>${sub}</small>` : ''}`;
  }
  if (key === 'country') return esc(r.country || '—');
  if (key === 'n') return `${r.n}<small>${r.share}% do recorte</small>${r.small ? smallTag(r.n) : ''}`;
  if (key === 'transitMedian') return transitCell(r);
  if (key === 'freightAvg') return r.freightAvg == null ? '—' : money(r.freightAvg);
  if (key === 'agents' || key === 'routes') return String(r[key]);
  return rateCell(r[key]);
}
function comparisonTable(dim, rows) {
  const sort = tableSort.get(dim) || IT.DEFAULT_SORT, sorted = IT.sortRows(rows, sort);
  if (!sorted.length) return '<p class="muted">Nenhum registro neste recorte.</p>';
  return `<div class="table-wrap"><table class="compare"><thead><tr>${sortableHead(dim, sort)}</tr></thead><tbody>${sorted.map(r => `<tr class="clickable" data-row-dim="${dim}" data-row-id="${esc(r.id)}">${IT.COLUMNS[dim].map(([key]) => `<td>${cellOf(dim, key, r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
const TAB_COPY = {
  exp: { plural: 'Exportadores', noun: 'exportadores', sub: 'Quem vende e embarca a mercadoria. Ordenado por volume; clique numa linha para ver o detalhe (o antigo Raio X).' },
  ag: { plural: 'Agentes de carga', noun: 'agentes', sub: 'Quem contrata e acompanha o transporte. Ordenado por volume; clique numa linha para ver uso, prazo e cobrança.' },
  rota: { plural: 'Rotas', noun: 'rotas', sub: 'Origem → destino internacional. Ordenado por volume; clique numa linha para ver agentes e SKUs da rota.' },
};
function tabSummaryRow(dim, rows, total) {
  const t = IT.tabSummary(rows, total), c = TAB_COPY[dim];
  const card = (label, value, small) => `<div class="tab-stat"><span>${label}</span><b>${value}</b>${small ? `<small>${small}</small>` : ''}</div>`;
  return `<div class="tab-stats">${card(`${c.plural} no recorte`, t.count, `${total} embarques`)}${t.top ? card('Maior participação', `${t.top.share}%`, `${esc(t.top.name)} · ${t.top.n} de ${total}`) : ''}${t.top2Share != null ? card('Os 2 maiores somam', `${t.top2Share}%`, 'dos embarques do recorte') : ''}${t.smallCount ? card('Com amostra pequena', t.smallCount, 'menos de 3 embarques') : ''}</div>`;
}
function entityTab(dim, s) {
  const rows = IT.entityRows(D, s.cur, dim), c = TAB_COPY[dim];
  let html = `<section class="block" id="aba-${dim}" aria-labelledby="t-aba-${dim}">${blockHead('aba-' + dim, c.plural, c.sub)}${tabSummaryRow(dim, rows, s.cur.length)}${comparisonTable(dim, rows)}<p class="chart-caption">Dado, não veredito: as colunas são fatos do recorte, sem nota nem ranking. Com menos de 3 embarques a linha leva “Amostra pequena”.</p></section>`;
  if (dim === 'ag') html += commitmentsBlock(s);
  if (dim === 'rota') html += `<p class="chart-caption">O preço de mercado de cada rota fica no Radar. <a class="link" href="/portal/radar" target="_top">Abrir o Radar ↗</a> · <a class="link" href="#locais">Ver locais</a></p>`;
  return html;
}

/* ------------------------------------------------------------- detalhe --- */
/* O detalhe de uma entidade (o antigo Raio X) num painel lateral; no celular,
   folha de baixo. Mesmo `<dialog>` das outras gavetas. A entidade aberta fica na
   URL (`sel=`) para o atalho do Raio X e o link compartilhado abrirem direto. */
const THIS = { exp: 'este exportador', ag: 'este agente', rota: 'esta rota' };
const FICHA = { exp: id => 'fornecedores/' + id + '/resumo', ag: id => 'agentes/' + id + '/resumo', rota: id => 'rotas/' + id + '/resumo' };
function factList(items) { return `<dl class="facts">${items.map(([k, v, small]) => `<div><dt>${k}</dt><dd>${v}${small ? `<small>${small}</small>` : ''}</dd></div>`).join('')}</dl>`; }
function skuTable(rows, withExporter) {
  if (!rows.length) return '<p class="muted">Nenhum SKU neste recorte.</p>';
  return table(['SKU', withExporter ? 'Exportador' : 'Rotas', 'Embarques'], rows.map(r => `<tr><td><b>${esc(r.sku)}</b><small>${esc(r.desc)}</small></td><td>${withExporter ? esc(r.exporters.map(id => company(id)?.name || id).join(', ')) : esc(r.routes.map(id => routeName(route(id))).join(', '))}</td><td>${r.n}${r.small ? smallTag(r.n) : ''}</td></tr>`).join(''));
}
function entityDetailHtml(dim, id, s) {
  const ops = IT.entityOps(s.cur, dim, id), row = IT.entityRows(D, s.cur, dim).find(r => r.id === id);
  const actions = `<div class="entity-actions"><button class="button" data-action="entity-filter" data-dim="${dim}" data-id="${esc(id)}">Filtrar por ${THIS[dim]}</button><button class="button secondary" data-action="entity-report" data-dim="${dim}" data-id="${esc(id)}">Preparar relatório</button>${link(FICHA[dim](id), 'Ver ficha completa →')}</div>`;
  if (!row) return actions + `<div class="empty"><h2>Sem embarques neste recorte</h2><p>Altere o período ou os filtros para ver o histórico de ${THIS[dim]}.</p></div>`;
  const facts = [
    ['Embarques', `${row.n}`, `${row.share}% do recorte${row.small ? ' · amostra pequena' : ''}`],
    ['Prontidão no prazo', pctTxt(row.ready.rate), row.ready.base ? `${row.ready.good} de ${row.ready.base}` : 'sem registro'],
    [destTerm('Chegada ao destino') + ' no prazo', pctTxt(row.port.rate), row.port.base ? `${row.port.good} de ${row.port.base}` : 'sem registro'],
    ['Entrega final no prazo', pctTxt(row.final.rate), row.final.base ? `${row.final.good} de ${row.final.base}` : 'sem registro'],
    ['Trânsito mediano', row.transitMedian == null ? '—' : String(row.transitMedian).replace('.', ',') + ' dias', `${row.transitN} com saída e chegada`],
    ['Frete médio', row.freightAvg == null ? '—' : money(row.freightAvg), 'frete internacional contratado'],
  ];
  const base = IT.entityOps(IE.applyFilters(D.operations, s.gf), dim, id);
  const keys = [['ready', 'Prontidão', 's1'], ['port', 'Chegada ao destino', 's2'], ['final', 'Entrega final', 's3']];
  const evolution = `<section class="detail-section" aria-labelledby="dt-evo"><h3 id="dt-evo">Evolução · últimos 6 meses</h3>${lineChart(keys.map(([k]) => IE.monthly(D, k, base, s.range.end)), keys)}<p class="chart-caption">Percentual no prazo por mês do compromisso de prontidão, com os filtros atuais.</p></section>`;
  let extra = '';
  if (dim === 'exp') extra = `<section class="detail-section" aria-labelledby="dt-sku"><h3 id="dt-sku">SKUs deste exportador</h3>${skuTable(IT.skuRows(D, ops), false)}<p class="chart-caption">SKU é do item: um embarque com dois SKUs conta nos dois.</p></section>`;
  if (dim === 'rota') {
    const agents = IT.sortRows(IT.entityRows(D, ops, 'ag'));
    extra = `<section class="detail-section" aria-labelledby="dt-ag"><h3 id="dt-ag">Agentes nesta rota</h3>${table(['Agente', 'Embarques', 'Trânsito mediano', 'Chegada ao destino no prazo'], agents.map(r => `<tr><td><b>${esc(r.name)}</b></td><td>${r.n}${r.small ? smallTag(r.n) : ''}</td><td>${transitCell(r)}</td><td>${rateCell(r.port)}</td></tr>`).join(''))}</section><section class="detail-section" aria-labelledby="dt-sku"><h3 id="dt-sku">SKUs nesta rota</h3>${skuTable(IT.skuRows(D, ops), true)}</section>`;
  }
  if (dim === 'ag') {
    const imp = IT.agentImpact(D, s.cur, id), devs = IE.commitments(D, ops).filter(c => c.status === 'deviation').length;
    extra = `<section class="detail-section" aria-labelledby="dt-imp"><h3 id="dt-imp">Uso e impacto</h3>${factList([
      ['Participação nos embarques', `${imp.share}%`, `${imp.n} de ${imp.total} no recorte · ${imp.routes.length} ${imp.routes.length === 1 ? 'rota' : 'rotas'}: ${esc(imp.routes.map(r => routeName(route(r))).join(', '))}`],
      ['Prazo do trânsito', imp.transitMedian == null ? '—' : String(imp.transitMedian).replace('.', ',') + ' dias (mediana)', `${imp.transitOverPlan} de ${imp.transitBase} acima do trânsito previsto na proposta`],
      ['Cotado × cobrado', imp.auditBase ? `${imp.auditDiffCount} de ${imp.auditBase}` : '—', imp.auditBase ? `conferências concluídas com diferença${imp.auditDiffUsd ? ` · ${money(imp.auditDiffUsd)} fundamentados, não recuperados` : ''}${imp.auditPending ? ` · ${imp.auditPending} em esclarecimento ou não auditados` : ''}` : 'nenhuma conferência concluída'],
      ['Compromissos do serviço', `${devs} de ${ops.length}`, 'embarques com desvio contra o combinado'],
    ])}<p class="chart-caption">Desvio observado não atribui responsabilidade ao agente.</p></section>`;
  }
  return actions + `<section class="detail-section" aria-labelledby="dt-facts"><h3 id="dt-facts">Fatos principais</h3>${factList(facts)}</section>` + evolution + extra;
}
function entitySubtitle(dim, id) {
  if (dim === 'exp') { const c = company(id); return `${c.city}, ${c.country} · Exportador · ${periodText()}`; }
  if (dim === 'ag') { const a = agent(id); return `Agente de carga · ${a.preferred ? 'Preferido no cadastro' : 'Sem preferência cadastral'} · ${periodText()}`; }
  const r = route(id); return `${r.mode} · ${r.equipment} · ${periodText()}`;
}
function openEntity(dim, id) {
  const s = intelScope();
  openDrawer(esc(IT.nameOf(D, dim, id)), esc(entitySubtitle(dim, id)), entityDetailHtml(dim, id, s));
  $('#drawer').classList.add('entity-sheet');
}
/** Depois de desenhar a Visão geral/abas: abre o detalhe pedido pela URL. */
function afterOverviewRender() {
  const sel = IT.readSelection(D, params, currentTab());
  if (sel) openEntity(sel.dim, sel.id);
}
/** Fechar o painel tira `sel` da URL sem nova navegação (e sem reabrir). */
function stripSelection() {
  if (!params.has('sel')) return;
  params.delete('sel');
  const next = '#' + pagePath + (params.toString() ? '?' + params : '');
  history.replaceState(history.state, '', location.pathname + location.search + next);
  try { if (window.parent !== window) window.parent.history.replaceState(window.parent.history.state, '', window.parent.location.pathname + window.parent.location.search + next); } catch {}
}

/* --------------------------------------------------------------- página --- */
function geralTab(s, visible) {
  if (!visible.size) return '<div class="empty"><h2>Todos os blocos estão ocultos</h2><p>Ligue um bloco em “Personalizar” ou restaure o padrão.</p><button class="button" data-action="intel-customize">Personalizar</button></div>';
  // A ORDEM vem do layout (Personalizar ou visão "Minha operação"). Destaque e
  // funil continuam lado a lado, no lugar do primeiro dos dois.
  const order = IL.visibleBlocks(intelLayout);
  let html = '';
  if (intelLayout.mode === 'completa') {
    const render1 = { kpis: () => kpisBlock(s, true), graficos: () => chartsBlock(s), performance: () => performanceBlock(s) };
    let pairDone = false;
    for (const id of order) {
      if (id === 'destaque' || id === 'funil') {
        if (pairDone) continue;
        pairDone = true;
        const top = [visible.has('destaque') && heroBlock(s), visible.has('funil') && funnelBlock(s)].filter(Boolean);
        if (top.length) html += `<div class="split ${top.length === 1 ? 'single' : ''}">${top.join('')}</div>`;
      } else if (render1[id]) html += render1[id]();
    }
  } else {
    const q = IE.questions(D, s.cur, s.prev);
    const Q = { q_prazo: ['Estou entregando no prazo?', q.prazo, 'destaque'], q_frete: ['Quanto estou pagando de frete?', q.frete, 'graficos'], q_parceiros: ['Com quem trabalho melhor?', q.parceiros, 'performance'], q_perda: ['Onde o prazo se perde?', q.perda, 'funil'] };
    let group = [];
    const flush = () => { if (group.length) html += `<div class="questions">${group.join('')}</div>`; group = []; };
    for (const id of order) {
      if (id === 'kpis') { flush(); html += kpisBlock(s, false); }
      else if (Q[id]) group.push(questionBlock(id, Q[id][0], Q[id][1], Q[id][2]));
    }
    flush();
  }
  return html;
}
/** Conteúdo das abas que não são do retrovisor (o Simulador). */
function extraTabContent(tab, s) { return tab === 'simulador' ? simulatorTab(s) : ''; }

/* ----------------------------------------------------------- simulador --- */
/* "Quero chegar até uma data. Qual rota e qual agente cabem?" Estatística sobre
   o histórico do recorte (intel-sim.js), em semanas, sem custo e sem
   recomendação. Hoje = o corte da demonstração (D.cutoff), o mesmo relógio de
   toda a página. */
const SIM_ICON = { cabe: '✓', apertado: '◐', nao_cabe: '×', small: '?' };
function simStatus(r) {
  const key = r.small ? 'small' : r.status;
  if (!key) return '—';
  return `<span class="sim-status ${key}"><span aria-hidden="true">${SIM_ICON[key]}</span> ${IS.STATUS[key].label}</span>`;
}
const daysTxt = v => String(v).replace('.', ',');
function simTable(result) {
  const sort = simSort || IS.DEFAULT_SORT, rows = IS.sortSimRows(result.rows, sort);
  const head = IS.COLUMNS.map(([key, label]) => {
    if (!key) return `<th scope="col"><span class="th-plain">${label}</span></th>`;
    const on = sort.key === key, dir = on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
    return `<th scope="col" aria-sort="${dir}"><button type="button" class="sort-button${on ? ' active' : ''}" data-action="sim-sort" data-key="${key}">${label} <span aria-hidden="true">${on ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'}</span></button></th>`;
  }).join('');
  const body = rows.map(r => {
    const hist = `${r.n} ${r.n === 1 ? 'trânsito' : 'trânsitos'}<small>${r.shipments} ${r.shipments === 1 ? 'embarque' : 'embarques'} no histórico</small>${r.small ? smallTag(r.n) : ''}`;
    const L = IS.COLUMNS.map(([, label]) => esc(label));
    if (r.small || !r.status) return `<tr><td data-label="${L[0]}"><b>${esc(r.routeName)}</b></td><td data-label="${L[1]}">${esc(r.agentName)}</td><td data-label="${L[2]}">${hist}</td><td data-label="${L[3]}">${r.small ? '—' : `${daysTxt(r.median)} · ${r.p90} dias`}</td><td data-label="${L[4]}">—</td><td data-label="${L[5]}">—</td><td data-label="${L[6]}">${simStatus(r)}</td></tr>`;
    const safe = IS.departureLabel(r.departBySafe, result.today), lim = IS.departureLabel(r.departByMedian, result.today);
    return `<tr><td data-label="${L[0]}"><b>${esc(r.routeName)}</b></td><td data-label="${L[1]}">${esc(r.agentName)}</td><td data-label="${L[2]}">${hist}</td><td data-label="${L[3]}">${daysTxt(r.median)} · ${r.p90} dias<small>folga do P90: ${r.margin} ${r.margin === 1 ? 'dia' : 'dias'}</small></td><td data-label="${L[4]}">Chegada estimada ${IS.weekWindow(r.arrivalFrom, r.arrivalTo)}</td><td data-label="${L[5]}"><span class="${safe.passed ? 'muted' : ''}">Com folga: ${safe.text}</span><small>No limite (mediana): ${lim.text}</small></td><td data-label="${L[6]}">${simStatus(r)}</td></tr>`;
  }).join('');
  // Conteúdo de cada célula num só bloco: no celular a célula vira grade rótulo | valor.
  const cells = body.replace(/(<td data-label="[^"]*">)([\s\S]*?)(<\/td>)/g, '$1<div>$2</div>$3');
  return `<div class="table-wrap sim-wrap"><table class="compare sim-table"><thead><tr>${head}</tr></thead><tbody>${cells}</tbody></table></div>`;
}
function simHow(s) {
  const open = openKpiHow.has('sim');
  const lines = IS.howCalculated(D, s.gf, periodNames[params.get('period') || 'days90'] || 'Personalizado');
  return `<button type="button" class="kpi-how" data-action="kpi-how" data-id="sim" aria-expanded="${open}" aria-controls="kpi-how-sim"><span aria-hidden="true">ⓘ</span> Como é calculado</button><div class="kpi-how-body sim-how" id="kpi-how-sim" ${open ? '' : 'hidden'}><span class="example-tag">Dado de exemplo</span><dl>${lines.map(l => `<dt>${esc(l.label)}</dt><dd>${esc(l.text)}</dd>`).join('')}</dl></div>`;
}
function simulatorTab(s) {
  const inputs = IS.readInputs(D, params), today = D.cutoff;
  const result = IS.simulate(D, s.cur, { route: inputs.route, arriveBy: inputs.arriveBy, today });
  const routes = D.routes.filter(r => IE.applyFilters(D.operations, s.gf).some(o => o.route === r.id) || r.id === inputs.route);
  const form = `<form class="sim-form" id="sim-form" onsubmit="return false"><label>Rota (origem → destino)<select id="sim-route"><option value="">Todas as rotas com histórico</option>${routes.map(r => `<option value="${r.id}" ${inputs.route === r.id ? 'selected' : ''}>${esc(routeName(r))}</option>`).join('')}</select></label><label>Quero chegar até<input id="sim-date" type="date" value="${inputs.arriveBy}" min="${IS.addDays(today, 1)}" aria-describedby="sim-today"></label><p id="sim-today" class="sim-today">Hoje na demonstração: ${fullDate(today)}. A simulação considera embarque a partir de hoje. Agente, incoterm e os outros filtros acima também valem aqui.</p></form>`;
  const c = result.counts;
  const when = result.arriveBy ? `${fullDate(result.arriveBy)} (${IS.weekLabel(result.arriveBy)}, ${result.available} ${result.available === 1 ? 'dia' : 'dias'} a partir de hoje)` : '';
  let msg = '';
  const clear = s.active ? '<button class="button secondary" data-action="gfilter-clear">Limpar filtros</button>' : '';
  if (result.state === 'past') msg = `<div class="empty sim-empty"><h3>Essa data já passou</h3><p>Hoje, nesta demonstração, é ${fullDate(today)}. Escolha uma data de chegada a partir de ${fullDate(IS.addDays(today, 1))}.</p></div>`;
  else if (result.state === 'no_date') msg = `<div class="empty sim-empty"><h3>Escolha a data desejada de chegada</h3><p>Com a data, a tabela mostra quais rotas e agentes cabem.</p></div>`;
  else if (result.state === 'no_history') msg = `<div class="empty sim-empty"><h3>Sem histórico para esta rota</h3><p>Nenhum embarque ${inputs.route ? 'nesta rota ' : ''}no período e nos filtros atuais. Sem histórico não há estimativa.</p>${clear}${inputs.route ? '<button class="button secondary" data-action="sim-all-routes">Ver todas as rotas</button>' : ''}</div>`;
  else if (result.state === 'all_small') msg = `<div class="note sim-note"><b>Amostra pequena em todos os pares.</b> Nenhum agente tem ${IS.MIN_SAMPLE} ou mais trânsitos registrados ${inputs.route ? 'nesta rota ' : ''}no período ${esc(periodNames[params.get('period') || 'days90'] || 'selecionado')}, então não há estimativa. <button class="button secondary" data-action="sim-widen">Usar o histórico de Este ano</button></div>`;
  else if (result.state === 'all_nao_cabe') msg = `<div class="note sim-note"><b>Nenhum agente cabe nesta data.</b> Embarcando hoje, a mediana mais curta deste recorte chega ${IS.weekWindow(result.earliestArrival, result.earliestArrival)}. Para caber, escolha uma data a partir dessa semana.</div>`;
  const summary = result.arriveBy && result.available > 0 && result.rows.some(r => !r.small && r.status) ? `<p class="sim-summary" role="status">Para chegar até ${esc(when)}: <b>${c.cabe}</b> ${c.cabe === 1 ? 'cabe' : 'cabem'} na data · <b>${c.apertado}</b> ${c.apertado === 1 ? 'apertado' : 'apertados'} · <b>${c.nao_cabe}</b> não ${c.nao_cabe === 1 ? 'cabe' : 'cabem'}${c.small ? ` · <b>${c.small}</b> sem estimativa (amostra pequena)` : ''}.</p>` : '';
  const showTable = result.rows.length && !['past', 'no_date', 'no_history'].includes(result.state);
  const rules = `<ul class="sim-rules">${['cabe', 'apertado', 'nao_cabe', 'small'].map(k => `<li>${simStatus({ small: k === 'small', status: k })} ${IS.STATUS[k].rule}</li>`).join('')}</ul>`;
  return `<section class="block sim" id="aba-simulador" aria-labelledby="t-sim"><div class="block-head"><div><h2 id="t-sim">Simulador de cenários <span class="preview-tag">Prévia</span></h2><p>Quero chegar até uma data. Qual rota e qual agente cabem?</p></div></div><p class="sim-disclaimer" role="note"><b>Estimativa baseada no histórico. Não é garantia de prazo.</b> O resultado sai em semanas, não em dia exato.</p>${form}${simHow(s)}${summary}${msg}${showTable ? simTable(result) : ''}${showTable ? rules : ''}<p class="chart-caption">Classificação factual sobre o trânsito registrado, sem nota nem recomendação. Ordenado por volume de embarques no histórico. Custos ficam fora desta prévia.</p></section>`;
}
function setSimParam(changes) { location.hash = url('executivo', changes); }
function intelOverview() {
  const s = intelScope(), mode = intelLayout.mode, visible = new Set(IL.visibleBlocks(intelLayout)), tab = currentTab();
  const actions = `${MODE_SWITCH && tab === 'geral' ? modeSwitch() : ''}${tab === 'geral' ? '<button class="button secondary" data-action="intel-customize">Personalizar</button>' : ''}${tab === 'simulador' ? '' : '<button class="button secondary" data-action="intel-report">Preparar relatório</button>'}`;
  let html = `<div class="heading"><div><h1 tabindex="-1">Inteligência</h1><p>${mode === 'completa' ? 'O retrato da sua operação: números principais e evolução na Visão geral; o detalhe por exportador, agente e rota nas abas.' : 'As quatro perguntas da sua operação, respondidas em uma linha cada.'}</p>${EXAMPLE_NOTE}</div><div class="actions intel-actions">${actions}</div></div><p class="period-strip" role="status" aria-live="polite">${esc(periodStripLine(s))}</p>${viewChips()}`;
  html += periodBar() + filterBar(s);
  html += `<p class="comparison-caption">${s.range.valid ? IE.comparisonCaption(s.range) : ''}${s.cur.length && s.cur.length < IE.MIN_SAMPLE ? ' ' + smallTag(s.cur.length) + ' Com menos de 3 embarques as variações não são mostradas.' : ''}</p>`;
  html += tabNav(tab);
  const extra = extraTabContent(tab, s);
  if (extra) return html + extra;
  if (!s.cur.length) {
    return html + `<div class="empty"><h2>Nenhum embarque neste recorte</h2><p>${s.active ? 'Os filtros escolhidos não têm embarques no período.' : 'Não há embarques no período escolhido.'}</p>${s.active ? '<button class="button" data-action="gfilter-clear">Limpar filtros</button>' : ''}</div>`;
  }
  if (IT.DIM_OF_TAB[tab]) return html + entityTab(IT.DIM_OF_TAB[tab], s);
  return html + geralTab(s, visible);
}

/* ------------------------------------------------------- visões salvas --- */
function viewChips() {
  if (!intelViews.length) return '';
  // Linha própria, logo abaixo do título e acima dos filtros (some sem visões).
  return `<div class="views views-row" role="group" aria-label="Minhas visões"><span class="views-label">Minhas visões</span>${intelViews.map(v => { const on = IL.isActiveView(v, params, intelLayout, FILTER_KEYS); return `<span class="view-chip ${on ? 'active' : ''}"><button data-action="view-open" data-id="${esc(v.id)}" ${on ? 'aria-current="true"' : ''}>${esc(v.name)}</button><details class="view-menu"><summary aria-label="Opções da visão ${esc(v.name)}">⋯</summary><div class="view-menu-body"><label>Nome<input data-view-name="${esc(v.id)}" value="${esc(v.name)}" maxlength="60"></label><button class="button secondary" data-action="view-rename" data-id="${esc(v.id)}">Renomear</button><button class="text-button" data-action="view-delete" data-id="${esc(v.id)}">Excluir</button></div></details></span>`; }).join('')}</div>`;
}
function openView(id) {
  const v = intelViews.find(x => x.id === id); if (!v) return;
  const r = IL.restoreView(v); saveIntelLayout(r.layout);
  const next = 'executivo' + (r.query ? '?' + r.query : '');
  if (location.hash.slice(1) === next) render(); else location.hash = next;
}

/* ---------------------------------------------------- preparar relatório --- */
const PREVIEW = '<span class="preview-tag">Prévia</span>';
function shareLink() {
  try { return top.location.origin + top.location.pathname + location.hash; } catch { return location.href; }
}
function openReportPanel(emailDone) {
  // Aberto do painel de detalhe, o relatório é DAQUELA entidade: o atalho de
  // conversa olha o filtro como se ela estivesse filtrada. O conteúdo do
  // relatório não muda (Orsi vai definir); muda só a menção a aba/entidade.
  const s = intelScope(), ctx = IE.reportContext(reportEntity ? IT.filterByEntity(s.gf, reportEntity.dim, reportEntity.id) : s.gf);
  const mention = IT.tabMention(D, currentTab(), reportEntity);
  const summary = IE.viewSummary(D, s.gf, periodNames[params.get('period') || 'days90'] || 'Personalizado', s.cur.length) + (mention ? ` · ${mention}` : '') + ` · Leitura ${intelLayout.mode === 'completa' ? 'completa' : 'objetiva'}`;
  const talk = [
    ctx.exporter ? `<a class="button" href="${esc(url('relatorios/revisao', { supplier: ctx.exporter }))}">Preparar revisão com ${esc(company(ctx.exporter).name)}</a><p class="muted small">Abre Relatórios › Revisão de exportador com este período e estes filtros.</p>` : '',
    ctx.plannedRouteAgent ? `<div class="planned"><div><b>Revisão de rota ou agente</b> <span class="pill">Planejado</span></div><p class="muted small">Comparáveis, desvios e pauta com o parceiro. Ainda sem geração nesta prévia.</p><button class="button secondary" disabled>Preparar revisão</button></div>` : '',
    ctx.hint ? '<p class="muted">Filtre por um exportador para preparar uma revisão.</p>' : '',
  ].join('');
  const email = emailDone
    ? `<div class="success" role="status"><b>Agendado (simulação)</b><p>Envio ${esc(emailDone.freq)} para ${esc(emailDone.to.join(', '))}. Nada foi enviado nesta prévia.</p></div>`
    : `<form id="report-email" class="report-form" novalidate><label>Frequência<select id="report-freq"><option value="semanal">Semanal</option><option value="mensal">Mensal</option></select></label><label>Destinatários<input id="report-to" type="text" placeholder="nome@empresa.com, outro@empresa.com" aria-describedby="report-to-error" required></label><p id="report-to-error" class="form-error" role="alert"></p><button class="button" type="submit">Agendar envio</button></form>`;
  openDrawer('Preparar relatório', esc(summary), `<p class="period-strip in-report">${esc(periodStripLine(s))}</p><p class="muted">A visão atual — período, filtros, modo e blocos — é o relatório.</p>
    <section class="report-section" aria-labelledby="rs-1"><h3 id="rs-1">Salvar como minha visão</h3>${currentTab() !== 'geral' ? `<p class="muted small">A visão guarda também a aba (${esc(IT.tabMention(D, currentTab(), null).replace('Aba ', ''))}).</p>` : ''}<form id="view-form" class="report-form"><label>Nome da visão<input id="view-name" type="text" maxlength="60" required placeholder="Ex.: Shanghai FOB"></label><button class="button" type="submit">Salvar</button></form><p class="muted small">Aparece como atalho no topo da Inteligência e restaura período, filtros, modo e blocos.</p></section>
    <section class="report-section" aria-labelledby="rs-2"><h3 id="rs-2">Levar para uma conversa</h3>${talk}<p class="small">${link('relatorios', 'Ver todos os relatórios')}</p></section>
    <section class="report-section" aria-labelledby="rs-3"><h3 id="rs-3">Receber e compartilhar</h3>
      <div class="share-item"><div><b>Enviar por e-mail</b> ${PREVIEW}</div>${email}</div>
      <div class="share-item"><div><b>Copiar link</b></div><p class="muted small">O link abre esta mesma visão, com período e filtros.</p><button class="button secondary" data-action="report-copy">Copiar link</button><input id="report-link" class="link-field" readonly value="${esc(shareLink())}" aria-label="Link desta visão"></div>
      <div class="share-item"><div><b>Baixar PDF</b> ${PREVIEW}</div><button class="button secondary" data-action="report-pdf">Baixar PDF</button></div>
    </section>`);
}

/* --------------------------------------------------------- personalizar --- */
function openCustomize() {
  customizeDraft = IL.normalize(intelLayout);
  renderCustomize();
}
function renderCustomize() {
  const mode = customizeDraft.mode, on = new Set(IL.visibleBlocks(customizeDraft));
  openDrawer('Personalizar', `Modo ${mode === 'completa' ? 'Completa' : 'Objetiva'} · escolha os blocos que aparecem`, `<p class="muted">As escolhas ficam salvas para você neste navegador. Os filtros e o período não mudam.</p><div class="cust-list">${IL.orderedBlocks(customizeDraft, mode).map(b => `<label class="cust-row"><span><b>${b.label}</b><small>${b.desc}</small></span><input type="checkbox" role="switch" data-cust="${b.id}" ${on.has(b.id) ? 'checked' : ''}></label>`).join('')}</div><div class="cust-actions"><button class="text-button" data-action="intel-cust-reset">Restaurar padrão</button><span><button class="button secondary" data-action="close">Cancelar</button> <button class="button" data-action="intel-cust-save">Salvar</button></span></div>`);
}

/* --------------------------------------------------------------- eventos --- */
function setGlobalFilters(next) {
  const q = new URLSearchParams(params); IE.writeFilters(q, next);
  const s = q.toString(); location.hash = pagePath + (s ? '?' + s : '');
}
function jumpTo(id) { const el = document.getElementById('bloco-' + id); if (el) { el.scrollIntoView({ block: 'start' }); el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); } }
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action]'); if (!b) return;
  const a = b.dataset.action, id = b.dataset.id;
  if (a === 'intel-mode') { saveIntelLayout(IL.setMode(intelLayout, id)); render(); }
  else if (a === 'intel-customize') openCustomize();
  else if (a === 'intel-cust-reset') { customizeDraft = IL.reset(customizeDraft); renderCustomize(); }
  else if (a === 'intel-cust-save') { saveIntelLayout(customizeDraft); customizeDraft = null; closeDrawer(); render(); toast('Personalização salva.'); }
  else if (a === 'gfilter-remove') { const gf = IE.readFilters(params); gf[b.dataset.key] = gf[b.dataset.key].filter(v => v !== b.dataset.value); setGlobalFilters(gf); }
  else if (a === 'gfilter-clear') { openFilterKey = null; setGlobalFilters({}); }
  else if (a === 'gfilter-all' || a === 'gfilter-clear-one') {
    const key = b.dataset.key, s = intelScope();
    const gf = a === 'gfilter-all' ? { ...s.gf, [key]: IE.selectAllValues(D, D.operations, s.all, s.gf, key) } : IE.clearFilter(s.gf, key);
    openFilterKey = key; setGlobalFilters(gf);
  }
  else if (a === 'kpi-how') {
    const open = b.getAttribute('aria-expanded') !== 'true';
    if (open) openKpiHow.add(id); else openKpiHow.delete(id);
    b.setAttribute('aria-expanded', String(open));
    document.getElementById(b.getAttribute('aria-controls')).hidden = !open;
  }
  else if (a === 'intel-jump') { e.preventDefault(); jumpTo(id); }
  else if (a === 'intel-report') { reportEntity = null; openReportPanel(); }
  else if (a === 'tab-sort') { const dim = b.dataset.dim; tableSort.set(dim, IT.nextSort(tableSort.get(dim) || IT.DEFAULT_SORT, b.dataset.key)); render(); document.querySelector(`[data-action="tab-sort"][data-dim="${dim}"][data-key="${b.dataset.key}"]`)?.focus(); }
  else if (a === 'entity-open') location.hash = url('executivo', { sel: b.dataset.id });
  else if (a === 'sim-sort') { simSort = IS.nextSort(simSort || IS.DEFAULT_SORT, b.dataset.key); render(); document.querySelector(`[data-action="sim-sort"][data-key="${b.dataset.key}"]`)?.focus(); }
  else if (a === 'sim-widen') setSimParam({ period: 'year', start: null, end: null });
  else if (a === 'sim-all-routes') setSimParam({ srota: null });
  else if (a === 'entity-filter') { const gf = IT.filterByEntity(IE.readFilters(params), b.dataset.dim, b.dataset.id); params.delete('sel'); setGlobalFilters(gf); toast('Filtro aplicado a todas as abas.'); }
  else if (a === 'entity-report') { reportEntity = { dim: b.dataset.dim, id: b.dataset.id }; openReportPanel(); }
  else if (a === 'view-open') openView(id);
  else if (a === 'view-rename') { const input = document.querySelector(`[data-view-name="${CSS.escape(id)}"]`); saveViews(IL.renameView(intelViews, id, input && input.value)); notifyViewSaved(); render(); toast('Visão renomeada.'); }
  else if (a === 'view-delete') { saveViews(IL.deleteView(intelViews, id)); render(); toast('Visão excluída.'); }
  else if (a === 'report-copy') {
    const link = shareLink(), field = document.getElementById('report-link');
    const done = () => toast('Link copiado.');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done, () => { field.select(); toast('Selecione e copie o link no campo.'); });
    else { field.select(); toast('Selecione e copie o link no campo.'); }
  }
  else if (a === 'report-pdf') toast('Disponível na versão final.');
  else if (a === 'intel-details') {
    // "Ver detalhes" leva à seção da Completa. Se o cliente a escondeu, ela volta
    // a aparecer: o pedido explícito vence a escolha anterior, e o toast diz isso.
    let next = IL.setMode(intelLayout, 'completa'); const hidden = !IL.visibleBlocks(next).includes(id);
    if (hidden) next = IL.setVisible(next, 'completa', id, true);
    saveIntelLayout(next); render(); requestAnimationFrame(() => jumpTo(id)); if (hidden) toast('Bloco reexibido na leitura completa.');
  }
});
// A linha inteira abre o detalhe (o botão do nome é a porta do teclado).
document.addEventListener('click', e => {
  const tr = e.target.closest('tr[data-row-dim]');
  if (!tr || e.target.closest('button, a, input, select, summary')) return;
  location.hash = url('executivo', { sel: tr.dataset.rowId });
});
// Setas trocam de aba quando o foco está na faixa (Home/End vão às pontas).
document.addEventListener('keydown', e => {
  const t = e.target.closest && e.target.closest('.intel-tab');
  if (!t || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  const all = [...document.querySelectorAll('.intel-tab')], i = all.indexOf(t);
  const next = e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length;
  e.preventDefault(); all[next].focus();
});
// O evento `close` chega depois do render; se outro painel já abriu, não mexe nele.
document.getElementById('drawer').addEventListener('close', () => { const d = document.getElementById('drawer'); if (d.open) return; d.classList.remove('entity-sheet'); stripSelection(); });
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'sim-route') { setSimParam({ srota: t.value || null }); return; }
  if (t.id === 'sim-date') { if (IS.validIso(t.value)) setSimParam({ chegada: t.value }); return; }
  if (t.dataset && t.dataset.gfilter) {
    const gf = IE.readFilters(params), key = t.dataset.gfilter, set = new Set(gf[key]);
    if (t.checked) set.add(t.value); else set.delete(t.value);
    gf[key] = [...set]; openFilterKey = key; setGlobalFilters(gf);
  } else if (t.dataset && t.dataset.cust && customizeDraft) {
    customizeDraft = IL.setVisible(customizeDraft, customizeDraft.mode, t.dataset.cust, t.checked);
  }
});
document.addEventListener('toggle', e => {
  const d = e.target; if (!d.matches || !d.matches('details.fsel')) return;
  if (d.open) { openFilterKey = d.dataset.fkey; document.querySelectorAll('details.fsel[open]').forEach(x => { if (x !== d) x.open = false; }); }
  else if (openFilterKey === d.dataset.fkey) openFilterKey = null;
}, true);
// Clique fora fecha o dropdown de filtro aberto (e abrir um painel também).
document.addEventListener('click', e => {
  if (e.target.closest('details.fsel')) return;
  document.querySelectorAll('details.fsel[open]').forEach(d => { d.open = false; });
  openFilterKey = null;
}, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && openFilterKey) { const d = document.querySelector('details.fsel[open]'); if (d) { d.open = false; d.querySelector('summary').focus(); } } });

document.addEventListener('submit', e => {
  if (e.target.id === 'view-form') {
    e.preventDefault(); const name = document.getElementById('view-name').value.trim();
    if (!name) { document.getElementById('view-name').focus(); return; }
    saveViews([...intelViews, IL.captureView(name, params, intelLayout, FILTER_KEYS)]); notifyViewSaved(); closeDrawer(); render(); toast('Visão salva.');
  } else if (e.target.id === 'report-email') {
    e.preventDefault();
    const to = document.getElementById('report-to').value.split(/[,;\s]+/).filter(Boolean), bad = to.filter(x => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
    const err = document.getElementById('report-to-error');
    if (!to.length || bad.length) { err.textContent = to.length ? `E-mail inválido: ${bad.join(', ')}` : 'Informe ao menos um destinatário.'; document.getElementById('report-to').focus(); return; }
    openReportPanel({ freq: document.getElementById('report-freq').value, to });
  }
});

/* ------------------------------------------------------------ mini-guia --- */
/* "Ver na prática" (tour do portal, parada Performance, 07/10/2026): três
   balões curtos e puláveis sobre a página de verdade. Dado, não veredito: o
   guia ensina a LER os números, não aponta o que é bom ou ruim. Diálogo modal
   (foco preso, Esc fecha); no celular vira folha de baixo, marcada como barra
   de rodapé para o botão Ajuda do portal subir acima dela. */
const GUIDE_STEPS = [
  { target: '.kpis .kpi', title: 'Como ler um indicador', body: 'Cada indicador traz três coisas: o número do recorte, a variação contra o período anterior de mesma duração e uma conclusão em uma frase. Com menos de 3 embarques aparece “Amostra pequena” e a variação some.' },
  { target: '.context', title: 'Filtros e modos', body: 'Os filtros recortam todos os blocos: dentro de um filtro vale qualquer opção marcada; entre filtros, todos juntos. Completa mostra o retrato inteiro; Objetiva, as quatro perguntas em uma linha cada.' },
  { target: '.views-row', fallback: '[data-action="intel-report"]', title: 'Minhas visões e relatório', body: '“Minha operação” já está em Minhas visões, com as rotas que você escolheu. Salve outros recortes como visão e use “Preparar relatório” para resumir e compartilhar o que está na tela.' },
];
let guideIndex = -1, guideReturnFocus = null;
function guideTarget(step) { return document.querySelector(step.target) || (step.fallback && document.querySelector(step.fallback)); }
function closeGuide() {
  document.getElementById('intel-guide')?.remove();
  document.querySelectorAll('.guide-target').forEach(el => el.classList.remove('guide-target'));
  guideIndex = -1;
  if (guideReturnFocus && guideReturnFocus.focus) guideReturnFocus.focus();
}
function showGuide(i) {
  document.getElementById('intel-guide')?.remove();
  document.querySelectorAll('.guide-target').forEach(el => el.classList.remove('guide-target'));
  guideIndex = i;
  const step = GUIDE_STEPS[i], target = guideTarget(step), sheet = window.innerWidth < 640;
  if (target) { target.classList.add('guide-target'); target.scrollIntoView({ block: 'center', behavior: 'instant' in window ? 'instant' : 'auto' }); }
  const el = document.createElement('div');
  el.id = 'intel-guide';
  el.className = 'guide' + (sheet ? ' sheet' : '');
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'guide-title'); el.setAttribute('aria-describedby', 'guide-body');
  if (sheet) el.setAttribute('data-bottom-action-bar', '');
  const last = i === GUIDE_STEPS.length - 1;
  el.innerHTML = `<p class="guide-count">${i + 1} de ${GUIDE_STEPS.length}</p><h2 id="guide-title">${esc(step.title)}</h2><p id="guide-body">${esc(step.body)}</p><div class="guide-actions"><button class="text-button" data-guide="skip">Pular</button><span>${i > 0 ? '<button class="button secondary" data-guide="back">Voltar</button> ' : ''}<button class="button" data-guide="${last ? 'done' : 'next'}">${last ? 'Concluir' : 'Próximo'}</button></span></div>`;
  document.body.appendChild(el);
  if (!sheet && target) {
    const r = target.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
    const below = r.bottom + 12 + h < window.innerHeight;
    el.style.top = Math.max(12, below ? r.bottom + 12 : r.top - h - 12) + 'px';
    el.style.left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12)) + 'px';
  }
  el.querySelector('[data-guide="next"], [data-guide="done"]').focus();
}
function openGuide() { guideReturnFocus = document.activeElement; showGuide(0); }
document.addEventListener('click', e => {
  const b = e.target.closest('[data-guide]'); if (!b) return;
  const a = b.dataset.guide;
  if (a === 'next') showGuide(guideIndex + 1); else if (a === 'back') showGuide(guideIndex - 1); else closeGuide();
});
document.addEventListener('keydown', e => {
  const g = document.getElementById('intel-guide'); if (!g) return;
  if (e.key === 'Escape') { e.preventDefault(); closeGuide(); return; }
  if (e.key !== 'Tab') return;
  const items = [...g.querySelectorAll('button')]; if (!items.length) return;
  const first = items[0], lastItem = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastItem.focus(); }
  else if (!e.shiftKey && document.activeElement === lastItem) { e.preventDefault(); first.focus(); }
  else if (!g.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
});
/* Entrada pelo portal: `?view=<id>` abre a visão e `?guide=1` abre o guia. */
document.addEventListener('DOMContentLoaded', () => {
  const q = new URLSearchParams(location.search);
  const viewId = q.get('view');
  if (viewId && intelViews.some(v => v.id === viewId)) openView(viewId);
  if (q.get('guide') === '1') setTimeout(openGuide, 350);
});

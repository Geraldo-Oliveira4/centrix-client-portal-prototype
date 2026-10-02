'use strict';
/* Inteligência personalizável (02/10/2026, feedback do Orsi): UMA página contínua,
   dois modos (Completa | Objetiva), blocos que o cliente liga e desliga como na
   Home, e uma barra de filtros global que muda TODO bloco nos dois modos.

   Este arquivo só desenha. Os números saem de intel-engine.js (puro, testado) e
   a visibilidade dos blocos de intel-layout.js (puro, testado). Usa os helpers de
   app.js (esc, money, link, panel, table, periodRange, params...) em tempo de
   chamada, por isso é carregado ANTES de app.js e não executa nada sozinho. */

const IE = window.IntelEngine, IL = window.IntelLayout;
let intelLayout = (() => { try { return IL.load(localStorage); } catch { return IL.defaults(); } })();
let openFilterKey = null;          // dropdown de filtro aberto, preservado entre renders
let customizeDraft = null;          // rascunho do "Personalizar" até Salvar

function saveIntelLayout(next) { intelLayout = IL.normalize(next); try { IL.save(localStorage, intelLayout); } catch {} }

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
const KPI_LABELS = { ready: 'Prontidão no prazo', port: 'Chegada ao porto no prazo', freight: 'Frete contratado', count: 'Embarques no recorte' };
function kpiCard(key, s, withSpark) {
  const k = IE.kpi(D, key, s.cur, s.prev), series = withSpark ? IE.monthly(D, key, s.cur.length ? IE.applyFilters(D.operations, s.gf) : [], s.range.end) : null;
  const a = key === 'count' ? null : D.metric(key, s.cur);
  const base = key === 'count' ? `${s.cur.length} de ${s.all.length} no período` : a.m.amount ? `${a.eligible.length} de ${s.cur.length} com valor` : `${a.good} de ${a.eligible.length} elegíveis`;
  return `<article class="kpi"><span class="kpi-label">${KPI_LABELS[key]}</span><b>${kpiValue(key, k)}</b>${k.small ? smallTag(k.n) : variationChip(k)}<small>${base}</small>${withSpark ? spark(series) : ''}</article>`;
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
  return `<section class="block" id="bloco-funil" aria-labelledby="t-funil">${blockHead('funil', 'Onde o prazo se perde', 'A mesma carteira em três momentos: quanto chega no prazo a cada etapa.')}<ol class="funnel">${f.steps.map(st => `<li><span>${st.label}</span><div class="funnel-track"><span style="width:${st.rate || 0}%"></span></div><b>${pctTxt(st.rate)}</b><small>${st.good ?? 0} de ${st.base}</small></li>`).join('')}</ol><p class="insight-line">${f.drop ? `A maior queda é de <strong>${f.drop.from}</strong> para <strong>${f.drop.to}</strong>: −${f.drop.points} pontos.` : 'Nenhuma queda de prazo entre as etapas neste recorte.'}</p></section>`;
}
function kpisBlock(s, withSpark) {
  return `<section class="block" id="bloco-kpis" aria-label="Indicadores"><div class="kpis">${['ready', 'port', 'freight', 'count'].map(k => kpiCard(k, s, withSpark)).join('')}</div>${withSpark ? '<p class="chart-caption">Cada linha mostra o indicador mês a mês nos últimos 6 meses.</p>' : ''}</section>`;
}
function chartsBlock(s) {
  const base = IE.applyFilters(D.operations, s.gf);
  const keys = [['ready', 'Prontidão', 's1'], ['port', 'Chegada ao porto', 's2'], ['final', 'Entrega final', 's3']];
  return `<section class="block" id="bloco-graficos" aria-labelledby="t-graficos">${blockHead('graficos', 'Evolução', '')}<div class="charts"><div class="chart-card"><h3>Prazo por etapa · últimos 6 meses</h3>${lineChart(keys.map(([k]) => IE.monthly(D, k, base, s.range.end)), keys)}<p class="chart-caption">Percentual no prazo em cada etapa, por mês do compromisso de prontidão. Meses recentes ainda têm cargas em curso.</p></div><div class="chart-card"><h3>Frete por mês</h3>${barChart(IE.monthly(D, 'freight', base, s.range.end))}<p class="chart-caption">Frete internacional contratado (USD) por mês do compromisso de prontidão. Exclui taxas e trecho terrestre.</p></div></div></section>`;
}
function rankingTable(rows, dim) {
  const first = { exp: 'Exportador', ag: 'Agente de cargas', rota: 'Rota' }[dim];
  const href = r => dim === 'exp' ? link('fornecedores/' + r.id + '/resumo', `<b>${esc(r.name)}</b>`) : dim === 'ag' ? link('agentes/' + r.id + '/resumo', `<b>${esc(r.name)}</b>`) : link('rotas/' + r.id + '/resumo', `<b>${esc(r.name)}</b>`);
  const cell = m => `${pctTxt(m.rate)}<small>${m.good ?? 0} de ${m.eligible.length}</small>`;
  return rows.length ? table([first, 'Embarques', 'Prontidão no prazo', 'Chegada ao porto no prazo', 'Frete médio'], rows.map(r => `<tr><td>${href(r)}</td><td>${r.n}${r.n < IE.MIN_SAMPLE ? ' ' + smallTag(r.n) : ''}</td><td>${cell(r.ready)}</td><td>${cell(r.port)}</td><td>${r.freightAvg == null ? '—' : money(r.freightAvg)}</td></tr>`).join('')) : '<p class="muted">Nenhum registro neste recorte.</p>';
}
function performanceBlock(s) {
  // Sem sub-abas: Etapas, Exportadores e Agentes empilhados, cada um com o seu h3.
  return `<section class="block" id="bloco-performance" aria-labelledby="t-performance">${blockHead('performance', 'Performance', 'Onde os tempos excedem o previsto e como cada parceiro entrega.')}<h3 class="sub">Etapas</h3>${stagePanel(s.cur)}<h3 class="sub">Exportadores</h3>${rankingTable(IE.ranking(D, s.cur, 'exp'), 'exp')}<h3 class="sub">Agentes de cargas</h3>${rankingTable(IE.ranking(D, s.cur, 'ag'), 'ag')}</section>`;
}
function pricesBlock(s) {
  return `<section class="block" id="bloco-precos" aria-labelledby="t-precos">${blockHead('precos', 'Preços e rotas', 'Seus percursos, a frequência e o frete médio contratado. O preço de mercado de cada rota fica no Radar.')}${rankingTable(IE.ranking(D, s.cur, 'rota'), 'rota')}<p class="chart-caption"><a class="link" href="/portal/radar" target="_top">Abrir o Radar ↗</a> · <a class="link" href="#locais">Ver locais</a></p></section>`;
}
function commitmentsBlock(s) {
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
    const sel = s.gf[f.key] || [], opts = IE.options(D, s.all, f.key);
    for (const v of sel) if (!opts.some(o => o.value === v)) opts.push({ value: v, count: 0, label: f.name(D, v) });
    return `<details class="fsel" data-fkey="${f.key}" ${openFilterKey === f.key ? 'open' : ''}><summary>${f.label}${sel.length ? ` <b>${sel.length}</b>` : ''}</summary><div class="fsel-menu" role="group" aria-label="${f.label}">${opts.length ? opts.map(o => `<label><input type="checkbox" data-gfilter="${f.key}" value="${esc(o.value)}" ${sel.includes(o.value) ? 'checked' : ''}> <span>${esc(o.label)}</span><small>${o.count}</small></label>`).join('') : '<small>Sem opções no período.</small>'}</div></details>`;
  };
  return `<section class="filterbar" aria-label="Filtros do relatório"><div class="filter-row">${IE.FILTERS.map(dropdown).join('')}<span class="fcount" aria-live="polite"><b>${s.cur.length}</b> de ${s.all.length} embarques</span></div>${chips.length ? `<div class="filter-chips">${chips.join('')}<button class="text-button" data-action="gfilter-clear">Limpar filtros</button></div>` : ''}${(s.gf.sku || []).length ? '<p class="note-small">Filtro de SKU: entra o embarque que contém o SKU; frete e prazos continuam sendo do embarque inteiro.</p>' : ''}</section>`;
}
function periodBar() {
  const r = periodRange();
  return `<div class="context"><label>Período <select id="period" aria-label="Período">${Object.entries(periodNames).map(([v, t]) => `<option value="${v}" ${(params.get('period') || 'days90') === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label><span class="period-range">${r.valid ? fullDate(r.start) + ' a ' + fullDate(r.end) : 'Revise as datas'}</span>${params.get('period') === 'custom' ? action('Editar datas', 'edit-period', '', 'text-button') : ''}<span class="base">Base: compromisso de prontidão no período</span></div>${periodEditor()}`;
}
function modeSwitch() {
  return `<div class="segmented" role="radiogroup" aria-label="Modo de leitura">${IL.MODES.map(([m, label]) => `<button role="radio" aria-checked="${intelLayout.mode === m}" data-action="intel-mode" data-id="${m}">${label}</button>`).join('')}</div>`;
}

/* --------------------------------------------------------------- página --- */
function intelOverview() {
  const s = intelScope(), mode = intelLayout.mode, visible = new Set(IL.visibleBlocks(intelLayout));
  let html = `<div class="heading"><div><h1 tabindex="-1">Inteligência</h1><p>${mode === 'completa' ? 'O retrato completo da sua operação: prazos, frete, parceiros e rotas.' : 'As quatro perguntas da sua operação, respondidas em uma linha cada.'}</p></div><div class="actions">${modeSwitch()}<button class="button secondary" data-action="intel-customize">Personalizar</button>${link('relatorios', 'Preparar relatório', {}, 'button secondary')}</div></div>`;
  html += periodBar() + filterBar(s);
  html += `<p class="comparison-caption">${s.range.valid ? IE.comparisonCaption(s.range) : ''}${s.cur.length && s.cur.length < IE.MIN_SAMPLE ? ' ' + smallTag(s.cur.length) + ' Com menos de 3 embarques as variações não são mostradas.' : ''}</p>`;
  if (mode === 'completa' && s.cur.length) {
    const anchors = [['performance', 'Performance'], ['precos', 'Preços e rotas'], ['compromissos', 'Compromissos do serviço']].filter(([id]) => visible.has(id));
    if (anchors.length) html += `<p class="anchors">Ir para: ${anchors.map(([id, l]) => `<a href="#" data-action="intel-jump" data-id="${id}">${l}</a>`).join(' · ')}</p>`;
  }
  if (!s.cur.length) {
    return html + `<div class="empty"><h2>Nenhum embarque neste recorte</h2><p>${s.active ? 'Os filtros escolhidos não têm embarques no período.' : 'Não há embarques no período escolhido.'}</p>${s.active ? '<button class="button" data-action="gfilter-clear">Limpar filtros</button>' : ''}</div>`;
  }
  if (!visible.size) return html + '<div class="empty"><h2>Todos os blocos estão ocultos</h2><p>Ligue um bloco em “Personalizar” ou restaure o padrão.</p><button class="button" data-action="intel-customize">Personalizar</button></div>';
  if (mode === 'completa') {
    const top = [visible.has('destaque') && heroBlock(s), visible.has('funil') && funnelBlock(s)].filter(Boolean);
    if (top.length) html += `<div class="split ${top.length === 1 ? 'single' : ''}">${top.join('')}</div>`;
    if (visible.has('kpis')) html += kpisBlock(s, true);
    if (visible.has('graficos')) html += chartsBlock(s);
    if (visible.has('performance')) html += performanceBlock(s);
    if (visible.has('precos')) html += pricesBlock(s);
    if (visible.has('compromissos')) html += commitmentsBlock(s);
  } else {
    const q = IE.questions(D, s.cur, s.prev);
    if (visible.has('kpis')) html += kpisBlock(s, false);
    const qs = [['q_prazo', 'Estou entregando no prazo?', q.prazo, 'destaque'], ['q_frete', 'Quanto estou pagando de frete?', q.frete, 'graficos'], ['q_parceiros', 'Com quem trabalho melhor?', q.parceiros, 'performance'], ['q_perda', 'Onde o prazo se perde?', q.perda, 'funil']].filter(([id]) => visible.has(id));
    if (qs.length) html += `<div class="questions">${qs.map(([id, t, v, target]) => questionBlock(id, t, v, target)).join('')}</div>`;
  }
  return html;
}

/* --------------------------------------------------------- personalizar --- */
function openCustomize() {
  customizeDraft = IL.normalize(intelLayout);
  renderCustomize();
}
function renderCustomize() {
  const mode = customizeDraft.mode, on = new Set(IL.visibleBlocks(customizeDraft));
  openDrawer('Personalizar', `Modo ${mode === 'completa' ? 'Completa' : 'Objetiva'} · escolha os blocos que aparecem`, `<p class="muted">As escolhas ficam salvas para você neste navegador. Os filtros e o período não mudam.</p><div class="cust-list">${IL.BLOCKS[mode].map(b => `<label class="cust-row"><span><b>${b.label}</b><small>${b.desc}</small></span><input type="checkbox" role="switch" data-cust="${b.id}" ${on.has(b.id) ? 'checked' : ''}></label>`).join('')}</div><div class="cust-actions"><button class="text-button" data-action="intel-cust-reset">Restaurar padrão</button><span><button class="button secondary" data-action="close">Cancelar</button> <button class="button" data-action="intel-cust-save">Salvar</button></span></div>`);
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
  else if (a === 'intel-jump') { e.preventDefault(); jumpTo(id); }
  else if (a === 'intel-details') {
    // "Ver detalhes" leva à seção da Completa. Se o cliente a escondeu, ela volta
    // a aparecer: o pedido explícito vence a escolha anterior, e o toast diz isso.
    let next = IL.setMode(intelLayout, 'completa'); const hidden = !IL.visibleBlocks(next).includes(id);
    if (hidden) next = IL.setVisible(next, 'completa', id, true);
    saveIntelLayout(next); render(); requestAnimationFrame(() => jumpTo(id)); if (hidden) toast('Bloco reexibido na leitura completa.');
  }
});
document.addEventListener('change', e => {
  const t = e.target;
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
document.addEventListener('keydown', e => { if (e.key === 'Escape' && openFilterKey) { const d = document.querySelector('details.fsel[open]'); if (d) { d.open = false; d.querySelector('summary').focus(); } } });

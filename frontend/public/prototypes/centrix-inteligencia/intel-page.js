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
let intelViews = (() => { try { return IL.loadViews(localStorage); } catch { return []; } })();
const FILTER_KEYS = IE.FILTERS.map(f => f.key);
function saveViews(next) { intelViews = next; try { IL.saveViews(localStorage, intelViews); } catch {} }
/* "Primeiros passos" do portal: salvar ou editar uma visão conclui o passo
   "Salvar uma visão". O host (IntelligencePreview) ouve e marca. */
function notifyViewSaved() { try { if (window.parent !== window) window.parent.postMessage({ type: 'centrix:first-step', id: 'visao' }, location.origin); } catch {} }

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
    // Lista e contagem da base INTEIRA (todos os períodos); desabilitada quando não
    // sobra embarque no período + outros filtros. Opção nunca some.
    const sel = s.gf[f.key] || [], opts = IE.filterOptions(D, D.operations, s.all, s.gf, f.key);
    return `<details class="fsel" data-fkey="${f.key}" ${openFilterKey === f.key ? 'open' : ''}><summary>${f.label}${sel.length ? ` <b>${sel.length}</b>` : ''}</summary><div class="fsel-menu" role="group" aria-label="${f.label}"><p class="fsel-hint">Entre parênteses, embarques em toda a base.</p>${opts.map(o => `<label class="${o.disabled ? 'is-disabled' : ''}" title="${o.available} no recorte atual"><input type="checkbox" data-gfilter="${f.key}" value="${esc(o.value)}" ${o.selected ? 'checked' : ''} ${o.disabled ? 'disabled' : ''}> <span>${esc(o.label)} (${o.count})</span>${o.disabled ? '<small>0 no recorte</small>' : ''}</label>`).join('')}</div></details>`;
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

/* ESTADO DE CLIENTE NOVO (07/10/2026). Este protótipo não tem embarques reais
   ligados à Inteligência: o que aparece é sempre a fixture fictícia de data.js.
   O selo é FIXO e diz isso; quando houver embarques, os dados reais entram no
   lugar do exemplo (spec-onboarding-backend.md). */
const EXAMPLE_NOTE = '<p class="example-note"><span class="example-tag">Exemplo ilustrativo</span> Seus dados reais substituem este exemplo assim que houver embarques.</p>';

/* --------------------------------------------------------------- página --- */
function intelOverview() {
  const s = intelScope(), mode = intelLayout.mode, visible = new Set(IL.visibleBlocks(intelLayout));
  let html = `<div class="heading"><div><h1 tabindex="-1">Inteligência</h1><p>${mode === 'completa' ? 'O retrato completo da sua operação: prazos, frete, parceiros e rotas.' : 'As quatro perguntas da sua operação, respondidas em uma linha cada.'}</p>${EXAMPLE_NOTE}</div><div class="actions intel-actions">${modeSwitch()}<button class="button secondary" data-action="intel-customize">Personalizar</button><button class="button secondary" data-action="intel-report">Preparar relatório</button></div></div>${viewChips()}`;
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
  // A ORDEM vem do layout (Personalizar ou visão "Minha operação"). Destaque e
  // funil continuam lado a lado, no lugar do primeiro dos dois.
  const order = IL.visibleBlocks(intelLayout);
  if (mode === 'completa') {
    const render1 = { kpis: () => kpisBlock(s, true), graficos: () => chartsBlock(s), performance: () => performanceBlock(s), precos: () => pricesBlock(s), compromissos: () => commitmentsBlock(s) };
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
  const s = intelScope(), ctx = IE.reportContext(s.gf);
  const summary = IE.viewSummary(D, s.gf, periodNames[params.get('period') || 'days90'] || 'Personalizado', s.cur.length) + ` · Leitura ${intelLayout.mode === 'completa' ? 'completa' : 'objetiva'}`;
  const talk = [
    ctx.exporter ? `<a class="button" href="${esc(url('relatorios/revisao', { supplier: ctx.exporter }))}">Preparar revisão com ${esc(company(ctx.exporter).name)}</a><p class="muted small">Abre Relatórios › Revisão de exportador com este período e estes filtros.</p>` : '',
    ctx.plannedRouteAgent ? `<div class="planned"><div><b>Revisão de rota ou agente</b> <span class="pill">Planejado</span></div><p class="muted small">Comparáveis, desvios e pauta com o parceiro. Ainda sem geração nesta prévia.</p><button class="button secondary" disabled>Preparar revisão</button></div>` : '',
    ctx.hint ? '<p class="muted">Filtre por um exportador para preparar uma revisão.</p>' : '',
  ].join('');
  const email = emailDone
    ? `<div class="success" role="status"><b>Agendado (simulação)</b><p>Envio ${esc(emailDone.freq)} para ${esc(emailDone.to.join(', '))}. Nada foi enviado nesta prévia.</p></div>`
    : `<form id="report-email" class="report-form" novalidate><label>Frequência<select id="report-freq"><option value="semanal">Semanal</option><option value="mensal">Mensal</option></select></label><label>Destinatários<input id="report-to" type="text" placeholder="nome@empresa.com, outro@empresa.com" aria-describedby="report-to-error" required></label><p id="report-to-error" class="form-error" role="alert"></p><button class="button" type="submit">Agendar envio</button></form>`;
  openDrawer('Preparar relatório', esc(summary), `<p class="muted">A visão atual — período, filtros, modo e blocos — é o relatório.</p>
    <section class="report-section" aria-labelledby="rs-1"><h3 id="rs-1">Salvar como minha visão</h3><form id="view-form" class="report-form"><label>Nome da visão<input id="view-name" type="text" maxlength="60" required placeholder="Ex.: Shanghai FOB"></label><button class="button" type="submit">Salvar</button></form><p class="muted small">Aparece como atalho no topo da Inteligência e restaura período, filtros, modo e blocos.</p></section>
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
  else if (a === 'intel-jump') { e.preventDefault(); jumpTo(id); }
  else if (a === 'intel-report') openReportPanel();
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

'use strict';
/* Inteligência v4 (revisão de 13/11/2026): cabeçalho compacto, Visão geral em
   quatro níveis de hierarquia fixa, painel "Filtros e ajustes" (filtros +
   personalização por temas e cards, como na Home), introdução de primeira
   entrada e ficha lateral nos submódulos. Os filtros globais continuam mudando
   TODO bloco, em todos os submódulos.

   Este arquivo só desenha. Os números saem de intel-engine.js (puro, testado),
   os cards visíveis de intel-personalize.js (puro, testado) e as visões salvas
   de intel-layout.js. Usa os helpers de app.js (esc, money, link, panel, table,
   periodRange, params...) em tempo de chamada, por isso é carregado ANTES de
   app.js e não executa nada sozinho. */

const IE = window.IntelEngine, IL = window.IntelLayout, IT = window.IntelTabs, IS = window.IntelSim, IP = window.IntelPersonalize, IF = window.IntelFolds;
/* v4 (13/11/2026): não há mais modos de leitura nem ordem de blocos. A Visão
   geral tem UMA hierarquia fixa e o cliente liga e desliga cards por tema
   (intel-personalize.js). `intelLayout` continua existindo só porque as visões
   salvas ainda viajam com ele (IntelLayout.captureView). */
const STORE = (() => { try { return window.localStorage; } catch { return null; } })();
let intelLayout = IL.setMode((() => { try { return IL.load(localStorage); } catch { return IL.defaults(); } })(), 'completa');
let intelPers = IP.load(STORE);      // temas e cards ligados da Visão geral
const tableSort = new Map();       // ordenação de cada tabela de aba (dim -> {key, dir}), preservada entre renders
let reportEntity = null;           // entidade do painel de detalhe que abriu o relatório
let openFilterKey = null;          // dropdown de filtro aberto, preservado entre renders
const openKpiHow = new Set();      // "Como é calculado" abertos, preservados entre renders
let persDraft = null;                // rascunho do "Personalizar a Inteligência" (painel ou introdução)
let adjustDraft = null;              // rascunho de período e filtros do painel "Filtros e ajustes"
/* Dobras recolhíveis: UMA chave por seção (intel-folds.js, puro e testado),
   preservadas entre renders. Recolher uma não mexe em outra (A2). */
let folds = IF.defaults();
const foldAttrs = id => `data-fold="${id}" ${IF.isOpen(folds, id) ? 'open' : ''}`;
let intelViews = (() => { try { return IL.loadViews(localStorage); } catch { return []; } })();
const FILTER_KEYS = IE.FILTERS.map(f => f.key);
function saveViews(next) { intelViews = next; try { IL.saveViews(localStorage, intelViews); } catch {} }
/* "Primeiros passos" do portal: salvar ou editar uma visão conclui o passo
   "Salvar uma visão". O host (IntelligencePreview) ouve e marca. */
function notifyViewSaved() { try { if (window.parent !== window) window.parent.postMessage({ type: 'centrix:first-step', id: 'visao' }, location.origin); } catch {} }

function saveIntelLayout(next) { intelLayout = IL.setMode(IL.normalize(next), 'completa'); try { IL.save(localStorage, intelLayout); } catch {} }
function saveIntelPers(next) { intelPers = IP.normalize(next); IP.save(STORE, intelPers); }

/* B6: embutida, a Inteligência pode não caber inteira na janela (zoom alto,
   janela baixa). Ao abrir um painel, uma ficha ou a introdução, o iframe se põe
   inteiro na tela, para o "Fechar" e o "Aplicar" nunca ficarem fora dela. */
function revealFrame() {
  try {
    const f = window.frameElement; if (!f) return;
    const r = f.getBoundingClientRect(), vh = window.parent.innerHeight;
    if (r.top < 0 || r.bottom > vh + 1) f.scrollIntoView({ block: 'start', behavior: 'auto' });
  } catch {}
}
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
const smallTag = (n, title = 'Com menos de 3 embarques a variação não é mostrada') => `<span class="sample-tag" title="${title}">Amostra pequena (n=${n})</span>`;
const transitSmallTag = n => smallTag(n, 'Menos de 3 trânsitos com saída e chegada neste par de rota e agente');
/* MINIGRÁFICO DE BARRAS (C1, 17/11/2026), no lugar do traço fino. Uma barra
   por subperíodo do recorte (IntelEngine.subSeries): por mês, por semana, ou
   anterior × atual. Cor neutra de um só matiz, eixo começando em zero (taxa de
   0 a 100%), barra sem registro vira um tique na linha de base. Cada barra diz
   o que é ("Jul 2026: 12 de 18") no title; a figura inteira, no aria-label. O
   rótulo e a legenda são HTML a 14px, não texto do SVG que encolhe. */
const GRAIN_TEXT = { month: 'Por mês', week: 'Por semana', compare: 'Período anterior × período atual' };
function miniBars(key, series, { compact = false, name = KPI_NAMES[key] } = {}) {
  const bars = series.bars, max = key === 'count' || key === 'freight' ? Math.max(1, ...bars.map(b => b.value || 0)) : 100;
  const desc = bars.map(b => IE.barText(key, b)).join('; ');
  const cols = bars.map(b => {
    const h = b.value == null ? 0 : Math.max(2, (b.value / max) * 100);
    return `<span class="mb-col" title="${esc(IE.barText(key, b))}"><span class="mb-bar${b.value == null ? ' none' : ''}" style="height:${h}%"></span></span>`;
  }).join('');
  const many = bars.length > 7;
  const labels = compact ? '' : `<div class="mb-labels" aria-hidden="true">${bars.map((b, i) => `<span>${!many || i === 0 || i === bars.length - 1 ? esc(b.label) : ''}</span>`).join('')}</div>`;
  const legend = compact ? '' : `<figcaption class="mb-legend">${GRAIN_TEXT[series.grain]}, dentro do período. Passe o mouse numa barra para ver a base.</figcaption>`;
  return `<figure class="mini-bars${compact ? ' compact' : ''}" style="--n:${bars.length}" role="img" aria-label="${esc(name)}, ${esc(series.legend)}: ${esc(desc)}"><div class="mb-plot">${cols}</div>${labels}${legend}</figure>`;
}
function kpiValue(key, k) { return k.value == null ? '—' : key === 'freight' ? money(k.value) : key === 'count' ? String(k.value) : k.value + '%'; }
/* "Chegada ao destino" = porto ou aeroporto de descarga: o escopo do Centrix vai
   da cotação até ali. O termo leva a dica em `title` e por extenso para leitor de tela. */
const destTerm = (t) => `<span class="term" title="${IE.DESTINATION_HINT}">${t}</span><span class="sr-only"> (${IE.DESTINATION_HINT.toLowerCase()})</span>`;
const KPI_LABELS = { ready: 'Prontidão no prazo', port: `${destTerm('Chegada ao destino')} no prazo`, freight: 'Frete contratado', count: 'Embarques no recorte' };
/* Ícones do portal (lucide, traço 1,75) embutidos: o protótipo não carrega a lib. */
const svgIcon = body => `<svg class="ico" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const ICON = {
  sliders: svgIcon('<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>'),
  info: svgIcon('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'),
};
const KPI_NAMES = { ready: 'Prontidão no prazo', port: 'Chegada ao destino no prazo', final: 'Entrega final no prazo', freight: 'Frete contratado', count: 'Embarques no recorte' };
/** "Como é calculado": um "i" discreto que abre fonte, fórmula, período e filtros (intel-engine.js::kpiDefinition). */
/* `slot` separa duas cópias do mesmo indicador na mesma tela (a Entrega final
   no número grande e na linha do funil), para os ids não colidirem. */
function kpiHowButton(key, slot = '') {
  const id = key + (slot ? '-' + slot : ''), open = openKpiHow.has(id);
  return `<button type="button" class="info-button" data-action="kpi-how" data-id="${id}" aria-expanded="${open}" aria-controls="kpi-how-${id}" aria-label="Como é calculado: ${KPI_NAMES[key]}" title="Como é calculado">${ICON.info}</button>`;
}
function kpiHowBody(key, gf, slot = '') {
  const lines = IE.kpiDefinition(D, key, gf), id = key + (slot ? '-' + slot : '');
  return `<div class="kpi-how-body" id="kpi-how-${id}" ${openKpiHow.has(id) ? '' : 'hidden'}><p class="kpi-how-title">Como é calculado · ${KPI_NAMES[key]} <span class="example-tag">Dado de exemplo</span></p><dl>${lines.filter(l => !l.notice).map(l => `<dt>${esc(l.label)}</dt><dd>${esc(l.text)}</dd>`).join('')}</dl>${lines.filter(l => l.notice).map(l => `<p class="integrated-notice">${esc(l.text)}</p>`).join('')}</div>`;
}
/** Variação curta, em pontos, com seta E sinal ("↑ +34 pts", "↓ −25 pts"): a direção nunca depende de cor; o texto completo fica no title e para leitor de tela. */
function variationPts(k) {
  if (!k || k.small || !k.variation) return '';
  const v = k.variation, arrow = v.direction === 'up' ? '↑' : v.direction === 'down' ? '↓' : '→';
  const tone = v.tone === 'good' ? 'good' : v.tone === 'bad' ? 'warn' : 'neutral', n = Math.abs(v.delta);
  return `<span class="variation ${tone}" title="${esc(v.text)}"><span aria-hidden="true">${arrow} ${v.direction === 'flat' ? 'igual' : `${v.direction === 'up' ? '+' : '−'}${n} ${n === 1 ? 'pt' : 'pts'}`}</span><span class="sr-only">${esc(v.text)}</span></span>`;
}
/* Gráficos em tela estreita (ou dentro da ficha lateral) usam um viewBox menor:
   o SVG escala inteiro, e com o viewBox largo o texto dos eixos ficaria ilegível. */
const chartNarrow = () => window.innerWidth < 600;
/* Três séries distinguíveis sem depender só da cor: traço (cheio, tracejado,
   pontilhado) e marcador (círculo, quadrado, losango) mudam junto. */
function chartMark(cls, cx, cy, title) {
  if (cls === 's2') return `<rect class="mark ${cls}" x="${cx - 3.2}" y="${cy - 3.2}" width="6.4" height="6.4">${title}</rect>`;
  if (cls === 's3') return `<path class="mark ${cls}" d="M${cx} ${cy - 4.4}L${cx + 4.4} ${cy}L${cx} ${cy + 4.4}L${cx - 4.4} ${cy}Z">${title}</path>`;
  return `<circle class="mark ${cls}" cx="${cx}" cy="${cy}" r="3.4">${title}</circle>`;
}
function lineChart(series, keys, narrow = chartNarrow()) {
  const W = narrow ? 340 : 560, H = narrow ? 200 : 190, L = 38, B = 26, T = 10, R = 12, n = series[0].length;
  const x = i => L + (i / (n - 1)) * (W - L - R), y = v => T + (1 - v / 100) * (H - T - B);
  const grid = [0, 50, 100].map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}%</text>`).join('');
  const lines = keys.map(([, label, cls], s) => { const pts = series[s].map((m, i) => (m.value == null ? null : `${x(i)},${y(m.value)}`)).filter(Boolean); return `<polyline class="series ${cls}" points="${pts.join(' ')}"/>` + series[s].map((m, i) => (m.value == null ? '' : chartMark(cls, x(i), y(m.value), `<title>${label} · ${m.label}: ${m.value}% (n=${m.base})</title>`))).join(''); }).join('');
  const labels = series[0].map((m, i) => `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${m.label}</text>`).join('');
  const legend = keys.map(([, label, cls]) => `<span><svg class="legend-line" viewBox="0 0 34 10" width="34" height="10" aria-hidden="true"><line class="series ${cls}" x1="1" x2="33" y1="5" y2="5"/>${chartMark(cls, 17, 5, '')}</svg>${label}</span>`).join('');
  return `<svg class="chart${narrow ? ' narrow' : ''}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Prazo por etapa nos últimos 6 meses">${grid}${lines}${labels}</svg><div class="chart-legend">${legend}</div>`;
}
/* ESCOLHA DO GRÁFICO (C2, 17/11/2026), pelo dado e não "barra em tudo":
   barras para comparar poucos períodos discretos ou um TOTAL por período; linha
   para séries de 6 ou mais pontos que são TAXA e se leem como tendência; nunca
   decoração. Por gráfico:
   - Prazo por etapa (6 meses, 3 taxas): linha. Tendência de taxa, três séries
     sobrepostas que a barra agrupada embaralharia.
   - Frete por mês (6 meses, soma em USD): barra, testada contra linha. É total
     por mês; na linha o mês em curso, incompleto, vira uma queda que não existe,
     e a barra clara diz "ainda incompleto" sem precisar de nota.
   - Minigráficos sob os números (C1): barra. Poucos subperíodos discretos do
     próprio recorte, cada um com a sua base.
   - Funil "Onde o prazo se perde": barra horizontal. Três etapas, uma taxa cada. */
const kLabel = v => (v >= 1000 ? Math.round(v / 1000) + 'k' : String(Math.round(v)));
/** Barras com o valor NO TOPO; o mês em curso (`currentYm`) sai mais claro e rotulado como incompleto. */
function barChart(series, currentYm, narrow = chartNarrow()) {
  const W = narrow ? 340 : 560, H = narrow ? 210 : 200, L = 34, B = 26, T = 34, R = 10, n = series.length, max = Math.max(1, ...series.map(m => m.value || 0));
  const slot = (W - L - R) / n, bw = slot * 0.56, x = i => L + (i + 0.5) * slot, y = v => T + (1 - v / max) * (H - T - B);
  const bars = series.map((m, i) => {
    if (m.value == null) return '';
    const partial = m.ym === currentYm;
    return `<rect class="bar${partial ? ' partial' : ''}" x="${x(i) - bw / 2}" y="${y(m.value)}" width="${bw}" height="${H - B - y(m.value)}" rx="3"><title>${m.label}: ${money(m.value)} (n=${m.n})${partial ? ' · mês em curso' : ''}</title></rect><text class="bar-value" x="${x(i)}" y="${y(m.value) - 6}" text-anchor="middle">${kLabel(m.value)}</text>${partial ? `<text class="bar-note" x="${L + (i + 1) * slot - 2}" y="${y(m.value) - 21}" text-anchor="end">${narrow ? 'em curso' : 'mês em curso'}</text>` : ''}`;
  }).join('');
  const labels = series.map((m, i) => `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${m.label}</text>`).join('');
  const partial = series.some(m => m.ym === currentYm && m.value != null);
  return `<svg class="chart${narrow ? ' narrow' : ''}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Frete contratado por mês${partial ? '; o último mês está em curso' : ''}">${[0, max].map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v ? kLabel(v) : 0}</text>`).join('')}${bars}${labels}</svg>${partial ? '<div class="chart-legend"><span><i class="swatch-partial"></i>Barra clara: mês em curso, ainda incompleto</span></div>' : ''}`;
}

/* --------------------------------------------------------------- blocos --- */
function blockHead(id, title, sub) { return `<div class="block-head"><div><h2 id="t-${id}">${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div></div>`; }
/** "Ver detalhe": UM link discreto no canto inferior direito de cada bloco. Destinos num mapa só, por bloco (IntelPersonalize.DETAIL_LINKS). */
function detailLink(blockId) {
  const d = IP.DETAIL_LINKS[blockId];
  if (!d) return '';
  // Para o portal, o relógio da demonstração (?hoje=) acompanha o link.
  const hoje = new URLSearchParams(location.search).get('hoje');
  const href = d.kind === 'portal' ? d.href + (hoje ? '?hoje=' + encodeURIComponent(hoje) : '') : url('executivo', { aba: d.aba, sel: null });
  return `<p class="detail-row"><a class="detail-link" href="${esc(href)}" ${d.kind === 'portal' ? 'target="_top"' : ''} title="${esc(d.name)}">Ver detalhe<span class="sr-only"> em ${esc(d.name)}</span> <span aria-hidden="true">→</span></a></p>`;
}
/* NÍVEL 1: o resultado (Entrega final no prazo) e onde ele se perde (o funil),
   num card só, o maior da página. Os antigos cartões "Prontidão no prazo" e
   "Chegada ao destino no prazo" moram nas linhas do funil: variação, base,
   tendência e "Como é calculado" vieram junto. */
function resultCard(s, vis) {
  const hero = vis.has('entrega_final'), fun = vis.has('funil');
  if (!hero && !fun) return '';
  const base = IE.applyFilters(D.operations, s.gf);
  let left = '', right = '';
  if (hero) {
    const k = IE.kpi(D, 'final', s.cur, s.prev), a = D.metric('final', s.cur), series = IE.subSeries(D, 'final', base, s.range);
    const body = k.value == null
      ? '<p class="no-data">Ainda não há entrega final realizada neste recorte.</p>'
      : `<b class="hero-number">${k.value}%</b><div class="hero-var">${k.small ? smallTag(k.n) : variationChip(k)}</div><p class="base-line">${a.good} de ${a.eligible.length} entregas realizadas · ${s.cur.length - a.eligible.length} ainda em curso</p>${miniBars('final', series)}`;
    left = `<div class="lvl1-hero" id="bloco-destaque"><div class="card-top"><h2 id="t-destaque">Entrega final no prazo</h2>${kpiHowButton('final', 'hero')}</div><p class="card-sub">Entregas recebidas pelo cliente (fábrica ou armazém final) até a data prevista de entrega, entre as realizadas que tinham data prevista.</p>${body}${kpiHowBody('final', s.gf, 'hero')}</div>`;
  }
  if (fun) {
    const f = IE.funnel(D, s.cur);
    const rows = f.steps.map(st => {
      const k = IE.kpi(D, st.key, s.cur, s.prev), series = IE.subSeries(D, st.key, base, s.range);
      const name = st.key === 'port' ? 'Chegada ao destino<small>porto ou aeroporto de descarga</small>' : st.label;
      const baseTxt = st.base ? `${st.good ?? 0} de ${st.base}${st.key === 'final' ? ' realizadas' : ' elegíveis'}` : 'sem registro neste recorte';
      return `<li><div class="fn-name"><span>${name}</span><small>${baseTxt}</small></div><div class="funnel-track" aria-hidden="true"><span style="width:${st.rate || 0}%"></span></div><b class="fn-pct">${st.rate == null ? '<small>sem dado</small>' : st.rate + '%'}</b><span class="fn-var">${variationPts(k)}</span>${miniBars(st.key, series, { compact: true })}${kpiHowButton(st.key)}${kpiHowBody(st.key, s.gf)}</li>`;
    }).join('');
    right = `<div class="lvl1-funnel" id="bloco-funil"><h2 id="t-funil">Onde o prazo se perde</h2><p class="card-sub">A mesma carteira em três momentos: quanto chega no prazo a cada etapa.</p><ol class="funnel">${rows}</ol><p class="mb-legend funnel-legend">Minigráficos: ${esc(IE.subSeries(D, 'ready', base, s.range).legend)}, dentro do período. Passe o mouse numa barra para ver a base.</p><p class="insight-line accent">${f.drop ? `A maior queda é de <strong>${f.drop.from}</strong> para <strong>${f.drop.to}</strong>: −${f.drop.points} pontos.` : 'Nenhuma queda de prazo entre as etapas neste recorte.'}</p></div>`;
  }
  // A3: o nível 1 é UM bloco, com UM "Ver detalhe" no canto inferior direito.
  return `<section class="card lvl1${hero && fun ? '' : ' single'}" aria-label="O resultado e onde ele se perde">${left}${right}${detailLink('resultado')}</section>`;
}
/* NÍVEL 2: apoio. Frete contratado e Embarques no recorte, lado a lado. */
function supportCard(key, s, cardId) {
  const k = IE.kpi(D, key, s.cur, s.prev), series = IE.subSeries(D, key, IE.applyFilters(D.operations, s.gf), s.range);
  const a = key === 'count' ? null : D.metric(key, s.cur);
  const baseTxt = key === 'count' ? `${s.cur.length} de ${s.all.length} no período` : `${a.eligible.length} de ${s.cur.length} com valor`;
  const value = k.value == null ? '<p class="no-data">Sem frete contratado neste recorte.</p>' : `<b class="support-number">${kpiValue(key, k)}</b><div>${k.small ? smallTag(k.n) : variationChip(k)}</div>`;
  return `<article class="card support" id="bloco-${cardId}" aria-labelledby="t-${cardId}"><div class="support-main"><div class="card-top"><h2 id="t-${cardId}">${KPI_NAMES[key]}</h2>${kpiHowButton(key)}</div>${value}<p class="base-line">${baseTxt}</p></div>${k.value == null ? '' : miniBars(key, series)}${kpiHowBody(key, s.gf)}${detailLink(cardId)}</article>`;
}
/* NÍVEL 3: evolução, recolhível e aberta por padrão. */
function evolutionBlock(s, vis) {
  const prazo = vis.has('evolucao_prazo'), frete = vis.has('evolucao_frete');
  if (!prazo && !frete) return '';
  const base = IE.applyFilters(D.operations, s.gf);
  const keys = [['ready', 'Prontidão', 's1'], ['port', 'Chegada ao destino', 's2'], ['final', 'Entrega final', 's3']];
  const c1 = prazo ? `<div class="chart-card"><h3>Prazo por etapa · últimos 6 meses</h3>${lineChart(keys.map(([k]) => IE.monthly(D, k, base, s.range.end)), keys)}<p class="chart-caption">Percentual no prazo em cada etapa, por mês do compromisso de prontidão. Meses recentes ainda têm cargas em curso.</p></div>` : '';
  const c2 = frete ? `<div class="chart-card"><h3>Frete por mês</h3>${barChart(IE.monthly(D, 'freight', base, s.range.end), D.cutoff.slice(0, 7))}<p class="chart-caption">Frete internacional contratado (USD) por mês do compromisso de prontidão. Exclui taxas e trecho terrestre.</p></div>` : '';
  return `<details class="fold evo" id="bloco-graficos" ${foldAttrs('evo')}><summary><h2 id="t-graficos">Evolução</h2><span class="fold-toggle" aria-hidden="true"></span></summary><div class="charts${prazo && frete ? '' : ' single'}">${c1}${c2}</div></details>`;
}
/* NÍVEL 4: detalhe por trecho. Cinco trechos em sequência; sem desvio em cinza,
   com desvio em destaque. Cada trecho continua abrindo a base (stageDrawer). */
function trechosBlock(s) {
  const cells = D.stages.map(st => {
    const e = s.cur.filter(o => o[st.from] && o[st.to]), bad = e.filter(o => D.days(o[st.from], o[st.to]) > st.plan(o));
    return `<li><button type="button" class="stage-cell${bad.length ? ' has-dev' : ''}" data-action="stage" data-id="${st.id}"><span class="stage-name">${esc(st.label)}</span><b>${bad.length}/${e.length}</b><span class="stage-what">acima do previsto</span><small>${e.length} de ${s.cur.length} com marcos</small></button></li>`;
  }).join('');
  const dev = D.stages.filter(st => s.cur.some(o => o[st.from] && o[st.to] && D.days(o[st.from], o[st.to]) > st.plan(o))).length;
  // A2: a seção é recolhível, com estado próprio. O resumo na linha do título
  // ("· 2 de 5 trechos com desvio") deixa o essencial à vista quando recolhida.
  return `<details class="fold perf card trechos" id="bloco-performance" ${foldAttrs('perf')}><summary><h2 id="t-performance">Performance · Onde os tempos excedem o previsto <span class="fold-count">· ${dev} de ${D.stages.length} trechos com desvio</span></h2><span class="fold-toggle" aria-hidden="true"></span></summary><p class="card-sub">Dias corridos por trecho concluído; cada trecho abre a base. Por parceiro e por rota, veja os submódulos.</p><ol class="stages">${cells}</ol><p class="chart-caption">Trechos sem desvio ficam em cinza; os que têm desvio ganham destaque. O desvio localiza o trecho, não a causa nem o responsável.</p>${detailLink('trechos')}</details>`;
}
function commitmentsBlock(s) {
  // Mora no submódulo Agentes de carga desde 23/10/2026: é o combinado com o AGENTE.
  // v4: RECOLHIDO por padrão. A lista de agentes fica curta e nada se perde; os
  // desvios de cada agente também aparecem na ficha dele. Manter ou tirar da
  // página é decisão do time (registrado na PR).
  const rows = IE.commitments(D, s.cur).sort((a, b) => (a.status === 'deviation' ? 0 : 1) - (b.status === 'deviation' ? 0 : 1)), LABEL = { deviation: 'Desvio identificado', clean: 'Sem desvio', missing: 'Falta informação' };
  const dev = rows.filter(r => r.status === 'deviation').length;
  const ctl = c => `${esc(c.name)}: ${c.actual} ${c.unit} <small>combinado ${c.agreed} ${c.unit}</small>`;
  const open = IF.isOpen(folds, 'commitments') || pagePath === 'compromissos';
  return `<details class="fold commitments" id="bloco-compromissos" data-fold="commitments" ${open ? 'open' : ''}><summary><h2 id="t-compromissos">Compromissos do serviço <span class="fold-count">· ${dev} de ${rows.length} com desvio</span></h2><span class="fold-toggle" aria-hidden="true"></span></summary><p class="card-sub">Prazos e condições combinados com o agente × o realizado. Relatório de leitura: um desvio sozinho não atribui responsabilidade. Os desvios de cada agente também aparecem na ficha dele.</p>${rows.length ? table(['Exportador / PO', 'Agente / rota', 'Desvios', 'Situação'], rows.map(({ o, deviations, status }) => `<tr><td>${esc(company(o.supplier).name)}<small>${esc(o.po)} · ${esc(o.id)}</small></td><td>${esc(agent(o.agent).name)}<small>${esc(routeName(route(o.route)))}</small></td><td>${deviations.length ? deviations.map(ctl).join('<br>') : '—'}</td><td><span class="pill ${status === 'clean' ? 'good' : ''}">${LABEL[status]}</span></td></tr>`).join('')) : '<p class="muted">Nenhum embarque neste recorte.</p>'}</details>`;
}

/* ------------------------------------------------------------ cabeçalho --- */
/** Nas fichas (fora da visão geral) os filtros globais continuam valendo: os chips dizem isso. */
function globalFilterChips() {
  const gf = IE.readFilters(params);
  return IE.FILTERS.flatMap(f => (gf[f.key] || []).map(v => `<button class="filter-chip" data-action="gfilter-remove" data-key="${f.key}" data-value="${esc(v)}" aria-label="Remover filtro ${esc(f.label)}">${esc(f.label)}: ${esc(f.name(D, v))} ×</button>`)).join('');
}
/* CABEÇALHO COMPACTO (v4). Duas linhas: (1) trilha, título do submódulo com o
   selo "Exemplo ilustrativo" e, à direita, "Filtros e ajustes" e "Preparar
   relatório"; (2) chips com o resumo do recorte. Período, os seis filtros e o
   Personalizar saíram da primeira tela e vivem no painel "Filtros e ajustes". */
const TAB_TITLE = { geral: 'Visão geral', exportadores: 'Exportadores', agentes: 'Agentes de carga', rotas: 'Rotas', simulador: 'Simulador de cenários' };
/* ESTADO DE CLIENTE NOVO (07/10/2026). Este protótipo não tem embarques reais
   ligados à Inteligência: o que aparece é sempre a fixture fictícia de data.js.
   O selo é FIXO; a frase que o explica mora na dica dele (foco, toque ou mouse). */
const EXAMPLE_TAG = '<span class="example-tag has-tip" tabindex="0" aria-describedby="example-tip">Exemplo ilustrativo<span class="tip" role="tooltip" id="example-tip">Seus dados reais substituem este exemplo assim que houver embarques.</span></span>';
/** "16/08 a 13/11/2026": o ano só se repete quando as duas datas são de anos diferentes. */
function shortRange(a, b) { return `${a.slice(0, 4) === b.slice(0, 4) ? a.slice(8, 10) + '/' + a.slice(5, 7) : fullDate(a)} a ${fullDate(b)}`; }
function headChips(s, tab, ss) {
  const sim = tab === 'simulador', chips = [];
  if (sim) { /* S1: o Simulador diz a base no próprio resultado; o topo fica com os filtros. */ }
  else if (!s.range.valid) chips.push('<span class="chip warn">Período inválido: revise as datas em Filtros e ajustes</span>');
  else {
    const label = periodNames[params.get('period') || 'days90'] || 'Personalizado', p = IE.previousRange(s.range);
    // B2: os chips de período e de comparação abrem "Filtros e ajustes" já no
    // campo Período (a comparação sai do período; não há campo próprio).
    chips.push(`<button type="button" class="chip chip-edit" data-action="intel-adjust" data-field="period" aria-label="${esc(label)}, ${shortRange(s.range.start, s.range.end)}. Alterar o período em Filtros e ajustes">${esc(label)} · <b>${shortRange(s.range.start, s.range.end)}</b></button>`);
    chips.push(`<button type="button" class="chip chip-edit" data-action="intel-adjust" data-field="period" title="${esc(IE.comparisonCaption(s.range))}" aria-label="Comparado com ${shortRange(p.start, p.end)}. ${esc(IE.comparisonCaption(s.range))} Alterar o período em Filtros e ajustes">comparado com ${shortRange(p.start, p.end)}</button>`);
  }
  if (!sim) chips.push(`<span class="chip"><b>${ss.cur.length}</b> de ${ss.all.length} embarques</span>`);
  const filters = IE.FILTERS.flatMap(f => (s.gf[f.key] || []).map(v => `<button class="filter-chip" data-action="gfilter-remove" data-key="${f.key}" data-value="${esc(v)}" aria-label="Remover filtro ${esc(f.label)}: ${esc(f.name(D, v))}">${esc(f.label)}: ${esc(f.name(D, v))} <span aria-hidden="true">×</span></button>`));
  return `<div class="head-chips" role="status">${chips.join('')}${sim ? '' : '<span class="chip-note">Base: compromisso de prontidão no período</span>'}${filters.length ? `<span class="chip-filters">${filters.join('')}<button class="text-button" data-action="gfilter-clear" aria-label="Limpar todos os filtros">Limpar</button>${raioX(s.gf)}</span>` : ''}</div>`;
}
function intelHead(tab, s, ss) {
  const title = TAB_TITLE[tab] + (tab === 'simulador' ? ' <span class="preview-tag">Prévia</span>' : '');
  const adjust = `<button class="button quiet" data-action="intel-adjust">${ICON.sliders}<span>Filtros e ajustes</span>${s.active ? `<b class="count-dot" title="Filtros ativos">${s.active}<span class="sr-only"> filtros ativos</span></b>` : ''}</button>`;
  return `<header class="intel-head"><div><p class="crumb">Inteligência</p><div class="intel-title"><h1 tabindex="-1">${title}</h1>${EXAMPLE_TAG}</div></div><div class="intel-head-actions">${adjust}${tab === 'simulador' ? '' : '<button class="button" data-action="intel-report">Preparar relatório</button>'}</div></header>${headChips(s, tab, ss)}`;
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

/* ---------------------------------------------------------------- abas --- */
/* Abas (23/10/2026, semanal de produto). Período e filtros ficam ACIMA das abas
   e valem para todas; a aba entra na URL (`aba=`) e nas visões salvas. Sem
   `aba`, Visão geral — é o que faz visões antigas abrirem como sempre. */
function currentTab() { return IT.readTab(params, extraTabs()); }
/** Abas fora da família do retrovisor: o Simulador (o caminho do futuro). */
function extraTabs() { return ['simulador']; }
function tabNav(tab) {
  const item = ([id, label], cls = '') => `<a href="${esc(url('executivo', { aba: id === 'geral' ? null : id, sel: null, de: null }))}" class="intel-tab${cls}${tab === id ? ' active' : ''}" data-tab="${id}" ${tab === id ? 'aria-current="page"' : ''}>${label}</a>`;
  // O passado (o que aconteceu) e o futuro (o que decidir agora) ficam em dois
  // grupos, separados por um divisor; o futuro leva o selo "Prévia".
  return `<nav class="intel-tabs" aria-label="Abas da Inteligência"><div class="intel-tabs-past" role="group" aria-label="O que aconteceu">${IT.TABS.map(t => item(t)).join('')}</div><div class="intel-tabs-future" role="group" aria-label="O que decidir agora"><span class="tabs-divider" aria-hidden="true"></span>${item(['simulador', 'Simulador <span class="preview-tag">Prévia</span>'], ' future')}</div></nav>`;
}
/* Cabeçalho ordenável: botão por coluna, `aria-sort` no th. */
/** Peso da coluna: líder, discreta, ou neutra (o nome, que é a identidade da linha). */
const colWeight = (dim, key) => (key === 'name' ? '' : IT.LEAD_COLUMNS[dim].includes(key) ? 'lead-col' : 'quiet-col');
function sortableHead(dim, sort) {
  return IT.COLUMNS[dim].map(([key, label]) => {
    const on = sort.key === key, dir = on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
    const arrow = on ? (sort.dir === 'asc' ? '↑' : '↓') : '↕';
    const head = /^Chegada ao destino/.test(label) ? destTerm('Chegada ao destino') + label.slice('Chegada ao destino'.length) : label;
    return `<th scope="col" class="${colWeight(dim, key)}" aria-sort="${dir}"><button type="button" class="sort-button${on ? ' active' : ''}" data-action="tab-sort" data-dim="${dim}" data-key="${key}"><span class="sort-label">${head}</span> <span aria-hidden="true">${arrow}</span></button></th>`;
  }).join('');
}
/* BASE PRIMEIRO, PERCENTUAL DEPOIS (subabas v2). Em toda taxa, "a de b" é o texto
   principal e o percentual vem menor, ao lado da leitura: 4 de 5 diz mais que
   80%, e um percentual sobre base pequena não ganha destaque que não merece. */
const rateCell = m => (m.base ? `<span class="frac">${m.good ?? 0} de ${m.base}</span><small class="pct">${pctTxt(m.rate)}</small>` : '—<small>sem registro</small>');
/** A6: "Cobrança sem diferença" sempre com número e base ("0 de 0 conferências" + a frase, quando não há conferência). */
function auditCell(m) {
  const a = IT.auditFigure(m);
  return a.note ? `<span class="frac">${a.main}</span><small>${a.unit} · ${a.note}</small>` : `<span class="frac">${a.main}</span><small class="pct">${pctTxt(a.pct)}</small>`;
}
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
  if (key === 'audit') return auditCell(r.audit);
  return rateCell(r[key]);
}
/** Linha de grupos acima do cabeçalho (só onde IntelTabs.COLUMN_GROUPS define; hoje, Exportadores). */
function groupHead(dim) {
  const groups = IT.COLUMN_GROUPS[dim];
  if (!groups) return '';
  const keys = IT.COLUMNS[dim].map(([k]) => k);
  let cells = '', at = 0;
  for (const g of groups) {
    const start = keys.indexOf(g.keys[0]);
    if (start > at) cells += `<td colspan="${start - at}"></td>`;
    const tip = g.tip ? ` <span class="group-tip has-tip" tabindex="0" aria-describedby="tip-${dim}-${g.keys[0]}">${ICON.info}<span class="sr-only">Sobre este grupo</span><span class="tip" role="tooltip" id="tip-${dim}-${g.keys[0]}">${esc(g.tip)}</span></span>` : '';
    cells += `<th scope="colgroup" colspan="${g.keys.length}"><span class="group-label">${esc(g.label)}</span>${tip}</th>`;
    at = start + g.keys.length;
  }
  if (at < keys.length) cells += `<td colspan="${keys.length - at}"></td>`;
  return `<tr class="col-groups">${cells}</tr>`;
}
function comparisonTable(dim, rows) {
  const sort = tableSort.get(dim) || IT.DEFAULT_SORT, sorted = IT.sortRows(rows, sort);
  if (!sorted.length) return '<p class="muted">Nenhum registro neste recorte.</p>';
  return `<div class="table-wrap"><table class="compare"><thead>${groupHead(dim)}<tr>${sortableHead(dim, sort)}</tr></thead><tbody>${sorted.map(r => `<tr class="clickable${params.get('sel') === r.id ? ' is-open' : ''}" data-row-dim="${dim}" data-row-id="${esc(r.id)}">${IT.COLUMNS[dim].map(([key]) => `<td class="${colWeight(dim, key)}">${cellOf(dim, key, r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
const TAB_COPY = {
  exp: { plural: 'Exportadores', noun: 'exportadores', sub: 'Quem vende e embarca a mercadoria. Ordenado por volume; clique numa linha para abrir a ficha (o antigo Raio X).' },
  ag: { plural: 'Agentes de carga', noun: 'agentes', sub: 'Quem contrata e acompanha o transporte. Ordenado por volume; clique numa linha para abrir a ficha, com os desvios e a cobrança do agente.' },
  rota: { plural: 'Rotas', noun: 'rotas', sub: 'Origem → destino internacional. Ordenado por volume; clique numa linha para abrir a ficha, com agentes e SKUs da rota.' },
};
/* FATO DO RECORTE (subabas v2): uma frase calculada (IntelTabs.recortFact) no
   lugar dos três cartões de concentração; a concentração continua, numa linha
   discreta logo abaixo. Respeita período e filtros como o resto da tela. */
function factBand(dim, rows, total) {
  return `<div class="fact-band" role="note" aria-label="Fato do recorte"><p class="fact-text">${esc(IT.recortFact(dim, rows).text)}</p><p class="fact-conc">${esc(IT.concentrationLine(dim, rows, total))}</p></div>`;
}
function entityTab(dim, s) {
  const rows = IT.entityRows(D, s.cur, dim), c = TAB_COPY[dim];
  // O título do submódulo está no cabeçalho da página; aqui fica só a frase de apoio.
  let html = `<section class="block entity-tab" id="aba-${dim}" aria-label="${c.plural}"><p class="lead">${c.sub}</p>${factBand(dim, rows, s.cur.length)}${comparisonTable(dim, rows)}<p class="chart-caption">Dado, não veredito: as colunas são fatos do recorte, sem nota nem ranking. Com menos de 3 embarques a linha leva “Amostra pequena”.</p></section>`;
  if (dim === 'ag') html = html.replace('</section>', '<p class="chart-caption">O trânsito depende da rota. Para comparar agentes de forma justa, veja a ficha do agente ou a ficha da rota.</p></section>') + commitmentsBlock(s);
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
/* FICHA LATERAL (v4). Três indicadores no topo e só o que NÃO está na linha da
   tabela. O que a ficha antiga mostrava a mais (evolução, uso e impacto, fatos
   fora da tabela) continua, recolhido em "Mais detalhes": nada se perde. */
const daysTxt1 = v => (v == null ? '—' : String(v).replace('.', ',') + ' dias');
const rateFact = (label, m) => [label, m.base ? `${m.good ?? 0} de ${m.base}` : '—', m.base ? pctTxt(m.rate) : 'sem registro'];
function sheetStrip(items) { return `<dl class="sheet-strip">${items.map(([k, v, small]) => `<div><dt>${k}</dt><dd>${v}</dd>${small ? `<small>${small}</small>` : ''}</div>`).join('')}</dl>`; }
/** Os desvios de UM agente, do mesmo dado do bloco "Compromissos do serviço" (IE.commitments). */
function agentDeviations(ops) {
  const rows = IE.commitments(D, ops), dev = rows.filter(r => r.status === 'deviation');
  const item = ({ o, deviations }) => `<li><div class="dev-who"><b>${esc(company(o.supplier).name)}</b><small>${esc(o.po)} · ${esc(routeName(route(o.route)))}</small></div><ul class="dev-list">${deviations.map(c => `<li>${esc(c.name)}: <b>${c.actual} ${c.unit}</b><small>combinado ${c.agreed} ${c.unit}</small></li>`).join('')}</ul></li>`;
  return `<section class="detail-section" aria-labelledby="dt-dev"><h3 id="dt-dev">Compromissos do serviço · desvios</h3><p class="base-line">${dev.length} de ${rows.length} ${rows.length === 1 ? 'embarque' : 'embarques'} deste agente com desvio contra o combinado.</p>${dev.length ? `<ul class="dev-items">${dev.map(item).join('')}</ul>` : '<p class="muted">Nenhum desvio contra o combinado neste recorte.</p>'}<p class="chart-caption">Um desvio sozinho não atribui responsabilidade.</p></section>`;
}
/* CRUZAMENTOS NAS FICHAS (subabas v2). Lista empilhada em vez de tabela: a ficha
   tem ~410px, e três números por linha não cabem numa tabela sem rolar. Cada
   item traz o título, a contagem de embarques e pares rótulo: valor. */
const transitBase = (median, n) => (median == null ? '—<small>sem saída e chegada</small>' : `${daysTxt1(median)}<small>${n} com saída e chegada</small>`);
const shipCount = n => `${n} ${n === 1 ? 'embarque' : 'embarques'}`;
/** Diferença NEUTRA em dias: sinal e número, sem cor ("+1,5 dia", "−2 dias", "igual"). */
function diffTxt(d) {
  if (d == null) return '—';
  if (d === 0) return 'igual à mediana da rota';
  const abs = Math.abs(d);
  return `${d > 0 ? '+' : '−'}${String(abs).replace('.', ',')} ${abs < 2 ? 'dia' : 'dias'}`;
}
function crossList(items) {
  return `<ul class="cross-list">${items.map(it => `<li><div class="cross-head"><b>${it.title}</b><span>${it.meta}</span></div><dl>${it.lines.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></li>`).join('')}</ul>`;
}
/* FICHAS QUE SE CONVERSAM (subabas v2). Um link de ficha é um hash comum
   (`aba`, `sel` e `de`, a origem): o Voltar do navegador volta para a ficha
   anterior, e a ficha aberta por link mostra o rastro de onde veio. */
const sheetLink = (dim, id, label, from) => `<a class="sheet-link" href="${esc(url('executivo', { aba: IT.TAB_OF_DIM[dim], sel: id, de: IT.originParam(from.dim, from.id) }))}">${label}</a>`;
/* B4 (17/11/2026): a ficha aberta por link de outra ficha ganha um "← Voltar"
   visível no topo, que leva à ficha de origem. Quando a pessoa chegou por um
   clique nesta sessão, o Voltar é o do navegador (não empilha histórico); num
   link compartilhado com `de=`, ele navega para a origem. */
let sheetNav = [];   // hashes de onde saiu um link entre fichas, nesta sessão
function sheetTrail(origin) {
  if (!origin) return '';
  return `<p class="sheet-trail"><a class="sheet-back" data-sheet-back href="${esc(url('executivo', { aba: origin.tab, sel: origin.id, de: null }))}"><span aria-hidden="true">←</span> Voltar</a><span class="sheet-from">para ${esc(origin.tabLabel)} · ${esc(origin.name)}</span></p>`;
}
document.addEventListener('click', e => {
  const link = e.target.closest('a.sheet-link');
  if (link) { sheetNav.push(location.hash); return; }
  const back = e.target.closest('[data-sheet-back]');
  if (!back) return;
  const target = back.getAttribute('href');
  const key = h => { const q = new URLSearchParams(String(h).split('?')[1] || ''); return (q.get('aba') || '') + '|' + (q.get('sel') || ''); };
  if (sheetNav.length && key(sheetNav[sheetNav.length - 1]) === key(target)) { e.preventDefault(); sheetNav.pop(); history.back(); }
  else sheetNav = [];
});
/** Ficha do agente: "Trânsito por rota" (IntelTabs.agentRouteContext). */
function agentRoutesSection(ops, id) {
  const rows = IT.agentRouteContext(D, ops, id);
  if (!rows.length) return '';
  const items = rows.map(r => ({
    title: sheetLink('rota', r.route, esc(r.routeName), { dim: 'ag', id }), meta: shipCount(r.n) + (r.small ? ' ' + transitSmallTag(r.transitN) : ''),
    lines: [['Trânsito mediano do agente', transitBase(r.transitMedian, r.transitN)], ['Mediana da rota', transitBase(r.routeMedian, r.routeN)], ['Diferença', diffTxt(r.diff)]],
  }));
  return `<section class="detail-section" aria-labelledby="dt-rotas"><h3 id="dt-rotas">Trânsito por rota</h3>${crossList(items)}<p class="chart-caption">O trânsito depende da rota: a diferença compara o agente com a mediana de todos os agentes do recorte na mesma rota. Mesma conta do Simulador (saída → chegada), sobre o período e os filtros desta tela; o Simulador usa o histórico próprio.</p></section>`;
}
/** Ficha da rota: "Agentes da rota", a comparação dentro da mesma rota num lugar só. */
function routeAgentsSection(ops, id) {
  const rows = IT.routeAgents(D, ops, id);
  const items = rows.map(r => ({
    title: sheetLink('ag', r.agent, esc(r.agentName), { dim: 'rota', id }), meta: shipCount(r.n) + (r.small ? ' ' + transitSmallTag(r.transitN) : ''),
    lines: [['Trânsito mediano', transitBase(r.transitMedian, r.transitN)], ['Chegada ao destino no prazo', rateCell(r.port)]],
  }));
  return `<section class="detail-section" aria-labelledby="dt-ag"><h3 id="dt-ag">Agentes da rota</h3>${rows.length ? crossList(items) : '<p class="muted">Nenhum agente nesta rota no recorte.</p>'}<p class="chart-caption">Mesma rota, mesmos períodos e filtros: é onde a comparação entre agentes é justa. Com menos de 3 trânsitos, “Amostra pequena”.</p></section>`;
}
/** Ficha do exportador: "Quem atende este exportador", um item por agente × rota. */
function exporterServersSection(ops, id) {
  const rows = IT.exporterServers(D, ops, id);
  if (!rows.length) return '';
  const items = rows.map(r => ({
    title: `${sheetLink('ag', r.agent, esc(r.agentName), { dim: 'exp', id })} <span class="cross-sub">· ${esc(r.routeName)}</span>`, meta: shipCount(r.n) + (r.small ? ' ' + transitSmallTag(r.transitN) : ''),
    lines: [['Chegada ao destino no prazo', rateCell(r.port)], ['Trânsito mediano', transitBase(r.transitMedian, r.transitN)]],
  }));
  return `<section class="detail-section" aria-labelledby="dt-atende"><h3 id="dt-atende">Quem atende este exportador</h3>${crossList(items)}<p class="chart-caption">Agente de carga e rota de cada embarque deste exportador no recorte. O resultado também depende deles: um desvio sozinho não atribui responsabilidade.</p></section>`;
}
function entityDetailHtml(dim, id, s) {
  const ops = IT.entityOps(s.cur, dim, id), row = IT.entityRows(D, s.cur, dim).find(r => r.id === id);
  const actions = `<div class="entity-actions"><button class="button secondary" data-action="entity-filter" data-dim="${dim}" data-id="${esc(id)}">Filtrar por ${THIS[dim]}</button><button class="button secondary" data-action="entity-report" data-dim="${dim}" data-id="${esc(id)}">Preparar relatório</button>${link(FICHA[dim](id), 'Ver ficha completa →')}</div>`;
  if (!row) return `<div class="empty"><h2>Sem embarques neste recorte</h2><p>Altere o período ou os filtros para ver o histórico de ${THIS[dim]}.</p></div>` + actions;
  const transit = ['Trânsito mediano', daysTxt1(row.transitMedian), `${row.transitN} com saída e chegada`];
  const freight = ['Frete médio', row.freightAvg == null ? '—' : money(row.freightAvg), 'frete internacional'];
  const strip = dim === 'exp'
    ? [rateFact('Prontidão no prazo', row.ready), rateFact('Documentação sem correção', row.docs), freight]
    : [transit, rateFact('Entrega final no prazo', row.final), freight];
  const base = IT.entityOps(IE.applyFilters(D.operations, s.gf), dim, id);
  const keys = [['ready', 'Prontidão', 's1'], ['port', 'Chegada ao destino', 's2'], ['final', 'Entrega final', 's3']];
  const evolution = `<section class="detail-section" aria-labelledby="dt-evo"><h3 id="dt-evo">Evolução · últimos 6 meses</h3>${lineChart(keys.map(([k]) => IE.monthly(D, k, base, s.range.end)), keys, true)}<p class="chart-caption">Percentual no prazo por mês do compromisso de prontidão, com os filtros atuais.</p></section>`;
  let fresh = '', more = '';
  if (dim === 'exp') {
    fresh = exporterServersSection(s.cur, id) + `<section class="detail-section" aria-labelledby="dt-sku"><h3 id="dt-sku">SKUs deste exportador</h3>${skuTable(IT.skuRows(D, ops), false)}<p class="chart-caption">SKU é do item: um embarque com dois SKUs conta nos dois.</p></section>`;
    more = factList([rateFact('Entrega final no prazo', row.final), transit]);
  }
  if (dim === 'rota') {
    fresh = routeAgentsSection(ops, id) + `<section class="detail-section" aria-labelledby="dt-sku"><h3 id="dt-sku">SKUs nesta rota</h3>${skuTable(IT.skuRows(D, ops), true)}<p class="chart-caption">SKU é do item: um embarque com dois SKUs conta nos dois.</p></section>`;
    more = factList([rateFact('Prontidão no prazo', row.ready)]);
  }
  if (dim === 'ag') {
    const imp = IT.agentImpact(D, s.cur, id);
    fresh = agentRoutesSection(s.cur, id) + agentDeviations(ops) + `<section class="detail-section" aria-labelledby="dt-cob"><h3 id="dt-cob">Cobrança</h3>${(a => `<p class="sheet-line"><span>Conferências sem diferença</span><b>${a.main} ${a.unit}</b></p>${a.note ? `<p class="chart-caption">${a.note[0].toUpperCase() + a.note.slice(1)}.</p>` : ''}`)(IT.auditFigure(row.audit))}</section>`;
    more = `<section class="detail-section" aria-labelledby="dt-imp"><h3 id="dt-imp">Uso e impacto</h3>${factList([
      ['Participação nos embarques', `${imp.share}%`, `${imp.n} de ${imp.total} no recorte · ${imp.routes.length} ${imp.routes.length === 1 ? 'rota' : 'rotas'}: ${esc(imp.routes.map(r => routeName(route(r))).join(', '))}`],
      ['Prazo do trânsito', imp.transitMedian == null ? '—' : String(imp.transitMedian).replace('.', ',') + ' dias (mediana)', `${imp.transitOverPlan} de ${imp.transitBase} acima do trânsito previsto na proposta`],
      ['Cotado × cobrado', imp.auditBase ? `${imp.auditDiffCount} de ${imp.auditBase}` : '0 de 0', imp.auditBase ? `conferências concluídas com diferença${imp.auditDiffUsd ? ` · ${money(imp.auditDiffUsd)} fundamentados, não recuperados` : ''}${imp.auditPending ? ` · ${imp.auditPending} em esclarecimento ou não auditados` : ''}` : 'nenhuma conferência concluída'],
      rateFact('Prontidão no prazo', row.ready),
    ])}<p class="chart-caption">Desvio observado não atribui responsabilidade ao agente.</p></section>`;
  }
  return sheetStrip(strip) + fresh + `<details class="fold sheet-more"><summary><h3>Mais detalhes · evolução e uso</h3><span class="fold-toggle" aria-hidden="true"></span></summary>${evolution}${more}</details>` + actions;
}
/** Subtítulo da ficha: a base primeiro ("4 embarques · 1 rota"), com o selo de amostra quando vale. */
function entitySubtitle(dim, id, s) {
  const row = IT.entityRows(D, s.cur, dim).find(r => r.id === id);
  if (!row) return esc(periodText());
  const n = `${row.n} ${row.n === 1 ? 'embarque' : 'embarques'}`, tag = row.small ? ' ' + smallTag(row.n) : '';
  if (dim === 'exp') { const c = company(id); return `${n} · ${esc(c.city)}, ${esc(c.country)}${tag}`; }
  if (dim === 'ag') return `${n} · ${row.routes} ${row.routes === 1 ? 'rota' : 'rotas'}${agent(id).preferred ? ' · Preferido no cadastro' : ''}${tag}`;
  const r = route(id); return `${n} · ${row.agents} ${row.agents === 1 ? 'agente' : 'agentes'} · ${esc(r.mode)} · ${esc(r.equipment)}${tag}`;
}
/** O "×" das gavetas vira um botão "Fechar" por extenso nas fichas e no painel de ajustes. */
function sheetMode(cls) {
  const d = $('#drawer'), c = d.querySelector('.close');
  d.classList.remove('entity-sheet', 'adjust-sheet');
  if (cls) d.classList.add(cls);
  if (cls && c) { c.textContent = 'Fechar'; c.classList.add('close-text'); c.setAttribute('aria-label', 'Fechar'); }
}
function openEntity(dim, id) {
  const s = intelScope();
  openDrawer(esc(IT.nameOf(D, dim, id)), entitySubtitle(dim, id, s), sheetTrail(IT.readOrigin(D, params, { dim, id })) + entityDetailHtml(dim, id, s));
  sheetMode('entity-sheet');
}
/** Depois de desenhar a Visão geral/abas: abre o detalhe pedido pela URL. */
function afterOverviewRender() {
  const sel = IT.readSelection(D, params, currentTab());
  sheetHash = location.hash;
  if (sel) openEntity(sel.dim, sel.id);
}
/** Fechar o painel tira `sel` da URL sem nova navegação (e sem reabrir). */
let sheetHash = '';   // o hash que desenhou a ficha aberta
function stripSelection() {
  if (!params.has('sel')) return;
  // Fechou porque um link de DENTRO da ficha já levou para outro lugar (outra
  // ficha, a ficha completa): a URL nova manda, não há o que limpar.
  if (location.hash !== sheetHash) return;
  params.delete('sel'); params.delete('de');
  const next = '#' + pagePath + (params.toString() ? '?' + params : '');
  history.replaceState(history.state, '', location.pathname + location.search + next);
  try { if (window.parent !== window) window.parent.history.replaceState(window.parent.history.state, '', window.parent.location.pathname + window.parent.location.search + next); } catch {}
}

/* --------------------------------------------------------------- página --- */
/* CARD DESLIGADO NÃO SOME (B1, 17/11/2026). No lugar dele, na mesma posição da
   hierarquia, fica um esmaecido compacto: nome, o rótulo "Desativado" por
   extenso (nunca só opacidade; texto em contraste AA) e o caminho de volta. O
   clique ativa o tema inteiro (tema desligado) ou só o card (tema ligado). */
const BLOCK_ANCHOR = { entrega_final: 'bloco-destaque', funil: 'bloco-funil', frete: 'bloco-frete', embarques: 'bloco-embarques', evolucao_prazo: 'bloco-graficos', evolucao_frete: 'bloco-graficos', trechos: 'bloco-performance' };
const THEME_NAME = Object.fromEntries(IP.THEMES);
function offStubs(ids, states) {
  const off = states.filter(c => c.off && ids.includes(c.id));
  if (!off.length) return '';
  return `<div class="off-row">${off.map(c => {
    const cta = c.off === 'theme' ? `Ativar este tema (${THEME_NAME[c.theme]})` : 'Ativar este cartão';
    return `<button type="button" class="card-off" data-action="pers-activate" data-id="${c.id}" title="${esc(cta)}"><span class="off-head"><span class="off-name">${esc(c.label)}</span><span class="off-tag">Desativado</span></span><span class="off-cta">${esc(cta)} <span aria-hidden="true">→</span></span></button>`;
  }).join('')}</div>`;
}
function geralTab(s) {
  // A ORDEM É FIXA (a hierarquia): resultado, apoio, evolução, detalhe por trecho.
  // Personalizar só liga e desliga cards (intel-personalize.js); o desligado
  // fica esmaecido no lugar dele (offStubs).
  const vis = new Set(IP.visibleCards(intelPers)), states = IP.cardStates(intelPers), B = IP.BLOCKS;
  const empty = vis.size ? '' : '<div class="card empty"><h2>Todos os cards estão desligados</h2><p>Os cards desligados continuam abaixo, esmaecidos: clique num deles para ativar o tema. Ou volte ao padrão.</p><div class="empty-actions"><button class="button" data-action="pers-reset-now">Refazer personalização do zero</button><button class="button secondary" data-action="intel-adjust">Filtros e ajustes</button></div></div>';
  const support = [vis.has('frete') && supportCard('freight', s, 'frete'), vis.has('embarques') && supportCard('count', s, 'embarques')].filter(Boolean);
  return empty + resultCard(s, vis) + offStubs(B.resultado, states)
    + (support.length ? `<div class="support-row${support.length === 1 ? ' single' : ''}">${support.join('')}</div>` : '') + offStubs([...B.frete, ...B.embarques], states)
    + evolutionBlock(s, vis) + offStubs(B.evolucao, states)
    + (vis.has('trechos') ? trechosBlock(s) : '') + offStubs(B.trechos, states);
}
/** Conteúdo das abas que não são do retrovisor (o Simulador). */
function extraTabContent(tab, s) { return tab === 'simulador' ? simulatorTab(s) : ''; }

/* ----------------------------------------------------------- simulador --- */
/* "Quero chegar até uma data. Qual rota e qual agente cabem?" Estatística sobre
   o histórico do recorte (intel-sim.js), em semanas, sem custo e sem
   recomendação. Hoje = o corte da demonstração (D.cutoff, relativo à data atual ou ?hoje=), o mesmo relógio de
   toda a página. */
const daysTxt = v => String(v).replace('.', ',');
/* HONESTIDADE DO DADO (S6): texto, não alarme. "Como é calculado" no mesmo
   padrão das outras subabas, e quatro notas curtas sempre à vista. */
function simNotes(r) {
  const reg = r.registered && r.registered.total ? ` Nesta simulação: ${r.registered.with} de ${r.registered.total} embarques com chegada registrada.` : '';
  return `<ul class="sim-notes" aria-label="Sobre este resultado"><li><b>Histórico, não garantia.</b> O resultado descreve o que aconteceu, não o que vai acontecer. A Freitas não se compromete com a data.</li><li><b>Só embarques com chegada registrada.</b> Os que estão em trânsito ou sem registro ficam fora, o que pode fazer o histórico parecer melhor do que é.${reg}</li><li><b>Período:</b> ${esc(IS.windowLabel(r.task.window).toLowerCase())}. O P90 mostra a cauda; épocas de pico podem variar.</li><li><b>Modal separado:</b> marítimo e aéreo nunca se misturam; modal sem base não simula.</li></ul>`;
}
function simHow(s, task) {
  const open = openKpiHow.has('sim');
  const lines = IS.howCalculated(D, s.gf, task, D.cutoff, window.IntelSources);
  return `<button type="button" class="kpi-how" data-action="kpi-how" data-id="sim" aria-expanded="${open}" aria-controls="kpi-how-sim">${ICON.info} Como é calculado</button><div class="kpi-how-body sim-how" id="kpi-how-sim" ${open ? '' : 'hidden'}><span class="example-tag">Dado de exemplo</span><dl>${lines.map(l => `<dt>${esc(l.label)}</dt><dd>${esc(l.text)}</dd>`).join('')}</dl></div>`;
}
/* Recorte do Simulador: a JANELA de histórico dele (não o período do painel) +
   os filtros globais. Também alimenta a barra de filtros quando a aba está aberta. */
function simScope(s) {
  const all = IS.inWindow(D.operations, IS.readWindow(params), D.cutoff);
  return { ...s, all, cur: IE.applyFilters(all, s.gf) };
}
function simHistoryLine(inputs, ss) {
  const n = inputs.route ? ss.cur.filter(o => o.route === inputs.route).length : ss.cur.length;
  return `Histórico usado: ${IS.windowLabel(inputs.window).toLowerCase()} · ${n} ${n === 1 ? 'embarque' : 'embarques'} ${inputs.route ? 'nesta rota' : 'em todas as rotas'}`;
}
/* ENTRADA EM LINGUAGEM DE TAREFA (S1, 17/11/2026). Uma faixa só: o modo num
   controle segmentado discreto ("Quero chegar até" / "Vou embarcar em"),
   origem → destino, modal (obrigatório, sem padrão escondido) e a data. O
   secundário mora em "Ajustes", recolhido. Abre com um exemplo fictício
   preenchido e o resultado à vista; "Limpar e começar do zero" esvazia tudo. */
let simAdjustOpen = false;
function simModalOptions(task) {
  // Rodoviário só aparece se houver base para ele.
  const ref = window.IntelSimReference;
  return IS.MODALS.filter(([id]) => id !== 'rodoviario' || D.routes.some(r => IS.modalOfRoute(D, r.id) === id) || (ref && ref.samples.some(x => x.modal === id)) || task.modal === id);
}
function simTaskBar(task) {
  const today = D.cutoff, chegar = task.mode === 'chegar';
  const seg = IS.MODES.map(([id, label]) => `<button type="button" role="radio" aria-checked="${task.mode === id}" data-action="sim-mode" data-mode="${id}">${label}</button>`).join('');
  const routes = D.routes.map(r => `<option value="${r.id}" ${task.route === r.id ? 'selected' : ''}>${esc(routeName(r))}</option>`).join('');
  const modals = simModalOptions(task).map(([id, label]) => `<option value="${id}" ${task.modal === id ? 'selected' : ''}>${label}</option>`).join('');
  const date = chegar ? task.target : task.departure;
  // S7: "Ajustes" mora DENTRO da faixa da tarefa e, recolhido, mostra o que está valendo.
  const current = [IS.sourceLabel(task.source), IS.windowLabel(task.window).toLowerCase(), task.cargo || 'todos os tipos de carga'].join(' · ');
  const adjust = `<details class="fold sim-adjust" ${simAdjustOpen ? 'open' : ''} data-sim-adjust><summary><span class="sim-adjust-title">Ajustes <small>${esc(current)}</small></span><span class="fold-toggle" aria-hidden="true"></span></summary><div class="sim-adjust-body"><label class="st-field">Fonte do histórico<select id="sim-source">${IS.SOURCES.map(([id, label]) => `<option value="${id}" ${task.source === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="st-field">Tipo de carga<select id="sim-cargo"><option value="">Todos os tipos</option>${['FCL', 'LCL', 'Carga geral'].map(c => `<option value="${c}" ${task.cargo === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label><label class="st-field">Período do histórico<select id="sim-window">${IS.WINDOWS.map(([id, label]) => `<option value="${id}" ${task.window === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div></details>`;
  return `<form class="sim-task" id="sim-task" onsubmit="return false" aria-label="O que você quer simular">
    <div class="segmented sim-mode" role="radiogroup" aria-label="O que você quer saber">${seg}</div>
    <div class="sim-task-fields">
      <label class="st-field st-route">Origem → destino<select id="sim-route"><option value="">Escolha a rota</option>${routes}</select></label>
      <label class="st-field">Modal<select id="sim-modal" required aria-required="true"><option value="">Escolha o modal</option>${modals}</select></label>
      <label class="st-field">${chegar ? 'Data-alvo' : 'Data de embarque'}<input id="sim-date" type="date" value="${esc(date || '')}" min="${chegar ? IS.addDays(today, 1) : today}" aria-describedby="sim-today"></label>
    </div>
    ${adjust}
    <p class="sim-task-foot"><span id="sim-today">${task.blank ? '' : 'Exemplo fictício preenchido · '}Hoje na demonstração: ${fullDate(today)}</span><button type="button" class="text-button" data-action="sim-clear">Limpar e começar do zero</button></p>
  </form>`;
}
const dm = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '';
function simResultBand(r) {
  const t = r.task, ask = t.mode === 'chegar' ? 'a data-alvo' : 'a data de embarque';
  if (r.state === 'no_route') return `<div class="fact-band sim-result" role="status"><p class="fact-text">Escolha a origem → destino para simular.</p></div>`;
  if (r.state === 'no_modal') return `<div class="fact-band sim-result" role="status"><p class="fact-text">Escolha o modal. Marítimo e aéreo nunca se misturam no histórico.</p></div>`;
  if (r.state === 'no_date') return `<div class="fact-band sim-result" role="status"><p class="fact-text">Escolha ${ask}.</p></div>`;
  if (r.state === 'no_history') {
    const other = r.source === 'meus' ? 'referencia' : 'meus';
    const alt = simOtherHasBase ? `<button type="button" class="button secondary" data-action="sim-source" data-id="${other}">Usar ${esc(IS.sourceLabel(other).replace('Referência', 'a referência').replace('Meus', 'meus'))}</button>` : '';
    return `<div class="fact-band sim-result" role="status"><p class="fact-text">Sem histórico suficiente para esta rota e modal.</p><p class="fact-conc">${esc(IS.sourceLabel(r.source))}: ${r.route.n} ${r.route.n === 1 ? 'embarque' : 'embarques'} com saída e chegada registradas; são precisos ${IS.MIN_SAMPLE}. Nada é simulado sem base.</p>${alt}</div>`;
  }
  if (r.state === 'past') return `<div class="fact-band sim-result" role="status"><p class="fact-text">${t.mode === 'chegar' ? 'A data-alvo' : 'A data de embarque'} já passou: hoje, nesta demonstração, é ${fullDate(r.today)}.</p></div>`;
  if (r.state === 'before_min') return `<div class="fact-band sim-result" role="status"><p class="fact-text">A data-alvo é anterior ao menor trânsito do histórico.</p><p class="fact-conc">Embarcando hoje (${dm(r.today)}), o trânsito mais curto registrado (${r.route.min} dias, em ${r.route.n} embarques) chegaria ao destino em ${dm(IS.addDays(r.today, r.route.min))}${r.basis === 'final' ? `, e a perna nacional até o cliente levou até ${r.leg.p90} dias (P90)` : ''}.</p></div>`;
  const final = r.basis === 'final';
  // S3: frase calculada, a de b contado no histórico, percentual secundário,
  // faixa descritiva neutra. Sem "cabe", sem cor, sem recomendação.
  const ab = c => `${c.good} de ${c.base}`, pc = c => `<small class="pct">${c.pct}%</small>`;
  const band = c => `<span class="cover-band">${esc(IS.coverageBand(c))}</span>`;
  const passed = d => (d < r.today ? ' (já passou)' : '');
  const head = t.mode === 'chegar'
    ? `<p class="fact-text">Para ${final ? 'a entrega final' : 'a chegada ao destino'} até ${dm(t.target)}, embarcar até <b>${dm(r.limitP90)}</b>${passed(r.limitP90)} cobre ${ab(r.coverP90)} embarques parecidos (P90); até <b>${dm(r.limitMedian)}</b>${passed(r.limitMedian)} cobre ${ab(r.coverMedian)} (mediana).</p><p class="sim-cover">${band(r.coverToday)} <span>Embarcando hoje (${dm(r.today)}), <b>${ab(r.coverToday)}</b> embarques parecidos chegaram até a data-alvo${pc(r.coverToday)}.</span></p>`
    : `<p class="fact-text">Embarcando em ${dm(t.departure)}, metade dos embarques parecidos chegou ao destino até <b>${dm(r.arrivalMedian)}</b> (mediana) e 9 de 10 até <b>${dm(r.arrivalP90)}</b> (P90)${final ? `; com a perna nacional, entrega final até ${dm(r.finalMedian)} (mediana) e ${dm(r.finalP90)} (P90)` : ''}.</p>`;
  // S7: o resultado PRIMEIRO; a fonte e as medidas vêm logo abaixo.
  return `<div class="fact-band sim-result" role="status">${head}${simSourceLine(r)}${simMeasures(r)}</div>`;
}
/* S2: o que está sendo calculado, sempre nomeado. Chegada ao destino sempre
   que houver base; Entrega final só com base da perna nacional, e com o aviso
   de integração do mapa de fontes. */
/* S5: de onde vem o histórico, sempre rotulado, com a cobertura de registro e,
   para a referência agregada, o aviso de integração. O fallback agente → rota
   aparece numa linha. */
let simOtherHasBase = false;
function simSourceLine(r) {
  const notice = r.source === 'referencia' && window.IntelSources ? IntelSources.noticeOf('sim_reference') : null;
  const who = r.level === 'agent' ? ` · ${esc(r.focusName)} nesta rota` : r.fallback ? '' : '';
  return `<p class="sim-source"><b>${esc(IS.sourceLabel(r.source))}</b>${r.source === 'referencia' ? ' <span class="example-tag">Exemplo fictício</span>' : ''}${who} · ${r.registered.with} de ${r.registered.total} embarques com chegada registrada</p>${r.fallback ? `<p class="sim-fallback">${esc(r.fallback)}</p>` : ''}${notice ? `<p class="integrated-notice">${esc(notice)}</p>` : ''}`;
}
function simMeasures(r) {
  const days = v => String(v).replace('.', ',');
  const port = `<li><b>${destTerm('Chegada ao destino')}</b> (porto ou aeroporto de descarga): trânsito mediano ${days(r.route.median)} dias, P90 ${r.route.p90} dias · ${r.route.n} embarques com saída e chegada</li>`;
  // A referência agregada já leva o aviso de integração no topo; ele não se repete.
  const notice = r.source !== 'referencia' && window.IntelSources ? IntelSources.noticeOf('final') : null;
  const final = r.basis === 'final'
    ? `<li><b>Entrega final</b> = chegada ao destino + perna nacional (desembaraço e transporte até o cliente): mediana ${days(r.leg.median)} dias, P90 ${r.leg.p90} dias · ${r.leg.n} embarques com chegada e entrega${r.task.mode === 'chegar' ? `. A chegada ao destino precisa ser até ${dm(r.portTarget)}` : ''}.${notice ? `<span class="integrated-notice">${esc(notice)}</span>` : ''}</li>`
    : `<li>${r.task.mode === 'chegar' ? 'Considera a chegada ao porto. A entrega final depende de dados de clientes integrados.' : 'A entrega final não entra: depende de dados de clientes integrados.'}${r.leg.n ? ` (${r.leg.n} ${r.leg.n === 1 ? 'embarque' : 'embarques'} com entrega registrada; são precisos ${IS.MIN_SAMPLE}.)` : ''}</li>`;
  return `<ul class="sim-measures">${port}${final}</ul>`;
}
/* COMPARAÇÃO POR AGENTE (S4): tabela no padrão das outras subabas (cabeçalho,
   coluna líder com peso, divisórias finas, ordem por volume, ordenação por
   coluna). Cobertura é a coluna líder. Nenhuma linha destacada como melhor. */
let simAgentSort = null;
function simAgentTable(r) {
  const chegar = r.task.mode === 'chegar', sort = simAgentSort || IS.DEFAULT_AGENT_SORT;
  const cols = [['name', 'Agente de carga'], ['shipments', 'Embarques'], ['median', 'Trânsito mediano'], ['p90', 'P90'], ['spread', 'Variação do trânsito'],
    chegar ? ['cover', 'Cobertura'] : ['limit', 'Chegada ao destino'], ...(chegar ? [['limit', 'Embarque limite']] : []), [null, 'Trânsito prometido (dias)'], [null, 'Prometido × histórico']];
  const lead = chegar ? 'cover' : 'limit';
  const head = cols.map(([key, label]) => {
    const cls = key === lead ? 'lead-col' : key === 'name' ? '' : 'quiet-col';
    if (!key) return `<th scope="col" class="${cls}"><span class="th-plain">${label}</span></th>`;
    const on = sort.key === key, dir = on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
    return `<th scope="col" class="${cls}" aria-sort="${dir}"><button type="button" class="sort-button${on ? ' active' : ''}" data-action="sim-agent-sort" data-key="${key}"><span class="sort-label">${label}</span> <span aria-hidden="true">${on ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'}</span></button></th>`;
  }).join('');
  const days = v => String(v).replace('.', ',');
  const body = IS.sortAgents(r.agents, sort).map(a => {
    const link = `<a class="sheet-link" href="${esc(url('executivo', { aba: 'agentes', sel: a.agent, de: 'sim' }))}"><b>${esc(a.name)}</b></a>`;
    const tds = [`<td>${link}</td>`, `<td class="quiet-col">${a.shipments}${a.small ? smallTag(a.n) : ''}</td>`];
    if (a.small) {
      tds.push(`<td class="quiet-col">—<small>${a.n} com saída e chegada</small></td>`, '<td class="quiet-col">—</td>', '<td class="quiet-col">—</td>', `<td class="lead-col">—<small>sem cobertura calculada</small></td>`);
      if (chegar) tds.push('<td class="quiet-col">—</td>');
    } else {
      tds.push(`<td class="quiet-col">${days(a.median)} dias<small>${a.n} com saída e chegada</small></td>`, `<td class="quiet-col">${a.p90} dias</td>`, `<td class="quiet-col">${days(a.spread)} ${a.spread === 1 ? 'dia' : 'dias'}<small>P90 − mediana</small></td>`);
      if (chegar) tds.push(`<td class="lead-col"><span class="frac">${a.cover.good} de ${a.cover.base}</span><small class="pct">${a.cover.pct}% · ${esc(IS.coverageBand(a.cover))}</small></td>`, `<td class="quiet-col">${dm(a.limitP90)} <small>P90 · ${dm(a.limitMedian)} pela mediana</small></td>`);
      else tds.push(`<td class="lead-col"><span class="frac">até ${dm(a.arrivalP90)}</span><small>P90 · ${dm(a.arrivalMedian)} pela mediana</small></td>`);
    }
    const prom = a.promised ? a.promised.days : '';
    tds.push(`<td class="quiet-col"><label class="sr-only" for="prom-${a.agent}">Trânsito prometido por ${esc(a.name)}, em dias</label><input class="prom-input" id="prom-${a.agent}" type="number" inputmode="numeric" min="1" max="365" placeholder="—" value="${prom}" data-sim-prom="${a.agent}"></td>`);
    tds.push(`<td class="quiet-col">${!a.promised ? '<small>Digite o prazo da proposta</small>' : a.small ? `prometeu ${a.promised.days} dias<small>histórico pequeno para comparar</small>` : `prometeu ${a.promised.days}; mediana ${days(a.median)}, P90 ${a.p90}<small>o histórico cumpriu ${a.promised.days} dias em ${a.promised.good} de ${a.promised.base}</small>`}</td>`);
    return `<tr>${tds.join('')}</tr>`;
  }).join('');
  return `<section class="sim-agents" aria-labelledby="sim-agents-t"><h2 id="sim-agents-t" class="sim-h2">Por agente de carga</h2><div class="table-wrap"><table class="compare sim-agents-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div><p class="chart-caption">Dado, não veredito: as colunas são fatos do histórico, sem nota nem ranking. Com menos de ${IS.MIN_SAMPLE} embarques, “Amostra pequena” e nenhuma cobertura calculada. O prometido é o que a proposta diz; o histórico mostra quantas vezes ele foi cumprido.</p></section>`;
}
/* AÇÃO (S8): o Simulador "vende" levando à Nova Cotação que já existe, com
   rota, modal e data-alvo pré-preenchidos. Rótulo de ação, sem recomendar
   agente; nenhum agente vai junto. O relógio da demonstração acompanha. */
function simQuoteAction(task, r) {
  if (!task.route || !task.modal) return '';
  const hoje = new URLSearchParams(location.search).get('hoje');
  const href = IS.quotationLink(D, task) + (hoje ? '&hoje=' + encodeURIComponent(hoje) : '');
  return `<p class="sim-action"><a class="button" href="${esc(href)}" target="_top">Solicitar cotação com esta rota e data</a><small>${task.mode === 'chegar' ? 'Leva origem, destino, modal e a data-alvo para a Nova Cotação.' : 'Leva origem, destino e modal para a Nova Cotação.'} Nenhum agente é pré-selecionado.</small></p>`;
}
function simulatorTab(s) {
  const today = D.cutoff, task = IS.readTask(D, params, today);
  // Um agente de carga filtrado vira o FOCO do resultado (com fallback para a
  // rota); a tabela continua mostrando todos os agentes da rota.
  const ag = s.gf.ag || [], focus = ag.length === 1 ? ag[0] : null;
  const all = IS.inWindow(D.operations, task.window, today), ops = IE.applyFilters(all, focus ? { ...s.gf, ag: [] } : s.gf);
  const ref = window.IntelSimReference;
  const r = IS.plan(D, ops, task, today, { ref, focus });
  simOtherHasBase = r.state === 'no_history' && IS.hasBase(D, ops, ref, task, r.source === 'meus' ? 'referencia' : 'meus', today);
  return `<section class="block sim" id="aba-simulador" aria-label="Simulador de cenários (Prévia)">${simTaskBar(task)}${simResultBand(r)}${r.state === 'ok' && r.agents.length ? simAgentTable(r) : ''}${simQuoteAction(task, r)}${simHow(s, task)}${simNotes(r)}<p class="chart-caption">Sem nota, ranking nem recomendação. Custos ficam fora desta prévia.</p></section>`;
}
function setSimParam(changes) { location.hash = url('executivo', changes); }
function intelOverview() {
  const s = intelScope(), tab = currentTab();
  // No Simulador o recorte é o HISTÓRICO dele (a janela própria), não o período do painel.
  const sim = tab === 'simulador', ss = sim ? simScope(s) : s;
  let html = intelHead(tab, s, ss) + viewChips();
  if ((s.gf.sku || []).length) html += '<p class="note-small">Filtro de SKU: SKU é do item. Entra o embarque que contém o SKU; frete e prazos continuam sendo do embarque inteiro.</p>';
  if (!sim && s.cur.length && s.cur.length < IE.MIN_SAMPLE) html += `<p class="comparison-caption">${smallTag(s.cur.length)} Com menos de 3 embarques as variações não são mostradas.</p>`;
  html += tabNav(tab);
  const extra = extraTabContent(tab, s);
  if (extra) return html + extra;
  if (!s.cur.length) {
    return html + `<div class="empty"><h2>Nenhum embarque neste recorte</h2><p>${s.active ? 'Os filtros escolhidos não têm embarques no período.' : 'Não há embarques no período escolhido.'}</p>${s.active ? '<button class="button" data-action="gfilter-clear">Limpar filtros</button>' : '<button class="button" data-action="intel-adjust">Filtros e ajustes</button>'}</div>`;
  }
  if (IT.DIM_OF_TAB[tab]) return html + entityTab(IT.DIM_OF_TAB[tab], s);
  return html + geralTab(s);
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
  sheetMode('');
  // Aberto do painel de detalhe, o relatório é DAQUELA entidade: o atalho de
  // conversa olha o filtro como se ela estivesse filtrada. O conteúdo do
  // relatório não muda (Orsi vai definir); muda só a menção a aba/entidade.
  const s = intelScope(), ctx = IE.reportContext(reportEntity ? IT.filterByEntity(s.gf, reportEntity.dim, reportEntity.id) : s.gf);
  const mention = IT.tabMention(D, currentTab(), reportEntity);
  const summary = IE.viewSummary(D, s.gf, periodNames[params.get('period') || 'days90'] || 'Personalizado', s.cur.length) + (mention ? ` · ${mention}` : '');
  const talk = [
    ctx.exporter ? `<a class="button" href="${esc(url('relatorios/revisao', { supplier: ctx.exporter }))}">Preparar revisão com ${esc(company(ctx.exporter).name)}</a><p class="muted small">Abre Relatórios › Revisão de exportador com este período e estes filtros.</p>` : '',
    ctx.plannedRouteAgent ? `<div class="planned"><div><b>Revisão de rota ou agente</b> <span class="pill">Planejado</span></div><p class="muted small">Comparáveis, desvios e pauta com o parceiro. Ainda sem geração nesta prévia.</p><button class="button secondary" disabled>Preparar revisão</button></div>` : '',
    ctx.hint ? '<p class="muted">Filtre por um exportador para preparar uma revisão.</p>' : '',
  ].join('');
  const email = emailDone
    ? `<div class="success" role="status"><b>Agendado (simulação)</b><p>Envio ${esc(emailDone.freq)} para ${esc(emailDone.to.join(', '))}. Nada foi enviado nesta prévia.</p></div>`
    : `<form id="report-email" class="report-form" novalidate><label>Frequência<select id="report-freq"><option value="semanal">Semanal</option><option value="mensal">Mensal</option></select></label><label>Destinatários<input id="report-to" type="text" placeholder="nome@empresa.com, outro@empresa.com" aria-describedby="report-to-error" required></label><p id="report-to-error" class="form-error" role="alert"></p><button class="button" type="submit">Agendar envio</button></form>`;
  openDrawer('Preparar relatório', esc(summary), `<p class="period-strip in-report">${esc(periodStripLine(s))}</p><p class="muted">A visão atual (período, filtros e cards ligados) é o relatório.</p>
    <section class="report-section" aria-labelledby="rs-1"><h3 id="rs-1">Salvar como minha visão</h3>${currentTab() !== 'geral' ? `<p class="muted small">A visão guarda também a aba (${esc(IT.tabMention(D, currentTab(), null).replace('Aba ', ''))}).</p>` : ''}<form id="view-form" class="report-form"><label>Nome da visão<input id="view-name" type="text" maxlength="60" required placeholder="Ex.: Shanghai FOB"></label><button class="button" type="submit">Salvar</button></form><p class="muted small">Aparece como atalho no topo da Inteligência e restaura período e filtros.</p></section>
    <section class="report-section" aria-labelledby="rs-2"><h3 id="rs-2">Levar para uma conversa</h3>${talk}<p class="small">${link('relatorios', 'Ver todos os relatórios')}</p></section>
    <section class="report-section" aria-labelledby="rs-3"><h3 id="rs-3">Receber e compartilhar</h3>
      <div class="share-item"><div><b>Enviar por e-mail</b> ${PREVIEW}</div>${email}</div>
      <div class="share-item"><div><b>Copiar link</b></div><p class="muted small">O link abre esta mesma visão, com período e filtros.</p><button class="button secondary" data-action="report-copy">Copiar link</button><input id="report-link" class="link-field" readonly value="${esc(shareLink())}" aria-label="Link desta visão"></div>
      <div class="share-item"><div><b>Baixar PDF</b> ${PREVIEW}</div><button class="button secondary" data-action="report-pdf">Baixar PDF</button></div>
    </section>`);
}

/* ---------------------------------------------------- filtros e ajustes --- */
/* PAINEL "FILTROS E AJUSTES" (v4, pedido do Vitor). Um lugar só, atrás de um
   botão discreto: (1) Filtros: período + os seis filtros globais, com a MESMA
   lógica de antes (OU dentro do filtro, E entre filtros); (2) Personalizar a
   Inteligência, no modelo do "Personalizar a Home". Tudo é RASCUNHO até
   "Aplicar": fechar o painel descarta, como o Cancelar da Home. */
/** Os controles de temas e cards. O mesmo HTML serve o painel e o passo 2 da introdução. */
function persFieldsHtml() {
  const st = persDraft, groups = IP.cardsByTheme(st);
  const chips = IP.THEMES.map(([id, label]) => `<button type="button" class="theme-chip" data-pers-theme="${id}" aria-pressed="${st.themes.includes(id)}">${label}</button>`).join('');
  // B1: tema desligado continua na lista, esmaecido e clicável ("Desativado" +
  // "Ativar este tema"); ligar um card dele ativa o tema.
  const cards = groups.map(g => `<div class="pers-group${g.on ? '' : ' is-off'}" role="group" aria-label="${g.label}${g.on ? '' : ' (desativado)'}"><p class="pers-group-title">${g.label}${g.on ? '' : ` <span class="off-tag">Desativado</span> <button type="button" class="text-button off-activate" data-pers-theme="${g.id}">Ativar este tema</button>`}</p>${g.cards.map(c => `<label class="pers-card${g.on ? '' : ' is-off'}"${g.on ? '' : ' title="Ativar este tema"'}><input type="checkbox" role="switch" data-pers-card="${c.id}" ${c.on ? 'checked' : ''}><span><b>${c.label}</b><small>${g.on ? c.desc : `Desativado · ligar ativa o tema ${g.label}`}</small></span></label>`).join('')}</div>`).join('');
  return `<p class="pers-eyebrow">Temas (${st.themes.length} de ${IP.THEMES.length})</p><div class="theme-chips">${chips}</div><p class="pers-eyebrow">Cards</p>${cards}`;
}
/** Redesenha só os controles de personalização do diálogo aberto e devolve o foco ao controle usado. */
function refreshPers(focusSelector) {
  document.querySelectorAll('dialog[open] [data-pers-root]').forEach(el => { el.innerHTML = persFieldsHtml(); });
  if (focusSelector) document.querySelector('dialog[open] ' + focusSelector)?.focus();
}
function draftScope() {
  const d = adjustDraft, sim = currentTab() === 'simulador', range = periodRange({ period: d.period, start: d.start, end: d.end });
  // No Simulador a contagem é sobre o histórico dele; o período escolhido vale nos outros submódulos.
  const all = sim ? IS.inWindow(D.operations, IS.readWindow(params), D.cutoff) : range.valid ? IE.inRange(D.operations, range) : [];
  return { sim, range, all, cur: IE.applyFilters(all, d.gf) };
}
function draftDropdown(f, sc) {
  // Lista e contagem da base INTEIRA (todos os períodos); desabilitada quando não
  // sobra embarque no período + outros filtros. Opção nunca some.
  const sel = adjustDraft.gf[f.key] || [], opts = IE.filterOptions(D, D.operations, sc.all, adjustDraft.gf, f.key);
  const value = !sel.length ? (f.key === 'rota' ? 'Todas' : 'Todos') : sel.length === 1 ? f.name(D, sel[0]) : `${sel.length} selecionados`;
  return `<div class="fa-field"><span class="fa-label" id="fa-l-${f.key}">${f.label}</span><details class="fsel" data-fkey="${f.key}" ${openFilterKey === f.key ? 'open' : ''}><summary aria-labelledby="fa-l-${f.key} fa-v-${f.key}"><span class="fsel-value" id="fa-v-${f.key}">${esc(value)}</span></summary><div class="fsel-menu" role="group" aria-label="${f.label}"><div class="fsel-actions"><button type="button" class="text-button" data-action="dfilter-all" data-key="${f.key}" aria-label="Selecionar todas as opções de ${f.label} com embarques no recorte">Selecionar todos</button><button type="button" class="text-button" data-action="dfilter-clear-one" data-key="${f.key}" aria-label="Limpar o filtro ${f.label}" ${sel.length ? '' : 'disabled'}>Limpar</button></div><p class="fsel-hint">Entre parênteses, embarques em toda a base.</p>${opts.map(o => `<label class="${o.disabled ? 'is-disabled' : ''}" title="${o.available} no recorte atual"><input type="checkbox" data-dfilter="${f.key}" value="${esc(o.value)}" ${o.selected ? 'checked' : ''} ${o.disabled ? 'disabled' : ''}> <span>${esc(o.label)} (${o.count})</span>${o.disabled ? '<small>0 no recorte</small>' : ''}</label>`).join('')}</div></details></div>`;
}
function adjustFiltersHtml() {
  const d = adjustDraft, sc = draftScope(), custom = d.period === 'custom', bad = !sc.sim && !sc.range.valid;
  const period = `<label class="fa-field"><span class="fa-label">Período</span><select id="fa-period">${Object.entries(periodNames).map(([v, t]) => `<option value="${v}" ${d.period === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
  const dates = custom ? `<div class="fa-dates"><label class="fa-field"><span class="fa-label">De</span><input id="fa-start" type="date" max="${D.cutoff}" value="${esc(d.start || '')}" aria-describedby="fa-range"></label><label class="fa-field"><span class="fa-label">Até</span><input id="fa-end" type="date" max="${D.cutoff}" value="${esc(d.end || '')}" aria-describedby="fa-range"></label></div>` : '';
  const rangeTxt = bad ? `Escolha datas válidas: o início deve ser anterior ou igual ao fim, até ${fullDate(D.cutoff)}.` : `${fullDate(sc.range.start)} a ${fullDate(sc.range.end)}${sc.sim ? ' · o Simulador usa o histórico próprio, escolhido na tela dele' : ''}`;
  return `<div class="fa-grid">${period}${IE.FILTERS.map(f => draftDropdown(f, sc)).join('')}</div>${dates}<p id="fa-range" class="fa-range${bad ? ' is-error' : ''}" ${bad ? 'role="alert"' : ''}>${rangeTxt}</p><p class="fa-count" role="status">Mostrando <b>${sc.cur.length}</b> de ${sc.all.length} embarques</p>${(d.gf.sku || []).length ? '<p class="note-small">SKU é do item: entra o embarque que contém o SKU; frete e prazos continuam sendo do embarque inteiro.</p>' : ''}`;
}
function refreshAdjust(focusSelector) {
  const root = document.getElementById('fa-filters'); if (!root) return;
  root.innerHTML = adjustFiltersHtml();
  if (focusSelector) root.querySelector(focusSelector)?.focus();
}
/** Abre o painel. Com `field` (B2), o foco vai direto ao campo; seletor nativo abre a lista quando o navegador deixa. */
function openAdjust(field) {
  adjustDraft = { period: params.get('period') || 'days90', start: params.get('start') || '', end: params.get('end') || '', gf: IE.readFilters(params) };
  persDraft = IP.normalize(intelPers); openFilterKey = null;
  openDrawer('Filtros e ajustes', 'O recorte e os cards da Inteligência, num lugar só.', `<div class="fa"><section class="fa-section" aria-labelledby="fa-t1"><h3 id="fa-t1">Filtros</h3><div id="fa-filters">${adjustFiltersHtml()}</div></section><section class="fa-section" aria-labelledby="fa-t2"><h3 id="fa-t2">Personalizar a Inteligência</h3><p class="fa-help">Escolha os temas e ligue ou desligue cada card. A Visão geral mostra só os cards ligados dos temas escolhidos.</p><div data-pers-root>${persFieldsHtml()}</div><p class="pers-foot"><button type="button" class="text-button" data-action="pers-reset">Refazer personalização do zero</button> <span id="pers-reset-note" role="status"></span></p></section></div><div class="fa-actions" data-bottom-action-bar><button type="button" class="text-button" data-action="onb-open">Ver introdução</button><span><button type="button" class="button secondary" data-action="fa-clear">Limpar filtros</button><button type="button" class="button" data-action="fa-apply">Aplicar</button></span></div>`);
  sheetMode('adjust-sheet');
  if (field === 'period') {
    const el = document.getElementById('fa-period');
    if (el) { el.focus(); el.scrollIntoView({ block: 'nearest' }); try { el.showPicker?.(); } catch {} }
  }
}
function applyAdjust() {
  const d = adjustDraft;
  if (d.period === 'custom' && !periodRange({ period: 'custom', start: d.start, end: d.end }).valid) { refreshAdjust('#fa-start'); return; }
  saveIntelPers(persDraft);
  const q = new URLSearchParams(params); IE.writeFilters(q, d.gf);
  if (d.period !== 'days90' || q.has('period')) q.set('period', d.period);
  if (d.period === 'custom') { q.set('start', d.start); q.set('end', d.end); } else { q.delete('start'); q.delete('end'); }
  const next = pagePath + (q.toString() ? '?' + q : '');
  adjustDraft = null; persDraft = null; openFilterKey = null;
  // Com a URL igual não há hashchange: fecha e redesenha aqui (a personalização pode ter mudado).
  if (location.hash.slice(1) === next) { closeDrawer(); render(); } else location.hash = next;
  toast('Filtros e ajustes aplicados.');
}

/* ----------------------------------------------------------- introdução --- */
/* ONBOARDING DA PRIMEIRA ENTRADA (v4), três passos no estilo do onboarding da
   Home: pontos de progresso, Pular, Voltar. Aparece uma vez (flag em
   localStorage; sem storage não abre sozinho); `?onboarding=1` força, para as
   demos; "Ver introdução", no painel de ajustes, reabre. O passo 2 grava a
   MESMA personalização do painel. Fechar por qualquer caminho marca como visto. */
let onbStep = 0, onbSkipped = false;   // B5: pulou a personalização no passo 2?
function onbHtml() {
  const dots = `<ol class="onb-dots" aria-label="Passo ${onbStep + 1} de 3">${[0, 1, 2].map(i => `<li${i === onbStep ? ' class="on" aria-current="step"' : ''}></li>`).join('')}</ol>`;
  if (onbStep === 0) {
    // A ilustração usa o número do recorte atual; sem dado, o exemplo da fixture.
    const s = intelScope(), k = IE.kpi(D, 'final', s.cur, s.prev), v = k.variation, n = v ? Math.abs(v.delta) : 10;
    const num = k.value == null ? '69%' : k.value + '%', vari = `${!v || v.direction === 'up' ? '↑' : v.direction === 'down' ? '↓' : '→'} ${n} ${n === 1 ? 'pt' : 'pts'}`;
    return `${dots}<h2 id="onb-title" tabindex="-1">Bem-vindo à Inteligência</h2><p class="onb-lead">O retrato da sua operação: o que o histórico dos seus embarques mostra. O que precisa de ação hoje continua na Central de trabalho.</p><div class="onb-illus" role="img" aria-label="Todo indicador traz número, variação e conclusão"><div><b>${num}</b><span>número</span></div><i>+</i><div><b>${vari}</b><span>variação</span></div><i>+</i><div><b>frase</b><span>conclusão</span></div></div><p class="onb-strong">Mostramos o dado e a base; a decisão é sua.</p><div class="onb-actions"><button type="button" class="button secondary" data-onb="skip">Pular</button><button type="button" class="button cta" data-onb="next">Próximo</button></div>`;
  }
  if (onbStep === 1) return `${dots}<h2 id="onb-title" tabindex="-1">Personalizar a Inteligência</h2><p class="onb-lead">Escolha os temas e ligue ou desligue cada card. A Visão geral mostra só os cards ligados dos temas escolhidos.</p><div data-pers-root>${persFieldsHtml()}</div><p class="onb-note">Dá para refazer depois em Filtros e ajustes.</p><div class="onb-actions"><span><button type="button" class="button secondary" data-onb="back">Voltar</button><button type="button" class="button secondary" data-onb="skip-step">Pular por agora</button></span><button type="button" class="button cta" data-onb="save">Salvar e continuar</button></div>`;
  const where = document.documentElement.classList.contains('embedded') ? 'nos submódulos do menu lateral' : 'nas abas no topo da página';
  // B5: feedback de saída — o que a pessoa decidiu no passo 2.
  const choice = `<p class="onb-choice" role="status"><b>${esc(IP.choiceSummary(intelPers, onbSkipped))}.</b> Dá para mudar depois em “Filtros e ajustes”.</p>`;
  return `${dots}<h2 id="onb-title" tabindex="-1">Onde ir para ver mais</h2>${choice}<p class="onb-lead">Os detalhes ficam ${where}. Cada bloco tem um “Ver detalhe” discreto no canto.</p><ul class="onb-list"><li><b>Exportadores · Agentes de carga · Rotas</b></li><li><b>Simulador</b> <span class="preview-tag">Prévia</span>: teste uma data de chegada.</li><li><b>Preparar relatório</b>: leve o recorte para a reunião.</li></ul><p class="onb-note"><button type="button" class="text-button" data-onb="restart">Refazer introdução</button></p><div class="onb-actions"><button type="button" class="button secondary" data-onb="back">Voltar</button><button type="button" class="button cta" data-onb="done">Começar</button></div>`;
}
function renderOnb() {
  const d = document.getElementById('intel-onb');
  d.innerHTML = `<div class="onb-body">${onbHtml()}</div>`;
  d.scrollTop = 0;
  d.querySelector('h2').focus();
}
function openOnboarding() {
  if ($('#drawer').open) closeDrawer();
  let d = document.getElementById('intel-onb');
  if (!d) {
    d = document.createElement('dialog');
    d.id = 'intel-onb'; d.className = 'onb'; d.setAttribute('aria-labelledby', 'onb-title');
    document.body.appendChild(d);
    d.addEventListener('close', () => { IP.markOnboardingSeen(STORE); persDraft = null; });
  }
  persDraft = IP.normalize(intelPers); onbStep = 0; onbSkipped = false;
  if (!d.open) d.showModal();
  revealFrame();
  renderOnb();
}
/* Embutida, a introdução espera o portal ficar livre: no primeiro acesso o
   portal abre as próprias boas-vindas (um diálogo na janela de fora), e duas
   introduções empilhadas não se leem. Sem host, ou sem acesso a ele, abre já. */
function whenHostIdle(fn, tries = 0) {
  let busy = false;
  try { busy = window.parent !== window && !!window.parent.document.querySelector('[role="dialog"]'); } catch {}
  if (busy && tries < 600) setTimeout(() => whenHostIdle(fn, tries + 1), 1000); else fn();
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-onb]'); if (!b) return;
  const a = b.dataset.onb, d = document.getElementById('intel-onb');
  if (a === 'skip' || a === 'done') { d.close(); return; }
  if (a === 'save') { saveIntelPers(persDraft); onbSkipped = false; render(); toast('Personalização salva.'); }
  if (a === 'skip-step') onbSkipped = true;
  onbStep = a === 'restart' ? 0 : a === 'back' ? onbStep - 1 : a === 'next' ? onbStep + 1 : 2;
  persDraft = IP.normalize(intelPers);
  renderOnb();
});

/* --------------------------------------------------------------- eventos --- */
function setGlobalFilters(next) {
  const q = new URLSearchParams(params); IE.writeFilters(q, next);
  const s = q.toString(); location.hash = pagePath + (s ? '?' + s : '');
}
function jumpTo(id) { const el = document.getElementById('bloco-' + id); if (el) { el.scrollIntoView({ block: 'start' }); el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); } }
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action]'); if (!b) return;
  const a = b.dataset.action, id = b.dataset.id;
  if (a === 'intel-adjust') openAdjust(b.dataset.field);
  else if (a === 'fa-apply') applyAdjust();
  else if (a === 'fa-clear') { adjustDraft.gf = {}; openFilterKey = null; refreshAdjust('#fa-period'); }
  else if (a === 'dfilter-all' || a === 'dfilter-clear-one') {
    const key = b.dataset.key;
    adjustDraft.gf = a === 'dfilter-all' ? { ...adjustDraft.gf, [key]: IE.selectAllValues(D, D.operations, draftScope().all, adjustDraft.gf, key) } : IE.clearFilter(adjustDraft.gf, key);
    openFilterKey = key; refreshAdjust(`details[data-fkey="${key}"] summary`);
  }
  else if (a === 'pers-reset') { persDraft = IP.defaults(); refreshPers('[data-action="pers-reset"]'); const n = document.getElementById('pers-reset-note'); if (n) n.textContent = 'Padrão restaurado: todos os cards ligados. Aplique para salvar.'; }
  else if (a === 'pers-activate') {
    const card = IP.CARDS.find(c => c.id === id), wasTheme = !intelPers.themes.includes(card.theme);
    saveIntelPers(IP.activate(intelPers, id)); render();
    const el = document.getElementById(BLOCK_ANCHOR[id]);
    if (el) { el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'nearest' }); }
    toast(wasTheme ? `Tema ${THEME_NAME[card.theme]} ativado.` : 'Cartão ativado.');
  }
  else if (a === 'pers-reset-now') { IP.clear(STORE); intelPers = IP.defaults(); render(); toast('Personalização refeita: todos os cards ligados.'); }
  else if (a === 'onb-open') openOnboarding();
  else if (a === 'gfilter-remove') { const gf = IE.readFilters(params); gf[b.dataset.key] = gf[b.dataset.key].filter(v => v !== b.dataset.value); setGlobalFilters(gf); }
  else if (a === 'gfilter-clear') { openFilterKey = null; setGlobalFilters({}); }
  else if (a === 'kpi-how') {
    const open = b.getAttribute('aria-expanded') !== 'true';
    if (open) openKpiHow.add(id); else openKpiHow.delete(id);
    b.setAttribute('aria-expanded', String(open));
    document.getElementById(b.getAttribute('aria-controls')).hidden = !open;
  }
  else if (a === 'intel-jump') { e.preventDefault(); jumpTo(id); }
  else if (a === 'intel-report') { reportEntity = null; openReportPanel(); }
  else if (a === 'tab-sort') { const dim = b.dataset.dim; tableSort.set(dim, IT.nextSort(tableSort.get(dim) || IT.DEFAULT_SORT, b.dataset.key)); render(); document.querySelector(`[data-action="tab-sort"][data-dim="${dim}"][data-key="${b.dataset.key}"]`)?.focus(); }
  else if (a === 'entity-open') location.hash = url('executivo', { sel: b.dataset.id, de: null });
  else if (a === 'sim-all-routes') setSimParam({ srota: null });
  else if (a === 'sim-agent-sort') { simAgentSort = IS.nextAgentSort(simAgentSort || IS.DEFAULT_AGENT_SORT, b.dataset.key); render(); document.querySelector(`[data-action="sim-agent-sort"][data-key="${b.dataset.key}"]`)?.focus(); }
  else if (a === 'sim-source') { setSimParam({ sfonte: id === IS.DEFAULT_SOURCE ? null : id }); toast(`Fonte do histórico: ${IS.sourceLabel(id)}.`); }
  else if (a === 'sim-mode') setSimParam({ smodo: b.dataset.mode === 'embarcar' ? 'embarcar' : null });
  else if (a === 'sim-clear') { setSimParam({ sinicio: 'vazio', srota: null, smodal: null, chegada: null, sembarque: null, smodo: null }); toast('Simulador limpo: escolha rota, modal e data.'); }
  else if (a === 'entity-filter') { const gf = IT.filterByEntity(IE.readFilters(params), b.dataset.dim, b.dataset.id); params.delete('sel'); params.delete('de'); setGlobalFilters(gf); toast('Filtro aplicado a todas as abas.'); }
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
});
// A linha inteira abre o detalhe (o botão do nome é a porta do teclado).
document.addEventListener('click', e => {
  const tr = e.target.closest('tr[data-row-dim]');
  if (!tr || e.target.closest('button, a, input, select, summary')) return;
  location.hash = url('executivo', { sel: tr.dataset.rowId, de: null });
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
document.getElementById('drawer').addEventListener('close', () => { const d = document.getElementById('drawer'); if (d.open) return; d.classList.remove('entity-sheet', 'adjust-sheet'); d.innerHTML = ''; adjustDraft = null; if (!document.getElementById('intel-onb')?.open) persDraft = null; stripSelection(); });
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'sim-route') { setSimParam({ srota: t.value || null }); return; }
  if (t.dataset && t.dataset.simProm) { const m = IS.readTask(D, params).promised, n = Number(t.value); if (Number.isInteger(n) && n >= 1 && n <= 365) m[t.dataset.simProm] = n; else delete m[t.dataset.simProm]; setSimParam({ sprom: IS.writePromised(m) }); return; }
  if (t.id === 'sim-source') { setSimParam({ sfonte: t.value === IS.DEFAULT_SOURCE ? null : t.value }); return; }
  if (t.id === 'sim-cargo') { setSimParam({ scarga: t.value || null }); return; }
  if (t.id === 'sim-modal') { setSimParam({ smodal: t.value || null }); return; }
  if (t.id === 'sim-window') { setSimParam({ janela: t.value === IS.DEFAULT_WINDOW ? null : t.value }); return; }
  if (t.id === 'sim-date') { if (IS.validIso(t.value) || !t.value) setSimParam(IS.readTask(D, params).mode === 'embarcar' ? { sembarque: t.value || null } : { chegada: t.value || null }); return; }
  if (t.id === 'fa-period') { adjustDraft.period = t.value; if (t.value !== 'custom') { adjustDraft.start = ''; adjustDraft.end = ''; } refreshAdjust(t.value === 'custom' ? '#fa-start' : '#fa-period'); return; }
  if (t.id === 'fa-start' || t.id === 'fa-end') { adjustDraft[t.id === 'fa-start' ? 'start' : 'end'] = t.value; refreshAdjust('#' + t.id); return; }
  if (t.dataset && t.dataset.dfilter) {
    const key = t.dataset.dfilter, set = new Set(adjustDraft.gf[key] || []);
    if (t.checked) set.add(t.value); else set.delete(t.value);
    adjustDraft.gf = { ...adjustDraft.gf, [key]: [...set] }; openFilterKey = key;
    refreshAdjust(`input[data-dfilter="${key}"][value="${CSS.escape(t.value)}"]`);
  } else if (t.dataset && t.dataset.persCard && persDraft) {
    persDraft = t.checked ? IP.activate(persDraft, t.dataset.persCard) : IP.setCard(persDraft, t.dataset.persCard, false);
    refreshPers(`[data-pers-card="${t.dataset.persCard}"]`);
  }
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-pers-theme]'); if (!b || !persDraft) return;
  persDraft = IP.toggleTheme(persDraft, b.dataset.persTheme);
  refreshPers(`[data-pers-theme="${b.dataset.persTheme}"]`);
});
// Dobras ("Evolução", "Performance", "Compromissos do serviço"): cada uma guarda
// o PRÓPRIO estado pela chave `data-fold`, que sobrevive ao redesenho.
// B3: expandir uma seção do acordeão da Visão geral recolhe as outras. O título
// da seção aberta fica onde o olho está (a de cima pode ter encolhido), sem
// animação quando a pessoa pede movimento reduzido.
const reducedMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
document.addEventListener('toggle', e => {
  const d = e.target; if (!d.dataset || !d.dataset.fold) return;
  folds = IF.setOpen(folds, d.dataset.fold, d.open);
  if (!d.open) return;
  let shifted = false;
  for (const id of IF.closedBy(d.dataset.fold)) {
    const other = document.querySelector(`details[data-fold="${id}"]`);
    if (other && other.open) { shifted = shifted || !!(other.compareDocumentPosition(d) & Node.DOCUMENT_POSITION_FOLLOWING); other.open = false; }
  }
  if (shifted) d.querySelector('summary')?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
}, true);
document.addEventListener('toggle', e => { if (e.target.matches && e.target.matches('[data-sim-adjust]')) simAdjustOpen = e.target.open; }, true);
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
  { target: '.lvl1', fallback: '.intel-head', title: 'Como ler um indicador', body: 'Cada indicador traz três coisas: o número do recorte, a variação contra o período anterior (o mês anterior inteiro, quando o período é um mês; a janela anterior de mesma duração, nos outros casos) e uma conclusão em uma frase. Com menos de 3 embarques aparece “Amostra pequena” e a variação some.' },
  { target: '[data-action="intel-adjust"]', title: 'Filtros e ajustes', body: 'Os filtros recortam todos os blocos: dentro de um filtro vale qualquer opção marcada; entre filtros, todos juntos. No mesmo painel você escolhe os temas e liga ou desliga cada card da Visão geral.' },
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
/* Entrada pelo portal: `?view=<id>` abre a visão, `?guide=1` abre o guia e `?onboarding=1` força a introdução. */
document.addEventListener('DOMContentLoaded', () => {
  const q = new URLSearchParams(location.search);
  const viewId = q.get('view');
  if (viewId && intelViews.some(v => v.id === viewId)) openView(viewId);
  if (q.get('guide') === '1') setTimeout(openGuide, 350);
  // Introdução: na primeira entrada, ou sempre com `?onboarding=1` (demos). O
  // mini-guia do tour do portal tem prioridade: dois diálogos de uma vez, não.
  if (q.get('onboarding') === '1' || (q.get('guide') !== '1' && !IP.onboardingSeen(STORE))) setTimeout(() => whenHostIdle(openOnboarding), 300);
});

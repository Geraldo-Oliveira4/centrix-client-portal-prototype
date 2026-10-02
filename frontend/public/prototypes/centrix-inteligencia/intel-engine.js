'use strict';
// Motor da Inteligência personalizável (02/10/2026). PURO: recebe o `D` de
// data.js e devolve números; não lê DOM, URL nem storage. Roda no navegador
// (window.IntelEngine) e sob node --test (module.exports) — ver
// intel-engine.test.cjs.
//
// Três regras que valem para a tela inteira, nos dois modos:
//   1. FILTROS GLOBAIS: OU dentro de um filtro, E entre filtros. As opções saem
//      dos dados, nunca de lista fixa. SKU é do ITEM: o embarque entra se tiver o
//      SKU, mas frete e prazos continuam sendo do embarque inteiro.
//   2. UMA BASE DE COMPARAÇÃO: toda variação compara o período escolhido com o
//      período imediatamente anterior, de MESMA duração. Nada de "julho contra
//      junho" num card e "agosto contra julho" no outro.
//   3. AMOSTRA PEQUENA: com menos de 3 embarques no recorte (ou na base de
//      comparação) a variação some e o valor ganha o selo "Amostra pequena".
//      Com zero, a tela mostra o vazio com "Limpar filtros".
(function (root) {
  const Insights = typeof module !== 'undefined' && module.exports ? require('./insights.js') : root.Insights;
  const MIN_SAMPLE = 3;
  const DAY = 86400000;
  const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  const FILTERS = [
    { key: 'exp', label: 'Exportador', values: (o) => [o.supplier], name: (D, v) => D.companies.find((c) => c.id === v)?.name || v },
    { key: 'ag', label: 'Agente de cargas', values: (o) => [o.agent], name: (D, v) => D.agents.find((a) => a.id === v)?.name || v },
    { key: 'rota', label: 'Rota', values: (o) => [o.route], name: (D, v) => { const r = D.routes.find((x) => x.id === v); return r ? `${D.locations[r.from].name} → ${D.locations[r.to].name}` : v; } },
    { key: 'inc', label: 'Incoterm', values: (o) => [o.incoterm], name: (D, v) => v },
    { key: 'pais', label: 'País de origem', values: (o) => [o.country], name: (D, v) => v },
    { key: 'sku', label: 'SKU', itemLevel: true, values: (o) => (o.items || []).map((i) => i.sku), name: (D, v) => (D.skus && D.skus[v] ? `${v} · ${D.skus[v].desc}` : v) },
  ];
  const BY_KEY = Object.fromEntries(FILTERS.map((f) => [f.key, f]));

  /** Filtros a partir dos parâmetros da URL (`exp=east,nord&sku=EC-240`). Chave ou valor vazio é ignorado. */
  function readFilters(params) {
    const get = (k) => (typeof params.get === 'function' ? params.get(k) : params[k]);
    const out = {};
    for (const f of FILTERS) out[f.key] = String(get(f.key) || '').split(',').map((v) => v.trim()).filter(Boolean);
    return out;
  }
  /** Escreve os filtros nos parâmetros (URLSearchParams), removendo os vazios. */
  function writeFilters(params, filters) {
    for (const f of FILTERS) {
      const v = (filters[f.key] || []).filter(Boolean);
      if (v.length) params.set(f.key, v.join(',')); else params.delete(f.key);
    }
    return params;
  }
  function activeCount(filters) {
    return FILTERS.reduce((n, f) => n + ((filters[f.key] || []).length ? 1 : 0), 0);
  }
  /** OU dentro do filtro, E entre filtros. Filtro sem valor não restringe. */
  function matches(o, filters) {
    return FILTERS.every((f) => {
      const wanted = filters[f.key] || [];
      return !wanted.length || f.values(o).some((v) => wanted.includes(v));
    });
  }
  function applyFilters(ops, filters) {
    return ops.filter((o) => matches(o, filters));
  }
  /** Opções de um filtro, derivadas dos dados (com contagem de embarques). */
  function options(D, ops, key) {
    const f = BY_KEY[key];
    const counts = new Map();
    for (const o of ops) for (const v of new Set(f.values(o))) counts.set(v, (counts.get(v) || 0) + 1);
    return [...counts.entries()]
      .map(([value, count]) => ({ value, count, label: f.name(D, value) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }

  // ------------------------------------------------------------ período ---
  const toDay = (iso) => Math.floor(Date.parse(iso + 'T12:00:00Z') / DAY);
  const fromDay = (n) => new Date(n * DAY + 12 * 3600000).toISOString().slice(0, 10);
  /** O período imediatamente anterior, com o MESMO número de dias. */
  function previousRange(range) {
    const len = toDay(range.end) - toDay(range.start) + 1;
    const end = toDay(range.start) - 1;
    return { start: fromDay(end - len + 1), end: fromDay(end), days: len };
  }
  function inRange(ops, range) {
    return ops.filter((o) => o.readyPlan >= range.start && o.readyPlan <= range.end);
  }
  const fullDate = (d) => d.split('-').reverse().join('/');
  /** A legenda única de toda variação da tela. */
  function comparisonCaption(range) {
    const p = previousRange(range);
    return `Variações comparam com o período anterior de mesma duração (${fullDate(p.start)} a ${fullDate(p.end)}, ${p.days} dias).`;
  }

  // ------------------------------------------------------------ métricas ---
  const HIGHER = { ready: true, port: true, final: true, docs: true, freight: null, count: null };
  function valueOf(D, key, ops) {
    if (key === 'count') return ops.length;
    const a = D.metric(key, ops);
    return a.m.amount ? (a.eligible.length ? a.total : null) : a.rate;
  }
  function baseOf(D, key, ops) {
    return key === 'count' ? ops.length : D.metric(key, ops).eligible.length;
  }
  /**
   * Um KPI com a regra da amostra. `variation` é null quando qualquer lado tem
   * menos de MIN_SAMPLE (o selo diria mais sobre a amostra que sobre a operação).
   */
  function kpi(D, key, cur, prev) {
    const value = valueOf(D, key, cur);
    const n = cur.length;
    const small = n > 0 && n < MIN_SAMPLE;
    let variation = null;
    if (!small && value != null && baseOf(D, key, cur) >= MIN_SAMPLE && prev.length >= MIN_SAMPLE && baseOf(D, key, prev) >= MIN_SAMPLE) {
      const kind = key === 'freight' || key === 'count' ? 'pct' : 'pp';
      variation = Insights.variation(value, valueOf(D, key, prev), kind, HIGHER[key] ?? null, 'o período anterior');
      if (variation) variation.text = variation.text.replace(' de o período', ' do período').replace('igual a o período', 'igual ao período');
    }
    return { key, value, n, base: baseOf(D, key, cur), small, variation };
  }

  /** Série mensal de N meses terminando no mês de `endDate`, calculada dos dados. */
  function monthly(D, key, ops, endDate, months = 6) {
    const [y, m] = endDate.split('-').map(Number);
    const out = [];
    for (let k = months - 1; k >= 0; k--) {
      const d = new Date(Date.UTC(y, m - 1 - k, 1));
      const ym = d.toISOString().slice(0, 7);
      const group = ops.filter((o) => o.readyPlan.slice(0, 7) === ym);
      const base = baseOf(D, key, group);
      out.push({ ym, label: MONTHS[d.getUTCMonth()], n: group.length, base, value: base ? valueOf(D, key, group) : null });
    }
    return out;
  }

  // ------------------------------------------------------- leituras prontas ---
  const STAGE_KEYS = [['ready', 'Prontidão'], ['port', 'Chegada ao porto'], ['final', 'Entrega final']];
  /** "Onde o prazo se perde": as três taxas em sequência e a maior queda entre elas. */
  function funnel(D, ops) {
    const steps = STAGE_KEYS.map(([key, label]) => { const a = D.metric(key, ops); return { key, label, rate: a.rate, good: a.good, base: a.eligible.length }; });
    let drop = null;
    for (let i = 1; i < steps.length; i++) {
      const a = steps[i - 1].rate, b = steps[i].rate;
      if (a == null || b == null) continue;
      if (!drop || a - b > drop.points) drop = { from: steps[i - 1].label, to: steps[i].label, points: a - b };
    }
    return { steps, drop: drop && drop.points > 0 ? drop : null };
  }
  /** Atraso médio por etapa da cadeia (dias acima do planejado), entre embarques com as duas datas. */
  function stageDelays(D, ops) {
    const ready = ops.filter((o) => o.ready);
    const readyRow = { id: 'ready', label: 'Prontidão do exportador', base: ready.length, avg: ready.length ? Math.round((ready.reduce((n, o) => n + D.days(o.readyPlan, o.ready), 0) / ready.length) * 10) / 10 : null };
    return [readyRow].concat(D.stages.map((s) => {
      const done = ops.filter((o) => o[s.from] && o[s.to]);
      const extra = done.map((o) => D.days(o[s.from], o[s.to]) - s.plan(o));
      return { id: s.id, label: s.label, base: done.length, avg: done.length ? Math.round((extra.reduce((a, b) => a + b, 0) / done.length) * 10) / 10 : null };
    }));
  }
  /** Ranking por exportador, agente ou rota; só entra quem tem ao menos 1 embarque no recorte. */
  function ranking(D, ops, dim) {
    const field = { exp: 'supplier', ag: 'agent', rota: 'route' }[dim];
    const ids = [...new Set(ops.map((o) => o[field]))];
    return ids.map((id) => {
      const g = ops.filter((o) => o[field] === id);
      const f = D.metric('freight', g);
      return { id, name: BY_KEY[dim].name(D, id), n: g.length, ready: D.metric('ready', g), port: D.metric('port', g), final: D.metric('final', g), freightAvg: f.eligible.length ? Math.round(f.total / f.eligible.length) : null };
    }).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, 'pt-BR'));
  }
  const usd = (n) => 'US$ ' + Math.round(n).toLocaleString('pt-BR');
  const pct = (v) => (v == null ? '—' : v + '%');
  /** Uma linha de insight por pergunta do modo Objetiva (métrica + variação + conclusão). */
  function questions(D, cur, prev) {
    const final = kpi(D, 'final', cur, prev), freight = kpi(D, 'freight', cur, prev);
    const routes = ranking(D, cur, 'rota').filter((r) => r.final.eligible.length >= 2 && r.final.rate != null).sort((a, b) => a.final.rate - b.final.rate);
    const agents = ranking(D, cur, 'ag').filter((r) => r.port.eligible.length >= MIN_SAMPLE).sort((a, b) => b.port.rate - a.port.rate);
    const exps = ranking(D, cur, 'exp').filter((r) => r.ready.eligible.length >= MIN_SAMPLE).sort((a, b) => b.ready.rate - a.ready.rate);
    const byRoute = ranking(D, cur, 'rota').filter((r) => r.freightAvg != null).sort((a, b) => b.freightAvg - a.freightAvg);
    const delays = stageDelays(D, cur).filter((s) => s.avg != null && s.base >= 1).sort((a, b) => b.avg - a.avg);
    const f = funnel(D, cur);
    const fa = D.metric('final', cur);
    return {
      prazo: { kpi: final, metric: pct(final.value), conclusion: final.value == null ? 'Ainda não há entrega final com comprovante neste recorte.' : `${fa.good} de ${fa.eligible.length} entregas chegaram no prazo final.${routes[0] && routes.length > 1 && routes[0].final.rate < final.value ? ` Onde pesa mais: ${routes[0].name} (${routes[0].final.good} de ${routes[0].final.eligible.length}).` : ''}` },
      frete: { kpi: freight, metric: freight.value == null ? '—' : usd(freight.value), conclusion: freight.value == null ? 'Sem frete contratado neste recorte.' : `Média de ${usd(freight.value / Math.max(1, D.metric('freight', cur).eligible.length))} por embarque.${byRoute.length > 1 ? ` Rota mais cara: ${byRoute[0].name} (${usd(byRoute[0].freightAvg)} em média).` : ''}` },
      parceiros: { kpi: null, metric: agents[0] ? agents[0].name : '—', conclusion: agents[0] ? `Chega ao porto no prazo em ${agents[0].port.rate}% (${agents[0].port.good} de ${agents[0].port.eligible.length}).${exps[0] ? ` Exportador mais pontual na prontidão: ${exps[0].name} (${exps[0].ready.rate}%).` : ''}` : `Nenhum agente com ${MIN_SAMPLE} ou mais chegadas neste recorte para comparar.` },
      perda: { kpi: null, metric: delays[0] && delays[0].avg > 0 ? delays[0].label : f.drop ? f.drop.to : '—', conclusion: delays[0] && delays[0].avg > 0 ? `Em média +${String(delays[0].avg).replace('.', ',')} dia(s) acima do planejado nesta etapa.${f.drop ? ` A maior queda de prazo é de ${f.drop.from} para ${f.drop.to} (−${f.drop.points} pontos).` : ''}` : 'Nenhuma etapa acima do planejado neste recorte.' },
    };
  }
  /**
   * "Compromissos do serviço" (somente leitura): o que foi combinado com o
   * agente contra o realizado, por embarque. Sem CTA, sem nota de agente.
   */
  function commitments(D, ops) {
    return ops.map((o) => {
      const controls = [];
      if (o.depart && o.arrive) controls.push({ name: 'Trânsito internacional', agreed: o.transitPlan, actual: D.days(o.depart, o.arrive), unit: 'dias', worse: 'higher' });
      if (o.freeTime) controls.push({ name: 'Free time concedido', agreed: o.freeTime.agreed, actual: o.freeTime.granted, unit: 'dias', worse: 'lower' });
      if (o.responseHours != null) controls.push({ name: 'Confirmação do booking', agreed: 48, actual: o.responseHours, unit: 'h', worse: 'higher' });
      const deviations = controls.filter((c) => (c.worse === 'higher' ? c.actual > c.agreed : c.actual < c.agreed));
      return { o, controls, deviations, status: !controls.length ? 'missing' : deviations.length ? 'deviation' : 'clean' };
    });
  }

  const api = { FILTERS, MIN_SAMPLE, readFilters, writeFilters, activeCount, matches, applyFilters, options, previousRange, inRange, comparisonCaption, kpi, monthly, funnel, stageDelays, ranking, questions, commitments, valueOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.IntelEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);

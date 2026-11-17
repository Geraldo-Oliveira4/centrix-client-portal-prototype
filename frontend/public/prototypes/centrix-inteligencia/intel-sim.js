'use strict';
// Simulador de cenários (Prévia, 23/10/2026). O primeiro passo da Inteligência
// para o FUTURO: "quero chegar até uma data; qual rota e qual agente cabem?".
// PURO: recebe o `D` de data.js, os embarques do recorte e as entradas; devolve
// linhas e o estado da tela. Roda no navegador (window.IntelSim) e sob
// node --test — ver intel-sim.test.cjs. Spec: docs/spec-simulador-cenarios.md.
//
// O que ele é, e o que não é:
//   - ESTATÍSTICA SOBRE O HISTÓRICO, sem modelo preditivo: para cada par
//     rota × agente, a mediana e o P90 do trânsito realizado (saída → chegada).
//     Sazonalidade, eventos e capacidade não entram.
//   - Resultado em SEMANAS, nunca em dia: errar a semana muda a vida do cliente,
//     prometer o dia seria precisão que o histórico não tem.
//   - Sem veredito (S3, 17/11/2026): "Cabe / Apertado / Não cabe" saíram. O
//     resultado é cobertura empírica, a de b, em faixas neutras ("Cobre 9 de
//     10"). Ordem padrão por volume, como nas abas.
//   - Sem custo, saving ou economia: a metodologia de saving está em avaliação.
(function (root) {
  const inNode = typeof module !== 'undefined' && module.exports;
  const Tabs = inNode ? require('./intel-tabs.js') : root.IntelTabs;
  const Engine = inNode ? require('./intel-engine.js') : root.IntelEngine;
  const MIN_SAMPLE = 3;
  /** Percentil alto do trânsito: a margem de segurança (10 a 20% acima da mediana na prática). */
  const HIGH_PERCENTILE = 90;
  const DAY = 86400000;

  const toDay = (iso) => Math.floor(Date.parse(iso + 'T12:00:00Z') / DAY);
  const fromDay = (n) => new Date(n * DAY + 12 * 3600000).toISOString().slice(0, 10);
  const addDays = (iso, n) => fromDay(toDay(iso) + n);
  const diffDays = (a, b) => toDay(b) - toDay(a);
  const validIso = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '') && !Number.isNaN(Date.parse(d)) && new Date(d + 'T12:00:00Z').toISOString().slice(0, 10) === d;

  /**
   * Percentil pelo método do posto mais próximo (nearest-rank): o menor valor
   * que cobre p% das observações. Sempre um valor que ACONTECEU, nunca uma
   * interpolação entre dois trânsitos — "37 dias" foi um embarque real.
   */
  function percentile(values, p) {
    const v = values.filter((x) => typeof x === 'number' && !Number.isNaN(x)).sort((a, b) => a - b);
    if (!v.length) return null;
    const rank = Math.max(1, Math.ceil((p / 100) * v.length));
    return v[Math.min(rank, v.length) - 1];
  }
  const median = Tabs.median;

  /** Segunda-feira da semana da data (ISO). A semana é a unidade do resultado. */
  function weekStart(iso) {
    const n = toDay(iso);
    const dow = new Date(n * DAY).getUTCDay(); // 0 = domingo
    return fromDay(n - ((dow + 6) % 7));
  }
  const ddmm = (iso) => iso.slice(8, 10) + '/' + iso.slice(5, 7);
  function weekLabel(iso) { return 'semana de ' + ddmm(weekStart(iso)); }
  /** "semana de 12/10" ou "entre a semana de 12/10 e a de 19/10". */
  function weekWindow(fromIso, toIso) {
    const a = weekStart(fromIso), b = weekStart(toIso);
    return a === b ? `na semana de ${ddmm(a)}` : `entre a semana de ${ddmm(a)} e a de ${ddmm(b)}`;
  }
  /**
   * O par rota × agente em números (n, mediana, P90), agrupado por
   * IntelTabs.pairGroups, a mesma função que alimenta "Trânsito por rota" e
   * "Agentes da rota" nas fichas: é o que o teste de igualdade ficha ×
   * Simulador confere. `route` opcional restringe a uma rota.
   */
  function simulate(D, ops, { route = '' } = {}) {
    const scoped = route ? ops.filter((o) => o.route === route) : ops;
    const rows = Tabs.pairGroups(scoped).map((g) => {
      const transits = Tabs.transitDays(D, g.ops);
      const n = transits.length;
      const base = { route: g.route, agent: g.agent, routeName: Tabs.nameOf(D, 'rota', g.route), agentName: Tabs.nameOf(D, 'ag', g.agent), shipments: g.ops.length, n, transits: [...transits].sort((a, b) => a - b) };
      if (n < MIN_SAMPLE) return { ...base, small: true, median: null, p90: null };
      return { ...base, small: false, median: median(transits), p90: percentile(transits, HIGH_PERCENTILE) };
    });
    return { rows };
  }

  // ------------------------------------------------- janela de histórico ---
  // O Simulador NÃO usa o período do painel (24/10/2026): para trânsito, é o
  // histórico longo que dá confiança, e 90 dias deixavam todo par em "Amostra
  // pequena". Ele tem a própria janela, contada pela DATA DE SAÍDA até hoje.
  const WINDOWS = [['6m', 'Últimos 6 meses', 6], ['12m', 'Últimos 12 meses', 12], ['tudo', 'Todo o histórico', null]];
  const DEFAULT_WINDOW = '12m';
  /** Janela da URL (`janela`). Ausente ou desconhecida = 12 meses (visões antigas). */
  function readWindow(params) {
    const get = (k) => (typeof params.get === 'function' ? params.get(k) : params[k]);
    const v = get('janela');
    return WINDOWS.some(([id]) => id === v) ? v : DEFAULT_WINDOW;
  }
  /** Início da janela: o mesmo dia N meses antes de hoje (último dia do mês se ele não existir). */
  function windowStart(key, today) {
    const w = WINDOWS.find(([id]) => id === key);
    if (!w || w[2] == null) return null;
    const [y, m, d] = today.split('-').map(Number);
    const last = new Date(Date.UTC(y, m - 1 - w[2] + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, m - 1 - w[2], Math.min(d, last))).toISOString().slice(0, 10);
  }
  /** Embarques na janela: saída (ou, sem saída, o compromisso de prontidão) entre o início e hoje. */
  function inWindow(ops, key, today) {
    const start = windowStart(key, today);
    return ops.filter((o) => { const d = o.depart || o.readyPlan; return d && d <= today && (!start || d >= start); });
  }
  function windowLabel(key) { return (WINDOWS.find(([id]) => id === key) || WINDOWS[1])[1]; }

  /** As quatro linhas do "Como é calculado" do simulador. */
  function howCalculated(D, filters, windowKey = DEFAULT_WINDOW, today = D.cutoff) {
    const active = Engine.FILTERS.filter((f) => (filters[f.key] || []).length);
    return [
      { label: 'Fonte', text: 'Data de saída e data de chegada ao destino registradas em cada embarque do histórico.' },
      { label: 'Fórmula', text: `Trânsito = chegada − saída, em dias. Por rota e agente: mediana e P${HIGH_PERCENTILE} (o menor trânsito que cobre ${HIGH_PERCENTILE}% dos casos). Embarque limite = data-alvo − P${HIGH_PERCENTILE} (cobre 9 de 10) ou − mediana (cobre metade). Cobertura = embarques do histórico cujo trânsito coube na margem ÷ embarques com saída e chegada. Menos de ${MIN_SAMPLE} trânsitos: sem estimativa.` },
      { label: 'Histórico', text: `${windowLabel(windowKey)}${windowStart(windowKey, today) ? `, pela data de saída, de ${windowStart(windowKey, today).split('-').reverse().join('/')} até hoje` : ', todos os embarques com saída até hoje'}. O período do painel não se aplica ao Simulador. Hoje, nesta demonstração, é ${today.split('-').reverse().join('/')}.` },
      { label: 'Filtros que se aplicam', text: active.length ? `Ativos: ${active.map((f) => `${f.label} (${filters[f.key].map((v) => f.name(D, v)).join(', ')})`).join('; ')}.` : 'Todos os filtros globais (exportador, agente, rota, incoterm, país, SKU).' },
    ];
  }

  // ====================================================== SIMULADOR V2 ===
  // (17/11/2026, revisão com o Vitor e o Vinicius.) A pergunta do analista de
  // comex: "preciso da carga até [data]; até quando embarcar, em que rota e com
  // qual agente de carga?". A tarefa entra numa linha (modo, rota, modal, data)
  // e o resultado sai em frase e cobertura "a de b", EMPÍRICA: a fração dos
  // embarques do histórico cujo trânsito coube na margem. Nada de modelo que
  // invente probabilidade, nada de veredito.
  const MODES = [['chegar', 'Quero chegar até'], ['embarcar', 'Vou embarcar em']];
  const MODALS = [['maritimo', 'Marítimo'], ['aereo', 'Aéreo'], ['rodoviario', 'Rodoviário']];
  const MODAL_OF = { 'Marítimo': 'maritimo', 'Aéreo': 'aereo', 'Rodoviário': 'rodoviario' };
  /** O exemplo fictício com que o Simulador abre (S1): rota, modal e data à vista, nunca escondidos. */
  const EXAMPLE = { route: 'ningbo', modal: 'maritimo', targetDays: 45, departureDays: 14 };
  const modalOfRoute = (D, id) => { const r = D.routes.find((x) => x.id === id); return r ? MODAL_OF[r.mode] || '' : ''; };
  const modalLabel = (id) => (MODALS.find(([m]) => m === id) || [null, ''])[1];

  /**
   * A tarefa, da URL (parâmetros ADITIVOS; `srota`, `chegada` e `janela` são os
   * de antes). Sem parâmetro nenhum, o exemplo. `sinicio=vazio` ("Limpar e
   * começar do zero") deixa tudo em branco, inclusive o modal.
   */
  function readTask(D, params, today = D.cutoff) {
    const get = (k) => (typeof params.get === 'function' ? params.get(k) : params[k]);
    const blank = get('sinicio') === 'vazio';
    const route = D.routes.some((r) => r.id === get('srota')) ? get('srota') : blank ? '' : EXAMPLE.route;
    const modal = MODALS.some(([m]) => m === get('smodal')) ? get('smodal') : blank ? '' : EXAMPLE.modal;
    const target = validIso(get('chegada')) ? get('chegada') : blank ? '' : addDays(today, EXAMPLE.targetDays);
    const departure = validIso(get('sembarque')) ? get('sembarque') : blank ? '' : addDays(today, EXAMPLE.departureDays);
    return { mode: get('smodo') === 'embarcar' ? 'embarcar' : 'chegar', route, modal, target, departure, window: readWindow(params), blank };
  }

  /** Mediana (a MESMA das fichas, IntelTabs.median) e P90 (posto mais próximo) de uma lista de trânsitos. */
  function stats(values) {
    const v = values.filter((x) => typeof x === 'number').sort((a, b) => a - b);
    if (!v.length) return { n: 0, median: null, p90: null, min: null, spread: null, values: v };
    const med = median(v), p90 = percentile(v, HIGH_PERCENTILE);
    return { n: v.length, median: med, p90, min: v[0], spread: Math.round((p90 - med) * 10) / 10, values: v };
  }
  /** Cobertura: quantos trânsitos couberam na margem (em dias, inclusiva). Empírica, a de b. */
  function coverage(values, margin) {
    const base = values.length;
    if (!base || margin == null) return { good: null, base, pct: null };
    const good = values.filter((t) => t <= margin).length;
    return { good, base, pct: Math.round((good / base) * 100) };
  }

  /** Faixa descritiva neutra (S3): "Cobre 9 de 10". Arredonda PARA BAIXO, o lado conservador. */
  function coverageBand(c) {
    if (!c || c.good == null || !c.base) return null;
    return `Cobre ${Math.floor((c.good / c.base) * 10)} de 10`;
  }

  /** Os embarques do cliente para a tarefa: rota e modal, com chegada e saída registradas para o trânsito. */
  function taskOps(D, ops, task) {
    return ops.filter((o) => o.route === task.route && modalOfRoute(D, o.route) === task.modal);
  }

  /**
   * O resultado da tarefa. `ops` já vem na janela do histórico e com os filtros
   * globais. Estados: sem rota, sem modal, sem data, data passada, sem histórico
   * (menos de MIN_SAMPLE trânsitos na rota e modal), data-alvo antes do menor
   * trânsito, ok.
   */
  function plan(D, ops, task, today = D.cutoff) {
    const out = { task, today, state: 'ok' };
    if (!task.route) return { ...out, state: 'no_route' };
    if (!task.modal) return { ...out, state: 'no_modal' };
    const date = task.mode === 'chegar' ? task.target : task.departure;
    if (!validIso(date)) return { ...out, state: 'no_date' };
    const mine = taskOps(D, ops, task);
    const route = stats(Tabs.transitDays(D, mine));
    out.route = route;
    out.registered = { with: mine.filter((o) => o.depart && o.arrive).length, total: mine.length };
    // S2: a PERNA NACIONAL (chegada ao destino → entrega ao cliente: desembaraço
    // e transporte), do histórico da mesma fonte. Só entra com base de
    // MIN_SAMPLE ou mais; sem ela, o resultado é sobre a chegada ao destino e diz
    // isso. Nunca se trata chegada ao porto como chegada à fábrica.
    out.leg = stats(mine.filter((o) => o.arrive && o.final).map((o) => D.days(o.arrive, o.final)));
    out.basis = out.leg.n >= MIN_SAMPLE ? 'final' : 'port';
    out.agents = Tabs.pairGroups(mine).map((g) => ({ agent: g.agent, name: Tabs.nameOf(D, 'ag', g.agent), shipments: g.ops.length, ...stats(Tabs.transitDays(D, g.ops)) }));
    if (route.n < MIN_SAMPLE) return { ...out, state: 'no_history' };
    if (task.mode === 'chegar') {
      const available = diffDays(today, date);
      out.available = available;
      if (available <= 0) return { ...out, state: 'past' };
      if (available < route.min) return { ...out, state: 'before_min' };
      // Com Entrega final, a chegada ao destino precisa acontecer antes da data
      // pela perna nacional; entra o P90 dela (o lado conservador, a validar).
      const legDays = out.basis === 'final' ? out.leg.p90 : 0;
      out.portTarget = addDays(date, -legDays);
      out.margin = available - legDays;
      if (out.margin < route.min) return { ...out, state: 'before_min' };
      out.limitP90 = addDays(out.portTarget, -route.p90);
      out.limitMedian = addDays(out.portTarget, -Math.ceil(route.median));
      out.coverToday = coverage(route.values, out.margin);
      // A cobertura de cada data limite é contada, não suposta: "9 de 10" e
      // "metade" são o que o histórico de fato mostra naquela margem.
      out.coverP90 = coverage(route.values, route.p90);
      out.coverMedian = coverage(route.values, Math.ceil(route.median));
    } else {
      if (diffDays(today, date) < 0) return { ...out, state: 'past' };
      out.arrivalMedian = addDays(date, Math.ceil(route.median));
      out.arrivalP90 = addDays(date, route.p90);
      if (out.basis === 'final') {
        out.finalMedian = addDays(out.arrivalMedian, Math.ceil(out.leg.median));
        out.finalP90 = addDays(out.arrivalP90, out.leg.p90);
      }
    }
    return out;
  }

  const api = { MODES, MODALS, EXAMPLE, modalOfRoute, modalLabel, readTask, stats, coverage, coverageBand, taskOps, plan, MIN_SAMPLE, HIGH_PERCENTILE, WINDOWS, DEFAULT_WINDOW, readWindow, windowStart, inWindow, windowLabel, percentile, median, weekStart, weekLabel, weekWindow, simulate, howCalculated, addDays, diffDays, validIso };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.IntelSim = api;
})(typeof window !== 'undefined' ? window : globalThis);

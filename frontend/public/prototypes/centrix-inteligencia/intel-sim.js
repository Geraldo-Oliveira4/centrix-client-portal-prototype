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
//   - Classificação FACTUAL, não nota nem recomendação: "Cabe na data" (até o
//     P90 cabe), "Apertado" (a mediana cabe, o P90 não), "Não cabe" (nem a
//     mediana). Ordem padrão por volume, como nas abas.
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
  /** Data limite de embarque em semanas, relativa a hoje. */
  function departureLabel(limitIso, today) {
    if (toDay(limitIso) < toDay(today)) return { text: 'Já passou', passed: true };
    if (weekStart(limitIso) === weekStart(today)) return { text: 'Esta semana', passed: false };
    return { text: 'Até a ' + weekLabel(limitIso), passed: false };
  }

  const STATUS = {
    cabe: { label: 'Cabe na data', tone: 'good', rule: 'Mesmo o trânsito do P90 chega até a data desejada.' },
    apertado: { label: 'Apertado', tone: 'warn', rule: 'A mediana cabe; o P90 passa da data desejada.' },
    nao_cabe: { label: 'Não cabe', tone: 'neutral', rule: 'Nem a mediana do trânsito chega até a data desejada.' },
    small: { label: 'Amostra pequena, sem estimativa', tone: 'sample', rule: `Menos de ${MIN_SAMPLE} trânsitos no histórico deste par.` },
  };

  /**
   * Classifica um par com estimativa. `available` = dias de hoje até a data
   * desejada; embarque possível a partir de hoje (premissa declarada na tela).
   */
  function classify(available, med, p90) {
    if (p90 <= available) return 'cabe';
    if (med <= available) return 'apertado';
    return 'nao_cabe';
  }

  /**
   * A frase do RESULTADO (v4): por que a linha cabe, está apertada ou não cabe.
   * Sai dos MESMOS números que `classify` compara (dias disponíveis, mediana
   * arredondada para cima e P90), então nunca contradiz o selo. Em semanas,
   * como o resto do Simulador; "folga no P90" = dias que sobram entre a chegada
   * do P90 e a data pedida.
   */
  function reason(row, result) {
    if (!row) return '';
    if (row.small) return `Menos de ${MIN_SAMPLE} trânsitos no histórico: sem estimativa.`;
    if (!row.status || !result || !result.arriveBy) return '';
    const available = result.available, med = Math.ceil(row.median), p90 = row.p90;
    const days = (n) => `${n} ${n === 1 ? 'dia' : 'dias'}`;
    const asked = (iso) => weekStart(iso) === weekStart(result.arriveBy);
    if (row.status === 'nao_cabe') {
      return asked(row.arrivalFrom)
        ? `Chegaria na semana pedida, mas ${days(med - available)} depois da data.`
        : `Chegaria na ${weekLabel(row.arrivalFrom)}, depois da data pedida.`;
    }
    if (row.status === 'apertado') {
      return `Chega ${asked(row.arrivalFrom) ? 'na semana pedida' : 'na ' + weekLabel(row.arrivalFrom)} pela mediana, mas o P90 (${days(p90)}) passa da data.`;
    }
    const slack = available - p90;
    const when = asked(row.arrivalFrom) && asked(row.arrivalTo) ? 'na semana pedida' : weekWindow(row.arrivalFrom, row.arrivalTo);
    return slack > 0 ? `Chega ${when}, com ${days(slack)} de folga no P90.` : `Chega ${when}; no P90 (${days(p90)}) chega no dia pedido, sem folga.`;
  }

  /**
   * As linhas do simulador. `ops` já vem recortado pela página (período +
   * filtros globais); `route` opcional restringe a uma rota. Uma linha por
   * rota × agente com histórico.
   */
  function simulate(D, ops, { route = '', arriveBy = '', today = D.cutoff } = {}) {
    const scoped = route ? ops.filter((o) => o.route === route) : ops;
    // O par rota × agente é agrupado por IntelTabs.pairGroups, a mesma função que
    // alimenta "Trânsito por rota" e "Agentes da rota" nas fichas.
    const groups = Tabs.pairGroups(scoped);
    const dateOk = validIso(arriveBy);
    const available = dateOk ? diffDays(today, arriveBy) : null;
    const rows = groups.map((g) => {
      const transits = Tabs.transitDays(D, g.ops);
      const n = transits.length;
      const base = { route: g.route, agent: g.agent, routeName: Tabs.nameOf(D, 'rota', g.route), agentName: Tabs.nameOf(D, 'ag', g.agent), shipments: g.ops.length, n, transits: [...transits].sort((a, b) => a - b) };
      if (n < MIN_SAMPLE) return { ...base, small: true, median: null, p90: null, status: 'small' };
      const med = median(transits), p90 = percentile(transits, HIGH_PERCENTILE);
      const row = { ...base, small: false, median: med, p90, margin: p90 - Math.ceil(med) };
      if (!dateOk || available <= 0) return { ...row, status: null };
      // Data em dias inteiros: a mediana fracionária arredonda PARA CIMA (o lado conservador).
      const medDays = Math.ceil(med);
      return {
        ...row,
        status: classify(available, medDays, p90),
        arrivalFrom: addDays(today, medDays),
        arrivalTo: addDays(today, p90),
        departBySafe: addDays(arriveBy, -p90),
        departByMedian: addDays(arriveBy, -medDays),
      };
    });
    const estimable = rows.filter((r) => !r.small);
    let state = 'ok';
    if (!dateOk) state = 'no_date';
    else if (available <= 0) state = 'past';
    else if (!rows.length) state = 'no_history';
    else if (!estimable.length) state = 'all_small';
    else if (estimable.every((r) => r.status === 'nao_cabe')) state = 'all_nao_cabe';
    // Para "nada cabe": a partir de quando a mediana mais curta do recorte chega.
    const fastest = estimable.length ? Math.min(...estimable.map((r) => Math.ceil(r.median))) : null;
    return {
      state,
      rows,
      today,
      arriveBy: dateOk ? arriveBy : null,
      available,
      earliestArrival: fastest == null ? null : addDays(today, fastest),
      counts: { cabe: rows.filter((r) => r.status === 'cabe').length, apertado: rows.filter((r) => r.status === 'apertado').length, nao_cabe: rows.filter((r) => r.status === 'nao_cabe').length, small: rows.filter((r) => r.small).length },
    };
  }

  // ------------------------------------------------------------- ordem ---
  const SORT_VALUE = {
    route: (r) => r.routeName,
    agent: (r) => r.agentName,
    shipments: (r) => r.shipments,
    median: (r) => r.median,
    p90: (r) => r.p90,
  };
  const COLUMNS = [['route', 'Rota'], ['agent', 'Agente de cargas'], ['shipments', 'Histórico'], ['median', 'Trânsito (mediana · P90)'], [null, 'Chegada estimada se embarcar agora'], [null, 'Resultado']];
  const DEFAULT_SORT = { key: 'shipments', dir: 'desc' };
  /** Volume por padrão; ausente (amostra pequena) sempre no fim; empate por rota e agente. */
  function sortSimRows(rows, sort = DEFAULT_SORT) {
    const get = SORT_VALUE[sort.key] || SORT_VALUE.shipments;
    const sign = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = get(a), vb = get(b);
      const na = va == null, nb = vb == null;
      if (na !== nb) return na ? 1 : -1;
      if (!na && va !== vb) return (typeof va === 'string' ? va.localeCompare(vb, 'pt-BR') : va - vb) * sign;
      return b.shipments - a.shipments || a.routeName.localeCompare(b.routeName, 'pt-BR') || a.agentName.localeCompare(b.agentName, 'pt-BR');
    });
  }
  function nextSort(current, key) {
    if (current && current.key === key) return { key, dir: current.dir === 'desc' ? 'asc' : 'desc' };
    return { key, dir: key === 'route' || key === 'agent' ? 'asc' : 'desc' };
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

  /** Entradas da URL: `srota` (rota ou vazio), `chegada` (data desejada) e `janela`. */
  function readInputs(D, params, today = D.cutoff) {
    const get = (k) => (typeof params.get === 'function' ? params.get(k) : params[k]);
    const route = D.routes.some((r) => r.id === get('srota')) ? get('srota') : '';
    const raw = get('chegada');
    return { route, arriveBy: validIso(raw) ? raw : defaultArrival(today), explicit: validIso(raw), window: readWindow(params) };
  }
  /**
   * Data desejada padrão: 32 dias depois de hoje (pouco mais de 4 semanas), para a
   * aba responder sem clique. Com a fixture, é a data em que a leitura padrão
   * (12 meses) já mostra os três resultados lado a lado.
   */
  const DEFAULT_ARRIVAL_DAYS = 32;
  function defaultArrival(today) { return addDays(today, DEFAULT_ARRIVAL_DAYS); }

  /** As quatro linhas do "Como é calculado" do simulador. */
  function howCalculated(D, filters, windowKey = DEFAULT_WINDOW, today = D.cutoff) {
    const active = Engine.FILTERS.filter((f) => (filters[f.key] || []).length);
    return [
      { label: 'Fonte', text: 'Data de saída e data de chegada ao destino registradas em cada embarque do histórico.' },
      { label: 'Fórmula', text: `Trânsito = chegada − saída, em dias. Por rota e agente: mediana e P${HIGH_PERCENTILE} (o menor trânsito que cobre ${HIGH_PERCENTILE}% dos casos). Data limite de embarque = data desejada − P${HIGH_PERCENTILE} (com folga) ou − mediana (no limite). Cabe na data: até o P${HIGH_PERCENTILE} chega a tempo embarcando a partir de hoje. Apertado: só a mediana chega. Não cabe: nem a mediana. Menos de ${MIN_SAMPLE} trânsitos: sem estimativa.` },
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

  const api = { MODES, MODALS, EXAMPLE, modalOfRoute, modalLabel, readTask, stats, coverage, taskOps, plan, MIN_SAMPLE, HIGH_PERCENTILE, STATUS, COLUMNS, DEFAULT_SORT, WINDOWS, DEFAULT_WINDOW, readWindow, windowStart, inWindow, windowLabel, percentile, median, weekStart, weekLabel, weekWindow, departureLabel, classify, reason, simulate, sortSimRows, nextSort, readInputs, defaultArrival, howCalculated, addDays, diffDays, validIso };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.IntelSim = api;
})(typeof window !== 'undefined' ? window : globalThis);

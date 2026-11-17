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

  /**
   * "Como é calculado" do Simulador (S6): fonte, fórmula, histórico, registro,
   * modal e filtros, em linguagem de negócio. A FONTE sai do mapa único
   * (intel-sources.js), que diz "Fonte a confirmar" enquanto não houver
   * validação.
   */
  function howCalculated(D, filters, task, today = D.cutoff, Sources = null) {
    const active = Engine.FILTERS.filter((f) => (filters[f.key] || []).length);
    const src = (k) => (Sources ? Sources.sourceOf(k) : 'Fonte a confirmar');
    const start = windowStart(task.window, today);
    return [
      { label: 'Fonte', text: `${sourceLabel(task.source)}: ${src(task.source === 'referencia' ? 'sim_reference' : 'sim_transit')}. Perna nacional: ${src('sim_leg')}.` },
      { label: 'Fórmula', text: `Trânsito = chegada ao destino − saída, em dias corridos. Mediana e P${HIGH_PERCENTILE} (o menor trânsito que cobre ${HIGH_PERCENTILE}% dos casos, sempre um trânsito que aconteceu). Cobertura = embarques do histórico cujo trânsito coube na margem até a data-alvo ÷ embarques com saída e chegada. Embarque limite = data-alvo − P${HIGH_PERCENTILE} (ou − mediana). Com Entrega final, a data-alvo desconta antes a perna nacional (chegada → entrega ao cliente) pelo P${HIGH_PERCENTILE} dela. Menos de ${MIN_SAMPLE} trânsitos: sem cálculo.` },
      { label: 'Histórico', text: `${windowLabel(task.window)}${start ? `, pela data de saída, de ${start.split('-').reverse().join('/')} até hoje` : ', todos os embarques com saída até hoje'}. O P${HIGH_PERCENTILE} existe para mostrar a cauda; épocas de pico podem variar. O período do painel não se aplica ao Simulador.` },
      { label: 'Registro', text: 'Só entram embarques com chegada registrada. Os que ainda estão em trânsito ou sem registro ficam fora, o que pode fazer o histórico parecer melhor do que é.' },
      { label: 'Modal', text: 'Marítimo e aéreo nunca se misturam. Modal sem base não simula.' },
      { label: 'Filtros que se aplicam', text: task.source === 'referencia' ? 'A referência agregada é recortada só por rota, modal, tipo de carga e período; os filtros globais valem para "Meus embarques".' : active.length ? `Ativos: ${active.map((f) => `${f.label} (${filters[f.key].map((v) => f.name(D, v)).join(', ')})`).join('; ')}.` : 'Todos os filtros globais (exportador, agente, rota, incoterm, país, SKU).' },
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
  const EXAMPLE = { route: 'ningbo', modal: 'maritimo', targetDays: 60, departureDays: 14 };
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
    const source = SOURCES.some(([id]) => id === get('sfonte')) ? get('sfonte') : DEFAULT_SOURCE;
    const cargo = ['FCL', 'LCL', 'Carga geral'].includes(get('scarga')) ? get('scarga') : '';
    return { mode: get('smodo') === 'embarcar' ? 'embarcar' : 'chegar', route, modal, target, departure, window: readWindow(params), blank, promised: readPromised(get('sprom')), source, cargo };
  }

  /**
   * "Trânsito prometido (dias)" por agente (S4), o que a proposta diz, digitado
   * pelo cliente: `sprom=alpha:40,beta:35`. Só inteiros de 1 a 365; o resto é
   * ignorado.
   */
  function readPromised(raw) {
    const out = {};
    for (const part of String(raw || '').split(',')) {
      const [id, v] = part.split(':'), n = Number(v);
      if (id && Number.isInteger(n) && n >= 1 && n <= 365) out[id] = n;
    }
    return out;
  }
  function writePromised(map) {
    return Object.entries(map).filter(([, v]) => Number.isInteger(v)).map(([k, v]) => `${k}:${v}`).join(',') || null;
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
  // ---------------------------------------------- fonte do histórico (S5) ---
  /**
   * Duas fontes, sempre rotuladas no resultado. "Meus embarques" é o histórico
   * do próprio cliente (pode cair em Amostra pequena). "Referência agregada da
   * Freitas" é histórico agregado e anônimo por rota e modal, só para cliente
   * integrado; é o PADRÃO quando existe. Aqui ela é fictícia (sim-reference.js).
   */
  const SOURCES = [['referencia', 'Referência agregada da Freitas'], ['meus', 'Meus embarques']];
  const DEFAULT_SOURCE = 'referencia';
  const sourceLabel = (id) => (SOURCES.find(([s]) => s === id) || SOURCES[0])[1];
  /** Tipo de carga dos embarques do cliente, pelo equipamento da rota. */
  const cargoOfRoute = (D, id) => { const r = D.routes.find((x) => x.id === id); return !r ? '' : /LCL/.test(r.equipment) ? 'LCL' : /FCL/.test(r.equipment) ? 'FCL' : 'Carga geral'; };

  /** O histórico do cliente na forma comum: agentes com trânsitos, perna nacional, registro. */
  function historyMine(D, ops, task) {
    const mine = taskOps(D, ops, task).filter((o) => !task.cargo || cargoOfRoute(D, o.route) === task.cargo);
    return {
      source: 'meus',
      agents: Tabs.pairGroups(mine).map((g) => ({ agent: g.agent, shipments: g.ops.length, values: Tabs.transitDays(D, g.ops) })),
      legs: mine.filter((o) => o.arrive && o.final).map((o) => D.days(o.arrive, o.final)),
      registered: { with: mine.filter((o) => o.depart && o.arrive).length, total: mine.length },
    };
  }
  /** A referência agregada na mesma forma, recortada por rota, modal, janela e tipo de carga. */
  function historyReference(Ref, task, today) {
    const start = windowStart(task.window, today);
    const inWin = (x) => !start || addDays(today, -x.daysAgo) >= start;
    const rows = Ref.samples.filter((x) => x.route === task.route && x.modal === task.modal && inWin(x) && (!task.cargo || x.cargo === task.cargo));
    const byAgent = new Map();
    for (const x of rows) { const a = byAgent.get(x.agent) || { agent: x.agent, shipments: 0, values: [] }; a.shipments++; a.values.push(x.transit); byAgent.set(x.agent, a); }
    const unreg = Ref.unregistered[`${task.route}|${task.modal}`] || 0;
    return {
      source: 'referencia',
      agents: [...byAgent.values()],
      legs: Ref.legs.filter((x) => x.route === task.route && x.modal === task.modal && inWin(x)).map((x) => x.days),
      registered: { with: rows.length, total: rows.length + (rows.length ? unreg : 0) },
    };
  }
  /** Há base (MIN_SAMPLE trânsitos) para esta rota e modal nesta fonte? */
  function hasBase(D, ops, Ref, task, source, today) {
    const h = source === 'referencia' && Ref ? historyReference(Ref, task, today) : historyMine(D, ops, task);
    return h.agents.reduce((n, a) => n + a.values.length, 0) >= MIN_SAMPLE;
  }

  /**
   * O resultado da tarefa. `ops` são os embarques do cliente na janela e com os
   * filtros globais; `opts.ref` é a referência agregada; `opts.focus` é o agente
   * de carga filtrado (um só). Estados: sem rota, sem modal, sem data, data
   * passada, sem histórico, data-alvo antes do menor trânsito, ok.
   *
   * FALLBACK (S5): com um agente em foco e menos de MIN_SAMPLE trânsitos dele, o
   * resultado cai para o nível da rota e diz isso numa linha. Sem MIN_SAMPLE nem
   * na rota: "Sem histórico suficiente". Nunca se simula sem base.
   */
  function plan(D, ops, task, today = D.cutoff, opts = {}) {
    const out = { task, today, state: 'ok', source: task.source === 'meus' || !opts.ref ? 'meus' : 'referencia' };
    if (!task.route) return { ...out, state: 'no_route' };
    if (!task.modal) return { ...out, state: 'no_modal' };
    const date = task.mode === 'chegar' ? task.target : task.departure;
    if (!validIso(date)) return { ...out, state: 'no_date' };
    const h = out.source === 'referencia' ? historyReference(opts.ref, task, today) : historyMine(D, ops, task);
    const route = stats(h.agents.flatMap((a) => a.values));
    out.route = route;
    out.registered = h.registered;
    // S2: a PERNA NACIONAL (chegada ao destino → entrega ao cliente: desembaraço
    // e transporte), do histórico da MESMA fonte. Só entra com base de
    // MIN_SAMPLE ou mais; sem ela, o resultado é sobre a chegada ao destino e diz
    // isso. Nunca se trata chegada ao porto como chegada à fábrica.
    out.leg = stats(h.legs);
    out.basis = out.leg.n >= MIN_SAMPLE ? 'final' : 'port';
    out.agents = h.agents.map((a) => ({ agent: a.agent, name: Tabs.nameOf(D, 'ag', a.agent), shipments: a.shipments, ...stats(a.values) })).map((a) => ({ ...a, small: a.n < MIN_SAMPLE }));
    if (route.n < MIN_SAMPLE) return { ...out, state: 'no_history' };
    // O número da frase: o agente em foco, se ele tiver base; senão, a rota.
    const focus = opts.focus ? out.agents.find((a) => a.agent === opts.focus) : null;
    out.level = focus && !focus.small ? 'agent' : 'route';
    if (opts.focus && out.level === 'route') out.fallback = 'Poucos embarques deste agente; mostrando a rota.';
    out.focusName = focus ? focus.name : opts.focus ? Tabs.nameOf(D, 'ag', opts.focus) : null;
    const head = out.level === 'agent' ? focus : route;
    out.head = head;
    if (task.mode === 'chegar') {
      const available = diffDays(today, date);
      out.available = available;
      if (available <= 0) return { ...out, state: 'past' };
      // Com Entrega final, a chegada ao destino precisa acontecer antes da data
      // pela perna nacional; entra o P90 dela (o lado conservador, a validar).
      const legDays = out.basis === 'final' ? out.leg.p90 : 0;
      out.portTarget = addDays(date, -legDays);
      out.margin = available - legDays;
      if (out.margin < head.min) return { ...out, state: 'before_min' };
      out.limitP90 = addDays(out.portTarget, -head.p90);
      out.limitMedian = addDays(out.portTarget, -Math.ceil(head.median));
      out.coverToday = coverage(head.values, out.margin);
      // A cobertura de cada data limite é contada, não suposta: "9 de 10" e
      // "metade" são o que o histórico de fato mostra naquela margem.
      out.coverP90 = coverage(head.values, head.p90);
      out.coverMedian = coverage(head.values, Math.ceil(head.median));
    } else {
      if (diffDays(today, date) < 0) return { ...out, state: 'past' };
      out.arrivalMedian = addDays(date, Math.ceil(head.median));
      out.arrivalP90 = addDays(date, head.p90);
      if (out.basis === 'final') {
        out.finalMedian = addDays(out.arrivalMedian, Math.ceil(out.leg.median));
        out.finalP90 = addDays(out.arrivalP90, out.leg.p90);
      }
    }
    agentRows(out);
    return out;
  }

  /**
   * S4: uma linha por agente de carga da rota e modal. Cobertura e embarque
   * limite saem da MESMA margem do resultado; com menos de MIN_SAMPLE trânsitos,
   * "Amostra pequena" e nada calculado. Prometido × histórico só quando o
   * cliente digitou o prometido. Nenhuma linha é "a melhor".
   */
  function agentRows(out) {
    const t = out.task;
    out.agents = out.agents.map((a) => {
      const row = { ...a };
      const promised = t.promised[a.agent];
      if (promised) row.promised = { days: promised, ...(a.small ? {} : coverage(a.values, promised)) };
      if (a.small) return row;
      if (t.mode === 'chegar') {
        row.cover = coverage(a.values, out.margin);
        row.limitP90 = addDays(out.portTarget, -a.p90);
        row.limitMedian = addDays(out.portTarget, -Math.ceil(a.median));
      } else {
        row.arrivalMedian = addDays(t.departure, Math.ceil(a.median));
        row.arrivalP90 = addDays(t.departure, a.p90);
      }
      return row;
    });
  }
  const AGENT_SORT = {
    name: (r) => r.name, shipments: (r) => r.shipments, median: (r) => r.median, p90: (r) => r.p90, spread: (r) => r.spread,
    cover: (r) => (r.cover ? r.cover.pct : null), limit: (r) => r.limitP90 || r.arrivalP90 || null,
  };
  const DEFAULT_AGENT_SORT = { key: 'shipments', dir: 'desc' };
  /** Volume por padrão, como nas outras subabas; sem valor (amostra pequena) sempre no fim. */
  function sortAgents(rows, sort = DEFAULT_AGENT_SORT) {
    const get = AGENT_SORT[sort.key] || AGENT_SORT.shipments, sign = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = get(a), vb = get(b), na = va == null, nb = vb == null;
      if (na !== nb) return na ? 1 : -1;
      if (!na && va !== vb) return (typeof va === 'string' ? va.localeCompare(vb, 'pt-BR') : va - vb) * sign;
      return b.shipments - a.shipments || a.name.localeCompare(b.name, 'pt-BR');
    });
  }
  function nextAgentSort(cur, key) {
    if (cur && cur.key === key) return { key, dir: cur.dir === 'desc' ? 'asc' : 'desc' };
    return { key, dir: key === 'name' || key === 'limit' ? 'asc' : 'desc' };
  }

  const api = { SOURCES, DEFAULT_SOURCE, sourceLabel, cargoOfRoute, historyMine, historyReference, hasBase, readPromised, writePromised, agentRows, sortAgents, nextAgentSort, DEFAULT_AGENT_SORT, MODES, MODALS, EXAMPLE, modalOfRoute, modalLabel, readTask, stats, coverage, coverageBand, taskOps, plan, MIN_SAMPLE, HIGH_PERCENTILE, WINDOWS, DEFAULT_WINDOW, readWindow, windowStart, inWindow, windowLabel, percentile, median, weekStart, weekLabel, weekWindow, simulate, howCalculated, addDays, diffDays, validIso };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.IntelSim = api;
})(typeof window !== 'undefined' ? window : globalThis);

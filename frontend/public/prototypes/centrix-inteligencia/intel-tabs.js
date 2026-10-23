'use strict';
// Abas da Inteligência (23/10/2026, semanal de produto: Vinicius, Orsi, Vitor).
// A primeira tela ficou longa demais; o detalhe virou abas por exportador,
// agente de carga e rota. PURO: recebe o `D` de data.js e devolve linhas,
// ordens e estados; não lê DOM, URL nem storage. Roda no navegador
// (window.IntelTabs) e sob node --test — ver intel-tabs.test.cjs.
//
// Três regras que valem para as três abas:
//   1. DADO, NÃO VEREDITO. Toda coluna é um fato que a fixture permite calcular
//      (contagem, taxa no prazo, mediana de trânsito, frete médio). Nenhuma
//      nota, ranking de "melhor/pior" ou recomendação. A ordem padrão é por
//      VOLUME, que é o único critério neutro.
//   2. AMOSTRA PEQUENA: com menos de 3 embarques a linha leva o selo, e o
//      número continua visível (é o que aconteceu), sem comparação.
//   3. FILTROS GLOBAIS valem para todas as abas: as linhas saem do recorte que
//      a página já calculou (período + filtros). Este módulo não filtra sozinho.
(function (root) {
  const MIN_SAMPLE = 3;

  /** As abas do passado (retrovisor). O Simulador, quando existir, é outra família. */
  const TABS = [
    ['geral', 'Visão geral'],
    ['exportadores', 'Exportadores'],
    ['agentes', 'Agentes de carga'],
    ['rotas', 'Rotas'],
  ];
  const TAB_IDS = TABS.map(([id]) => id);
  /** Aba de cada dimensão de entidade, e o filtro global que ela aplica. */
  const DIM_OF_TAB = { exportadores: 'exp', agentes: 'ag', rotas: 'rota' };
  const FIELD_OF_DIM = { exp: 'supplier', ag: 'agent', rota: 'route' };
  const ENTITY_LABEL = { exp: 'exportador', ag: 'agente', rota: 'rota' };
  /**
   * Hashes antigos (#agentes, #rotas, #compromissos...) que levavam a um bloco
   * da página contínua. Sem id de ficha, eles abrem a aba equivalente.
   */
  const LEGACY_SECTION_TAB = { exportadores: 'exportadores', agentes: 'agentes', rotas: 'rotas', compromissos: 'agentes' };

  /**
   * A aba da URL. Ausente ou desconhecida = Visão geral: é o que faz visões
   * salvas antes das abas (sem `aba` na query) abrirem como sempre abriram.
   */
  function readTab(params, extra = []) {
    const get = (k) => (typeof params.get === 'function' ? params.get(k) : params[k]);
    const v = get('aba');
    return TAB_IDS.includes(v) || extra.includes(v) ? v : 'geral';
  }
  /** Escreve a aba nos parâmetros. Visão geral não ocupa a URL. */
  function writeTab(params, tab) {
    if (!tab || tab === 'geral') params.delete('aba'); else params.set('aba', tab);
    return params;
  }

  // -------------------------------------------------------------- números ---
  function median(values) {
    const v = values.filter((x) => typeof x === 'number' && !Number.isNaN(x)).sort((a, b) => a - b);
    if (!v.length) return null;
    const mid = Math.floor(v.length / 2);
    return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
  }
  /** Trânsito internacional realizado (saída → chegada), só onde as duas datas existem. */
  function transitDays(D, ops) {
    return ops.filter((o) => o.depart && o.arrive).map((o) => D.days(o.depart, o.arrive));
  }
  const rateOf = (a) => ({ rate: a.rate, good: a.good, base: a.eligible.length });

  /**
   * Linhas de comparação de UMA dimensão sobre o recorte. Só colunas factuais:
   * nada aqui pondera, soma em nota ou escolhe vencedor.
   */
  function entityRows(D, ops, dim) {
    const field = FIELD_OF_DIM[dim];
    const total = ops.length;
    const ids = [...new Set(ops.map((o) => o[field]))];
    return ids.map((id) => {
      const g = ops.filter((o) => o[field] === id);
      const f = D.metric('freight', g);
      const transit = transitDays(D, g);
      const audit = D.metric('audit', g);
      return {
        id,
        name: nameOf(D, dim, id),
        n: g.length,
        share: total ? Math.round((g.length / total) * 100) : 0,
        small: g.length < MIN_SAMPLE,
        country: dim === 'exp' ? (D.companies.find((c) => c.id === id) || {}).country || null : null,
        ready: rateOf(D.metric('ready', g)),
        docs: rateOf(D.metric('docs', g)),
        port: rateOf(D.metric('port', g)),
        final: rateOf(D.metric('final', g)),
        audit: rateOf(audit),
        auditDiff: audit.eligible.length - audit.good,
        freightAvg: f.eligible.length ? Math.round(f.total / f.eligible.length) : null,
        transitMedian: median(transit),
        transitN: transit.length,
        agents: new Set(g.map((o) => o.agent)).size,
        routes: new Set(g.map((o) => o.route)).size,
      };
    });
  }
  function nameOf(D, dim, id) {
    if (dim === 'exp') return (D.companies.find((c) => c.id === id) || {}).name || id;
    if (dim === 'ag') return (D.agents.find((a) => a.id === id) || {}).name || id;
    const r = D.routes.find((x) => x.id === id);
    return r ? `${D.locations[r.from].name} → ${D.locations[r.to].name}` : String(id).replace('>', ' → ');
  }

  // ------------------------------------------------------------- colunas ---
  /** Valor de ordenação de uma coluna. Taxa ordena pela taxa; ausente fica no fim. */
  const SORT_VALUE = {
    name: (r) => r.name,
    country: (r) => r.country,
    n: (r) => r.n,
    ready: (r) => r.ready.rate,
    docs: (r) => r.docs.rate,
    port: (r) => r.port.rate,
    final: (r) => r.final.rate,
    audit: (r) => r.audit.rate,
    freightAvg: (r) => r.freightAvg,
    transitMedian: (r) => r.transitMedian,
    agents: (r) => r.agents,
    routes: (r) => r.routes,
  };
  /** As colunas de cada aba, todas factuais (Passo 0d). A primeira é o nome. */
  const COLUMNS = {
    exp: [['name', 'Exportador'], ['country', 'País'], ['n', 'Embarques'], ['ready', 'Prontidão no prazo'], ['docs', 'Documentação sem correção'], ['port', 'Chegada ao destino no prazo'], ['freightAvg', 'Frete médio']],
    ag: [['name', 'Agente de cargas'], ['n', 'Embarques'], ['routes', 'Rotas atendidas'], ['transitMedian', 'Trânsito mediano'], ['port', 'Chegada ao destino no prazo'], ['final', 'Entrega final no prazo'], ['audit', 'Cobrança sem diferença'], ['freightAvg', 'Frete médio']],
    rota: [['name', 'Rota'], ['n', 'Embarques'], ['agents', 'Agentes'], ['transitMedian', 'Trânsito mediano'], ['port', 'Chegada ao destino no prazo'], ['final', 'Entrega final no prazo'], ['freightAvg', 'Frete médio']],
  };
  /** Ordem padrão: volume, do maior para o menor. */
  const DEFAULT_SORT = { key: 'n', dir: 'desc' };

  /**
   * Ordena as linhas. Ausente (null) vai SEMPRE para o fim, nos dois sentidos:
   * "—" no topo de uma coluna leria como o primeiro colocado. Empate desempata
   * pelo volume e depois pelo nome, para a ordem ser estável entre renders.
   */
  function sortRows(rows, sort = DEFAULT_SORT) {
    const get = SORT_VALUE[sort.key] || SORT_VALUE.n;
    const sign = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = get(a), vb = get(b);
      const na = va == null, nb = vb == null;
      if (na !== nb) return na ? 1 : -1;
      if (!na && va !== vb) return (typeof va === 'string' ? va.localeCompare(vb, 'pt-BR') : va - vb) * sign;
      return b.n - a.n || a.name.localeCompare(b.name, 'pt-BR');
    });
  }
  /** Clique no cabeçalho: mesma coluna inverte; coluna nova começa decrescente (texto, crescente). */
  function nextSort(current, key) {
    if (current && current.key === key) return { key, dir: current.dir === 'desc' ? 'asc' : 'desc' };
    return { key, dir: key === 'name' || key === 'country' ? 'asc' : 'desc' };
  }

  // -------------------------------------------------------------- resumo ---
  /**
   * Os poucos números do topo de cada aba: quantas entidades, quem tem a maior
   * participação e quanto as duas maiores concentram. Concentração é fato de
   * volume, não juízo.
   */
  function tabSummary(rows, total) {
    const byVolume = sortRows(rows, DEFAULT_SORT);
    const top = byVolume[0] || null;
    const top2 = byVolume.slice(0, 2).reduce((n, r) => n + r.n, 0);
    return {
      count: rows.length,
      total,
      top: top ? { name: top.name, n: top.n, share: top.share } : null,
      top2Share: total && rows.length > 1 ? Math.round((top2 / total) * 100) : null,
      smallCount: rows.filter((r) => r.small).length,
    };
  }

  // ------------------------------------------------------------- detalhe ---
  /** Embarques da entidade dentro do recorte. */
  function entityOps(ops, dim, id) {
    const field = FIELD_OF_DIM[dim];
    return ops.filter((o) => o[field] === id);
  }
  /**
   * SKUs de um conjunto de embarques (os do exportador, ou os da rota). SKU é do
   * ITEM: um embarque com dois SKUs conta para os dois. Ordem por embarques.
   */
  function skuRows(D, ops) {
    const map = new Map();
    for (const o of ops) {
      for (const sku of new Set((o.items || []).map((i) => i.sku))) {
        const row = map.get(sku) || { sku, desc: (D.skus[sku] || {}).desc || sku, exporter: (D.skus[sku] || {}).exporter || null, n: 0, routes: new Set(), exporters: new Set() };
        row.n += 1; row.routes.add(o.route); row.exporters.add(o.supplier);
        map.set(sku, row);
      }
    }
    return [...map.values()]
      .map((r) => ({ sku: r.sku, desc: r.desc, exporter: r.exporter, n: r.n, small: r.n < MIN_SAMPLE, routes: [...r.routes].sort(), exporters: [...r.exporters].sort() }))
      .sort((a, b) => b.n - a.n || a.sku.localeCompare(b.sku));
  }
  /**
   * Uso e impacto do agente: participação nos embarques, prazo e divergência
   * cotado × cobrado — tudo só do que a fixture registra. A divergência vem da
   * conferência (`audit`); casos em esclarecimento ou não auditados ficam fora,
   * como no KPI "Cobrança sem diferença".
   */
  function agentImpact(D, allOps, id) {
    const g = entityOps(allOps, 'ag', id);
    const audit = D.metric('audit', g);
    const diffs = audit.eligible.filter((o) => o.audit === 'divergencia');
    const transit = g.filter((o) => o.depart && o.arrive);
    const overPlan = transit.filter((o) => D.days(o.depart, o.arrive) > o.transitPlan);
    return {
      n: g.length,
      total: allOps.length,
      share: allOps.length ? Math.round((g.length / allOps.length) * 100) : 0,
      routes: [...new Set(g.map((o) => o.route))],
      transitMedian: median(transit.map((o) => D.days(o.depart, o.arrive))),
      transitBase: transit.length,
      transitOverPlan: overPlan.length,
      port: rateOf(D.metric('port', g)),
      auditBase: audit.eligible.length,
      auditDiffCount: diffs.length,
      auditDiffUsd: diffs.reduce((n, o) => n + (o.extra || 0), 0),
      auditPending: g.filter((o) => o.audit === 'inconclusiva' || o.audit === 'nao-auditada').length,
    };
  }

  /** "Filtrar por este <exportador/agente/rota>": substitui só aquele filtro global. */
  function filterByEntity(filters, dim, id) {
    return { ...filters, [dim]: [id] };
  }
  /** A entidade aberta no painel (`sel`) é válida para a aba atual? */
  function readSelection(D, params, tab) {
    const get = (k) => (typeof params.get === 'function' ? params.get(k) : params[k]);
    const dim = DIM_OF_TAB[tab];
    const id = get('sel');
    if (!dim || !id) return null;
    const known = dim === 'exp' ? D.companies.some((c) => c.id === id) : dim === 'ag' ? D.agents.some((a) => a.id === id) : D.routes.some((r) => r.id === id);
    return known ? { dim, id } : null;
  }
  /** O relatório menciona aba e entidade: "Aba Exportadores · Eastbridge Components". */
  function tabMention(D, tab, selection) {
    const label = tab === 'simulador' ? 'Simulador' : (TABS.find(([id]) => id === tab) || [null, null])[1];
    if (!label || tab === 'geral') return '';
    return selection ? `Aba ${label} · ${nameOf(D, selection.dim, selection.id)}` : `Aba ${label}`;
  }

  const api = { MIN_SAMPLE, TABS, TAB_IDS, DIM_OF_TAB, FIELD_OF_DIM, ENTITY_LABEL, LEGACY_SECTION_TAB, COLUMNS, DEFAULT_SORT, readTab, writeTab, median, transitDays, entityRows, nameOf, sortRows, nextSort, tabSummary, entityOps, skuRows, agentImpact, filterByEntity, readSelection, tabMention };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.IntelTabs = api;
})(typeof window !== 'undefined' ? window : globalThis);

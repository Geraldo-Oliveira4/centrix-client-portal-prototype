'use strict';
// Insight escrito em cada card de métrica (30/09/2026, feedback de marketing:
// "número sem interpretação"). PURO: recebe as operações e o `D` de data.js,
// devolve frase + variação. Roda no navegador (window.Insights) e sob
// node --test (module.exports).
//
// UMA FONTE, SEM NÚMERO NOVO. O número grande do card é o do período (o mesmo
// `D.metric` de sempre); a variação compara o ÚLTIMO mês com dados contra o
// anterior, pelas mesmas coortes (mês do compromisso de prontidão) que o gráfico
// "Como o desempenho evolui" desenha. Quem lê o card reencontra os dois números
// no gráfico — é isso que impede dois cards, ou card e gráfico, de discordarem.
//
// A mesma regra de variação existe no portal React em
// `app/portal/_shared/insight.ts` (InsightLine); mudou lá, mude aqui.

(function (root) {
  const MONTHS = {
    '01': 'janeiro', '02': 'fevereiro', '03': 'março', '04': 'abril',
    '05': 'maio', '06': 'junho', '07': 'julho', '08': 'agosto',
    '09': 'setembro', '10': 'outubro', '11': 'novembro', '12': 'dezembro',
  };

  // Quem é "melhor" em cada métrica. Frete contratado não tem lado bom:
  // gastar mais pode ser volume maior, então a seta aparece sem cor.
  const HIGHER_IS_BETTER = { ready: true, port: true, final: true, docs: true, freight: null };

  function money(n) {
    return 'US$ ' + Math.round(n).toLocaleString('pt-BR');
  }

  /**
   * Variação de `current` contra `previous`.
   * kind 'pp': pontos percentuais (taxas); 'pct': variação relativa (valores).
   * Devolve null quando não há os dois lados — "sem comparação" nunca vira 0.
   */
  function variation(current, previous, kind, higherIsBetter, previousLabel) {
    if (current == null || previous == null) return null;
    const raw = kind === 'pp' ? current - previous : previous === 0 ? null : Math.round(((current - previous) / previous) * 100);
    if (raw == null) return null;
    const delta = Math.abs(raw);
    const direction = raw > 0 ? 'up' : raw < 0 ? 'down' : 'flat';
    const tone = direction === 'flat' || higherIsBetter == null ? 'neutral' : (direction === 'up') === higherIsBetter ? 'good' : 'bad';
    const unit = kind === 'pp' ? (delta === 1 ? 'ponto' : 'pontos') : '%';
    const amount = kind === 'pp' ? `${delta} ${unit}` : `${delta}%`;
    const text = direction === 'flat' ? `igual a ${previousLabel}` : `${amount} ${direction === 'up' ? 'acima' : 'abaixo'} de ${previousLabel}`;
    return { delta: raw, direction, tone, text };
  }

  /** Meses com dado, em ordem, pela coorte do compromisso de prontidão. */
  function cohorts(ops) {
    return Array.from(new Set(ops.map((o) => o.readyPlan && o.readyPlan.slice(5, 7)).filter(Boolean))).sort();
  }

  function valueOf(D, key, ops) {
    const a = D.metric(key, ops);
    return a.m.amount ? (a.eligible.length ? a.total : null) : a.rate;
  }

  // Mês com menos de 3 embarques elegíveis não entra na comparação: uma coorte
  // de 1 embarque vira "100%, 80 pontos acima" e diz mais sobre a amostra do
  // que sobre a operação. A frase também mostra a base ("3 de 3 no prazo").
  const MIN_BASE = 3;

  /** O par (mês, mês anterior) mais recente em que os dois têm base. */
  function comparablePair(D, key, ops) {
    const months = cohorts(ops).filter(
      (m) => D.metric(key, ops.filter((o) => o.readyPlan.slice(5, 7) === m)).eligible.length >= MIN_BASE,
    );
    return months.length >= 2 ? months.slice(-2) : null;
  }

  /** A rota que mais puxa a taxa para baixo (mínimo de 2 elegíveis). */
  function worstRoute(D, key, ops, overall) {
    let worst = null;
    for (const r of D.routes) {
      const a = D.metric(key, ops.filter((o) => o.route === r.id));
      if (a.rate == null || a.eligible.length < 2 || a.rate >= overall) continue;
      if (!worst || a.rate < worst.rate) worst = { route: r, rate: a.rate, good: a.good, eligible: a.eligible.length };
    }
    if (!worst) return null;
    const name = `${D.locations[worst.route.from].name} → ${D.locations[worst.route.to].name}`;
    return { ...worst, name, text: `Onde pesa mais: ${name}, ${worst.good} de ${worst.eligible} no prazo.` };
  }

  const LEAD = {
    ready: (v) => `Seus fornecedores deixaram a carga pronta no prazo em ${v}% dos embarques.`,
    port: (v) => `${v}% das cargas chegaram ao porto de destino no prazo.`,
    final: (v) => `${v}% das entregas chegaram ao destino final no prazo.`,
    docs: (v) => `${v}% dos embarques tiveram a documentação aceita sem correção.`,
    freight: (v) => `Você contratou ${money(v)} de frete internacional no período.`,
  };

  // ---------------------------------------------------------------------------
  // MÊS DE REFERÊNCIA ÚNICO (01/10/2026). Todos os cards comparam o MESMO par
  // de meses: o último mês FECHADO do fixture contra o anterior. "Fechado" é a
  // coorte (mês do compromisso de prontidão) em que toda operação já tem entrega
  // final confirmada — agosto ainda tem carga em trânsito, e compará-lo deixaria
  // chegada e entrega com 1 ou 2 operações. Sai dos dados, não é mês chumbado.
  // ---------------------------------------------------------------------------

  /** [mês anterior, mês de referência] do fixture inteiro, ou null. */
  function referencePair(D) {
    const all = D.operations;
    const closed = cohorts(all).filter((m) => all.filter((o) => monthOf(o) === m).every((o) => o.final));
    if (!closed.length) return null;
    const ref = closed[closed.length - 1];
    const months = cohorts(all);
    const prev = months[months.indexOf(ref) - 1];
    return prev ? [prev, ref] : null;
  }

  // Abaixo de 8 operações a frase diz o tamanho da amostra e troca afirmação
  // absoluta por linguagem de dado ("é a rota com maior desvio médio no
  // período", não "é a que mais trava a sua operação").
  const SMALL_SAMPLE = 8;
  /** "Ningbo → Itajaí, em 5 operações:" — a amostra vem antes do número. */
  const sampleLead = (name, n) => (n < SMALL_SAMPLE ? `${name}, em ${n} ${n === 1 ? 'operação' : 'operações'}:` : `${name}:`);

  const NO_CHANGE = 'Sem variação relevante no período.';

  /** A frase da variação, sempre dizendo QUAIS meses foram comparados. */
  function variationSentence(change, pair, base, monthly = true, subject = '') {
    if (!monthly) return 'Sem comparação mensal para este indicador.';
    if (!pair) return 'Sem mês fechado para comparar.';
    const [prev, ref] = pair.map((m) => MONTHS[m]);
    if (!change) return `Sem base suficiente para comparar ${ref} com ${prev}${base != null ? ` (${base} em ${ref})` : ''}.`;
    return `Em ${ref}, ${subject ? `${subject} ficou ` : ''}${change.text}.`;
  }

  /** Tudo o que um card precisa dizer sobre uma métrica. */
  function card(D, key, ops) {
    const m = D.metrics[key];
    const kind = m.amount ? 'pct' : 'pp';
    const value = valueOf(D, key, ops);
    if (value == null) {
      const sentence = 'Sem base suficiente neste recorte para ler esta métrica.';
      return { value: null, sentence, detail: '', variation: null, latest: null, worst: null, conclusion: NO_CHANGE, summary: sentence };
    }
    const pair = referencePair(D);
    let latest = null;
    let change = null;
    let refBase = null;
    if (pair) {
      const [prev, cur] = pair;
      const curOps = ops.filter((o) => monthOf(o) === cur);
      const prevOps = ops.filter((o) => monthOf(o) === prev);
      const a = D.metric(key, curOps);
      refBase = a.eligible.length;
      if (refBase >= MIN_BASE && D.metric(key, prevOps).eligible.length >= MIN_BASE) {
        const curValue = valueOf(D, key, curOps);
        latest = { month: MONTHS[cur], value: curValue, good: a.good, base: refBase };
        change = variation(curValue, valueOf(D, key, prevOps), kind, HIGHER_IS_BETTER[key] ?? null, MONTHS[prev]);
      }
    }
    const shown = (v) => (kind === 'pp' ? `${v}%` : money(v));
    const lead = (LEAD[key] || ((v) => `${m.label}: ${shown(v)}.`))(value);
    const cap = (t) => t[0].toUpperCase() + t.slice(1);
    const detail =
      latest && change
        ? kind === 'pp'
          ? `${cap(latest.month)}: ${latest.good} de ${latest.base} no prazo (${latest.value}%).`
          : `${cap(latest.month)}: ${shown(latest.value)} em ${latest.base} operações.`
        : variationSentence(null, pair, refBase);
    const worst = kind === 'pp' ? worstRoute(D, key, ops, value) : null;
    const sentence = worst ? `${lead} ${worst.text}` : lead;
    const conclusion = conclude(key, change);
    const metricText = kind === 'pp' ? `${shown(value)} no prazo no período` : `${shown(value)} de frete contratado no período`;
    const subject = kind === 'pp' ? 'a taxa no prazo' : 'o frete contratado';
    const summary = `${metricText}. ${variationSentence(change, pair, refBase, true, subject)} ${conclusion}`;
    return { value, sentence, detail, variation: change, latest, worst, conclusion, summary };
  }

  // ---------------------------------------------------------------------------
  // CONCLUSÃO. Todo card diz métrica + variação + conclusão; a conclusão SAI
  // DA VARIAÇÃO, nunca é texto fixo. Sem variação comparável: NO_CHANGE.
  // ---------------------------------------------------------------------------

  const SUBJECT = {
    ready: 'A prontidão dos seus fornecedores',
    port: 'A pontualidade de chegada ao porto',
    final: 'A pontualidade da entrega final',
    docs: 'A qualidade documental',
  };

  /** "Está melhorando / piorando / estável", a partir da variação. */
  function conclude(key, change) {
    if (!change) return NO_CHANGE;
    if (HIGHER_IS_BETTER[key] == null) {
      // Frete: gastar mais pode ser volume maior; a frase descreve, não julga.
      if (change.direction === 'flat') return 'O volume contratado está estável.';
      return `Você contratou ${change.direction === 'up' ? 'mais' : 'menos'} frete do que no mês anterior.`;
    }
    const subject = SUBJECT[key] || 'Este indicador';
    if (change.direction === 'flat') return `${subject} está estável.`;
    return `${subject} está ${change.tone === 'good' ? 'melhorando' : 'piorando'}.`;
  }

  const monthOf = (o) => o.readyPlan.slice(5, 7);
  const oneDecimal = (n) => (Math.round(n * 10) / 10).toLocaleString('pt-BR');

  /** Monta o objeto de um card de conclusão, com a frase completa. */
  function insight(fields) {
    const { metric, variation: change, conclusion, pair, refBase, monthly = true, subject = '' } = fields;
    return { ...fields, summary: `${metric} ${variationSentence(change, pair, refBase, monthly, subject)} ${conclusion}` };
  }

  /** Desvios de um trecho: quantos estouraram o previsto e por quanto. */
  function stageStats(D, stage, ops) {
    const done = ops.filter((o) => o[stage.from] && o[stage.to]);
    const over = done
      .map((o) => D.days(o[stage.from], o[stage.to]) - stage.plan(o))
      .filter((d) => d > 0);
    return {
      base: done.length,
      over: over.length,
      rate: done.length ? Math.round((over.length / done.length) * 100) : null,
      avgExtra: over.length ? over.reduce((n, d) => n + d, 0) / over.length : null,
    };
  }

  /** Variação de uma taxa no par de referência, ou null sem base mínima. */
  function pairChange(rateOf, ops, pair, higherIsBetter) {
    if (!pair) return { change: null, refBase: null };
    const [prev, cur] = pair;
    const a = rateOf(ops.filter((o) => monthOf(o) === cur));
    const b = rateOf(ops.filter((o) => monthOf(o) === prev));
    if (a.base < MIN_BASE || b.base < MIN_BASE) return { change: null, refBase: a.base };
    return { change: variation(a.rate, b.rate, 'pp', higherIsBetter, MONTHS[prev]), refBase: a.base };
  }

  /** Prazos e etapas: o trecho que mais estoura o previsto, e por quanto. */
  function stageInsight(D, ops) {
    const pair = referencePair(D);
    let worst = null;
    for (const stage of D.stages) {
      const st = stageStats(D, stage, ops);
      if (!st.base || !st.over) continue;
      if (!worst || st.rate > worst.rate || (st.rate === worst.rate && st.avgExtra > worst.avgExtra)) worst = { stage, ...st };
    }
    if (!worst) {
      return insight({ title: 'Prazos e etapas', value: null, metric: 'Nenhum trecho passou do previsto neste recorte.', variation: null, conclusion: NO_CHANGE, relevant: false, pair });
    }
    // Menos estouro é melhor: higherIsBetter = false.
    const { change, refBase } = pairChange((g) => stageStats(D, worst.stage, g), ops, pair, false);
    const others = D.stages.filter((s) => s !== worst.stage && stageStats(D, s, ops).over > 0);
    const conclusion =
      `É o trecho com mais embarques acima do previsto no período` +
      (others.length ? `; ${others.map((s) => s.label.toLowerCase()).join(' e ')} também passou do previsto.` : '; os demais ficaram dentro do prazo.');
    return insight({
      title: worst.stage.label,
      value: worst.rate,
      metric: `${worst.stage.label}: ${worst.over} de ${worst.base} embarques passaram do previsto, em média +${oneDecimal(worst.avgExtra)} dias.`,
      variation: change,
      conclusion,
      relevant: true,
      pair,
      refBase,
      subject: 'a parcela acima do previsto',
    });
  }

  /** Fornecedores: quem piorou, no par de referência; sem base, NO_CHANGE. */
  function supplierInsight(D, ops) {
    const pair = referencePair(D);
    const rows = D.companies
      .map((c) => {
        const own = ops.filter((o) => o.supplier === c.id);
        const a = D.metric('ready', own);
        return { company: c, ops: own, rate: a.rate, good: a.good, base: a.eligible.length, change: card(D, 'ready', own).variation };
      })
      .filter((r) => r.base);
    if (!rows.length) {
      return insight({ title: 'Prontidão por fornecedor', value: null, metric: 'Sem confirmação de prontidão neste recorte.', variation: null, conclusion: NO_CHANGE, relevant: false, pair });
    }
    const list = rows.map((r) => `${r.company.name} ${r.rate}% (${r.good} de ${r.base} operações)`).join(', ');
    const worse = rows.filter((r) => r.change && r.change.tone === 'bad').sort((x, y) => x.change.delta - y.change.delta)[0];
    const better = rows.filter((r) => r.change && r.change.tone === 'good').sort((x, y) => y.change.delta - x.change.delta)[0];
    const pick = worse || better;
    return insight({
      title: 'Prontidão por fornecedor',
      value: pick ? pick.rate : null,
      metric: `Prontidão no prazo no período: ${list}.`,
      variation: pick ? pick.change : null,
      conclusion: worse ? `${worse.company.name} foi o fornecedor que mais caiu no período.` : better ? `${better.company.name} foi o fornecedor que mais subiu no período.` : NO_CHANGE,
      relevant: !!pick,
      pair,
    });
  }

  /**
   * Agentes: CONCENTRAÇÃO de contratações, não nota de agente (avaliar o
   * desempenho de cada agente é decisão pendente com o Orsi).
   */
  function agentInsight(D, ops) {
    const pair = referencePair(D);
    if (!ops.length) {
      return insight({ title: 'Contratações por agente', value: null, metric: 'Sem contratações neste recorte.', variation: null, conclusion: NO_CHANGE, relevant: false, pair });
    }
    const counts = D.agents.map((a) => ({ agent: a, n: ops.filter((o) => o.agent === a.id).length })).filter((x) => x.n).sort((a, b) => b.n - a.n);
    const top = counts[0];
    const share = Math.round((top.n / ops.length) * 100);
    const shareOf = (g) => ({ base: g.length, rate: g.length ? Math.round((g.filter((o) => o.agent === top.agent.id).length / g.length) * 100) : null });
    const { change, refBase } = pairChange(shareOf, ops, pair, null);
    return insight({
      title: 'Contratações por agente',
      value: share,
      metric: `${ops.length < SMALL_SAMPLE ? `Em ${ops.length} contratações, ` : ''}${top.agent.name} concentrou ${top.n} de ${ops.length} contratações (${share}%).`,
      variation: change,
      conclusion: share >= 50 ? 'Metade ou mais das contratações do período ficou com um único agente.' : `As contratações do período se dividiram entre ${counts.length} agentes.`,
      relevant: share >= 50,
      pair,
      refBase,
      subject: `a participação da ${top.agent.name}`,
    });
  }

  /**
   * Rotas: a de maior desvio médio (dias) da chegada ao porto sobre o 1º ETA,
   * entre rotas com pelo menos 2 chegadas. Menos de 1 dia de média: NO_CHANGE.
   */
  function routeInsight(D, ops) {
    const pair = referencePair(D);
    let worst = null;
    for (const r of D.routes) {
      const own = ops.filter((o) => o.route === r.id && o.arrive);
      if (own.length < 2) continue;
      const devs = own.map((o) => Math.max(0, D.days(o.arrivePlan, o.arrive)));
      const avg = devs.reduce((n, d) => n + d, 0) / devs.length;
      const a = D.metric('port', ops.filter((o) => o.route === r.id));
      if (!worst || avg > worst.avg) worst = { route: r, avg, peak: Math.max(...devs), good: a.good, base: a.eligible.length, rate: a.rate, n: own.length };
    }
    if (!worst || worst.avg < 1) {
      return insight({ title: 'Rotas', value: null, metric: 'Nenhuma rota com desvio médio de chegada acima de 1 dia.', variation: null, conclusion: NO_CHANGE, relevant: false, pair });
    }
    const name = `${D.locations[worst.route.from].name} → ${D.locations[worst.route.to].name}`;
    const routeOps = ops.filter((o) => o.route === worst.route.id);
    const { change, refBase } = pairChange((g) => { const a = D.metric('port', g); return { base: a.eligible.length, rate: a.rate }; }, routeOps, pair, true);
    return insight({
      title: name,
      value: worst.rate,
      metric: `${sampleLead(name, worst.n)} ${worst.good} de ${worst.base} chegadas ao porto no prazo e desvio médio de +${oneDecimal(worst.avg)} dias sobre o 1º ETA, pico de +${worst.peak}.`,
      variation: change,
      conclusion: 'É a rota com maior desvio médio de chegada no período.',
      relevant: true,
      pair,
      refBase,
      subject: 'a chegada no prazo nesta rota',
    });
  }

  /**
   * Locais: onde a carga fica mais tempo entre a chegada e o gate out
   * (previsto: 3 dias), entre portos com pelo menos 2 passagens completas.
   */
  const PORT_PLAN_DAYS = 3;
  function localInsight(D, ops) {
    const pair = referencePair(D);
    let worst = null;
    for (const id of new Set(D.routes.map((r) => r.to))) {
      const done = ops.filter((o) => D.routes.find((r) => r.id === o.route).to === id && o.arrive && o.gate);
      if (done.length < 2) continue;
      const dwell = done.map((o) => D.days(o.arrive, o.gate));
      const avg = dwell.reduce((n, d) => n + d, 0) / dwell.length;
      const over = dwell.filter((d) => d > PORT_PLAN_DAYS).length;
      if (!worst || avg > worst.avg) worst = { id, avg, over, base: done.length };
    }
    if (!worst) {
      return insight({ title: 'Locais', value: null, metric: 'Sem passagens completas suficientes nos portos de destino.', variation: null, conclusion: NO_CHANGE, relevant: false, pair, monthly: false });
    }
    const name = D.locations[worst.id].name;
    const relevant = worst.avg - PORT_PLAN_DAYS >= 1;
    return insight({
      title: name,
      value: null,
      metric: `${sampleLead(name, worst.base)} média de ${oneDecimal(worst.avg)} dias entre a chegada e o gate out (previsto ${PORT_PLAN_DAYS}); ${worst.over} de ${worst.base} passagens acima.`,
      variation: null,
      monthly: false,
      conclusion: relevant ? `${name} é o porto com maior permanência média no período.` : NO_CHANGE,
      relevant,
      pair,
    });
  }

  const Insights = {
    variation, cohorts, comparablePair, referencePair, worstRoute, card, conclude,
    stageInsight, supplierInsight, agentInsight, routeInsight, localInsight,
    HIGHER_IS_BETTER, MIN_BASE, NO_CHANGE, SMALL_SAMPLE,
  };
  if (typeof module !== 'undefined') module.exports = Insights;
  else root.Insights = Insights;
})(typeof window !== 'undefined' ? window : globalThis);

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
  // Abaixo de 5 (p.p. em taxa, % em valor) a variação é ESTÁVEL: seta sem cor
  // e conclusão "Estável." — 3 p.p. em amostra de 5 a 7 operações é ruído.
  const STABLE_BELOW = 5;

  function variation(current, previous, kind, higherIsBetter, previousLabel) {
    if (current == null || previous == null) return null;
    const raw = kind === 'pp' ? current - previous : previous === 0 ? null : Math.round(((current - previous) / previous) * 100);
    if (raw == null) return null;
    const delta = Math.abs(raw);
    const direction = raw > 0 ? 'up' : raw < 0 ? 'down' : 'flat';
    const stable = delta < STABLE_BELOW;
    const tone = stable || higherIsBetter == null ? 'neutral' : (direction === 'up') === higherIsBetter ? 'good' : 'bad';
    const amount = kind === 'pp' ? `${delta} p.p.` : `${delta}%`;
    const text = direction === 'flat' ? `igual a ${previousLabel}` : `${amount} ${direction === 'up' ? 'acima' : 'abaixo'} de ${previousLabel}`;
    return { delta: raw, direction, tone, stable, text };
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
  // final confirmada. Sai dos dados, não é mês chumbado.
  //
  // FRASE (mesma data, pedido de copy): "<Mês>: <valor>, <variação>.
  // <Conclusão>." O valor é o do MÊS, com a amostra ("5 de 7"); sem comparação,
  // a frase diz o motivo. Contexto do período e ressalvas vão em `note`.
  // ---------------------------------------------------------------------------

  const monthOf = (o) => o.readyPlan.slice(5, 7);
  const oneDecimal = (n) => (Math.round(n * 10) / 10).toLocaleString('pt-BR');
  const cap = (t) => t[0].toUpperCase() + t.slice(1);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const daysText = (n) => `${oneDecimal(n)} ${Math.abs(n) < 2 ? 'dia' : 'dias'}`;

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

  const SMALL_SAMPLE = 8;
  const NO_CHANGE = 'Sem variação relevante no período.';

  /** "Julho: <valor>, <variação>. <Conclusão>." ou o motivo da falta de comparação. */
  function sentence(pair, valueText, change, conclusion, reason) {
    const [prev, ref] = pair.map((m) => MONTHS[m]);
    if (change) return `${cap(ref)}: ${valueText}, ${change.text}. ${conclusion}`;
    return `${cap(ref)}: ${valueText ? `${valueText}; ` : ''}sem comparação com ${prev}: ${reason}. ${conclusion}`;
  }
  const baseReason = (prevBase, refBase, unit) =>
    `${refBase < MIN_BASE && prevBase < MIN_BASE ? 'os dois meses têm' : refBase < MIN_BASE ? 'o mês tem' : 'o mês anterior tem'} menos de ${MIN_BASE} ${unit}`;

  /** Conclusão curta, a partir da variação. */
  function conclude(key, change) {
    if (!change) return NO_CHANGE;
    if (change.stable) return 'Estável.';
    if (HIGHER_IS_BETTER[key] == null) return `${change.direction === 'up' ? 'Mais' : 'Menos'} frete que no mês anterior.`;
    return change.tone === 'good' ? 'Melhorando.' : 'Piorando.';
  }

  /** Tudo o que um card do Resumo precisa dizer sobre uma métrica. */
  function card(D, key, ops) {
    const m = D.metrics[key];
    const kind = m.amount ? 'pct' : 'pp';
    const value = valueOf(D, key, ops);
    const pair = referencePair(D);
    if (value == null || !pair) {
      const text = 'Sem base suficiente neste recorte para ler esta métrica.';
      return { value: null, sentence: text, detail: '', variation: null, latest: null, worst: null, conclusion: NO_CHANGE, summary: text };
    }
    const [prev, cur] = pair;
    const curOps = ops.filter((o) => monthOf(o) === cur);
    const prevOps = ops.filter((o) => monthOf(o) === prev);
    const a = D.metric(key, curOps);
    const b = D.metric(key, prevOps);
    const curValue = valueOf(D, key, curOps);
    const comparable = a.eligible.length >= MIN_BASE && b.eligible.length >= MIN_BASE;
    const change = comparable ? variation(curValue, valueOf(D, key, prevOps), kind, HIGHER_IS_BETTER[key] ?? null, MONTHS[prev]) : null;
    const latest = curValue == null ? null : { month: MONTHS[cur], value: curValue, good: a.good, base: a.eligible.length };
    const valueText =
      curValue == null
        ? ''
        : kind === 'pp'
          ? `${curValue}% no prazo (${a.good} de ${a.eligible.length})`
          : `${money(curValue)} contratados em ${plural(a.eligible.length, 'operação', 'operações')}`;
    const conclusion = conclude(key, change);
    const summary = sentence(pair, valueText, change, conclusion, baseReason(b.eligible.length, a.eligible.length, kind === 'pp' ? 'operações elegíveis' : 'operações com valor'));
    const worst = kind === 'pp' ? worstRoute(D, key, ops, value) : null;
    const lead = (LEAD[key] || ((v) => `${m.label}: ${v}.`))(value);
    return { value, sentence: worst ? `${lead} ${worst.text}` : lead, detail: '', variation: change, latest, worst, conclusion, summary };
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

  /** Variação em DIAS (menos é melhor); estável abaixo de 1 dia. */
  function daysChange(cur, prev, previousLabel) {
    const raw = Math.round((cur - prev) * 10) / 10;
    const direction = raw > 0 ? 'up' : raw < 0 ? 'down' : 'flat';
    const stable = Math.abs(raw) < 1;
    const tone = stable ? 'neutral' : direction === 'down' ? 'good' : 'bad';
    const text = direction === 'flat' ? `igual a ${previousLabel}` : `${daysText(Math.abs(raw))} ${direction === 'up' ? 'acima' : 'abaixo'} de ${previousLabel}`;
    return { delta: raw, direction, tone, stable, text };
  }

  const verdict = (change) => (!change ? NO_CHANGE : change.stable ? 'Estável.' : change.tone === 'good' ? 'Melhorando.' : 'Piorando.');

  /** Prazos e etapas: o trecho que mais estoura o previsto no período. */
  function stageInsight(D, ops) {
    const pair = referencePair(D);
    let worst = null;
    for (const stage of D.stages) {
      const st = stageStats(D, stage, ops);
      if (!st.base || !st.over) continue;
      if (!worst || st.rate > worst.rate || (st.rate === worst.rate && st.avgExtra > worst.avgExtra)) worst = { stage, ...st };
    }
    if (!worst || !pair) {
      return { title: 'Prazos e etapas', variation: null, conclusion: NO_CHANGE, relevant: false, summary: 'Nenhum trecho passou do previsto neste recorte.', note: '' };
    }
    const [prev, cur] = pair;
    const a = stageStats(D, worst.stage, ops.filter((o) => monthOf(o) === cur));
    const b = stageStats(D, worst.stage, ops.filter((o) => monthOf(o) === prev));
    // Menos estouro é melhor: higherIsBetter = false.
    const change = a.base >= MIN_BASE && b.base >= MIN_BASE ? variation(a.rate, b.rate, 'pp', false, MONTHS[prev]) : null;
    const valueText = a.base ? `${worst.stage.label.toLowerCase()} acima do previsto em ${a.rate}% dos embarques (${a.over} de ${a.base})` : '';
    const conclusion = verdict(change);
    const others = D.stages.filter((s) => s !== worst.stage && stageStats(D, s, ops).over > 0);
    return {
      title: worst.stage.label,
      value: worst.rate,
      variation: change,
      conclusion,
      relevant: !!change && !change.stable,
      summary: sentence(pair, valueText, change, conclusion, baseReason(b.base, a.base, 'embarques com os dois marcos')),
      note: `No período, é o trecho com mais embarques acima do previsto: ${worst.over} de ${worst.base}, em média +${daysText(worst.avgExtra)}.${others.length ? ` ${cap(others.map((x) => x.label.toLowerCase()).join(' e '))} também passou do previsto.` : ''}`,
    };
  }

  /** Fornecedores: quem mais mudou no mês de referência; sem base, o motivo. */
  function supplierInsight(D, ops) {
    const pair = referencePair(D);
    const rows = D.companies
      .map((c) => {
        const own = ops.filter((o) => o.supplier === c.id);
        const p = D.metric('ready', own);
        return { company: c, own, rate: p.rate, good: p.good, base: p.eligible.length };
      })
      .filter((r) => r.base);
    if (!rows.length || !pair) {
      return { title: 'Prontidão por fornecedor', variation: null, conclusion: NO_CHANGE, relevant: false, summary: 'Sem confirmação de prontidão neste recorte.', note: '' };
    }
    const [prev, cur] = pair;
    for (const r of rows) {
      const a = D.metric('ready', r.own.filter((o) => monthOf(o) === cur));
      const b = D.metric('ready', r.own.filter((o) => monthOf(o) === prev));
      r.month = a;
      r.change = a.eligible.length >= MIN_BASE && b.eligible.length >= MIN_BASE ? variation(a.rate, b.rate, 'pp', true, MONTHS[prev]) : null;
    }
    const moved = rows.filter((r) => r.change).sort((x, y) => Math.abs(y.change.delta) - Math.abs(x.change.delta))[0];
    const period = `No período: ${rows.map((r) => `${r.company.name} ${r.rate}% (${r.good} de ${plural(r.base, 'operação', 'operações')})`).join(', ')}.`;
    const without = rows.filter((r) => !r.change).map((r) => r.company.name);
    const note = `${period}${moved && without.length ? ` Sem comparação para ${without.join(' e ')}: menos de ${MIN_BASE} operações em um dos meses.` : ''}`;
    if (!moved) {
      return {
        title: 'Prontidão por fornecedor',
        variation: null,
        conclusion: NO_CHANGE,
        relevant: false,
        summary: sentence(pair, '', null, NO_CHANGE, `nenhum fornecedor tem ${MIN_BASE} operações elegíveis nos dois meses`),
        note: period,
      };
    }
    const conclusion = verdict(moved.change);
    return {
      title: 'Prontidão por fornecedor',
      value: moved.month.rate,
      variation: moved.change,
      conclusion,
      relevant: !moved.change.stable,
      summary: sentence(pair, `${moved.company.name} com ${moved.month.rate}% no prazo (${moved.month.good} de ${moved.month.eligible.length})`, moved.change, conclusion),
      note,
    };
  }

  /**
   * Agentes: CONCENTRAÇÃO de contratações, não nota de agente (avaliar o
   * desempenho de cada agente é decisão pendente com o Orsi).
   */
  function agentInsight(D, ops) {
    const pair = referencePair(D);
    if (!ops.length || !pair) {
      return { title: 'Contratações por agente', variation: null, conclusion: NO_CHANGE, relevant: false, summary: 'Sem contratações neste recorte.', note: '' };
    }
    const [prev, cur] = pair;
    const counts = D.agents.map((a) => ({ agent: a, n: ops.filter((o) => o.agent === a.id).length })).filter((x) => x.n).sort((a, b) => b.n - a.n);
    const top = counts[0];
    const share = Math.round((top.n / ops.length) * 100);
    const curOps = ops.filter((o) => monthOf(o) === cur);
    const prevOps = ops.filter((o) => monthOf(o) === prev);
    const shareOf = (g) => (g.length ? Math.round((g.filter((o) => o.agent === top.agent.id).length / g.length) * 100) : null);
    const change = curOps.length >= MIN_BASE && prevOps.length >= MIN_BASE ? variation(shareOf(curOps), shareOf(prevOps), 'pp', null, MONTHS[prev]) : null;
    const conclusion = !change ? NO_CHANGE : change.stable ? 'Estável.' : change.direction === 'up' ? 'Mais concentrado.' : 'Menos concentrado.';
    const nTop = curOps.filter((o) => o.agent === top.agent.id).length;
    return {
      title: 'Contratações por agente',
      value: share,
      variation: change,
      conclusion,
      relevant: share >= 50,
      summary: sentence(pair, curOps.length ? `${top.agent.name} com ${shareOf(curOps)}% das contratações (${nTop} de ${curOps.length})` : '', change, conclusion, baseReason(prevOps.length, curOps.length, 'contratações')),
      note: `No período: ${top.agent.name} concentrou ${top.n} de ${ops.length} contratações (${share}%)${share >= 50 ? ', metade ou mais com um único agente' : ''}.`,
    };
  }

  /** Desvio médio (dias, só atraso) da chegada sobre o 1º ETA. */
  const avgDev = (D, g) => {
    const arrived = g.filter((o) => o.arrive);
    return { base: arrived.length, avg: arrived.length ? arrived.reduce((n, o) => n + Math.max(0, D.days(o.arrivePlan, o.arrive)), 0) / arrived.length : null };
  };

  /**
   * Rotas: a de maior desvio médio (dias) da chegada ao porto sobre o 1º ETA no
   * período, entre rotas com pelo menos 2 chegadas. A frase compara o mês.
   */
  function routeInsight(D, ops) {
    const pair = referencePair(D);
    let worst = null;
    for (const r of D.routes) {
      const own = ops.filter((o) => o.route === r.id);
      const st = avgDev(D, own);
      if (st.base < 2) continue;
      const peak = Math.max(...own.filter((o) => o.arrive).map((o) => Math.max(0, D.days(o.arrivePlan, o.arrive))));
      if (!worst || st.avg > worst.avg) worst = { route: r, own, ...st, peak };
    }
    if (!worst || worst.avg < 1 || !pair) {
      return { title: 'Rotas', variation: null, conclusion: NO_CHANGE, relevant: false, summary: 'Nenhuma rota com desvio médio de chegada acima de 1 dia neste recorte.', note: '' };
    }
    const [prev, cur] = pair;
    const name = `${D.locations[worst.route.from].name} → ${D.locations[worst.route.to].name}`;
    const a = avgDev(D, worst.own.filter((o) => monthOf(o) === cur));
    const b = avgDev(D, worst.own.filter((o) => monthOf(o) === prev));
    const change = a.base >= MIN_BASE && b.base >= MIN_BASE ? daysChange(a.avg, b.avg, MONTHS[prev]) : null;
    const conclusion = verdict(change);
    return {
      title: name,
      variation: change,
      conclusion,
      relevant: true,
      summary: sentence(pair, a.base ? `${name} com desvio médio de +${daysText(a.avg)} sobre o 1º ETA (${plural(a.base, 'chegada', 'chegadas')})` : '', change, conclusion, baseReason(b.base, a.base, 'chegadas na rota')),
      note: `No período, ${worst.base < SMALL_SAMPLE ? `em ${plural(worst.base, 'operação', 'operações')}, ` : ''}é a rota com maior desvio médio de chegada: +${daysText(worst.avg)}, pico de +${worst.peak}.`,
    };
  }

  /**
   * Locais: onde a carga fica mais tempo entre a chegada e o gate out
   * (previsto: 3 dias), entre portos com pelo menos 2 passagens completas.
   */
  const PORT_PLAN_DAYS = 3;
  function localInsight(D, ops) {
    const pair = referencePair(D);
    const dwellOf = (id, g) => {
      const done = g.filter((o) => D.routes.find((r) => r.id === o.route).to === id && o.arrive && o.gate);
      const dwell = done.map((o) => D.days(o.arrive, o.gate));
      return { base: done.length, avg: done.length ? dwell.reduce((n, d) => n + d, 0) / done.length : null, over: dwell.filter((d) => d > PORT_PLAN_DAYS).length };
    };
    let worst = null;
    for (const id of new Set(D.routes.map((r) => r.to))) {
      const st = dwellOf(id, ops);
      if (st.base < 2) continue;
      if (!worst || st.avg > worst.avg) worst = { id, ...st };
    }
    if (!worst || !pair) {
      return { title: 'Locais', variation: null, conclusion: NO_CHANGE, relevant: false, summary: 'Sem passagens completas suficientes nos portos de destino.', note: '' };
    }
    const [prev, cur] = pair;
    const name = D.locations[worst.id].name;
    const a = dwellOf(worst.id, ops.filter((o) => monthOf(o) === cur));
    const b = dwellOf(worst.id, ops.filter((o) => monthOf(o) === prev));
    const change = a.base >= MIN_BASE && b.base >= MIN_BASE ? daysChange(a.avg, b.avg, MONTHS[prev]) : null;
    const conclusion = verdict(change);
    return {
      title: name,
      variation: change,
      conclusion,
      relevant: !!change && !change.stable,
      summary: sentence(pair, a.base ? `${name} com ${daysText(a.avg)} em média entre a chegada e o gate out (${plural(a.base, 'passagem', 'passagens')})` : '', change, conclusion, baseReason(b.base, a.base, 'passagens completas')),
      note: `Previsto: ${PORT_PLAN_DAYS} dias. No período, ${worst.base < SMALL_SAMPLE ? `em ${plural(worst.base, 'passagem', 'passagens')}, ` : ''}é o porto com maior permanência média: ${daysText(worst.avg)}, ${worst.over} de ${worst.base} passagens acima do previsto.`,
    };
  }

  const Insights = {
    variation, cohorts, comparablePair, referencePair, worstRoute, card, conclude,
    stageInsight, supplierInsight, agentInsight, routeInsight, localInsight,
    HIGHER_IS_BETTER, MIN_BASE, NO_CHANGE, SMALL_SAMPLE, STABLE_BELOW,
  };
  if (typeof module !== 'undefined') module.exports = Insights;
  else root.Insights = Insights;
})(typeof window !== 'undefined' ? window : globalThis);

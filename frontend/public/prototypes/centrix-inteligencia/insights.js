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

  /** Tudo o que um card precisa dizer sobre uma métrica. */
  function card(D, key, ops) {
    const m = D.metrics[key];
    const kind = m.amount ? 'pct' : 'pp';
    const value = valueOf(D, key, ops);
    if (value == null) {
      return { value: null, sentence: 'Sem base suficiente neste recorte para ler esta métrica.', detail: '', variation: null, latest: null, worst: null };
    }
    const pair = comparablePair(D, key, ops);
    let latest = null;
    let change = null;
    if (pair) {
      const [prev, cur] = pair;
      const curOps = ops.filter((o) => o.readyPlan.slice(5, 7) === cur);
      const a = D.metric(key, curOps);
      const curValue = valueOf(D, key, curOps);
      const prevValue = valueOf(D, key, ops.filter((o) => o.readyPlan.slice(5, 7) === prev));
      latest = { month: MONTHS[cur], value: curValue, good: a.good, base: a.eligible.length };
      change = variation(curValue, prevValue, kind, HIGHER_IS_BETTER[key] ?? null, MONTHS[prev]);
    }
    const shown = (v) => (kind === 'pp' ? `${v}%` : money(v));
    const lead = (LEAD[key] || ((v) => `${m.label}: ${shown(v)}.`))(value);
    // A variacao vai no SELO (seta + cor + texto); a frase interpreta e a
    // linha de base mostra de onde a variacao saiu. Repetir a variacao na frase
    // diria a mesma coisa duas vezes no mesmo card.
    const detail =
      latest && change
        ? kind === 'pp'
          ? `${latest.month[0].toUpperCase()}${latest.month.slice(1)}: ${latest.good} de ${latest.base} no prazo (${latest.value}%).`
          : `${latest.month[0].toUpperCase()}${latest.month.slice(1)}: ${shown(latest.value)}.`
        : 'Sem dois meses com base suficiente para comparar neste recorte.';
    const worst = kind === 'pp' ? worstRoute(D, key, ops, value) : null;
    const sentence = worst ? `${lead} ${worst.text}` : lead;
    const conclusion = conclude(key, change);
    const summary = `${shown(value)}${kind === 'pp' ? ' no prazo' : ' contratados'}, ${change ? change.text : 'sem comparação mensal'}. ${conclusion}`;
    return { value, sentence, detail, variation: change, latest, worst, conclusion, summary };
  }

  // ---------------------------------------------------------------------------
  // CONCLUSÃO (Prompt Inteligência em blocos, 01/10/2026). Pedido do Vinicius:
  // todo card diz a conclusão, não só o dado — métrica + variação + conclusão.
  // A conclusão SAI DA VARIAÇÃO calculada acima, nunca é texto fixo: se a
  // variação muda de sinal, a frase muda junto. Sem variação comparável, a frase
  // é NO_CHANGE — o fixture não sustenta afirmar melhora nem piora.
  // ---------------------------------------------------------------------------

  const NO_CHANGE = 'Sem variação relevante no período.';

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

  /**
   * Prazos e etapas: o trecho que mais estoura o previsto, e por quanto.
   * Variação = participação de estouros no último mês com base contra o
   * anterior (mesmas coortes do resto do módulo). Menos estouro é melhor.
   */
  function stageInsight(D, ops) {
    let worst = null;
    for (const stage of D.stages) {
      const st = stageStats(D, stage, ops);
      if (!st.base || !st.over) continue;
      if (!worst || st.rate > worst.rate || (st.rate === worst.rate && st.avgExtra > worst.avgExtra)) worst = { stage, ...st };
    }
    if (!worst) {
      return { title: 'Prazos e etapas', value: null, metric: 'Nenhum trecho passou do previsto neste recorte.', variation: null, conclusion: NO_CHANGE, relevant: false };
    }
    const months = cohorts(ops).filter((m) => stageStats(D, worst.stage, ops.filter((o) => monthOf(o) === m)).base >= MIN_BASE);
    let change = null;
    if (months.length >= 2) {
      const [prev, cur] = months.slice(-2);
      const a = stageStats(D, worst.stage, ops.filter((o) => monthOf(o) === cur)).rate;
      const b = stageStats(D, worst.stage, ops.filter((o) => monthOf(o) === prev)).rate;
      change = variation(a, b, 'pp', false, MONTHS[prev]);
    }
    const others = D.stages.filter((s) => s !== worst.stage && stageStats(D, s, ops).over > 0);
    const conclusion = others.length
      ? `É o trecho que mais atrasa; ${others.map((s) => s.label.toLowerCase()).join(' e ')} também passou do previsto.`
      : 'É o único trecho que passou do previsto; os demais ficaram dentro do prazo.';
    return {
      title: worst.stage.label,
      value: worst.rate,
      metric: `${worst.over} de ${worst.base} embarques passaram do previsto, em média +${oneDecimal(worst.avgExtra)} dias.`,
      variation: change,
      conclusion,
      relevant: true,
    };
  }

  /**
   * Fornecedores: quem piorou. Só afirma piora com variação mensal comparável
   * (mesma base mínima dos cards); sem ela, NO_CHANGE — duas amostras pequenas
   * com 4 pontos de diferença não são uma conclusão.
   */
  function supplierInsight(D, ops) {
    const rows = D.companies
      .map((c) => {
        const own = ops.filter((o) => o.supplier === c.id);
        const a = D.metric('ready', own);
        return { company: c, ops: own, rate: a.rate, good: a.good, base: a.eligible.length, change: card(D, 'ready', own).variation };
      })
      .filter((r) => r.base);
    if (!rows.length) {
      return { title: 'Fornecedores', value: null, metric: 'Sem confirmação de prontidão neste recorte.', variation: null, conclusion: NO_CHANGE, relevant: false };
    }
    const metric = rows.map((r) => `${r.company.name} ${r.rate}% (${r.good} de ${r.base})`).join(' · ');
    const worse = rows.filter((r) => r.change && r.change.tone === 'bad').sort((x, y) => x.change.delta - y.change.delta)[0];
    const better = rows.filter((r) => r.change && r.change.tone === 'good').sort((x, y) => y.change.delta - x.change.delta)[0];
    const pick = worse || better;
    return {
      title: 'Prontidão por fornecedor',
      value: pick ? pick.rate : null,
      metric: `Prontidão no prazo: ${metric}.`,
      variation: pick ? pick.change : null,
      conclusion: worse
        ? `${worse.company.name} piorou e merece conversa na próxima revisão.`
        : better
          ? `${better.company.name} está melhorando.`
          : NO_CHANGE,
      relevant: !!pick,
    };
  }

  /**
   * Agentes: CONCENTRAÇÃO de contratações, não nota de agente. Avaliar o
   * desempenho de cada agente é decisão pendente com o Orsi; esta frase diz só
   * o quanto do frete depende de um parceiro.
   */
  function agentInsight(D, ops) {
    if (!ops.length) {
      return { title: 'Agentes de carga', value: null, metric: 'Sem contratações neste recorte.', variation: null, conclusion: NO_CHANGE, relevant: false };
    }
    const counts = D.agents.map((a) => ({ agent: a, n: ops.filter((o) => o.agent === a.id).length })).filter((x) => x.n).sort((a, b) => b.n - a.n);
    const top = counts[0];
    const share = Math.round((top.n / ops.length) * 100);
    const shareOf = (subset) => (subset.length ? Math.round((subset.filter((o) => o.agent === top.agent.id).length / subset.length) * 100) : null);
    const months = cohorts(ops).filter((m) => ops.filter((o) => monthOf(o) === m).length >= MIN_BASE);
    let change = null;
    if (months.length >= 2) {
      const [prev, cur] = months.slice(-2);
      change = variation(shareOf(ops.filter((o) => monthOf(o) === cur)), shareOf(ops.filter((o) => monthOf(o) === prev)), 'pp', null, MONTHS[prev]);
    }
    return {
      title: 'Contratações por agente',
      value: share,
      metric: `${top.agent.name} concentrou ${top.n} de ${ops.length} contratações (${share}%).`,
      variation: change,
      conclusion:
        share >= 50
          ? 'Metade ou mais do seu frete depende de um único agente.'
          : `Contratações distribuídas entre ${counts.length} agentes.`,
      relevant: share >= 50,
    };
  }

  /**
   * Rotas: a que mais trava — maior desvio médio (em dias) da chegada ao porto
   * sobre o 1º ETA, entre rotas com pelo menos 2 chegadas. Menos de 1 dia de
   * média não é trava: NO_CHANGE.
   */
  function routeInsight(D, ops) {
    let worst = null;
    for (const r of D.routes) {
      const own = ops.filter((o) => o.route === r.id && o.arrive);
      if (own.length < 2) continue;
      const devs = own.map((o) => Math.max(0, D.days(o.arrivePlan, o.arrive)));
      const avg = devs.reduce((n, d) => n + d, 0) / devs.length;
      const a = D.metric('port', ops.filter((o) => o.route === r.id));
      if (!worst || avg > worst.avg) worst = { route: r, avg, peak: Math.max(...devs), good: a.good, base: a.eligible.length, rate: a.rate };
    }
    if (!worst || worst.avg < 1) {
      return { title: 'Rotas', value: null, metric: 'Nenhuma rota com desvio médio de chegada acima de 1 dia.', variation: null, conclusion: NO_CHANGE, relevant: false };
    }
    const name = `${D.locations[worst.route.from].name} → ${D.locations[worst.route.to].name}`;
    const routeOps = ops.filter((o) => o.route === worst.route.id);
    return {
      title: name,
      value: worst.rate,
      metric: `${worst.good} de ${worst.base} chegadas ao porto no prazo; desvio médio de +${oneDecimal(worst.avg)} dias sobre o 1º ETA, pico de +${worst.peak}.`,
      variation: card(D, 'port', routeOps).variation,
      conclusion: 'É a rota que mais trava a sua operação.',
      relevant: true,
    };
  }

  /**
   * Locais: onde a carga mais espera entre a chegada ao porto e o gate out
   * (previsto: 3 dias), entre portos com pelo menos 2 passagens completas.
   * Excesso médio abaixo de 1 dia: NO_CHANGE.
   */
  const PORT_PLAN_DAYS = 3;
  function localInsight(D, ops) {
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
      return { title: 'Locais', value: null, metric: 'Sem passagens completas suficientes nos portos de destino.', variation: null, conclusion: NO_CHANGE, relevant: false };
    }
    const name = D.locations[worst.id].name;
    const relevant = worst.avg - PORT_PLAN_DAYS >= 1;
    return {
      title: name,
      value: null,
      metric: `${name}: média de ${oneDecimal(worst.avg)} dias entre a chegada e o gate out (previsto ${PORT_PLAN_DAYS}); ${worst.over} de ${worst.base} passagens acima.`,
      variation: null,
      conclusion: relevant ? `${name} é onde a sua carga mais espera.` : NO_CHANGE,
      relevant,
    };
  }

  const Insights = {
    variation, cohorts, comparablePair, worstRoute, card, conclude,
    stageInsight, supplierInsight, agentInsight, routeInsight, localInsight,
    HIGHER_IS_BETTER, MIN_BASE, NO_CHANGE,
  };
  if (typeof module !== 'undefined') module.exports = Insights;
  else root.Insights = Insights;
})(typeof window !== 'undefined' ? window : globalThis);

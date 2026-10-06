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
    ready: (v) => `Seus exportadores deixaram a carga pronta no prazo em ${v}% dos embarques.`,
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
    return { value, sentence, detail, variation: change, latest, worst };
  }

  const Insights = { variation, cohorts, comparablePair, worstRoute, card, HIGHER_IS_BETTER, MIN_BASE };
  if (typeof module !== 'undefined') module.exports = Insights;
  else root.Insights = Insights;
})(typeof window !== 'undefined' ? window : globalThis);

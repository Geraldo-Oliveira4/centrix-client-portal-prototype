'use strict';
// REFERÊNCIA AGREGADA DA FREITAS — EXEMPLO FICTÍCIO (Simulador v2, S5, 17/11/2026).
//
// No SaaS o cliente pode ter poucos embarques por rota. A referência agregada é
// o histórico de trânsito ANÔNIMO e agregado por rota e modal, que só existe
// para clientes integrados ao sistema de gestão. Aqui ela é um conjunto
// FICTÍCIO, gerado de forma determinística a partir da tabela abaixo, e mora
// SEPARADA da fixture das outras subabas (data.js): nenhum total da Visão geral,
// de Agentes de carga, Exportadores ou Rotas muda por causa dela.
//
// Cada amostra é UM embarque com saída e chegada registradas: trânsito em dias,
// quantos dias atrás saiu (a janela do histórico conta por aí), agente de carga
// e tipo de carga. `legs` é a perna nacional (chegada → entrega ao cliente) por
// rota e modal; rota sem `legs` não tem base para a Entrega final, de propósito.
// `unregistered` conta embarques que saíram e não têm chegada registrada: eles
// não entram no trânsito (e é por isso que o resultado mostra a cobertura de
// registro).
(function (root) {
  // [rota, modal, agente, n, trânsito central, cauda (dias extra no P90), tipo de carga]
  const SPEC = [
    ['ningbo', 'maritimo', 'alpha', 50, 34, 9, 'FCL'],
    ['ningbo', 'maritimo', 'gamma', 10, 36, 12, 'FCL'],
    ['ningbo', 'maritimo', 'beta', 2, 33, 4, 'LCL'],
    ['shanghai', 'maritimo', 'beta', 50, 35, 10, 'FCL'],
    ['shanghai', 'maritimo', 'alpha', 10, 37, 8, 'FCL'],
    ['shanghai', 'maritimo', 'delta', 3, 34, 6, 'LCL'],
    ['hamburgo', 'maritimo', 'gamma', 24, 27, 6, 'LCL'],
    ['hamburgo', 'maritimo', 'alpha', 6, 29, 7, 'FCL'],
    ['genova', 'maritimo', 'alpha', 12, 26, 6, 'FCL'],
    ['genova', 'maritimo', 'delta', 2, 25, 3, 'FCL'],
    ['newyork', 'maritimo', 'delta', 18, 18, 5, 'FCL'],
    ['newyork', 'maritimo', 'beta', 4, 20, 4, 'FCL'],
    ['ningbo', 'aereo', 'alpha', 8, 6, 3, 'Carga geral'],
    ['ningbo', 'aereo', 'beta', 3, 7, 2, 'Carga geral'],
    ['shanghai', 'aereo', 'beta', 5, 5, 3, 'Carga geral'],
    ['hamburgo', 'aereo', 'gamma', 2, 4, 1, 'Carga geral'],
  ];
  // [rota, modal, n, perna nacional central, cauda]
  const LEG_SPEC = [
    ['ningbo', 'maritimo', 40, 6, 5], ['shanghai', 'maritimo', 20, 5, 4], ['hamburgo', 'maritimo', 15, 4, 3],
    ['newyork', 'maritimo', 2, 5, 2], ['ningbo', 'aereo', 10, 4, 3],
  ];
  // embarques que saíram sem chegada registrada, por rota|modal
  const UNREGISTERED = { 'ningbo|maritimo': 7, 'shanghai|maritimo': 5, 'hamburgo|maritimo': 3, 'genova|maritimo': 2, 'newyork|maritimo': 1, 'ningbo|aereo': 1 };

  /** Gerador pseudoaleatório determinístico (mulberry32): mesma semente, mesmos números. */
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const seedOf = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
  /** Trânsito: maioria perto do central (±3 dias) e uma cauda de 1 em 8 até `tail` dias acima. */
  function draw(r, center, tail) {
    const base = center + Math.round((r() - 0.5) * 6);
    return Math.max(1, r() < 0.125 ? base + 1 + Math.floor(r() * tail) : base);
  }
  /** Quantos dias atrás saiu: 85% no último ano, o resto entre 1 e 2 anos. */
  const daysAgo = (r) => (r() < 0.85 ? 5 + Math.floor(r() * 355) : 366 + Math.floor(r() * 330));

  const samples = SPEC.flatMap(([route, modal, agent, n, center, tail, cargo]) => {
    const r = rng(seedOf(`${route}|${modal}|${agent}`));
    return Array.from({ length: n }, () => ({ route, modal, agent, cargo, transit: draw(r, center, tail), daysAgo: daysAgo(r) }));
  });
  const legs = LEG_SPEC.flatMap(([route, modal, n, center, tail]) => {
    const r = rng(seedOf(`leg|${route}|${modal}`));
    return Array.from({ length: n }, () => ({ route, modal, days: draw(r, center, tail), daysAgo: daysAgo(r) }));
  });

  const api = {
    LABEL: 'Referência agregada da Freitas',
    NOTE: 'Exemplo fictício: histórico agregado e anônimo por rota e modal, separado dos seus embarques.',
    samples, legs, unregistered: UNREGISTERED,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.IntelSimReference = api;
})(typeof window !== 'undefined' ? window : globalThis);

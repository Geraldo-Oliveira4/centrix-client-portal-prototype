'use strict';
// Dobras recolhíveis da Inteligência ("Evolução", "Performance", "Compromissos
// do serviço"). PURO: o estado entra e sai; quem lê o DOM é intel-page.js. Roda
// no navegador (window.IntelFolds) e sob node --test (intel-folds.test.cjs).
//
// Regras (A2, revisão de 17/11/2026):
//   1. UMA CHAVE POR SEÇÃO. Cada dobra tem o próprio estado, guardado pelo id
//      dela; recolher uma nunca mexe em outra.
//   2. Seção que não é dobra ("sempre visível") não entra aqui.
(function (root) {
  /** Padrão: Evolução e Performance abertas (como sempre foram); Compromissos recolhido. */
  const DEFAULTS = { evo: true, perf: true, commitments: false };
  /** Grupos de acordeão (nenhum por enquanto). */
  const ACCORDION = {};
  const IDS = Object.keys(DEFAULTS);

  const defaults = () => ({ ...DEFAULTS });
  function groupOf(id) {
    return Object.values(ACCORDION).find((g) => g.includes(id)) || null;
  }
  /** O novo estado depois de abrir ou fechar a dobra `id`. Id desconhecido não muda nada. */
  function setOpen(state, id, open) {
    const s = { ...defaults(), ...(state || {}) };
    if (!IDS.includes(id)) return s;
    s[id] = !!open;
    if (open) for (const other of groupOf(id) || []) if (other !== id) s[other] = false;
    return s;
  }
  /** As dobras que precisam fechar na tela quando `id` abre (o efeito do acordeão). */
  function closedBy(id) {
    return (groupOf(id) || []).filter((other) => other !== id);
  }
  const isOpen = (state, id) => !!({ ...defaults(), ...(state || {}) })[id];

  const api = { DEFAULTS, ACCORDION, IDS, defaults, setOpen, closedBy, isOpen };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.IntelFolds = api;
})(typeof window !== 'undefined' ? window : globalThis);

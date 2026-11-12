'use strict';
// Relógio da Radar: o relógio compartilhado (`../_shared/demo-clock.js`) com
// data-base 13/09/2026, em SEMANAS INTEIRAS (as referências de preço são
// janelas semanais; a amostra fica no mesmo dia da semana, até 6 dias antes de
// hoje). Hoje = data atual ou `?hoje=AAAA-MM-DD`.
//
// O deslocamento é aplicado NA SAÍDA, não nos dados: cada nó de texto (e
// title / aria-label / placeholder) que entra na página é deslocado uma vez,
// por um MutationObserver. Assim os dados de `prices.js` / `app.js`, a ordenação
// por "recentes" (que compara o dia do mês como texto) e os testes no Node
// continuam sobre a data-base, e nenhum literal de data precisa ser caçado no
// meio do HTML montado à mão.
const RadarClock = typeof DemoClock !== 'undefined' && typeof location !== 'undefined'
  ? DemoClock.create('2026-09-13', { search: location.search, weeks: true })
  : null;
(function () {
  if (!RadarClock || !RadarClock.offset || typeof MutationObserver === 'undefined') return;
  const done = new WeakSet();
  const ATTRS = ['title', 'aria-label', 'placeholder'];
  function fix(node) {
    if (!node || done.has(node)) return;
    if (node.nodeType === 3) { done.add(node); const next = RadarClock.shiftText(node.data); if (next !== node.data) node.data = next; return; }
    if (node.nodeType !== 1 || node.tagName === 'SCRIPT' || node.tagName === 'STYLE') return;
    done.add(node);
    for (const a of ATTRS) if (node.hasAttribute(a)) node.setAttribute(a, RadarClock.shiftText(node.getAttribute(a)));
    node.childNodes.forEach(fix);
  }
  new MutationObserver(list => list.forEach(m => m.addedNodes.forEach(fix)))
    .observe(document.documentElement, { childList: true, subtree: true });
  fix(document.body);
})();

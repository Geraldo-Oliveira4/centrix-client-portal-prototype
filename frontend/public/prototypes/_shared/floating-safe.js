'use strict';
// Ponte dos iframes do protótipo para a regra "flutuantes nunca cobrem ação
// primária" (app/portal/_shared/floating-safe-area.ts). O botão "Ajuda" mora
// na janela de FORA; os rodapés fixos das gavetas (".drawer-footer",
// ".drawer-actions", ou qualquer "[data-bottom-action-bar]") moram aqui
// dentro. Este script manda ao host o retângulo da barra visível mais alta
// (coordenadas do iframe) ou `null` quando não há nenhuma; o host converte e
// sobe a Ajuda. Sem host (página aberta sozinha), não faz nada.
(function () {
  if (window.parent === window) return;
  var SELECTOR = '.drawer-footer, .drawer-actions, [data-bottom-action-bar]';
  var last = '';
  var frame = 0;
  function visible(el) {
    var r = el.getBoundingClientRect();
    return r.height > 0 && r.width > 0 && r.top < window.innerHeight && el.offsetParent !== null;
  }
  function report() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(function () {
      var best = null;
      document.querySelectorAll(SELECTOR).forEach(function (el) {
        if (!visible(el)) return;
        var r = el.getBoundingClientRect();
        if (!best || r.top < best.top) best = { top: r.top, bottom: r.bottom };
      });
      var key = JSON.stringify(best);
      if (key === last) return;
      last = key;
      window.parent.postMessage({ type: 'centrix:bottom-bar', rect: best }, window.location.origin);
    });
  }
  new MutationObserver(report).observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['open', 'class', 'hidden', 'style'],
  });
  window.addEventListener('resize', report);
  window.addEventListener('scroll', report, true);
  window.addEventListener('pagehide', function () {
    window.parent.postMessage({ type: 'centrix:bottom-bar', rect: null }, window.location.origin);
  });
  report();
})();

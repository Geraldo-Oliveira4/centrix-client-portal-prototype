// Tema do portal dentro dos iframes (30/09/2026).
//
// O toggle claro/escuro do portal grava `portal:theme` no localStorage da
// pagina hospedeira. Os iframes em /prototypes sao da MESMA origem, entao leem
// a mesma chave ao carregar e recebem o evento `storage` quando o cliente troca
// o tema. Antes disto o miolo destas cinco telas ficava claro dentro da moldura
// escura, e era isso que lia como "o toggle nao respondeu".
//
// O escuro e aplicado por `theme-sync.css` (inversao de luminancia com rotacao
// de matiz, que preserva o matiz das cores de estado). E uma ponte de
// prototipo: na versao integrada estas telas usam os tokens do portal.
(function () {
  function apply() {
    var theme = null;
    try { theme = localStorage.getItem('portal:theme'); } catch (e) { theme = null; }
    document.documentElement.classList.toggle('theme-dark', theme === 'dark');
  }
  apply();
  window.addEventListener('storage', function (event) {
    if (event.key === 'portal:theme') apply();
  });
})();

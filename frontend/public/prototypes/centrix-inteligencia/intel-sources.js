'use strict';
// FÓRMULA DE CADA MÉTRICA (D1, 17/11/2026). UM MAPA SÓ: todo "Como é
// calculado" e a página "Fontes e definições" leem daqui. Escrita em linguagem
// de negócio, nunca com nome de tabela, coluna ou sistema interno. Mudou uma
// fórmula: mude AQUI.
//
// Roda no navegador (window.IntelSources) e sob node --test.
(function (root) {
  /** As fórmulas validadas, escritas uma vez. */
  const FORMULAS = {
    final: 'Entrega final no prazo = entregas ao cliente realizadas até a data prevista de entrega ÷ entregas realizadas que tinham data prevista. A entrega é a recebida pelo cliente (fábrica ou armazém final), não a chegada ao porto.',
  };
  const formulaOf = (key) => FORMULAS[key] || null;

  const api = { FORMULAS, formulaOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.IntelSources = api;
})(typeof window !== 'undefined' ? window : globalThis);

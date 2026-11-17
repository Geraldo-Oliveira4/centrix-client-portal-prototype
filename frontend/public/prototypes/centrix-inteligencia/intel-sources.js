'use strict';
// FONTE E FÓRMULA DE CADA MÉTRICA (D1 a D4, 17/11/2026). UM MAPA SÓ: todo
// "Como é calculado" e a página "Fontes e definições" leem daqui. A fonte é dita
// em linguagem de negócio, nunca com nome de tabela, coluna ou sistema interno.
//
// Regras:
//   1. Só se afirma a fonte que foi validada. Hoje: a Entrega final vem do
//      sistema de gestão de processos de importação (data de entrega ao cliente
//      contra a data prevista de entrega). O resto fica "Fonte a confirmar" até
//      o time validar (está na lista "a validar" da PR).
//   2. Métrica que só existe com a integração ao sistema de gestão leva o aviso
//      INTEGRATED_NOTICE. Hoje: Entrega final. Isso separa o que a versão sem
//      integração entrega do que depende da integração.
//   3. Mudou uma fonte ou uma fórmula: mude AQUI. O teste
//      (intel-sources.test.cjs) confere que data.js diz o mesmo.
//
// Roda no navegador (window.IntelSources) e sob node --test.
(function (root) {
  const TO_CONFIRM = 'Fonte a confirmar';
  const MANAGEMENT_SYSTEM = 'Sistema de gestão de processos de importação';

  /** D1 e D2: as fórmulas validadas, escritas uma vez. */
  const FORMULAS = {
    final: 'Entrega final no prazo = entregas ao cliente realizadas até a data prevista de entrega ÷ entregas realizadas que tinham data prevista. A entrega é a recebida pelo cliente (fábrica ou armazém final), não a chegada ao porto.',
    port: 'Chegada ao destino no prazo = chegadas realizadas até a data prevista de chegada ÷ chegadas realizadas com data prevista. Considera o porto ou aeroporto de descarga.',
  };

  /** D4: métrica → fonte. */
  const SOURCES = {
    ready: TO_CONFIRM,
    port: TO_CONFIRM,
    final: MANAGEMENT_SYSTEM,
    docs: TO_CONFIRM,
    quantity: TO_CONFIRM,
    condition: TO_CONFIRM,
    audit: TO_CONFIRM,
    freight: TO_CONFIRM,
    cargo: TO_CONFIRM,
    count: TO_CONFIRM,
    sim_reference: TO_CONFIRM,
  };

  /** Métricas que só existem para cliente integrado ao sistema de gestão. */
  // A referência agregada do Simulador (S5) só existe para cliente integrado.
  const INTEGRATED_ONLY = new Set(['final', 'sim_reference']);
  const INTEGRATED_NOTICE = 'Disponível para clientes integrados ao sistema de gestão. Não faz parte da versão sem integração.';

  const sourceOf = (key) => SOURCES[key] || TO_CONFIRM;
  const formulaOf = (key) => FORMULAS[key] || null;
  const noticeOf = (key) => (INTEGRATED_ONLY.has(key) ? INTEGRATED_NOTICE : null);

  const api = { TO_CONFIRM, MANAGEMENT_SYSTEM, FORMULAS, SOURCES, INTEGRATED_ONLY, INTEGRATED_NOTICE, sourceOf, formulaOf, noticeOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.IntelSources = api;
})(typeof window !== 'undefined' ? window : globalThis);

'use strict';
// Relógio da Auditoria: o relógio compartilhado dos protótipos
// (`../_shared/demo-clock.js`) com data-base 13/09/2026 e deslocamento em
// SEMANAS INTEIRAS. A regra de câmbio usa dia útil ("07/09 sem boletim;
// referência em 04/09") e um deslocamento de dias quebrados poria boletim de
// PTAX em fim de semana. A "Atualização da amostra" fica no mesmo dia da semana
// da data-base, até 6 dias antes de hoje; ações feitas agora usam `day` (o hoje
// exato). Sem `location` (testes no Node) tudo fica na data-base.
(function (root) {
  const DemoClock = typeof module !== 'undefined' && module.exports ? require('../_shared/demo-clock.js') : root.DemoClock;
  const KEEP = ['id', 'key', 'invoice', 'bl', 'po', 'reference', 'entryRecordKey'];
  function create(search, now) {
    const clock = DemoClock.create('2026-09-13', { search, now, weeks: true });
    return { ...clock, shiftDeep: value => clock.shiftDeep(value, KEEP), create };
  }
  const clock = create(typeof location !== 'undefined' && location ? location.search : undefined, new Date());
  if (typeof module !== 'undefined' && module.exports) module.exports = clock;
  else root.AuditClock = clock;
})(typeof window !== 'undefined' ? window : globalThis);

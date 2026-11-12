// Relógio da Auditoria (clock.js): o hoje é injetado; nenhuma checagem depende da data real.
const assert = require('node:assert/strict');
const C = require('../../public/prototypes/centrix-auditoria/clock.js');
const M = require('../../public/prototypes/centrix-auditoria/model.js');
const F = require('../../public/prototypes/centrix-auditoria/freight.js');
const P = require('../../public/prototypes/centrix-auditoria/performance.js');

const weekday = (d) => new Date(d + 'T12:00:00Z').getUTCDay();

// Sem location (Node): data-base, sem deslocamento.
assert.equal(C.day, '2026-09-13');
assert.equal(C.offset, 0);

// ?hoje=: a amostra anda em semanas inteiras e nunca passa de hoje.
for (const hoje of ['2026-11-12', '2026-09-19', '2027-03-01', '2026-09-13']) {
  const c = C.create('?hoje=' + hoje);
  assert.equal(c.day, hoje);
  assert.equal(c.offset % 7, 0, hoje);
  assert.equal(weekday(c.sample), weekday(c.BASE_DAY), hoje);
  const gap = (Date.parse(hoje) - Date.parse(c.sample)) / 864e5;
  assert.ok(gap >= 0 && gap < 7, hoje);
}

// Amostra inteira deslocada: nada congelado em setembro, dia útil preservado na PTAX.
const c = C.create('?hoje=2026-11-12');
const ops = c.shiftDeep(P.enrich(F.enrich(M.seed())));
const all = JSON.stringify(ops);
const isoDays = (text) => (text.match(/\b20\d\d-\d\d-\d\d/g) || []).sort();
const baseDays = isoDays(JSON.stringify(P.enrich(F.enrich(M.seed()))));
const movedDays = isoDays(all);
assert.equal(movedDays.length, baseDays.length);
// Toda data andou o mesmo deslocamento, e a mais recente da amostra não passa de hoje.
assert.deepEqual(movedDays, baseDays.map((d) => new Date(Date.parse(d + 'T12:00:00Z') + c.offset * 864e5).toISOString().slice(0, 10)).sort());
assert.ok(movedDays[movedDays.length - 1] <= c.day);
assert.doesNotMatch(all, /\b13\/09\/2026\b/, 'nada fica no dia-base');
const fx = ops.map((o) => Object.values(o.freight?.fx || {})).flat()[0];
assert.ok(fx, 'há regra de câmbio na amostra');
assert.equal(weekday(fx.eventDate), weekday('2026-09-08'));
assert.equal(weekday(fx.referenceDate), weekday('2026-09-04'));
assert.match(fx.calendar, /02\/11 sem boletim; referência em 30\/10/);
assert.match(all, /BOLETIM-DEMO-0409/, 'ids com números não mudam');

// A apuração não muda com o dia: mesmos desfechos na data-base e deslocada.
const base = P.enrich(F.enrich(M.seed()));
assert.deepEqual(
  ops.map((o) => ['preco', 'performance'].map((d) => M.matches(o, d, 'deviation'))),
  base.map((o) => ['preco', 'performance'].map((d) => M.matches(o, d, 'deviation'))),
);

console.log('clock-checks: ok');

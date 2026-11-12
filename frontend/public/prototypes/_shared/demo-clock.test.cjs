// Relógio compartilhado dos protótipos estáticos: hoje injetado, nada depende da data real.
const test = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('./demo-clock.js');

const BASE = '2026-09-13';
const weekday = (d) => new Date(d + 'T12:00:00Z').getUTCDay();

test('sem search (Node): data-base, sem deslocamento', () => {
  const c = create(BASE);
  assert.equal(c.day, BASE);
  assert.equal(c.offset, 0);
  assert.equal(c.shiftText('Boletim de 10/09'), 'Boletim de 10/09');
});

test('?hoje= exato e em semanas inteiras', () => {
  const exact = create(BASE, { search: '?hoje=2026-11-12' });
  assert.equal(exact.offset, 60);
  const weeks = create(BASE, { search: '?hoje=2026-11-12', weeks: true });
  assert.equal(weeks.day, '2026-11-12');
  assert.equal(weeks.offset, 56);
  assert.equal(weeks.sample, '2026-11-08');
  assert.equal(weekday(weeks.sample), weekday(BASE));
  assert.notEqual(create(BASE, { search: '?hoje=2026-02-30' }).day, '2026-02-30');
});

test('formatos de texto da Radar e da Auditoria, numa passada só', () => {
  const c = create(BASE, { search: '?hoje=2026-11-12', weeks: true });
  const cases = [
    ['Boletim de 10/09', 'Boletim de 05/11'],
    ['manutenção em 18–19/09', 'manutenção em 13–14/11'],
    ['01–06/09 · 6 referências', '27/10–01/11 · 6 referências'],
    ['carga pronta de 25/09 para 22/09', 'carga pronta de 20/11 para 17/11'],
    ['before 25 set, after 22 set', 'before 20 nov, after 17 nov'],
    ['12/09/2026 · 16:00 BRT', '07/11/2026 · 16:00 BRT'],
    ['Chegada 2026-08-26; descarga 22/10', 'Chegada 2026-10-21; descarga 17/12'],
    ['de 16 para 19 set.', 'de 11 para 14 nov.'],
  ];
  for (const [input, expected] of cases) assert.equal(c.shiftText(input), expected, input);
});

test('números que não são data ficam intactos', () => {
  const c = create(BASE, { search: '?hoje=2026-11-12', weeks: true });
  for (const s of ['7/8 para 5/8 operações', 'PO DEMO-1041 · 1.200 peças', 'BOLETIM-DEMO-0409', 'PO-2026-084', 'USD 2.450 → USD 2.250 (−8,2%)', '#radar/mercado/r1']) {
    assert.equal(c.shiftText(s), s, s);
  }
});

test('shiftDeep desloca valores e preserva as chaves protegidas', () => {
  const c = create(BASE, { search: '?hoje=2026-09-20' });
  const data = c.shiftDeep({ id: '2026-09-13', date: '2026-09-10', note: 'até 14/09/2026', list: [{ start: '20/07' }] });
  assert.deepEqual(data, { id: '2026-09-13', date: '2026-09-17', note: 'até 21/09/2026', list: [{ start: '27/07' }] });
});

'use strict';
// RELÓGIO DA DEMONSTRAÇÃO dos protótipos estáticos (12/11/2026), mesma regra da
// Inteligência (`centrix-inteligencia/data.js`): a fixture é escrita contra uma
// DATA-BASE e deslocada em memória para o hoje da demonstração — a data atual,
// ou `?hoje=AAAA-MM-DD` (testes, screenshots). Diferenças entre datas não mudam.
//
//   DemoClock.create(baseDay, { search, now, weeks })
//
// `weeks: true` desloca em SEMANAS INTEIRAS: a amostra fica no mesmo dia da
// semana da data-base, até 6 dias antes de hoje (nunca no futuro). Serve às
// telas cujas fixtures têm regra de dia útil (PTAX) ou séries semanais. `day`
// é sempre o hoje exato, para o que acontece agora.
//
// Sem `search` (testes no Node), tudo fica na data-base. O arquivo-fonte das
// fixtures nunca muda.
(function (root) {
  const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const validDay = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '') && new Date(d + 'T12:00:00Z').toISOString().slice(0, 10) === d;
  const add = (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const days = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);
  function today(search, now) {
    const q = new URLSearchParams(search || '').get('hoje');
    if (validDay(q)) return q;
    const n = now instanceof Date ? now : new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  }

  function create(baseDay, options = {}) {
    const day = options.search === undefined ? baseDay : today(options.search, options.now);
    const raw = days(baseDay, day);
    const offset = options.weeks ? Math.floor(raw / 7) * 7 : raw;
    const year = baseDay.slice(0, 4);
    const shiftIso = v => (typeof v === 'string' && validDay(v.slice(0, 10)) ? add(v.slice(0, 10), offset) + v.slice(10) : v);
    const dm = d => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

    // Datas escritas em texto, cada formato numa passada própria (nenhum formato
    // casa com a saída de outro, então nada é deslocado duas vezes):
    //   "AAAA-MM-DD" · "DD/MM" · "DD/MM/AAAA" · faixa "01–06/09" ·
    //   "25 set" / "25 set." / "15 set 2026" · par "16 para 19 set".
    // Ids como BOLETIM-DEMO-0409 ou PO-2026-084 não casam com nenhum.
    function shiftText(s) {
      if (typeof s !== 'string' || !offset) return s;
      return s
        .replace(/\b(20\d\d-\d\d-\d\d)\b/g, iso => (validDay(iso) ? add(iso, offset) : iso))
        .replace(/\b(\d{2})(?:([–-])(\d{2}))?\/(\d{2})(?:\/(\d{4}))?\b/g, (all, d1, dash, d2, mm, yyyy) => {
          const last = `${yyyy || year}-${mm}-${d2 || d1}`;
          if (!validDay(last)) return all;
          const end = add(last, offset);
          const tail = dm(end) + (yyyy ? '/' + end.slice(0, 4) : '');
          if (!dash) return tail;
          const start = add(last, offset - (Number(d2) - Number(d1)));
          return (start.slice(5, 7) === end.slice(5, 7) ? start.slice(8, 10) : dm(start)) + dash + tail;
        })
        .replace(new RegExp(`\\b(\\d{1,2})(?:( para | a | e )(\\d{1,2}))? (${MONTHS.join('|')})(\\.?)( (\\d{4}))?\\b`, 'g'), (all, d1, sep, d2, mon, dot, withYear, yyyy) => {
          const m = String(MONTHS.indexOf(mon) + 1).padStart(2, '0');
          const pad = (src, d) => (src.length === 2 ? d.slice(8, 10) : String(Number(d.slice(8, 10))));
          const name = d => MONTHS[Number(d.slice(5, 7)) - 1];
          const last = `${yyyy || year}-${m}-${(d2 || d1).padStart(2, '0')}`;
          if (!validDay(last)) return all;
          const end = add(last, offset);
          const tail = `${pad(d2 || d1, end)} ${name(end)}${dot}` + (withYear ? ' ' + end.slice(0, 4) : '');
          if (!sep) return tail;
          const firstMonth = Number(d1) > Number(d2) ? ((Number(m) + 10) % 12) + 1 : Number(m);
          const start = add(`${yyyy || year}-${String(firstMonth).padStart(2, '0')}-${d1.padStart(2, '0')}`, offset);
          return (name(start) === name(end) ? pad(d1, start) : `${pad(d1, start)} ${name(start)}${dot}`) + sep + tail;
        });
    }

    // Uma fixture inteira, no lugar: ISO onde o valor é data, texto onde é frase.
    function shiftDeep(value, keep = ['id'], key) {
      if (Array.isArray(value)) return value.map(v => shiftDeep(v, keep));
      if (value && typeof value === 'object') { for (const k of Object.keys(value)) value[k] = shiftDeep(value[k], keep, k); return value; }
      if (typeof value !== 'string' || keep.includes(key)) return value;
      return /^\d{4}-\d{2}-\d{2}/.test(value) ? shiftIso(value) : shiftText(value);
    }

    const label = d => `${dm(d)}/${d.slice(0, 4)}`;
    return { BASE_DAY: baseDay, day, offset, sample: add(baseDay, offset), shiftIso, shiftText, shiftDeep, label };
  }

  const api = { create, validDay };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DemoClock = api;
})(typeof window !== 'undefined' ? window : globalThis);

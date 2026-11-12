'use strict';
// RELÓGIO DA DEMONSTRAÇÃO (12/11/2026), mesma regra da Inteligência: a amostra
// é escrita contra a DATA-BASE 13/09/2026 e deslocada em memória para o hoje
// da demonstração (data atual ou `?hoje=AAAA-MM-DD`).
//
// Diferença deliberada: o deslocamento da AMOSTRA é em SEMANAS INTEIRAS. A
// regra de câmbio usa dia útil ("07/09 sem boletim; referência em 04/09") e a
// emissão de fatura cai em dia de semana; um deslocamento de N dias quebrados
// poria boletim de PTAX em sábado. Por isso a "Atualização da amostra" fica no
// mesmo dia da semana da data-base, até 6 dias antes de hoje — nunca no futuro.
// Ações feitas agora (registro, log de dossiê) usam o hoje EXATO (`day`).
//
// Sem `location` (testes no Node) tudo fica na data-base.
(function (root) {
  const BASE_DAY = '2026-09-13';
  const validDay = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '') && new Date(d + 'T12:00:00Z').toISOString().slice(0, 10) === d;
  const add = (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const days = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);
  function today(search, now) {
    const q = new URLSearchParams(search || '').get('hoje');
    if (validDay(q)) return q;
    const n = now instanceof Date ? now : new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  }
  function create(search, now) {
    const day = search === undefined ? BASE_DAY : today(search, now);
    const offset = Math.floor(days(BASE_DAY, day) / 7) * 7;
    const shiftIso = v => (typeof v === 'string' && validDay(v.slice(0, 10)) ? add(v.slice(0, 10), offset) + v.slice(10) : v);
    // Datas dentro de texto: "AAAA-MM-DD", "DD/MM" e "DD/MM/AAAA". Ids como
    // BOLETIM-DEMO-0409 não têm hífen de data nem barra.
    const shiftText = s => (typeof s !== 'string' || !offset ? s : s.replace(/\b(20\d\d-\d\d-\d\d)\b/g, iso => (validDay(iso) ? add(iso, offset) : iso)).replace(/\b(\d{2})\/(\d{2})(\/(\d{4}))?\b/g, (all, dd, mm, withYear, yyyy) => {
      const iso = `${yyyy || BASE_DAY.slice(0, 4)}-${mm}-${dd}`;
      if (!validDay(iso)) return all;
      const d = add(iso, offset);
      return `${d.slice(8, 10)}/${d.slice(5, 7)}` + (withYear ? `/${d.slice(0, 4)}` : '');
    }));
    const KEEP = ['id', 'key', 'invoice', 'bl', 'po', 'reference', 'entryRecordKey'];
    function shiftDeep(value, key) {
      if (Array.isArray(value)) return value.map(v => shiftDeep(v));
      if (value && typeof value === 'object') { for (const k of Object.keys(value)) value[k] = shiftDeep(value[k], k); return value; }
      if (typeof value !== 'string' || KEEP.includes(key)) return value;
      return /^\d{4}-\d{2}-\d{2}/.test(value) ? shiftIso(value) : shiftText(value);
    }
    const label = d => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
    return { BASE_DAY, day, offset, sample: add(BASE_DAY, offset), shiftIso, shiftText, shiftDeep, label, create };
  }
  const clock = create(typeof location !== 'undefined' && location ? location.search : undefined, new Date());
  if (typeof module !== 'undefined' && module.exports) module.exports = clock;
  else root.AuditClock = clock;
})(typeof window !== 'undefined' ? window : globalThis);

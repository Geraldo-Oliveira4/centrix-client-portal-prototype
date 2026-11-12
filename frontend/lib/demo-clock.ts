// Relógio da demonstração: a mesma regra da Inteligência
// (`public/prototypes/centrix-inteligencia/data.js`, `demoToday` + `shift`).
//
//   - "hoje" é a data local atual, ou `?hoje=AAAA-MM-DD` quando a URL pede
//     (testes, screenshots, ensaio de apresentação);
//   - uma fixture é escrita contra uma DATA-BASE e deslocada inteira pelo mesmo
//     número de dias (hoje − data-base), então diferenças entre datas (validade,
//     trânsito, atraso) não mudam e nenhuma tela mostra um "hoje" congelado.
//
// PURO e sem o alias `@/`: roda sob `npm run test:unit`. Nada aqui lê o relógio
// sozinho — `now` entra por parâmetro, para o teste não depender da data real.

const DAY_MS = 86_400_000;

/** `AAAA-MM-DD` que existe no calendário (rejeita 2026-02-30). */
export function isValidDay(day: string | null | undefined): day is string {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const parsed = new Date(day + 'T12:00:00Z');
  return (
    !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day
  );
}

/** A data local de `now`, como `AAAA-MM-DD`. */
export function localDay(now: Date): string {
  return (
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` +
    `-${String(now.getDate()).padStart(2, '0')}`
  );
}

/** O "hoje" da demonstração: `?hoje=` válido na URL, senão a data local de `now`. */
export function demoToday(
  search: string | null | undefined,
  now: Date = new Date(),
): string {
  let param: string | null = null;
  try {
    param = new URLSearchParams(search ?? '').get('hoje');
  } catch {
    param = null;
  }
  return isValidDay(param) ? param : localDay(now);
}

/** `day` + `n` dias, ao meio-dia UTC (imune a horário de verão). */
export function addDays(day: string, n: number): string {
  const d = new Date(day + 'T12:00:00Z');
  return new Date(d.getTime() + n * DAY_MS).toISOString().slice(0, 10);
}

/** Dias de `from` até `to` (negativo quando `to` vem antes). */
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(to + 'T12:00:00Z').getTime() -
      new Date(from + 'T12:00:00Z').getTime()) /
      DAY_MS,
  );
}

/**
 * Desloca uma data (ou data-hora ISO) escrita contra `baseDay` para o calendário
 * em que `baseDay` vira `today`. Preserva a parte de hora e o fuso do texto.
 */
export function shiftIso(
  value: string,
  baseDay: string,
  today: string,
): string {
  const offset = daysBetween(baseDay, today);
  if (offset === 0) return value;
  const day = value.slice(0, 10);
  if (!isValidDay(day)) return value;
  return addDays(day, offset) + value.slice(10);
}

/** A data de `now` no fuso `timeZone` (o servidor roda em UTC; a demo é no Brasil). */
export function zonedDay(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * O "hoje" de uma página renderizada no servidor: `?hoje=` válido, senão a data
 * de Brasília — para a página e o navegador concordarem na virada do dia UTC.
 */
export function requestDemoToday(
  hoje: string | null | undefined,
  now: Date = new Date(),
): string {
  return isValidDay(hoje) ? hoje : zonedDay(now, 'America/Sao_Paulo');
}

/**
 * `&hoje=AAAA-MM-DD` para repassar o relógio da página ao iframe de um protótipo
 * (que lê o próprio `location.search`), ou `''` quando a URL não fixa o hoje.
 */
export function hojeParam(search: string | null | undefined): string {
  let hoje: string | null = null;
  try {
    hoje = new URLSearchParams(search ?? '').get('hoje');
  } catch {
    hoje = null;
  }
  return isValidDay(hoje) ? '&hoje=' + hoje : '';
}

const MONTHS_PT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

/**
 * Desloca as datas ESCRITAS num texto de fixture: "DD/MM", "DD/MM/AAAA",
 * "D[D] set[.] [AAAA]" e o par "11 para 14 set." (o primeiro número herda o mês).
 * Mantém o formato (zero à esquerda, ponto da abreviação). Números que não são
 * data (PO, valores, "1 × 40") não casam com nenhum formato.
 */
export function shiftDateText(
  text: string,
  baseDay: string,
  today: string,
): string {
  const offset = daysBetween(baseDay, today);
  if (!offset || !text) return text;
  const baseYear = baseDay.slice(0, 4);
  const move = (dd: string, mm: number, yyyy?: string) =>
    addDays(
      `${yyyy || baseYear}-${String(mm).padStart(2, '0')}-${dd.padStart(2, '0')}`,
      offset,
    );
  const pad = (dd: string, value: string) =>
    dd.length === 2 ? value.padStart(2, '0') : String(Number(value));
  const monthAlt = MONTHS_PT.join('|');
  return text
    .replace(
      /\b(\d{2})\/(\d{2})(\/(\d{4}))?\b/g,
      (all, dd: string, mm: string, withYear: string, yyyy: string) => {
        const m = Number(mm);
        if (m < 1 || m > 12 || Number(dd) < 1 || Number(dd) > 31) return all;
        const d = move(dd, m, yyyy);
        return (
          `${d.slice(8, 10)}/${d.slice(5, 7)}` +
          (withYear ? `/${d.slice(0, 4)}` : '')
        );
      },
    )
    .replace(
      // Uma passada só para "D mês" e o par "D1 para D2 mês": duas passadas
      // deslocariam o D2 duas vezes.
      new RegExp(
        `\\b(\\d{1,2})(?:( para | e | a )(\\d{1,2}))? (${monthAlt})(\\.?)( (\\d{4}))?\\b`,
        'g',
      ),
      (
        _all,
        d1: string,
        sep: string | undefined,
        d2: string | undefined,
        mon: string,
        dot: string,
        withYear: string | undefined,
        yyyy: string | undefined,
      ) => {
        const m = MONTHS_PT.indexOf(mon) + 1;
        const name = (d: string) => MONTHS_PT[Number(d.slice(5, 7)) - 1];
        const last = move(d2 ?? d1, m, yyyy);
        const tail =
          `${pad(d2 ?? d1, last.slice(8, 10))} ${name(last)}${dot}` +
          (withYear ? ` ${last.slice(0, 4)}` : '');
        if (!sep) return tail;
        // "30 para 2 out.": o primeiro dia é do mês anterior.
        const firstMonth =
          d2 && Number(d1) > Number(d2) ? ((m + 10) % 12) + 1 : m;
        const first = move(d1, firstMonth, yyyy);
        const head =
          name(first) === name(last)
            ? pad(d1, first.slice(8, 10))
            : `${pad(d1, first.slice(8, 10))} ${name(first)}${dot}`;
        return `${head}${sep}${tail}`;
      },
    );
}

/**
 * Desloca uma fixture inteira (cópia): string ISO vira `shiftIso`, outro texto
 * vira `shiftDateText`. Chaves em `keep` (ids, referências) não são tocadas.
 */
export function shiftFixture<T>(
  value: T,
  baseDay: string,
  today: string,
  keep: string[] = ['id', 'reference'],
): T {
  if (daysBetween(baseDay, today) === 0) return value;
  const walk = (v: unknown, key?: string): unknown => {
    if (Array.isArray(v)) return v.map((x) => walk(x));
    if (v && typeof v === 'object') {
      return Object.fromEntries(
        Object.entries(v).map(([k, x]) => [k, walk(x, k)]),
      );
    }
    if (typeof v !== 'string' || (key && keep.includes(key))) return v;
    return /^\d{4}-\d{2}-\d{2}/.test(v)
      ? shiftIso(v, baseDay, today)
      : shiftDateText(v, baseDay, today);
  };
  return walk(value) as T;
}

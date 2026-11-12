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

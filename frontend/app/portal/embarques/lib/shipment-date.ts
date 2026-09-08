// Arrival estimates are calendar dates. Use UTC, matching delay-risk.ts,
// so a midnight ETA does not move to the preceding day in Brazil.
export function arrivalDay(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function formatShipmentEta(
  iso: string | null | undefined,
  long = false,
): string {
  const day = arrivalDay(iso);
  if (day == null) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: long ? 'long' : 'short',
    ...(new Date(day).getUTCFullYear() === new Date().getUTCFullYear()
      ? {}
      : { year: 'numeric' as const }),
    timeZone: 'UTC',
  }).format(day);
}

// The portal's operating day is Brazil, independent of the browser time zone.
export function shipmentToday(now: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(part('year'), part('month') - 1, part('day'));
}

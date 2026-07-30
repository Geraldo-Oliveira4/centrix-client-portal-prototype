// Volume/time helpers for the Inteligência dashboards. All derived from real
// `created_at` timestamps (quotations or shipments) — no fabricated numbers.
//
// NOTE on what is real: created_at is the only reliable timestamp the portal
// exposes for both quotations and shipments. There is no ETA, no real ship date,
// no closed_at in the portal payload, so these helpers only ever count "opened
// per week/period" — an honest volume read, not a delivery/pontualidade metric.

const DAY = 86_400_000;

export interface WeeklyVolume {
  /** ISO date of the week start (Monday). */
  weekStart: string;
  /** Short DD/MM label for the axis. */
  label: string;
  count: number;
}

export interface VolumeTrend {
  /** Count in the last 30 days. */
  v30: number;
  /** Count in the 30 days before that. */
  prev30: number;
  /** Signed percent change vs the previous 30 days, or null with no baseline. */
  deltaPct: number | null;
}

const parseTimes = (isoDates: string[]): number[] =>
  isoDates
    .map((d) => new Date(d).getTime())
    .filter((t) => Number.isFinite(t));

export function volumeTrend(isoDates: string[], now = Date.now()): VolumeTrend {
  const times = parseTimes(isoDates);
  const v30 = times.filter((t) => t >= now - 30 * DAY).length;
  const prev30 = times.filter((t) => t < now - 30 * DAY && t >= now - 60 * DAY).length;
  const deltaPct =
    prev30 > 0 ? Math.round(((v30 - prev30) / prev30) * 100) : null;
  return { v30, prev30, deltaPct };
}

function startOfWeekMs(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  const monday = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - monday);
  return d.getTime();
}

export function weeklyVolume(
  isoDates: string[],
  weeks = 8,
  now = Date.now(),
): WeeklyVolume[] {
  const times = parseTimes(isoDates);
  const thisWeek = startOfWeekMs(now);
  const out: WeeklyVolume[] = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const start = thisWeek - i * 7 * DAY;
    const end = start + 7 * DAY;
    const count = times.filter((t) => t >= start && t < end).length;
    const d = new Date(start);
    const label = `${String(d.getDate()).padStart(2, '0')}/${String(
      d.getMonth() + 1,
    ).padStart(2, '0')}`;
    out.push({ weekStart: new Date(start).toISOString(), label, count });
  }
  return out;
}

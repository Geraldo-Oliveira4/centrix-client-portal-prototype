import type { PortalQuotation, PortalQuotationTotals } from '@/types/portal';
import type { ClientPortalProposal, QuotationModal } from '@/types/quotation';

export const formatCurrency = (
  value: number | null | undefined,
  currency = 'USD',
): string => {
  if (value == null) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
};

// date-only strings (YYYY-MM-DD) are parsed as UTC midnight by JS engines.
// Appending T12:00:00Z keeps the correct calendar date in local time for any
// timezone between UTC-12 and UTC+11.
export const formatDate = (
  iso: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' },
): string => {
  if (!iso) return '—';
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  return new Intl.DateTimeFormat('pt-BR', options).format(d);
};

// Formats a single value as "USD 1.000,00" (currency code prefix, pt-BR locale).
// Use this instead of a local fmtCurrency wherever a single-value row is needed.
export const formatCurrencyCode = (value: number, currency: string | null | undefined): string => {
  const curr = currency ?? 'USD';
  return `${curr} ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
};

// Formats a BRL-normalized value as "R$ 1.000,00". Use for any total already
// converted to BRL by the backend (proposal.total_brl). Single source of truth
// for Real formatting — do not hand-roll `BRL ${x.toLocaleString(...)}`.
export const formatBRL = (value: number | null | undefined): string => {
  if (value == null) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value);
};

const CURRENCY_ORDER = ['USD', 'EUR', 'BRL', 'GBP', 'CNY', 'ARS', 'CLP', 'MXN', 'CHF'];

// Formats a multi-currency totals map as "USD 1.000,00 + EUR 500,00 + BRL 200,00".
// Currencies are always shown in the canonical order: USD / EUR / BRL / others.
// Returns '—' when the map is empty or all values are zero.
export const formatMultiCurrency = (totals: Record<string, number>): string => {
  const parts = Object.entries(totals)
    .filter(([, v]) => v > 0)
    .sort(([a], [b]) => {
      const ai = CURRENCY_ORDER.indexOf(a);
      const bi = CURRENCY_ORDER.indexOf(b);
      return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
    })
    .map(([curr, val]) => `${curr} ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  return parts.length > 0 ? parts.join(' + ') : '—';
};

export const formatShortDate = (iso: string | null | undefined): string =>
  formatDate(iso, { day: '2-digit', month: 'short' });

// "12 de setembro" — mês por extenso, para a data que a tela apresenta como
// indicador-chave em vez de dentro de um chip. O ano só entra quando a data cai
// fora do ano corrente, mesma convenção de formatEstimatedArrival abaixo: num
// embarque que chega daqui a três semanas, "de 2026" é ruído.
export const formatLongDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return formatDate(iso, {
    day: '2-digit',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
};

// Cheapest -> most expensive, using the BRL-normalized total when available.
// This is the client portal's default ordering (per Orsi, 2026-06-22) and the
// single source of truth for it — do not re-derive this comparator locally.
export const compareByCheapestTotal = (
  a: Pick<ClientPortalProposal, 'total_brl' | 'total_value'>,
  b: Pick<ClientPortalProposal, 'total_brl' | 'total_value'>,
): number => (a.total_brl ?? a.total_value) - (b.total_brl ?? b.total_value);

export const daysUntil = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((target - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'Expirou';
  if (diffDays === 0) return 'Expira hoje';
  return `${diffDays}d restantes`;
};

export const daysSince = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'hoje';
  if (diffDays === 1) return 'há 1 dia';
  return `há ${diffDays} dias`;
};

export const formatWeight = (weight: number | null, unit: string | null): string | null => {
  if (weight === null) return null;
  return `${weight.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${unit === 'LB' ? 'lb' : 'kg'}`;
};

export const formatVolume = (volume: number | null): string | null => {
  if (volume === null) return null;
  return `${volume.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} m³`;
};

export const formatDimensions = (
  length: number | null,
  width: number | null,
  height: number | null,
  unit: string | null,
): string | null => {
  if (!length || !width || !height) return null;
  const unitLabel =
    unit === 'MM' ? 'mm' :
    unit === 'M' ? 'm' :
    unit === 'POL' ? 'pol' :
    'cm';
  return `${length} x ${width} x ${height} ${unitLabel}`;
};

export const formatRoute = (q: PortalQuotation): string => {
  const dest =
    (q.porto_destino && q.porto_destino[0]) ||
    (q.aeroporto_destino && q.aeroporto_destino[0]) ||
    '—';
  return `${q.origin ?? '—'} → ${dest}`;
};

export const addDays = (days: number): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

// Returns "Chega em Xd (DD de mês)" for use in proposal tables.
// Omits the year when the estimated arrival is in the current year.
export const formatEstimatedArrival = (transitTime: number | null | undefined): string => {
  if (transitTime == null) return '—';
  const arrival = new Date();
  arrival.setHours(0, 0, 0, 0);
  arrival.setDate(arrival.getDate() + transitTime);
  const sameYear = arrival.getFullYear() === new Date().getFullYear();
  const dateStr = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(arrival);
  return `Chega em ${transitTime}d (${dateStr})`;
};

export const formatTotals = (
  totals: PortalQuotationTotals | undefined | null,
  modal?: QuotationModal | null,
): string => {
  if (!totals) return '—';
  const { weight_kg, volume_m3, qty } = totals;
  if (weight_kg == null && volume_m3 == null && qty == null) return '—';
  const parts: string[] = [];
  if (weight_kg != null) parts.push(`${weight_kg.toLocaleString('pt-BR')} kg`);
  if (volume_m3 != null) {
    const unit = modal === 'AEREO' ? 'kg' : 'm³';
    parts.push(`${volume_m3.toLocaleString('pt-BR')} ${unit}`);
  }
  if (qty != null) parts.push(`${qty} vol.`);
  return parts.join(' / ');
};

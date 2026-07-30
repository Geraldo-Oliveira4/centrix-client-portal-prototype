// Generic tone -> class maps for stat tiles / KPIs OUTSIDE the shipment domain.
//
// The shipment semáforo (types/portal-shipment.ts) is keyed by EmbarqueEstado and
// is 3-colour only. Dashboards need a small, domain-agnostic tone map that also
// includes `neutral`/`info` for non-health numbers (volume, counts). The health
// semáforo for KPIs still uses only success/warning/danger.

export type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export const TONE_TEXT: Record<Tone, string> = {
  success: 'text-portal-success',
  warning: 'text-portal-warning',
  danger: 'text-portal-danger',
  neutral: 'text-portal-neutral',
  info: 'text-portal-info',
};

export const TONE_DOT: Record<Tone, string> = {
  success: 'bg-portal-success',
  warning: 'bg-portal-warning',
  danger: 'bg-portal-danger',
  neutral: 'bg-portal-neutral',
  info: 'bg-portal-info',
};

export const TONE_BADGE: Record<Tone, string> = {
  success: 'border-portal-success/25 bg-portal-success/10 text-portal-success',
  warning: 'border-portal-warning/30 bg-portal-warning/10 text-portal-warning',
  danger: 'border-portal-danger/30 bg-portal-danger/10 text-portal-danger',
  neutral: 'border-border bg-muted text-portal-neutral',
  info: 'border-portal-info/25 bg-portal-info/10 text-portal-info',
};

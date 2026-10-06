// Preferências de alertas (07/10/2026): COMO os alertas chegam — canal,
// frequência e resumo semanal. O QUE acompanhar (tipos e sensibilidade)
// continua em Configurações > Alertas. PURO, sem `@/` (node --test).
//
// Só neste navegador, no store de demonstração. Não há serviço de envio:
// "Testar notificação" é simulado e rotulado "Prévia". O que o backend
// precisaria está em docs/spec-onboarding-backend.md.

import { decodeDemoValue } from '../../_shared/demo/demo-store.ts';

export const ALERT_DELIVERY_STORE_NAME = 'alert-delivery';

export const ALERT_CHANNELS = [
  { id: 'portal', label: 'No portal', hint: 'Avisos no sino do cabeçalho.' },
  { id: 'email', label: 'E-mail', hint: 'No e-mail do seu cadastro.' },
] as const;
export type AlertChannel = (typeof ALERT_CHANNELS)[number]['id'];

export const ALERT_FREQUENCIES = [
  { id: 'imediato', label: 'Na hora', hint: 'Cada alerta assim que acontece.' },
  { id: 'diario', label: 'Uma vez por dia', hint: 'Um resumo no fim da manhã.' },
] as const;
export type AlertFrequency = (typeof ALERT_FREQUENCIES)[number]['id'];

export const WEEKDAYS = ['segunda', 'terça', 'quarta', 'quinta', 'sexta'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface AlertDelivery {
  channels: AlertChannel[];
  frequency: AlertFrequency;
  weeklySummary: boolean;
  weeklyDay: Weekday;
}

export const DEFAULT_ALERT_DELIVERY: AlertDelivery = {
  channels: ['portal'],
  frequency: 'imediato',
  weeklySummary: true,
  weeklyDay: 'segunda',
};

export function normalizeAlertDelivery(raw: unknown): AlertDelivery {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_ALERT_DELIVERY };
  const d = raw as Record<string, unknown>;
  const channels = Array.isArray(d.channels)
    ? Array.from(new Set(d.channels.filter((c): c is AlertChannel => ALERT_CHANNELS.some((x) => x.id === c))))
    : DEFAULT_ALERT_DELIVERY.channels;
  return {
    // Sem canal nenhum o alerta não chegaria a lugar algum: volta ao portal.
    channels: channels.length ? channels : ['portal'],
    frequency: ALERT_FREQUENCIES.some((f) => f.id === d.frequency) ? (d.frequency as AlertFrequency) : DEFAULT_ALERT_DELIVERY.frequency,
    weeklySummary: typeof d.weeklySummary === 'boolean' ? d.weeklySummary : DEFAULT_ALERT_DELIVERY.weeklySummary,
    weeklyDay: (WEEKDAYS as readonly string[]).includes(d.weeklyDay as string) ? (d.weeklyDay as Weekday) : DEFAULT_ALERT_DELIVERY.weeklyDay,
  };
}

export function parseAlertDelivery(raw: string | null): AlertDelivery {
  return decodeDemoValue(raw, { ...DEFAULT_ALERT_DELIVERY }, normalizeAlertDelivery);
}

/** Frase do resumo, impressa na tela e no "Testar notificação". */
export function alertDeliverySummary(p: AlertDelivery): string {
  const where = p.channels.map((c) => ALERT_CHANNELS.find((x) => x.id === c)!.label.toLowerCase()).join(' e ');
  const when = p.frequency === 'imediato' ? 'na hora' : 'uma vez por dia';
  const weekly = p.weeklySummary ? `, e um resumo semanal toda ${p.weeklyDay}` : '';
  return `Alertas ${when}, ${where}${weekly}.`;
}

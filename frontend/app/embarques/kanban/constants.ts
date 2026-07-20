import type { EmbarqueEstado } from '@/types/shipment';

// Column order for the GE kanban: five primary states followed by the two
// exception states (Central de Acoes Urgentes). Mirrors EmbarqueState on the backend.
export const EMBARQUE_COLUMNS: EmbarqueEstado[] = [
  'solicitado',
  'aguardando_prontidao',
  'coletado',
  'analise_booking',
  'embarcado',
  'postergado',
  'booking_divergente',
];

export interface ColumnStyle {
  label: string;
  headerColor: string;
  headerBg: string;
  darkHeaderBg: string;
}

export const COLUMN_CONFIG: Record<EmbarqueEstado, ColumnStyle> = {
  solicitado: {
    label: 'Solicitado',
    headerColor: 'border-blue-500',
    headerBg: 'bg-blue-50',
    darkHeaderBg: 'dark:bg-blue-950/30',
  },
  aguardando_prontidao: {
    label: 'Aguardando Prontidão',
    headerColor: 'border-yellow-500',
    headerBg: 'bg-yellow-50',
    darkHeaderBg: 'dark:bg-yellow-950/30',
  },
  coletado: {
    label: 'Coletado',
    headerColor: 'border-indigo-500',
    headerBg: 'bg-indigo-50',
    darkHeaderBg: 'dark:bg-indigo-950/30',
  },
  analise_booking: {
    label: 'Análise de Booking',
    headerColor: 'border-orange-500',
    headerBg: 'bg-orange-50',
    darkHeaderBg: 'dark:bg-orange-950/30',
  },
  embarcado: {
    label: 'Embarcado',
    headerColor: 'border-green-500',
    headerBg: 'bg-green-50',
    darkHeaderBg: 'dark:bg-green-950/30',
  },
  postergado: {
    label: 'Postergado',
    headerColor: 'border-amber-500',
    headerBg: 'bg-amber-50',
    darkHeaderBg: 'dark:bg-amber-950/30',
  },
  booking_divergente: {
    label: 'Booking Divergente',
    headerColor: 'border-red-500',
    headerBg: 'bg-red-50',
    darkHeaderBg: 'dark:bg-red-950/30',
  },
};

// Badge styling per state — reused by the kanban card and the workspace header.
export const ESTADO_BADGE: Record<EmbarqueEstado, { label: string; className: string }> = {
  solicitado: {
    label: 'Solicitado',
    className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800',
  },
  aguardando_prontidao: {
    label: 'Aguardando Prontidão',
    className: 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-800',
  },
  coletado: {
    label: 'Coletado',
    className: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-800',
  },
  analise_booking: {
    label: 'Análise de Booking',
    className: 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-800',
  },
  embarcado: {
    label: 'Embarcado',
    className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800',
  },
  postergado: {
    label: 'Postergado',
    className: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800',
  },
  booking_divergente: {
    label: 'Booking Divergente',
    className: 'bg-destructive/10 text-destructive border-destructive/30',
  },
};

// MODAL_DISPLAY is shared across the cotacao and embarques kanbans — re-exported
// here so existing imports from './constants' keep working.
export { MODAL_DISPLAY } from '@/types/quotation';

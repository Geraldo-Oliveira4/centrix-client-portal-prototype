import type {
  KanbanColumnKey,
  QuotationModal,
  QuotationState,
} from '@/types/quotation';
import { MODAL_LABELS } from '@/types/quotation';

export const KANBAN_COLUMNS: KanbanColumnKey[] = [
  'PARA_COTAR',
  'COTANDO',
  'PARA_ANALISE',
  'ENVIADA_CLIENTE',
  'APROVADA_PELO_CLIENTE',
  'FECHADA',
  'DECLINADA',
  'CANCELADO',
];

export const COLUMN_CONFIG: Record<
  KanbanColumnKey,
  { label: string; headerColor: string; headerBg: string; darkHeaderBg: string }
> = {
  PARA_COTAR: {
    label: 'Para Cotar',
    headerColor: 'border-purple-500',
    headerBg: 'bg-purple-50',
    darkHeaderBg: 'dark:bg-purple-950/30',
  },
  COTANDO: {
    label: 'Cotando',
    headerColor: 'border-blue-500',
    headerBg: 'bg-blue-50',
    darkHeaderBg: 'dark:bg-blue-950/30',
  },
  PARA_ANALISE: {
    label: 'Para Analise',
    headerColor: 'border-orange-500',
    headerBg: 'bg-orange-50',
    darkHeaderBg: 'dark:bg-orange-950/30',
  },
  ENVIADA_CLIENTE: {
    label: 'Enviada ao Cliente',
    headerColor: 'border-indigo-500',
    headerBg: 'bg-indigo-50',
    darkHeaderBg: 'dark:bg-indigo-950/30',
  },
  APROVADA_PELO_CLIENTE: {
    label: 'Aprovada pelo Cliente',
    headerColor: 'border-amber-500',
    headerBg: 'bg-amber-50',
    darkHeaderBg: 'dark:bg-amber-950/30',
  },
  FECHADA: {
    label: 'Fechada',
    headerColor: 'border-green-500',
    headerBg: 'bg-green-50',
    darkHeaderBg: 'dark:bg-green-950/30',
  },
  DECLINADA: {
    label: 'Declinada',
    headerColor: 'border-red-500',
    headerBg: 'bg-red-50',
    darkHeaderBg: 'dark:bg-red-950/30',
  },
  CANCELADO: {
    label: 'Cancelado',
    headerColor: 'border-gray-400',
    headerBg: 'bg-gray-50',
    darkHeaderBg: 'dark:bg-gray-900/30',
  },
};

// Client-side pre-validation of allowed transitions.
// REVISAO_AGENTE cards live visually in PARA_ANALISE, and TRIAGEM_IA/AGUARDANDO_DADOS
// cards live visually in PARA_COTAR — all use their real state for transitions.
// COTANDO is deliberately absent from TRIAGEM_IA/AGUARDANDO_DADOS — it is only
// reachable by dispatching the RFQ, never by a bare manual move (backend guard
// in quotation_state_machine.py._guard_to_cotando).
export const CLIENT_ALLOWED_TRANSITIONS: Record<string, QuotationState[]> = {
  TRIAGEM_IA: ['AGUARDANDO_DADOS', 'CANCELADO'],
  AGUARDANDO_DADOS: ['TRIAGEM_IA', 'CANCELADO'],
  COTANDO: ['PARA_ANALISE', 'CANCELADO'],
  PARA_ANALISE: ['REVISAO_AGENTE', 'ENVIADA_CLIENTE', 'CANCELADO'],
  REVISAO_AGENTE: ['PARA_ANALISE', 'ENVIADA_CLIENTE', 'FECHADA', 'CANCELADO'],
  ENVIADA_CLIENTE: ['APROVADA_PELO_CLIENTE', 'FECHADA', 'DECLINADA', 'CANCELADO'],
  APROVADA_PELO_CLIENTE: ['FECHADA', 'CANCELADO'],
  FECHADA: ['COTANDO'],
  DECLINADA: [],
  CANCELADO: [],
};

// Maps target states to the column they visually belong in
export const STATE_TO_COLUMN: Record<QuotationState, KanbanColumnKey> = {
  TRIAGEM_IA: 'PARA_COTAR',
  AGUARDANDO_DADOS: 'PARA_COTAR',
  COTANDO: 'COTANDO',
  PARA_ANALISE: 'PARA_ANALISE',
  REVISAO_AGENTE: 'PARA_ANALISE',
  APROVADA_PELO_CLIENTE: 'APROVADA_PELO_CLIENTE',
  ENVIADA_CLIENTE: 'ENVIADA_CLIENTE',
  FECHADA: 'FECHADA',
  DECLINADA: 'DECLINADA',
  CANCELADO: 'CANCELADO',
};

export type SortOption = 'urgency' | 'date' | 'sla';

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'urgency', label: 'Urgencia' },
  { value: 'date', label: 'Data de Recebimento' },
  { value: 'sla', label: 'Risco de SLA' },
];

export type FilterChip = 'URGENTES' | 'CRITICO' | 'SLA_CRITICO';

export const FILTER_CHIPS: { value: FilterChip; label: string }[] = [
  { value: 'URGENTES', label: 'Urgentes' },
  { value: 'CRITICO', label: 'Critico' },
  { value: 'SLA_CRITICO', label: 'SLA Critico' },
];

export type ModalFilter = 'TODOS' | QuotationModal;
export type TipoEmbarqueFilter = 'TODOS' | 'FCL' | 'LCL';

// Order shown in the dropdown. Labels come from the canonical MODAL_LABELS so
// they stay accented and in sync with the rest of the app (single source of
// truth — RODOVIARIO was previously missing here, hiding road quotations from
// the filter).
const MODAL_FILTER_VALUES: QuotationModal[] = ['AEREO', 'MARITIMO', 'RODOVIARIO'];

export const MODAL_FILTER_OPTIONS: { value: ModalFilter; label: string }[] = [
  { value: 'TODOS', label: 'Todos os modais' },
  ...MODAL_FILTER_VALUES.map((value) => ({ value, label: MODAL_LABELS[value] })),
];

export const TIPO_EMBARQUE_FILTER_OPTIONS: { value: TipoEmbarqueFilter; label: string }[] = [
  { value: 'TODOS', label: 'FCL e LCL' },
  { value: 'FCL', label: 'FCL' },
  { value: 'LCL', label: 'LCL' },
];

export interface KanbanFilterState {
  search: string;
  sort: SortOption;
  activeChips: Set<FilterChip>;
  showCancelled: boolean;
  modalFilter: ModalFilter;
  tipoEmbarqueFilter: TipoEmbarqueFilter;
  portalApprovedFilter: boolean;
  guardRailActiveFilter: boolean;
  produtoFilter: string;
  rotaFilter: string;
  agenteFilter: string;
  exportadorFilter: string;
  paisProcedenciaFilter: string;
  pesoTaxadoMin: string;
  // Period filter operates on created_at (the quotation reception date, matching
  // the "Data de Recebimento" sort). Both are inclusive YYYY-MM-DD bounds; empty
  // means unbounded on that side.
  periodoInicio: string;
  periodoFim: string;
}

/**
 * Inclusive check that a card's created_at (reception date) falls within the
 * selected período bounds. Bounds are YYYY-MM-DD strings parsed as local
 * datetimes so the selected day is fully inclusive regardless of the created_at
 * timezone. An empty bound is treated as unbounded on that side.
 */
export function isWithinReceptionRange(
  createdAt: string | null | undefined,
  periodoInicio: string,
  periodoFim: string,
): boolean {
  if (!periodoInicio && !periodoFim) return true;
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (periodoInicio && created < new Date(`${periodoInicio}T00:00:00`).getTime()) return false;
  if (periodoFim && created > new Date(`${periodoFim}T23:59:59.999`).getTime()) return false;
  return true;
}

export const INITIAL_KANBAN_FILTERS: KanbanFilterState = {
  search: '',
  sort: 'urgency',
  activeChips: new Set(),
  showCancelled: false,
  modalFilter: 'TODOS',
  tipoEmbarqueFilter: 'TODOS',
  portalApprovedFilter: false,
  guardRailActiveFilter: false,
  produtoFilter: '',
  rotaFilter: '',
  agenteFilter: '',
  exportadorFilter: '',
  paisProcedenciaFilter: '',
  pesoTaxadoMin: '',
  periodoInicio: '',
  periodoFim: '',
};


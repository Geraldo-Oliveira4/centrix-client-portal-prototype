import { TIPO_EMBARQUE_LABELS, TIPO_CONTAINER_LABELS } from '@/types/quotation';
import type { Quotation, QuotationFieldValues, QuotationVolume, TipoContainer, UpdateQuotationPayload } from '@/types/quotation';

// Shared padding helper — avoids four inline copies across datetime formatters.
const pad = (n: number) => String(n).padStart(2, '0');

// ---------------------------------------------------------------------------
// Currency helpers
// ---------------------------------------------------------------------------

/**
 * Format a declared cargo value with its currency.
 * Single source of truth used by rfq-dispatch-preview (analyst view) and
 * rfq-details-card (agent portal) to guarantee consistent display and fallback.
 */
export function formatDeclaredValue(quotation: {
  declared_value: number | null;
  declared_value_currency: string | null;
}): string {
  if (quotation.declared_value === null || quotation.declared_value === undefined) return 'N/A';
  const currency = quotation.declared_value_currency ?? 'USD';
  return `${currency} ${Number(quotation.declared_value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ---------------------------------------------------------------------------
// Date / bool helpers
// ---------------------------------------------------------------------------

export function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

export function boolStr(v: boolean | null | undefined): '' | 'true' | 'false' {
  return v === true ? 'true' : v === false ? 'false' : '';
}

// Returns a datetime-local string (YYYY-MM-DDTHH:MM) for today + daysAhead at 18:00 local time.
// Used to pre-fill desired_deadline with a sensible editable default.
export function defaultDeadlineDatetimeLocal(daysAhead: number = 2): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T18:00`;
}

// Handles both Brazilian (39.695,78) and standard (39695.78) number formats.
export function parseBrNumber(value: string): number {
  const hasDot = value.includes('.');
  const hasComma = value.includes(',');
  if (hasDot && hasComma) {
    // Brazilian format: dot = thousands separator, comma = decimal
    return parseFloat(value.replace(/\./g, '').replace(',', '.'));
  }
  if (hasComma) {
    // Comma-only: treat as decimal separator
    return parseFloat(value.replace(',', '.'));
  }
  return parseFloat(value);
}

export function formatBrNumber(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function boolDisplay(v: boolean | null | undefined): string {
  if (v === null || v === undefined) return 'N/A';
  return v ? 'Sim' : 'Não';
}

/** Inverse of boolStr — converts a react-hook-form select value back to boolean. */
export function parseBool(v: string | undefined): boolean | undefined {
  if (v === 'true') return true;
  if (v === 'false') return false;
  return undefined;
}

// date-only strings (YYYY-MM-DD) are parsed as UTC midnight by JS engines.
// Appending T12:00:00Z keeps the correct calendar date in local time for any
// timezone between UTC-12 and UTC+11.
export function formatDateDisplay(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  return d.toLocaleDateString('pt-BR');
}

// Uses UTC getters — correct for date-only strings (YYYY-MM-DD) stored as UTC midnight.
export function formatUtcDate(iso: string | null | undefined): string {
  if (!iso) return 'N/A';
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// Uses local-timezone getters — use for user-entered datetime fields (e.g. desired_deadline)
// that are stored as UTC but must be displayed in the user's local time.
export function formatLocalDatetime(iso: string | null | undefined): string {
  if (!iso) return 'N/A';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Returns today's date as YYYY-MM-DD in UTC — wire format for date-only fields.
// Prefer this over new Date().toLocaleDateString('en-CA') for explicitness.
export function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// DNA autofill helpers
// ---------------------------------------------------------------------------

/**
 * Picks the DNA destination yard matching the quotation's modal/sub-type.
 *
 * destination_yard used to be a single free-text field with per-modal
 * sections that had to be parsed out (ARB-2384, JARTEC case: parsing fell
 * back to returning the whole text — including the wrong modal's yard —
 * whenever modal hadn't been selected yet). It is now 3 typed DNA fields,
 * so this is a direct lookup, no parsing.
 *
 * BREAK_BULK has no dedicated column (low volume) and resolves to ''.
 *
 * Single source of truth — used by nova-cotacao/page.tsx and manual-form.tsx
 * so that DNA autofill only pre-fills the value relevant to the selected modal.
 */
export function resolveDnaDestinationYard(
  dna: {
    destination_yard_aereo: string | null;
    destination_yard_maritimo_fcl: string | null;
    destination_yard_maritimo_lcl: string | null;
  } | null | undefined,
  modal: string | null | undefined,
  tipoEmbarque?: string | null,
): string {
  if (!dna) return '';
  if (modal === 'AEREO') return dna.destination_yard_aereo ?? '';
  if (modal === 'MARITIMO') {
    if (tipoEmbarque === 'LCL') return dna.destination_yard_maritimo_lcl ?? '';
    if (tipoEmbarque === 'FCL') return dna.destination_yard_maritimo_fcl ?? '';
  }
  return '';
}

/**
 * Maps a client DNA insurance_responsibility value to the insurance_required
 * field default. Returns 'true' when the agent must provide insurance,
 * 'false' when Freitas or no one covers it, and null when the DNA value
 * gives no guidance (e.g. CLIENTE — handled separately by the analyst).
 *
 * Single source of truth — used by nova-cotacao/page.tsx and manual-form.tsx.
 * Must stay consistent with the backend auto-fill in update_quotation:
 *   insurance_required = (dna.insurance_responsibility == AGENTE_DE_CARGAS)
 */
export function dnaInsuranceDefault(
  resp: string | null | undefined,
): 'true' | 'false' | null {
  if (resp === 'AGENTE_DE_CARGAS') return 'true';
  if (resp === 'FREITAS' || resp === 'NAO_INCLUSO') return 'false';
  return null;
}

// ---------------------------------------------------------------------------
// Quotation → editable flat state
// ---------------------------------------------------------------------------

export function quotationToFieldValues(q: Quotation): QuotationFieldValues {
  return {
    client_id: q.client_id ?? '',
    service_type: (q.service_type as QuotationFieldValues['service_type']) ?? '',
    modal: (q.modal as QuotationFieldValues['modal']) ?? '',
    tipo_embarque: (q.tipo_embarque as QuotationFieldValues['tipo_embarque']) ?? '',
    tipo_cotacao: (q.tipo_cotacao as QuotationFieldValues['tipo_cotacao']) ?? '',
    data_cotacao: q.data_cotacao ?? '',
    origin: q.origin ?? '',
    porto_embarque: q.porto_embarque ?? '',
    porto_destino: q.porto_destino ?? [],
    aeroporto_embarque: q.aeroporto_embarque ?? '',
    aeroporto_destino: q.aeroporto_destino ?? [],
    incluir_entrega_destino_final: boolStr(q.incluir_entrega_destino_final),
    incoterm: q.incoterm ?? '',
    product: q.product ?? '',
    desired_deadline: toDatetimeLocal(q.desired_deadline),
    data_prontidao: q.data_prontidao ?? '',
    data_limite_necessidade: q.data_limite_necessidade ?? '',
    declared_value: q.declared_value !== null ? formatBrNumber(q.declared_value) : '',
    declared_value_currency: q.declared_value_currency ?? '',
    stackability: boolStr(q.stackability),
    carga_tombavel: boolStr(q.carga_tombavel),
    insurance_required: boolStr(q.insurance_required),
    carga_perigosa: (q.carga_perigosa as QuotationFieldValues['carga_perigosa']) ?? '',
    un_number: q.un_number ?? '',
    imo_class: q.imo_class ?? '',
    temperatura_min: q.temperatura_min !== null ? String(q.temperatura_min) : '',
    temperatura_max: q.temperatura_max !== null ? String(q.temperatura_max) : '',
    client_reference: q.client_reference ?? '',
    agente_define_porto_embarque: boolStr(q.agente_define_porto_embarque),
    agente_define_porto_destino: boolStr(q.agente_define_porto_destino),
    agente_define_aeroporto_embarque: boolStr(q.agente_define_aeroporto_embarque),
    agente_define_aeroporto_destino: boolStr(q.agente_define_aeroporto_destino),
    agente_define_local_coleta: boolStr(q.agente_define_local_coleta),
    ptax_negociada: q.ptax_negociada ?? '',
    price_or_performance: q.price_or_performance ?? '',
    destination_yard: q.destination_yard ?? '',
    endereco_entrega_final: q.endereco_entrega_final ?? '',
    necessidade_descarga: boolStr(q.necessidade_descarga),
    ncm: q.ncm ?? '',
    exportador: q.exportador ?? '',
    pais_procedencia: q.pais_procedencia ?? '',
    peso_taxado: q.peso_taxado !== null ? String(q.peso_taxado) : '',
    observations: q.observations ?? '',
  };
}

// ---------------------------------------------------------------------------
// Quotation field values → API update payload
//
// Single source of truth — used by nova-cotacao, [id], and the autosave hook.
// ---------------------------------------------------------------------------

export function buildQuotationUpdatePayload(values: QuotationFieldValues): UpdateQuotationPayload {
  const payload: UpdateQuotationPayload = {};
  if (values.service_type) payload.service_type = values.service_type;
  if (values.modal) payload.modal = values.modal;
  if (values.tipo_embarque) payload.tipo_embarque = values.tipo_embarque;
  if (values.tipo_cotacao) payload.tipo_cotacao = values.tipo_cotacao;
  if (values.data_cotacao) payload.data_cotacao = values.data_cotacao;
  payload.origin = values.origin || null;
  if (values.porto_embarque) payload.porto_embarque = values.porto_embarque;
  if (values.porto_destino.length > 0) payload.porto_destino = values.porto_destino;
  if (values.aeroporto_embarque) payload.aeroporto_embarque = values.aeroporto_embarque;
  if (values.aeroporto_destino.length > 0) payload.aeroporto_destino = values.aeroporto_destino;
  if (values.incluir_entrega_destino_final !== '') payload.incluir_entrega_destino_final = values.incluir_entrega_destino_final === 'true';
  payload.incoterm = values.incoterm || null;
  payload.product = values.product || null;
  if (values.desired_deadline) payload.desired_deadline = new Date(values.desired_deadline).toISOString();
  if (values.data_prontidao) payload.data_prontidao = values.data_prontidao;
  if (values.data_limite_necessidade) payload.data_limite_necessidade = values.data_limite_necessidade;
  if (values.declared_value) payload.declared_value = parseBrNumber(values.declared_value);
  if (values.declared_value_currency) payload.declared_value_currency = values.declared_value_currency;
  if (values.stackability !== '') payload.stackability = values.stackability === 'true';
  if (values.carga_tombavel !== '') payload.carga_tombavel = values.carga_tombavel === 'true';
  if (values.insurance_required !== '') payload.insurance_required = values.insurance_required === 'true';
  if (values.carga_perigosa) payload.carga_perigosa = values.carga_perigosa;
  if (values.un_number) payload.un_number = values.un_number;
  if (values.imo_class) payload.imo_class = values.imo_class;
  if (values.temperatura_min) payload.temperatura_min = parseFloat(values.temperatura_min);
  if (values.temperatura_max) payload.temperatura_max = parseFloat(values.temperatura_max);
  if (values.client_reference) payload.client_reference = values.client_reference;
  if (values.agente_define_local_coleta !== '') payload.agente_define_local_coleta = values.agente_define_local_coleta === 'true';
  if (values.agente_define_porto_embarque !== '') payload.agente_define_porto_embarque = values.agente_define_porto_embarque === 'true';
  if (values.agente_define_porto_destino !== '') payload.agente_define_porto_destino = values.agente_define_porto_destino === 'true';
  if (values.agente_define_aeroporto_embarque !== '') payload.agente_define_aeroporto_embarque = values.agente_define_aeroporto_embarque === 'true';
  if (values.agente_define_aeroporto_destino !== '') payload.agente_define_aeroporto_destino = values.agente_define_aeroporto_destino === 'true';
  payload.ptax_negociada = values.ptax_negociada || null;
  if (values.price_or_performance) payload.price_or_performance = values.price_or_performance;
  payload.destination_yard = values.destination_yard || null;
  if (values.incluir_entrega_destino_final === 'true' && values.endereco_entrega_final !== undefined) payload.endereco_entrega_final = values.endereco_entrega_final;
  if (values.incluir_entrega_destino_final !== 'true') payload.endereco_entrega_final = null;
  if (values.necessidade_descarga !== '') payload.necessidade_descarga = values.necessidade_descarga === 'true';
  payload.ncm = values.ncm || null;
  payload.exportador = values.exportador || null;
  payload.pais_procedencia = values.pais_procedencia || null;
  if (values.peso_taxado !== '') payload.peso_taxado = parseFloat(values.peso_taxado);
  payload.observations = values.observations || null;
  return payload;
}

// ---------------------------------------------------------------------------
// Field visibility — single source of truth for both form and grid
//
// Any component that conditionally shows/hides quotation fields based on
// modal, tipo_embarque, carga_perigosa, etc. must derive those flags from
// this function. Adding a new conditional field means updating only here.
// ---------------------------------------------------------------------------

export interface FieldVisibility {
  isMaritime: boolean;
  isAir: boolean;
  isRoad: boolean;
  isFCL: boolean;
  isLCL: boolean;
  /** True when service_type is EXPORTACAO — callers should swap departure/destination port options */
  isExportation: boolean;
  showTipoEmbarque: boolean;
  /** Porto (maritime) or frontier crossing point (road) — reuses porto_embarque/porto_destino columns */
  showPorto: boolean;
  showAeroporto: boolean;
  /** Customs yard field — maritime and road; redundant for air since aeroporto_destino covers it */
  showDestinationYard: boolean;
  /** LCL, Aéreo, Break Bulk, or Road — shows volume list instead of equipment list */
  showVolumeSection: boolean;
  showIncluirEntrega: boolean;
  showEnderecoEntrega: boolean;
  showTemperatura: boolean;
  showUnNumber: boolean;
  showImoClass: boolean;
  /** True when incoterm is DDP — NCM code required for customs clearance */
  showNcm: boolean;
}

export interface FieldVisibilityContext {
  modal?: string | null;
  tipo_embarque?: string | null;
  carga_perigosa?: string | null;
  service_type?: string | null;
  /** Accepts both boolean (from Quotation) and string (from QuotationFieldValues) */
  incluir_entrega_destino_final?: string | boolean | null;
  temperatura_min?: string | number | null;
  temperatura_max?: string | number | null;
  incoterm?: string | null;
}

export function getFieldVisibility(ctx: FieldVisibilityContext): FieldVisibility {
  const isMaritime = ctx.modal === 'MARITIMO';
  const isAir = ctx.modal === 'AEREO';
  const isRoad = ctx.modal === 'RODOVIARIO';
  const isFCL = isMaritime && ctx.tipo_embarque === 'FCL';
  const isLCL = isMaritime && ctx.tipo_embarque === 'LCL';
  const isBreakBulk = isMaritime && ctx.tipo_embarque === 'BREAK_BULK';
  const isExportation = ctx.service_type === 'EXPORTACAO';

  const incluirEntrega =
    ctx.incluir_entrega_destino_final === true ||
    ctx.incluir_entrega_destino_final === 'true';

  const cargaPerigosaActive =
    ctx.carga_perigosa != null &&
    ctx.carga_perigosa !== '' &&
    ctx.carga_perigosa !== 'NAO';

  const hasTempValue =
    (ctx.temperatura_min != null && ctx.temperatura_min !== '') ||
    (ctx.temperatura_max != null && ctx.temperatura_max !== '');

  return {
    isMaritime,
    isAir,
    isRoad,
    isFCL,
    isLCL,
    isExportation,
    showTipoEmbarque: isMaritime,
    showPorto: isMaritime || isRoad,
    showAeroporto: isAir,
    showDestinationYard: !isAir,
    showVolumeSection: isAir || isLCL || isBreakBulk || isRoad,
    showIncluirEntrega: isAir || isLCL,
    showEnderecoEntrega: (isAir || isLCL) && incluirEntrega,
    // Show temperature fields if carga perigosa is active (RA/IMO) OR if
    // values already exist (e.g. set via the "Carga Refrigerada" switch on the form).
    showTemperatura: cargaPerigosaActive || hasTempValue,
    showUnNumber: ctx.carga_perigosa === 'RA' || ctx.carga_perigosa === 'IMO',
    showImoClass: ctx.carga_perigosa === 'IMO',
    showNcm: ctx.incoterm === 'DDP',
  };
}

interface VolumeAggregatable {
  quantity: number;
  peso_bruto?: number | null;
  peso_unidade?: string | null;
  volume_m3?: number | null;
}

/**
 * Aggregate totals across all volumes. peso_bruto and volume_m3 are stored as line totals
 * (not per-unit), so they are summed directly; quantity is accumulated separately.
 * Single source of truth shared by rfq-dispatch-preview and the closing email template.
 * Both the email builder counterpart (_aggregate_volume_totals in rfq_email_builder.py)
 * and this function must stay in sync when aggregation rules change.
 */
export function summarizeVolumes(volumes: VolumeAggregatable[]): {
  totalQty: number;
  pesoByUnit: Record<string, number>;
  totalM3: number;
} {
  const pesoByUnit: Record<string, number> = {};
  let totalM3 = 0;
  let totalQty = 0;
  for (const v of volumes) {
    totalQty += v.quantity;
    if (v.peso_bruto != null && v.peso_unidade) {
      pesoByUnit[v.peso_unidade] = (pesoByUnit[v.peso_unidade] ?? 0) + v.peso_bruto;
    }
    if (v.volume_m3 != null) totalM3 += v.volume_m3;
  }
  return { totalQty, pesoByUnit, totalM3 };
}

/**
 * Format the pesoByUnit map returned by summarizeVolumes into a display string,
 * e.g. "1.250,000 KG + 40,000 LB". Single source of truth for the peso-by-unit
 * join pattern — previously duplicated (with a drifted minimumFractionDigits vs
 * maximumFractionDigits) across rfq-dispatch-preview, proposals-section, and
 * volumes-table.
 */
export function formatPesoByUnit(pesoByUnit: Record<string, number>, fallback = 'N/A'): string {
  const entries = Object.entries(pesoByUnit);
  if (entries.length === 0) return fallback;
  return entries
    .map(([unit, total]) => `${total.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} ${unit}`)
    .join(' + ');
}

/**
 * Format a total volume count as "N volume(s)", or null when there are none.
 * Single source of truth shared by the client-portal summary card and the
 * closing-email volume line.
 */
export function formatVolumesCount(totalQty: number): string | null {
  return totalQty > 0 ? `${totalQty} volume(s)` : null;
}

/**
 * Format quotation equipments (containers) as "2x 20' Standard, 1x 40' High Cube",
 * or null when there are none.
 */
export function formatContainerSummary(
  equipments: { quantity: number; tipo_container: string }[],
): string | null {
  if (equipments.length === 0) return null;
  return equipments
    .map((e) => `${e.quantity}x ${TIPO_CONTAINER_LABELS[e.tipo_container as TipoContainer] ?? e.tipo_container}`)
    .join(', ');
}

export function resolveEmbarqueLabel(
  modal: string | null | undefined,
  tipo_embarque: string | null | undefined,
): string | null {
  if (modal === 'AEREO') return TIPO_EMBARQUE_LABELS['AEREO'] ?? null;
  if (!tipo_embarque) return null;
  return TIPO_EMBARQUE_LABELS[tipo_embarque] ?? tipo_embarque;
}

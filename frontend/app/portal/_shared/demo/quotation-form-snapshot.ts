// What the client SENT, as a flat snapshot — the base of the hardblocks, of the
// "campos alterados" diff and of the exit review.
//
// PURE, sem o alias `@/`: roda sob `npm run test:unit`. The only import from
// outside the demo layer is a TYPE, erased before the Node runner sees it (same
// arrangement as `cotacoes/lib/preparation-model.ts`).
//
// WHY A SNAPSHOT AND NOT THE PAYLOAD. The portal payload does not carry three
// things the Orsi list depends on: `price_or_performance`, `ncm` and the
// "Deixar que agentes decidam" switches. The backend create ignores them (and
// this front-end work does not touch the backend), so without a copy of what
// the client typed, reopening the form in review would come back with those
// fields empty and blocked — the client would be asked again for what they had
// already answered. The snapshot lives in the V2 overlay, never in the server.
//
// Values are kept RAW (the form's own codes, e.g. `PRECO`, `true`); the labels
// the client reads come from `formatSnapshotValue` at render time, so a diff
// stored today still reads right if a label is reworded tomorrow.

import type { ManualFormDraft } from '../../../cotacao/nova-cotacao/components/manual-form';

export type SnapshotValue = string | string[];
export type FormSnapshot = Record<string, SnapshotValue>;

/**
 * The fields the snapshot keeps, in FORM order — the diff lists changes in the
 * order the client meets the fields on screen, not alphabetically.
 */
export const SNAPSHOT_FIELDS = [
  'supplier',
  'tipo_cotacao',
  'service_type',
  'modal',
  'tipo_embarque',
  'incoterm',
  'price_or_performance',
  'origin',
  'agente_define_local_coleta',
  'porto_embarque',
  'aeroporto_embarque',
  'porto_destino',
  'agente_define_porto_destino',
  'aeroporto_destino',
  'agente_define_aeroporto_destino',
  'endereco_entrega_final',
  'product',
  'ncm',
  'carga_perigosa',
  'un_number',
  'imo_class',
  'stackability',
  'carga_tombavel',
  'carga_refrigerada',
  'temperatura_min',
  'temperatura_max',
  'cargo',
  'declared_value_currency',
  'declared_value',
  'insurance_required',
  'data_prontidao',
  'data_limite_necessidade',
  'desired_deadline',
  'client_reference',
  'observations',
] as const;

export type SnapshotField = (typeof SNAPSHOT_FIELDS)[number];

export const SNAPSHOT_FIELD_LABELS: Record<SnapshotField, string> = {
  supplier: 'Exportador',
  tipo_cotacao: 'Tipo de cotação',
  service_type: 'Tipo de serviço',
  modal: 'Modal',
  tipo_embarque: 'Tipo de embarque',
  incoterm: 'Incoterm',
  price_or_performance: 'Fator de escolha',
  origin: 'Local de coleta',
  agente_define_local_coleta: 'Coleta a critério dos agentes',
  porto_embarque: 'Local de embarque',
  aeroporto_embarque: 'Aeroporto de embarque',
  porto_destino: 'Local de desembarque',
  agente_define_porto_destino: 'Desembarque a critério dos agentes',
  aeroporto_destino: 'Aeroporto de desembarque',
  agente_define_aeroporto_destino: 'Desembarque a critério dos agentes',
  endereco_entrega_final: 'Endereço de entrega final',
  product: 'Produto',
  ncm: 'NCM',
  carga_perigosa: 'Carga perigosa',
  un_number: 'UN',
  imo_class: 'Classe IMO',
  stackability: 'Empilhável',
  carga_tombavel: 'Tombável',
  carga_refrigerada: 'Carga refrigerada',
  temperatura_min: 'Temperatura mínima',
  temperatura_max: 'Temperatura máxima',
  cargo: 'Equipamentos e volumes',
  declared_value_currency: 'Moeda do valor da carga',
  declared_value: 'Valor da carga',
  insurance_required: 'Seguro obrigatório',
  data_prontidao: 'Prontidão da carga',
  data_limite_necessidade: 'Chegada necessária',
  desired_deadline: 'Prazo de resposta',
  client_reference: 'Referência do cliente',
  observations: 'Observações',
};

const CODE_LABELS: Partial<Record<SnapshotField, Record<string, string>>> = {
  tipo_cotacao: { REAL: 'Real', ESTIMATIVA: 'Estimativa' },
  service_type: { IMPORTACAO: 'Importação', EXPORTACAO: 'Exportação' },
  modal: { MARITIMO: 'Marítimo', AEREO: 'Aéreo', RODOVIARIO: 'Rodoviário' },
  tipo_embarque: { FCL: 'FCL', LCL: 'LCL', BREAK_BULK: 'Break Bulk' },
  price_or_performance: { PRECO: 'Preço', PERFORMANCE: 'Performance' },
  carga_perigosa: {
    NAO: 'Não',
    SIM: 'Sim (classificação a informar)',
    IMO: 'Sim · IMO',
    RA: 'Sim · RA (radioativa)',
  },
};

const YES_NO_FIELDS: SnapshotField[] = [
  'agente_define_local_coleta',
  'agente_define_porto_destino',
  'agente_define_aeroporto_destino',
  'stackability',
  'carga_tombavel',
  'carga_refrigerada',
  'insurance_required',
];

/** How the client reads one value. Empty reads "não informado", never blank. */
export function formatSnapshotValue(
  field: SnapshotField,
  value: SnapshotValue | undefined,
): string {
  const list = Array.isArray(value) ? value.filter(Boolean) : null;
  const raw = list
    ? list.join(' · ')
    : ((value as string | undefined) ?? '').trim();
  if (!raw) return 'não informado';
  if (YES_NO_FIELDS.includes(field)) {
    if (raw === 'true') return 'Sim';
    if (raw === 'false') return 'Não';
  }
  if (field === 'desired_deadline' && raw.includes('T')) {
    return raw.replace('T', ' ');
  }
  return CODE_LABELS[field]?.[raw] ?? raw;
}

function text(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value).trim();
}

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  const single = text(value);
  return single ? [single] : [];
}

function yesNo(value: unknown): string {
  return value === true ? 'true' : value === false ? 'false' : '';
}

interface CargoLine {
  quantity?: number | null;
  peso_bruto?: number | null;
  peso_unidade?: string | null;
  volume_m3?: number | null;
}

/**
 * One line that changes whenever the cargo changes: count, weight and volume.
 * Enough for "Equipamentos e volumes: 1 item · 12000 kg → 2 itens · 24000 kg";
 * the line-by-line table stays where it is, in the form.
 */
function cargoSummary(equipments: CargoLine[], volumes: CargoLine[]): string {
  const lines = [...equipments, ...volumes];
  if (lines.length === 0) return '';
  const count = lines.reduce((sum, line) => sum + (line.quantity || 1), 0);
  const weight = lines.reduce(
    (sum, line) =>
      sum +
      (line.peso_bruto || 0) * (line.peso_unidade === 'LB' ? 0.45359237 : 1),
    0,
  );
  const volume = lines.reduce((sum, line) => sum + (line.volume_m3 || 0), 0);
  const parts = [`${count} ${count === 1 ? 'item' : 'itens'}`];
  if (weight > 0) parts.push(`${Math.round(weight * 100) / 100} kg`);
  if (volume > 0) parts.push(`${Math.round(volume * 1000) / 1000} m³`);
  return parts.join(' · ');
}

/**
 * The dangerous-goods answer, in one code.
 *
 * `SIM` is the state the form's `carga_perigosa` enum cannot hold: the client
 * said "Sim" but has not classified the cargo yet. It is kept apart from ''
 * (unanswered) because they block for different reasons.
 */
function dangerousAnswer(value: unknown, declared: boolean): string {
  const code = text(value);
  if (code === 'NAO' || code === 'RA' || code === 'IMO') return code;
  return declared ? 'SIM' : '';
}

/** The snapshot of a form draft (Nova cotação and the correction screen). */
export function snapshotFromDraft(
  draft: Pick<ManualFormDraft, 'values' | 'equipments' | 'volumes' | 'flags'>,
  supplier?: string | null,
): FormSnapshot {
  const v = draft.values ?? {};
  const f = draft.flags ?? {};
  const refrigerated = !!f.showRefrigerada;
  return {
    supplier: text(supplier),
    tipo_cotacao: text(v.tipo_cotacao),
    service_type: text(v.service_type),
    modal: text(v.modal),
    tipo_embarque: text(v.tipo_embarque),
    incoterm: text(v.incoterm).toUpperCase(),
    price_or_performance: text(v.price_or_performance),
    origin: f.agenteDefineLocalColeta ? '' : text(v.origin),
    agente_define_local_coleta: yesNo(!!f.agenteDefineLocalColeta),
    porto_embarque: text(v.porto_embarque),
    aeroporto_embarque: text(v.aeroporto_embarque),
    porto_destino: list(v.porto_destino),
    agente_define_porto_destino: yesNo(!!f.agenteDefinePortoDestino),
    aeroporto_destino: list(v.aeroporto_destino),
    agente_define_aeroporto_destino: yesNo(!!f.agenteDefineAeroportoDestino),
    endereco_entrega_final: text(v.endereco_entrega_final),
    product: text(v.product),
    ncm: text(v.ncm),
    carga_perigosa: dangerousAnswer(
      v.carga_perigosa,
      !!f.cargaPerigosaDeclarada,
    ),
    un_number: text(v.un_number),
    imo_class: text(v.imo_class),
    stackability: text(v.stackability),
    carga_tombavel: text(v.carga_tombavel),
    carga_refrigerada: yesNo(refrigerated),
    temperatura_min: refrigerated ? text(v.temperatura_min) : '',
    temperatura_max: refrigerated ? text(v.temperatura_max) : '',
    cargo: cargoSummary(draft.equipments ?? [], draft.volumes ?? []),
    declared_value_currency: text(v.declared_value_currency),
    declared_value: text(v.declared_value),
    insurance_required: text(v.insurance_required),
    data_prontidao: text(v.data_prontidao),
    data_limite_necessidade: text(v.data_limite_necessidade),
    desired_deadline: text(v.desired_deadline),
    client_reference: text(v.client_reference),
    observations: text(v.observations),
  };
}

/** The minimum this module reads from the portal quotation payload. */
export interface SnapshotQuotation {
  exporter_name?: string | null;
  tipo_cotacao?: string | null;
  service_type?: string | null;
  modal?: string | null;
  tipo_embarque?: string | null;
  incoterm?: string | null;
  origin?: string | null;
  porto_embarque?: string | null;
  aeroporto_embarque?: string | null;
  porto_destino?: string[] | null;
  aeroporto_destino?: string[] | null;
  endereco_entrega_final?: string | null;
  product?: string | null;
  carga_perigosa?: string | null;
  un_number?: string | null;
  imo_class?: string | null;
  stackability?: boolean | null;
  carga_tombavel?: boolean | null;
  temperatura_min?: number | null;
  temperatura_max?: number | null;
  declared_value?: number | null;
  declared_value_currency?: string | null;
  insurance_required?: boolean | null;
  data_prontidao?: string | null;
  data_limite_necessidade?: string | null;
  desired_deadline?: string | null;
  client_reference?: string | null;
  observations?: string | null;
  equipments?: CargoLine[] | null;
  volumes?: CargoLine[] | null;
}

/**
 * The snapshot of a quotation that has none stored — one opened before this
 * version, or by upload. What the payload does not carry stays EMPTY: filling
 * `price_or_performance` with a guess would let a quotation through a hardblock
 * nobody answered.
 */
export function snapshotFromQuotation(q: SnapshotQuotation): FormSnapshot {
  const refrigerated = q.temperatura_min != null || q.temperatura_max != null;
  return {
    supplier: text(q.exporter_name),
    tipo_cotacao: text(q.tipo_cotacao),
    service_type: text(q.service_type),
    modal: text(q.modal),
    tipo_embarque: text(q.tipo_embarque),
    incoterm: text(q.incoterm).toUpperCase(),
    price_or_performance: '',
    origin: text(q.origin),
    agente_define_local_coleta: '',
    porto_embarque: text(q.porto_embarque),
    aeroporto_embarque: text(q.aeroporto_embarque),
    porto_destino: list(q.porto_destino),
    agente_define_porto_destino: '',
    aeroporto_destino: list(q.aeroporto_destino),
    agente_define_aeroporto_destino: '',
    endereco_entrega_final: text(q.endereco_entrega_final),
    product: text(q.product),
    ncm: '',
    carga_perigosa: dangerousAnswer(q.carga_perigosa, false),
    un_number: text(q.un_number),
    imo_class: text(q.imo_class),
    stackability: yesNo(q.stackability),
    carga_tombavel: yesNo(q.carga_tombavel),
    carga_refrigerada: yesNo(refrigerated),
    temperatura_min: text(q.temperatura_min),
    temperatura_max: text(q.temperatura_max),
    cargo: cargoSummary(q.equipments ?? [], q.volumes ?? []),
    declared_value_currency: text(q.declared_value_currency),
    declared_value: text(q.declared_value),
    insurance_required: yesNo(q.insurance_required),
    data_prontidao: text(q.data_prontidao),
    data_limite_necessidade: text(q.data_limite_necessidade),
    desired_deadline: text(q.desired_deadline),
    client_reference: text(q.client_reference),
    observations: text(q.observations),
  };
}

export interface FieldChange {
  field: SnapshotField;
  /** Raw values, as stored. Render with `formatSnapshotValue`. */
  from: SnapshotValue;
  to: SnapshotValue;
}

function same(a: SnapshotValue | undefined, b: SnapshotValue | undefined) {
  const left = Array.isArray(a) ? a.join('\u0000') : (a ?? '');
  const right = Array.isArray(b) ? b.join('\u0000') : (b ?? '');
  return left === right;
}

/**
 * What changed between two submissions, in form order.
 *
 * The "agentes decidam" switches are left out when the field they govern
 * already changed: "Local de desembarque: Santos → não informado" plus
 * "Desembarque a critério dos agentes: Não → Sim" is one decision said twice.
 */
export function diffSnapshots(
  previous: FormSnapshot,
  next: FormSnapshot,
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of SNAPSHOT_FIELDS) {
    if (same(previous[field], next[field])) continue;
    changes.push({
      field,
      from: previous[field] ?? '',
      to: next[field] ?? '',
    });
  }
  const governs: Partial<Record<SnapshotField, SnapshotField>> = {
    agente_define_local_coleta: 'origin',
    agente_define_porto_destino: 'porto_destino',
    agente_define_aeroporto_destino: 'aeroporto_destino',
  };
  const changed = new Set(changes.map((change) => change.field));
  return changes.filter((change) => {
    const governed = governs[change.field];
    return !(governed && changed.has(governed));
  });
}

/** Coerces a stored snapshot; unknown keys and non-string values are dropped. */
export function normalizeSnapshot(raw: unknown): FormSnapshot | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  const out: FormSnapshot = {};
  for (const field of SNAPSHOT_FIELDS) {
    const value = source[field];
    if (typeof value === 'string') out[field] = value;
    else if (Array.isArray(value)) {
      out[field] = value.filter(
        (item): item is string => typeof item === 'string',
      );
    }
  }
  return out;
}

/** Coerces a stored change list; entries for unknown fields are dropped. */
export function normalizeChanges(raw: unknown): FieldChange[] {
  if (!Array.isArray(raw)) return [];
  const valid = (value: unknown): value is SnapshotValue =>
    typeof value === 'string' ||
    (Array.isArray(value) && value.every((item) => typeof item === 'string'));
  return raw.filter(
    (item): item is FieldChange =>
      item != null &&
      typeof item === 'object' &&
      (SNAPSHOT_FIELDS as readonly string[]).includes(
        (item as FieldChange).field,
      ) &&
      valid((item as FieldChange).from) &&
      valid((item as FieldChange).to),
  );
}

/**
 * The form values and switches a snapshot restores, for the fields the payload
 * cannot give back. Only NON-EMPTY snapshot values are returned: the caller
 * merges them over what it already has, and an empty value here would erase a
 * field the payload did carry.
 */
export function draftPatchFromSnapshot(snapshot: FormSnapshot): {
  values: Record<string, string | string[]>;
  flags: NonNullable<ManualFormDraft['flags']>;
} {
  const values: Record<string, string | string[]> = {};
  const restorable: SnapshotField[] = [
    'price_or_performance',
    'ncm',
    'tipo_cotacao',
    'service_type',
    'stackability',
    'carga_tombavel',
    'endereco_entrega_final',
  ];
  for (const field of restorable) {
    const value = snapshot[field];
    if (typeof value === 'string' && value) values[field] = value;
  }
  const dangerous = snapshot.carga_perigosa;
  if (dangerous === 'NAO' || dangerous === 'RA' || dangerous === 'IMO') {
    values.carga_perigosa = dangerous;
  }
  return {
    values,
    flags: {
      ...(snapshot.agente_define_local_coleta === 'true'
        ? { agenteDefineLocalColeta: true }
        : {}),
      ...(snapshot.agente_define_porto_destino === 'true'
        ? { agenteDefinePortoDestino: true }
        : {}),
      ...(snapshot.agente_define_aeroporto_destino === 'true'
        ? { agenteDefineAeroportoDestino: true }
        : {}),
      ...(snapshot.carga_refrigerada === 'true'
        ? { showRefrigerada: true }
        : {}),
      ...(dangerous === 'SIM' ? { cargaPerigosaDeclarada: true } : {}),
    },
  };
}

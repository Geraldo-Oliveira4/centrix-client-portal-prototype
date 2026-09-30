// Novo embarque a partir do PO — the review state machine, simulated.
//
// PURE, and free of the `@/` alias: it runs under `npm run test:unit`. Same
// arrangement as `quotation-review.ts`, whose patterns this module copies
// deliberately rather than inventing new ones.
//
// WHAT THE BACKEND WOULD NEED, and does not have. None of this exists in the
// prototype's schema, and all of it is a migration in the real version:
//
//   - The PO as a SELECTABLE RECORD (RQ-10). Today the PO is typed inside the
//     quotation's `client_reference`; a shipment has no PO column at all.
//   - The REVIEW STATES ("aguardando revisão", "devolvido") on the shipment.
//     `EmbarqueEstado` is a closed union of seven operational states and none
//     of them means "the Freitas has not looked at this yet".
//   - The SKUs, which exist nowhere in the schema.
//   - DEDUP over the PO, which needs the PO to be a record first (RQ-5).
//
// So everything below lives in `localStorage` under `centrix-proto-v2:`, and
// the screens read it. It is a stage prop, never a data model.
//
// NO GUARD RAIL COUNTER. The spec floats "the first 5 shipments" (RQ-3, Open
// Question 2) without saying whether the count is per client or global, or who
// lifts it. Modelling a number nobody agreed would put a made-up rule in front
// of the people reviewing the prototype, so EVERY shipment opened by PO goes
// through the review, always.

/** Storage name under `DEMO_STORE_PREFIX`. */
export const SHIPMENT_PO_STORE_NAME = 'shipment-po-review';

/**
 * Where the shipment came from. `manual` is the same journey without the file
 * (Tela 6) — the review is identical, only the reading step is skipped.
 */
export type PoOrigin = 'po' | 'manual' | 'cotacao';

export type PoStage = 'draft' | 'awaiting_review' | 'returned' | 'active';

export type PoEventKind =
  | 'created'
  | 'saved'
  | 'submitted'
  | 'returned'
  | 'resubmitted'
  | 'validated'
  | 'cancelled'
  | 'quotation_linked';

export interface PoEvent {
  kind: PoEventKind;
  /** ISO. Injected by the caller — this module never reads the clock. */
  at: string;
  reason?: string;
  fields?: string[];
  quotationId?: string;
}

/** One line of the PO. "SKU" and "part number" are the same column (RQ-10). */
export interface PoItem {
  id: string;
  partNumber: string;
  description: string;
  currency: string;
  quantity: number | null;
  unitValue: number | null;
  netWeightKg: number | null;
  totalValue: number | null;
  grossWeightKg: number | null;
}

/** The form's fields. Everything optional: a draft is allowed to be empty. */
export interface PoShipmentData {
  /**
   * O agente de carga, quando o embarque nasceu de uma proposta aprovada.
   *
   * Vazio na jornada por PO: ali ninguém escolheu agente ainda — é justamente
   * o que a cotação faz e o PO não faz.
   */
  agentName: string;
  /** A shipment may carry more than one PO (RQ-10); the v1 UI collects one. */
  poNumbers: string[];
  clientRef: string;
  items: PoItem[];
  exporter: string;
  incoterm: string;
  /** "Estilo do processo" in the form. */
  despacho: 'DIRETO' | 'CONSOLIDADO' | '';
  modal: 'MARITIMO' | 'AEREO' | 'RODOVIARIO' | '';
  /** Only meaningful when `modal === 'MARITIMO'`. */
  tipoEmbarque: 'FCL' | 'LCL' | '';
  urgent: boolean;
  observation: string;
  innovaNumber: string;
}

/** Field name -> reading confidence, 0..1. Absent means "not read". */
export type PoConfidence = Record<string, number>;

export interface ShipmentPoReview {
  /** `EMB-2026-xxxx`. See `nextPoReference`. */
  reference: string;
  origin: PoOrigin;
  stage: PoStage;
  data: PoShipmentData;
  /** File name of the attachment, when there is one. */
  attachmentName: string | null;
  confidence: PoConfidence;
  linkedQuotationId?: string;
  returnReason?: string;
  /** Which fields the Freitas asked the client to fix. */
  fieldsToFix: string[];
  /**
   * Chegada prevista, ISO, quando ELA EXISTE.
   *
   * Um embarque aberto por PO não tem rastreamento (não há companhia marítima
   * reportando nada ainda), então esta é a única data que a "Visão por PO"
   * (RQ-12) pode desenhar. Ela é informada, nunca derivada: ausente é ausente,
   * e a régua simplesmente não põe a carga nela.
   */
  plannedEta?: string;
  /** ISO. The clock the automatic reply counts from. */
  stageEnteredAt: string;
  history: PoEvent[];
}

/** id -> overlay. A shipment with no entry is an ordinary backend shipment. */
export type ShipmentPoStore = Record<string, ShipmentPoReview>;

/**
 * Where the prototype's PO references start.
 *
 * The seed owns EMB-2026-0001..0013 and the tracking top-ups add a few more in
 * the same run; starting at 0101 leaves that whole range alone, so a PO
 * shipment can never be mistaken for a seeded one and nothing has to be
 * renumbered. Three digits of headroom is more shipments than any
 * demonstration will ever open.
 */
export const PO_REFERENCE_BASE = 101;

/** Below this, the reading is shown in amber and asks to be checked. */
export const PO_CONFIDENCE_THRESHOLD = 0.8;

/** The stages waiting on the CLIENT. */
export const PO_CLIENT_ACTION_STAGES: PoStage[] = ['draft', 'returned'];

/** The only stage the automatic reply advances. Returning is never automatic. */
export const PO_AUTO_ADVANCE_STAGES: PoStage[] = ['awaiting_review'];

export const PO_STAGE_LABELS: Record<PoStage, string> = {
  draft: 'Rascunho',
  awaiting_review: 'Em análise',
  returned: 'Devolvido',
  active: 'Ativo',
};

export const PO_STAGE_DESCRIPTIONS: Record<PoStage, string> = {
  draft: 'Rascunho · ainda não enviado à Freitas',
  awaiting_review: 'Aguardando revisão da Freitas',
  returned: 'A Freitas pediu um ajuste antes de ativar o embarque',
  active: 'Embarque ativo. Origem e datas são preenchidas no acompanhamento.',
};

/** The form fields the Freitas can point at when returning. */
export const PO_FIXABLE_FIELDS = [
  'poNumbers',
  'clientRef',
  'items',
  'exporter',
  'incoterm',
  'despacho',
  'modal',
  'tipoEmbarque',
  'observation',
] as const;

export type PoFixableField = (typeof PO_FIXABLE_FIELDS)[number];

export const PO_FIELD_LABELS: Record<string, string> = {
  poNumbers: 'Nº do PO',
  clientRef: 'REF do cliente',
  items: 'Itens do PO',
  exporter: 'Exportador',
  incoterm: 'Incoterm',
  despacho: 'Estilo do processo',
  modal: 'Modal',
  tipoEmbarque: 'Tipo de carga',
  observation: 'Observação',
  partNumber: 'SKU / Part number',
  description: 'Descrição',
  currency: 'Moeda',
  quantity: 'Quantidade',
  unitValue: 'Valor unitário',
  netWeightKg: 'Peso líquido',
  totalValue: 'Valor total',
  grossWeightKg: 'Peso bruto',
};

export const EMPTY_PO_DATA: PoShipmentData = {
  agentName: '',
  poNumbers: [],
  clientRef: '',
  items: [],
  exporter: '',
  incoterm: '',
  despacho: '',
  modal: '',
  tipoEmbarque: '',
  urgent: false,
  observation: '',
  innovaNumber: '',
};

/**
 * The next free reference, from the ones already taken.
 *
 * Reads BOTH the overlay and the backend's shipments so a PO reference can
 * never collide with one the seed or a top-up produced — even though the base
 * is chosen to be out of their way.
 */
export function nextPoReference(
  store: ShipmentPoStore,
  existingReferences: string[] = [],
): string {
  const used = new Set<number>();
  const collect = (reference: string) => {
    const match = /^EMB-2026-(\d{4})$/.exec(reference);
    if (match) used.add(Number(match[1]));
  };
  for (const entry of Object.values(store)) collect(entry.reference);
  for (const reference of existingReferences) collect(reference);

  let next = PO_REFERENCE_BASE;
  while (used.has(next)) next += 1;
  return `EMB-2026-${String(next).padStart(4, '0')}`;
}

/** A fresh draft. `id` is the overlay key and is chosen by the caller. */
export function createDraft(
  reference: string,
  origin: PoOrigin,
  at: string,
  data: Partial<PoShipmentData> = {},
  attachmentName: string | null = null,
  confidence: PoConfidence = {},
): ShipmentPoReview {
  return {
    reference,
    origin,
    stage: 'draft',
    data: { ...EMPTY_PO_DATA, ...data },
    attachmentName,
    confidence,
    fieldsToFix: [],
    stageEnteredAt: at,
    history: [{ kind: 'created', at }],
  };
}

function advance(
  review: ShipmentPoReview,
  stage: PoStage,
  event: PoEvent,
  patch: Partial<ShipmentPoReview> = {},
): ShipmentPoReview {
  return {
    ...review,
    ...patch,
    stage,
    stageEnteredAt: event.at,
    history: [...review.history, event],
  };
}

/**
 * Saves the form without sending it.
 *
 * Does NOT move the stage and does NOT reset `stageEnteredAt`: a client fixing
 * a returned shipment saves twice before resending, and restarting the review
 * clock on a save would make the automatic reply fire off a stage the Freitas
 * has not been given yet.
 */
export function saveDraft(
  review: ShipmentPoReview,
  data: Partial<PoShipmentData>,
  at: string,
  attachmentName: string | null = review.attachmentName,
): ShipmentPoReview {
  return {
    ...review,
    data: { ...review.data, ...data },
    attachmentName,
    history: [...review.history, { kind: 'saved', at }],
  };
}

/** Client sends it. Draft or returned -> awaiting review (RQ-3). */
export function submitToFreitas(
  review: ShipmentPoReview,
  at: string,
): ShipmentPoReview {
  const resubmitting = review.stage === 'returned';
  const next = advance(review, 'awaiting_review', {
    kind: resubmitting ? 'resubmitted' : 'submitted',
    at,
  });
  // The reason described a form that no longer exists; the EVENT that carried
  // it stays in `history`, which is what "histórico preservado" means.
  const { returnReason: _dropped, ...rest } = next;
  return { ...rest, fieldsToFix: [] };
}

/** The same transition, named for the button that fires it after a return. */
export function resubmit(
  review: ShipmentPoReview,
  at: string,
): ShipmentPoReview {
  return submitToFreitas(review, at);
}

/** Freitas sends it back with a reason and the fields to fix. Always manual. */
export function returnToClient(
  review: ShipmentPoReview,
  reason: string,
  fields: string[],
  at: string,
): ShipmentPoReview {
  const trimmed = reason.trim();
  if (!trimmed) return review;
  const cleanFields = Array.from(new Set(fields.filter((f) => f)));
  return advance(
    review,
    'returned',
    { kind: 'returned', at, reason: trimmed, fields: cleanFields },
    { returnReason: trimmed, fieldsToFix: cleanFields },
  );
}

/** Freitas validates it: the shipment becomes an ordinary active one. */
export function validate(
  review: ShipmentPoReview,
  at: string,
): ShipmentPoReview {
  const next = advance(review, 'active', { kind: 'validated', at });
  const { returnReason: _r, ...rest } = next;
  return { ...rest, fieldsToFix: [] };
}

/** Client cancels while it is in review (Tela 8). Back to a draft. */
export function cancel(
  review: ShipmentPoReview,
  at: string,
): ShipmentPoReview {
  const next = advance(review, 'draft', { kind: 'cancelled', at });
  const { returnReason: _r, ...rest } = next;
  return { ...rest, fieldsToFix: [] };
}

/** Links a quotation to an already-created shipment (RQ-4, Tela 9). */
export function linkQuotation(
  review: ShipmentPoReview,
  quotationId: string,
  at: string,
): ShipmentPoReview {
  if (!quotationId) return review;
  return {
    ...review,
    linkedQuotationId: quotationId,
    history: [...review.history, { kind: 'quotation_linked', at, quotationId }],
  };
}

/**
 * Normalised PO number, for the dedup.
 *
 * Case, accents, spaces and the separators people type differently
 * ("PO 2026/1830", "po-2026-1830") all collapse to the same key. The dedup
 * exists to stop a second shipment being opened for a PO the client already
 * has, and a client who retypes the number with a slash is exactly the case it
 * has to catch.
 */
export function normalizePo(po: string): string {
  return po
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export interface DuplicateCandidate {
  id: string;
  reference: string;
  route: string;
  createdAt: string;
  stateLabel: string;
  poNumbers: string[];
}

/**
 * The first shipment that already carries this PO, or `null` (RQ-5).
 *
 * Does NOT block: the caller shows a dialog and the client confirms. The spec
 * is explicit that parciais exist, so a hard block would be wrong — but the
 * copy is assertive, because the common case is a mistake.
 */
export function findDuplicatePo(
  po: string,
  candidates: DuplicateCandidate[],
  excludeId?: string,
): DuplicateCandidate | null {
  const key = normalizePo(po);
  if (!key) return null;
  return (
    candidates.find(
      (candidate) =>
        candidate.id !== excludeId &&
        candidate.poNumbers.some((existing) => normalizePo(existing) === key),
    ) ?? null
  );
}

/** How many PO shipments are waiting for the Freitas (the "Em análise" count). */
export function countPoInReview(store: ShipmentPoStore): number {
  return Object.values(store).filter(
    (entry) => entry.stage === 'awaiting_review' || entry.stage === 'returned',
  ).length;
}

/** The ids at a given stage, for the panel's list. */
export function poIdsAtStage(
  store: ShipmentPoStore,
  stage: PoStage,
): string[] {
  return Object.entries(store)
    .filter(([, entry]) => entry.stage === stage)
    .map(([id]) => id);
}

/**
 * Whether the overlay should HIDE this shipment from the ordinary wallet.
 *
 * A draft never appears (spec: "não aparece na carteira"); everything else
 * does, with a seal.
 */
export function isPoDraft(entry: ShipmentPoReview): boolean {
  return entry.stage === 'draft';
}

/** Milliseconds until the automatic reply validates this one. */
export function msUntilPoAutoAdvance(
  review: ShipmentPoReview,
  delaySeconds: number,
  now: number,
): number | null {
  if (!PO_AUTO_ADVANCE_STAGES.includes(review.stage)) return null;
  const enteredAt = Date.parse(review.stageEnteredAt);
  const delayMs = delaySeconds * 1000;
  if (!Number.isFinite(enteredAt)) return 0;
  const elapsed = now - enteredAt;
  if (elapsed < 0) return delayMs;
  return Math.max(0, delayMs - elapsed);
}

/** Applies one automatic step. Only `awaiting_review -> active` exists. */
export function applyPoAutoAdvance(
  review: ShipmentPoReview,
  at: string,
): ShipmentPoReview {
  if (review.stage === 'awaiting_review') return validate(review, at);
  return review;
}

function normalizeItem(raw: unknown): PoItem | null {
  if (raw == null || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  if (typeof source.id !== 'string') return null;
  const num = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) ? value : null;
  const str = (value: unknown) => (typeof value === 'string' ? value : '');
  return {
    id: source.id,
    partNumber: str(source.partNumber),
    description: str(source.description),
    currency: str(source.currency),
    quantity: num(source.quantity),
    unitValue: num(source.unitValue),
    netWeightKg: num(source.netWeightKg),
    totalValue: num(source.totalValue),
    grossWeightKg: num(source.grossWeightKg),
  };
}

function normalizeData(raw: unknown): PoShipmentData {
  if (raw == null || typeof raw !== 'object') return { ...EMPTY_PO_DATA };
  const source = raw as Record<string, unknown>;
  const str = (value: unknown, fallback = '') =>
    typeof value === 'string' ? value : fallback;
  return {
    agentName: str(source.agentName),
    poNumbers: Array.isArray(source.poNumbers)
      ? source.poNumbers.filter((p): p is string => typeof p === 'string')
      : [],
    clientRef: str(source.clientRef),
    items: Array.isArray(source.items)
      ? (source.items.map(normalizeItem).filter(Boolean) as PoItem[])
      : [],
    exporter: str(source.exporter),
    incoterm: str(source.incoterm),
    despacho: str(source.despacho) as PoShipmentData['despacho'],
    modal: str(source.modal) as PoShipmentData['modal'],
    tipoEmbarque: str(source.tipoEmbarque) as PoShipmentData['tipoEmbarque'],
    urgent: source.urgent === true,
    observation: str(source.observation),
    innovaNumber: str(source.innovaNumber),
  };
}

/** Coerces one stored entry, or `null` when it is beyond repair. */
function normalizeReview(raw: unknown): ShipmentPoReview | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  const stage = source.stage;
  if (
    typeof stage !== 'string' ||
    !(Object.keys(PO_STAGE_LABELS) as string[]).includes(stage)
  ) {
    return null;
  }
  if (typeof source.reference !== 'string') return null;

  const history = Array.isArray(source.history)
    ? (source.history.filter(
        (event) =>
          event != null &&
          typeof event === 'object' &&
          typeof (event as PoEvent).kind === 'string' &&
          typeof (event as PoEvent).at === 'string',
      ) as PoEvent[])
    : [];
  const confidence: PoConfidence = {};
  if (source.confidence != null && typeof source.confidence === 'object') {
    for (const [key, value] of Object.entries(
      source.confidence as Record<string, unknown>,
    )) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        confidence[key] = value;
      }
    }
  }

  return {
    reference: source.reference,
    origin:
      source.origin === 'manual' || source.origin === 'cotacao'
        ? source.origin
        : 'po',
    stage: stage as PoStage,
    data: normalizeData(source.data),
    attachmentName:
      typeof source.attachmentName === 'string' ? source.attachmentName : null,
    confidence,
    fieldsToFix: Array.isArray(source.fieldsToFix)
      ? source.fieldsToFix.filter((f): f is string => typeof f === 'string')
      : [],
    ...(typeof source.plannedEta === 'string' && source.plannedEta
      ? { plannedEta: source.plannedEta }
      : {}),
    stageEnteredAt:
      typeof source.stageEnteredAt === 'string'
        ? source.stageEnteredAt
        : new Date(0).toISOString(),
    history,
    ...(typeof source.linkedQuotationId === 'string' && source.linkedQuotationId
      ? { linkedQuotationId: source.linkedQuotationId }
      : {}),
    ...(typeof source.returnReason === 'string' && source.returnReason
      ? { returnReason: source.returnReason }
      : {}),
  };
}

/** An entry beyond repair is DROPPED: no overlay is always a safe landing. */
export function normalizeShipmentPoStore(raw: unknown): ShipmentPoStore {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: ShipmentPoStore = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const review = normalizeReview(value);
    if (review) out[id] = review;
  }
  return out;
}

export function parseShipmentPoStore(raw: string | null): ShipmentPoStore {
  if (raw == null) return {};
  try {
    return normalizeShipmentPoStore(JSON.parse(raw));
  } catch {
    return {};
  }
}

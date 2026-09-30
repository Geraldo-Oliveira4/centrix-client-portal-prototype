// In-portal notifications for the Cotação V2 (RQ-16).
//
// PURE, no `@/` alias — it runs under `npm run test:unit`.
//
// TWO TYPES AND NO MORE: proposals released and quotation returned. The spec is
// explicit that there is neither a link nor an e-mail: the client is told
// inside the portal and decides inside the portal, so this file produces rows
// for a bell, never a message to send anywhere.
//
// DERIVED, NOT STORED. The notices are read off the overlay's own `history`,
// which means they cannot drift from the state of the card: a quotation that
// went back to the draft stops advertising proposals nobody can open. What IS
// stored is only which ones have been READ, keyed by a stable notice id.

import type {
  QuotationReview,
  QuotationReviewStore,
} from './quotation-review.ts';

/** Storage name under `DEMO_STORE_PREFIX`. */
export const QUOTATION_NOTICES_STORE_NAME = 'quotation-notices';

export type NoticeKind = 'proposals_released' | 'quotation_returned';

export interface QuotationNotice {
  /**
   * Stable across renders AND across reloads: quotation id + kind + the instant
   * the event happened. Using the array index would make "read" jump to another
   * row as soon as a newer notice arrived.
   */
  id: string;
  kind: NoticeKind;
  quotationId: string;
  /** What the client sees as the row's subject. */
  reference: string;
  title: string;
  body: string;
  /** ISO, from the overlay event. */
  at: string;
  read: boolean;
  /**
   * Para onde a linha leva. Opcional: sem ele o sino cai no detalhe da COTAÇÃO,
   * que é o destino de toda notificação deste módulo. O campo existe porque o
   * embarque via PO reusa este mesmo formato e precisa levar a outro lugar —
   * ver `shipment-po-notices.ts`.
   */
  href?: string;
}

/** Read notice ids. A set on disk, an array in JSON. */
export type NoticeReadStore = string[];

export const NOTICE_TITLES: Record<NoticeKind, string> = {
  proposals_released: 'Propostas liberadas',
  quotation_returned: 'Solicitação devolvida',
};

function noticeId(quotationId: string, kind: NoticeKind, at: string): string {
  return `${quotationId}:${kind}:${at}`;
}

function bodyFor(
  kind: NoticeKind,
  reference: string,
  count: number | undefined,
  reason: string | undefined,
): string {
  if (kind === 'proposals_released') {
    const n = count ?? 0;
    return `${reference} · ${n} ${n === 1 ? 'proposta pronta' : 'propostas prontas'} para comparar.`;
  }
  return `${reference} · ${reason || 'A Freitas pediu um ajuste antes de acionar os agentes.'}`;
}

/**
 * The notices one quotation's history produces, oldest first.
 *
 * Only the LAST event of each kind survives: a quotation returned twice has two
 * entries in `history` (which the detail timeline wants) but one row in the
 * bell (which is a to-do list, not a log). Keeping both would make the bell
 * nag about a correction the client already made.
 */
function noticesForReview(
  quotationId: string,
  reference: string,
  review: QuotationReview,
): QuotationNotice[] {
  const latest = new Map<NoticeKind, QuotationNotice>();
  for (const event of review.history) {
    const kind: NoticeKind | null =
      event.kind === 'proposals_released'
        ? 'proposals_released'
        : event.kind === 'returned'
          ? 'quotation_returned'
          : null;
    if (!kind) continue;
    latest.set(kind, {
      id: noticeId(quotationId, kind, event.at),
      kind,
      quotationId,
      reference,
      title: NOTICE_TITLES[kind],
      body: bodyFor(kind, reference, event.releasedCount, event.reason),
      at: event.at,
      read: false,
    });
  }
  return Array.from(latest.values());
}

/**
 * Every notice in the store, NEWEST FIRST.
 *
 * `references` maps quotation id -> reference. An id the caller could not name
 * is skipped rather than shown as "undefined": a notification whose subject the
 * client cannot recognise is worse than no notification.
 */
export function collectNotices(
  store: QuotationReviewStore,
  references: Record<string, string>,
  read: NoticeReadStore,
): QuotationNotice[] {
  const readSet = new Set(read);
  const rows: QuotationNotice[] = [];
  for (const [quotationId, review] of Object.entries(store)) {
    const reference = references[quotationId];
    if (!reference) continue;
    for (const notice of noticesForReview(quotationId, reference, review)) {
      rows.push({ ...notice, read: readSet.has(notice.id) });
    }
  }
  return rows.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

export function unreadCount(notices: QuotationNotice[]): number {
  return notices.filter((notice) => !notice.read).length;
}

/**
 * Marks ids as read, keeping what was already there.
 *
 * Never prunes ids whose notice is gone: a quotation reset to the draft and run
 * again produces events at NEW instants, so the id changes and the new notice
 * arrives unread on its own. Keeping the stale ids costs a few strings and
 * avoids a notice that un-reads itself.
 */
export function markNoticesRead(
  read: NoticeReadStore,
  ids: string[],
): NoticeReadStore {
  return Array.from(new Set([...read, ...ids]));
}

export function normalizeNoticeReadStore(raw: unknown): NoticeReadStore {
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === 'string');
}

export function parseNoticeReadStore(raw: string | null): NoticeReadStore {
  if (raw == null) return [];
  try {
    return normalizeNoticeReadStore(JSON.parse(raw));
  } catch {
    return [];
  }
}

/**
 * "agora", "há 12 min", "há 3 h", "há 2 d".
 *
 * Takes `now` rather than reading the clock so the row can be tested and so a
 * list rendered in one pass cannot straddle a minute boundary.
 */
export function noticeAge(at: string, now: number): string {
  const then = Date.parse(at);
  if (!Number.isFinite(then)) return '';
  const minutes = Math.floor((now - then) / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.floor(hours / 24)} d`;
}

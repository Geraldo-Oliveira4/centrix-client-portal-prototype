// Notificações do embarque via PO (RQ-15).
//
// PURE, no `@/` alias. MESMO PADRÃO do `quotation-review-notices.ts`: as linhas
// são DERIVADAS do `history` do overlay, e o que fica guardado é apenas quais
// foram lidas. Um embarque que volta ao rascunho deixa de anunciar uma
// validação que já não vale.
//
// Dois tipos, como a spec pede: "Embarque validado" e "Embarque devolvido".
// Sem link e sem e-mail — o cliente é avisado dentro do portal.

import type { QuotationNotice } from './quotation-review-notices.ts';
import type { ShipmentPoStore } from './shipment-po-review.ts';

export type ShipmentNoticeKind = 'shipment_validated' | 'shipment_returned';

export const SHIPMENT_NOTICE_TITLES: Record<ShipmentNoticeKind, string> = {
  shipment_validated: 'Embarque validado',
  shipment_returned: 'Embarque devolvido',
};

/**
 * As notificações do overlay de PO, no MESMO formato das de cotação.
 *
 * Reusa `QuotationNotice` de propósito: o sino é um só, ordena tudo pela data e
 * não deveria precisar saber de que domínio veio cada linha. `quotationId`
 * carrega o id do EMBARQUE aqui, e `href` é quem diz para onde a linha leva —
 * é o campo que separa os dois destinos sem separar os dois tipos.
 */
export function collectShipmentNotices(
  store: ShipmentPoStore,
  read: string[],
): QuotationNotice[] {
  const readSet = new Set(read);
  const rows: QuotationNotice[] = [];

  for (const [shipmentId, entry] of Object.entries(store)) {
    // Só o ÚLTIMO evento de cada tipo vira linha: o sino é uma lista de
    // pendências, não o histórico. Um embarque devolvido duas vezes tem dois
    // eventos na timeline e uma linha aqui.
    const latest = new Map<ShipmentNoticeKind, QuotationNotice>();
    for (const event of entry.history) {
      const kind: ShipmentNoticeKind | null =
        event.kind === 'validated'
          ? 'shipment_validated'
          : event.kind === 'returned'
            ? 'shipment_returned'
            : null;
      if (!kind) continue;
      const id = `${shipmentId}:${kind}:${event.at}`;
      latest.set(kind, {
        id,
        kind: kind as unknown as QuotationNotice['kind'],
        quotationId: shipmentId,
        reference: entry.reference,
        title: SHIPMENT_NOTICE_TITLES[kind],
        body:
          kind === 'shipment_validated'
            ? `${entry.reference} · a Freitas validou. O acompanhamento já está ativo.`
            : `${entry.reference} · ${event.reason || 'A Freitas pediu um ajuste antes de ativar.'}`,
        at: event.at,
        read: readSet.has(id),
        href: `/portal/embarques?destaque=${shipmentId}`,
      });
    }
    rows.push(...Array.from(latest.values()));
  }

  return rows;
}

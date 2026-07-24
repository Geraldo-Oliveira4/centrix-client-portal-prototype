'use client';

import Link from 'next/link';
import { History } from 'lucide-react';
import { LoadingState } from '@arboria-tech/arboria-ui';

import { useMyShipments } from '@/hooks/use-portal-shipments';
import type { PortalQuotation } from '@/types/portal';
import { MODAL_LABELS } from '@/types/quotation';

import { EstadoBadge } from '../../embarques/components/estado-badge';
import { IntelBlock } from './intel-block';

/**
 * REAL cards, illustrative selection. Scoped to a SINGLE quotation: it lists the
 * client's own past shipments filtered to those SIMILAR to this quotation. The
 * only similarity signal the shipment payload carries is the modal (origin,
 * route and product are not on the shipment projection), so the filter is
 * modal-based and the current quotation's own shipment is excluded. The
 * shipments are real; the "similarity" is coarse — stated in the footnote.
 */
export function EvidenceBlock({ quotation }: { quotation: PortalQuotation }) {
  const { shipments, isLoading } = useMyShipments();

  const others = shipments.filter((s) => s.quotation_id !== quotation.id);
  const sameModal = quotation.modal
    ? others.filter((s) => s.modal === quotation.modal)
    : [];
  // Prefer same-modal matches; if there are none, fall back to any other
  // shipment so the block still shows evidence, and say so in the footnote.
  const filteredByModal = sameModal.length > 0;
  const sample = (filteredByModal ? sameModal : others).slice(0, 3);
  const modalLabel = quotation.modal ? MODAL_LABELS[quotation.modal] : null;

  return (
    <IntelBlock
      icon={<History className="h-5 w-5" />}
      title="Evidência"
      question="O que ocorreu em embarques semelhantes?"
      provenance="real"
      footnote={
        filteredByModal
          ? `Embarques reais do seu histórico filtrados pelo mesmo modal (${modalLabel}). O critério de semelhança por rota/produto é ilustrativo — ainda não há matching fino neste protótipo.`
          : 'Embarques reais do seu histórico. Não há embarque no mesmo modal desta cotação ainda, então mostramos os mais recentes — o critério de semelhança é ilustrativo neste protótipo.'
      }
    >
      {isLoading ? (
        <LoadingState />
      ) : sample.length === 0 ? (
        <p className="portal-body text-portal-neutral">
          Nenhum outro embarque no histórico ainda para servir de evidência.
        </p>
      ) : (
        <ul className="space-y-2">
          {sample.map((s) => (
            <li key={s.id}>
              <Link
                href={`/portal/embarques/${s.id}`}
                className="portal-card-muted flex items-center justify-between gap-3 p-3 transition-colors hover:bg-muted/60"
              >
                <div className="min-w-0">
                  <p className="portal-body truncate font-medium text-foreground">
                    {s.referencia}
                  </p>
                  <p className="portal-small text-portal-neutral">
                    {s.modal ? MODAL_LABELS[s.modal] : '—'}
                    {s.agente_nome ? ` · ${s.agente_nome}` : ''}
                  </p>
                </div>
                <EstadoBadge estado={s.estado} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </IntelBlock>
  );
}

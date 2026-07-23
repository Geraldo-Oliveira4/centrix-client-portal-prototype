'use client';

import Link from 'next/link';
import { History } from 'lucide-react';
import { LoadingState } from '@arboria-tech/arboria-ui';

import { useMyShipments } from '@/hooks/use-portal-shipments';
import { MODAL_LABELS } from '@/types/quotation';

import { EstadoBadge } from '../../embarques/components/estado-badge';
import { IntelBlock } from './intel-block';

/**
 * REAL cards, illustrative selection. The shipments listed are genuine rows
 * from the client's own history; only the "similar route" framing is a
 * heuristic — there is no route-matching in this prototype yet, so the block is
 * marked real (the data is real) with an explicit caveat in the footnote.
 */
export function EvidenceBlock() {
  const { shipments, isLoading } = useMyShipments();
  const sample = shipments.slice(0, 3);

  return (
    <IntelBlock
      icon={<History className="h-5 w-5" />}
      title="Evidência"
      question="O que ocorreu em embarques semelhantes?"
      provenance="real"
      footnote="Os embarques listados são reais (do seu histórico). O critério de semelhança de rota é ilustrativo — ainda não há matching por rota neste protótipo."
    >
      {isLoading ? (
        <LoadingState />
      ) : sample.length === 0 ? (
        <p className="portal-body text-portal-neutral">
          Nenhum embarque no histórico ainda para servir de evidência.
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

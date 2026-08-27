'use client';

import Link from 'next/link';
import { LoadingState } from '@arboria-tech/arboria-ui';

import { useMyShipments } from '@/hooks/use-portal-shipments';
import type { PortalProposal, PortalQuotation } from '@/types/portal';
import { MODAL_LABELS } from '@/types/quotation';

import { EstadoBadge } from '../../embarques/components/estado-badge';
import { summarizeEvidence, type EvidenceScope } from '../lib/evidence-summary';

/**
 * Qual proposta representa "a opção que o cliente está olhando": a vencedora se
 * a cotação fechou, senão a recomendada, senão a mais barata. Mesmo critério do
 * MarketBlock — as duas leituras têm de falar da mesma proposta.
 */
function referenceAgentName(proposals: PortalProposal[]): string | null {
  if (!proposals.length) return null;
  const ref =
    proposals.find((p) => p.is_winner) ??
    proposals.find((p) => p.is_recommended) ??
    [...proposals]
      .filter((p) => (p.total_brl ?? 0) > 0)
      .sort((a, b) => a.total_brl - b.total_brl)[0];
  return ref?.agent?.name ?? null;
}

export function evidenceFootnote(
  scope: EvidenceScope,
  modalLabel: string | null,
): string {
  if (scope === 'agent_modal') {
    return `Embarques reais do seu histórico com o mesmo agente e o mesmo modal (${modalLabel}). "Ocorrência em aberto" é a situação de hoje — não há histórico de transições de embarque neste protótipo, então o que ocorreu no meio do caminho não é afirmado.`;
  }
  if (scope === 'modal') {
    return `Embarques reais do seu histórico filtrados pelo mesmo modal (${modalLabel}); ainda não há embarque com o agente desta proposta. "Ocorrência em aberto" é a situação de hoje — não há histórico de transições de embarque neste protótipo.`;
  }
  return 'Embarques reais do seu histórico. Não há embarque no mesmo modal desta cotação ainda, então mostramos os mais recentes. "Ocorrência em aberto" é a situação de hoje — não há histórico de transições de embarque neste protótipo.';
}

/**
 * REAL. Escopado a UMA cotação: lê os embarques do próprio cliente parecidos com
 * ela e ENCERRA com uma conclusão — antes o bloco parava na lista crua e o
 * leitor tinha de tirar a conclusão sozinho.
 *
 * A conclusão sai só de `estado`, que é coluna real do GE. Pontualidade ficou de
 * fora de propósito: ela viria de `tracking_*`, hoje NULL ou marcado `is_mock` —
 * ver o cabeçalho de `lib/evidence-summary.ts`. É o que mantém esta metade do
 * card composto com o selo "Dado real" sem ressalva.
 *
 * Hook, não componente, porque o card que a hospeda (`AgentTrustBlock`) precisa
 * do `scope` para redigir o rodapé. Devolvê-lo por callback durante o render
 * seria efeito colateral no meio da renderização; assim o card lê o mesmo
 * resultado que o corpo desenha. `useMyShipments` é SWR e deduplica, então
 * chamá-lo aqui não é fetch a mais.
 */
export function useEvidence(quotation: PortalQuotation) {
  const { shipments, isLoading } = useMyShipments();

  const modalLabel = quotation.modal ? MODAL_LABELS[quotation.modal] : null;
  const agentName = referenceAgentName(quotation.proposals ?? []);
  const summary = summarizeEvidence({
    shipments,
    excludeQuotationId: quotation.id,
    modal: quotation.modal,
    agentName,
    modalLabel,
  });

  return { ...summary, isLoading, modalLabel };
}

/** Presentacional puro sobre o resultado de `useEvidence`. */
export function EvidenceBody({
  isLoading,
  matches,
  headline,
}: Pick<ReturnType<typeof useEvidence>, 'isLoading' | 'matches' | 'headline'>) {
  if (isLoading) return <LoadingState />;

  if (matches.length === 0) {
    return (
      <p className="portal-body text-portal-neutral">
        Nenhum outro embarque no histórico ainda para servir de evidência.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* A conclusão vem ANTES da lista: é ela que o cliente lê, e a lista
          abaixo existe para ele conferir a conta. */}
      {headline ? (
        <p className="portal-body text-foreground">{headline}</p>
      ) : null}
      <ul className="space-y-2">
        {matches.map((s) => (
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
    </div>
  );
}

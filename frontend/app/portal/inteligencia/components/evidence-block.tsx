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

/**
 * Rodapé da lista: QUAL recorte foi usado e o que o badge de estado quer dizer.
 *
 * A ressalva de proveniência saiu em 28/08/2026 junto com os selos (ver
 * `lib/proposal-provenance.ts`). O que ficou não fala de autenticidade: fala do
 * recorte da amostra e de como ler "ocorrência em aberto", que é a situação de
 * HOJE de cada embarque — e é o que liga a frase de conclusão aos badges
 * Postergado / Booking divergente da lista.
 */
const OCCURRENCE_NOTE =
  '"Ocorrência em aberto" é a situação de hoje de cada embarque: contam como ocorrência os estados Postergado e Booking divergente.';

export function evidenceFootnote(
  scope: EvidenceScope,
  modalLabel: string | null,
): string {
  if (scope === 'agent_modal') {
    return `Embarques do seu histórico com o mesmo agente e o mesmo modal (${modalLabel}). ${OCCURRENCE_NOTE}`;
  }
  if (scope === 'modal') {
    return `Embarques do seu histórico filtrados pelo mesmo modal (${modalLabel}); ainda não há embarque com o agente desta proposta. ${OCCURRENCE_NOTE}`;
  }
  return `Embarques do seu histórico. Não há embarque no mesmo modal desta cotação ainda, então mostramos os mais recentes. ${OCCURRENCE_NOTE}`;
}

/**
 * REAL. Escopado a UMA cotação: lê os embarques do próprio cliente parecidos com
 * ela e ENCERRA com uma conclusão — antes o bloco parava na lista crua e o
 * leitor tinha de tirar a conclusão sozinho.
 *
 * A conclusão sai só de `estado`, que é coluna real do GE. Pontualidade ficou de
 * fora de propósito: ela viria de `tracking_*`, hoje NULL ou marcado `is_mock` —
 * ver o cabeçalho de `lib/evidence-summary.ts`. Os selos saíram deste card em
 * 28/08/2026, a disciplina da conclusão não: a frase continua só afirmando o
 * que a lista logo abaixo dela deixa conferir.
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
                <p className="portal-body text-portal-neutral">
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

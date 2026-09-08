'use client';

import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { LoadingState } from '@arboria-tech/arboria-ui';

import { useMyQuotations, useMyRecommendation } from '@/hooks/use-portal-quotations';
import { formatBRL, formatRoute } from '@/lib/portal-formatters';

import { IntelBlock } from './intel-block';
import { pickDecisionCandidate } from '../lib/intel-helpers';

/**
 * REAL. Reuses the existing "Recomendação por IA" (deterministic score) already
 * computed for the client's quotations — this block only summarises the newest
 * one and links out to the full panel on the quotation detail.
 */
export function DecisionBlock() {
  const { data, isLoading } = useMyQuotations();
  const candidate = pickDecisionCandidate(data);
  const { recommendation } = useMyRecommendation(candidate?.id ?? null);

  return (
    <IntelBlock
      icon={<Sparkles className="h-6 w-6" />}
      title="Decisão"
      question="Estou tomando a melhor decisão para minha carga?"
      provenance="real"
      footnote="Reaproveita a Recomendação por IA já calculada para suas cotações (score determinístico)."
    >
      {isLoading ? (
        <LoadingState />
      ) : !candidate ? (
        <p className="portal-body text-portal-neutral">
          Nenhuma cotação com propostas ainda. A recomendação aparece assim que a
          Freitas registra as primeiras propostas.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
            <p className="portal-body font-medium text-foreground">
              {candidate.reference}
            </p>
            <span className="portal-small text-portal-neutral">
              {formatRoute(candidate)}
            </span>
          </div>

          {candidate.best_proposal ? (
            <div className="portal-card-muted flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="portal-small text-portal-neutral">
                  Proposta recomendada
                </p>
                <p className="portal-body truncate font-medium text-foreground">
                  {candidate.best_proposal.agent?.name ?? 'Agente'}
                </p>
              </div>
              <p className="portal-body whitespace-nowrap font-medium text-foreground">
                {formatBRL(candidate.best_proposal.total_brl)}
              </p>
            </div>
          ) : null}

          {recommendation?.recommendation_text ? (
            <p className="portal-small line-clamp-3 text-portal-neutral">
              {recommendation.recommendation_text}
            </p>
          ) : null}

          <Link
            href={`/portal/cotacao/${candidate.id}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-indigo hover:underline"
          >
            Ver recomendação completa
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </IntelBlock>
  );
}

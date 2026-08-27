'use client';

import { useMemo } from 'react';

import { useMyRecommendation } from '@/hooks/use-portal-quotations';
import { RecommendationView } from '@/components/recommendation-view';
import type { PortalProposal } from '@/types/portal';

import { computeRecommendationGap } from '../../lib/recommendation-gap';

interface RecommendationPanelProps {
  quotationId: string;
  /**
   * As mesmas propostas que a tabela comparativa imprime. Entram aqui para a
   * frase citar a diferenca REAL contra a segunda colocada — nao ha fonte nova
   * nem fetch a mais, e o numero da frase e conferivel na tabela logo acima.
   */
  proposals: PortalProposal[];
}

/** Read-only AI recommendation for the client portal (no override action). */
export function RecommendationPanel({
  quotationId,
  proposals,
}: RecommendationPanelProps) {
  const { recommendation, isLoading } = useMyRecommendation(quotationId);

  const gap = useMemo(
    () =>
      recommendation
        ? computeRecommendationGap({
            recommendedProposalId: recommendation.recommended_proposal_id,
            scores: recommendation.scores,
            proposals,
          })
        : null,
    [recommendation, proposals],
  );

  // variant="portal" swaps the shell, the header and the body for the portal
  // design system; the analyst and public-proposal surfaces keep the default.
  return (
    <RecommendationView
      recommendation={recommendation}
      isLoading={isLoading}
      variant="portal"
      gap={gap}
    />
  );
}

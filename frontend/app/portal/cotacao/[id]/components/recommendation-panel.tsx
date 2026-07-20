'use client';

import { useMyRecommendation } from '@/hooks/use-portal-quotations';
import { RecommendationView } from '@/components/recommendation-view';

interface RecommendationPanelProps {
  quotationId: string;
}

/** Read-only AI recommendation for the client portal (no override action). */
export function RecommendationPanel({ quotationId }: RecommendationPanelProps) {
  const { recommendation, isLoading } = useMyRecommendation(quotationId);
  return <RecommendationView recommendation={recommendation} isLoading={isLoading} />;
}

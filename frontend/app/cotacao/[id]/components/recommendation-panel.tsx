'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { useRecommendation } from '@/hooks/use-proposals';
import { RecommendationView } from '@/components/recommendation-view';
import { RecommendationOverrideDialog } from './recommendation-override-dialog';

interface RecommendationPanelProps {
  quotationId: string;
}

export function RecommendationPanel({ quotationId }: RecommendationPanelProps) {
  const { recommendation, isLoading } = useRecommendation(quotationId);
  const [overrideOpen, setOverrideOpen] = useState(false);

  return (
    <>
      <RecommendationView
        recommendation={recommendation}
        isLoading={isLoading}
        headerAction={
          recommendation ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setOverrideOpen(true)}
            >
              Sobrescrever
            </Button>
          ) : undefined
        }
      />

      {recommendation && (
        <RecommendationOverrideDialog
          open={overrideOpen}
          onOpenChange={setOverrideOpen}
          quotationId={quotationId}
          scores={recommendation.scores}
        />
      )}
    </>
  );
}

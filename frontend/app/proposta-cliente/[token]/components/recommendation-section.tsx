'use client';

import type {
  ClientPortalProposal,
  RecommendationResult,
} from '@/types/quotation';
import { RecommendationView } from '@/components/recommendation-view';

interface RecommendationSectionProps {
  recommendation: RecommendationResult | null;
  proposals: ClientPortalProposal[];
}

export function RecommendationSection({
  recommendation,
  proposals,
}: RecommendationSectionProps) {
  // When there is no recommendation, distinguish "nothing eligible because every
  // proposal is near expiry / expired" from the generic "still being prepared"
  // state. Proposals near or past validity do not enter the IA analysis, so a
  // quotation made up entirely of such proposals yields no recommendation.
  const hasProposals = proposals.length > 0;
  const noneEligibleByValidity =
    hasProposals && proposals.every((p) => p.validade_status !== 'ok');

  if (recommendation && recommendation.scores.length > 0) {
    return <RecommendationView recommendation={recommendation} />;
  }

  if (noneEligibleByValidity) {
    return (
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="bg-[#2c2d65] px-4 py-3 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#ff9e1b]" />
          <p className="text-xs font-semibold text-white/90 uppercase tracking-wide">
            Recomendacao IA
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#ce0f69]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#2c2d65]/30" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            Recomendacao indisponivel no momento
          </p>
          <p className="text-xs text-muted-foreground/70 max-w-xs">
            As propostas recebidas estao proximas do vencimento ou vencidas e,
            por isso, nao entram na analise automatica da IA. Avalie o
            comparativo acima ou fale com a equipe Freitas COMEX.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="bg-[#2c2d65] px-4 py-3 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-[#ff9e1b]" />
        <p className="text-xs font-semibold text-white/90 uppercase tracking-wide">
          Recomendacao IA
        </p>
      </div>
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff9e1b]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#ce0f69]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#2c2d65]/30" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          Analise em preparacao
        </p>
        <p className="text-xs text-muted-foreground/70 max-w-xs">
          Nossa equipe esta revisando as propostas para fornecer uma
          recomendacao personalizada.
        </p>
      </div>
    </div>
  );
}

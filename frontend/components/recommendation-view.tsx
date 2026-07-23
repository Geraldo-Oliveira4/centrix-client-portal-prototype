'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Star, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { ProposalScore, RecommendationResult } from '@/types/quotation';

// Shared, read-only presentation of the AI recommendation. Used by both the
// analyst RecommendationPanel (which adds the "Sobrescrever" action + dialog via
// `headerAction`) and the client portal (which passes no action). Keeping the
// score rows and card layout here is the single source of truth so the two
// surfaces never drift.

function ScoreBar({ value }: { value: number | null }) {
  if (value == null)
    return <span className="text-xs text-muted-foreground">—</span>;
  const pct = Math.round(value);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full',
            pct >= 70
              ? 'bg-green-500'
              : pct >= 40
                ? 'bg-amber-400'
                : 'bg-red-400',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums w-8 text-right">{pct}</span>
    </div>
  );
}

function ScoreRow({
  score,
  isRecommended,
}: {
  score: ProposalScore;
  isRecommended: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3 flex flex-col gap-2 transition-colors',
        isRecommended && 'border-green-500/50 bg-green-50/40',
        !score.is_eligible && 'opacity-60 border-dashed',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isRecommended && (
            <Star className="w-3.5 h-3.5 text-green-600 fill-green-600 shrink-0" />
          )}
          <span className="text-sm font-medium">{score.agent_name}</span>
          {isRecommended && (
            <Badge
              variant="outline"
              className="text-[10px] border-green-600 text-green-700 h-4 px-1.5"
            >
              Recomendada
            </Badge>
          )}
          {!score.is_eligible && (
            <Badge
              variant="outline"
              className="text-[10px] border-destructive text-destructive h-4 px-1.5"
            >
              Inelegivel
            </Badge>
          )}
        </div>
        {score.total_score != null && (
          <span className="text-sm font-bold tabular-nums">
            {Math.round(score.total_score)}
          </span>
        )}
      </div>

      {score.ineligibility_reason && (
        <p className="text-[11px] text-destructive flex items-start gap-1">
          <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />
          {score.ineligibility_reason}
        </p>
      )}

      {score.is_eligible && (
        <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <span>Custo (28%)</span>
          <span>Prazo (22%)</span>
          <span>Rota (18%)</span>
          <div>
            <ScoreBar value={score.cost_score} />
          </div>
          <div>
            <ScoreBar value={score.transit_score} />
          </div>
          <div>
            <ScoreBar value={score.route_score} />
          </div>
          <span>Frequência (14%)</span>
          <span>Free time (10%)</span>
          <span>Validade (8%)</span>
          <div>
            <ScoreBar value={score.frequency_score} />
          </div>
          <div>
            <ScoreBar value={score.free_time_score} />
          </div>
          <div>
            <ScoreBar value={score.validity_score} />
          </div>
        </div>
      )}

      {score.validade_status === 'em_risco' && (
        <p className="text-[11px] text-amber-600 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          Validade em risco — pontuacao reduzida neste criterio
        </p>
      )}
    </div>
  );
}

interface RecommendationViewProps {
  recommendation?: RecommendationResult | null;
  /** Shows the loading skeleton; keeps the loading UI in one place for both surfaces. */
  isLoading?: boolean;
  /** Optional action rendered in the header (e.g. the analyst "Sobrescrever" button). */
  headerAction?: ReactNode;
  /**
   * Surface styling. 'default' keeps the analyst / public-proposal look; 'portal'
   * swaps the outer shell and the header for the Client Portal design system
   * (.portal-card + .portal-h2) so this panel stops being the one block on the
   * quotation detail screen that still reads as an internal tool.
   *
   * Only the shell and the header change — the score rows and the recommendation
   * text below are shared markup and stay identical on every surface.
   */
  variant?: 'default' | 'portal';
}

export function RecommendationView({
  recommendation,
  isLoading,
  headerAction,
  variant = 'default',
}: RecommendationViewProps) {
  const isPortal = variant === 'portal';

  if (isLoading) {
    return (
      <div
        className={cn(
          'animate-pulse',
          isPortal
            ? 'portal-card portal-body p-6 text-portal-neutral'
            : 'rounded-lg border bg-card p-4 text-sm text-muted-foreground',
        )}
      >
        Calculando recomendação...
      </div>
    );
  }

  if (!recommendation || recommendation.scores.length === 0) return null;

  const sortedScores = [...recommendation.scores].sort((a, b) => {
    if (a.is_eligible !== b.is_eligible) return a.is_eligible ? -1 : 1;
    return (b.total_score ?? -1) - (a.total_score ?? -1);
  });

  return (
    <div
      className={cn(
        'overflow-hidden',
        isPortal ? 'portal-card' : 'rounded-lg border bg-card',
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between border-b',
          isPortal ? 'px-6 py-4' : 'bg-muted/40 px-4 py-2.5',
        )}
      >
        {isPortal ? (
          <h2 className="portal-h2 text-foreground">Recomendação por IA</h2>
        ) : (
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Recomendação por IA
          </p>
        )}
        {headerAction}
      </div>

      <div className={cn('flex flex-col', isPortal ? 'gap-4 p-6' : 'gap-3 p-4')}>
        {recommendation.is_overridden && recommendation.override && (
          <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-px" />
            <div>
              <span className="font-medium">
                Override manual aplicado — {recommendation.override.agent_name}.
              </span>{' '}
              <span className="text-amber-700">
                {recommendation.override.justification}
              </span>
            </div>
          </div>
        )}

        {recommendation.recommendation_text && (
          <div className="flex items-start gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-800">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <p className="whitespace-pre-wrap leading-relaxed">
              {recommendation.recommendation_text}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {sortedScores.map((score) => (
            <ScoreRow
              key={score.proposal_id}
              score={score}
              isRecommended={
                score.proposal_id === recommendation.recommended_proposal_id
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

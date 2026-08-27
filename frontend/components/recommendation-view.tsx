'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Star, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { ProposalScore, RecommendationResult } from '@/types/quotation';

// Shared, read-only presentation of the AI recommendation. Used by both the
// analyst RecommendationPanel (which adds the "Sobrescrever" action + dialog via
// `headerAction`) and the client portal (which passes no action).
//
// THE TWO SURFACES DELIBERATELY DIVERGE IN THE BODY (27/08/2026)
// --------------------------------------------------------------
// They used to share the score rows. They no longer do, and the split is the
// point rather than drift:
//
//   - the ANALYST is deciding with a scoring tool, and the weights, the bars
//     and the 0-100 number are the tool. Nothing below changes for them.
//   - the CLIENT is choosing a supplier. Showing them "Pontuação geral: 87/100"
//     plus six weighted bars turns a suggestion into a verdict carrying the
//     Freitas seal, which is exactly the reputational risk raised in the
//     original Cotação discovery (ZO4, Victor Orsi): if Freitas stamps a strong
//     recommendation and the shipment goes wrong, the client holds Freitas
//     responsible. The decision recorded then was to introduce recommendation
//     GRADUALLY, and never to lead with an explicit score.
//
// So the portal keeps the ranking (the order of the list) and drops the
// apparatus. The calculation is untouched — this is a display change only.
//
// WORDING: the portal sentence says "entre as propostas recebidas", NOT "com
// base no histórico desta rota". There is no route history behind this: the
// score normalizes cost/transit/free-time/validity ACROSS THE PROPOSALS OF THIS
// QUOTATION and reads route/frequency off each proposal's own fields (see
// backend shared/domain/recommendation_service.py::_compute_scores). Claiming
// history would invent a data source, and the "Evidência" block on the same
// screen is the one that actually reads history. Soften the stamp, do not
// relocate it onto a source that does not exist.

function ScoreBar({
  value,
  showValue = true,
}: {
  value: number | null;
  showValue?: boolean;
}) {
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
      {showValue && (
        <span className="text-xs tabular-nums w-8 text-right">{pct}</span>
      )}
    </div>
  );
}

/** Analyst / public-proposal row: the full scoring tool. Unchanged. */
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

/**
 * Portal row: one plain line per agent. No card border, no bars, no number —
 * the ranking is the order, and the seal is a word, not a trophy. The warnings
 * stay: "inelegível" and "validade em risco" are facts about the offer the
 * client is about to pick, not scoring apparatus.
 */
function PortalScoreLine({
  score,
  isRecommended,
}: {
  score: ProposalScore;
  isRecommended: boolean;
}) {
  return (
    <li className={cn('py-2', !score.is_eligible && 'opacity-70')}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="portal-body font-medium text-foreground">
          {score.agent_name}
        </span>
        {isRecommended && (
          <span className="portal-small rounded border border-portal-info/25 bg-portal-info/10 px-2 py-0.5 font-medium text-portal-info">
            Melhor equilíbrio
          </span>
        )}
        {!score.is_eligible && (
          <span className="portal-small rounded border border-border px-2 py-0.5 font-medium text-portal-neutral">
            Fora dos critérios
          </span>
        )}
      </div>

      {score.ineligibility_reason && (
        <p className="portal-small mt-1 text-portal-neutral">
          {score.ineligibility_reason}
        </p>
      )}

      {score.is_eligible && score.validade_status === 'em_risco' && (
        <p className="portal-small mt-1 flex items-center gap-1 text-portal-warning">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Validade curta — confirme o prazo antes de aprovar.
        </p>
      )}
    </li>
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
   * swaps the shell, the header AND the body — see the module comment for why
   * the client does not get the score apparatus.
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

  const recommendedName = recommendation.scores.find(
    (s) => s.proposal_id === recommendation.recommended_proposal_id,
  )?.agent_name;

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
          <h2 className="portal-h2 text-foreground">Recomendação</h2>
        ) : (
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Recomendação por IA
          </p>
        )}
        {headerAction}
      </div>

      <div className={cn('flex flex-col', isPortal ? 'gap-4 p-6' : 'gap-3 p-4')}>
        {recommendation.is_overridden && recommendation.override && (
          <div
            className={cn(
              'flex items-start gap-2',
              isPortal
                ? 'portal-body rounded-md border border-portal-warning/25 bg-portal-warning/10 px-3 py-2 text-foreground'
                : 'rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800',
            )}
          >
            <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-px" />
            <div>
              <span className="font-medium">
                {isPortal
                  ? `Ajuste manual da Freitas — ${recommendation.override.agent_name}.`
                  : `Override manual aplicado — ${recommendation.override.agent_name}.`}
              </span>{' '}
              <span className={isPortal ? 'text-portal-neutral' : 'text-amber-700'}>
                {recommendation.override.justification}
              </span>
            </div>
          </div>
        )}

        {isPortal ? (
          // Data, not a stamp: it describes what the comparison found, it does
          // not tell the client what to contract. No green box, no icon, no
          // score — see the module comment (ZO4).
          recommendedName ? (
            <p className="portal-body text-foreground">
              Entre as propostas recebidas,{' '}
              <span className="font-medium">{recommendedName}</span> foi a que
              apresentou o melhor equilíbrio entre custo, prazo e condições. A
              escolha é sua.
            </p>
          ) : null
        ) : (
          recommendation.recommendation_text && (
            <div className="flex items-start gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-800">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <p className="whitespace-pre-wrap leading-relaxed">
                {recommendation.recommendation_text}
              </p>
            </div>
          )
        )}

        {isPortal ? (
          <div className="space-y-3">
            <ul className="divide-y">
              {sortedScores.map((score) => (
                <PortalScoreLine
                  key={score.proposal_id}
                  score={score}
                  isRecommended={
                    score.proposal_id === recommendation.recommended_proposal_id
                  }
                />
              ))}
            </ul>
            <p className="portal-small border-t border-dashed pt-3 text-portal-neutral">
              Comparação feita sobre as propostas desta cotação — preço, transit
              time, rota, frequência, free time e validade. Não é uma indicação
              da Freitas sobre qual contratar.
            </p>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}

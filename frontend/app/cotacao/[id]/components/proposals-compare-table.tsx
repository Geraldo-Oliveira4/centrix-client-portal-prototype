'use client';

import { Fragment, useMemo, useState } from 'react';
import { AlertTriangle, Award, CheckCircle2, RefreshCw, Shield, ShieldOff, Star, Trophy } from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { selectWinner } from '@/hooks/use-proposals';
import type { NonWinnerAgent } from '@/hooks/use-proposals';
import {
  PROPOSAL_ROUTE_TYPE_LABELS,
  TIPO_EMBALAGEM_LABELS,
  TIPO_CONTAINER_LABELS,
  type Quotation,
  type QuotationProposal,
  type RecommendationResult,
} from '@/types/quotation';
import { buildGroupedSums } from '@/utils/fee-categories';
import { formatDateDisplay, getFieldVisibility, resolveEmbarqueLabel } from '@/utils/quotation-fields';
import { formatBRL, formatCurrencyCode, formatMultiCurrency } from '@/lib/portal-formatters';
import { RecommendationOverrideDialog } from './recommendation-override-dialog';

const CATEGORY_LABELS: Record<string, string> = {
  ORIGEM: 'Taxas de Origem',
  FRETE: 'Frete Internacional',
  DESTINO: 'Taxas de Destino',
};

interface ProposalColumnHeaderProps {
  proposal: QuotationProposal;
  isRecommended: boolean;
  isLowestCost: boolean;
  isLowestTransit: boolean;
  isAtRisk: boolean;
  updatedAfterSent: boolean;
  costRank: number | null;
  transitRank: number | null;
  freqRank: number | null;
}

function ProposalColumnHeader({
  proposal,
  isRecommended,
  isLowestCost,
  isLowestTransit,
  isAtRisk,
  updatedAfterSent,
  costRank,
  transitRank,
  freqRank,
}: ProposalColumnHeaderProps) {
  const hasRanks = costRank != null || transitRank != null || freqRank != null;
  return (
    <div className="flex flex-col items-center gap-1">
      {isLowestCost && (
        <span className="text-[10px] font-semibold text-green-600 uppercase tracking-wider">
          Mais Barata
        </span>
      )}
      {isLowestTransit && (
        <span className="text-[10px] font-semibold text-green-600 uppercase tracking-wider">
          Mais Rapida
        </span>
      )}
      {isRecommended && (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 dark:text-green-400">
          <Star className="w-3 h-3 fill-green-600 text-green-600" />
          Recomendado pela IA
        </span>
      )}
      <div className="flex items-center gap-1.5">
        <span className="font-semibold text-foreground">
          {proposal.agent?.name ?? `Agente ${proposal.agent_id.slice(0, 8)}`}
        </span>
        {(proposal.version ?? 1) > 1 && (
          <span className="text-[10px] font-mono font-semibold border rounded px-1 text-muted-foreground">
            V{proposal.version}
          </span>
        )}
      </div>
      {hasRanks && (
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {[
            costRank != null && `Custo: ${costRank}º`,
            transitRank != null && `Prazo: ${transitRank}º`,
            freqRank != null && `Freq.: ${freqRank}º`,
          ]
            .filter(Boolean)
            .join(' | ')}
        </span>
      )}
      {(isLowestCost || isLowestTransit) && (
        <div className="flex items-center gap-1 flex-wrap justify-center">
          {isLowestCost && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 dark:text-emerald-400 dark:bg-emerald-950/20 dark:border-emerald-800">
              Menor preco
            </span>
          )}
          {isLowestTransit && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 dark:text-blue-400 dark:bg-blue-950/20 dark:border-blue-800">
              Menor prazo
            </span>
          )}
        </div>
      )}
      {isAtRisk && (
        <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          Validade em risco
        </span>
      )}
      {proposal.is_winner && (
        <span className="text-[10px] text-green-600 flex items-center gap-1">
          <Award className="w-3 h-3" />
          Vencedora
        </span>
      )}
      {updatedAfterSent && (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 dark:text-blue-400 dark:bg-blue-950/20 dark:border-blue-800">
          <RefreshCw className="w-3 h-3" />
          Atualizada apos envio
        </span>
      )}
    </div>
  );
}

type SortKey = 'total_value' | 'transit_time';

interface ProposalsCompareTableProps {
  quotationId: string;
  proposals: QuotationProposal[];
  quotation?: Quotation;
  onViewFlags: (proposal: QuotationProposal) => void;
  recommendation?: RecommendationResult;
  onWinnerSelected?: (nonWinnerAgents: NonWinnerAgent[], winningProposalId: string) => void;
  earliestLinkAt: string | null;
}

export function ProposalsCompareTable({ quotationId, proposals, quotation, onViewFlags, recommendation, onWinnerSelected, earliestLinkAt }: ProposalsCompareTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('total_value');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideInitialId, setOverrideInitialId] = useState<string | undefined>(undefined);

  const { showDestinationYard } = getFieldVisibility({ modal: quotation?.modal });

  const scoreByProposalId = recommendation
    ? Object.fromEntries(recommendation.scores.map((s) => [s.proposal_id, s]))
    : {};

  const handleApprove = async (proposal: QuotationProposal) => {
    const agentName = proposal.agent?.name ?? 'este agente';
    if (!confirm(`Aprovar a proposta de "${agentName}"?`)) return;
    setApprovingId(proposal.id);
    const result = await selectWinner(quotationId, proposal.id);
    setApprovingId(null);
    if (result.success) {
      onWinnerSelected?.(result.non_winner_agents, proposal.id);
    }
  };

  const handleAcceptRecommendation = async () => {
    if (!recommendation?.recommended_proposal_id) return;
    setApprovingId(recommendation.recommended_proposal_id);
    const result = await selectWinner(quotationId, recommendation.recommended_proposal_id);
    setApprovingId(null);
    if (result.success) {
      onWinnerSelected?.(result.non_winner_agents, recommendation.recommended_proposal_id);
    }
  };

  const handleChooseOther = (proposalId: string) => {
    setOverrideInitialId(proposalId);
    setOverrideOpen(true);
  };

  // Compare costs in BRL when available so mixed-currency proposals rank fairly;
  // fall back to the raw total only when no proposal carries a normalized total.
  const costOf = (p: QuotationProposal) => p.total_brl ?? p.total_value;

  const sorted = [...proposals].sort((a, b) =>
    sortKey === 'total_value' ? costOf(a) - costOf(b) : a.transit_time - b.transit_time,
  );

  const minTotal = Math.min(...sorted.map(costOf));
  const minTotalBrl = Math.min(...sorted.map((p) => p.total_brl ?? Infinity));
  const hasBrlTotals = sorted.some((p) => p.total_brl != null);
  // Single reference PTAX shared by every proposal — surfaced so the analyst
  // sees which rate the BRL normalization used.
  const ptaxUsado = sorted.find((p) => p.ptax_usado != null)?.ptax_usado ?? null;
  const brlTotalLabel =
    ptaxUsado != null
      ? `Total em BRL (PTAX ${ptaxUsado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`
      : 'Total em BRL';
  const minTransit = Math.min(...sorted.map((p) => p.transit_time));
  const freeTimes = sorted.map((p) => p.free_time_dias).filter((v): v is number => v != null);
  const maxFreeTime = freeTimes.length > 0 ? Math.max(...freeTimes) : null;
  const hasFreeTime = freeTimes.length > 0;

  const sumsByProposal = useMemo(
    () => Object.fromEntries(proposals.map((p) => [p.id, buildGroupedSums(p)])),
    [proposals],
  );

  const computeRankByCriteria = (
    criterion: 'cost_score' | 'transit_score' | 'frequency_score',
  ): Record<string, number> => {
    const values = sorted
      .map((p) => ({ id: p.id, value: scoreByProposalId[p.id]?.[criterion] ?? null }))
      .filter((x): x is { id: string; value: number } => x.value != null);
    const unique = Array.from(new Set(values.map((x) => x.value))).sort((a, b) => b - a);
    return Object.fromEntries(values.map((x) => [x.id, unique.indexOf(x.value) + 1]));
  };

  const costRanks = computeRankByCriteria('cost_score');
  const transitRanks = computeRankByCriteria('transit_score');
  const freqRanks = computeRankByCriteria('frequency_score');

  const recommendedProposal = recommendation?.recommended_proposal_id
    ? sorted.find((p) => p.id === recommendation.recommended_proposal_id)
    : undefined;

  const hasActiveRecommendation =
    !!recommendation?.recommended_proposal_id && !recommendation.is_overridden;

  const isRecommendedApproved = recommendedProposal?.is_winner ?? false;

  return (
    <>
    <div className="flex flex-col gap-3">
      {hasActiveRecommendation && !isRecommendedApproved && (
        <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 dark:border-green-800 dark:bg-green-950/20">
          <div className="flex items-center gap-2">
            <Star className="w-3.5 h-3.5 text-green-600 fill-green-600 shrink-0" />
            <span className="text-xs font-medium text-green-800 dark:text-green-300">
              IA recomenda:{' '}
              <span className="font-semibold">
                {recommendedProposal?.agent?.name ?? 'proposta recomendada'}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
              disabled={!!approvingId}
              onClick={handleAcceptRecommendation}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              {approvingId === recommendation?.recommended_proposal_id
                ? 'Aceitando...'
                : 'Aceitar recomendacao'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => setOverrideOpen(true)}
            >
              Escolher outra
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Ordenar por:</span>
        <Button
          size="sm"
          variant={sortKey === 'total_value' ? 'default' : 'outline'}
          className="h-7 text-xs"
          onClick={() => setSortKey('total_value')}
        >
          Menor Preco
        </Button>
        <Button
          size="sm"
          variant={sortKey === 'transit_time' ? 'default' : 'outline'}
          className="h-7 text-xs"
          onClick={() => setSortKey('transit_time')}
        >
          Menor Prazo
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-36 sticky left-0 bg-muted/40">
                Campo
              </th>
              {sorted.map((p) => {
                const score = scoreByProposalId[p.id];
                const isRecommended = score?.is_recommended ?? false;
                const isLowestCost = score?.is_lowest_cost ?? false;
                const isLowestTransit = score?.is_lowest_transit ?? false;
                return (
                  <th
                    key={p.id}
                    className={cn(
                      'px-3 py-2.5 text-center w-[220px]',
                      isRecommended && 'bg-green-50/60 dark:bg-green-950/20',
                    )}
                  >
                    <ProposalColumnHeader
                      proposal={p}
                      isRecommended={isRecommended}
                      isLowestCost={isLowestCost}
                      isLowestTransit={isLowestTransit}
                      isAtRisk={score?.validade_status === 'em_risco'}
                      updatedAfterSent={
                        earliestLinkAt != null &&
                        new Date(p.received_at) > new Date(earliestLinkAt)
                      }
                      costRank={costRanks[p.id] ?? null}
                      transitRank={transitRanks[p.id] ?? null}
                      freqRank={freqRanks[p.id] ?? null}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <CompareRow
              label="Total"
              cells={sorted.map((p) => {
                const multiCurr = formatMultiCurrency(sumsByProposal[p.id].total);
                return {
                  key: p.id,
                  content: multiCurr !== '—' ? multiCurr : formatCurrencyCode(p.total_value, p.freight_currency),
                  highlight: costOf(p) === minTotal,
                  bold: true,
                  champion: costOf(p) === minTotal,
                };
              })}
            />
            {hasBrlTotals && (
              <CompareRow
                label={brlTotalLabel}
                shaded
                cells={sorted.map((p) => ({
                  key: p.id,
                  content: formatBRL(p.total_brl),
                  highlight: p.total_brl != null && p.total_brl === minTotalBrl,
                  bold: true,
                  champion: p.total_brl != null && p.total_brl === minTotalBrl,
                }))}
              />
            )}
            {(['ORIGEM', 'FRETE', 'DESTINO'] as const).map((category) => {
              const categoryKey = category.toLowerCase() as 'origem' | 'frete' | 'destino';
              const hasValues = sorted.some((p) =>
                Object.values(sumsByProposal[p.id][categoryKey]).some((v) => v > 0),
              );
              if (!hasValues) return null;
              return (
                <CompareRow
                  key={category}
                  label={CATEGORY_LABELS[category]}
                  shaded={category === 'ORIGEM' || category === 'DESTINO'}
                  cells={sorted.map((p) => ({
                    key: p.id,
                    content: formatMultiCurrency(sumsByProposal[p.id][categoryKey]),
                  }))}
                />
              );
            })}
            <CompareRow
              label="Transit Time"
              cells={sorted.map((p) => ({
                key: p.id,
                content: `${p.transit_time} dias`,
                highlight: p.transit_time === minTransit,
                champion: p.transit_time === minTransit,
              }))}
            />
            <CompareRow
              label="Incoterm"
              shaded
              cells={sorted.map((p) => ({
                key: p.id,
                content: p.incoterm ?? null,
              }))}
            />
            <tr className="border-b">
              <td className="px-3 py-2.5 text-xs text-muted-foreground font-medium uppercase tracking-wide sticky left-0 bg-background">
                Seguro
              </td>
              {sorted.map((p) => (
                <td key={p.id} className="px-3 py-2.5 text-center">
                  <span
                    className={cn(
                      'inline-flex items-center justify-center gap-1 text-xs',
                      p.insurance_included ? 'text-green-600' : 'text-muted-foreground',
                    )}
                  >
                    {p.insurance_included ? (
                      <>
                        <Shield className="w-3.5 h-3.5" />
                        Incluido
                      </>
                    ) : (
                      <>
                        <ShieldOff className="w-3.5 h-3.5" />
                        Nao incluido
                      </>
                    )}
                  </span>
                </td>
              ))}
            </tr>
            <CompareRow
              label="Armador / Cia"
              shaded
              cells={sorted.map((p) => ({
                key: p.id,
                content: p.carrier ?? null,
              }))}
            />
            <CompareRow
              label="Validade"
              cells={sorted.map((p) => ({
                key: p.id,
                content: p.validity ? formatDateDisplay(p.validity) : null,
              }))}
            />
            {/* --- ARB-1887: new detail rows --- */}
            <CompareRow
              label="Tipo de embarque"
              shaded
              cells={sorted.map((p) => ({
                key: p.id,
                content: resolveEmbarqueLabel(quotation?.modal, quotation?.tipo_embarque),
              }))}
            />
            <CompareRow
              label="Local de embarque"
              cells={sorted.map((p) => ({
                key: p.id,
                content: p.proposal_origin || quotation?.porto_embarque || quotation?.aeroporto_embarque || null,
              }))}
            />
            <CompareRow
              label="Local de desembarque"
              shaded
              cells={sorted.map((p) => ({
                key: p.id,
                content: p.proposal_destination || quotation?.porto_destino?.join(', ') || quotation?.aeroporto_destino?.join(', ') || null,
              }))}
            />
            <CompareRow
              label="Rota"
              cells={sorted.map((p) => ({
                key: p.id,
                content: p.route_type ? PROPOSAL_ROUTE_TYPE_LABELS[p.route_type] : null,
                champion: p.route_type === 'DIRETA',
              }))}
            />
            <CompareRow
              label="Transbordo / Conexao"
              shaded
              cells={sorted.map((p) => ({
                key: p.id,
                content: p.route_detail ?? null,
              }))}
            />
            <CompareRow
              label="Frequencia de embarques"
              cells={sorted.map((p) => ({
                key: p.id,
                content: p.frequencia ?? null,
              }))}
            />
            {hasFreeTime && (
              <CompareRow
                label="Free Time"
                cells={sorted.map((p) => ({
                  key: p.id,
                  content: p.free_time_dias != null ? `${p.free_time_dias} dias` : null,
                  champion: p.free_time_dias != null && p.free_time_dias === maxFreeTime,
                }))}
              />
            )}
            <CompareRow
              label="Volumes cotados"
              cells={sorted.map((p) => ({
                key: p.id,
                content: quotation?.volumes?.length
                  ? quotation.volumes.map((v) => {
                      const emb = v.embalagem ? (TIPO_EMBALAGEM_LABELS[v.embalagem] ?? v.embalagem) : 'N/A';
                      const peso = v.peso_bruto != null ? `${Number(v.peso_bruto).toLocaleString('pt-BR', { minimumFractionDigits: 3 })} ${v.peso_unidade}` : 'N/A';
                      const vol = v.volume_m3 != null ? `${Number(v.volume_m3).toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m³` : 'N/A';
                      return `${v.quantity}x ${emb} — ${peso} / ${vol}`;
                    }).join('\n')
                  : null,
              }))}
            />
            {(quotation?.tipo_embarque === 'FCL') && (
              <CompareRow
                label="Equipamento cotado"
                shaded
                cells={sorted.map((p) => ({
                  key: p.id,
                  content: quotation?.equipments?.length
                    ? quotation.equipments.map((eq) => {
                        const container = TIPO_CONTAINER_LABELS[eq.tipo_container] ?? eq.tipo_container;
                        const peso = eq.peso_bruto != null ? `${Number(eq.peso_bruto).toLocaleString('pt-BR', { minimumFractionDigits: 3 })} ${eq.peso_unidade}` : 'N/A';
                        const vol = eq.volume_m3 != null ? `${Number(eq.volume_m3).toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m³` : 'N/A';
                        return `${eq.quantity}x ${container} — ${peso} / ${vol}`;
                      }).join('\n')
                    : null,
                }))}
              />
            )}
            {(quotation?.tipo_embarque === 'FCL') && sorted.some((p) => p.offered_container_type) && (
              <CompareRow
                label="Container ofertado"
                cells={sorted.map((p) => ({
                  key: p.id,
                  content: p.offered_container_type ? TIPO_CONTAINER_LABELS[p.offered_container_type] : null,
                }))}
              />
            )}
            {showDestinationYard && (
              <CompareRow
                label="Terminal de desova"
                shaded={quotation?.tipo_embarque !== 'FCL'}
                cells={sorted.map((p) => ({
                  key: p.id,
                  content: quotation?.destination_yard ?? null,
                }))}
              />
            )}
            <tr className="border-b">
              <td className="px-3 py-2.5 text-xs text-muted-foreground font-medium uppercase tracking-wide sticky left-0 bg-background">
                Flags
              </td>
              {sorted.map((p) => {
                const s = p.audit_flags_summary;
                const critical = s?.critical ?? 0;
                const high = s?.high ?? 0;
                const total = s?.total ?? 0;

                if (total === 0) {
                  return (
                    <td key={p.id} className="px-3 py-2.5 text-center">
                      <span className="text-xs text-green-600 font-medium">Sem flags</span>
                    </td>
                  );
                }

                const label =
                  critical > 0
                    ? `${critical} Critico${critical > 1 ? 's' : ''}${high > 0 ? ` + ${high} Alto${high > 1 ? 's' : ''}` : ''}`
                    : high > 0
                      ? `${high} Alto${high > 1 ? 's' : ''}`
                      : `${total} flag${total > 1 ? 's' : ''}`;

                return (
                  <td key={p.id} className="px-3 py-2.5 text-center">
                    <button
                      onClick={() => onViewFlags(p)}
                      className={cn(
                        'text-xs rounded border px-2 py-1 hover:opacity-80 transition-opacity',
                        critical > 0
                          ? 'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/20 dark:border-red-800'
                          : 'text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950/20 dark:border-orange-800',
                      )}
                    >
                      {label}
                    </button>
                  </td>
                );
              })}
            </tr>
            <tr className="bg-muted/10">
              <td className="px-3 py-2.5 sticky left-0 bg-muted/10" />
              {sorted.map((p) => (
                <td key={p.id} className="px-3 py-2.5 text-center">
                  {p.is_winner ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 dark:text-green-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Aprovada
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50 hover:text-green-800 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-950/30"
                      disabled={approvingId === p.id}
                      onClick={() => handleApprove(p)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      {approvingId === p.id ? 'Aprovando...' : 'Aprovar'}
                    </Button>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    {recommendation && (
      <RecommendationOverrideDialog
        open={overrideOpen}
        onOpenChange={setOverrideOpen}
        quotationId={quotationId}
        scores={recommendation.scores}
        initialProposalId={overrideInitialId}
        justificationRequired={false}
      />
    )}
    </>
  );
}

interface CellDef {
  key: string;
  content: string | null;
  highlight?: boolean;
  bold?: boolean;
  /** Mark this cell as the criterion champion — renders a trophy badge inline. */
  champion?: boolean;
}

function CompareRow({
  label,
  cells,
  shaded,
}: {
  label: string;
  cells: CellDef[];
  shaded?: boolean;
}) {
  return (
    <tr className={cn('border-b', shaded && 'bg-muted/20')}>
      <td className={cn(
        'px-3 py-2.5 text-xs uppercase tracking-wide sticky left-0 font-medium text-muted-foreground',
        shaded ? 'bg-muted/20' : 'bg-background',
      )}>
        {label}
      </td>
      {cells.map(({ key, content, highlight, bold, champion }) => (
        <td
          key={key}
          className={cn(
            'px-3 py-2.5 text-center tabular-nums',
            highlight && 'text-green-700 dark:text-green-400',
            bold && 'font-bold text-base',
            highlight && bold && 'bg-green-50 dark:bg-green-950/20',
          )}
        >
          <span className="inline-flex items-center justify-center gap-1">
            {content ?? <span className="text-muted-foreground font-normal">—</span>}
            {champion && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-500/15 text-green-600 shrink-0">
                <Trophy className="w-2.5 h-2.5" />
              </span>
            )}
          </span>
        </td>
      ))}
    </tr>
  );
}

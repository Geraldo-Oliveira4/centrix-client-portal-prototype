'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Download, RefreshCw, Shield, ShieldOff, Star, Trophy } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { PROPOSAL_ROUTE_TYPE_LABELS, TIPO_CONTAINER_LABELS, type ClientPortalProposal, type ClientPortalData } from '@/types/quotation';
import { buildGroupedSums } from '@/utils/fee-categories';
import { formatDateDisplay, resolveEmbarqueLabel } from '@/utils/quotation-fields';
import { compareByCheapestTotal, formatBRL, formatCurrencyCode, formatMultiCurrency, formatEstimatedArrival } from '@/lib/portal-formatters';
import { ValidadeStatusBadge } from './validade-status-badge';
import { LowestCostBadge, LowestTransitBadge } from './comparison-badges';

interface ProposalsClientTableProps {
  proposals: ClientPortalProposal[];
  quotation?: ClientPortalData['quotation'];
}

type FilterType = 'recomendada' | 'menor_preco' | 'menor_prazo';

const SORT_COMPARATORS: Record<FilterType, (a: ClientPortalProposal, b: ClientPortalProposal) => number> = {
  recomendada: (a, b) => {
    if (a.is_recommended !== b.is_recommended) return a.is_recommended ? -1 : 1;
    return (b.score ?? -1) - (a.score ?? -1);
  },
  menor_preco: compareByCheapestTotal,
  menor_prazo: (a, b) => a.transit_time - b.transit_time,
};

function computeRankings(
  proposals: ClientPortalProposal[],
  getValue: (p: ClientPortalProposal) => number | null,
): Record<string, number> {
  const withValue = proposals.filter((p) => getValue(p) != null);
  const desc = [...withValue].sort((a, b) => (getValue(b) ?? 0) - (getValue(a) ?? 0));
  const ranks: Record<string, number> = {};
  desc.forEach((p, i) => { ranks[p.proposal_id] = i + 1; });
  return ranks;
}

export function ProposalsClientTable({ proposals, quotation }: ProposalsClientTableProps) {
  // Default ordering: cheapest -> most expensive (per Orsi, 2026-06-22). The
  // client can still switch to "Recomendada" or "Menor Prazo".
  const [filter, setFilter] = useState<FilterType>('menor_preco');

  if (proposals.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        Nenhuma proposta disponível para esta cotação.
      </div>
    );
  }

  // Scoped to eligible proposals only (cost_score != null), same eligibility
  // signal used by is_lowest_cost/is_lowest_transit, so this raw freight-leg
  // highlight can't disagree with the Total ALL IN / BRL badges above. If no
  // proposal is eligible, minFreight is Infinity and nothing gets highlighted
  // — consistent with no recommendation being available either.
  const minFreight = Math.min(...proposals.filter((p) => p.cost_score != null).map((p) => p.freight_value));
  const freeTimes = proposals.map((p) => p.free_time_dias).filter((v): v is number => v != null);
  const maxFreeTime = freeTimes.length > 0 ? Math.max(...freeTimes) : null;
  const hasFreeTime = freeTimes.length > 0;

  const rankByCost = computeRankings(proposals, (p) => p.cost_score);
  const rankByTransit = computeRankings(proposals, (p) => p.transit_score);
  const rankByFrequency = computeRankings(proposals, (p) => p.frequency_score);

  const sorted = useMemo(
    () => [...proposals].sort(SORT_COMPARATORS[filter]),
    [proposals, filter],
  );

  const sumsByProposal = useMemo(
    () => Object.fromEntries(proposals.map((p) => [p.proposal_id, buildGroupedSums(p)])),
    [proposals],
  );

  const tipoEmbarqueLabel = resolveEmbarqueLabel(quotation?.modal, quotation?.tipo_embarque);

  const FILTER_LABELS: Record<FilterType, string> = {
    recomendada: 'Recomendada',
    menor_preco: 'Menor Preço',
    menor_prazo: 'Menor Prazo',
  };

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="bg-brand-navy px-4 py-3 flex items-center justify-between gap-4">
        <p className="text-xs font-semibold text-white/90 uppercase tracking-wide">
          Comparativo de Propostas
        </p>
        <div className="flex items-center gap-1">
          {(Object.keys(FILTER_LABELS) as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'text-[10px] font-medium px-2 py-1 rounded border transition-colors',
                filter === f
                  ? 'bg-white text-brand-navy border-white'
                  : 'text-white/70 border-white/30 hover:border-white/60',
              )}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse table-fixed">
          <thead>
            <tr className="border-b bg-muted/20">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-36 sticky left-0 bg-muted/20">
                Campo
              </th>
              {sorted.map((p, i) => {
                const criterionRanking = [
                  rankByCost[p.proposal_id] != null ? `Custo: ${rankByCost[p.proposal_id]}º lugar` : null,
                  rankByTransit[p.proposal_id] != null ? `Prazo: ${rankByTransit[p.proposal_id]}º lugar` : null,
                  rankByFrequency[p.proposal_id] != null ? `Freq.: ${rankByFrequency[p.proposal_id]}º lugar` : null,
                ].filter(Boolean).join(' | ');

                return (
                  <th
                    key={p.proposal_id}
                    className={cn(
                      'text-left px-4 py-3 w-[220px]',
                      i > 0 && 'border-l',
                      p.is_recommended && 'bg-brand-gold/10 border-t-4 border-t-brand-gold',
                    )}
                  >
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5">
                        {p.is_recommended && <Star className="w-4 h-4 shrink-0 fill-brand-gold text-brand-gold" />}
                        <span className="text-sm font-semibold">{p.agent_name}</span>
                      </div>
                      {p.is_recommended && (
                        <span className="inline-flex items-center w-fit text-[10px] font-semibold bg-brand-gold text-brand-navy px-1.5 py-0.5 rounded">
                          Recomendada
                        </span>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {p.is_lowest_cost && <LowestCostBadge />}
                        {p.is_lowest_transit && <LowestTransitBadge />}
                        <ValidadeStatusBadge status={p.validade_status} />
                        {p.is_winner && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-brand-navy text-white border border-brand-gold px-1.5 py-0.5 rounded">
                            <Trophy className="w-3 h-3 text-brand-gold" />
                            Escolhida
                          </span>
                        )}
                        {p.updated_after_sent && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-blue-100 text-blue-700 border border-blue-300 px-1.5 py-0.5 rounded">
                            <RefreshCw className="w-3 h-3" />
                            Atualizada
                          </span>
                        )}
                      </div>
                      {criterionRanking && (
                        <span className="text-[10px] text-muted-foreground">{criterionRanking}</span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* ── Detalhes operacionais ── */}

            {/* Tipo de embarque */}
            {tipoEmbarqueLabel && (
              <tr className="border-b bg-muted/10">
                <td className="px-4 py-2.5 text-xs text-muted-foreground sticky left-0 bg-muted/10">Tipo de Embarque</td>
                {sorted.map((p, i) => (
                  <td key={p.proposal_id} className={cn('px-4 py-2.5 text-muted-foreground', i > 0 && 'border-l')}>
                    {tipoEmbarqueLabel}
                  </td>
                ))}
              </tr>
            )}

            {/* Container ofertado (FCL) */}
            {quotation?.tipo_embarque === 'FCL' && sorted.some((p) => p.offered_container_type) && (
              <tr className="border-b bg-muted/10">
                <td className="px-4 py-2.5 text-xs text-muted-foreground sticky left-0 bg-muted/10">Container Ofertado</td>
                {sorted.map((p, i) => (
                  <td key={p.proposal_id} className={cn('px-4 py-2.5 text-muted-foreground', i > 0 && 'border-l')}>
                    {p.offered_container_type ? TIPO_CONTAINER_LABELS[p.offered_container_type] : '—'}
                  </td>
                ))}
              </tr>
            )}

            {/* Incoterm */}
            {sorted.some((p) => p.incoterm) && (
              <tr className="border-b">
                <td className="px-4 py-2.5 text-xs text-muted-foreground sticky left-0 bg-background">Incoterm</td>
                {sorted.map((p, i) => (
                  <td key={p.proposal_id} className={cn('px-4 py-2.5 text-muted-foreground', i > 0 && 'border-l')}>
                    {p.incoterm ?? '—'}
                  </td>
                ))}
              </tr>
            )}

            {/* Local de embarque */}
            {sorted.some((p) => p.proposal_origin) && (
              <tr className="border-b bg-muted/10">
                <td className="px-4 py-2.5 text-xs text-muted-foreground sticky left-0 bg-muted/10">Local de Embarque</td>
                {sorted.map((p, i) => (
                  <td key={p.proposal_id} className={cn('px-4 py-2.5 text-muted-foreground', i > 0 && 'border-l')}>
                    {p.proposal_origin ?? quotation?.origin ?? '—'}
                  </td>
                ))}
              </tr>
            )}

            {/* Local de desembarque */}
            {sorted.some((p) => p.proposal_destination) && (
              <tr className="border-b">
                <td className="px-4 py-2.5 text-xs text-muted-foreground sticky left-0 bg-background">Local de Desembarque</td>
                {sorted.map((p, i) => (
                  <td key={p.proposal_id} className={cn('px-4 py-2.5 text-muted-foreground', i > 0 && 'border-l')}>
                    {p.proposal_destination ?? quotation?.destination ?? '—'}
                  </td>
                ))}
              </tr>
            )}

            {/* Rota */}
            {sorted.some((p) => p.route_type) && (
              <tr className="border-b">
                <td className="px-4 py-2.5 text-xs text-muted-foreground sticky left-0 bg-background">Rota</td>
                {sorted.map((p, i) => (
                  <td key={p.proposal_id} className={cn('px-4 py-2.5 text-muted-foreground', i > 0 && 'border-l')}>
                    {p.route_type ? PROPOSAL_ROUTE_TYPE_LABELS[p.route_type] : '—'}
                  </td>
                ))}
              </tr>
            )}

            {/* Transbordo / Conexão */}
            {sorted.some((p) => p.route_detail) && (
              <tr className="border-b bg-muted/10">
                <td className="px-4 py-2.5 text-xs text-muted-foreground sticky left-0 bg-muted/10">Transbordo / Conexão</td>
                {sorted.map((p, i) => (
                  <td key={p.proposal_id} className={cn('px-4 py-2.5 text-muted-foreground text-xs', i > 0 && 'border-l')}>
                    {p.route_detail ?? '—'}
                  </td>
                ))}
              </tr>
            )}

            {/* Frequência de embarques */}
            {sorted.some((p) => p.frequencia) && (
              <tr className="border-b">
                <td className="px-4 py-2.5 text-xs text-muted-foreground sticky left-0 bg-background">Frequência</td>
                {sorted.map((p, i) => (
                  <td key={p.proposal_id} className={cn('px-4 py-2.5 text-muted-foreground', i > 0 && 'border-l')}>
                    {p.frequencia ?? '—'}
                  </td>
                ))}
              </tr>
            )}

            {/* Free Time (FCL) */}
            {hasFreeTime && (
              <tr className="border-b">
                <td className="px-4 py-2.5 text-xs text-muted-foreground sticky left-0 bg-background">Free Time</td>
                {sorted.map((p, i) => (
                  <td
                    key={p.proposal_id}
                    className={cn(
                      'px-4 py-2.5',
                      i > 0 && 'border-l',
                      p.free_time_dias != null && p.free_time_dias === maxFreeTime
                        ? 'text-brand-navy font-bold'
                        : 'text-muted-foreground',
                    )}
                  >
                    {p.free_time_dias != null ? `${p.free_time_dias} dias` : '—'}
                  </td>
                ))}
              </tr>
            )}

            {/* Prazo */}
            <tr className="border-b bg-muted/10">
              <td className="px-4 py-2.5 text-xs text-muted-foreground sticky left-0 bg-muted/10">Prazo (dias)</td>
              {sorted.map((p, i) => (
                <td key={p.proposal_id} className={cn('px-4 py-2.5', i > 0 && 'border-l', p.is_lowest_transit && 'text-brand-navy font-bold')}>
                  {p.transit_time}
                </td>
              ))}
            </tr>

            {/* Chegada estimada */}
            <tr className="border-b">
              <td className="px-4 py-2.5 text-xs text-muted-foreground sticky left-0 bg-background">Chegada estimada</td>
              {sorted.map((p, i) => (
                <td key={p.proposal_id} className={cn('px-4 py-2.5 text-xs text-muted-foreground', i > 0 && 'border-l')}>
                  {formatEstimatedArrival(p.transit_time)}
                </td>
              ))}
            </tr>

            {/* Armador */}
            <tr className="border-b">
              <td className="px-4 py-2.5 text-xs text-muted-foreground sticky left-0 bg-background">Armador/CIA</td>
              {sorted.map((p, i) => (
                <td key={p.proposal_id} className={cn('px-4 py-2.5 text-muted-foreground', i > 0 && 'border-l')}>{p.carrier || '—'}</td>
              ))}
            </tr>

            {/* Validade */}
            <tr className="border-b bg-muted/10">
              <td className="px-4 py-2.5 text-xs text-muted-foreground sticky left-0 bg-muted/10">Validade</td>
              {sorted.map((p, i) => (
                <td
                  key={p.proposal_id}
                  className={cn(
                    'px-4 py-2.5',
                    i > 0 && 'border-l',
                    p.validade_status === 'expirada'
                      ? 'text-red-600 font-medium'
                      : p.validade_status === 'em_risco'
                        ? 'text-amber-600'
                        : 'text-muted-foreground',
                  )}
                >
                  {p.validity ? formatDateDisplay(p.validity) : '—'}
                  {p.validade_status === 'em_risco' && (
                    <span className="ml-1.5 text-[10px]">(vence em breve)</span>
                  )}
                  {p.validade_status === 'expirada' && (
                    <span className="ml-1.5 text-[10px]">(vencida)</span>
                  )}
                </td>
              ))}
            </tr>

            {/* Seguro */}
            <tr className="border-b">
              <td className="px-4 py-2.5 text-xs text-muted-foreground sticky left-0 bg-background">Seguro incluso</td>
              {sorted.map((p, i) => (
                <td key={p.proposal_id} className={cn('px-4 py-2.5', i > 0 && 'border-l')}>
                  {p.insurance_included ? (
                    <Shield className="w-4 h-4 text-brand-pink" />
                  ) : (
                    <ShieldOff className="w-4 h-4 text-muted-foreground/40" />
                  )}
                </td>
              ))}
            </tr>

            {/* ── Valores financeiros ── */}

            {/* Taxas de Origem */}
            <tr className="border-b bg-muted/5">
              <td className="px-4 py-2.5 text-xs text-muted-foreground sticky left-0 bg-muted/5">Taxas de Origem</td>
              {sorted.map((p, i) => (
                <td key={p.proposal_id} className={cn('px-4 py-2.5 text-muted-foreground', i > 0 && 'border-l')}>
                  {formatMultiCurrency(sumsByProposal[p.proposal_id].origem)}
                </td>
              ))}
            </tr>

            {/* Frete Internacional */}
            <tr className="border-b bg-muted/5">
              <td className="px-4 py-2.5 text-xs text-muted-foreground sticky left-0 bg-muted/5">Frete Internacional</td>
              {sorted.map((p, i) => (
                <td key={p.proposal_id} className={cn('px-4 py-2.5 font-medium', i > 0 && 'border-l', p.freight_value === minFreight && 'text-brand-pink')}>
                  {formatCurrencyCode(p.freight_value, p.freight_currency)}
                </td>
              ))}
            </tr>

            {/* Taxas de Destino */}
            <tr className="border-b bg-muted/5">
              <td className="px-4 py-2.5 text-xs text-muted-foreground sticky left-0 bg-muted/5">Taxas de Destino</td>
              {sorted.map((p, i) => (
                <td key={p.proposal_id} className={cn('px-4 py-2.5 text-muted-foreground', i > 0 && 'border-l')}>
                  {formatMultiCurrency(sumsByProposal[p.proposal_id].destino)}
                </td>
              ))}
            </tr>

            {/* Total ALL IN */}
            <tr className="bg-brand-navy/5">
              <td className="px-4 py-3 text-xs font-bold text-brand-navy uppercase tracking-wide sticky left-0 bg-brand-navy/5">Total ALL IN</td>
              {sorted.map((p, i) => (
                <td key={p.proposal_id} className={cn('px-4 py-3 font-bold text-sm', i > 0 && 'border-l', 'text-foreground')}>
                  {formatMultiCurrency(sumsByProposal[p.proposal_id].total)}
                </td>
              ))}
            </tr>

            {/* Total em BRL (normalizado) */}
            {sorted.some((p) => p.total_brl != null) && (
              <tr className="bg-brand-navy/10 border-t-2 border-brand-navy/20">
                <td className="px-4 py-3 text-xs font-bold text-brand-navy uppercase tracking-wide sticky left-0 bg-brand-navy/10">
                  Total em BRL
                  <span className="block text-[9px] font-normal text-muted-foreground normal-case">aprox. à taxa PTAX</span>
                </td>
                {sorted.map((p, i) => (
                  <td
                    key={p.proposal_id}
                    className={cn(
                      'px-4 py-3 font-bold text-sm',
                      i > 0 && 'border-l',
                      p.is_lowest_cost ? 'text-brand-pink' : 'text-foreground',
                    )}
                  >
                    {formatBRL(p.total_brl)}
                  </td>
                ))}
              </tr>
            )}

            {/* Observacoes */}
            <tr className="border-b">
              <td className="px-4 py-2.5 text-xs text-muted-foreground sticky left-0 bg-background align-top pt-3">Observações</td>
              {sorted.map((p, i) => (
                <td key={p.proposal_id} className={cn('px-4 py-2.5 text-xs text-muted-foreground', i > 0 && 'border-l')}>
                  {p.observations ? <ObservationsCell text={p.observations} /> : '—'}
                </td>
              ))}
            </tr>

            {/* Pontuacao IA */}
            {sorted.some((p) => p.score != null) && (
              <tr className="border-b bg-muted/5">
                <td className="px-4 py-2.5 text-xs font-medium sticky left-0 bg-muted/5">Pontuação IA</td>
                {sorted.map((p, i) => (
                  <td key={p.proposal_id} className={cn('px-4 py-2.5', i > 0 && 'border-l')}>
                    {p.score != null ? (
                      <span
                        className={cn(
                          'text-sm font-semibold tabular-nums',
                          p.score >= 70 ? 'text-brand-pink' : p.score >= 40 ? 'text-brand-gold' : 'text-muted-foreground',
                        )}
                      >
                        {Math.round(p.score)}/100
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                ))}
              </tr>
            )}

            {/* PDFs */}
            <tr className="border-b">
              <td className="px-4 py-2.5 text-xs text-muted-foreground sticky left-0 bg-background align-top pt-3">Documentos</td>
              {sorted.map((p, i) => (
                <td key={p.proposal_id} className={cn('px-4 py-2.5', i > 0 && 'border-l')}>
                  <div className="flex flex-col gap-1.5">
                    {Object.entries(p.pdf_urls).length > 0 ? (
                      Object.entries(p.pdf_urls).map(([filename, url]) => (
                        <Button
                          key={filename}
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1.5 w-fit"
                          onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                        >
                          <Download className="w-3 h-3" />
                          {filename}
                        </Button>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

const OBSERVATIONS_LIMIT = 140;

function ObservationsCell({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  if (text.length <= OBSERVATIONS_LIMIT) return <span>{text}</span>;
  return (
    <div className="flex flex-col gap-1">
      <span>{expanded ? text : `${text.slice(0, OBSERVATIONS_LIMIT)}...`}</span>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center gap-0.5 text-[10px] font-medium text-brand-navy hover:underline w-fit"
      >
        {expanded ? (
          <>Ver menos <ChevronUp className="w-3 h-3" /></>
        ) : (
          <>Ver mais <ChevronDown className="w-3 h-3" /></>
        )}
      </button>
    </div>
  );
}

'use client';

import type { ReactNode } from 'react';
import {
  Award,
  CheckCircle2,
  Clock,
  FileText,
  Ship,
  TrendingDown,
  Trophy,
} from 'lucide-react';
import { Cell, Pie, PieChart } from 'recharts';
import { LoadingState } from '@arboria-tech/arboria-ui';

import { useMyQuotations } from '@/hooks/use-portal-quotations';
import { useMyShipments } from '@/hooks/use-portal-shipments';
import { formatBRL } from '@/lib/portal-formatters';
import { cn } from '@/lib/utils';

import { PagePortalHeader, SectionHeading } from '../_shared/page-header';
import { ProvenanceBadge } from '../_shared/provenance-badge';
import { computePerformanceMetrics } from './lib/performance-helpers';

/**
 * Inteligência — consolidated performance dashboard. The six canvas-question
 * blocks were distributed to the places in the product where they answer a
 * question in context (quotation detail: Confiabilidade/Mercado/Risco/Evidência;
 * embarques: Prazo; the Decisão block is covered by the existing "Recomendação
 * por IA" panel). What remains here is an aggregate read of the client's own
 * performance, derived from the same /portal/quotations and /portal/shipments
 * data already loaded elsewhere — no new endpoint. Every figure is real except
 * the illustrative "Economia estimada", which keeps the preview badge.
 */

// Semantic portal palette (styles/globals.css) as hex, for the recharts fills —
// recharts needs colour strings, not Tailwind classes. Kept in sync with the
// legend's text classes below so the donut and its legend cannot drift.
const STATUS_COLORS = {
  success: '#00B050',
  info: '#2E5CFF',
  danger: '#FF3B30',
  neutral: '#8E8E93',
} as const;

/** Sub-day averages render as "< 1 dia" so a synthetic ~0 gap never reads "0 d". */
function formatResponseTime(days: number | null): string {
  if (days == null) return '—';
  if (days < 1) return '< 1 dia';
  return `${Math.round(days * 10) / 10} d`;
}

function StatTile({
  icon,
  label,
  value,
  caption,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  caption?: string;
}) {
  return (
    <div className="portal-card space-y-2 p-6">
      <div className="flex items-center gap-2 text-portal-neutral">
        {icon}
        <p className="portal-small">{label}</p>
      </div>
      <p className="text-3xl font-semibold leading-none text-foreground">{value}</p>
      {caption ? (
        <p className="portal-small text-portal-neutral">{caption}</p>
      ) : null}
    </div>
  );
}

export default function InteligenciaPage() {
  const { data, isLoading } = useMyQuotations();
  const { total: shipmentsTotal, isLoading: shipmentsLoading } = useMyShipments();
  const m = computePerformanceMetrics(data);

  const totalWins = m.agentWins.reduce((sum, a) => sum + a.wins, 0);
  // A "parceiro mais frequente" only when someone is strictly ahead (or is the
  // sole agent with wins). No badge on a tie — that would overclaim.
  const leader =
    m.agentWins.length > 0 &&
    (m.agentWins.length === 1 || m.agentWins[0].wins > m.agentWins[1].wins)
      ? m.agentWins[0]
      : null;

  const statusBreakdown = [
    { label: 'Aprovadas', count: m.approved, color: STATUS_COLORS.success },
    { label: 'Em andamento', count: m.inProgress, color: STATUS_COLORS.info },
    { label: 'Recusadas', count: m.declined, color: STATUS_COLORS.danger },
    { label: 'Canceladas', count: m.cancelled, color: STATUS_COLORS.neutral },
  ];
  const pieData = statusBreakdown.filter((s) => s.count > 0);

  return (
    <div className="space-y-8">
      <PagePortalHeader
        title="Inteligência"
        subtitle="Performance das suas importações — uma leitura agregada das suas cotações e embarques."
      />

      {/* Legend so the audience reads the two provenance badges correctly. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="inline-flex items-center gap-2">
          <ProvenanceBadge provenance="real" />
          <span className="portal-small text-portal-neutral">
            derivado dos seus dados reais
          </span>
        </span>
        <span className="inline-flex items-center gap-2">
          <ProvenanceBadge provenance="preview" />
          <span className="portal-small text-portal-neutral">
            número ilustrativo, sem base apurada ainda
          </span>
        </span>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : (
        <>
          {/* Real KPI row. */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              icon={<FileText className="h-5 w-5" />}
              label="Volume de cotações"
              value={m.totalQuotations}
              caption="Total no seu histórico"
            />
            <StatTile
              icon={<CheckCircle2 className="h-5 w-5" />}
              label="Taxa de aprovação"
              value={m.approvalRate != null ? `${m.approvalRate}%` : '—'}
              caption="Fechadas sobre fechadas + recusadas"
            />
            <StatTile
              icon={<Clock className="h-5 w-5" />}
              label="Tempo médio de resposta"
              value={formatResponseTime(m.avgResponseDays)}
              caption="Da abertura à primeira proposta"
            />
            <StatTile
              icon={<Ship className="h-5 w-5" />}
              label="Embarques em andamento"
              value={shipmentsLoading ? '—' : shipmentsTotal}
              caption="Em acompanhamento agora"
            />
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-2">
            {/* Real: winning agent per closed quotation, as a proportional bar. */}
            <section className="portal-card space-y-4 p-6">
              <SectionHeading
                title="Cotações vencidas por agente"
                icon={<Trophy className="h-5 w-5" />}
                action={<ProvenanceBadge provenance="real" />}
              />
              {m.agentWins.length === 0 ? (
                <p className="portal-body text-portal-neutral">
                  Nenhuma cotação fechada ainda. A distribuição por agente aparece
                  assim que a primeira cotação é fechada.
                </p>
              ) : (
                <div className="space-y-4">
                  {leader ? (
                    <div className="inline-flex items-center gap-2 rounded-lg border border-portal-success/25 bg-portal-success/10 px-3 py-2">
                      <Award className="h-5 w-5 shrink-0 text-portal-success" />
                      <p className="portal-body text-foreground">
                        <span className="font-semibold">{leader.name}</span> é seu
                        parceiro mais frequente
                      </p>
                    </div>
                  ) : null}
                  <ul className="space-y-3">
                    {m.agentWins.map((a) => {
                      const share = totalWins ? a.wins / totalWins : 0;
                      return (
                        <li key={a.name} className="space-y-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="portal-body min-w-0 truncate font-medium text-foreground">
                              {a.name}
                            </span>
                            <span className="portal-small shrink-0 text-portal-neutral">
                              {a.wins} {a.wins === 1 ? 'cotação' : 'cotações'} ·{' '}
                              {Math.round(share * 100)}%
                            </span>
                          </div>
                          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-portal-success"
                              style={{ width: `${Math.max(share * 100, 3)}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </section>

            {/* Real: quotations by status, as a donut with the counts as legend. */}
            <section className="portal-card space-y-4 p-6">
              <SectionHeading
                title="Cotações por status"
                icon={<FileText className="h-5 w-5" />}
                action={<ProvenanceBadge provenance="real" />}
              />
              {m.totalQuotations === 0 ? (
                <p className="portal-body text-portal-neutral">
                  Nenhuma cotação no histórico ainda.
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-6">
                  {/* Fixed 160x160 PieChart (no ResponsiveContainer): the size is
                      known, so we skip the ResizeObserver measurement, which
                      renders more reliably and avoids a first-paint empty ring. */}
                  <div className="relative h-40 w-40 shrink-0">
                    <PieChart width={160} height={160}>
                      <Pie
                        data={pieData}
                        dataKey="count"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={72}
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {pieData.map((s) => (
                          <Cell key={s.label} fill={s.color} />
                        ))}
                      </Pie>
                    </PieChart>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-semibold leading-none text-foreground">
                        {m.totalQuotations}
                      </span>
                      <span className="portal-small text-portal-neutral">total</span>
                    </div>
                  </div>
                  <ul className="min-w-40 flex-1 space-y-2">
                    {statusBreakdown.map((s) => (
                      <li
                        key={s.label}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                          <span className="portal-body text-foreground">
                            {s.label}
                          </span>
                        </span>
                        <span className="portal-body font-medium text-portal-neutral">
                          {s.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </div>

          {/* Illustrative: no market baseline exists in this prototype. */}
          <section className="flex flex-col gap-4 rounded-xl border border-dashed border-border bg-muted/20 p-6">
            <SectionHeading
              title="Economia estimada"
              icon={<TrendingDown className="h-5 w-5" />}
              action={<ProvenanceBadge provenance="preview" />}
            />
            <div className="space-y-1">
              <p className="text-3xl font-semibold leading-none text-foreground">
                {m.estimatedSavingsBRL != null
                  ? formatBRL(m.estimatedSavingsBRL)
                  : '—'}
              </p>
              <p className="portal-small text-portal-neutral">
                Estimativa ilustrativa sobre suas cotações fechadas
              </p>
            </div>
            <p className="portal-small border-t border-dashed pt-3 text-portal-neutral">
              Ilustrativo. Compara o que você pagou contra um benchmark de setor
              fabricado (8% acima) — não há base de preços de mercado neste
              protótipo, então este número não representa uma economia apurada.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

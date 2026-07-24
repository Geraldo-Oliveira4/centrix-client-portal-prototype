'use client';

import type { ReactNode } from 'react';
import {
  CheckCircle2,
  Clock,
  FileText,
  Ship,
  TrendingDown,
  Trophy,
} from 'lucide-react';
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
  const maxWins = m.agentWins.reduce((max, a) => Math.max(max, a.wins), 0);

  const statusBreakdown = [
    { label: 'Aprovadas', count: m.approved, className: 'text-portal-success' },
    { label: 'Em andamento', count: m.inProgress, className: 'text-portal-info' },
    { label: 'Recusadas', count: m.declined, className: 'text-portal-neutral' },
    { label: 'Canceladas', count: m.cancelled, className: 'text-portal-neutral' },
  ];

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
              value={
                m.avgResponseDays != null ? `${m.avgResponseDays} d` : '—'
              }
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
            {/* Real: winning agent per closed quotation. */}
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
                <ul className="space-y-3">
                  {m.agentWins.map((a) => (
                    <li key={a.name} className="flex items-center gap-3">
                      <span className="portal-body min-w-0 flex-1 truncate text-foreground">
                        {a.name}
                      </span>
                      <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-portal-success"
                          style={{
                            width: `${maxWins ? (a.wins / maxWins) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span className="portal-small w-14 text-right font-medium text-portal-neutral">
                        {a.wins} {a.wins === 1 ? 'cot.' : 'cots.'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Real: quotations by status. */}
            <section className="portal-card space-y-4 p-6">
              <SectionHeading
                title="Cotações por status"
                icon={<FileText className="h-5 w-5" />}
                action={<ProvenanceBadge provenance="real" />}
              />
              <div className="grid grid-cols-2 gap-3">
                {statusBreakdown.map((s) => (
                  <div key={s.label} className="portal-card-muted space-y-1 p-4">
                    <p
                      className={cn(
                        'text-2xl font-semibold leading-none',
                        s.className,
                      )}
                    >
                      {s.count}
                    </p>
                    <p className="portal-small text-portal-neutral">{s.label}</p>
                  </div>
                ))}
              </div>
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

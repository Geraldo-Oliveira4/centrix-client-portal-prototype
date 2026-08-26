'use client';

import { FileText } from 'lucide-react';
import { Cell, Pie, PieChart } from 'recharts';

import { SectionHeading } from '../../../_shared/page-header';
import { ProvenanceBadge } from '../../../_shared/provenance-badge';
import type { PerformanceMetrics } from '../../lib/performance-helpers';

// Semantic portal palette (styles/globals.css) as hex, for the recharts fills —
// recharts needs colour strings, not Tailwind classes. Kept in sync with the
// legend's dots below so the donut and its legend cannot drift.
const STATUS_COLORS = {
  success: '#00B050',
  info: '#2E5CFF',
  danger: '#FF3B30',
  neutral: '#8E8E93',
} as const;

/**
 * REAL — quotations by status, as a donut with the counts as legend. Migrated
 * intact from the old "Visão geral" tab when it merged into Performance.
 *
 * The centre of the donut carries the all-time quotation total; that is why the
 * supporting row above shows "Cotações (30 dias)" instead of a second all-time
 * total, which would be the same number twice on one screen.
 */
export function StatusDonutBlock({ metrics }: { metrics: PerformanceMetrics }) {
  const statusBreakdown = [
    { label: 'Aprovadas', count: metrics.approved, color: STATUS_COLORS.success },
    { label: 'Em andamento', count: metrics.inProgress, color: STATUS_COLORS.info },
    { label: 'Reprovadas', count: metrics.declined, color: STATUS_COLORS.danger },
    { label: 'Canceladas', count: metrics.cancelled, color: STATUS_COLORS.neutral },
  ];
  const pieData = statusBreakdown.filter((s) => s.count > 0);

  return (
    <section className="portal-card space-y-4 p-6">
      <SectionHeading
        title="Cotações por status"
        icon={<FileText className="h-5 w-5" />}
        action={<ProvenanceBadge provenance="real" />}
      />
      {metrics.totalQuotations === 0 ? (
        <p className="portal-body text-portal-neutral">
          Nenhuma cotação no histórico ainda.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-6">
          {/* Fixed 160x160 PieChart (no ResponsiveContainer): the size is known,
              so we skip the ResizeObserver measurement, which renders more
              reliably and avoids a first-paint empty ring. */}
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
                {metrics.totalQuotations}
              </span>
              <span className="portal-small text-portal-neutral">no total</span>
            </div>
          </div>
          <ul className="min-w-40 flex-1 space-y-2">
            {statusBreakdown.map((s) => (
              <li key={s.label} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="portal-body text-foreground">{s.label}</span>
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
  );
}

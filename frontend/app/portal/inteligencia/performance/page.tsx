'use client';

import {
  CheckCircle2,
  Clock,
  FileText,
  Info,
  Ship,
  Timer,
  TrendingUp,
} from 'lucide-react';
import { LoadingState } from '@arboria-tech/arboria-ui';

import { useMyQuotations } from '@/hooks/use-portal-quotations';
import { useMyShipments } from '@/hooks/use-portal-shipments';

import { PagePortalHeader, SectionHeading } from '../../_shared/page-header';
import { ProvenanceBadge } from '../../_shared/provenance-badge';
import { StatNumber } from '../../_shared/stat-number';
import type { Tone } from '../../_shared/tone';
import { flattenQuotations } from '../lib/intel-helpers';
import { computePerformanceMetrics } from '../lib/performance-helpers';
import { volumeTrend, weeklyVolume } from '../lib/volume-helpers';
import { AgentWinsBlock } from './components/agent-wins-block';
import { SavingsBlock } from './components/savings-block';
import { StatusDonutBlock } from './components/status-donut-block';
import { WeeklyVolumeChart } from './components/weekly-volume-chart';

/**
 * Performance — the single "estou indo bem ou não?" dashboard. Quotations and
 * shipments are read side by side here on purpose: they are two halves of the
 * same answer, not two separate lenses. This screen absorbed the old "Visão
 * geral" tab, which covered only the quotation side.
 *
 * Three levels of weight, and only three:
 *   1. Taxa de aprovação (REAL) + On-time rate (no data source -> "Pendente
 *      integração"), equal to each other and dominant over everything else.
 *   2. Supporting counts, deliberately smaller.
 *   3. Visualisations.
 *
 * Data honesty: everything derives from the /portal/quotations and
 * /portal/shipments payloads already loaded elsewhere — no new endpoint. The
 * only fabricated figure is "Economia estimada", which keeps the preview badge
 * and its dashed frame. On-time rate is NEVER fabricated: there is no ETA, no
 * real ship date and no transition history in this prototype.
 *
 * Two rules that keep the merged screen consistent — keep them if you edit it:
 *   - both "volume" tiles use the SAME 30-day window (quotations and shipments),
 *     so the pair can be read against each other;
 *   - the all-time quotation total appears ONCE, in the centre of the donut.
 */

/** Sub-day averages render as "< 1 dia" so a synthetic ~0 gap never reads "0 d". */
function formatResponseTime(days: number | null): string {
  if (days == null) return '—';
  if (days < 1) return '< 1 dia';
  return `${Math.round(days * 10) / 10} d`;
}

function approvalTone(rate: number | null): Tone | undefined {
  if (rate == null) return undefined;
  if (rate >= 70) return 'success';
  if (rate >= 50) return 'warning';
  return 'danger';
}

export default function PerformancePage() {
  const { data, isLoading } = useMyQuotations();
  const {
    shipments,
    total: shipmentsTotal,
    isLoading: shipmentsLoading,
  } = useMyShipments();

  if (isLoading || shipmentsLoading) {
    return <LoadingState spinner message="Carregando performance..." />;
  }

  const m = computePerformanceMetrics(data);
  const quotationTrend = volumeTrend(flattenQuotations(data).map((q) => q.created_at));
  const shipmentDates = shipments.map((s) => s.created_at);
  const shipmentTrend = volumeTrend(shipmentDates);
  const weekly = weeklyVolume(shipmentDates, 8);

  return (
    <div className="space-y-8">
      <PagePortalHeader
        title="Performance"
        subtitle="Cotações e embarques na mesma leitura: como sua operação está indo."
      />

      {/* Legend so the audience reads the provenance badges correctly. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="inline-flex items-center gap-2">
          <ProvenanceBadge provenance="real" />
          <span className="portal-small text-portal-neutral">
            derivado dos seus dados reais
          </span>
        </span>
        <span className="inline-flex items-center gap-2">
          <ProvenanceBadge provenance="pending" />
          <span className="portal-small text-portal-neutral">
            sem fonte de dado ainda — nada é inventado no lugar
          </span>
        </span>
        <span className="inline-flex items-center gap-2">
          <ProvenanceBadge provenance="preview" />
          <span className="portal-small text-portal-neutral">
            número ilustrativo, sem base apurada
          </span>
        </span>
      </div>

      {/* Nível 1 — the pair that answers "estou indo bem?": one from the
          quotation side, one from the shipment side. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatNumber
          size="hero"
          label="Taxa de aprovação"
          icon={<CheckCircle2 className="h-5 w-5" />}
          value={m.approvalRate != null ? `${m.approvalRate}%` : '—'}
          tone={approvalTone(m.approvalRate)}
          badge={<ProvenanceBadge provenance="real" />}
          caption="Cotações fechadas sobre fechadas + recusadas."
        />
        <StatNumber
          size="hero"
          label="On-time rate"
          icon={<Timer className="h-5 w-5" />}
          badge={<ProvenanceBadge provenance="pending" />}
          caption="Embarques no prazo. Depende de ETA e histórico de embarque — ainda não integrado."
        />
      </div>

      {/* Nível 2 — supporting counts, half the weight of the pair above. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatNumber
          size="compact"
          label="Cotações (30 dias)"
          icon={<FileText className="h-4 w-4" />}
          value={quotationTrend.v30}
          delta={
            quotationTrend.deltaPct != null
              ? { pct: quotationTrend.deltaPct, label: 'vs 30 dias anteriores' }
              : null
          }
          caption={
            quotationTrend.deltaPct == null
              ? 'Abertas no período. Sem base anterior para comparar.'
              : 'Abertas no período.'
          }
        />
        <StatNumber
          size="compact"
          label="Tempo médio de resposta"
          icon={<Clock className="h-4 w-4" />}
          value={formatResponseTime(m.avgResponseDays)}
          caption="Da abertura à primeira proposta."
        />
        <StatNumber
          size="compact"
          label="Embarques (30 dias)"
          icon={<Ship className="h-4 w-4" />}
          value={shipmentTrend.v30}
          delta={
            shipmentTrend.deltaPct != null
              ? { pct: shipmentTrend.deltaPct, label: 'vs 30 dias anteriores' }
              : null
          }
          caption={
            shipmentTrend.deltaPct == null
              ? 'Abertos no período. Sem base anterior para comparar.'
              : 'Abertos no período.'
          }
        />
        <StatNumber
          size="compact"
          label="Embarques em andamento"
          icon={<TrendingUp className="h-4 w-4" />}
          value={shipmentsTotal}
          caption="Em acompanhamento agora."
        />
      </div>

      {/* Nível 3 — visualisations. */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <AgentWinsBlock agentWins={m.agentWins} />
        <StatusDonutBlock metrics={m} />
      </div>

      <section className="portal-card space-y-4 p-6">
        <SectionHeading
          title="Volume de embarques por semana"
          hint="embarques abertos"
          action={<ProvenanceBadge provenance="real" />}
        />
        <WeeklyVolumeChart data={weekly} />
        <p className="inline-flex items-center gap-1.5 portal-small text-portal-neutral">
          <Info className="h-3.5 w-3.5" />
          Contagem real por semana de abertura. Filtro por rota fica para uma
          próxima etapa — o embarque ainda não carrega rota real (a origem no mapa
          é ilustrativa).
        </p>
      </section>

      <SavingsBlock estimatedSavingsBRL={m.estimatedSavingsBRL} />
    </div>
  );
}

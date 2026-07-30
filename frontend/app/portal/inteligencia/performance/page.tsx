'use client';

import { Info, Ship, Timer, TrendingUp } from 'lucide-react';
import { LoadingState } from '@arboria-tech/arboria-ui';

import { useMyShipments } from '@/hooks/use-portal-shipments';

import { PagePortalHeader, SectionHeading } from '../../_shared/page-header';
import { ProvenanceBadge } from '../../_shared/provenance-badge';
import { StatNumber } from '../../_shared/stat-number';
import { volumeTrend, weeklyVolume } from '../lib/volume-helpers';
import { WeeklyVolumeChart } from './components/weekly-volume-chart';

/**
 * Dashboard 1 — Performance de Embarques.
 *
 * Data honesty: volume and its month-over-month variação are REAL, derived from
 * the shipments' `created_at` (the only reliable timestamp the portal exposes).
 * On-time rate has NO data source — there is no ETA, no real ship date and no
 * transition history in this prototype — so it is shown as a "Pendente
 * integração" placeholder, never a fabricated percentage.
 */
export default function PerformancePage() {
  const { shipments, total, isLoading } = useMyShipments();

  if (isLoading) return <LoadingState spinner message="Carregando performance..." />;

  const dates = shipments.map((s) => s.created_at);
  const trend = volumeTrend(dates);
  const weekly = weeklyVolume(dates, 8);

  return (
    <div className="space-y-8">
      <PagePortalHeader
        title="Performance de Embarques"
        subtitle="Volume e pontualidade dos seus embarques."
      />

      {/* Big numbers — every real number carries valor + label + variação. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatNumber
          label="On-time rate"
          icon={<Timer className="h-4 w-4" />}
          badge={<ProvenanceBadge provenance="pending" />}
          caption="Depende de ETA e histórico de embarque — ainda não integrado."
        />
        <StatNumber
          label="Volume (30 dias)"
          icon={<Ship className="h-4 w-4" />}
          value={trend.v30}
          delta={
            trend.deltaPct != null
              ? { pct: trend.deltaPct, label: 'vs 30 dias anteriores' }
              : null
          }
          caption={
            trend.deltaPct == null
              ? 'Sem base do período anterior para comparar.'
              : undefined
          }
        />
        <StatNumber
          label="Embarques em andamento"
          icon={<TrendingUp className="h-4 w-4" />}
          value={total}
          caption="Em acompanhamento agora."
        />
      </div>

      {/* Volume por semana — real (created_at). */}
      <section className="portal-card space-y-4 p-6">
        <SectionHeading
          title="Volume por semana"
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
    </div>
  );
}

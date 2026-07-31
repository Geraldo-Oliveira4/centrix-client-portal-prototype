'use client';

import {
  BadgeCheck,
  Clock,
  FileText,
  PiggyBank,
  Ship,
  Timer,
} from 'lucide-react';
import { LoadingState } from '@arboria-tech/arboria-ui';

import { useMyQuotations } from '@/hooks/use-portal-quotations';
import { useMyShipments } from '@/hooks/use-portal-shipments';
import { formatBRL } from '@/lib/portal-formatters';

import { PagePortalHeader } from '../../_shared/page-header';
import { ProvenanceBadge } from '../../_shared/provenance-badge';
import { StatNumber } from '../../_shared/stat-number';
import type { Tone } from '../../_shared/tone';
import { flattenQuotations } from '../lib/intel-helpers';
import { computePerformanceMetrics } from '../lib/performance-helpers';
import { volumeTrend } from '../lib/volume-helpers';

/**
 * Dashboard 3 — Visão Executiva.
 *
 * DRAFT — validar com Victor Orsi antes de considerar fechado, ele é o dono de
 * domínio dessa camada. The KPI set, the semáforo thresholds and which figures
 * belong in an executive view are his call; this is a first cut.
 *
 * PAUTA ABERTA dessa validação: com a "Visão geral" fundida no Performance,
 * cinco dos seis KPIs daqui (taxa de aprovação, tempo de resposta, cotações 30d,
 * embarques 30d, on-time, economia estimada) passaram a existir também lá. Não é
 * duplicação na mesma tela, mas é decisão de produto se o Executivo segue como
 * resumo dos mesmos números ou vira outro recorte — não resolver isso por conta.
 *
 * Data honesty: approval rate, response time, quotation/shipment counts are REAL.
 * Savings is ILLUSTRATIVE (benchmark +8%, no market baseline) and wears the
 * preview badge. On-time rate has no source -> "Pendente integração".
 */

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

function responseTone(days: number | null): Tone | undefined {
  if (days == null) return undefined;
  if (days <= 2) return 'success';
  if (days <= 5) return 'warning';
  return 'danger';
}

export default function ExecutivoPage() {
  const { data, isLoading } = useMyQuotations();
  const { shipments, total: shipmentsTotal, isLoading: shipmentsLoading } =
    useMyShipments();

  if (isLoading || shipmentsLoading) {
    return <LoadingState spinner message="Carregando visão executiva..." />;
  }

  const m = computePerformanceMetrics(data);
  const qTrend = volumeTrend(flattenQuotations(data).map((q) => q.created_at));
  const sTrend = volumeTrend(shipments.map((s) => s.created_at));

  return (
    <div className="space-y-8">
      <PagePortalHeader
        title="Visão Executiva"
        subtitle="Leitura macro da sua operação — visão consolidada."
        action={
          <span className="portal-small inline-flex items-center gap-1.5 rounded border border-portal-warning/30 bg-portal-warning/10 px-2 py-0.5 font-medium text-portal-warning">
            <BadgeCheck className="h-3.5 w-3.5" />
            Rascunho · Em validação
          </span>
        }
      />

      {/* Draft banner — this camada belongs to Victor Orsi (domain owner). */}
      <div className="rounded-lg border border-dashed border-portal-warning/40 bg-portal-warning/5 px-4 py-3">
        <p className="portal-small text-foreground/80">
          <span className="font-medium">Rascunho.</span> Conjunto de KPIs, limites do
          semáforo e recorte executivo ainda em validação com o time de produto —
          não considerar como versão final.
        </p>
      </div>

      {/* 6 KPIs macro: semáforo (cor do valor) + tendência onde há base real. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatNumber
          label="Taxa de aprovação"
          icon={<BadgeCheck className="h-4 w-4" />}
          value={m.approvalRate != null ? `${m.approvalRate}%` : '—'}
          tone={approvalTone(m.approvalRate)}
          caption="Fechadas / (fechadas + recusadas)."
        />
        <StatNumber
          label="Tempo médio de resposta"
          icon={<Clock className="h-4 w-4" />}
          value={formatResponseTime(m.avgResponseDays)}
          tone={responseTone(m.avgResponseDays)}
          caption="Abertura → primeira proposta."
        />
        <StatNumber
          label="Cotações (30 dias)"
          icon={<FileText className="h-4 w-4" />}
          value={qTrend.v30}
          tone="info"
          delta={
            qTrend.deltaPct != null
              ? { pct: qTrend.deltaPct, label: 'vs mês anterior' }
              : null
          }
          caption={qTrend.deltaPct == null ? 'Sem base do período anterior.' : undefined}
        />
        <StatNumber
          label="Embarques (30 dias)"
          icon={<Ship className="h-4 w-4" />}
          value={sTrend.v30}
          delta={
            sTrend.deltaPct != null
              ? { pct: sTrend.deltaPct, label: 'vs mês anterior' }
              : null
          }
          caption={`${shipmentsTotal} em acompanhamento no total.`}
        />
        <StatNumber
          label="On-time rate"
          icon={<Timer className="h-4 w-4" />}
          badge={<ProvenanceBadge provenance="pending" />}
          caption="Sem fonte de ETA/embarque integrada."
        />
        <StatNumber
          label="Economia estimada"
          icon={<PiggyBank className="h-4 w-4" />}
          badge={<ProvenanceBadge provenance="preview" />}
          value={m.estimatedSavingsBRL != null ? formatBRL(m.estimatedSavingsBRL) : '—'}
          caption="Benchmark ilustrativo (+8%) — sem base de preço de mercado."
        />
      </div>
    </div>
  );
}

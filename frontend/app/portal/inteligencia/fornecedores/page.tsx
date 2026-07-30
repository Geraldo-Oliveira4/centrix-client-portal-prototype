'use client';

import { Wrench } from 'lucide-react';

import { PagePortalHeader } from '../../_shared/page-header';

/**
 * Dashboard 2 — Fornecedores / Agentes. DELIBERATELY NOT IMPLEMENTED.
 *
 * Blocked pending a methodology fix on the agent score: it must move from a
 * cumulative counter to an error rate over a moving window. Rendering a ranking
 * or score with the current logic would expose a methodologically wrong number
 * to the client.
 *
 * This repo already had a case of a numeric AI/agent score exposed improperly
 * (quotation-card, recommendation-view, reliability-block — fixed in commit
 * 20fb493). Do NOT reintroduce that pattern here: no ranking, no per-agent score,
 * no "reliability %". Only this placeholder until the methodology is corrected.
 */
export default function FornecedoresPage() {
  return (
    <div className="space-y-8">
      <PagePortalHeader
        title="Fornecedores e Agentes"
        subtitle="Desempenho dos parceiros de frete."
      />

      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-muted/20 p-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-portal-neutral">
          <Wrench className="h-6 w-6" />
        </span>
        <div className="space-y-1">
          <p className="portal-h3 text-foreground">Painel em recalibração</p>
          <p className="portal-body mx-auto max-w-md text-portal-neutral">
            Este painel está sendo recalibrado e será liberado em breve. A
            metodologia do score de agentes está sendo ajustada para refletir
            desempenho de forma justa antes de exibir qualquer ranking.
          </p>
        </div>
        <span className="portal-small inline-flex items-center gap-1.5 rounded border border-border bg-muted px-2 py-0.5 font-medium text-portal-neutral">
          Em recalibração
        </span>
      </div>
    </div>
  );
}

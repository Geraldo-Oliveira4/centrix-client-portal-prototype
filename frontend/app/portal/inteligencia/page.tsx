'use client';

import { PagePortalHeader } from '../_shared/page-header';
import { ProvenanceBadge } from '../_shared/provenance-badge';
import { DecisionBlock } from './components/decision-block';
import { ReliabilityBlock } from './components/reliability-block';
import { MarketBlock } from './components/market-block';
import { RiskBlock } from './components/risk-block';
import { DeadlineBlock } from './components/deadline-block';
import { EvidenceBlock } from './components/evidence-block';

/**
 * Inteligência — the six questions the product's Business Model Canvas says the
 * portal must answer for the client. Each block declares whether what it shows
 * is real data or an illustrative preview, following the same honesty discipline
 * already applied to Auditoria and Tracking. See each block for its provenance.
 */
export default function InteligenciaPage() {
  return (
    <div className="space-y-8">
      <PagePortalHeader
        title="Inteligência"
        subtitle="Seis perguntas que o Portal ajuda a responder sobre suas importações."
      />

      {/* Legend so the audience reads the two provenance badges correctly. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="inline-flex items-center gap-2">
          <ProvenanceBadge provenance="real" />
          <span className="portal-small text-portal-neutral">
            valor com lastro em dados reais
          </span>
        </span>
        <span className="inline-flex items-center gap-2">
          <ProvenanceBadge provenance="preview" />
          <span className="portal-small text-portal-neutral">
            número ilustrativo, sem dado apurado ainda
          </span>
        </span>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <DecisionBlock />
        <ReliabilityBlock />
        <MarketBlock />
        <RiskBlock />
        <DeadlineBlock />
        <EvidenceBlock />
      </div>
    </div>
  );
}

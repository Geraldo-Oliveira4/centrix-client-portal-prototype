'use client';

import { formatBRL, formatCurrency, formatDate } from '@/lib/portal-formatters';
import type { PortalProposal } from '@/types/portal';

export function ProposalDetailsCard({ proposal }: { proposal: PortalProposal }) {
  return (
    <section className="portal-card-muted p-6">
      <h2 className="portal-h3 mb-4 text-foreground">
        Detalhes — {proposal.agent?.name ?? '—'}
      </h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="portal-small text-portal-neutral">Frete</p>
          <p className="portal-body font-medium">{formatCurrency(proposal.freight_value)}</p>
        </div>
        <div>
          <p className="portal-small text-portal-neutral">Total</p>
          <p className="portal-body font-semibold">{formatBRL(proposal.total_brl)}</p>
        </div>
        <div>
          <p className="portal-small text-portal-neutral">Transit Time</p>
          <p className="portal-body font-medium">{proposal.transit_time} dias</p>
        </div>
        <div>
          <p className="portal-small text-portal-neutral">Validade</p>
          <p className="portal-body font-medium">{formatDate(proposal.validity)}</p>
        </div>
        {proposal.frequencia ? (
          <div className="col-span-2">
            <p className="portal-small text-portal-neutral">Frequência</p>
            <p className="portal-body font-medium">{proposal.frequencia}</p>
          </div>
        ) : null}
        {proposal.observations ? (
          <div className="col-span-2">
            <p className="portal-small text-portal-neutral">Observações</p>
            <p className="text-sm">{proposal.observations}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

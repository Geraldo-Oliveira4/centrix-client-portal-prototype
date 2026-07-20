'use client';

import { formatBRL, formatCurrency, formatDate } from '@/lib/portal-formatters';
import type { PortalProposal } from '@/types/portal';

export function ProposalDetailsCard({ proposal }: { proposal: PortalProposal }) {
  return (
    <section className="rounded-md border bg-background p-4">
      <h3 className="text-base font-semibold mb-3">
        Detalhes — {proposal.agent?.name ?? '—'}
      </h3>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Frete</p>
          <p className="font-medium">{formatCurrency(proposal.freight_value)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="font-semibold">{formatBRL(proposal.total_brl)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Transit Time</p>
          <p className="font-medium">{proposal.transit_time} dias</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Validade</p>
          <p className="font-medium">{formatDate(proposal.validity)}</p>
        </div>
        {proposal.frequencia ? (
          <div className="col-span-2">
            <p className="text-xs text-muted-foreground">Frequência</p>
            <p className="font-medium">{proposal.frequencia}</p>
          </div>
        ) : null}
        {proposal.observations ? (
          <div className="col-span-2">
            <p className="text-xs text-muted-foreground">Observações</p>
            <p className="text-sm">{proposal.observations}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

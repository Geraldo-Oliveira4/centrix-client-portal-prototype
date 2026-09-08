'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { compareByCheapestTotal, formatBRL, formatCurrencyCode } from '@/lib/portal-formatters';
import type { ClientPortalProposal } from '@/types/quotation';
import { ValidadeStatusBadge } from './validade-status-badge';
import { LowestCostBadge, LowestTransitBadge } from './comparison-badges';

interface ProposalApprovalSectionProps {
  proposals: ClientPortalProposal[];
  token: string;
  apiUrl: string;
  onApproved: (agentName: string) => void;
}

export function ProposalApprovalSection({
  proposals,
  token,
  apiUrl,
  onApproved,
}: ProposalApprovalSectionProps) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const latest = proposals.filter((p) => p.proposal_id);
  // Expired proposals stay in the list with an alert.
  const sorted = [...latest].sort(compareByCheapestTotal);

  const handleApprove = async (proposal: ClientPortalProposal) => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/public/cotacao/approve?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal_id: proposal.proposal_id }),
      });
      if (res.ok) {
        onApproved(proposal.agent_name);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? 'Erro ao aprovar proposta. Tente novamente.');
      }
    } catch {
      alert('Erro ao aprovar proposta. Verifique sua conexao e tente novamente.');
    } finally {
      setLoading(false);
      setConfirming(null);
    }
  };

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="bg-brand-navy px-4 py-3">
        <p className="text-xs font-semibold text-white/90 uppercase tracking-wide">
          Aprovacao de Proposta
        </p>
      </div>
      <div className="p-4 flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Selecione a proposta que deseja aprovar. Apos a aprovacao, nossa equipe sera notificada
          e entrara em contato para dar continuidade ao processo.
        </p>

        <div className="flex flex-col gap-2">
          {sorted.map((proposal) => (
            <div
              key={proposal.proposal_id}
              className={cn(
                'flex items-center justify-between gap-3 rounded-lg border px-4 py-3',
                proposal.is_recommended
                  ? 'border-brand-orange-500 bg-brand-orange-50'
                  : 'border-border',
              )}
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{proposal.agent_name}</span>
                  {proposal.is_recommended && (
                    <span className="text-[10px] font-semibold bg-brand-orange-100 text-brand-orange-800 px-1.5 py-0.5 rounded">
                      Recomendada
                    </span>
                  )}
                  {proposal.is_lowest_cost && <LowestCostBadge />}
                  {proposal.is_lowest_transit && <LowestTransitBadge />}
                  <ValidadeStatusBadge status={proposal.validade_status} />
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatCurrencyCode(proposal.total_value, proposal.freight_currency)}
                  {proposal.total_brl != null && (
                    <span className="font-medium text-foreground"> · {formatBRL(proposal.total_brl)}</span>
                  )}
                  {' · '}
                  {proposal.transit_time} dias
                </span>
              </div>

              {confirming === proposal.proposal_id ? (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">Confirmar?</span>
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-brand-orange-500 hover:bg-brand-orange-400 text-brand-navy border-0"
                    disabled={loading}
                    onClick={() => handleApprove(proposal)}
                  >
                    {loading ? 'Aprovando...' : 'Sim, aprovar'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={loading}
                    onClick={() => setConfirming(null)}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant={proposal.is_recommended ? 'default' : 'outline'}
                  className={cn(
                    'h-8 text-xs shrink-0',
                    proposal.is_recommended
                      ? 'bg-brand-orange-500 hover:bg-brand-orange-400 text-brand-navy border-0'
                      : 'border-brand-indigo text-brand-indigo hover:bg-brand-indigo-100',
                  )}
                  onClick={() => setConfirming(proposal.proposal_id)}
                >
                  Aprovar
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ApprovalSuccessBannerProps {
  agentName: string;
}

export function ApprovalSuccessBanner({ agentName }: ApprovalSuccessBannerProps) {
  return (
    <div className="rounded-lg border border-brand-indigo-800/30 bg-brand-indigo-100 p-5 flex items-start gap-3">
      <CheckCircle2 className="w-6 h-6 text-brand-indigo shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-brand-indigo">
          Proposta aprovada com sucesso!
        </p>
        <p className="text-sm text-brand-indigo/80 mt-0.5">
          Voce aprovou a proposta do agente <strong>{agentName}</strong>. Nossa equipe foi
          notificada e entrara em contato em breve para dar continuidade ao processo.
        </p>
      </div>
    </div>
  );
}

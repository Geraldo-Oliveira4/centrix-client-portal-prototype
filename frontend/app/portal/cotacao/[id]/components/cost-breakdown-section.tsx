'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { PortalProposal } from '@/types/portal';

import { AdditionalCostsCard } from './additional-costs-card';
import { ProposalDetailsCard } from './proposal-details-card';

/**
 * Composição de custos da proposta selecionada — RECOLHIDA por padrão
 * (feedback do Vinicius, 27/08/2026: "hierarquia errada").
 *
 * Frete, Total, Transit time e Validade já estão na tabela de propostas logo
 * acima, lado a lado com as concorrentes, que é onde a comparação acontece.
 * Repeti-los abertos no fim da tela dava a esses números o mesmo peso visual da
 * comparação sem acrescentar informação nova — e empurrava para baixo o que o
 * cliente veio decidir. Aberto por clique eles seguem inteiros; o que muda é
 * quem chega neles por vontade própria.
 *
 * Não vira accordion genérico nem some: os "Possíveis Custos Adicionais" são a
 * única parte desta seção que a tabela NÃO mostra, e é ela que justifica o
 * rótulo falar em composição, não em "detalhes".
 */
export function CostBreakdownSection({
  proposal,
}: {
  proposal: PortalProposal;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <section className="space-y-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="portal-body inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
      >
        <ChevronDown
          className={cn('h-4 w-4 transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
        {open ? 'Ocultar composição de custos' : 'Ver composição de custos'}
      </button>

      {open ? (
        <div id={panelId} className="grid gap-6 md:grid-cols-2">
          <ProposalDetailsCard proposal={proposal} />
          {proposal.additional_costs ? (
            <AdditionalCostsCard items={proposal.additional_costs} />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

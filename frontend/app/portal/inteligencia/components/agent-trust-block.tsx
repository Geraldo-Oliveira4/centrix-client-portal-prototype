'use client';

import { ShieldCheck } from 'lucide-react';

import type { PortalProposal, PortalQuotation } from '@/types/portal';

import { IntelBlock, IntelSubBlock } from './intel-block';
import { ReliabilityBody, reliabilityFootnote } from './reliability-block';
import { EvidenceBody, evidenceFootnote, useEvidence } from './evidence-block';

/**
 * Confiabilidade + Evidência num card só (27/08/2026, feedback do Vinicius).
 *
 * As duas respondem a MESMA pergunta — "posso confiar nesse agente?" — em
 * níveis de certeza diferentes, e separadas na tela nenhuma das duas dizia por
 * que existia: a Confiabilidade era um rótulo sem prova, a Evidência era uma
 * prova sem pergunta. Juntas a leitura fecha: primeiro o perfil ilustrativo,
 * logo abaixo o que de fato já aconteceu com aquele agente.
 *
 * A PROVENIÊNCIA NÃO SE MISTURA. Este é o único card do portal sem selo no
 * topo, e é de propósito: um selo ali teria de mentir sobre uma das metades.
 * Cada `IntelSubBlock` carrega o seu — a metade ilustrativa mantém a moldura
 * tracejada e o "Pré-visualização", a metade real fica na superfície limpa com
 * o "Dado real". Não promova este card a um selo único; a regra do módulo (nada
 * real veste o selo de preview, nada fabricado aparece sem ele) vale dentro
 * dele.
 */
export function AgentTrustBlock({
  quotation,
  proposals,
}: {
  quotation: PortalQuotation;
  proposals: PortalProposal[];
}) {
  const evidence = useEvidence(quotation);

  return (
    <IntelBlock
      icon={<ShieldCheck className="h-5 w-5" />}
      title="Confiabilidade"
      question="Esse agente é confiável e previsível?"
      className="h-full"
    >
      <div className="flex h-full flex-col gap-4">
        <IntelSubBlock
          provenance="preview"
          footnote={reliabilityFootnote(proposals)}
        >
          <ReliabilityBody proposals={proposals} />
        </IntelSubBlock>

        <IntelSubBlock
          title="O que já vimos com esse agente"
          provenance="real"
          footnote={evidenceFootnote(evidence.scope, evidence.modalLabel)}
          className="flex-1"
        >
          <EvidenceBody
            isLoading={evidence.isLoading}
            matches={evidence.matches}
            headline={evidence.headline}
          />
        </IntelSubBlock>
      </div>
    </IntelBlock>
  );
}

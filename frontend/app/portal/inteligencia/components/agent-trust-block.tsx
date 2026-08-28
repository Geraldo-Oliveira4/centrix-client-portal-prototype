'use client';

import { ShieldCheck } from 'lucide-react';

import type { PortalProposal, PortalQuotation } from '@/types/portal';

import { SHOW_PROPOSAL_PROVENANCE } from '../lib/proposal-provenance';
import { IntelBlock, IntelSubBlock } from './intel-block';
import { ReliabilityBody } from './reliability-block';
import { EvidenceBody, evidenceFootnote, useEvidence } from './evidence-block';

/**
 * Confiabilidade + Evidência num card só (27/08/2026, feedback do Vinicius).
 *
 * As duas respondem a MESMA pergunta — "posso confiar nesse agente?" — em
 * níveis de certeza diferentes, e separadas na tela nenhuma das duas dizia por
 * que existia: a Confiabilidade era um rótulo sem prova, a Evidência era uma
 * prova sem pergunta. Juntas a leitura fecha: primeiro o perfil do agente,
 * logo abaixo o que de fato já aconteceu com ele.
 *
 * A proveniência (real x ilustrativo) deixou de ser marcada nas duas metades em
 * 28/08/2026 — ver `lib/proposal-provenance.ts`. As metades continuam sendo
 * `IntelSubBlock` distintos: a composição é de LEITURA (perfil primeiro, prova
 * depois) e vale independentemente do selo. Se o flag voltar a `true`, cada
 * metade volta a carregar o selo dela, e nunca um selo único no topo do card —
 * ele teria de mentir sobre uma das duas.
 *
 * `justify-center` só age quando este card é o MAIS BAIXO do par (cliente sem
 * histórico de embarque, uma proposta só): aí o grid o estica na altura do
 * Mercado e sem isto o conteúdo ficaria grudado no topo. No caso comum, em que
 * este card é o mais alto, não sobra folga e o efeito é nulo.
 */
export function AgentTrustBlock({
  quotation,
  proposals,
}: {
  quotation: PortalQuotation;
  proposals: PortalProposal[];
}) {
  const evidence = useEvidence(quotation);
  const provenance = SHOW_PROPOSAL_PROVENANCE ? 'preview' : undefined;
  const realProvenance = SHOW_PROPOSAL_PROVENANCE ? 'real' : undefined;

  return (
    <IntelBlock
      icon={<ShieldCheck className="h-5 w-5" />}
      title="Confiabilidade"
      question="Esse agente é confiável e previsível?"
      className="h-full"
    >
      <div className="flex h-full flex-col justify-center gap-4">
        <IntelSubBlock provenance={provenance}>
          <ReliabilityBody proposals={proposals} />
        </IntelSubBlock>

        <IntelSubBlock
          title="O que já vimos com esse agente"
          provenance={realProvenance}
          footnote={evidenceFootnote(evidence.scope, evidence.modalLabel)}
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

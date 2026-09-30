'use client';

// Monta a autorresposta da Cotação V2 no layout do portal.
//
// Componente sem saída visual: ele existe só para que o hook tenha onde viver
// fora do painel de demonstração. Separado de `use-v2-auto-advance.ts` porque o
// hook precisa das propostas de cada cotação, e é aqui que a chave SWR que o
// portal já usa (`/portal/quotations`, deduplicada — não é fetch a mais) vira o
// mapa que ele espera.

import { useMemo } from 'react';

import { useMyQuotations } from '@/hooks/use-portal-quotations';

import {
  effectiveProposals,
  releasableProposalIds,
} from './quotation-demo-proposals';
import { quotationHardblocks } from './quotation-hardblocks';
import { useQuotationReviewStore } from './use-quotation-review';
import {
  useV2AutoAdvance,
  type ProposalIdsByQuotation,
} from './use-v2-auto-advance';

export function PortalV2AutoAdvance() {
  const { data } = useMyQuotations();

  // Só as propostas COM preço: a revisão de saída automática libera o que o
  // cliente consegue comparar, e uma proposta sem valor abriria a comparação
  // com uma linha vazia.
  //
  // `effectiveProposals` cai nas propostas de DEMONSTRAÇÃO quando o payload não
  // tem nenhuma — é o que impede uma cotação recém-aberta pelo portal (que
  // nasce sem proposta nenhuma e nunca ganha uma) de travar para sempre na
  // revisão de saída. Propostas reais, quando existem, ganham sempre.
  const proposalIds = useMemo<ProposalIdsByQuotation>(() => {
    const map: ProposalIdsByQuotation = {};
    for (const rows of Object.values(data?.buckets ?? {})) {
      for (const q of rows) {
        map[q.id] = releasableProposalIds(effectiveProposals(q));
      }
    }
    return map;
  }, [data]);

  // As cotacoes que a lista do Orsi bloqueia. A Freitas automatica nao aprova
  // a entrada nem libera propostas delas — a mesma regra dos botoes do painel.
  const reviews = useQuotationReviewStore();
  const blocked = useMemo(() => {
    const ids = new Set<string>();
    for (const rows of Object.values(data?.buckets ?? {})) {
      for (const q of rows) {
        const review = reviews[q.id];
        if (!review) continue;
        if (quotationHardblocks(review.submittedForm, q).blocks.length > 0) {
          ids.add(q.id);
        }
      }
    }
    return ids;
  }, [data, reviews]);

  useV2AutoAdvance(proposalIds, blocked);
  return null;
}

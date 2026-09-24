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

import { useV2AutoAdvance, type ProposalIdsByQuotation } from './use-v2-auto-advance';

export function PortalV2AutoAdvance() {
  const { data } = useMyQuotations();

  // Só as propostas COM preço: a revisão de saída automática libera o que o
  // cliente consegue comparar, e uma proposta sem valor abriria a comparação
  // com uma linha vazia.
  const proposalIds = useMemo<ProposalIdsByQuotation>(() => {
    const map: ProposalIdsByQuotation = {};
    for (const rows of Object.values(data?.buckets ?? {})) {
      for (const q of rows) {
        map[q.id] = (q.proposals ?? [])
          .filter((p) => Number.isFinite(p.total_brl) && p.total_brl > 0)
          .map((p) => p.id);
      }
    }
    return map;
  }, [data]);

  useV2AutoAdvance(proposalIds);
  return null;
}

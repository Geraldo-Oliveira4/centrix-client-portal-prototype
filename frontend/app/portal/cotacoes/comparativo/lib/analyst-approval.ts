// "Analista aprovou a recomendação" — o portão do comparativo (06/10/2026).
//
// Regra do Mauro: a Recomendação IA só aparece para o cliente depois que o
// analista da Freitas a aprova. Não existe analista neste protótipo; quem
// aprova é o painel de demonstração, e SÓ no build interno (Preview,
// NEXT_PUBLIC_PROTO_INTERNAL=1). Em produção não há chave nenhuma: a
// recomendação fica sempre "em revisão", que é o estado correto de um portal
// sem analista por trás.
//
// PURO (sem `@/`): o parser roda sob `node --test`.

import { decodeDemoValue } from '../../../_shared/demo/demo-store.ts';

/** Entrada do store de demonstração (prefixo `centrix-proto-v2:`). */
export const ANALYST_APPROVAL_STORE_NAME = 'comparativo-analyst-approved';

/** Padrão DESLIGADO: sem aprovação, nada de nota na tela. */
export function parseAnalystApproval(raw: string | null): boolean {
  return decodeDemoValue(raw, false, (parsed) => parsed === true);
}

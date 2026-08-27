// Síntese do bloco "Evidência" da tela de cotação.
//
// POR QUE ESTE ARQUIVO EXISTE (revisão de 27/08/2026, feedback do Vinicius)
// -------------------------------------------------------------------------
// O bloco listava embarques passados (código + estado) e parava aí: o cliente
// via uma lista crua e não sabia o que ela dizia sobre a decisão que ele está
// tomando. A lista sem conclusão não é evidência, é dado bruto.
//
// A conclusão precisa ser VERDADEIRA com o dado que existe, e o que existe é
// pouco:
//
//  - `estado` do embarque é real (coluna do GE, escrita pelo fluxo de
//    aprovação). É a única coisa aqui sobre a qual dá para concluir.
//  - pontualidade NÃO entra. Ela sairia de `tracking_*`, que hoje ou é NULL ou
//    é o top-up de demonstração com `is_mock = true` — concluir "todos
//    chegaram no prazo" em cima disso seria fabricar a conclusão, e o bloco
//    perderia o selo "Dado real" que hoje ostenta com razão.
//  - não existe tabela de transições de embarque neste repositório, então
//    `estado` é a situação de AGORA, não o que aconteceu no caminho. Por isso
//    a frase fala em ocorrência "em aberto", no presente, e nunca em "correu
//    tudo bem do início ao fim" — que seria afirmação sem lastro.
//
// A semelhança continua grossa (agente + modal), como já era, e o rodapé do
// bloco diz isso. O que mudou foi passar a ENCERRAR a leitura com uma frase,
// não passar a saber mais do que se sabia.

import type { PortalShipment } from '../../../../types/portal-shipment.ts';
// Import relativo COM extensão, não pelo alias `@/`: este módulo roda no runner
// nativo do Node (`npm run test:unit`). Mesma razão de `shipment-filters.ts`.
// `isExceptionState` é VALOR, então não dá para trazê-lo por `import type`.
import { isExceptionState } from '../../../../types/portal-shipment.ts';

/**
 * Quantos embarques entram na leitura. O MESMO número é analisado e exibido —
 * se a frase disser "últimos 3" e a lista mostrar outra quantidade, o cliente
 * não consegue conferir a conta, e uma conclusão que não se confere vale menos
 * do que nenhuma.
 */
export const EVIDENCE_WINDOW = 3;

/** De onde saiu a amostra — determina o recorte que a frase anuncia. */
export type EvidenceScope =
  /** Mesmo agente e mesmo modal desta cotação. */
  | 'agent_modal'
  /** Mesmo modal, qualquer agente. */
  | 'modal'
  /** Nenhum dos dois casou; caiu para os embarques mais recentes. */
  | 'any';

export interface EvidenceSummary {
  scope: EvidenceScope;
  /** Os embarques analisados, mais recentes primeiro. É a mesma lista exibida. */
  matches: PortalShipment[];
  /** Quantos de `matches` estão hoje em estado de exceção. */
  exceptions: number;
  /** Conclusão pronta para renderizar. Null quando não há o que concluir. */
  headline: string | null;
}

interface EvidenceInput {
  shipments: PortalShipment[];
  /** Embarque desta cotação — nunca serve de evidência para ela mesma. */
  excludeQuotationId?: string | null;
  modal?: string | null;
  /** Agente da proposta que o cliente está olhando (vencedora/recomendada). */
  agentName?: string | null;
  /** Rótulo do modal já traduzido, para a frase ("Marítimo", "Aéreo"). */
  modalLabel?: string | null;
}

/** Mais recente primeiro, por `created_at`. Data inválida vai para o fim. */
function byRecency(a: PortalShipment, b: PortalShipment): number {
  const ta = Date.parse(a.created_at ?? '');
  const tb = Date.parse(b.created_at ?? '');
  if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
  if (Number.isNaN(ta)) return 1;
  if (Number.isNaN(tb)) return -1;
  return tb - ta;
}

function scopeQualifier(
  scope: EvidenceScope,
  agentName: string | null | undefined,
  modalLabel: string | null | undefined,
): string {
  if (scope === 'agent_modal' && agentName && modalLabel) {
    return ` com ${agentName} em ${modalLabel.toLowerCase()}`;
  }
  if (scope === 'modal' && modalLabel) return ` em ${modalLabel.toLowerCase()}`;
  return '';
}

/**
 * Escolhe a amostra mais parecida que existir e conclui sobre ela.
 *
 * A cascata é agente+modal -> modal -> qualquer: um recorte mais estreito é
 * mais relevante para a decisão, mas quase sempre está vazio num cliente novo,
 * e um bloco vazio não ajuda ninguém. O `scope` devolvido é o que permite a UI
 * dizer QUAL recorte foi usado em vez de sugerir precisão que não houve.
 */
export function summarizeEvidence(input: EvidenceInput): EvidenceSummary {
  const { shipments, excludeQuotationId, modal, agentName, modalLabel } = input;

  const others = shipments
    .filter((s) => !excludeQuotationId || s.quotation_id !== excludeQuotationId)
    .sort(byRecency);

  const sameModal = modal ? others.filter((s) => s.modal === modal) : [];
  const sameAgentAndModal = agentName
    ? sameModal.filter((s) => s.agente_nome === agentName)
    : [];

  let scope: EvidenceScope = 'any';
  let pool = others;
  if (sameAgentAndModal.length > 0) {
    scope = 'agent_modal';
    pool = sameAgentAndModal;
  } else if (sameModal.length > 0) {
    scope = 'modal';
    pool = sameModal;
  }

  const matches = pool.slice(0, EVIDENCE_WINDOW);
  const exceptions = matches.filter((s) => isExceptionState(s.estado)).length;

  return {
    scope,
    matches,
    exceptions,
    headline: buildHeadline(
      matches.length,
      exceptions,
      scopeQualifier(scope, agentName, modalLabel),
    ),
  };
}

/**
 * A frase. Só afirma duas coisas, e as duas são verificáveis na lista logo
 * abaixo dela: quantos embarques foram olhados e quantos estão em exceção.
 */
function buildHeadline(
  total: number,
  exceptions: number,
  qualifier: string,
): string | null {
  if (total === 0) return null;

  if (total === 1) {
    return exceptions === 0
      ? `No seu último embarque${qualifier}, não há ocorrência em aberto.`
      : `No seu último embarque${qualifier}, há uma ocorrência em aberto.`;
  }

  const prefix = `Nos seus últimos ${total} embarques${qualifier}`;
  if (exceptions === 0) {
    return `${prefix}, nenhum tem ocorrência em aberto.`;
  }
  if (exceptions === 1) {
    return `${prefix}, 1 tem ocorrência em aberto.`;
  }
  return `${prefix}, ${exceptions} têm ocorrência em aberto.`;
}

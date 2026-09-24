// O embarque que nasce de uma proposta aprovada (RQ-18), SIMULADO.
//
// PURE, sem o alias `@/`: roda sob `npm run test:unit`.
//
// POR QUE ISTO EXISTE. No caminho REAL, aprovar uma proposta chama
// `approveProposal` na API; o backend fecha a cotação e o
// `quotation_state_machine` provisiona Processo + Embarque de verdade. Esse
// caminho continua intocado.
//
// O problema é a cotação que o cliente abre durante a demonstração: ela nasce
// sem proposta nenhuma e nunca ganha uma (o e-mail do RFQ é um log), então quem
// ela compara são as propostas ilustrativas do Prompt 2 — cujos ids não existem
// no backend. Aprovar uma delas daria 404. Sem isto, a jornada "nova cotação ->
// embarque" não tinha fim.
//
// NADA É FABRICADO AQUI. Rota, agente e preço saem da cotação e da proposta que
// o cliente escolheu; o embarque guarda `linkedQuotationId`, e é por causa dele
// que `poRouteLabel` devolve `null` e a tela resolve a rota pela COTAÇÃO, como
// faz com qualquer outro embarque — em vez de cair no hub ilustrativo.

import {
  createDraft,
  type PoItem,
  type ShipmentPoReview,
} from './shipment-po-review.ts';

/** O mínimo que este módulo precisa saber de uma cotação. */
export interface ApprovalQuotation {
  id: string;
  reference: string;
  product?: string | null;
  client_reference?: string | null;
  exporter_name?: string | null;
  incoterm?: string | null;
  modal?: string | null;
  tipo_embarque?: string | null;
}

/** E de uma proposta. */
export interface ApprovalProposal {
  id: string;
  agent?: { name?: string | null } | null;
  total_brl?: number | null;
  transit_time?: number | null;
}

function modalOf(value: string | null | undefined) {
  return value === 'MARITIMO' || value === 'AEREO' || value === 'RODOVIARIO'
    ? value
    : '';
}

function tipoOf(value: string | null | undefined) {
  return value === 'FCL' || value === 'LCL' ? value : '';
}

/**
 * O único item do embarque: a mercadoria da cotação.
 *
 * Sem SKU, sem quantidade e sem peso — a cotação não os tem, e inventá-los aqui
 * seria exatamente o que o resto desta camada evita. O que ela tem é a
 * descrição da carga, e é ela que nomeia o embarque na carteira.
 */
function itemFromQuotation(quotation: ApprovalQuotation): PoItem[] {
  const description = quotation.product?.trim();
  if (!description) return [];
  return [
    {
      id: `cot-item:${quotation.id}`,
      partNumber: '',
      description,
      currency: '',
      quantity: null,
      unitValue: null,
      netWeightKg: null,
      totalValue: null,
      grossWeightKg: null,
    },
  ];
}

/**
 * O embarque ATIVO que a aprovação cria.
 *
 * Já nasce `active`: quem aprovou foi o cliente, sobre propostas que a Freitas
 * tinha acabado de liberar — não há segunda revisão nesta ponta. É a mesma
 * forma do backend real, onde aprovar leva a cotação a FECHADA e o embarque é
 * provisionado pronto.
 */
export function shipmentFromApproval(
  reference: string,
  quotation: ApprovalQuotation,
  proposal: ApprovalProposal,
  at: string,
): ShipmentPoReview {
  const draft = createDraft(reference, 'cotacao', at, {
    poNumbers: quotation.client_reference ? [quotation.client_reference] : [],
    clientRef: quotation.client_reference ?? '',
    items: itemFromQuotation(quotation),
    exporter: quotation.exporter_name ?? '',
    incoterm: quotation.incoterm ?? '',
    despacho: 'DIRETO',
    modal: modalOf(quotation.modal),
    tipoEmbarque:
      modalOf(quotation.modal) === 'MARITIMO'
        ? tipoOf(quotation.tipo_embarque)
        : '',
    agentName: proposal.agent?.name?.trim() ?? '',
  });

  return {
    ...draft,
    stage: 'active',
    linkedQuotationId: quotation.id,
    history: [
      ...draft.history,
      { kind: 'submitted', at },
      { kind: 'validated', at },
      { kind: 'quotation_linked', at, quotationId: quotation.id },
    ],
  };
}

/** A chave do overlay para o embarque de uma cotação. Estável e idempotente. */
export function approvalShipmentId(quotationId: string): string {
  return `cot-shipment:${quotationId}`;
}

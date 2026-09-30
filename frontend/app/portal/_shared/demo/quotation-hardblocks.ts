// Hardblocks da cotação — a lista do Orsi (29/09/2026), condicional.
//
// PURE, sem o alias `@/`: roda sob `npm run test:unit`.
//
// UMA LISTA, DUAS PONTAS. A mesma função decide se o cliente pode "Enviar para
// a Freitas" (entrada) e se a Freitas pode liberar propostas (saída): uma
// proposta só é liberada se a cotação CONTINUAR atendendo a todos os itens.
// Duas listas divergiriam na primeira regra acrescentada a uma delas.
//
// O QUE NÃO É HARDBLOCK. As flags de severidade das propostas (Crítico, Alto)
// seguem só como indicador visual — decisão do Orsi. Nada aqui as lê.
//
// CADA MOTIVO DIZ O QUE FAZER, não só o que falta, e CABE NA CÉLULA: é o texto
// que aparece embaixo do campo, e a 1440px o formulário tem três blocos lado a
// lado com campos de ~100px. Frase longa ali vira uma coluna de sete linhas.
//
// Na versão integrada esta regra vive no backend (a revisão de entrada recusa
// disparar o RFQ, a de saída recusa liberar); aqui ela desenha a tela.

import {
  parseAmount,
  snapshotFromQuotation,
  type FormSnapshot,
  type SnapshotQuotation,
} from './quotation-form-snapshot.ts';

export { parseAmount };

export type HardblockItem =
  | 'tipo_cotacao'
  | 'service_type'
  | 'modal'
  | 'incoterm'
  | 'price_or_performance'
  | 'product'
  | 'carga_perigosa'
  | 'stackability'
  | 'carga_tombavel'
  | 'client_reference'
  | 'local_coleta'
  | 'local_embarque'
  | 'local_desembarque'
  | 'endereco_entrega_final'
  | 'un_number'
  | 'temperatura_min'
  | 'declared_value'
  | 'ncm';

export interface Hardblock {
  item: HardblockItem;
  /**
   * The FORM field that fixes it. Differs from `item` for the three location
   * items, whose field depends on the modal (port x airport), and is what the
   * form uses as the anchor for "ir para o campo".
   */
  field: string;
  label: string;
  reason: string;
}

/** Which conditional requirements apply to this quotation right now. */
export interface HardblockApplies {
  pickup: boolean;
  loading: boolean;
  unloading: boolean;
  deliveryAddress: boolean;
  unNumber: boolean;
  minTemperature: boolean;
  declaredValue: boolean;
  ncm: boolean;
}

export interface HardblockReport {
  /** In FORM order, so the summary reads top to bottom like the screen. */
  blocks: Hardblock[];
  applies: HardblockApplies;
}

/** Incoterms that make each conditional item mandatory. */
export const PICKUP_EXEMPT_INCOTERMS = ['FOB'];
export const LOADING_INCOTERMS = ['FOB'];
export const DELIVERY_ADDRESS_INCOTERMS = ['DAP', 'DDP'];
export const DECLARED_VALUE_INCOTERMS = ['DAP', 'DDP', 'CIP', 'CIF'];
export const NCM_INCOTERMS = ['DAP', 'DDP'];

export const HARDBLOCK_LABELS: Record<HardblockItem, string> = {
  tipo_cotacao: 'Tipo de cotação',
  service_type: 'Tipo de serviço',
  modal: 'Modal',
  incoterm: 'Incoterm',
  price_or_performance: 'Fator de escolha',
  product: 'Produto',
  carga_perigosa: 'Carga perigosa',
  stackability: 'Empilhável',
  carga_tombavel: 'Tombável',
  client_reference: 'Referência do cliente',
  local_coleta: 'Local de coleta',
  local_embarque: 'Local de embarque',
  local_desembarque: 'Local de desembarque',
  endereco_entrega_final: 'Endereço de entrega final',
  un_number: 'UN',
  temperatura_min: 'Temperatura mínima',
  declared_value: 'Valor da carga',
  ncm: 'NCM',
};

function one(snapshot: FormSnapshot, field: string): string {
  const value = snapshot[field];
  if (Array.isArray(value)) return value.filter(Boolean).join(' ').trim();
  return (value ?? '').trim();
}

const UN_PATTERN = /^(UN)?\s?\d{4}$/i;

/** Evaluates the whole list against one snapshot. */
export function evaluateHardblocks(snapshot: FormSnapshot): HardblockReport {
  const incoterm = one(snapshot, 'incoterm').toUpperCase();
  const modal = one(snapshot, 'modal');
  const isAir = modal === 'AEREO';
  const dangerous = one(snapshot, 'carga_perigosa');
  const refrigerated = one(snapshot, 'carga_refrigerada') === 'true';

  const applies: HardblockApplies = {
    pickup: !PICKUP_EXEMPT_INCOTERMS.includes(incoterm),
    loading: LOADING_INCOTERMS.includes(incoterm),
    // "Só se informado; se marcado 'Agentes decidam', não bloqueia": the
    // client either names the place or hands it to the agents, explicitly.
    unloading:
      one(
        snapshot,
        isAir
          ? 'agente_define_aeroporto_destino'
          : 'agente_define_porto_destino',
      ) !== 'true',
    deliveryAddress: DELIVERY_ADDRESS_INCOTERMS.includes(incoterm),
    unNumber: dangerous === 'SIM' || dangerous === 'IMO' || dangerous === 'RA',
    minTemperature: refrigerated,
    declaredValue: DECLARED_VALUE_INCOTERMS.includes(incoterm),
    ncm: NCM_INCOTERMS.includes(incoterm),
  };

  const blocks: Hardblock[] = [];
  const block = (item: HardblockItem, field: string, reason: string) =>
    blocks.push({ item, field, label: HARDBLOCK_LABELS[item], reason });

  if (!one(snapshot, 'tipo_cotacao')) {
    block('tipo_cotacao', 'tipo_cotacao', 'Escolha Real ou Estimativa.');
  }
  if (!one(snapshot, 'service_type')) {
    block('service_type', 'service_type', 'Escolha Importação ou Exportação.');
  }
  if (!modal) {
    block('modal', 'modal', 'Escolha o modal para liberar os locais.');
  }
  if (!incoterm) {
    block(
      'incoterm',
      'incoterm',
      'Escolha o Incoterm: ele define o que mais é exigido.',
    );
  }
  if (!one(snapshot, 'price_or_performance')) {
    block(
      'price_or_performance',
      'price_or_performance',
      'Diga se a prioridade é preço ou performance.',
    );
  }

  // Locations. Loading and unloading only exist once the modal says which
  // field (port or airport) to fill — before that, the modal block covers it.
  if (applies.pickup && !one(snapshot, 'origin')) {
    block(
      'local_coleta',
      'origin',
      one(snapshot, 'agente_define_local_coleta') === 'true'
        ? 'Fora do FOB a coleta não fica com os agentes: desligue e informe o local.'
        : 'Informe onde coletar a carga.',
    );
  }
  if (modal && applies.loading) {
    const field = isAir ? 'aeroporto_embarque' : 'porto_embarque';
    if (!one(snapshot, field)) {
      block(
        'local_embarque',
        field,
        `No FOB, informe ${isAir ? 'o aeroporto' : 'o porto'} de embarque.`,
      );
    }
  }
  if (modal && applies.unloading) {
    const field = isAir ? 'aeroporto_destino' : 'porto_destino';
    if (!one(snapshot, field)) {
      block(
        'local_desembarque',
        field,
        'Informe o local ou deixe os agentes decidirem.',
      );
    }
  }
  if (applies.deliveryAddress && !one(snapshot, 'endereco_entrega_final')) {
    block(
      'endereco_entrega_final',
      'endereco_entrega_final',
      `No ${incoterm}, informe o endereço de entrega.`,
    );
  }

  if (!one(snapshot, 'product')) {
    block('product', 'product', 'Descreva a mercadoria.');
  }
  if (applies.ncm) {
    const digits = one(snapshot, 'ncm').replace(/\D/g, '');
    if (!digits) {
      block('ncm', 'ncm', `No ${incoterm}, informe o NCM da mercadoria.`);
    } else if (digits.length !== 8) {
      block('ncm', 'ncm', 'O NCM tem 8 dígitos (ex.: 8517.62.77).');
    }
  }
  if (!dangerous) {
    block(
      'carga_perigosa',
      'carga_perigosa',
      'Responda Sim ou Não: não há resposta padrão.',
    );
  } else if (dangerous === 'SIM') {
    block(
      'carga_perigosa',
      'carga_perigosa',
      'Escolha a classificação: IMO ou RA.',
    );
  }
  if (applies.unNumber) {
    const un = one(snapshot, 'un_number');
    if (!un) {
      block('un_number', 'un_number', 'Informe o número UN (ex.: UN1263).');
    } else if (!UN_PATTERN.test(un)) {
      block(
        'un_number',
        'un_number',
        'O número UN tem 4 dígitos (ex.: UN1263).',
      );
    }
  }
  if (!one(snapshot, 'stackability')) {
    block('stackability', 'stackability', 'Responda Sim ou Não.');
  }
  if (!one(snapshot, 'carga_tombavel')) {
    block('carga_tombavel', 'carga_tombavel', 'Responda Sim ou Não.');
  }
  if (applies.minTemperature) {
    const raw = one(snapshot, 'temperatura_min').replace(',', '.');
    if (!raw || !Number.isFinite(Number(raw))) {
      block(
        'temperatura_min',
        'temperatura_min',
        'Informe a temperatura mínima, em °C.',
      );
    }
  }
  if (applies.declaredValue) {
    const raw = one(snapshot, 'declared_value');
    const amount = raw ? parseAmount(raw) : Number.NaN;
    if (!raw) {
      block(
        'declared_value',
        'declared_value',
        `No ${incoterm}, informe o valor da carga.`,
      );
    } else if (!(amount > 0)) {
      block(
        'declared_value',
        'declared_value',
        'Informe um valor maior que zero.',
      );
    }
  }

  if (!one(snapshot, 'client_reference')) {
    block(
      'client_reference',
      'client_reference',
      'Informe seu PO ou número de pedido.',
    );
  }

  return { blocks, applies };
}

/** "Falta 1 item" · "Faltam 3 itens". */
export function hardblockCountLabel(count: number): string {
  return count === 1 ? 'Falta 1 item' : `Faltam ${count} itens`;
}

/**
 * The hardblocks of a quotation ALREADY SENT — what the Freitas' two reviews
 * check before approving the entry and before releasing proposals.
 *
 * The snapshot of the latest submission wins; without one (a quotation sent
 * before this version, or by upload) the payload is the source, and whatever
 * it does not carry blocks until someone fills it. Guessing it would release a
 * proposal on a quotation nobody completed.
 */
export function quotationHardblocks(
  submitted: FormSnapshot | undefined,
  quotation: SnapshotQuotation,
): HardblockReport {
  return evaluateHardblocks(submitted ?? snapshotFromQuotation(quotation));
}

// "Carregar cenários de demonstração" para a jornada por PO.
//
// PURE, no `@/` alias.
//
// Mesma razão do botão equivalente da Cotação V2: percorrer a jornada inteira
// deixa três dos quatro estados invisíveis enquanto se está no quarto. Estes
// quatro cenários enchem a carteira de uma vez — incluindo o ATIVO SEM COTAÇÃO,
// que é o único jeito de alcançar a Tela 9 sem esperar uma validação.
//
// SÓ ESCREVE O OVERLAY. Nada vai ao servidor, nenhuma referência do seed é
// reutilizada (as novas começam em EMB-2026-0101) e o estado do backend não é
// tocado.

import { simulateRead } from './shipment-po-read.ts';
import {
  createDraft,
  nextPoReference,
  returnToClient,
  saveDraft,
  submitToFreitas,
  validate,
  type PoStage,
  type ShipmentPoReview,
  type ShipmentPoStore,
} from './shipment-po-review.ts';

/** Motivo fictício, igual ao que o painel oferece pronto. */
export const PO_SCENARIO_RETURN_REASON = 'Peso bruto divergente do PO anexado';

/** Os campos que a Freitas marca no cenário devolvido. */
export const PO_SCENARIO_RETURN_FIELDS = ['items', 'exporter'];

/** A ordem em que os cenários são criados. */
export const PO_SCENARIO_ORDER: PoStage[] = [
  'awaiting_review',
  'returned',
  'active',
  'draft',
];

const MINUTE = 60_000;

/** Cargas fictícias, uma por cenário, para os cartões não saírem iguais. */
const SCENARIO_CARGO = [
  { po: 'PO-2026-1901', ref: 'SENSE-0931', exporter: 'Sense Components Ltd.' },
  { po: 'PO-2026-1902', ref: 'NINGBO-0412', exporter: 'Ningbo Industrial Co.' },
  { po: 'PO-2026-1903', ref: 'PRECIS-0177', exporter: 'Precision Components Ltd.' },
  { po: 'PO-2026-1904', ref: 'SENSE-0932', exporter: 'Sense Components Ltd.' },
];

function dataFor(index: number) {
  const cargo = SCENARIO_CARGO[index % SCENARIO_CARGO.length];
  const read = simulateRead(`${cargo.po}.pdf`);
  return {
    ...read.data,
    poNumbers: [cargo.po],
    clientRef: cargo.ref,
    exporter: cargo.exporter,
  };
}

/**
 * Os quatro cenários, com histórico coerente com a etapa.
 *
 * `now` é injetado para o teste não depender do relógio, e os instantes ficam
 * afastados o bastante para a linha do tempo ler como uma sequência real.
 */
export function buildPoScenarioStore(
  existingReferences: string[] = [],
  now: number = Date.now(),
): ShipmentPoStore {
  const store: ShipmentPoStore = {};

  PO_SCENARIO_ORDER.forEach((stage, index) => {
    const reference = nextPoReference(store, existingReferences);
    const id = `po-demo-${index + 1}`;
    const t = (minutesAgo: number) =>
      new Date(now - minutesAgo * MINUTE).toISOString();

    let entry = createDraft(
      reference,
      index === 3 ? 'manual' : 'po',
      t(90 - index * 12),
    );
    entry = saveDraft(
      entry,
      dataFor(index),
      t(80 - index * 12),
      index === 3 ? null : `${SCENARIO_CARGO[index].po}.pdf`,
    );
    // O cenário 3 é manual: sem anexo e sem confiança por campo (Tela 6).
    if (index !== 3) {
      entry = { ...entry, confidence: simulateRead('x.pdf').confidence };
    }

    if (stage !== 'draft') {
      entry = submitToFreitas(entry, t(70 - index * 12));
    }
    if (stage === 'returned') {
      entry = returnToClient(
        entry,
        PO_SCENARIO_RETURN_REASON,
        PO_SCENARIO_RETURN_FIELDS,
        t(40),
      );
    }
    if (stage === 'active') {
      // ATIVO E SEM COTAÇÃO de propósito: é este cartão que abre a Tela 9.
      entry = validate(entry, t(30));
    }

    store[id] = entry;
  });

  return store;
}

/**
 * UM PO com TRÊS embarques — o cenário que a aba "Visão por PO" (RQ-12) existe
 * para mostrar, e que o seed não produz.
 *
 * O seed dá um PO por cotação e uma cotação por embarque, então um PO dividido
 * em parciais nunca aparece sozinho. Este botão cria as três parciais do mesmo
 * pedido, cada uma num estágio diferente e com uma chegada diferente, que é
 * exatamente a pergunta da spec: "quando cada carga chega?".
 *
 * ILUSTRATIVO e documentado: as referências continuam fora da faixa do seed e
 * nada vai ao servidor. As três compartilham o PO de propósito — é o único jeito
 * de a tela ter o que agrupar.
 */
export const SPLIT_PO_NUMBER = 'PO-2026-1955';

export function buildSplitPoScenario(
  existingReferences: string[] = [],
  now: number = Date.now(),
): ShipmentPoStore {
  const store: ShipmentPoStore = {};
  const parts = [
    { label: 'Parcial 1 de 3 · bombas centrífugas', days: 12 },
    { label: 'Parcial 2 de 3 · rotores e selos', days: 26 },
    { label: 'Parcial 3 de 3 · sobressalentes', days: 41 },
  ];

  parts.forEach((part, index) => {
    const reference = nextPoReference(store, existingReferences);
    const t = (minutesAgo: number) =>
      new Date(now - minutesAgo * MINUTE).toISOString();

    let entry = createDraft(reference, 'po', t(200 - index * 20));
    entry = saveDraft(
      entry,
      {
        poNumbers: [SPLIT_PO_NUMBER],
        clientRef: 'AURORA-0455',
        exporter: 'Precision Components Ltd.',
        incoterm: 'FOB',
        despacho: 'CONSOLIDADO',
        modal: 'MARITIMO',
        tipoEmbarque: index === 2 ? 'LCL' : 'FCL',
        items: [
          {
            id: `split-item-${index + 1}`,
            partNumber: `BC-99${index + 1}`,
            description: part.label,
            currency: 'USD',
            quantity: 40 - index * 10,
            unitValue: 320,
            netWeightKg: 900 - index * 150,
            totalValue: (40 - index * 10) * 320,
            grossWeightKg: 980 - index * 150,
          },
        ],
      },
      t(190 - index * 20),
      `${SPLIT_PO_NUMBER}-${index + 1}.pdf`,
    );
    entry = submitToFreitas(entry, t(180 - index * 20));
    // A terceira parcial fica EM ANÁLISE: um PO dividido quase nunca tem todas
    // as parciais no mesmo estágio, e a aba precisa mostrar isso.
    if (index < 2) entry = validate(entry, t(170 - index * 20));

    store[`po-split-${index + 1}`] = {
      ...entry,
      // A chegada prevista de cada carga. É o dado que a régua desenha, e ele
      // existe porque o cliente informou — não é derivado de nada.
      plannedEta: new Date(now + part.days * 24 * 60 * MINUTE).toISOString(),
    } as ShipmentPoReview;
  });

  return store;
}

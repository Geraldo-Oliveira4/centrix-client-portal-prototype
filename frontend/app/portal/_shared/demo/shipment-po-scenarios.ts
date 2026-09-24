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

// A leitura simulada do PO (Tela 3).
//
// PURE, no `@/` alias — it runs under `npm run test:unit`.
//
// THERE IS NO OCR HERE, and there is none in the product either: the spec's
// Open Question 1 is still open about whether the v1 reads the PO at all. What
// this module does is turn a FILE NAME into a fixed set of fields, so the
// demonstration can show the ten fields the Orsi listed being read, and show
// two of them coming back unsure. Same file name, same result, always — a
// reading that changed between two runs of the same demo would look like a bug.
//
// The fixture is fictional, like every piece of data in this repository.

import {
  PO_CONFIDENCE_THRESHOLD,
  type PoConfidence,
  type PoItem,
  type PoShipmentData,
} from './shipment-po-review.ts';

/** The ten fields the client watches being read, in the order they appear. */
export const PO_READ_FIELDS = [
  'partNumber',
  'description',
  'currency',
  'quantity',
  'unitValue',
  'netWeightKg',
  'totalValue',
  'grossWeightKg',
  'exporter',
  'incoterm',
] as const;

export type PoReadField = (typeof PO_READ_FIELDS)[number];

export const PO_READ_FIELD_LABELS: Record<PoReadField, string> = {
  partNumber: 'Part number',
  description: 'Descrição',
  currency: 'Moeda',
  quantity: 'Quantidade',
  unitValue: 'Valor unitário',
  netWeightKg: 'Peso líquido',
  totalValue: 'Valor total',
  grossWeightKg: 'Peso bruto',
  exporter: 'Exportador',
  incoterm: 'Incoterm',
};

/** How long the progress bar takes, in milliseconds. */
export const PO_READ_DURATION_MS = 2500;

export interface PoReadResult {
  /** `false` when the reading failed: the fields come back empty. */
  ok: boolean;
  attachmentName: string;
  data: Partial<PoShipmentData>;
  confidence: PoConfidence;
  /** A short fictional rendering of the document, for the side panel. */
  preview: PoDocumentPreview;
}

export interface PoDocumentPreview {
  title: string;
  exporter: string;
  incoterm: string;
  lines: { text: string; field: string | null; lowConfidence: boolean }[];
  footer: string;
}

/**
 * The PO number the fixture reads.
 *
 * DELIBERATELY A PO THE SEED ALREADY USES. `backend/scripts/seed_prototype.py`
 * writes PO-2026-1180..1188 as the `client_reference` of the seeded quotations,
 * and the shipment provisioned from COT-2026-0004 carries PO-2026-1183 through
 * to the portal. So reading the fixture PO collides with a REAL shipment and
 * the duplicate dialog (Tela 5) fires on its own, without anyone having to
 * remember a number mid-demonstration.
 *
 * The wireframe shows PO-2026-1830, which exists nowhere in this prototype —
 * using it would have made the dedup screen unreachable.
 */
export const PO_READ_FIXTURE_NUMBER = 'PO-2026-1183';

/**
 * Two fields below the threshold, eight above (all fictional).
 *
 * Which two is not arbitrary: the QUANTITY and the GROSS WEIGHT are the two a
 * reader most often gets wrong on a scanned PO, and they are also the two the
 * Freitas checks first — so the amber lands where the conversation lands.
 */
const FIXTURE_CONFIDENCE: PoConfidence = {
  partNumber: 0.97,
  description: 0.94,
  currency: 0.99,
  quantity: 0.71,
  unitValue: 0.93,
  netWeightKg: 0.88,
  totalValue: 0.96,
  grossWeightKg: 0.64,
  exporter: 0.91,
  incoterm: 0.95,
};

const FIXTURE_ITEMS: PoItem[] = [
  {
    id: 'po-item-1',
    partNumber: 'SP-4410',
    description: 'Sensor de pressão 0-10 bar',
    currency: 'USD',
    quantity: 200,
    unitValue: 86,
    netWeightKg: 520,
    totalValue: 17200,
    grossWeightKg: 580,
  },
  {
    id: 'po-item-2',
    partNumber: 'SP-4415',
    description: 'Sensor de pressão 0-16 bar',
    currency: 'USD',
    quantity: 120,
    unitValue: 94.5,
    netWeightKg: 310,
    totalValue: 11340,
    grossWeightKg: 350,
  },
];

function fixturePreview(): PoDocumentPreview {
  return {
    title: `PURCHASE ORDER · ${PO_READ_FIXTURE_NUMBER}`,
    exporter: 'Sense Components Ltd.',
    incoterm: 'FOB',
    lines: [
      {
        text: 'SP-4410 · Pressure sensor 0-10 bar · 200 pcs · USD 86.00',
        field: 'partNumber',
        lowConfidence: false,
      },
      {
        text: 'SP-4415 · Pressure sensor 0-16 bar · 120 pcs · USD 94.50',
        field: 'quantity',
        lowConfidence: true,
      },
      {
        text: 'Net weight: 830 kg',
        field: 'netWeightKg',
        lowConfidence: false,
      },
      {
        text: 'Gross weight: 930 kg',
        field: 'grossWeightKg',
        lowConfidence: true,
      },
    ],
    footer: 'Total: USD 28.540,00 · Incoterm FOB',
  };
}

/** Which read fields came back unsure. Drives the amber on the form. */
export function lowConfidenceFields(confidence: PoConfidence): string[] {
  return Object.entries(confidence)
    .filter(([, value]) => value < PO_CONFIDENCE_THRESHOLD)
    .map(([field]) => field);
}

/**
 * Reads a PO. Deterministic: same file name, same result.
 *
 * `fail` is the panel's "Simular falha de leitura do PO" toggle. On failure the
 * fields come back EMPTY and the attachment is kept — which is exactly what the
 * spec asks for, and the reason the client still reaches the form instead of
 * being sent back to the upload.
 */
export function simulateRead(
  fileName: string,
  options: { fail?: boolean } = {},
): PoReadResult {
  const attachmentName = fileName || 'PO.pdf';
  if (options.fail) {
    return {
      ok: false,
      attachmentName,
      data: {},
      confidence: {},
      preview: {
        title: attachmentName,
        exporter: '',
        incoterm: '',
        lines: [],
        footer: 'Não conseguimos ler este documento.',
      },
    };
  }
  return {
    ok: true,
    attachmentName,
    data: {
      poNumbers: [PO_READ_FIXTURE_NUMBER],
      clientRef: 'SENSE-0924',
      exporter: 'Sense Components Ltd.',
      incoterm: 'FOB',
      despacho: 'DIRETO',
      modal: 'MARITIMO',
      tipoEmbarque: 'FCL',
      items: FIXTURE_ITEMS.map((item) => ({ ...item })),
    },
    confidence: { ...FIXTURE_CONFIDENCE },
    preview: fixturePreview(),
  };
}

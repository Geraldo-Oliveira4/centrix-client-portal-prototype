// Illustrative maritime tracking, the shape a real integration (e.g. ShipsGo)
// would return. NONE of this is fetched from a carrier: this repo has no such
// integration and the schema has no vessel / MBL / POL / POD / ETD / ETA
// columns. Every field here is generated deterministically from the shipment's
// EMB reference (stable between renders) EXCEPT the vessel name, which is parsed
// out of the Freitas free-text note when present — that note is a real column,
// so a vessel found there is flagged real. See buildTracking().

import type { PortalShipmentDetail } from '@/types/portal-shipment';

import { DESTINATION, ORIGINS, originIndex, seededInt } from './shipment-origins';

interface Carrier {
  line: string;
  // Booking/MBL prefix in the SCAC-ish style each line uses.
  prefix: string;
  vessels: string[];
}

const CARRIERS: Carrier[] = [
  { line: 'Maersk', prefix: 'MAEU', vessels: ['MAERSK SELETAR', 'MAERSK EMDEN', 'MAERSK HANGZHOU'] },
  { line: 'MSC', prefix: 'MSCU', vessels: ['MSC ISABELLA', 'MSC GULSUN', 'MSC OSCAR'] },
  { line: 'CMA CGM', prefix: 'CMAU', vessels: ['CMA CGM MARCO POLO', 'CMA CGM JACQUES SAADE'] },
  { line: 'Hapag-Lloyd', prefix: 'HLCU', vessels: ['HAPAG BREMEN', 'BERLIN EXPRESS'] },
  { line: 'COSCO', prefix: 'COSU', vessels: ['COSCO SHIPPING UNIVERSE', 'COSCO FORTUNE'] },
  { line: 'ONE', prefix: 'ONEU', vessels: ['ONE APUS', 'ONE OLYMPUS'] },
  { line: 'Evergreen', prefix: 'EGLV', vessels: ['EVER ACE', 'EVER GLORY'] },
];

const TRANSSHIPMENT_PORTS = ['Singapura', 'Tanger Med', 'Colombo', 'Algeciras'];

export interface ShipmentTracking {
  vessel: { name: string; isReal: boolean };
  voyage: string;
  carrier: string;
  mbl: string;
  pol: string;
  pod: string;
  transbordo: string | null;
  etd: string; // ISO
  eta: string; // ISO
}

/**
 * Parse a vessel name from the Freitas free-text note, e.g.
 * "Embarcado no navio MAERSK SELETAR, com origem..." -> "MAERSK SELETAR".
 * This is the one genuinely real signal in the tracking panel: the note is a
 * real DB column. Uppercase-token match keeps it from over-capturing the
 * lowercase prose that follows.
 */
export function parseVesselFromObservacao(
  observacao?: string | null,
): string | null {
  if (!observacao) return null;
  const match = observacao.match(/navio\s+([A-Z0-9]+(?:\s+[A-Z0-9]+)*)/);
  return match ? match[1].trim() : null;
}

function detectCarrier(vesselName: string): Carrier | undefined {
  const first = vesselName.split(/\s+/)[0]?.toUpperCase() ?? '';
  return CARRIERS.find((c) => {
    const lineFirst = c.line.toUpperCase().split(/[\s-]/)[0];
    return first.startsWith(lineFirst) || lineFirst.startsWith(first);
  });
}

const DAY_MS = 86_400_000;

/**
 * Build the illustrative tracking payload for one shipment. Deterministic per
 * reference; the vessel is real when the Freitas note names one, in which case
 * the carrier is aligned to that vessel's line for consistency (still shown as
 * illustrative — the line is inferred, not stored).
 */
export function buildTracking(shipment: PortalShipmentDetail): ShipmentTracking {
  const ref = shipment.referencia;

  const vesselFromNote = parseVesselFromObservacao(shipment.observacao);
  const seededCarrier = CARRIERS[seededInt(`${ref}:carrier`, 0, CARRIERS.length - 1)];
  const carrier =
    (vesselFromNote ? detectCarrier(vesselFromNote) : undefined) ?? seededCarrier;

  const vessel = vesselFromNote
    ? { name: vesselFromNote, isReal: true }
    : {
        name: carrier.vessels[seededInt(`${ref}:vessel`, 0, carrier.vessels.length - 1)],
        isReal: false,
      };

  const origin = ORIGINS[originIndex(ref)];
  const pol = `${origin.name}, ${origin.country}`;
  const pod = `${DESTINATION.name}, ${DESTINATION.country}`;

  const voyageNum = seededInt(`${ref}:voyage`, 10, 349);
  const voyageDir = seededInt(`${ref}:dir`, 0, 1) === 0 ? 'W' : 'E';
  const voyage = `${String(voyageNum).padStart(3, '0')}${voyageDir}`;

  const mbl = `${carrier.prefix}${seededInt(`${ref}:mbl`, 1_000_000, 9_999_999)}`;

  const transbordo =
    seededInt(`${ref}:ts`, 0, 2) === 0
      ? TRANSSHIPMENT_PORTS[seededInt(`${ref}:tsp`, 0, TRANSSHIPMENT_PORTS.length - 1)]
      : null;

  // ETD/ETA anchored to the real created_at, offset by a deterministic lead time
  // and transit. Whole payload stays illustrative regardless.
  const base = new Date(shipment.created_at).getTime();
  const etdDays = seededInt(`${ref}:etd`, 2, 8);
  const transitDays = seededInt(`${ref}:transit`, 22, 41);
  const etd = new Date(base + etdDays * DAY_MS).toISOString();
  const eta = new Date(base + (etdDays + transitDays) * DAY_MS).toISOString();

  return { vessel, voyage, carrier: carrier.line, mbl, pol, pod, transbordo, etd, eta };
}

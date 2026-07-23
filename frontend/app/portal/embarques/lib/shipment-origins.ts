// Shared illustrative geography for the shipment views. The world map and the
// tracking panel both derive a shipment's origin from these hubs so the named
// port in the detail (POL "Shanghai, China") matches the marker the map draws
// for the same shipment — one source, no drift.
//
// NONE of this is a real position: there is no GPS/AIS/carrier feed in this repo
// and the shipment payload carries no route (origin lives on the quotation, and
// most seeded shipments have no linked quotation). The hub is picked
// deterministically from the EMB reference so it is stable between renders.

export interface Hub {
  name: string;
  country: string;
  lon: number;
  lat: number;
}

// Approximate positions of common export hubs across Asia, Europe and North
// America. Fixed and illustrative — not the shipment's real port of loading.
export const ORIGINS: Hub[] = [
  { name: 'Shanghai', country: 'China', lon: 121.5, lat: 31.2 },
  { name: 'Hamburg', country: 'Alemanha', lon: 10.0, lat: 53.5 },
  { name: 'Los Angeles', country: 'EUA', lon: -118.2, lat: 34.0 },
  { name: 'Busan', country: 'Coreia do Sul', lon: 129.0, lat: 35.1 },
  { name: 'Rotterdam', country: 'Holanda', lon: 4.5, lat: 51.9 },
  { name: 'Nova York', country: 'EUA', lon: -74.0, lat: 40.7 },
  { name: 'Shenzhen', country: 'China', lon: 114.1, lat: 22.5 },
  { name: 'Genova', country: 'Itália', lon: 8.9, lat: 44.4 },
  { name: 'Singapura', country: 'Singapura', lon: 103.8, lat: 1.35 },
  { name: 'Houston', country: 'EUA', lon: -95.4, lat: 29.8 },
];

// Single import destination — every quotation here is IMPORTACAO into Brazil.
export const DESTINATION: Hub = {
  name: 'Santos',
  country: 'Brasil',
  lon: -46.33,
  lat: -23.95,
};

// Stable index into ORIGINS. Uses the numeric suffix of the EMB reference when
// present (so sequential seeded shipments spread across regions), else a simple
// string hash.
export function originIndex(reference: string): number {
  const match = reference.match(/(\d+)\s*$/);
  let n: number;
  if (match) {
    n = parseInt(match[1], 10) - 1;
  } else {
    n = 0;
    for (let i = 0; i < reference.length; i += 1) {
      n = (n * 31 + reference.charCodeAt(i)) >>> 0;
    }
  }
  return ((n % ORIGINS.length) + ORIGINS.length) % ORIGINS.length;
}

// Deterministic pseudo-value in [min, max] from a string seed. MOCK helper: it
// only spreads illustrative values stably so they do not flicker between
// renders — it models nothing.
export function seededInt(seed: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return min + (hash % (max - min + 1));
}

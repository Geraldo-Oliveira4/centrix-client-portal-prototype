const FEE_CATEGORIES = {
  ORIGEM: ['THC ORIGEM', 'CCT', 'BL FEE', 'CAPATAZIA', 'ISPS', 'BAF', 'THC (ORIGEM)', 'ORIGEM'],
  FRETE: ['FRETE', 'OCEAN FREIGHT', 'AIR FREIGHT', 'INTERNATIONAL FREIGHT'],
  DESTINO: [
    'THC DESTINO', 'DTA', 'DESCONSOLIDACAO', 'ARMADOR DOC', 'THC (DESTINO)', 'DESTINO',
    'THC (AIR)', 'INLAND (AIR)', 'COLLECT FEE (AIR)', 'ADMINISTRATION FEE',
    'AIRLINE DOCS RELEASE', 'AD VALOREM',
  ],
};

export type FeeCategory = 'ORIGEM' | 'FRETE' | 'DESTINO' | 'OUTROS';

export function categorizeFee(feeName: string): FeeCategory {
  const upper = feeName.toUpperCase();
  if (FEE_CATEGORIES.ORIGEM.some((k) => upper.includes(k))) return 'ORIGEM';
  if (FEE_CATEGORIES.FRETE.some((k) => upper.includes(k))) return 'FRETE';
  if (FEE_CATEGORIES.DESTINO.some((k) => upper.includes(k))) return 'DESTINO';
  return 'OUTROS';
}

// Duck-typed interface compatible with both ClientPortalProposal and QuotationProposal.
export interface ProposalFeeData {
  freight_currency?: string | null;
  freight_value: number;
  taxes_breakdown?: Record<string, number> | null;
  taxes_currency_breakdown?: Record<string, string> | null;
}

export interface GroupedSums {
  total: Record<string, number>;
  origem: Record<string, number>;
  frete: Record<string, number>;
  destino: Record<string, number>;
}

// Aggregates proposal fees into four buckets: total, origem, frete, destino.
// OUTROS fees are folded into destino — both represent destination-side charges.
export function buildGroupedSums(p: ProposalFeeData): GroupedSums {
  const origem: Record<string, number> = {};
  const frete: Record<string, number> = {};
  const destino: Record<string, number> = {};

  const fc = p.freight_currency ?? 'USD';
  if (p.freight_value > 0) {
    frete[fc] = (frete[fc] ?? 0) + p.freight_value;
  }

  for (const [key, rawValue] of Object.entries(p.taxes_breakdown ?? {})) {
    const value = typeof rawValue === 'string' ? (parseFloat(rawValue) || 0) : (rawValue ?? 0);
    const currency = p.taxes_currency_breakdown?.[key] ?? fc;
    const cat = categorizeFee(key);
    if (cat === 'ORIGEM') {
      origem[currency] = (origem[currency] ?? 0) + value;
    } else if (cat === 'FRETE') {
      frete[currency] = (frete[currency] ?? 0) + value;
    } else {
      destino[currency] = (destino[currency] ?? 0) + value;
    }
  }

  const total: Record<string, number> = {};
  for (const sums of [origem, frete, destino]) {
    for (const [curr, val] of Object.entries(sums)) {
      total[curr] = (total[curr] ?? 0) + val;
    }
  }

  return { total, origem, frete, destino };
}

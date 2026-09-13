import type { ManualFormDraft } from '../../../cotacao/nova-cotacao/components/manual-form';

export const assistFields = {
  supplier: 'Fornecedor',
  product: 'Mercadoria',
  client_reference: 'PO',
  origin: 'Local de coleta',
  incoterm: 'Incoterm',
} as const;
export type AssistField = keyof typeof assistFields;
export type Suggestion = { field: AssistField; value: string };
// Deterministic demonstration of labelled text; never represented as model extraction.
export function simulateSuggestions(text: string): Suggestion[] {
  return Object.entries(assistFields).flatMap(([field, label]) => {
    const value = text
      .split(/\r?\n/)
      .find((line) =>
        line
          .toLocaleLowerCase('pt-BR')
          .startsWith(label.toLocaleLowerCase('pt-BR') + ':'),
      )
      ?.split(':')
      .slice(1)
      .join(':')
      .trim();
    if (
      !value ||
      (field === 'incoterm' &&
        ![
          'EXW',
          'FCA',
          'FAS',
          'FOB',
          'CFR',
          'CIF',
          'CPT',
          'CIP',
          'DAP',
          'DPU',
          'DDP',
        ].includes(value.toUpperCase()))
    )
      return [];
    return [
      {
        field: field as AssistField,
        value: field === 'incoterm' ? value.toUpperCase() : value,
      },
    ];
  });
}
export function applySuggestions(
  draft: ManualFormDraft,
  supplier: string,
  suggestions: Suggestion[],
  selected: AssistField[],
) {
  const next = structuredClone(draft);
  let nextSupplier = supplier;
  for (const suggestion of suggestions) {
    if (!selected.includes(suggestion.field)) continue;
    if (suggestion.field === 'supplier') nextSupplier = suggestion.value;
    else next.values[suggestion.field] = suggestion.value;
  }
  return { draft: next, supplier: nextSupplier };
}

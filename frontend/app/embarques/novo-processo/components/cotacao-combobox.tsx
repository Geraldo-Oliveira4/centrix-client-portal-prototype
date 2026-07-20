'use client';

import { useMemo } from 'react';
import { Combobox } from '@/components/ui/combobox';
import { useQuotations } from '@/hooks/use-quotations';
import type { Quotation } from '@/types/quotation';

interface CotacaoComboboxProps {
  value: string;
  // Called with the full quotation when one is selected, or null when cleared.
  onSelect: (quotation: Quotation | null) => void;
  disabled?: boolean;
}

export function CotacaoCombobox({ value, onSelect, disabled }: CotacaoComboboxProps) {
  // Only approved quotations are eligible to spawn a GE process (Ponte 1).
  const { quotations } = useQuotations({ state: 'APROVADA_PELO_CLIENTE' });

  const options = useMemo(
    () =>
      (quotations ?? []).map((q) => ({
        value: q.id,
        label: q.client?.name ? `${q.reference} — ${q.client.name}` : q.reference,
      })),
    [quotations],
  );

  const handleChange = (next: string) => {
    if (!next) {
      onSelect(null);
      return;
    }
    const selected = (quotations ?? []).find((q) => q.id === next) ?? null;
    onSelect(selected);
  };

  return (
    <Combobox
      value={value}
      onValueChange={handleChange}
      options={options}
      placeholder="Selecionar cotação aprovada (opcional)..."
      searchPlaceholder="Buscar por referência ou cliente..."
      emptyText="Nenhuma cotação aprovada encontrada."
      disabled={disabled}
    />
  );
}

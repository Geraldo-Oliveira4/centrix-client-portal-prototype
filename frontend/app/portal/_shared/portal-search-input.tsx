'use client';

import { useState } from 'react';
import { Search, X } from 'lucide-react';

import { Button, Input } from '@/components/ui';

/**
 * The portal's single search affordance: a lupa that expands into an input.
 *
 * There used to be two of these — this one (Minhas Cotações) and a hand-rolled
 * copy inside `embarques/components/shipment-list-tab.tsx` with its own
 * `searchOpen` state. Same markup, same behaviour, two places to drift. Any new
 * portal toolbar must use THIS component; do not inline a third copy.
 *
 * `open` / `onOpenChange` are optional: leave them out and the component owns
 * its expand state (Minhas Cotações), pass them to drive it from outside
 * (Meus Embarques, where the header shortcut deep-links with the field already
 * expanded).
 */
export function PortalSearchInput({
  value,
  onChange,
  placeholder = 'Buscar…',
  label,
  open: openProp,
  onOpenChange,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** aria-label of both the trigger and the input. */
  label: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;

  const setOpen = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label={label}
        onClick={() => setOpen(true)}
      >
        <Search className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-portal-neutral" />
      <Input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-9 w-56 pl-8 pr-8"
      />
      <button
        type="button"
        aria-label="Fechar busca"
        onClick={() => {
          onChange('');
          setOpen(false);
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-portal-neutral hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

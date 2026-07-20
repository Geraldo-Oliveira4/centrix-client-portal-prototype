'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command';
import { PopoverTrigger } from './popover';

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}

const INITIAL_VISIBLE = 50;
const MAX_FILTERED = 100;

export function Combobox({
  value,
  onValueChange,
  options,
  placeholder = 'Selecionar...',
  searchPlaceholder = 'Buscar...',
  emptyText = 'Nenhum resultado.',
  disabled = false,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const filtered = React.useMemo(() => {
    if (!search) return options.slice(0, INITIAL_VISIBLE);
    const q = search.toLowerCase();
    return options
      .filter((o) => o.label.toLowerCase().includes(q))
      .slice(0, MAX_FILTERED);
  }, [options, search]);

  const hiddenCount = !search ? options.length - INITIAL_VISIBLE : 0;

  const selectedLabel = value
    ? (options.find((o) => o.value === value)?.label ?? value)
    : null;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setSearch('');
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal',
            !selectedLabel && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">
            {selectedLabel ?? placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      {/* Render without Portal so the content stays inside the Dialog's FocusScope */}
      <PopoverPrimitive.Content
        className={cn(
          'z-50 rounded-md border bg-popover text-popover-foreground shadow-md outline-none',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
          'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          'p-0',
        )}
        style={{ width: 'var(--radix-popover-trigger-width)' }}
        align="start"
        sideOffset={4}
      >
        {/* shouldFilter=false: cmdk skips its own DOM-based filtering; we control rendered items */}
        <Command shouldFilter={false} className="h-auto">
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-60 overflow-y-auto">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {filtered.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => {
                    onValueChange(option.value === value ? '' : option.value);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === option.value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
            {hiddenCount > 0 && (
              <p className="py-2 text-center text-xs text-muted-foreground">
                +{hiddenCount} — digite para filtrar
              </p>
            )}
          </CommandList>
        </Command>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Root>
  );
}

'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from './badge';
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
import type { ComboboxOption } from './combobox';

interface MultiComboboxProps {
  value: string[];
  onValueChange: (value: string[]) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}

const INITIAL_VISIBLE = 50;
const MAX_FILTERED = 100;

export function MultiCombobox({
  value,
  onValueChange,
  options,
  placeholder = 'Selecionar...',
  searchPlaceholder = 'Buscar...',
  emptyText = 'Nenhum resultado.',
  disabled = false,
  className,
}: MultiComboboxProps) {
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

  function handleSelect(optionValue: string) {
    if (value.includes(optionValue)) {
      onValueChange(value.filter((v) => v !== optionValue));
    } else {
      onValueChange([...value, optionValue]);
    }
  }

  function handleRemove(optionValue: string, e: React.MouseEvent) {
    e.stopPropagation();
    onValueChange(value.filter((v) => v !== optionValue));
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setSearch('');
  }

  const selectedLabels = value.map(
    (v) => options.find((o) => o.value === v)?.label ?? v,
  );

  function renderTriggerContent() {
    if (selectedLabels.length === 0) {
      return <span className="text-muted-foreground">{placeholder}</span>;
    }
    if (selectedLabels.length === 1) {
      return <span className="truncate">{selectedLabels[0]}</span>;
    }
    return (
      <span className="flex items-center gap-1.5">
        <span className="truncate max-w-[180px]">{selectedLabels[0]}</span>
        <Badge variant="secondary" className="shrink-0 text-xs font-medium px-1.5 py-0">
          +{selectedLabels.length - 1}
        </Badge>
      </span>
    );
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal h-9 px-3"
          >
            {renderTriggerContent()}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
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
                    onSelect={() => handleSelect(option.value)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value.includes(option.value) ? 'opacity-100' : 'opacity-0',
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

      {selectedLabels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedLabels.map((label, i) => (
            <Badge
              key={value[i]}
              variant="secondary"
              className="text-xs font-normal max-w-[200px]"
            >
              <span className="truncate">{label}</span>
              {!disabled && (
                <button
                  type="button"
                  className="ml-1 shrink-0 rounded-sm hover:bg-muted-foreground/20 focus:outline-none"
                  onClick={(e) => handleRemove(value[i], e)}
                  aria-label={`Remover ${label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Building2, Check, ChevronsUpDown } from 'lucide-react';
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { useExporters } from '@/hooks/use-exporters';
import type { Exporter } from '@/types/exporter';

interface ExporterSelectorProps {
  value: string | null;
  onChange: (exporter: Exporter | null) => void;
}

export function ExporterSelector({ value, onChange }: ExporterSelectorProps) {
  const [open, setOpen] = useState(false);
  const { exporters, isLoading } = useExporters();

  const selectedExporter = exporters?.find((e) => e.id === value) ?? null;

  const handleSelect = (exporter: Exporter) => {
    if (exporter.id === value) {
      onChange(null);
    } else {
      onChange(exporter);
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="w-4 h-4 shrink-0 text-muted-foreground" />
            {selectedExporter ? (
              <span className="truncate">{selectedExporter.name}</span>
            ) : (
              <span className="text-muted-foreground">
                Selecionar exportador cadastrado...
              </span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar exportador..." />
          <CommandList>
            {isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Carregando...
              </div>
            ) : (
              <>
                <CommandEmpty>Nenhum exportador encontrado.</CommandEmpty>
                <CommandGroup>
                  {(exporters ?? []).map((exporter) => (
                    <CommandItem
                      key={exporter.id}
                      value={exporter.name}
                      onSelect={() => handleSelect(exporter)}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === exporter.id ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate">
                          {exporter.name}
                        </span>
                        {exporter.cargo_profile === 'PERIGOSA' && (
                          <span className="text-xs text-orange-600 truncate">
                            Perfil: Perigosa
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

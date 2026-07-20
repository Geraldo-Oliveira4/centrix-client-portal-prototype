'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, User } from 'lucide-react';
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
import { useClients } from '@/hooks/use-clients';
import type { QuotationClient } from '@/types/client';

interface ClientSelectorProps {
  value: string | null;
  onChange: (client: QuotationClient | null) => void;
}

export function ClientSelector({ value, onChange }: ClientSelectorProps) {
  const [open, setOpen] = useState(false);
  const { clients, isLoading } = useClients();

  const selectedClient = clients?.find((c) => c.id === value) ?? null;

  const handleSelect = (client: QuotationClient) => {
    if (client.id === value) {
      onChange(null);
    } else {
      onChange(client);
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
            <User className="w-4 h-4 shrink-0 text-muted-foreground" />
            {selectedClient ? (
              <span className="truncate">{selectedClient.name}</span>
            ) : (
              <span className="text-muted-foreground">
                Selecionar cliente...
              </span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar cliente..." />
          <CommandList>
            {isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Carregando...
              </div>
            ) : (
              <>
                <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                <CommandGroup>
                  {(clients ?? []).map((client) => (
                    <CommandItem
                      key={client.id}
                      value={`${client.name} ${client.email}`}
                      onSelect={() => handleSelect(client)}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === client.id ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate">
                          {client.name}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {client.email}
                          {client.is_vip && ' · Crítico'}
                        </span>
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

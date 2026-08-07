'use client';

import { useState } from 'react';
import { Building2, Check, ChevronsUpDown, Plus, ShieldAlert, X } from 'lucide-react';
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
import { useMyExporters } from '@/hooks/use-portal-exporters';
import { CARGO_PROFILE_LABELS, type Exporter } from '@/types/exporter';

import { PortalExporterModal } from './portal-exporter-modal';

interface PortalExporterSelectProps {
  value: string | null;
  onChange: (exporter: Exporter | null) => void;
  disabled?: boolean;
}

/**
 * Portal counterpart of the analyst ExporterSelector, with the self-service
 * half added: the client picks one of their own exporters or registers a new
 * one inline, without leaving the quotation form. A freshly created exporter is
 * selected automatically so the two-step flow feels like one.
 */
export function PortalExporterSelect({
  value,
  onChange,
  disabled,
}: PortalExporterSelectProps) {
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const { exporters, isLoading } = useMyExporters();

  const selected = exporters.find((e) => e.id === value) ?? null;

  const handleSelect = (exporter: Exporter) => {
    onChange(exporter.id === value ? null : exporter);
    setOpen(false);
  };

  const handleCreated = (exporter: Exporter) => {
    onChange(exporter);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* This row sits inside a ManualForm `grid-cols-3` column, which has no
          responsive breakpoints: at 1280px/100% the column leaves ~277px of
          usable width (~331px at 1440px), against the ~467px the combobox and
          the button need side by side. Without wrapping, the button overflowed
          the column and rendered underneath the neighbouring card (painted later
          in the DOM) — invisible and unclickable, surfacing only when the user
          zoomed out and the column grew. Measured before the fix: the button sat
          151-267px past the card's right edge and elementFromPoint at its centre
          returned an input belonging to the next card.

          flex-wrap drops the button to its own line instead of letting it
          overflow; shrink-0 keeps it from being squeezed before that happens. */}
      <div className="flex flex-wrap items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              disabled={disabled}
              className="flex-1 basis-48 min-w-0 justify-between font-normal"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="w-4 h-4 shrink-0 text-muted-foreground" />
                {selected ? (
                  <span className="truncate">{selected.name}</span>
                ) : (
                  // truncate on the placeholder too: without it the text becomes
                  // the combobox min-content width, so basis-48 cannot shrink —
                  // that was half of the row overflow.
                  <span className="truncate text-muted-foreground">
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
                    <CommandEmpty>
                      Nenhum exportador cadastrado ainda.
                    </CommandEmpty>
                    <CommandGroup>
                      {exporters.map((exporter) => (
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
                              <span className="text-xs text-portal-warning truncate">
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

        <Button
          type="button"
          variant="outline"
          onClick={() => setModalOpen(true)}
          disabled={disabled}
          className="shrink-0"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Cadastrar novo
        </Button>
      </div>

      {selected ? (
        <div className="flex items-start justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2">
          <div className="flex flex-col gap-1 min-w-0 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{selected.name}</span>
              {selected.cargo_profile === 'PERIGOSA' ? (
                <span className="inline-flex items-center gap-1 rounded border border-portal-warning/30 bg-portal-warning/10 px-1.5 py-0.5 text-portal-warning">
                  <ShieldAlert className="h-3 w-3" />
                  {CARGO_PROFILE_LABELS[selected.cargo_profile]}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  {CARGO_PROFILE_LABELS[selected.cargo_profile]}
                </span>
              )}
            </div>
            {selected.endereco ? (
              <span className="text-muted-foreground truncate">
                {selected.endereco}
              </span>
            ) : null}
            {selected.particularidades ? (
              <span className="text-muted-foreground">
                {selected.particularidades}
              </span>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => onChange(null)}
            disabled={disabled}
            aria-label="Remover exportador selecionado"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : null}

      <PortalExporterModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onCreated={handleCreated}
      />
    </div>
  );
}

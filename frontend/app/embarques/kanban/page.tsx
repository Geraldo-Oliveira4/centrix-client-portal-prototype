'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { useSearchInput } from '@/hooks/use-search-input';
import { PageTitle, LoaderComponent, ErrorComponent } from '@arboria-tech/arboria-ui';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useShipmentKanban } from '@/hooks/use-shipments';
import type { ShipmentModal } from '@/types/shipment';
import { KanbanBoard } from './components/kanban-board';
import { MODAL_DISPLAY } from './constants';

type ModalFilter = ShipmentModal | 'TODOS';

export default function EmbarquesKanbanPage() {
  const router = useRouter();
  const {
    inputValue: searchInput,
    setInputValue: setSearchInput,
    debouncedValue: debouncedSearch,
  } = useSearchInput();
  const [modalFilter, setModalFilter] = useState<ModalFilter>('TODOS');
  const [urgentOnly, setUrgentOnly] = useState(false);
  const { board, isLoading, isError } = useShipmentKanban({
    search: debouncedSearch,
    modal: modalFilter === 'TODOS' ? undefined : modalFilter,
    cargaUrgente: urgentOnly,
  });

  if (isLoading) return <LoaderComponent />;
  if (isError) return <ErrorComponent />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <PageTitle title="Kanban de Embarques" />
        <Button onClick={() => router.push('/embarques/novo-processo')} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Embarque
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por referência, cliente, agente, incoterm..."
            className="pl-9"
          />
        </div>

        <Select
          value={modalFilter}
          onValueChange={(v) => setModalFilter(v as ModalFilter)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todos os modais" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos os modais</SelectItem>
            {Object.entries(MODAL_DISPLAY).map(([value, { label }]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={urgentOnly ? 'default' : 'outline'}
          onClick={() => setUrgentOnly((v) => !v)}
        >
          Apenas urgentes
        </Button>
      </div>

      {board && <KanbanBoard board={board} />}
    </div>
  );
}

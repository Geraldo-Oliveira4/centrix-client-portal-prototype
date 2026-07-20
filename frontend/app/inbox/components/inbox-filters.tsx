'use client';

import { Search } from 'lucide-react';
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import { cn } from '@/lib/utils';

export type UrgencyFilter = 'ALL' | 'URGENTE' | 'ALTA' | 'NORMAL';
export type AnalystFilter = 'ALL' | 'MINE';

interface InboxFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  urgency: UrgencyFilter;
  onUrgencyChange: (value: UrgencyFilter) => void;
  analyst: AnalystFilter;
  onAnalystChange: (value: AnalystFilter) => void;
  origin: string;
  onOriginChange: (value: string) => void;
}

export function InboxFilters({
  search,
  onSearchChange,
  urgency,
  onUrgencyChange,
  analyst,
  onAnalystChange,
  origin,
  onOriginChange,
}: InboxFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <div className="relative w-72">
        <Input
          placeholder="Pesquisar referencia, cliente, rota..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 pr-4 py-2"
        />
        <div className="absolute left-3 top-2.5">
          <Search size={20} className="text-muted-foreground" />
        </div>
      </div>

      <div className="flex rounded-md border overflow-hidden">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'rounded-none border-r h-10 px-3',
            analyst === 'ALL' && 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground',
          )}
          onClick={() => onAnalystChange('ALL')}
        >
          Todos
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'rounded-none h-10 px-3',
            analyst === 'MINE' && 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground',
          )}
          onClick={() => onAnalystChange('MINE')}
        >
          Minhas
        </Button>
      </div>

      <Select
        value={urgency}
        onValueChange={(v) => onUrgencyChange(v as UrgencyFilter)}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Urgencia" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Todas</SelectItem>
          <SelectItem value="URGENTE">Urgente</SelectItem>
          <SelectItem value="ALTA">Alta</SelectItem>
          <SelectItem value="NORMAL">Normal</SelectItem>
        </SelectContent>
      </Select>

      <div className="relative w-48">
        <Input
          placeholder="Filtrar por origem..."
          value={origin}
          onChange={(e) => onOriginChange(e.target.value)}
        />
      </div>
    </div>
  );
}

'use client';

import { Search, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useFreightAgents } from '@/hooks/use-freight-agents';
import { useDebouncedFilter } from '@/hooks/use-debounced-filter';
import { DateRangeFilter } from './date-range-filter';
import {
  FILTER_CHIPS,
  MODAL_FILTER_OPTIONS,
  SORT_OPTIONS,
  TIPO_EMBARQUE_FILTER_OPTIONS,
  type FilterChip,
  type KanbanFilterState,
  type ModalFilter,
  type SortOption,
} from '../constants';

interface RefreshBarProps {
  lastRefreshed: Date | null;
  isRefreshing: boolean;
  onRefresh: () => void;
}

interface KanbanFiltersProps {
  filters: KanbanFilterState;
  onFilterChange: <K extends keyof KanbanFilterState>(key: K, value: KanbanFilterState[K]) => void;
  onModalFilterChange: (v: ModalFilter) => void;
  onToggleChip: (chip: FilterChip) => void;
  refresh: RefreshBarProps;
}

export function KanbanFilters({
  filters,
  onFilterChange,
  onModalFilterChange,
  onToggleChip,
  refresh,
}: KanbanFiltersProps) {
  const { agents } = useFreightAgents();

  const [searchInput, setSearchInput] = useDebouncedFilter(filters.search, (v) => onFilterChange('search', v));
  const [produtoInput, setProdutoInput] = useDebouncedFilter(filters.produtoFilter, (v) => onFilterChange('produtoFilter', v));
  const [rotaInput, setRotaInput] = useDebouncedFilter(filters.rotaFilter, (v) => onFilterChange('rotaFilter', v));
  const [exportadorInput, setExportadorInput] = useDebouncedFilter(filters.exportadorFilter, (v) => onFilterChange('exportadorFilter', v));
  const [paisInput, setPaisInput] = useDebouncedFilter(filters.paisProcedenciaFilter, (v) => onFilterChange('paisProcedenciaFilter', v));
  const [pesoInput, setPesoInput] = useDebouncedFilter(filters.pesoTaxadoMin, (v) => onFilterChange('pesoTaxadoMin', v));

  const lastRefreshedLabel = refresh.lastRefreshed
    ? formatDistanceToNow(refresh.lastRefreshed, { addSuffix: true, locale: ptBR })
    : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar cliente, codigo, referencia..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          {FILTER_CHIPS.map((chip) => (
            <Button
              key={chip.value}
              variant={filters.activeChips.has(chip.value) ? 'default' : 'outline'}
              size="sm"
              onClick={() => onToggleChip(chip.value)}
              className={cn(
                'text-xs',
                filters.activeChips.has(chip.value) && 'bg-primary text-primary-foreground',
              )}
            >
              {chip.label}
            </Button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {lastRefreshedLabel && (
            <span>Emails verificados {lastRefreshedLabel}</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={refresh.onRefresh}
            disabled={refresh.isRefreshing}
            title="Verificar novos emails agora"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refresh.isRefreshing && 'animate-spin')} />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Produto / NCM..."
          value={produtoInput}
          onChange={(e) => setProdutoInput(e.target.value)}
          className="w-48"
        />
        <Input
          placeholder="Rota / Origem..."
          value={rotaInput}
          onChange={(e) => setRotaInput(e.target.value)}
          className="w-48"
        />
        <Input
          placeholder="Exportador / Shipper..."
          value={exportadorInput}
          onChange={(e) => setExportadorInput(e.target.value)}
          className="w-48"
        />
        <Input
          placeholder="País de procedência..."
          value={paisInput}
          onChange={(e) => setPaisInput(e.target.value)}
          className="w-44"
        />
        <Input
          type="number"
          placeholder="Peso tax. mín. (kg)"
          value={pesoInput}
          onChange={(e) => setPesoInput(e.target.value)}
          className="w-40"
          min={0}
        />
        <DateRangeFilter
          label="Recebimento"
          from={filters.periodoInicio}
          to={filters.periodoFim}
          onChange={(from, to) => {
            onFilterChange('periodoInicio', from);
            onFilterChange('periodoFim', to);
          }}
        />
        <Select value={filters.agenteFilter || 'TODOS'} onValueChange={(v) => onFilterChange('agenteFilter', v === 'TODOS' ? '' : v)}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Agente de carga" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos os agentes</SelectItem>
            {(agents ?? []).map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.modalFilter} onValueChange={(v) => onModalFilterChange(v as ModalFilter)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Modal" />
          </SelectTrigger>
          <SelectContent>
            {MODAL_FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {filters.modalFilter === 'MARITIMO' && (
          <Select
            value={filters.tipoEmbarqueFilter}
            onValueChange={(v) => onFilterChange('tipoEmbarqueFilter', v as KanbanFilterState['tipoEmbarqueFilter'])}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="FCL / LCL" />
            </SelectTrigger>
            <SelectContent>
              {TIPO_EMBARQUE_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button
          variant={filters.portalApprovedFilter ? 'default' : 'outline'}
          size="sm"
          onClick={() => onFilterChange('portalApprovedFilter', !filters.portalApprovedFilter)}
          className={cn(
            'text-xs',
            filters.portalApprovedFilter && 'bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600',
          )}
        >
          Aprovadas pelo cliente
        </Button>

        <Button
          variant={filters.guardRailActiveFilter ? 'default' : 'outline'}
          size="sm"
          onClick={() => onFilterChange('guardRailActiveFilter', !filters.guardRailActiveFilter)}
          className={cn(
            'text-xs',
            filters.guardRailActiveFilter && 'bg-amber-600 text-white hover:bg-amber-700 border-amber-600',
          )}
        >
          Guard Rail Ativo
        </Button>

        <Select value={filters.sort} onValueChange={(v) => onFilterChange('sort', v as SortOption)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onFilterChange('showCancelled', !filters.showCancelled)}
          className="text-xs text-muted-foreground gap-1.5"
        >
          {filters.showCancelled ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
          {filters.showCancelled ? 'Ocultar cancelados' : 'Mostrar cancelados'}
        </Button>
      </div>
    </div>
  );
}

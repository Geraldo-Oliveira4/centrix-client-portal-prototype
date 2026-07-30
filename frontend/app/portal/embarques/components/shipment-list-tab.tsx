'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ChevronRight,
  Info,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatShortDate } from '@/lib/portal-formatters';
import { MODAL_LABELS } from '@/types/quotation';
import {
  ESTADO_SEMAFORO,
  SEMAFORO_DOT_CLASS,
  countBySemaforo,
  type PortalShipment,
  type SemaforoTone,
} from '@/types/portal-shipment';

import { ModalIcon } from '../../_shared/modal-icon';
import { ProvenanceBadge } from '../../_shared/provenance-badge';
import { EstadoBadge } from './estado-badge';
import { ORIGINS, originIndex } from '../lib/shipment-origins';

// Normalise a reference for comparison: case- and whitespace-insensitive.
const normalize = (value: string) => value.trim().toUpperCase().replace(/\s+/g, '');

const SEMAFORO_LABEL: Record<SemaforoTone, string> = {
  success: 'Em andamento',
  warning: 'Atenção / atraso',
  danger: 'Exceção',
};

type StatusFilter = SemaforoTone | 'all';
type PeriodFilter = 'all' | '30' | '90';

const originOf = (referencia: string) => ORIGINS[originIndex(referencia)];

function SemaforoCounter({ shipments }: { shipments: PortalShipment[] }) {
  const counts = countBySemaforo(shipments);
  const tones: SemaforoTone[] = ['success', 'warning', 'danger'];
  return (
    <div className="flex items-center gap-4">
      {tones.map((tone) => (
        <span key={tone} className="inline-flex items-center gap-1.5">
          <span className={cn('h-2.5 w-2.5 rounded-full', SEMAFORO_DOT_CLASS[tone])} />
          <span className="portal-body font-medium text-foreground">
            {counts[tone]}
          </span>
          <span className="portal-small text-portal-neutral">{SEMAFORO_LABEL[tone]}</span>
        </span>
      ))}
    </div>
  );
}

function ShipmentCard({ shipment }: { shipment: PortalShipment }) {
  const origin = originOf(shipment.referencia);
  return (
    <Link
      href={`/portal/embarques/${shipment.id}`}
      className="portal-card block space-y-3 p-4 transition-colors hover:border-primary/40 hover:bg-muted/30"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="portal-body font-medium text-foreground">
            {shipment.referencia}
          </span>
          {shipment.carga_urgente && (
            <span className="portal-small inline-flex items-center gap-1 rounded border border-portal-warning/30 bg-portal-warning/10 px-1.5 py-0.5 font-medium text-portal-warning">
              <AlertTriangle className="h-3.5 w-3.5" />
              Urgente
            </span>
          )}
        </div>
        <EstadoBadge estado={shipment.estado} />
      </div>

      {/* Rota — origem ilustrativa (ver legenda). Chegada não tem fonte de dado. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="portal-small text-portal-neutral">
          {origin.name}, {origin.country}
          <span className="mx-1.5">→</span>
          Brasil
        </span>
        <span className="inline-flex items-center gap-1.5 portal-small text-portal-neutral">
          ETA
          <ProvenanceBadge provenance="pending" />
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 border-t pt-3">
        <span className="inline-flex items-center gap-2 portal-small text-portal-neutral">
          <ModalIcon modal={shipment.modal} className="h-4 w-4" />
          {shipment.modal ? MODAL_LABELS[shipment.modal] : '—'}
          <span className="text-border">·</span>
          Aberto em {formatShortDate(shipment.created_at)}
          {shipment.agente_nome ? (
            <>
              <span className="text-border">·</span>
              {shipment.agente_nome}
            </>
          ) : null}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-portal-neutral" />
      </div>
    </Link>
  );
}

function CardSkeleton() {
  return (
    <div className="portal-card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-5 w-24" />
      </div>
      <Skeleton className="h-3 w-48" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}

export function ShipmentListTab({
  shipments,
  isLoading,
}: {
  shipments: PortalShipment[];
  isLoading: boolean;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [origin, setOrigin] = useState<string>('all');
  const [period, setPeriod] = useState<PeriodFilter>('all');

  const originsPresent = useMemo(() => {
    const names = new Set(shipments.map((s) => originOf(s.referencia).name));
    return ORIGINS.filter((o) => names.has(o.name)).map((o) => o.name);
  }, [shipments]);

  const filtered = useMemo(() => {
    const term = query.trim() ? normalize(query) : '';
    const cutoff =
      period === 'all'
        ? null
        : Date.now() - Number(period) * 24 * 60 * 60 * 1000;
    return shipments.filter((s) => {
      if (term && !normalize(s.referencia).includes(term)) return false;
      if (status !== 'all' && ESTADO_SEMAFORO[s.estado] !== status) return false;
      if (origin !== 'all' && originOf(s.referencia).name !== origin) return false;
      if (cutoff != null && new Date(s.created_at).getTime() < cutoff) return false;
      return true;
    });
  }, [shipments, query, status, origin, period]);

  const activeFilters =
    (status !== 'all' ? 1 : 0) + (origin !== 'all' ? 1 : 0) + (period !== 'all' ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Toolbar: counter (left) + icon-only search and compact filter (right) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SemaforoCounter shipments={shipments} />

        <div className="flex items-center gap-2">
          {searchOpen ? (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-portal-neutral" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar referência…"
                aria-label="Buscar embarque por referência"
                className="h-9 w-52 pl-8 pr-8"
              />
              <button
                type="button"
                aria-label="Fechar busca"
                onClick={() => {
                  setQuery('');
                  setSearchOpen(false);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-portal-neutral hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Buscar"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="h-5 w-5" />
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
                {activeFilters > 0 && (
                  <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                    {activeFilters}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Situação</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={status}
                onValueChange={(v) => setStatus(v as StatusFilter)}
              >
                <DropdownMenuRadioItem value="all">Todas</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="success">Em andamento</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="warning">Atenção / atraso</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="danger">Exceção</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>

              <DropdownMenuSeparator />
              <DropdownMenuLabel>Origem</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={origin} onValueChange={setOrigin}>
                <DropdownMenuRadioItem value="all">Todas</DropdownMenuRadioItem>
                {originsPresent.map((name) => (
                  <DropdownMenuRadioItem key={name} value={name}>
                    {name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>

              <DropdownMenuSeparator />
              <DropdownMenuLabel>Período (abertura)</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={period}
                onValueChange={(v) => setPeriod(v as PeriodFilter)}
              >
                <DropdownMenuRadioItem value="all">Qualquer data</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="30">Últimos 30 dias</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="90">Últimos 90 dias</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <p className="inline-flex items-center gap-1.5 portal-small text-portal-neutral">
        <Info className="h-3.5 w-3.5" />
        Origem aproximada por região e chegada estimada são ilustrativas — o portal
        ainda não integra rastreamento do agente.
      </p>

      {isLoading ? (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
          <p className="portal-body font-medium text-foreground">
            Nenhum embarque encontrado
          </p>
          <p className="portal-small text-portal-neutral">
            Ajuste a busca ou os filtros para ver seus embarques.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((shipment) => (
            <ShipmentCard key={shipment.id} shipment={shipment} />
          ))}
        </div>
      )}
    </div>
  );
}

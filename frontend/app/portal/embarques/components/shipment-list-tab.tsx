'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ChevronRight, Info, SlidersHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { formatShortDate } from '@/lib/portal-formatters';
import { MODAL_LABELS } from '@/types/quotation';
import {
  ESTADO_SEMAFORO,
  SEMAFORO_DOT_CLASS,
  SEMAFORO_LABELS,
  countBySemaforo,
  type PortalShipment,
  type SemaforoTone,
} from '@/types/portal-shipment';

import {
  ClientReferenceTag,
  matchesClientReference,
} from '../../_shared/client-reference-tag';
import { ModalIcon } from '../../_shared/modal-icon';
import { PortalSearchInput } from '../../_shared/portal-search-input';
import { ProvenanceBadge } from '../../_shared/provenance-badge';
import { ShipmentDelayRiskBadge } from './delay-risk-badge';
import { EstadoBadge } from './estado-badge';
import { ShipmentEtaBadge } from './eta-badge';
import { ShipmentFilterChips } from './shipment-filter-chips';
import {
  countShipmentFilters,
  filterShipments,
  type ShipmentFilterKey,
} from '../lib/shipment-filters';
import { ORIGINS, originIndex } from '../lib/shipment-origins';

// Normalise a reference for comparison: case- and whitespace-insensitive.
const normalize = (value: string) => value.trim().toUpperCase().replace(/\s+/g, '');

type StatusFilter = SemaforoTone | 'all';
type PeriodFilter = 'all' | '30' | '90';

// Os predicados dos chips (Urgentes / Embarcados / Com atraso / Com exceção)
// moram em `lib/shipment-filters.ts` desde que o Mapa passou a oferecer os
// mesmos recortes — uma definição só para as duas abas. Ver o cabeçalho de lá.

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
          <span className="portal-small text-portal-neutral">{SEMAFORO_LABELS[tone]}</span>
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
      className="portal-card block space-y-3 p-4 transition-colors hover:border-brand-indigo-800/40 hover:bg-muted/30"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="portal-body font-medium text-foreground">
            {shipment.referencia}
          </span>
          {/* A PO vem da cotação que originou o embarque; embarque aberto fora
              do portal não tem cotação e, portanto, não tem PO. */}
          <ClientReferenceTag value={shipment.client_reference} />
          {shipment.carga_urgente && (
            <span className="portal-small inline-flex items-center gap-1 rounded border border-portal-warning/30 bg-portal-warning/10 px-1.5 py-0.5 font-medium text-portal-warning-ink">
              <AlertTriangle className="h-3.5 w-3.5" />
              Urgente
            </span>
          )}
        </div>
        <EstadoBadge estado={shipment.estado} />
      </div>

      {/* Rota — origem ilustrativa (ver legenda). ETA e risco de atraso saem do
          bloco `tracking` (ShipsGo): hoje todos os campos vêm NULL, então os
          dois badges caem em "Pendente integração" — nenhum número inventado.
          Três estados possíveis por badge: data real | Pendente integração |
          Sem dado suficiente (a fonte respondeu, a companhia não reportou). */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="portal-small text-portal-neutral">
          {origin.name}, {origin.country}
          <span className="mx-1.5">→</span>
          Brasil
        </span>
        <div
          className={cn(
            'flex flex-wrap items-center gap-x-3 gap-y-1',
            // Demo tracking is framed like every other illustrative surface in
            // the portal: dashed border + the "Pré-visualização" seal, so the
            // dates below can never be mistaken for a carrier feed.
            shipment.tracking?.is_mock &&
              'rounded-lg border border-dashed border-brand-indigo-800/40 bg-brand-indigo-100 px-2 py-1',
          )}
        >
          <span className="inline-flex items-center gap-1.5 portal-small text-portal-neutral">
            ETA
            <ShipmentEtaBadge tracking={shipment.tracking} />
          </span>
          <span className="inline-flex items-center gap-1.5 portal-small text-portal-neutral">
            Risco de atraso
            <ShipmentDelayRiskBadge tracking={shipment.tracking} />
          </span>
          {shipment.tracking?.is_mock && <ProvenanceBadge provenance="preview" />}
        </div>
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
  searchOpen,
  onSearchOpenChange,
}: {
  shipments: PortalShipment[];
  isLoading: boolean;
  /** Driven by the page so the header's "Verificar embarque" can deep-link into
      this tab with the field already expanded. */
  searchOpen: boolean;
  onSearchOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [origin, setOrigin] = useState<string>('all');
  const [originQuery, setOriginQuery] = useState('');
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [quick, setQuick] = useState<ShipmentFilterKey | null>(null);

  const originsPresent = useMemo(() => {
    const names = new Set(shipments.map((s) => originOf(s.referencia).name));
    return ORIGINS.filter((o) => names.has(o.name)).map((o) => o.name);
  }, [shipments]);

  // Filtro client-side do typeahead. Sem acento e sem caixa, para "genova"
  // encontrar "Gênova".
  const matchingOrigins = useMemo(() => {
    const term = originQuery
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
    if (!term) return originsPresent;
    return originsPresent.filter((name) =>
      name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .includes(term),
    );
  }, [originsPresent, originQuery]);

  // Chip sem nenhum embarque não é renderizado AQUI: o conjunto da Lista varia
  // com busca e filtros, e um chip permanentemente zerado no meio dela lê como
  // funcionalidade quebrada. O Mapa faz a escolha oposta, e o porquê está lá.
  const quickCounts = useMemo(
    () => countShipmentFilters(shipments).filter((f) => f.count > 0),
    [shipments],
  );

  // Um chip que fica visível depois de a lista mudar mas já não tem embarque
  // nenhum viraria um filtro invisível com resultado vazio.
  const activeQuick = quickCounts.some((f) => f.key === quick) ? quick : null;

  const filtered = useMemo(() => {
    const term = query.trim();
    const normalizedTerm = term ? normalize(term) : '';
    const cutoff =
      period === 'all'
        ? null
        : Date.now() - Number(period) * 24 * 60 * 60 * 1000;
    return filterShipments(shipments, activeQuick).filter((s) => {
      // A busca aceita a referência interna (EMB-XXXX) OU a PO do cliente — é o
      // mesmo número que ele usa na cotação, e é por ele que ele rastreia.
      if (
        normalizedTerm &&
        !normalize(s.referencia).includes(normalizedTerm) &&
        !matchesClientReference(s.client_reference, term)
      ) {
        return false;
      }
      if (status !== 'all' && ESTADO_SEMAFORO[s.estado] !== status) return false;
      if (origin !== 'all' && originOf(s.referencia).name !== origin) return false;
      if (cutoff != null && new Date(s.created_at).getTime() < cutoff) return false;
      return true;
    });
  }, [shipments, query, status, origin, period, activeQuick]);

  const activeFilters =
    (status !== 'all' ? 1 : 0) + (origin !== 'all' ? 1 : 0) + (period !== 'all' ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Toolbar: counter (left) + icon-only search and compact filter (right) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SemaforoCounter shipments={shipments} />

        <div className="flex items-center gap-2">
          <PortalSearchInput
            value={query}
            onChange={setQuery}
            placeholder="EMB-XXXX ou sua PO…"
            label="Buscar embarque por referência interna ou PO do cliente"
            open={searchOpen}
            onOpenChange={onSearchOpenChange}
          />

          {/* Popover, e não DropdownMenu: o typeahead do DropdownMenu do Radix
              captura as teclas para navegar entre os itens, então um <input>
              dentro dele não recebe o que o usuário digita. A busca de Origem
              precisa de um input de verdade. É também o mesmo controle que
              Minhas Cotações usa (PortalFiltersMenu), então as duas telas
              voltam a ter a mesma toolbar. */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
                {activeFilters > 0 && (
                  <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                    {activeFilters}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-4">
              <div className="space-y-2">
                <Label className="portal-small text-portal-neutral">Situação</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as StatusFilter)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="success">
                      {SEMAFORO_LABELS.success}
                    </SelectItem>
                    <SelectItem value="warning">
                      {SEMAFORO_LABELS.warning}
                    </SelectItem>
                    <SelectItem value="danger">
                      {SEMAFORO_LABELS.danger}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Origem: busca, não lista fixa. A lista de portos vem de
                  port-coordinates.ts (fonte única desde o Prompt 15) e cresce
                  com a operação — enumerar todos num menu deixa de caber. Só as
                  origens presentes nos embarques do cliente entram, e o filtro é
                  client-side sobre elas. */}
              <div className="space-y-2">
                <Label className="portal-small text-portal-neutral">Origem</Label>
                <Input
                  value={originQuery}
                  onChange={(e) => setOriginQuery(e.target.value)}
                  placeholder="Buscar porto…"
                  className="h-9"
                  aria-label="Buscar porto de origem"
                />
                <div className="max-h-44 space-y-0.5 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setOrigin('all');
                      setOriginQuery('');
                    }}
                    className={cn(
                      'portal-small block w-full rounded px-2 py-1.5 text-left transition-colors',
                      origin === 'all'
                        ? 'bg-brand-indigo-100 font-medium text-brand-indigo'
                        : 'text-portal-neutral hover:bg-muted',
                    )}
                  >
                    Todas
                  </button>
                  {matchingOrigins.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setOrigin(name)}
                      className={cn(
                        'portal-small block w-full rounded px-2 py-1.5 text-left transition-colors',
                        origin === name
                          ? 'bg-brand-indigo-100 font-medium text-brand-indigo'
                          : 'text-portal-neutral hover:bg-muted',
                      )}
                    >
                      {name}
                    </button>
                  ))}
                  {matchingOrigins.length === 0 && (
                    <p className="portal-small px-2 py-1.5 text-portal-neutral">
                      Nenhum porto encontrado.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="portal-small text-portal-neutral">
                  Período (abertura)
                </Label>
                <Select
                  value={period}
                  onValueChange={(v) => setPeriod(v as PeriodFilter)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Qualquer data</SelectItem>
                    <SelectItem value="30">Últimos 30 dias</SelectItem>
                    <SelectItem value="90">Últimos 90 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Filtros rápidos: um clique para os recortes do dia a dia. Ficam abaixo
          da toolbar e acima da lista porque respondem "o que preciso olhar
          agora", enquanto o menu Filtros responde "quero recortar por
          dimensão". Chip sem nenhum embarque não é renderizado — um chip
          permanentemente zerado lê como funcionalidade quebrada. */}
      {quickCounts.length > 0 && (
        <ShipmentFilterChips
          filters={quickCounts}
          active={activeQuick}
          total={shipments.length}
          onChange={setQuick}
        />
      )}

      <p className="inline-flex items-center gap-1.5 portal-small text-portal-neutral">
        <Info className="h-3.5 w-3.5" />
        Origem aproximada por região é ilustrativa. ETA e risco de atraso ficam
        pendentes até a integração de rastreamento da companhia marítima.
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

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ChevronRight, Info, SlidersHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
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
  isExceptionState,
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
import { delayRiskFromTracking } from '../lib/delay-risk';
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

/**
 * Atalhos de um clique para os recortes que o cliente pede no dia a dia. São
 * predicados sobre o dado que a Lista JÁ tem — nada aqui é derivado de uma
 * fonte que não existe.
 *
 * "Embarcados", e não "Em trânsito": `embarcado` é o estado real do GE e
 * significa PARTIDA. "Em trânsito" é o milestone `OCEAN_TRANSIT` do ShipsGo, um
 * degrau da timeline que segue "Pendente integração" — um chip com esse nome
 * selecionaria embarques cuja própria timeline diz que o trânsito é
 * desconhecido, e a tela passaria a dar duas respostas para a mesma pergunta.
 *
 * "Com atraso" sai de `delayRiskFromTracking`, a mesma função pura que desenha o
 * badge do card: um embarque sem rastreamento nunca entra no chip (ele é
 * `pending`, não "no prazo"), então o filtro nunca inventa saúde de carga.
 */
type QuickFilterKey = 'urgentes' | 'embarcados' | 'atraso' | 'excecao';

const QUICK_FILTERS: {
  key: QuickFilterKey;
  label: string;
  match: (shipment: PortalShipment) => boolean;
  tone: SemaforoTone | 'neutral';
}[] = [
  { key: 'urgentes', label: 'Urgentes', tone: 'warning', match: (s) => s.carga_urgente },
  {
    key: 'embarcados',
    label: 'Embarcados',
    tone: 'neutral',
    match: (s) => s.estado === 'embarcado',
  },
  {
    key: 'atraso',
    label: 'Com atraso',
    tone: 'danger',
    match: (s) => {
      const status = delayRiskFromTracking(s.tracking).status;
      return status === 'attention' || status === 'delayed';
    },
  },
  {
    key: 'excecao',
    label: 'Com exceção',
    tone: 'danger',
    match: (s) => isExceptionState(s.estado),
  },
];

const QUICK_FILTER_ACTIVE_CLASS: Record<SemaforoTone | 'neutral', string> = {
  neutral: 'border-primary bg-primary/10 text-primary',
  success: 'border-portal-success bg-portal-success/10 text-portal-success',
  warning: 'border-portal-warning bg-portal-warning/10 text-portal-warning',
  danger: 'border-portal-danger bg-portal-danger/10 text-portal-danger',
};

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
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="portal-body font-medium text-foreground">
            {shipment.referencia}
          </span>
          {/* A PO vem da cotação que originou o embarque; embarque aberto fora
              do portal não tem cotação e, portanto, não tem PO. */}
          <ClientReferenceTag value={shipment.client_reference} />
          {shipment.carga_urgente && (
            <span className="portal-small inline-flex items-center gap-1 rounded border border-portal-warning/30 bg-portal-warning/10 px-1.5 py-0.5 font-medium text-portal-warning">
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
              'rounded-lg border border-dashed border-primary/40 bg-primary/[0.03] px-2 py-1',
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
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [quick, setQuick] = useState<QuickFilterKey | null>(null);

  const originsPresent = useMemo(() => {
    const names = new Set(shipments.map((s) => originOf(s.referencia).name));
    return ORIGINS.filter((o) => names.has(o.name)).map((o) => o.name);
  }, [shipments]);

  // Contagem por chip sobre a lista COMPLETA, não sobre a filtrada: o número no
  // chip responde "quantos existem", e recontá-lo sobre o próprio recorte faria
  // todo chip inativo mostrar 0 assim que outro fosse ligado.
  const quickCounts = useMemo(
    () =>
      QUICK_FILTERS.map((f) => ({
        ...f,
        count: shipments.filter(f.match).length,
      })).filter((f) => f.count > 0),
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
    const quickMatch = QUICK_FILTERS.find((f) => f.key === activeQuick)?.match;
    return shipments.filter((s) => {
      // A busca aceita a referência interna (EMB-XXXX) OU a PO do cliente — é o
      // mesmo número que ele usa na cotação, e é por ele que ele rastreia.
      if (
        normalizedTerm &&
        !normalize(s.referencia).includes(normalizedTerm) &&
        !matchesClientReference(s.client_reference, term)
      ) {
        return false;
      }
      if (quickMatch && !quickMatch(s)) return false;
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

      {/* Filtros rápidos: um clique para os recortes do dia a dia. Ficam abaixo
          da toolbar e acima da lista porque respondem "o que preciso olhar
          agora", enquanto o menu Filtros responde "quero recortar por
          dimensão". Chip sem nenhum embarque não é renderizado — um chip
          permanentemente zerado lê como funcionalidade quebrada. */}
      {quickCounts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setQuick(null)}
            aria-pressed={activeQuick === null}
            className={cn(
              'portal-small rounded-full border px-3 py-1 font-medium transition-colors',
              activeQuick === null
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background text-portal-neutral hover:bg-muted/50',
            )}
          >
            Todos
            <span className="ml-1.5 text-portal-neutral">{shipments.length}</span>
          </button>
          {quickCounts.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setQuick(activeQuick === f.key ? null : f.key)}
              aria-pressed={activeQuick === f.key}
              className={cn(
                'portal-small rounded-full border px-3 py-1 font-medium transition-colors',
                activeQuick === f.key
                  ? QUICK_FILTER_ACTIVE_CLASS[f.tone]
                  : 'border-border bg-background text-portal-neutral hover:bg-muted/50',
              )}
            >
              {f.label}
              <span className="ml-1.5 opacity-70">{f.count}</span>
            </button>
          ))}
        </div>
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

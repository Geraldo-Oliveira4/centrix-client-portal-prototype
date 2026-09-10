'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Clock3,
  SlidersHorizontal,
} from 'lucide-react';
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
import {
  ESTADO_DESCRIPTIONS,
  ESTADO_SEMAFORO,
  SEMAFORO_LABELS,
  type PortalShipment,
  type SemaforoTone,
} from '@/types/portal-shipment';
import type { PortalQuotation } from '@/types/portal';
import {
  ClientReferenceTag,
  matchesClientReference,
} from '../../_shared/client-reference-tag';
import { ModalIcon } from '../../_shared/modal-icon';
import { PortalSearchInput } from '../../_shared/portal-search-input';
import { ProvenanceBadge } from '../../_shared/provenance-badge';
import {
  collectHomeActions,
  type HomeAction,
} from '../../home/lib/home-actions';
import {
  indexQuotations,
  routePartsOf,
} from '../../inteligencia/lib/shipment-dimensions';
import { EstadoBadge } from './estado-badge';
import { arrivalDay, formatShipmentEta } from '../lib/shipment-date';
import { REAL_STEPS } from '../lib/real-steps';
import { delayRiskFromTracking } from '../lib/delay-risk';
import {
  buildShipmentOverview,
  compareShipmentOverview,
  hasArrived,
  SHIPMENT_OVERVIEW_LABELS,
  type ShipmentOverviewKey,
} from '../lib/shipment-overview';

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
const METRICS = [
  {
    key: 'action' as const,
    icon: AlertTriangle,
    description: 'Embarques com ações pendentes',
  },
  {
    key: 'delayed' as const,
    icon: Clock3,
    description: 'Previsão posterior à chegada original',
  },
  {
    key: 'upcoming' as const,
    icon: CalendarDays,
    description: 'No porto ou aeroporto de destino',
  },
];
const ROW_GRID =
  'lg:grid lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1.1fr)_minmax(0,.85fr)_minmax(0,1fr)] lg:gap-6';

function ShipmentCard({
  shipment,
  quotation,
  route,
  actions,
  now,
}: {
  shipment: PortalShipment;
  quotation: PortalQuotation | undefined;
  route: { origin: string; destination: string };
  actions: HomeAction[];
  now: Date;
}) {
  const href = `/portal/embarques/${shipment.id}`;
  const action = actions[0];
  const risk = delayRiskFromTracking(shipment.tracking);
  const arrived = hasArrived(shipment, now);
  const eta =
    shipment.tracking?.data_status === 'INCOMPLETE'
      ? null
      : arrivalDay(shipment.tracking?.current_eta);
  const etaLabel =
    eta == null ? null : formatShipmentEta(shipment.tracking?.current_eta);
  return (
    <article
      className={cn(
        'portal-card p-4 transition-colors hover:border-brand-indigo-800/40 sm:p-5',
        action && 'border-l-[3px] border-l-brand-orange',
      )}
    >
      <div className={cn(ROW_GRID, 'grid grid-cols-1 gap-4 sm:grid-cols-2')}>
        <div className="min-w-0">
          <Link
            href={href}
            className="text-base font-semibold leading-snug text-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            {quotation?.product?.trim() ||
              shipment.client_reference ||
              shipment.referencia}
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <ClientReferenceTag value={shipment.client_reference} />
            <span className="portal-small text-portal-neutral">
              {shipment.referencia}
            </span>
          </div>
          <p className="portal-small mt-2 flex items-start gap-1.5 text-portal-neutral">
            <ModalIcon
              modal={shipment.modal}
              className="mt-0.5 h-4 w-4 shrink-0"
            />
            <span>
              {route.origin} → {route.destination}
            </span>
          </p>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <EstadoBadge estado={shipment.estado} />
            {shipment.carga_urgente && (
              <span className="portal-small font-medium text-portal-warning-ink">
                Urgente
              </span>
            )}
          </div>
          <p className="portal-small mt-2 leading-relaxed text-portal-neutral">
            {arrived
              ? 'A companhia confirmou a chegada ao destino.'
              : ESTADO_DESCRIPTIONS[shipment.estado]}
          </p>
        </div>
        <div className="min-w-0">
          <p className="portal-small text-portal-neutral">
            {arrived ? 'Chegada confirmada' : 'Chegada prevista'}
          </p>
          <p
            className={cn(
              'mt-0.5 font-semibold',
              etaLabel
                ? 'text-xl tracking-tight text-foreground'
                : 'portal-body text-portal-neutral',
            )}
          >
            {etaLabel ?? 'A confirmar'}
          </p>
          {risk.deltaDays != null && eta != null && (
            <p
              className={cn(
                'portal-small mt-1',
                risk.deltaDays > 0
                  ? 'text-portal-warning-ink'
                  : 'text-portal-neutral',
              )}
            >
              {risk.deltaDays > 0
                ? `+${risk.deltaDays} ${risk.deltaDays === 1 ? 'dia' : 'dias'} vs. previsão inicial`
                : 'Dentro da previsão inicial'}
            </p>
          )}
          {shipment.tracking?.is_mock && (
            <div className="mt-1.5">
              <ProvenanceBadge provenance="preview" />
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-col items-start justify-center">
          {action ? (
            <>
              <p className="portal-small mb-2 font-medium text-portal-warning-ink">
                Sua ação é necessária
              </p>
              <Link
                href={action.href}
                className="portal-small inline-flex min-h-9 items-center gap-2 rounded-md border border-brand-orange/40 bg-brand-orange/10 px-3 py-2 font-semibold text-foreground transition-colors hover:bg-brand-orange/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {action.ctaLabel}
                <ArrowRight className="h-4 w-4 shrink-0" />
              </Link>
              {actions.length > 1 && (
                <span className="portal-small mt-1.5 text-portal-neutral">
                  +{actions.length - 1}{' '}
                  {actions.length === 2
                    ? 'ação no detalhe'
                    : 'ações no detalhe'}
                </span>
              )}
            </>
          ) : (
            <>
              <p className="portal-small text-portal-neutral">
                Sem ação pendente para você
              </p>
              <Link
                href={href}
                className="portal-small mt-2 inline-flex min-h-9 items-center gap-1 font-semibold text-brand-indigo hover:underline"
              >
                Acompanhar embarque
                <ChevronRight className="h-4 w-4" />
              </Link>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

export function ShipmentListTab({
  shipments,
  quotations,
  isLoading,
  searchOpen,
  onSearchOpenChange,
}: {
  shipments: PortalShipment[];
  quotations: PortalQuotation[];
  isLoading: boolean;
  searchOpen: boolean;
  onSearchOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<SemaforoTone | 'all'>('all');
  const [origin, setOrigin] = useState('all');
  const [originQuery, setOriginQuery] = useState('');
  const [period, setPeriod] = useState('all');
  const [metric, setMetric] = useState<ShipmentOverviewKey | null>(null);
  const [urgentOnly, setUrgentOnly] = useState(false);
  const byQuotation = useMemo(() => indexQuotations(quotations), [quotations]);
  const routes = useMemo(
    () => new Map(shipments.map((s) => [s.id, routePartsOf(s, byQuotation)])),
    [shipments, byQuotation],
  );
  // One shared pipeline with Home and shipment detail. Count shipments, not tasks.
  const now = new Date();
  const { groups, actionsByShipment } = buildShipmentOverview(
    shipments,
    collectHomeActions({ shipments, buckets: {}, realSteps: REAL_STEPS, now }),
    now,
  );
  const origins = Array.from(
    new Set(Array.from(routes.values()).map((r) => r.origin)),
  ).sort();
  const matchingOrigins = origins.filter((name) =>
    normalize(name).includes(normalize(originQuery)),
  );
  const activeFilters =
    Number(status !== 'all') +
    Number(origin !== 'all') +
    Number(period !== 'all');
  const clearFilters = () => {
    setQuery('');
    setStatus('all');
    setOrigin('all');
    setOriginQuery('');
    setPeriod('all');
    setMetric(null);
    setUrgentOnly(false);
  };
  const selectMetric = (key: ShipmentOverviewKey) => {
    clearFilters();
    setMetric(metric === key ? null : key);
  };
  const cutoff =
    period === 'all' ? null : now.getTime() - Number(period) * 86_400_000;
  const filtered = shipments
    .filter((s) => {
      if (metric && !groups[metric].has(s.id)) return false;
      if (urgentOnly && !s.carga_urgente) return false;
      if (status !== 'all' && ESTADO_SEMAFORO[s.estado] !== status)
        return false;
      if (origin !== 'all' && routes.get(s.id)?.origin !== origin) return false;
      if (cutoff != null && new Date(s.created_at).getTime() < cutoff)
        return false;
      const term = normalize(query);
      return (
        !term ||
        normalize(s.referencia).includes(term) ||
        matchesClientReference(s.client_reference, query.trim()) ||
        normalize(
          byQuotation.get(s.quotation_id ?? '')?.product ?? '',
        ).includes(term)
      );
    })
    .sort((a, b) => compareShipmentOverview(a, b, groups, now, metric));
  const hasFilters = !!metric || !!query || urgentOnly || activeFilters > 0;

  return (
    <div className="space-y-5">
      <div
        className="grid overflow-hidden rounded-xl border border-border bg-card md:grid-cols-3"
        aria-label="Resumo dos embarques"
      >
        {METRICS.map(({ key, icon: Icon, description }) => (
          <button
            key={key}
            type="button"
            aria-pressed={metric === key}
            onClick={() => selectMetric(key)}
            className={cn(
              'group relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 min-w-0 border-b border-border px-5 py-4 md:block md:py-5 text-left transition-colors last:border-b-0 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-brand-indigo md:border-b-0 md:border-r md:last:border-r-0',
              metric === key
                ? 'bg-brand-indigo-100 border-b-2 border-b-brand-indigo'
                : key === 'action' && groups.action.size > 0
                  ? 'bg-brand-orange/5 hover:bg-brand-orange/10'
                  : 'hover:bg-muted/50',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="portal-body font-medium text-foreground">
                {SHIPMENT_OVERVIEW_LABELS[key]}
              </span>
              <Icon
                className={cn(
                  'hidden h-4 w-4 shrink-0 md:block',
                  key === 'action'
                    ? 'text-portal-warning-ink'
                    : 'text-portal-neutral',
                )}
              />
            </div>
            <div className="col-start-2 row-start-1 row-span-2 flex items-center justify-between self-center md:mt-2 md:items-end">
              <span className="text-4xl font-semibold tabular-nums tracking-tight text-brand-indigo">
                {groups[key].size}
              </span>
              <ArrowRight className="mb-1 hidden h-4 w-4 text-portal-neutral transition-transform group-hover:translate-x-1 md:block" />
            </div>
            <p className="portal-small col-start-1 mt-1 text-portal-neutral md:mt-2">
              {description}
            </p>
          </button>
        ))}
      </div>
      <p className="portal-small !mt-2 text-portal-neutral">
        Um embarque pode aparecer em mais de um indicador. Próximos 7 dias
        incluem hoje.
        {shipments.some((s) => s.tracking?.is_mock) &&
          ' Rastreamento em pré-visualização.'}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p
            className="portal-body font-medium text-foreground"
            aria-live="polite"
          >
            {metric ? SHIPMENT_OVERVIEW_LABELS[metric] : 'Todos os embarques'}
            <span className="ml-2 font-normal text-portal-neutral">
              {filtered.length}
            </span>
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="portal-small min-h-9 text-brand-indigo underline underline-offset-4"
            >
              Limpar filtros
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PortalSearchInput
            value={query}
            onChange={setQuery}
            placeholder="Carga, PO ou EMB…"
            label="Buscar por carga, PO ou referência do embarque"
            open={searchOpen}
            onOpenChange={onSearchOpenChange}
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <SlidersHorizontal className="h-4 w-4" />
                Filtros{activeFilters > 0 && ` (${activeFilters})`}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-4">
              <div className="space-y-2">
                <Label>Situação operacional</Label>
                <Select
                  value={status}
                  onValueChange={(value) =>
                    setStatus(value as SemaforoTone | 'all')
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {(['success', 'warning', 'danger'] as const).map((tone) => (
                      <SelectItem key={tone} value={tone}>
                        {SEMAFORO_LABELS[tone]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Origem</Label>
                <Input
                  value={originQuery}
                  onChange={(e) => setOriginQuery(e.target.value)}
                  placeholder="Buscar porto ou aeroporto…"
                  aria-label="Buscar origem"
                />
                <div className="max-h-44 overflow-y-auto">
                  {[
                    { value: 'all', label: 'Todas' },
                    ...matchingOrigins.map((name) => ({
                      value: name,
                      label: name,
                    })),
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={origin === value}
                      onClick={() => setOrigin(value)}
                      className={cn(
                        'portal-small block w-full rounded px-2 py-2 text-left',
                        origin === value
                          ? 'bg-brand-indigo-100 font-semibold text-brand-indigo'
                          : 'hover:bg-muted',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                  {matchingOrigins.length === 0 && (
                    <p className="portal-small p-2 text-portal-neutral">
                      Nenhuma origem encontrada.
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Período de abertura</Label>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger>
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
          <Button
            variant={urgentOnly ? 'secondary' : 'outline'}
            size="sm"
            aria-pressed={urgentOnly}
            onClick={() => setUrgentOnly(!urgentOnly)}
          >
            Urgentes
          </Button>
        </div>
      </div>
      <div
        className={cn(
          ROW_GRID,
          'portal-small !mb-2 hidden px-5 text-portal-neutral lg:grid',
        )}
      >
        <span>Carga / referência</span>
        <span>Situação</span>
        <span>Chegada ao destino</span>
        <span>Próxima ação</span>
      </div>
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-32 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="portal-card p-8 text-center">
          <p className="portal-body font-medium">
            Nenhum embarque neste recorte
          </p>
          <p className="portal-small mt-1 text-portal-neutral">
            Ajuste a busca ou limpe os filtros para ver os demais embarques.
          </p>
          <Button variant="outline" className="mt-4" onClick={clearFilters}>
            Ver todos os embarques
          </Button>
        </div>
      ) : (
        <div className="space-y-3" aria-label="Lista de embarques">
          {filtered.map((shipment) => (
            <ShipmentCard
              key={shipment.id}
              shipment={shipment}
              now={now}
              quotation={byQuotation.get(shipment.quotation_id ?? '')}
              route={routes.get(shipment.id)!}
              actions={actionsByShipment.get(shipment.id) ?? []}
            />
          ))}
        </div>
      )}
      <p className="portal-small text-portal-neutral">
        Ordenação:{' '}
        {metric === 'upcoming'
          ? 'chegada mais próxima primeiro.'
          : 'suas pendências primeiro, depois atrasos e demais embarques.'}{' '}
        Rotas sem cotação vinculada são ilustrativas.
      </p>
    </div>
  );
}

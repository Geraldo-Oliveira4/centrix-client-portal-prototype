'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ChevronRight,
  FileText,
  Hourglass,
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
import { PO_STAGE_DESCRIPTIONS } from '../../_shared/demo/shipment-po-review';
import {
  NoQuotationChip,
  PoStageBadge,
  poNextStepLabel,
} from '../../_shared/demo/shipment-po-labels';
import {
  countShipmentsInPoReview,
  hidesRoute,
  poRouteLabel,
  type PortalShipmentWithReview,
} from '../../_shared/demo/shipment-po-merge';
import {
  buildShipmentOverview,
  compareShipmentOverview,
  hasArrived,
} from '../lib/shipment-overview';
import {
  SHIPMENT_LIST_RECORTE_LABELS,
  shipmentsWithPendingDocuments,
  type ShipmentListRecorte,
} from '../lib/shipment-indicators';
import { ShipmentIndicatorStrip } from './shipment-indicator-strip';

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
const ROW_GRID =
  'lg:grid lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1.1fr)_minmax(0,.85fr)_minmax(0,1fr)] lg:gap-6';

function ShipmentCard({
  shipment,
  quotation,
  route,
  actions,
  now,
}: {
  shipment: PortalShipmentWithReview;
  quotation: PortalQuotation | undefined;
  route: { origin: string; destination: string };
  actions: HomeAction[];
  now: Date;
}) {
  // EMBARQUE VIA PO (Tela 7). `review` e `undefined` em todo embarque comum, e
  // nesse caso nada abaixo muda.
  const review = shipment.review_status;
  const inReview = hidesRoute(shipment);
  // Um embarque em analise ainda nao tem detalhe: o que existe dele e o
  // formulario. O ATIVO sem cotacao vai para o cenario da previa que exercita a
  // Tela 9 (vincular cotacao).
  const href = inReview
    ? `/portal/embarques/novo?rascunho=${shipment.id}`
    : review && !review.hasQuotation
      ? `/portal/embarques/${shipment.id}?cenario=sem-cotacao`
      : `/portal/embarques/${shipment.id}`;
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
              review?.title ||
              shipment.client_reference ||
              shipment.referencia}
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <ClientReferenceTag value={shipment.client_reference} />
            <span className="portal-small text-portal-neutral">
              {shipment.referencia}
            </span>
            {review && !review.hasQuotation && <NoQuotationChip />}
          </div>
          <p className="portal-small mt-2 flex items-start gap-1.5 text-portal-neutral">
            <ModalIcon
              modal={shipment.modal}
              className="mt-0.5 h-4 w-4 shrink-0"
            />
            {/* "A definir" em vez do hub ILUSTRATIVO: para um embarque que a
                Freitas ainda nao reviu, inventar um porto seria inventar
                justamente o dado que a revisao existe para estabelecer. */}
            <span>
              {poRouteLabel(shipment) ??
                `${route.origin} → ${route.destination}`}
            </span>
          </p>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {inReview && review ? (
              <PoStageBadge stage={review.stage} />
            ) : (
              <EstadoBadge estado={shipment.estado} />
            )}
            {shipment.carga_urgente && (
              <span className="portal-small font-medium text-portal-warning-ink">
                Urgente
              </span>
            )}
          </div>
          <p className="portal-small mt-2 leading-relaxed text-portal-neutral">
            {/* A descricao do ESTADO fala da jornada operacional ("aberto a
                partir da cotacao aprovada"), que nao e verdade para um embarque
                aberto por PO. Enquanto ele esta em analise, quem descreve a
                situacao e a propria etapa. */}
            {/* Vale para TODO embarque aberto por PO, nao so enquanto em
                analise: "aberto a partir da cotacao aprovada" continua falso
                depois de ele ser validado, porque cotacao e justamente o que
                ele nao tem. */}
            {review && !review.hasQuotation
              ? PO_STAGE_DESCRIPTIONS[review.stage]
              : arrived
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
          {/* PROXIMO PASSO do embarque em analise (Tela 7). Ele substitui a
              coluna de acao porque, enquanto a Freitas revisa, nao ha acao do
              cliente — o que existe e um prazo. */}
          {inReview && review ? (
            <>
              <p className="portal-small font-medium text-portal-warning-ink">
                {review.stage === 'returned' && review.returnReason
                  ? `Ajuste pedido pela Freitas: ${review.returnReason}`
                  : poNextStepLabel(review.since)}
              </p>
              <Link
                href={href}
                className="portal-small mt-2 inline-flex min-h-9 items-center gap-1 font-semibold text-brand-indigo hover:underline"
              >
                {review.stage === 'returned'
                  ? 'Corrigir e reenviar'
                  : 'Ver os dados enviados'}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </>
          ) : action ? (
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
  initialRecorte = null,
}: {
  shipments: PortalShipmentWithReview[];
  quotations: PortalQuotation[];
  isLoading: boolean;
  searchOpen: boolean;
  onSearchOpenChange: (open: boolean) => void;
  /**
   * Recorte vindo de `?indicador=` — os deep links da Home e os que antes
   * apontavam para a aba Alertas (removida em 02/10/2026) chegam por aqui.
   */
  initialRecorte?: ShipmentListRecorte | null;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<SemaforoTone | 'all'>('all');
  const [origin, setOrigin] = useState('all');
  const [originQuery, setOriginQuery] = useState('');
  const [period, setPeriod] = useState('all');
  const [metric, setMetric] = useState<ShipmentListRecorte | null>(
    initialRecorte,
  );
  const [urgentOnly, setUrgentOnly] = useState(false);
  // EMBARQUE VIA PO (Tela 7). `reviewOnly` e um recorte a parte dos `METRICS`:
  // "em analise" nao e um estado operacional do embarque, e sim uma etapa antes
  // de ele existir para a operacao — misturar os dois no mesmo grupo faria a
  // soma dos indicadores deixar de fechar com a carteira.
  const [reviewOnly, setReviewOnly] = useState(false);
  const inReviewCount = countShipmentsInPoReview(shipments);
  const byQuotation = useMemo(() => indexQuotations(quotations), [quotations]);
  const routes = useMemo(
    () => new Map(shipments.map((s) => [s.id, routePartsOf(s, byQuotation)])),
    [shipments, byQuotation],
  );
  // One shared pipeline with Home and shipment detail. Count shipments, not
  // tasks. Os grupos SÃO os indicadores da fonte única (shipment-indicators.ts).
  const [now] = useState(() => new Date());
  const actionList = useMemo(
    () =>
      collectHomeActions({ shipments, buckets: {}, realSteps: REAL_STEPS, now }),
    [shipments, now],
  );
  const { groups, actionsByShipment } = useMemo(
    () => buildShipmentOverview(shipments, actionList, now),
    [shipments, actionList, now],
  );
  // "Pendências documentais", o filtro útil que veio da antiga aba Alertas.
  const withDocuments = useMemo(
    () => shipmentsWithPendingDocuments(actionList),
    [actionList],
  );
  const inRecorte = (key: ShipmentListRecorte, id: string) =>
    key === 'documentos' ? withDocuments.has(id) : groups[key].has(id);
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
    setReviewOnly(false);
    setQuery('');
    setStatus('all');
    setOrigin('all');
    setOriginQuery('');
    setPeriod('all');
    setMetric(null);
    setUrgentOnly(false);
  };
  const selectMetric = (key: ShipmentListRecorte | null) => {
    clearFilters();
    setMetric(key == null || metric === key ? null : key);
  };
  const cutoff =
    period === 'all' ? null : now.getTime() - Number(period) * 86_400_000;
  const filtered = shipments
    .filter((s) => {
      if (reviewOnly && !hidesRoute(s)) return false;
      if (metric && !inRecorte(metric, s.id)) return false;
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
    .sort((a, b) =>
      compareShipmentOverview(
        a,
        b,
        groups,
        now,
        metric === 'documentos' ? null : metric,
      ),
    );
  const hasFilters =
    !!metric || !!query || urgentOnly || reviewOnly || activeFilters > 0;

  return (
    <div className="space-y-5">
      <ShipmentIndicatorStrip
        indicators={groups}
        active={metric === 'documentos' ? null : metric}
        onSelect={selectMetric}
      >
        {/* O quarto indicador so existe quando ha algo em analise: um "0 em
            analise pela Freitas" permanente seria uma coluna morta na tela de
            todo cliente que nunca abriu um embarque por PO. */}
        {inReviewCount > 0 && (
          <button
            type="button"
            aria-pressed={reviewOnly}
            onClick={() => {
              const next = !reviewOnly;
              clearFilters();
              setReviewOnly(next);
            }}
            className={cn(
              'group relative min-w-0 border-b border-r border-border px-4 py-3 text-left transition-colors focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-brand-indigo',
              reviewOnly
                ? 'bg-brand-indigo-100 shadow-[inset_0_-2px_0] shadow-brand-indigo'
                : 'hover:bg-muted/50',
            )}
          >
            <span className="flex items-start justify-between gap-2">
              <span className="portal-small font-medium text-foreground">
                Em análise pela Freitas
              </span>
              <Hourglass className="mt-0.5 h-4 w-4 shrink-0 text-portal-neutral" />
            </span>
            <span className="mt-1 flex items-end justify-between">
              <span className="text-3xl font-semibold tabular-nums tracking-tight text-brand-indigo">
                {inReviewCount}
              </span>
              <ArrowRight className="mb-1 h-4 w-4 text-portal-neutral transition-transform group-hover:translate-x-1" />
            </span>
          </button>
        )}
      </ShipmentIndicatorStrip>
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
            {metric ? SHIPMENT_LIST_RECORTE_LABELS[metric] : 'Todos os embarques'}
            <span className="ml-2 font-normal text-portal-neutral">
              {filtered.length}
            </span>
          </p>
          {/* Recorte herdado da aba Alertas. Não é indicador (não entra na
              faixa nem na Home); é um atalho da lista, lido da mesma fila de
              ações que alimenta "Precisam de você". */}
          {withDocuments.size > 0 && (
            <button
              type="button"
              aria-pressed={metric === 'documentos'}
              onClick={() => selectMetric('documentos')}
              className={cn(
                'portal-small inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                metric === 'documentos'
                  ? 'border-brand-indigo-800 bg-brand-indigo-100 text-brand-indigo'
                  : 'border-border text-portal-neutral hover:bg-muted/50',
              )}
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              {SHIPMENT_LIST_RECORTE_LABELS.documentos}
              <span className="tabular-nums text-foreground">
                {withDocuments.size}
              </span>
            </button>
          )}
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
          {/* "Em análise (n)" (Tela 7), ao lado dos outros recortes. */}
          {inReviewCount > 0 && (
            <Button
              variant={reviewOnly ? 'secondary' : 'outline'}
              size="sm"
              className="gap-1.5"
              aria-pressed={reviewOnly}
              onClick={() => {
                const next = !reviewOnly;
                clearFilters();
                setReviewOnly(next);
              }}
            >
              <Hourglass className="h-4 w-4 shrink-0" />
              Em análise ({inReviewCount})
            </Button>
          )}
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

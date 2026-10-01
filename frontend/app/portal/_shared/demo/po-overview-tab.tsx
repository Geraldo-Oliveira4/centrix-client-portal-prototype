'use client';

// RQ-12 — a aba "Visão por PO", segunda versão (Prompt 4, 01/10/2026).
//
// SÓ PROTÓTIPO, para validar aderência com clientes; a gestão por PO de verdade
// é V2. Feedback do Vinicius: a primeira versão era "muito quadradona" —
// cartões iguais, metade vazia, "Sem previsão" repetido, régua de um ponto só.
//
// A PERGUNTA é "quando chega cada PO, e algum está em risco?". A resposta:
//   - uma faixa de resumo que também filtra;
//   - uma linha do tempo com eixo COMPARTILHADO (a mesma régua para todos os
//     POs, com "hoje" marcado), uma linha por PO, uma barra por embarque;
//   - "Sem previsão" deixa de ser lacuna e vira a ação que destrava o ETA.
//
// O QUE NÃO MUDOU: nenhuma data é estimada aqui. A barra só tem os pontos que
// existem (prontidão da cotação, partida reportada pela companhia, chegada
// prevista) — a regra está em `po-overview.ts`, que é puro e testado.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  GanttChartSquare,
  List,
  Package,
} from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useMyQuotations } from '@/hooks/use-portal-quotations';
import { formatShortDate } from '@/lib/portal-formatters';
import { cn } from '@/lib/utils';
import { ESTADO_LABELS } from '@/types/portal-shipment';
import { MODAL_LABELS } from '@/types/quotation';

import { flattenQuotations } from '../../inteligencia/lib/intel-helpers';
import { SectionHeading } from '../page-header';
import {
  PO_BUCKET_LABELS,
  PO_BUCKET_ORDER,
  PO_FILTER_LABELS,
  PO_POINT_LABELS,
  PO_STEP_ESTADOS,
  axisPercent,
  groupShipmentsByPo,
  matchesPoFilter,
  poGroupStatus,
  poTimelineAxis,
  shipmentBarPoints,
  shipmentProgress,
  splitPoCount,
  type PoBucket,
  type PoFilter,
  type PoGroupStatus,
  type PoOverviewGroup,
  type PoOverviewShipment,
  type PoTimelineAxis,
} from './po-overview';
import { PO_STAGE_LABELS } from './shipment-po-review';
import type { PortalShipmentWithReview } from './shipment-po-merge';
import { useClientKind } from './use-client-profile';
import { useShipmentPoStore } from './use-shipment-po-review';

type View = 'timeline' | 'lista';

interface Row {
  group: PoOverviewGroup;
  status: PoGroupStatus;
}

const modalLabel = (modal: string | null) =>
  modal ? (MODAL_LABELS[modal] ?? modal) : 'Modal a confirmar';

function nextArrivalText(status: PoGroupStatus): string {
  if (status.allArrived) return 'Tudo entregue no destino';
  if (status.daysToNext == null) return 'Sem previsão de chegada';
  if (status.daysToNext < 0)
    return `Previsão vencida há ${-status.daysToNext} d`;
  if (status.daysToNext === 0) return 'Chega hoje';
  if (status.daysToNext === 1) return 'Chega amanhã';
  return `Chega em ${status.daysToNext} dias · ${formatShortDate(status.nextEta)}`;
}

// ---------------------------------------------------------------- resumo --

/**
 * As cores seguem a escala de urgência (`_shared/urgency.ts`): só tem cor o que
 * pede ação do CLIENTE. "Sem previsão" pede (informar a prontidão destrava o
 * ETA) e é atenção. "Em risco" é informação — o cliente não resolve atraso de
 * armador — e por isso fica neutro, marcado pelo ícone, nunca vermelho.
 */
const FILTER_STYLE: Record<PoFilter, string> = {
  ativos: 'text-foreground',
  sete_dias: 'text-portal-info',
  risco: 'text-foreground',
  sem_previsao: 'text-portal-warning-ink',
};

function SummaryChips({
  counts,
  active,
  onToggle,
}: {
  counts: Record<PoFilter, number>;
  active: PoFilter | null;
  onToggle: (filter: PoFilter) => void;
}) {
  return (
    <div
      className="grid grid-cols-2 gap-2 lg:grid-cols-4"
      role="group"
      aria-label="Filtrar pedidos"
    >
      {(Object.keys(PO_FILTER_LABELS) as PoFilter[]).map((filter) => {
        const pressed = active === filter;
        return (
          <button
            key={filter}
            type="button"
            aria-pressed={pressed}
            onClick={() => onToggle(filter)}
            className={cn(
              'flex min-h-11 items-center justify-between gap-2 rounded-lg border bg-card px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              pressed
                ? 'border-brand-indigo-800 ring-1 ring-brand-indigo-800'
                : 'border-border hover:bg-muted/40',
              filter === 'sem_previsao' &&
                counts.sem_previsao > 0 &&
                !pressed &&
                'border-portal-warning/50',
            )}
          >
            <span className="portal-small flex items-center gap-1.5 text-portal-neutral">
              {filter === 'risco' && counts.risco > 0 && (
                <AlertTriangle
                  className="h-4 w-4 text-portal-warning-ink"
                  aria-hidden="true"
                />
              )}
              {filter === 'sem_previsao' && counts.sem_previsao > 0 && (
                <CalendarClock
                  className="h-4 w-4 text-portal-warning-ink"
                  aria-hidden="true"
                />
              )}
              {PO_FILTER_LABELS[filter]}
            </span>
            <span
              className={cn('portal-h2 tabular-nums', FILTER_STYLE[filter])}
            >
              {counts[filter]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------- linha do tempo --

function MiniSteps({ shipment }: { shipment: PoOverviewShipment }) {
  const index = PO_STEP_ESTADOS.indexOf(shipment.estado);
  return (
    <span
      className="flex items-center gap-1"
      aria-label={`Etapa: ${shipment.stateLabel}`}
    >
      {PO_STEP_ESTADOS.map((estado, i) => (
        <span
          key={estado}
          title={ESTADO_LABELS[estado]}
          className={cn(
            'h-1.5 w-4 rounded-full',
            shipment.arrived || (index >= 0 && i <= index)
              ? 'bg-brand-indigo'
              : 'bg-muted',
          )}
        />
      ))}
      <span
        title="Chegada"
        className={cn(
          'h-1.5 w-4 rounded-full',
          shipment.arrived ? 'bg-portal-success' : 'bg-muted',
        )}
      />
    </span>
  );
}

function datesSummary(shipment: PoOverviewShipment): string {
  const points = shipmentBarPoints(shipment);
  if (!points.length) return 'Sem datas ainda';
  return points
    .map(
      (p) =>
        `${p.kind === 'chegada' && p.actual ? 'Chegou' : PO_POINT_LABELS[p.kind]} ${formatShortDate(p.date)}`,
    )
    .join(' · ');
}

function ShipmentBar({
  shipment,
  axis,
  saas,
}: {
  shipment: PoOverviewShipment;
  axis: PoTimelineAxis;
  saas: boolean;
}) {
  const points = shipmentBarPoints(shipment);

  if (!points.length) {
    // "Sem previsão" vira AÇÃO: a barra tracejada parte de hoje e diz o que
    // destrava a previsão. Não ocupa nenhuma data — é um convite, não um prazo.
    const left = axisPercent(axis, axis.todayDay);
    return (
      <Link
        href={`/portal/embarques/${shipment.id}`}
        className="group relative block h-7 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`${shipment.reference}: sem previsão. Informe a data de prontidão`}
      >
        <span
          className="portal-small absolute top-0.5 flex h-6 items-center gap-1 whitespace-nowrap rounded-full border border-dashed border-portal-warning/70 bg-portal-warning/10 px-2.5 font-medium text-portal-warning-ink group-hover:underline"
          style={{ left: `min(${left}%, calc(100% - 15rem))` }}
        >
          <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
          Informe a data de prontidão
          <span className="sr-only">
            {saas
              ? ' — dela sai a previsão de chegada'
              : ' — a Freitas monitora essa data e dela sai a previsão de chegada'}
          </span>
        </span>
      </Link>
    );
  }

  const first = points[0];
  const last = points[points.length - 1];
  const start = axisPercent(axis, first.date);
  const end = axisPercent(axis, last.date);
  const todayPct = axisPercent(axis, axis.todayDay);
  const atRisk = !!shipment.riskReason;
  // Trilho de "falta quanto": de hoje até a chegada prevista, pontilhado. Usa
  // só duas datas que existem (hoje e a chegada) e não cria ponto nenhum.
  const etaPct =
    shipment.eta && !shipment.arrived ? axisPercent(axis, shipment.eta) : null;
  const remaining =
    etaPct != null && etaPct > todayPct
      ? {
          from: Math.max(todayPct, start === etaPct ? todayPct : start),
          to: etaPct,
        }
      : null;
  const hitFrom = Math.min(start, remaining?.from ?? start);
  const hitTo = Math.max(end, remaining?.to ?? end);

  return (
    <div className="relative h-7">
      {remaining && (
        <span
          aria-hidden="true"
          className="absolute top-[13px] h-0 border-t-2 border-dotted border-brand-indigo/40"
          style={{
            left: `${remaining.from}%`,
            width: `${Math.max(0.5, remaining.to - remaining.from)}%`,
          }}
        />
      )}
      {points.length > 1 && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-3 h-1.5 rounded-full',
            atRisk ? 'bg-portal-warning/60' : 'bg-brand-indigo/40',
          )}
          style={{ left: `${start}%`, width: `${Math.max(0.6, end - start)}%` }}
        />
      )}
      {points.map((point) => (
        <span
          key={point.kind}
          aria-hidden="true"
          className={cn(
            'absolute top-1.5 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-card',
            point.kind === 'prontidao' && 'bg-card ring-2 ring-brand-indigo/60',
            point.kind === 'embarque' && 'bg-brand-indigo/70',
            point.kind === 'chegada' &&
              (point.actual
                ? 'bg-portal-success'
                : atRisk
                  ? 'bg-portal-warning'
                  : 'bg-brand-indigo'),
          )}
          style={{ left: `${axisPercent(axis, point.date)}%` }}
        />
      ))}
      {/* O alvo de foco e de toque cobre só a extensão da barra, para o
          tooltip abrir junto dos pontos e não no meio da linha. */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={`/portal/embarques/${shipment.id}`}
            className="absolute top-0 h-7 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{
              left: `calc(${hitFrom}% - 10px)`,
              width: `calc(${Math.max(0, hitTo - hitFrom)}% + 20px)`,
            }}
            aria-label={`${shipment.reference}: ${datesSummary(shipment)}${atRisk ? `. Em risco: ${shipment.riskReason}` : ''}`}
          />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="portal-small font-medium">{shipment.reference}</p>
          {points.map((p) => (
            <p key={p.kind} className="portal-small">
              {p.kind === 'chegada' && p.actual
                ? 'Chegou'
                : PO_POINT_LABELS[p.kind]}
              : {formatShortDate(p.date)}
            </p>
          ))}
          {atRisk && (
            <p className="portal-small font-medium">
              Em risco: {shipment.riskReason}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function AxisHeader({ axis }: { axis: PoTimelineAxis }) {
  const todayPct = axisPercent(axis, axis.todayDay);
  return (
    <div className="relative h-6" aria-hidden="true">
      {axis.ticks.map((tick) => (
        <span
          key={tick.day}
          className="portal-small absolute top-0 -translate-x-1/2 text-portal-neutral"
          style={{ left: `${axisPercent(axis, tick.day)}%` }}
        >
          {tick.label}
        </span>
      ))}
      <span
        className="portal-small absolute top-0 -translate-x-1/2 rounded bg-brand-indigo px-1.5 font-medium text-white dark:bg-brand-indigo-700"
        style={{ left: `${todayPct}%` }}
      >
        Hoje
      </span>
    </div>
  );
}

function AxisGuides({ axis }: { axis: PoTimelineAxis }) {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      {axis.ticks.map((tick) => (
        <span
          key={tick.day}
          className="absolute inset-y-0 w-px bg-border/60"
          style={{ left: `${axisPercent(axis, tick.day)}%` }}
        />
      ))}
      <span
        className="absolute inset-y-0 w-0.5 bg-brand-indigo/70"
        style={{ left: `${axisPercent(axis, axis.todayDay)}%` }}
      />
    </span>
  );
}

function StatusLine({ status }: { status: PoGroupStatus }) {
  return (
    <span className="portal-small flex flex-wrap items-center gap-x-2 gap-y-0.5 text-portal-neutral">
      <span>{nextArrivalText(status)}</span>
      {status.atRisk && (
        <span className="inline-flex items-center gap-1 font-medium text-foreground">
          <AlertTriangle
            className="h-4 w-4 text-portal-warning-ink"
            aria-hidden="true"
          />
          Em risco
        </span>
      )}
    </span>
  );
}

function ExpandedDetail({
  group,
  saas,
}: {
  group: PoOverviewGroup;
  saas: boolean;
}) {
  const items = group.shipments.flatMap((s) =>
    s.items.map((item) => ({ ...item, shipment: s.reference })),
  );
  return (
    <div className="space-y-3 rounded-lg bg-muted/30 p-4 motion-safe:animate-in motion-safe:fade-in-0">
      <ul className="space-y-3">
        {group.shipments.map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"
          >
            <span className="min-w-0">
              <Link
                href={`/portal/embarques/${s.id}`}
                className="portal-body font-medium text-foreground hover:underline"
              >
                {s.reference}
              </Link>
              <span className="portal-small block text-portal-neutral">
                {modalLabel(s.modal)} · {s.stateLabel} · {datesSummary(s)}
              </span>
              {s.riskReason && (
                <span className="portal-small mt-0.5 flex items-center gap-1 text-foreground">
                  <AlertTriangle
                    className="h-4 w-4 text-portal-warning-ink"
                    aria-hidden="true"
                  />
                  {s.riskReason}
                </span>
              )}
              {!s.eta && !s.arrived && (
                <span className="portal-small mt-0.5 block text-portal-warning-ink">
                  {saas
                    ? 'Informe a data de prontidão: dela sai a previsão de chegada.'
                    : 'Informe a data de prontidão: a Freitas monitora essa data e dela sai a previsão de chegada.'}
                </span>
              )}
            </span>
            <MiniSteps shipment={s} />
          </li>
        ))}
      </ul>
      {items.length > 0 && (
        <div>
          <p className="portal-small font-medium text-foreground">
            Itens do pedido
          </p>
          <ul className="portal-small mt-1 grid gap-x-6 gap-y-0.5 text-portal-neutral sm:grid-cols-2">
            {items.map((item, i) => (
              <li key={`${item.shipment}-${item.partNumber}-${i}`}>
                {item.partNumber ? `${item.partNumber} · ` : ''}
                {item.description || 'Sem descrição'}
                {item.quantity != null ? ` · ${item.quantity} un.` : ''}
                <span className="text-portal-neutral/80">
                  {' '}
                  ({item.shipment})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PoRowHeader({
  row,
  open,
  onToggle,
}: {
  row: Row;
  open: boolean;
  onToggle: () => void;
}) {
  const { group, status } = row;
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className="flex w-full min-w-0 items-start gap-2 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {open ? (
        <ChevronDown
          className="mt-0.5 h-4 w-4 shrink-0 text-portal-neutral"
          aria-hidden="true"
        />
      ) : (
        <ChevronRight
          className="mt-0.5 h-4 w-4 shrink-0 text-portal-neutral"
          aria-hidden="true"
        />
      )}
      <span className="min-w-0">
        <span className="portal-body block truncate font-medium text-foreground">
          {group.po}
        </span>
        <span className="portal-small block text-portal-neutral">
          {group.shipments.length}{' '}
          {group.shipments.length === 1 ? 'embarque' : 'embarques'}
        </span>
        <StatusLine status={status} />
      </span>
    </button>
  );
}

function TimelineView({
  buckets,
  axis,
  openKeys,
  toggle,
  saas,
}: {
  buckets: [PoBucket, Row[]][];
  axis: PoTimelineAxis;
  openKeys: Set<string>;
  toggle: (key: string) => void;
  saas: boolean;
}) {
  return (
    <TooltipProvider delayDuration={150}>
      {/* Desktop: eixo compartilhado. */}
      <div className="portal-card hidden overflow-hidden sm:block">
        <div className="grid grid-cols-[15rem_minmax(0,1fr)] gap-x-4 border-b border-border px-4 py-2">
          <span className="portal-small text-portal-neutral">Pedido</span>
          <AxisHeader axis={axis} />
        </div>
        {buckets.map(([bucket, rows]) => (
          <section key={bucket} aria-label={PO_BUCKET_LABELS[bucket]}>
            <h3 className="portal-small border-b border-border bg-muted/30 px-4 py-1.5 font-medium text-foreground">
              {PO_BUCKET_LABELS[bucket]}{' '}
              <span className="text-portal-neutral">· {rows.length}</span>
            </h3>
            {rows.map((row) => {
              const open = openKeys.has(row.group.key);
              return (
                <div
                  key={row.group.key}
                  className="border-b border-border/60 px-4 py-3 last:border-b-0"
                >
                  <div className="grid grid-cols-[15rem_minmax(0,1fr)] items-start gap-x-4">
                    <PoRowHeader
                      row={row}
                      open={open}
                      onToggle={() => toggle(row.group.key)}
                    />
                    <div className="relative space-y-1 py-1">
                      <AxisGuides axis={axis} />
                      {row.group.shipments.map((s) => (
                        <ShipmentBar
                          key={s.id}
                          shipment={s}
                          axis={axis}
                          saas={saas}
                        />
                      ))}
                    </div>
                  </div>
                  {open && (
                    <div className="mt-3 pl-6">
                      <ExpandedDetail group={row.group} saas={saas} />
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        ))}
        <p className="portal-small flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-2 text-portal-neutral">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-card ring-2 ring-brand-indigo/60" />{' '}
            Prontidão
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-brand-indigo/70" />{' '}
            Embarque
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-brand-indigo" /> Chegada
            prevista
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-portal-success" /> Chegou
          </span>
          <span>Só aparecem as datas que já existem.</span>
        </p>
      </div>

      {/* Celular: lista vertical com mini barra de progresso por PO. */}
      <div className="space-y-4 sm:hidden">
        {buckets.map(([bucket, rows]) => (
          <section
            key={bucket}
            aria-label={PO_BUCKET_LABELS[bucket]}
            className="space-y-2"
          >
            <h3 className="portal-small font-medium text-foreground">
              {PO_BUCKET_LABELS[bucket]}{' '}
              <span className="text-portal-neutral">· {rows.length}</span>
            </h3>
            {rows.map((row) => (
              <MobileRow
                key={row.group.key}
                row={row}
                open={openKeys.has(row.group.key)}
                onToggle={() => toggle(row.group.key)}
                saas={saas}
              />
            ))}
          </section>
        ))}
      </div>
    </TooltipProvider>
  );
}

function MobileRow({
  row,
  open,
  onToggle,
  saas,
}: {
  row: Row;
  open: boolean;
  onToggle: () => void;
  saas: boolean;
}) {
  const progresses = row.group.shipments
    .map((s) => shipmentProgress(s))
    .filter((p): p is number => p != null);
  const progress = progresses.length ? Math.min(...progresses) : 0;
  return (
    <article className="portal-card space-y-2 p-4">
      <PoRowHeader row={row} open={open} onToggle={onToggle} />
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={`Progresso do embarque mais atrasado de ${row.group.po}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <div
          className={cn(
            'h-full rounded-full',
            row.status.atRisk ? 'bg-portal-warning' : 'bg-brand-indigo',
          )}
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
      {row.status.withoutForecast > 0 && !open && (
        <Link
          href={`/portal/embarques/${row.group.shipments.find((s) => !s.eta && !s.arrived)?.id ?? row.group.shipments[0].id}`}
          className="portal-small inline-flex min-h-11 items-center gap-1 rounded-full border border-dashed border-portal-warning/70 bg-portal-warning/10 px-3 font-medium text-portal-warning-ink"
        >
          <CalendarClock className="h-4 w-4" aria-hidden="true" /> Informe a
          data de prontidão
        </Link>
      )}
      {open && <ExpandedDetail group={row.group} saas={saas} />}
    </article>
  );
}

// -------------------------------------------------------------------- lista --

function ListView({
  buckets,
  openKeys,
  toggle,
  saas,
}: {
  buckets: [PoBucket, Row[]][];
  openKeys: Set<string>;
  toggle: (key: string) => void;
  saas: boolean;
}) {
  return (
    <div className="space-y-4">
      {buckets.map(([bucket, rows]) => (
        <section
          key={bucket}
          aria-label={PO_BUCKET_LABELS[bucket]}
          className="space-y-2"
        >
          <h3 className="portal-small font-medium text-foreground">
            {PO_BUCKET_LABELS[bucket]}{' '}
            <span className="text-portal-neutral">· {rows.length}</span>
          </h3>
          <ul className="portal-card divide-y divide-border/60">
            {rows.map((row) => {
              const open = openKeys.has(row.group.key);
              return (
                <li key={row.group.key} className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <PoRowHeader
                      row={row}
                      open={open}
                      onToggle={() => toggle(row.group.key)}
                    />
                    <span className="flex items-center gap-2">
                      {row.group.shipments.map((s) => (
                        <MiniSteps key={s.id} shipment={s} />
                      ))}
                    </span>
                  </div>
                  {open && <ExpandedDetail group={row.group} saas={saas} />}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

// --------------------------------------------------------------------- aba --

export function PoOverviewTab({
  shipments,
}: {
  shipments: PortalShipmentWithReview[];
}) {
  const saas = useClientKind() === 'saas';
  const { data: quotationsData } = useMyQuotations();
  const poStore = useShipmentPoStore();
  const [view, setView] = useState<View>('timeline');
  const [filter, setFilter] = useState<PoFilter | null>(null);
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  // Um relógio por montagem: a faixa, os chips e o "hoje" do eixo concordam.
  const [now] = useState(() => new Date());

  const readyByQuotation = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const q of flattenQuotations(quotationsData))
      map.set(q.id, q.data_prontidao ?? null);
    return map;
  }, [quotationsData]);

  const groups = useMemo(
    () =>
      groupShipmentsByPo(shipments, {
        // O rótulo do estado vem da MESMA fonte que a carteira usa: a etapa de
        // revisão quando ela existe, o estado operacional quando não.
        stateLabel: (shipment) =>
          shipment.review_status && shipment.review_status.stage !== 'active'
            ? PO_STAGE_LABELS[shipment.review_status.stage]
            : (ESTADO_LABELS[shipment.estado] ?? shipment.estado),
        readyDate: (shipment) =>
          shipment.quotation_id
            ? (readyByQuotation.get(shipment.quotation_id) ?? null)
            : null,
        items: (shipment) =>
          (poStore[shipment.id]?.data.items ?? []).map((item) => ({
            partNumber: item.partNumber,
            description: item.description,
            quantity: item.quantity,
          })),
      }),
    [shipments, readyByQuotation, poStore],
  );

  const rows: Row[] = useMemo(
    () => groups.map((group) => ({ group, status: poGroupStatus(group, now) })),
    [groups, now],
  );
  const counts = useMemo(() => {
    const out = {
      ativos: 0,
      sete_dias: 0,
      risco: 0,
      sem_previsao: 0,
    } as Record<PoFilter, number>;
    for (const row of rows)
      for (const key of Object.keys(out) as PoFilter[])
        if (matchesPoFilter(row.status, key)) out[key]++;
    return out;
  }, [rows]);
  const visible = filter
    ? rows.filter((row) => matchesPoFilter(row.status, filter))
    : rows;
  const axis = useMemo(() => poTimelineAxis(groups, now), [groups, now]);
  const buckets: [PoBucket, Row[]][] = PO_BUCKET_ORDER.map(
    (bucket) =>
      [
        bucket,
        visible
          .filter((row) => row.status.bucket === bucket)
          .sort(
            (a, b) =>
              Number(b.status.atRisk) - Number(a.status.atRisk) ||
              (a.status.daysToNext ?? 9999) - (b.status.daysToNext ?? 9999) ||
              a.group.po.localeCompare(b.group.po),
          ),
      ] as [PoBucket, Row[]],
  ).filter(([, list]) => list.length > 0);

  const toggle = (key: string) =>
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center">
        <Package className="h-6 w-6 text-portal-neutral" aria-hidden="true" />
        <p className="portal-h3 mt-2">Nenhum pedido para acompanhar ainda</p>
        <p className="portal-small mt-1 max-w-md text-portal-neutral">
          Quando um embarque tiver o número do seu PO, ele aparece aqui agrupado
          pelo pedido, com a chegada prevista de cada carga.
        </p>
      </div>
    );
  }

  const split = splitPoCount(groups);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeading
          title="Seus pedidos"
          hint={
            split > 0
              ? `${split} ${split === 1 ? 'PO dividido' : 'POs divididos'} em mais de um embarque`
              : 'cada PO com os embarques que nasceram dele'
          }
        />
        <div
          role="radiogroup"
          aria-label="Forma de ver"
          className="inline-flex rounded-lg border border-border bg-card p-0.5"
        >
          {(
            [
              ['timeline', 'Linha do tempo', GanttChartSquare],
              ['lista', 'Lista', List],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={view === value}
              onClick={() => setView(value)}
              className={cn(
                'portal-small inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                view === value
                  ? 'bg-brand-indigo-100 text-brand-indigo'
                  : 'text-portal-neutral hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <SummaryChips
        counts={counts}
        active={filter}
        onToggle={(next) =>
          setFilter((current) => (current === next ? null : next))
        }
      />

      <p className="portal-small text-portal-neutral">
        Uma visão por pedido, em avaliação. As datas são as que já existem —
        prontidão, embarque e chegada prevista; nenhuma é estimada aqui.
      </p>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
          <p className="portal-h3">
            {filter === 'risco'
              ? 'Nenhum pedido em risco agora — bom sinal.'
              : filter === 'sem_previsao'
                ? 'Todos os pedidos têm previsão de chegada.'
                : filter === 'sete_dias'
                  ? 'Nenhuma chegada prevista nos próximos 7 dias.'
                  : 'Nenhum pedido ativo — tudo já chegou.'}
          </p>
          <button
            type="button"
            onClick={() => setFilter(null)}
            className="portal-small mt-2 font-medium text-brand-indigo underline underline-offset-4"
          >
            Ver todos os pedidos
          </button>
        </div>
      ) : view === 'timeline' ? (
        <TimelineView
          buckets={buckets}
          axis={axis}
          openKeys={openKeys}
          toggle={toggle}
          saas={saas}
        />
      ) : (
        <ListView
          buckets={buckets}
          openKeys={openKeys}
          toggle={toggle}
          saas={saas}
        />
      )}
    </div>
  );
}

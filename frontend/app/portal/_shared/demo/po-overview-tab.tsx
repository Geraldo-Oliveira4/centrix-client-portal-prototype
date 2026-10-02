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
import { ProvenanceBadge } from '../provenance-badge';
import { buildPoOverviewExample } from './po-overview-examples';
import {
  PO_BUCKET_LABELS,
  PO_BUCKET_ORDER,
  PO_POINT_LABELS,
  PO_STEP_ESTADOS,
  axisPercent,
  daysAgo,
  isBeforeAxis,
  shortDayLabel,
  groupShipmentsByPo,
  poGroupStatus,
  poTimelineAxis,
  shipmentBarPoints,
  shipmentProgress,
  splitPoCount,
  type PoBucket,
  type PoGroupStatus,
  type PoOverviewGroup,
  type PoOverviewShipment,
  type PoTimelineAxis,
} from './po-overview';
import { PO_STAGE_LABELS } from './shipment-po-review';
import type { PortalShipmentWithReview } from './shipment-po-merge';
import { useClientKind } from './use-client-profile';
import { useShipmentPoStore } from './use-shipment-po-review';
import {
  ShipmentIndicatorStrip,
  useShipmentIndicators,
} from '../../embarques/components/shipment-indicator-strip';
import {
  SHIPMENT_INDICATOR_LABELS,
  type ShipmentIndicatorKey,
} from '../../embarques/lib/shipment-indicators';

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
//
// O resumo desta aba É a faixa de indicadores de Meus Embarques
// (`ShipmentIndicatorStrip` + `lib/shipment-indicators.ts`), com os mesmos
// rótulos e os mesmos números do Panorama, da lista e da Home. Até 02/10/2026
// ela tinha chips próprios que contavam PEDIDOS ("Sem previsão 3" aqui, "5 sem
// previsão" no Panorama); agora o número conta embarques e o recorte mostra os
// pedidos que têm ao menos um embarque no indicador.

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

/** Largura da coluna do nome; o mesmo valor no corpo, no eixo e na grade. */
const NAME_COL = 'grid-cols-[12rem_minmax(0,1fr)]';

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
  const todayPct = axisPercent(axis, axis.todayDay);
  // Trilho-base: nenhum ponto fica flutuando, mesmo sozinho.
  const baseRail = (
    <span
      aria-hidden="true"
      className="absolute inset-x-0 top-[13px] h-px bg-border"
    />
  );

  if (!points.length) {
    // "Sem previsão" vira AÇÃO: a pílula tracejada parte de hoje e diz o que
    // destrava a previsão. Não ocupa nenhuma data — é um convite, não um prazo.
    return (
      <div className="relative h-11">
        {baseRail}
        <Link
          href={`/portal/embarques/${shipment.id}`}
          className="group absolute top-0.5 flex h-6 items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ left: `min(${todayPct}%, calc(100% - 15rem))` }}
          aria-label={`${shipment.reference}: sem previsão. Informe a data de prontidão`}
        >
          <span className="portal-small flex h-6 items-center gap-1 whitespace-nowrap rounded-full border border-dashed border-portal-warning/70 bg-portal-warning/10 px-2.5 font-medium text-portal-warning-ink group-hover:underline">
            <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
            Informe a data de prontidão
            <span className="sr-only">
              {saas
                ? ' — dela sai a previsão de chegada'
                : ' — a Freitas monitora essa data e dela sai a previsão de chegada'}
            </span>
          </span>
        </Link>
      </div>
    );
  }

  const atRisk = !!shipment.riskReason;
  const inside = points.filter((p) => isBeforeAxis(axis, p.date) == null);
  const beforeDays = points
    .map((p) => isBeforeAxis(axis, p.date))
    .filter((n): n is number => n != null);
  const oldestBefore = beforeDays.length ? Math.max(...beforeDays) : null;

  const positions = inside.map((p) => ({
    ...p,
    pct: axisPercent(axis, p.date),
  }));
  // Segmentos entre pontos consecutivos; se há data antes da janela, o trilho
  // sai da borda esquerda (é lá que ela continua).
  const segStart = oldestBefore != null ? 0 : (positions[0]?.pct ?? 0);
  const segEnd = positions.length ? positions[positions.length - 1].pct : 0;

  // Previsão vencida: a chegada prevista ficou para trás e não foi confirmada.
  const overdue =
    shipment.eta &&
    !shipment.arrived &&
    !shipment.etaIsActual &&
    daysAgo(axis, shipment.eta) > 0
      ? daysAgo(axis, shipment.eta)
      : null;
  const etaPct = shipment.eta ? axisPercent(axis, shipment.eta) : null;
  const etaBefore = shipment.eta
    ? isBeforeAxis(axis, shipment.eta) != null
    : false;
  // Falta quanto: de hoje até a chegada prevista futura, pontilhado.
  const remaining =
    etaPct != null && !shipment.arrived && etaPct > todayPct
      ? {
          from: Math.max(todayPct, segEnd === etaPct ? todayPct : segEnd),
          to: etaPct,
        }
      : null;

  // Rótulos de data ao lado dos pontos: a chegada sempre; os outros só quando
  // não colam no vizinho (o tooltip continua com todas as datas).
  const labels: { kind: string; pct: number; text: string }[] = [];
  for (const p of positions) {
    const text =
      p.kind === 'chegada' && p.actual
        ? `chegou ${shortDayLabel(p.date)}`
        : shortDayLabel(p.date);
    const last = labels[labels.length - 1];
    if (last && p.pct - last.pct < 9) {
      if (p.kind === 'chegada')
        labels[labels.length - 1] = { kind: p.kind, pct: p.pct, text };
      continue;
    }
    labels.push({ kind: p.kind, pct: p.pct, text });
  }

  const hitFrom = Math.min(
    segStart,
    overdue != null ? Math.min(etaPct ?? todayPct, todayPct) : segStart,
    remaining?.from ?? segStart,
  );
  const hitTo = Math.max(
    segEnd,
    remaining?.to ?? segEnd,
    overdue != null ? todayPct : segEnd,
  );

  return (
    <div className="relative h-11">
      {baseRail}
      {oldestBefore != null && (
        <span className="portal-small absolute left-0 top-[18px] whitespace-nowrap text-portal-neutral">
          ◀ {oldestBefore} dias atrás
        </span>
      )}
      {(positions.length > 1 || oldestBefore != null) && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-3 h-1.5 rounded-full',
            atRisk ? 'bg-portal-warning/60' : 'bg-brand-indigo/40',
          )}
          style={{
            left: `${segStart}%`,
            width: `${Math.max(0.6, segEnd - segStart)}%`,
          }}
        />
      )}
      {overdue != null && (
        <>
          <span
            aria-hidden="true"
            className="absolute top-3 h-1.5 rounded-full bg-portal-warning/70"
            style={{
              left: `${etaBefore ? 0 : (etaPct ?? 0)}%`,
              width: `${Math.max(0.6, todayPct - (etaBefore ? 0 : (etaPct ?? 0)))}%`,
            }}
          />
          {/* Ancorado à esquerda do "Hoje", para não cruzar a linha. */}
          <span
            className="portal-small absolute top-[20px] -translate-x-full whitespace-nowrap rounded bg-portal-warning/10 px-1 font-medium text-portal-warning-ink"
            style={{ left: `calc(${todayPct}% - 6px)` }}
          >
            previsão {shortDayLabel(shipment.eta!)} · vencida há {overdue} d
          </span>
        </>
      )}
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
      {positions.map((point) => (
        <span
          key={point.kind}
          aria-hidden="true"
          className={cn(
            'absolute top-[7px] h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-card',
            point.kind === 'prontidao' && 'bg-card ring-2 ring-brand-indigo/60',
            point.kind === 'embarque' && 'bg-brand-indigo/70',
            point.kind === 'chegada' &&
              (point.actual
                ? 'bg-portal-success'
                : atRisk || overdue != null
                  ? 'bg-portal-warning'
                  : 'bg-brand-indigo'),
          )}
          style={{ left: `${point.pct}%` }}
        />
      ))}
      {overdue == null &&
        labels.map((label) => (
          <span
            key={label.kind}
            aria-hidden="true"
            className="portal-small absolute top-[22px] -translate-x-1/2 whitespace-nowrap text-portal-neutral"
            style={{ left: `${Math.min(96, Math.max(4, label.pct))}%` }}
          >
            {label.text}
          </span>
        ))}
      {overdue != null &&
        labels
          .filter(
            (label) => label.kind !== 'chegada' && label.pct < todayPct - 24,
          )
          .map((label) => (
            <span
              key={label.kind}
              aria-hidden="true"
              className="portal-small absolute top-[22px] -translate-x-1/2 whitespace-nowrap text-portal-neutral"
              style={{ left: `${Math.min(96, Math.max(4, label.pct))}%` }}
            >
              {label.text}
            </span>
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
            aria-label={`${shipment.reference}: ${datesSummary(shipment)}${overdue != null ? `. Previsão vencida há ${overdue} dias` : ''}${atRisk ? `. Em risco: ${shipment.riskReason}` : ''}`}
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
          {overdue != null && (
            <p className="portal-small font-medium">
              Previsão vencida há {overdue} dias
            </p>
          )}
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

/** Rótulos do eixo: meses (fortes) e marcas de semana (leves), mais "Hoje". */
function AxisScale({
  axis,
  position,
}: {
  axis: PoTimelineAxis;
  position: 'top' | 'bottom';
}) {
  const todayPct = axisPercent(axis, axis.todayDay);
  return (
    <div className="relative h-7" aria-hidden="true">
      {axis.weeks.map((week) => (
        <span
          key={week}
          className={cn(
            'absolute h-1.5 w-px bg-border',
            position === 'top' ? 'bottom-0' : 'top-0',
          )}
          style={{ left: `${axisPercent(axis, week)}%` }}
        />
      ))}
      {axis.ticks
        .filter((tick) => Math.abs(axisPercent(axis, tick.day) - todayPct) > 7)
        .map((tick) => (
          <span
            key={tick.day}
            className={cn(
              'portal-small absolute -translate-x-1/2 font-medium text-foreground/80',
              position === 'top' ? 'top-0' : 'bottom-0',
            )}
            style={{ left: `${axisPercent(axis, tick.day)}%` }}
          >
            {tick.label}
          </span>
        ))}
      <span
        className={cn(
          'portal-small absolute -translate-x-1/2 rounded bg-brand-indigo px-1.5 font-medium text-white dark:bg-brand-indigo-700',
          position === 'top' ? 'top-0' : 'bottom-0',
        )}
        style={{ left: `${todayPct}%` }}
      >
        Hoje · {shortDayLabel(axis.todayDay)}
      </span>
    </div>
  );
}

/** Grade leve (semanas e meses) e a linha "Hoje", atrás de TODAS as linhas. */
function AxisGrid({ axis }: { axis: PoTimelineAxis }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 grid gap-x-4 px-4',
        NAME_COL,
      )}
    >
      <span />
      <span className="relative">
        {axis.weeks.map((week) => (
          <span
            key={week}
            className="absolute inset-y-0 w-px bg-border/40"
            style={{ left: `${axisPercent(axis, week)}%` }}
          />
        ))}
        {axis.ticks.map((tick) => (
          <span
            key={tick.day}
            className="absolute inset-y-0 w-px bg-border"
            style={{ left: `${axisPercent(axis, tick.day)}%` }}
          />
        ))}
        <span
          className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-brand-indigo/70"
          style={{ left: `${axisPercent(axis, axis.todayDay)}%` }}
        />
      </span>
    </div>
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
      {/* Desktop: eixo compartilhado, no topo e repetido no fim, com a grade e
          a linha "Hoje" atravessando todas as linhas. */}
      <div className="portal-card hidden overflow-hidden sm:block">
        <div
          className={cn(
            'grid gap-x-4 border-b border-border px-4 pb-1 pt-2',
            NAME_COL,
          )}
        >
          <span className="portal-small self-end text-portal-neutral">
            Pedido
          </span>
          <AxisScale axis={axis} position="top" />
        </div>
        <div className="relative">
          <AxisGrid axis={axis} />
          {buckets.map(([bucket, rows]) => (
            <section
              key={bucket}
              aria-label={PO_BUCKET_LABELS[bucket]}
              className="relative"
            >
              <h3
                className={cn(
                  'portal-small border-b border-border px-4 py-1.5 font-medium',
                  bucket === 'atrasado'
                    ? 'bg-portal-warning/10 text-portal-warning-ink'
                    : 'bg-muted/30 text-foreground',
                )}
              >
                {PO_BUCKET_LABELS[bucket]}{' '}
                <span className="text-portal-neutral">· {rows.length}</span>
              </h3>
              {rows.map((row) => {
                const open = openKeys.has(row.group.key);
                return (
                  <div
                    key={row.group.key}
                    className="border-b border-border/60 px-4 py-2 last:border-b-0"
                  >
                    <div className={cn('grid items-start gap-x-4', NAME_COL)}>
                      <PoRowHeader
                        row={row}
                        open={open}
                        onToggle={() => toggle(row.group.key)}
                      />
                      <div className="relative py-1">
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
                      <div className="relative mt-2 pl-6">
                        <ExpandedDetail group={row.group} saas={saas} />
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          ))}
        </div>
        <div
          className={cn(
            'grid gap-x-4 border-t border-border px-4 pb-2 pt-1',
            NAME_COL,
          )}
        >
          <span />
          <AxisScale axis={axis} position="bottom" />
        </div>
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
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-5 rounded-full bg-portal-warning/70" />{' '}
            Previsão vencida
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
            <h3
              className={cn(
                'portal-small font-medium',
                bucket === 'atrasado'
                  ? 'text-portal-warning-ink'
                  : 'text-foreground',
              )}
            >
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
          <h3
            className={cn(
              'portal-small font-medium',
              bucket === 'atrasado'
                ? 'text-portal-warning-ink'
                : 'text-foreground',
            )}
          >
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
  const [filter, setFilter] = useState<ShipmentIndicatorKey | null>(null);
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  // Um relógio por montagem: a faixa, os chips e o "hoje" do eixo concordam.
  const [now] = useState(() => new Date());
  // "Seus pedidos" ou o EXEMPLO com datas relativas a hoje (nunca envelhece,
  // nunca se mistura aos pedidos do cliente). No Preview abre no exemplo, para
  // a linha do tempo aparecer cheia; em produção abre nos pedidos do cliente,
  // com o exemplo a um clique.
  const [source, setSource] = useState<'seus' | 'exemplo'>(
    process.env.NEXT_PUBLIC_PROTO_INTERNAL === '1' ? 'exemplo' : 'seus',
  );
  const example = useMemo(() => buildPoOverviewExample(now), [now]);
  const isExample = source === 'exemplo';

  const readyByQuotation = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const q of flattenQuotations(quotationsData))
      map.set(q.id, q.data_prontidao ?? null);
    return map;
  }, [quotationsData]);

  const groups = useMemo(
    () =>
      isExample
        ? groupShipmentsByPo(example.shipments, {
            stateLabel: (shipment) =>
              ESTADO_LABELS[shipment.estado] ?? shipment.estado,
            readyDate: (shipment) => example.readyDates[shipment.id] ?? null,
            items: (shipment) => example.items[shipment.id] ?? [],
          })
        : groupShipmentsByPo(shipments, {
            // O rótulo do estado vem da MESMA fonte que a carteira usa: a etapa de
            // revisão quando ela existe, o estado operacional quando não.
            stateLabel: (shipment) =>
              shipment.review_status &&
              shipment.review_status.stage !== 'active'
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
    [isExample, example, shipments, readyByQuotation, poStore],
  );
  const hasMockTracking =
    !isExample &&
    groups.some((g) => g.shipments.some((s) => s.trackingIsMock && s.eta));

  const rows: Row[] = useMemo(
    () => groups.map((group) => ({ group, status: poGroupStatus(group, now) })),
    [groups, now],
  );
  // Os indicadores contam os embarques da MESMA carteira que as outras abas
  // recebem (no exemplo, os embarques fictícios do exemplo).
  const { indicators } = useShipmentIndicators(
    isExample ? example.shipments : shipments,
    now,
  );
  const visible = filter
    ? rows.filter((row) =>
        row.group.shipments.some((s) => indicators[filter].has(s.id)),
      )
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
        <button
          type="button"
          onClick={() => setSource('exemplo')}
          className="portal-small mt-3 font-medium text-brand-indigo underline underline-offset-4"
        >
          Ver como fica, com um exemplo
        </button>
      </div>
    );
  }

  const split = splitPoCount(groups);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeading
          title={isExample ? 'Pedidos de exemplo' : 'Seus pedidos'}
          hint={
            split > 0
              ? `${split} ${split === 1 ? 'PO dividido' : 'POs divididos'} em mais de um embarque`
              : 'cada PO com os embarques que nasceram dele'
          }
        />
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="radiogroup"
            aria-label="Quais pedidos"
            className="inline-flex rounded-lg border border-border bg-card p-0.5"
          >
            {(
              [
                ['seus', 'Seus pedidos'],
                ['exemplo', 'Exemplo'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={source === value}
                onClick={() => {
                  setSource(value);
                  setFilter(null);
                  setOpenKeys(new Set());
                }}
                className={cn(
                  'portal-small inline-flex min-h-9 items-center rounded-md px-3 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  source === value
                    ? 'bg-brand-indigo-100 text-brand-indigo'
                    : 'text-portal-neutral hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
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
      </div>

      {isExample && (
        <div
          role="note"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-brand-indigo-800/40 bg-brand-indigo-100 px-4 py-3"
        >
          <p className="portal-body text-foreground">
            <span className="font-medium">Exemplo.</span> Pedidos fictícios, com
            datas calculadas a partir de hoje — mostra como a tela fica com
            pedidos em andamento. Nada aqui é seu nem vem da companhia marítima.
          </p>
          <button
            type="button"
            onClick={() => setSource('seus')}
            className="portal-small font-medium text-brand-indigo underline underline-offset-4"
          >
            Ver os seus pedidos
          </button>
        </div>
      )}

      {hasMockTracking && (
        <p className="portal-small flex flex-wrap items-center gap-2 text-portal-neutral">
          <ProvenanceBadge provenance="preview" />
          Algumas datas de chegada são de rastreamento de demonstração — não vêm
          da companhia marítima.
        </p>
      )}

      <ShipmentIndicatorStrip
        indicators={indicators}
        active={filter}
        onSelect={setFilter}
      />

      <p className="portal-small text-portal-neutral">
        Os números contam embarques; ao escolher um indicador, a lista mostra
        os pedidos com ao menos um embarque nele. Uma visão por pedido, em
        avaliação: as datas são as que já existem — prontidão, embarque e
        chegada prevista; nenhuma é estimada aqui.
      </p>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
          <p className="portal-h3">
            {filter
              ? `Nenhum pedido com embarque em “${SHIPMENT_INDICATOR_LABELS[filter]}”.`
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

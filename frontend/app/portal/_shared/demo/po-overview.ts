// RQ-12 — "Visão por PO": um PO e os embarques que nasceram dele.
//
// PURE, sem o alias `@/`: roda sob `npm run test:unit`.
//
// SÓ PROTÓTIPO, e a spec é explícita: a aba existe para validar a aderência com
// clientes, sem desenvolvimento no v1. A gestão por PO de verdade (PO dividido
// em vários embarques, linkagem linha a linha) é V2 — e no v1 a regra é
// 1 embarque = 1 ou mais POs, nunca o contrário.
//
// O QUE ISTO NÃO FAZ: não inventa origem, não inventa data e não cria embarque.
// Ele agrupa o que já existe pelo número do PO e mostra, por grupo, as chegadas
// que já estiverem preenchidas. Um PO cujos embarques ainda não têm ETA aparece
// com o grupo montado e a linha do tempo vazia — que é a verdade.

import type {
  EmbarqueEstado,
  PortalShipment,
} from '../../../../types/portal-shipment.ts';
import { delayRiskFromTracking } from '../../embarques/lib/delay-risk.ts';
import { normalizePo } from './shipment-po-review.ts';
import type { PortalShipmentWithReview } from './shipment-po-merge.ts';

export interface PoOverviewShipment {
  id: string;
  reference: string;
  modal: string | null;
  /** Rótulo do estado, já resolvido pela tela (ou da etapa de revisão). */
  stateLabel: string;
  /** ISO da chegada prevista, quando existe. NUNCA derivada. */
  eta: string | null;
  /** True quando a chegada já foi confirmada pela companhia. */
  etaIsActual: boolean;
  /**
   * Prontidão da carga, da COTAÇÃO que originou o embarque (`data_prontidao`).
   * Null sem cotação vinculada ou sem a data — e é isso que vira a ação
   * "Informe a data de prontidão".
   */
  readyDate: string | null;
  /**
   * Partida datada pela companhia: só quando o último marco reportado é
   * `OCEAN_TRANSIT` e veio com data. Marcos posteriores não datam a partida, e
   * ela não é deduzida deles.
   */
  departureDate: string | null;
  estado: EmbarqueEstado;
  /** A carga já chegou (chegada confirmada ou marco de chegada em diante). */
  arrived: boolean;
  /** Por que está em risco, em poucas palavras; null quando não está. */
  riskReason: string | null;
  /** SKUs, quando o embarque nasceu de um PO com itens. */
  items: PoOverviewItem[];
}

export interface PoOverviewItem {
  partNumber: string;
  description: string;
  quantity: number | null;
}

export interface PoOverviewGroup {
  /** O número como o cliente o escreveu, na primeira ocorrência. */
  po: string;
  /** A chave normalizada que agrupou. */
  key: string;
  shipments: PoOverviewShipment[];
  /** A primeira e a última chegada conhecidas do grupo, para a régua. */
  firstEta: string | null;
  lastEta: string | null;
}

/** De onde sai o rótulo de estado e o ETA de cada embarque. */
export interface PoOverviewResolvers {
  stateLabel: (shipment: PortalShipmentWithReview) => string;
  /** Prontidão vinda da cotação de origem; ausente = sem dado. */
  readyDate?: (shipment: PortalShipmentWithReview) => string | null;
  /** Itens do PO (overlay da jornada por PO); ausente = sem itens. */
  items?: (shipment: PortalShipmentWithReview) => PoOverviewItem[];
}

const ARRIVAL_MILESTONES = ['ARRIVAL', 'DISCHARGE', 'AVAILABLE'];
const EXCEPTION_ESTADOS: EmbarqueEstado[] = ['postergado', 'booking_divergente'];

function riskOf(shipment: PortalShipment, arrived: boolean): string | null {
  if (EXCEPTION_ESTADOS.includes(shipment.estado)) {
    return shipment.estado === 'postergado' ? 'Embarque postergado' : 'Booking divergente';
  }
  if (arrived) return null;
  // A MESMA régua do badge de atraso do portal: mais de 3 dias sobre a primeira
  // previsão da companhia é atraso. Atenção (1 a 3 dias) não é "risco" aqui.
  const risk = delayRiskFromTracking(shipment.tracking);
  if (risk.status === 'delayed') return risk.label;
  return null;
}

function etaOf(shipment: PortalShipment): {
  eta: string | null;
  actual: boolean;
} {
  const tracking = shipment.tracking;
  // `INCOMPLETE` é "a companhia não reportou o suficiente", e não uma data: o
  // portal inteiro trata esse caso como ausência, e aqui não é diferente.
  if (!tracking || tracking.data_status === 'INCOMPLETE') {
    return { eta: null, actual: false };
  }
  return {
    eta: tracking.current_eta ?? null,
    actual: tracking.eta_is_actual === true,
  };
}

/**
 * Agrupa os embarques pelo número do PO.
 *
 * A CHAVE É NORMALIZADA (`normalizePo`), a mesma do dedup: "PO-2026-1183" e
 * "po 2026/1183" são o mesmo pedido e têm de cair no mesmo grupo. O RÓTULO
 * mostrado é a primeira grafia encontrada, não a chave — o cliente reconhece o
 * número como ele o escreveu.
 *
 * Embarque sem PO fica de fora: esta aba é sobre POs, e um balde "sem PO"
 * seria uma segunda hierarquia dentro da tela que existe para provar que não há
 * uma.
 *
 * Ordena por número de embarques (os POs divididos primeiro, que são o caso que
 * a aba existe para mostrar) e, no empate, pelo número do PO.
 */
export function groupShipmentsByPo(
  shipments: PortalShipmentWithReview[],
  resolvers: PoOverviewResolvers,
): PoOverviewGroup[] {
  const groups = new Map<string, PoOverviewGroup>();

  for (const shipment of shipments) {
    const po = shipment.client_reference?.trim();
    if (!po) continue;
    const key = normalizePo(po);
    if (!key) continue;

    const { eta, actual } = etaOf(shipment);
    const tracking = shipment.tracking;
    const arrived =
      actual ||
      (!!tracking?.last_milestone &&
        ARRIVAL_MILESTONES.includes(tracking.last_milestone));
    const row: PoOverviewShipment = {
      id: shipment.id,
      reference: shipment.referencia,
      modal: shipment.modal ?? null,
      stateLabel: resolvers.stateLabel(shipment),
      eta,
      etaIsActual: actual,
      readyDate: resolvers.readyDate?.(shipment) ?? null,
      departureDate:
        tracking?.last_milestone === 'OCEAN_TRANSIT'
          ? (tracking.last_milestone_at ?? null)
          : null,
      estado: shipment.estado,
      arrived,
      riskReason: riskOf(shipment, arrived),
      items: resolvers.items?.(shipment) ?? [],
    };

    const existing = groups.get(key);
    if (existing) {
      existing.shipments.push(row);
    } else {
      groups.set(key, {
        po,
        key,
        shipments: [row],
        firstEta: null,
        lastEta: null,
      });
    }
  }

  for (const group of Array.from(groups.values())) {
    // Dentro do grupo: quem tem data primeiro, do mais cedo ao mais tarde; sem
    // data vai para o fim, pela referência. Assim a régua lê da esquerda para a
    // direita e as cargas sem previsão não abrem buraco no meio dela.
    group.shipments.sort((a, b) => {
      if (a.eta && b.eta) return Date.parse(a.eta) - Date.parse(b.eta);
      if (a.eta) return -1;
      if (b.eta) return 1;
      return a.reference.localeCompare(b.reference);
    });
    const dated = group.shipments
      .filter((s) => s.eta)
      .map((s) => Date.parse(s.eta as string))
      .filter((n) => Number.isFinite(n));
    group.firstEta = dated.length
      ? new Date(Math.min(...dated)).toISOString()
      : null;
    group.lastEta = dated.length
      ? new Date(Math.max(...dated)).toISOString()
      : null;
  }

  return Array.from(groups.values()).sort(
    (a, b) => b.shipments.length - a.shipments.length || a.po.localeCompare(b.po),
  );
}

/**
 * A posição de cada carga na régua do grupo, em 0..100.
 *
 * Com uma data só (ou com todas iguais) não há intervalo para distribuir, e
 * todas as cargas ficam no meio: espalhá-las por índice desenharia uma
 * diferença de prazo que não existe. Carga sem data não entra na régua.
 */
export function etaPositions(group: PoOverviewGroup): Map<string, number> {
  const out = new Map<string, number>();
  const first = group.firstEta ? Date.parse(group.firstEta) : null;
  const last = group.lastEta ? Date.parse(group.lastEta) : null;
  if (first == null || last == null) return out;
  const span = last - first;

  for (const shipment of group.shipments) {
    if (!shipment.eta) continue;
    const at = Date.parse(shipment.eta);
    if (!Number.isFinite(at)) continue;
    out.set(shipment.id, span === 0 ? 50 : ((at - first) / span) * 100);
  }
  return out;
}

/** Quantos POs têm mais de um embarque — o caso que a aba existe para mostrar. */
export function splitPoCount(groups: PoOverviewGroup[]): number {
  return groups.filter((group) => group.shipments.length > 1).length;
}

// ---------------------------------------------------------------------------
// Segunda versão da tela (Prompt 4, 01/10/2026): "quando chega cada PO e algum
// está em risco?". Tudo abaixo LÊ as datas que o agrupamento já trouxe; nada
// aqui cria data.
// ---------------------------------------------------------------------------

const DAY = 24 * 60 * 60 * 1000;

/** Dia (UTC) de uma data ISO ou data pura; datas puras valem pelo dia inteiro. */
function dayOf(iso: string): number {
  return Math.floor(Date.parse(iso.length <= 10 ? `${iso}T00:00:00Z` : iso) / DAY);
}

function today(now: Date): number {
  return Math.floor(now.getTime() / DAY);
}

export type PoBucket = 'semana' | 'mes' | 'depois' | 'sem_previsao' | 'chegou';

export const PO_BUCKET_LABELS: Record<PoBucket, string> = {
  semana: 'Chega esta semana',
  mes: 'Este mês',
  depois: 'Depois',
  sem_previsao: 'Sem previsão',
  chegou: 'Já chegou',
};

/** Ordem dos grupos na tela: o que chega antes, primeiro. */
export const PO_BUCKET_ORDER: PoBucket[] = ['semana', 'mes', 'depois', 'sem_previsao', 'chegou'];

/** "Esta semana" = até 7 dias; "este mês" = até 30. Os mesmos 7 do chip. */
export const PO_SOON_DAYS = 7;
export const PO_MONTH_DAYS = 30;

export interface PoGroupStatus {
  bucket: PoBucket;
  /** A próxima chegada que ainda não aconteceu (ISO), quando existe. */
  nextEta: string | null;
  /** Dias até a próxima chegada; negativo = previsão vencida. */
  daysToNext: number | null;
  /** Algum embarque do PO está em risco (atraso da companhia ou exceção). */
  atRisk: boolean;
  riskReasons: string[];
  /** Embarques sem chegada prevista (e que ainda não chegaram). */
  withoutForecast: number;
  /** Tudo já chegou. */
  allArrived: boolean;
}

export function poGroupStatus(group: PoOverviewGroup, now: Date): PoGroupStatus {
  const t = today(now);
  const pending = group.shipments.filter((s) => !s.arrived);
  const withoutForecast = pending.filter((s) => !s.eta).length;
  const riskReasons = group.shipments
    .map((s) => s.riskReason)
    .filter((r): r is string => !!r);
  const upcoming = pending
    .filter((s) => s.eta)
    .map((s) => ({ eta: s.eta as string, day: dayOf(s.eta as string) }))
    .sort((a, b) => a.day - b.day);
  const next = upcoming[0] ?? null;
  const daysToNext = next ? next.day - t : null;
  // Previsão vencida sem chegada confirmada também é risco: a carga devia ter
  // chegado e ninguém confirmou.
  if (daysToNext != null && daysToNext < 0) riskReasons.push('Previsão de chegada vencida');

  let bucket: PoBucket;
  if (pending.length === 0) bucket = 'chegou';
  else if (next == null) bucket = 'sem_previsao';
  else if ((daysToNext as number) <= PO_SOON_DAYS) bucket = 'semana';
  else if ((daysToNext as number) <= PO_MONTH_DAYS) bucket = 'mes';
  else bucket = 'depois';

  return {
    bucket,
    nextEta: next?.eta ?? null,
    daysToNext,
    atRisk: riskReasons.length > 0,
    riskReasons: Array.from(new Set(riskReasons)),
    withoutForecast,
    allArrived: pending.length === 0,
  };
}

export type PoFilter = 'ativos' | 'sete_dias' | 'risco' | 'sem_previsao';

export const PO_FILTER_LABELS: Record<PoFilter, string> = {
  ativos: 'POs ativos',
  sete_dias: 'Chegam em 7 dias',
  risco: 'Em risco',
  sem_previsao: 'Sem previsão',
};

export function matchesPoFilter(status: PoGroupStatus, filter: PoFilter): boolean {
  switch (filter) {
    case 'ativos':
      return !status.allArrived;
    case 'sete_dias':
      return status.daysToNext != null && status.daysToNext >= 0 && status.daysToNext <= PO_SOON_DAYS;
    case 'risco':
      return status.atRisk;
    case 'sem_previsao':
      return status.withoutForecast > 0;
  }
}

export function summarizePoGroups(
  statuses: PoGroupStatus[],
): Record<PoFilter, number> {
  const out = { ativos: 0, sete_dias: 0, risco: 0, sem_previsao: 0 };
  for (const status of statuses)
    for (const key of Object.keys(out) as PoFilter[])
      if (matchesPoFilter(status, key)) out[key]++;
  return out;
}

export interface PoTimelineAxis {
  /** Primeiro e último dia (UTC, em dias) do eixo compartilhado. */
  startDay: number;
  endDay: number;
  todayDay: number;
  /** Marcas do eixo: início de cada mês dentro do intervalo. */
  ticks: { day: number; label: string }[];
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Todas as datas que existem nos grupos — e nenhuma outra. */
function allDates(groups: PoOverviewGroup[]): number[] {
  const out: number[] = [];
  for (const group of groups)
    for (const s of group.shipments)
      for (const d of [s.readyDate, s.departureDate, s.eta])
        if (d && Number.isFinite(Date.parse(d.length <= 10 ? `${d}T00:00:00Z` : d))) out.push(dayOf(d));
  return out;
}

/**
 * O eixo é COMPARTILHADO entre os POs: a mesma régua para todos, de modo que
 * "chega antes" se lê de cima a baixo sem conta. Vai da data mais cedo à mais
 * tarde (hoje sempre dentro), com 3 dias de folga em cada ponta.
 */
export function poTimelineAxis(groups: PoOverviewGroup[], now: Date): PoTimelineAxis {
  const t = today(now);
  const days = [...allDates(groups), t];
  const startDay = Math.min(...days) - 3;
  const endDay = Math.max(...days, t + 14) + 3;
  const ticks: { day: number; label: string }[] = [];
  const first = new Date(startDay * DAY);
  let cursor = Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1);
  while (cursor / DAY <= endDay) {
    const d = new Date(cursor);
    ticks.push({ day: cursor / DAY, label: `${MONTHS[d.getUTCMonth()]}${d.getUTCMonth() === 0 ? ` ${d.getUTCFullYear()}` : ''}` });
    cursor = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  }
  return { startDay, endDay, todayDay: t, ticks };
}

/** Posição de uma data no eixo, em 0..100. */
export function axisPercent(axis: PoTimelineAxis, iso: string | number): number {
  const day = typeof iso === 'number' ? iso : dayOf(iso);
  const span = Math.max(1, axis.endDay - axis.startDay);
  return Math.min(100, Math.max(0, ((day - axis.startDay) / span) * 100));
}

export type PoPointKind = 'prontidao' | 'embarque' | 'chegada';

export const PO_POINT_LABELS: Record<PoPointKind, string> = {
  prontidao: 'Prontidão',
  embarque: 'Embarque',
  chegada: 'Chegada prevista',
};

export interface PoBarPoint {
  kind: PoPointKind;
  date: string;
  /** Para a chegada: já confirmada pela companhia. */
  actual?: boolean;
}

/**
 * Os pontos da barra de um embarque, na ordem prontidão → embarque → chegada,
 * SÓ os que têm data. Os segmentos são desenhados entre pontos consecutivos;
 * com um ponto só não há segmento — há um marcador.
 */
export function shipmentBarPoints(s: PoOverviewShipment): PoBarPoint[] {
  const points: PoBarPoint[] = [];
  if (s.readyDate) points.push({ kind: 'prontidao', date: s.readyDate });
  if (s.departureDate) points.push({ kind: 'embarque', date: s.departureDate });
  if (s.eta) points.push({ kind: 'chegada', date: s.eta, actual: s.etaIsActual });
  return points;
}

/** As etapas do embarque para os mini-passos e a barra do celular. */
export const PO_STEP_ESTADOS: EmbarqueEstado[] = [
  'solicitado',
  'aguardando_prontidao',
  'coletado',
  'analise_booking',
  'embarcado',
];

/**
 * Progresso de 0 a 1 pela ETAPA real (cinco estados do GE + chegada). Estado
 * de exceção não tem lugar na régua: devolve null, e a tela diz a exceção.
 */
export function shipmentProgress(s: PoOverviewShipment): number | null {
  if (s.arrived) return 1;
  const index = PO_STEP_ESTADOS.indexOf(s.estado);
  if (index < 0) return null;
  return (index + 1) / (PO_STEP_ESTADOS.length + 1);
}

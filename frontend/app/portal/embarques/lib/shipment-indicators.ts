// Indicadores de embarque — a FONTE ÚNICA (feedback do Orsi, 02/10/2026).
//
// Antes, a mesma pergunta tinha um número por tela: o Panorama dizia
// "Precisam de você 11", a aba Alertas "3 pendências dependem de você", a Visão
// por PO "Sem previsão 3" (contando PEDIDOS) e o Panorama "5 sem previsão"
// (contando EMBARQUES, com outra regra de ETA). Agora existe uma definição por
// indicador, escrita aqui, e toda tela que mostra um deles — Panorama, lista de
// Embarques, Visão por PO e Home — chama `buildShipmentIndicators` sobre a MESMA
// carteira e imprime `SHIPMENT_INDICATOR_LABELS`. Não escreva um predicado
// paralelo numa tela: acrescente aqui, ou a próxima tela vai discordar.
//
// Três regras que valem para os cinco:
//   - A unidade é sempre o EMBARQUE. A Visão por PO agrupa por pedido, mas o
//     número do indicador continua contando embarques; o que ela recorta são os
//     pedidos que têm ao menos um embarque no indicador.
//   - Um embarque pode estar em mais de um indicador (atrasado E precisando de
//     você). Os números não somam a carteira, e as telas dizem isso.
//   - "Sem previsão" é ausência de dado, nunca atraso: um embarque sem previsão
//     nunca entra em "Com chegada atrasada" nem em "Chegam nos próximos 7 dias".
//
// PURO, sem o alias `@/`: roda em `npm run test:unit`. A fila de ações entra por
// argumento (ela depende de `REAL_STEPS`, que importa rótulos pelo alias).

import type { PortalShipment } from '../../../../types/portal-shipment.ts';
import { isExceptionState } from '../../../../types/portal-shipment.ts';
import type { HomeAction } from '../../home/lib/home-actions.ts';
import { delayRiskFromTracking } from './delay-risk.ts';
import { arrivalDay, shipmentToday } from './shipment-date.ts';

export type ShipmentIndicatorKey =
  | 'action'
  | 'delayed'
  | 'upcoming'
  | 'no_forecast'
  | 'exception';

/** A ordem em que toda tela mostra os indicadores. */
export const SHIPMENT_INDICATOR_KEYS: ShipmentIndicatorKey[] = [
  'action',
  'delayed',
  'upcoming',
  'no_forecast',
  'exception',
];

export const SHIPMENT_INDICATOR_LABELS: Record<ShipmentIndicatorKey, string> = {
  action: 'Precisam de você',
  delayed: 'Com chegada atrasada',
  upcoming: 'Chegam nos próximos 7 dias',
  no_forecast: 'Sem previsão',
  exception: 'Com exceção',
};

/** A definição em uma frase, para a legenda da tela e para o DESIGN.md. */
export const SHIPMENT_INDICATOR_DEFINITIONS: Record<ShipmentIndicatorKey, string> = {
  action: 'Embarques com ao menos uma ação pendente sua (booking ou documento).',
  delayed: 'Ainda não chegaram e a previsão atual da companhia é posterior à primeira.',
  upcoming: 'Ainda não chegaram e a previsão de chegada ao destino cai entre hoje e os próximos 6 dias.',
  no_forecast: 'Ainda não chegaram e a companhia não informou previsão de chegada.',
  exception: 'Embarques postergados ou com booking divergente.',
};

const DAY_MS = 86_400_000;
const ARRIVAL_MILESTONES = ['ARRIVAL', 'DISCHARGE', 'AVAILABLE'];

/**
 * A carga já chegou: marco de chegada (ou posterior) já datado até hoje, ou
 * chegada confirmada pela companhia com data que não está no futuro.
 */
export function hasArrived(shipment: PortalShipment, now: Date): boolean {
  const tracking = shipment.tracking;
  const today = shipmentToday(now);
  const milestoneDate = arrivalDay(tracking?.last_milestone_at);
  if (
    ARRIVAL_MILESTONES.includes(tracking?.last_milestone ?? '') &&
    (milestoneDate == null || milestoneDate <= today)
  )
    return true;
  const eta = arrivalDay(tracking?.current_eta);
  // Some prototype payloads mark a future ETA as actual. A future event
  // cannot be presented as an arrival that already happened.
  return tracking?.eta_is_actual === true && eta != null && eta <= today;
}

/**
 * Existe previsão de chegada: a companhia reportou o suficiente (`INCOMPLETE`
 * é "não reportou", em todo o portal) e há uma data atual.
 */
export function hasForecast(shipment: PortalShipment): boolean {
  const tracking = shipment.tracking;
  return (
    tracking != null &&
    tracking.data_status !== 'INCOMPLETE' &&
    arrivalDay(tracking.current_eta) != null
  );
}

export type ShipmentIndicators = Record<ShipmentIndicatorKey, Set<string>>;

export function buildShipmentIndicators(
  shipments: PortalShipment[],
  actions: Pick<HomeAction, 'module' | 'recordId'>[],
  now: Date,
): ShipmentIndicators {
  const today = shipmentToday(now);
  const withAction = new Set(
    actions.filter((a) => a.module === 'embarque').map((a) => a.recordId),
  );
  const out: ShipmentIndicators = {
    action: new Set(),
    delayed: new Set(),
    upcoming: new Set(),
    no_forecast: new Set(),
    exception: new Set(),
  };
  for (const shipment of shipments) {
    if (withAction.has(shipment.id)) out.action.add(shipment.id);
    if (isExceptionState(shipment.estado)) out.exception.add(shipment.id);
    if (hasArrived(shipment, now)) continue;
    if (!hasForecast(shipment)) {
      out.no_forecast.add(shipment.id);
      continue;
    }
    const risk = delayRiskFromTracking(shipment.tracking);
    if (risk.deltaDays != null && risk.deltaDays > 0) out.delayed.add(shipment.id);
    const eta = arrivalDay(shipment.tracking?.current_eta) as number;
    // Janela móvel de sete dias corridos: hoje e os seis seguintes.
    if (eta >= today && eta < today + 7 * DAY_MS) out.upcoming.add(shipment.id);
  }
  return out;
}

export function countShipmentIndicators(
  indicators: ShipmentIndicators,
): Record<ShipmentIndicatorKey, number> {
  return Object.fromEntries(
    SHIPMENT_INDICATOR_KEYS.map((key) => [key, indicators[key].size]),
  ) as Record<ShipmentIndicatorKey, number>;
}

/**
 * Recortes da lista de Embarques que não são indicador, mas herdaram os filtros
 * úteis da antiga aba Alertas. "Minha ação" e "Atrasos" viraram os indicadores
 * `action` e `delayed`; "Pendências documentais" é este aqui: embarques com
 * documento pendente seu, lido da MESMA fila de ações.
 */
export function shipmentsWithPendingDocuments(
  actions: Pick<HomeAction, 'module' | 'recordId' | 'kind'>[],
): Set<string> {
  return new Set(
    actions
      .filter((a) => a.module === 'embarque' && a.kind === 'documento')
      .map((a) => a.recordId),
  );
}

/** Chaves aceitas em `?indicador=` na lista de Embarques. */
export type ShipmentListRecorte = ShipmentIndicatorKey | 'documentos';

export const SHIPMENT_LIST_RECORTE_LABELS: Record<ShipmentListRecorte, string> = {
  ...SHIPMENT_INDICATOR_LABELS,
  documentos: 'Pendências documentais',
};

export function isShipmentListRecorte(
  value: string | null | undefined,
): value is ShipmentListRecorte {
  return value != null && value in SHIPMENT_LIST_RECORTE_LABELS;
}

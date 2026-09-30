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

import type { PortalShipment } from '../../../../types/portal-shipment.ts';
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
    const row: PoOverviewShipment = {
      id: shipment.id,
      reference: shipment.referencia,
      modal: shipment.modal ?? null,
      stateLabel: resolvers.stateLabel(shipment),
      eta,
      etaIsActual: actual,
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

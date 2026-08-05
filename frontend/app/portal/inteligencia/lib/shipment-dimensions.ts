// Agregações do embarque por DIMENSÃO — rota e armador.
//
// Puras, sem I/O, unit-testadas (`shipment-dimensions.test.ts`). Nada aqui lê
// rede, relógio ou DOM, e nada aqui fabrica número: quando falta dado, a linha
// simplesmente não entra na média (e a média vira null), em vez de virar zero.
//
// POR QUE O JOIN COM A COTAÇÃO
// ----------------------------
// O payload do embarque (`/portal/shipments`) NÃO carrega rota nem armador:
//
//   - a rota real mora na cotação (`origin` / `porto_destino`). A origem que
//     aparece no mapa e no card da Lista é ILUSTRATIVA, derivada de um hash da
//     referência (`embarques/lib/shipment-origins.ts`) — usá-la aqui produziria
//     um ranking de rotas inventadas com cara de medição;
//   - o armador mora na proposta (`best_proposal.carrier`), campo estruturado
//     de `centrix_quotation_proposals` já exposto ao portal.
//
// O elo é `shipment.quotation_id`, que o payload do embarque expõe. Por isso as
// duas funções recebem embarques E cotações: sem endpoint novo, e sem regex
// sobre texto livre.
//
// ARMADOR != AGENTE — NÃO CONFUNDIR
// ---------------------------------
// São duas entidades e duas dimensões de análise distintas:
//
//   Armador / cia aérea  (Maersk, ONE, MSC)  — opera o navio ou o avião.
//                        Vem de `Proposal.carrier`. É o que este arquivo agrega.
//   Agente de frete      (freight forwarder) — intermedia e cota o frete.
//                        Vem de `best_proposal.agent`, tem tela própria
//                        ("Meus Agentes") e ranking próprio
//                        (`inteligencia/lib/agent-helpers.ts`).
//
// Um mesmo agente cota vários armadores, e um mesmo armador é cotado por vários
// agentes. Misturar os dois num único ranking responderia a pergunta errada
// ("com quem eu contrato" vs "em que navio minha carga vai") e quebraria a
// leitura de "Meus Agentes". Não renomeie um para o outro.

import type { PortalQuotation } from '@/types/portal';
import type { PortalShipment } from '@/types/portal-shipment';

import { delayRiskFromTracking, type DelayRisk } from '../../embarques/lib/delay-risk.ts';

/** Destino padrão quando a cotação não nomeia porto/aeroporto de destino. */
const DEFAULT_DESTINATION = 'Brasil';

export interface RouteDeviation {
  /** "Shanghai → Santos" — como a linha aparece na tela. */
  route: string;
  /** Embarques desta rota COM desvio calculável (não é o total da rota). */
  shipments: number;
  /** Média de dias de desvio, arredondada a um inteiro. */
  avgDeltaDays: number;
}

export interface CarrierUsage {
  /** Nome do armador / cia aérea, como veio da proposta. */
  carrier: string;
  /** Embarques atribuídos a este armador. */
  shipments: number;
  /**
   * Percentual no prazo (0-100) entre os embarques deste armador com desvio
   * calculável. **null** quando nenhum deles tem rastreamento — nunca 0, que
   * leria como "todos atrasados".
   */
  onTimePct: number | null;
  /** Quantos embarques sustentam o `onTimePct`. Zero quando ele é null. */
  trackedShipments: number;
}

/** Índice cotação por id, para o join não virar O(n²) nas duas funções. */
function indexQuotations(
  quotations: PortalQuotation[],
): Map<string, PortalQuotation> {
  return new Map(quotations.map((q) => [q.id, q]));
}

/** Cidade de origem sem o país: o seed guarda "Shanghai, China". */
function originOf(quotation: PortalQuotation | undefined): string | null {
  const raw = (quotation?.origin ?? '').trim();
  if (!raw) return null;
  return raw.split(',')[0].trim() || null;
}

/**
 * Destino da rota, ou "Brasil" quando não há um só.
 *
 * `porto_destino` e `aeroporto_destino` são LISTAS: a cotação pode nomear vários
 * portos candidatos e deixar a escolha para o agente. Só nomeamos o destino
 * quando a lista tem exatamente um item — com dois candidatos, o porto real foi
 * decidido depois, fora da cotação, e escolher o primeiro inventaria um destino
 * que talvez não seja o da carga. Nesse caso a rota agrega em "Brasil", que é
 * verdade para qualquer um deles.
 */
function destinationOf(quotation: PortalQuotation | undefined): string {
  const ports = quotation?.porto_destino ?? quotation?.aeroporto_destino ?? null;
  if (!ports || ports.length !== 1) return DEFAULT_DESTINATION;
  return ports[0].trim() || DEFAULT_DESTINATION;
}

/**
 * Rota legível de um embarque, ou null quando a cotação de origem não é
 * conhecida. Null é resultado legítimo: embarque sem `quotation_id` (ou com uma
 * cotação fora da página carregada) fica FORA do ranking em vez de cair num
 * balde "Outras", que inflaria uma rota inexistente.
 */
function routeOf(
  shipment: PortalShipment,
  byId: Map<string, PortalQuotation>,
): string | null {
  const quotation = shipment.quotation_id
    ? byId.get(shipment.quotation_id)
    : undefined;
  const origin = originOf(quotation);
  return origin ? `${origin} → ${destinationOf(quotation)}` : null;
}

/**
 * Média de dias de desvio por rota, pior primeiro.
 *
 * Só entram embarques cujo `computeDelayRisk` devolveu um número: sem
 * rastreamento (`pending`) ou com a companhia calada (`incomplete`) não há
 * desvio a somar, e tratá-los como zero afirmaria "no prazo" sobre um embarque
 * do qual não sabemos nada. Por isso `shipments` conta os embarques MEDIDOS da
 * rota, não os embarques da rota — o rótulo na tela precisa dizer isso.
 *
 * Empate na média é resolvido pelo nome da rota, para a ordem não oscilar.
 */
export function computeRouteDeviations(
  shipments: PortalShipment[],
  quotations: PortalQuotation[],
): RouteDeviation[] {
  const byId = indexQuotations(quotations);
  const sums = new Map<string, { total: number; count: number }>();

  for (const shipment of shipments) {
    const risk: DelayRisk = delayRiskFromTracking(shipment.tracking);
    if (risk.deltaDays == null) continue;

    const route = routeOf(shipment, byId);
    if (!route) continue;

    const entry = sums.get(route) ?? { total: 0, count: 0 };
    entry.total += risk.deltaDays;
    entry.count += 1;
    sums.set(route, entry);
  }

  return Array.from(sums, ([route, { total, count }]) => ({
    route,
    shipments: count,
    avgDeltaDays: Math.round(total / count),
  })).sort(
    (a, b) => b.avgDeltaDays - a.avgDeltaDays || a.route.localeCompare(b.route),
  );
}

/**
 * Embarques por armador, mais usado primeiro, com o percentual no prazo entre
 * os que têm rastreamento.
 *
 * `onTimePct` é null — e não 0 — quando nenhum embarque daquele armador tem
 * desvio calculável. É a mesma disciplina do resto do portal: ausência de dado
 * não vira número, porque "0% no prazo" é uma acusação, não uma lacuna.
 *
 * Um embarque sem cotação conhecida, ou cuja proposta vencedora não nomeia o
 * armador, fica fora: `carrier` é nullable no schema e inventar "Não informado"
 * criaria um armador fantasma no topo do ranking.
 */
export function computeCarrierUsage(
  shipments: PortalShipment[],
  quotations: PortalQuotation[],
): CarrierUsage[] {
  const byId = indexQuotations(quotations);
  const stats = new Map<
    string,
    { shipments: number; tracked: number; onTime: number }
  >();

  for (const shipment of shipments) {
    const quotation = shipment.quotation_id
      ? byId.get(shipment.quotation_id)
      : undefined;
    const carrier = (quotation?.best_proposal?.carrier ?? '').trim();
    if (!carrier) continue;

    const entry = stats.get(carrier) ?? { shipments: 0, tracked: 0, onTime: 0 };
    entry.shipments += 1;

    const risk = delayRiskFromTracking(shipment.tracking);
    if (risk.deltaDays != null) {
      entry.tracked += 1;
      if (risk.status === 'on_time') entry.onTime += 1;
    }
    stats.set(carrier, entry);
  }

  return Array.from(stats, ([carrier, s]) => ({
    carrier,
    shipments: s.shipments,
    trackedShipments: s.tracked,
    onTimePct: s.tracked > 0 ? Math.round((s.onTime / s.tracked) * 100) : null,
  })).sort(
    (a, b) => b.shipments - a.shipments || a.carrier.localeCompare(b.carrier),
  );
}

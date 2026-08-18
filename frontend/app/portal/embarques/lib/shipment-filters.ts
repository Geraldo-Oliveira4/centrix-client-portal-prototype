// Filtros rápidos de embarque — os recortes de um clique que a Lista e o Mapa
// oferecem. Puro e unit-testado (shipment-filters.test.ts).
//
// Por que os predicados saíram do componente
// -------------------------------------------
// Eles nasceram dentro de `shipment-list-tab.tsx`. Quando o Mapa ganhou os
// mesmos chips (revisão de 14/08/2026 com Victor Orsi: "o mapa é mais visual do
// que funcional, mostra tudo de uma vez"), copiar as quatro funções seria criar
// a segunda implementação da mesma pergunta — exatamente o que aconteceu com o
// campo de busca antes do `PortalSearchInput`, e que só foi notado quando as
// duas cópias já tinham divergido. "Com atraso" tem de significar a mesma coisa
// nas duas telas, senão o cliente conta 5 numa e 6 na outra.
//
// Nada aqui inventa dado: são predicados sobre campos que a listagem já traz, e
// "Com atraso" sai de `delayRiskFromTracking`, a MESMA função pura que desenha o
// badge do card. Um embarque sem rastreamento é `pending`, não "no prazo", e por
// isso nunca entra no chip.

import type { PortalShipment, SemaforoTone } from '../../../../types/portal-shipment.ts';
// Import relativo COM extensão, não pelo alias `@/`: este módulo roda no runner
// nativo do Node (`npm run test:unit`), que não conhece o alias e não resolve
// caminho sem extensão. Mesma razão do import de `delay-risk.ts` em
// `inteligencia/lib/shipment-dimensions.ts`. `isExceptionState` é VALOR, então
// não dá para trazê-lo por `import type`.
import { isExceptionState } from '../../../../types/portal-shipment.ts';
import { delayRiskFromTracking } from './delay-risk.ts';

export type ShipmentFilterKey = 'urgentes' | 'embarcados' | 'atraso' | 'excecao';

export interface ShipmentFilter {
  key: ShipmentFilterKey;
  label: string;
  /** Cor do chip ativo. `neutral` = recorte sem leitura de saúde. */
  tone: SemaforoTone | 'neutral';
  match: (shipment: PortalShipment) => boolean;
}

/**
 * Os quatro recortes, na ordem em que aparecem.
 *
 * "Embarcados", e não "Em trânsito": `embarcado` é o estado real do GE e
 * significa PARTIDA. "Em trânsito" é o milestone `OCEAN_TRANSIT` do ShipsGo, um
 * degrau da timeline — um chip com esse nome selecionaria embarques cuja própria
 * timeline diz que o trânsito é desconhecido.
 */
export const SHIPMENT_FILTERS: ShipmentFilter[] = [
  {
    key: 'urgentes',
    label: 'Urgentes',
    tone: 'warning',
    match: (s) => s.carga_urgente,
  },
  {
    key: 'embarcados',
    label: 'Embarcados',
    tone: 'neutral',
    match: (s) => s.estado === 'embarcado',
  },
  {
    // "Com atraso" é a régua da COMPANHIA (deslize de ETA), e é a única do
    // portal que usa essa palavra: o semáforo de estado, que aparece ao lado
    // deste chip no Mapa, conta outra coisa e por isso se chama "Reprogramado".
    // A justificativa completa está em `SEMAFORO_LABELS`; não devolva "atraso"
    // ao vocabulário de lá sem lê-la.
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

const BY_KEY = new Map(SHIPMENT_FILTERS.map((f) => [f.key, f]));

export interface ShipmentFilterCount extends ShipmentFilter {
  count: number;
}

/**
 * Contagem por chip sobre a lista COMPLETA, nunca sobre o recorte já filtrado:
 * o número do chip responde "quantos existem", e recontá-lo sobre o próprio
 * resultado faria todo chip inativo mostrar 0 assim que outro fosse ligado.
 *
 * `keys` escolhe quais chips a tela quer (a Lista usa os quatro, o Mapa três) e
 * preserva a ordem canônica acima. Quem decide o que fazer com contagem zero é o
 * chamador: a Lista esconde (o conjunto dela varia com busca e filtros, e um
 * chip zerado ali lê como funcionalidade quebrada), o Mapa mantém (conjunto fixo
 * de três, onde "Com exceção 0" É a resposta).
 */
export function countShipmentFilters(
  shipments: PortalShipment[],
  keys?: ShipmentFilterKey[],
): ShipmentFilterCount[] {
  const wanted = keys ? new Set<string>(keys) : null;
  return SHIPMENT_FILTERS.filter((f) => !wanted || wanted.has(f.key)).map((f) => ({
    ...f,
    count: shipments.filter(f.match).length,
  }));
}

/**
 * Aplica um recorte. `null` devolve a lista inteira — e devolve a MESMA
 * referência, para o caso "Todos" não invalidar memoização a jusante (no Mapa,
 * a camada de marcadores do Leaflet é remontada quando o array muda).
 *
 * Chave desconhecida também devolve tudo: um filtro que ninguém reconhece não
 * pode esvaziar a tela.
 */
export function filterShipments(
  shipments: PortalShipment[],
  key: ShipmentFilterKey | null,
): PortalShipment[] {
  if (!key) return shipments;
  const filter = BY_KEY.get(key);
  if (!filter) return shipments;
  return shipments.filter(filter.match);
}

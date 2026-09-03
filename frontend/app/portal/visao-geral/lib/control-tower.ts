// Torre de Controle (`/portal/visao-geral`) — o que precisa da atenção do
// cliente hoje, cruzando os módulos Cotação e Gerenciamento de Embarque.
// Puro e unit-testado (control-tower.test.ts).
//
// ESTE MÓDULO NÃO CLASSIFICA NADA POR CONTA PRÓPRIA. Ele CONSOME as três regras
// que já existem no portal e apenas as arruma em duas colunas:
//
//   1. "Aguardando sua ação" = `collectHomeActions` (`home/lib/home-actions.ts`),
//      que por sua vez já é a união de `PORTAL_CLIENT_ACTION_BUCKETS` (o
//      `needsAction` do Funil) com os `StepAction` `pendente` da timeline do
//      embarque. Reimplementar o critério aqui faria a Torre pedir um documento
//      que a Home considera entregue na primeira vez que um dos dois mudasse.
//   2. "Precisam de atenção" = `delayRiskFromTracking` -> `computeDelayRisk`
//      (`embarques/lib/delay-risk.ts`), a MESMA função do badge de cada
//      embarque, do chip "Com atraso" e das agregações de Inteligência. Médio ou
//      alto = `attention` | `delayed`.
//
// UM ITEM NUNCA APARECE NAS DUAS COLUNAS, e o desempate é sempre para a
// primeira: se o cliente já tem o que fazer naquele embarque, o risco de prazo é
// contexto da mesma linha, não uma segunda cobrança.
//
// UMA LINHA POR REGISTRO, não por gatilho. A Home lista gatilhos (dois pendentes
// no mesmo embarque = duas linhas, e ali isso é certo, porque cada linha tem CTA
// próprio); a Torre lista o REGISTRO, porque o farol do topo tem de fechar com o
// total dos dois módulos e um embarque contado duas vezes estouraria a conta.
// É o que `HomeAction.module` + `HomeAction.recordId` existem para permitir.
//
// O QUE ESTE MÓDULO ESCREVE é a DESCRIÇÃO da linha de risco de prazo, pela mesma
// razão que `home-actions.ts` escreve as dele: os rótulos de `computeDelayRisk`
// ("Atraso, +5 dias") são de um chip ao lado do ETA, com o embarque em volta, e
// aqui a linha é lida fora de contexto. O NÚMERO é o mesmo `deltaDays` que a
// função devolveu — nada é recalculado.

import type { PortalQuotation, PortalBucketKey } from '../../../../types/portal.ts';
import type {
  EmbarqueEstado,
  PortalShipment,
  SemaforoTone,
} from '../../../../types/portal-shipment.ts';
// Imports relativos COM extensão: este módulo roda no runner nativo do Node
// (`npm run test:unit`), que não resolve o alias `@/`. Mesma razão de
// `home-actions.ts` e `shipment-dimensions.ts`.
import { delayRiskFromTracking } from '../../embarques/lib/delay-risk.ts';
import {
  collectHomeActions,
  type HomeAction,
  type HomeActionModule,
  type HomeActionsInput,
} from '../../home/lib/home-actions.ts';

/** Uma linha de qualquer uma das duas colunas. */
export interface TowerItem {
  /** Estável entre renders: `${module}:${recordId}`. Também é a chave do dedupe. */
  id: string;
  /** Badge pequeno de origem: de qual módulo a linha veio. */
  module: HomeActionModule;
  /** Como o cliente identifica o registro: "EMB-2026-0004" ou "COT-2026-0009". */
  reference: string;
  title: string;
  /** Uma linha dizendo por que está aqui. */
  description: string;
  ctaLabel: string;
  href: string;
  tone: 'danger' | 'warning' | 'info';
}

/** Rótulo do badge de origem. Um lugar só, para as duas colunas. */
export const TOWER_MODULE_LABEL: Record<HomeActionModule, string> = {
  cotacao: 'Cotação',
  embarque: 'Embarque',
};

/**
 * Uma bolinha do farol combinado.
 *
 * As três somam o total dos dois módulos — ver `buildControlTower` para a
 * identidade que o teste trava.
 */
export interface TowerBeacon {
  tone: SemaforoTone;
  count: number;
  label: string;
}

export interface ControlTower {
  awaiting: TowerItem[];
  attention: TowerItem[];
  beacons: TowerBeacon[];
  /** Cotações ativas + embarques. O denominador do farol. */
  total: number;
}

export interface ControlTowerInput {
  shipments: PortalShipment[];
  buckets: Partial<Record<PortalBucketKey, PortalQuotation[]>>;
  /**
   * As colunas do Funil, como o backend as ordena (`PORTAL_BUCKET_ORDER`). É o
   * que define "cotação ativa" — a MESMA derivação do `activeCount` de
   * `funnel-tab.tsx`, e não a lista de baldes renderizada, que esconde
   * `aguardando_dados` quando vazio.
   */
  bucketOrder: PortalBucketKey[];
  realSteps: { key: EmbarqueEstado; label: string; description: string }[];
  now: Date;
}

/** Os dois estados de `computeDelayRisk` que significam "risco médio ou alto". */
const ATTENTION_STATUSES = new Set(['attention', 'delayed']);

const towerItemFromAction = (action: HomeAction): TowerItem => ({
  id: `${action.module}:${action.recordId}`,
  module: action.module,
  // `category` é "Embarque EMB-2026-0004" / "Cotação COT-2026-0009"; o badge já
  // diz o módulo, então a linha fica só com a referência. Cortar pelo último
  // espaço em vez de reconstruir a string mantém uma redação só na origem.
  reference: action.category.split(' ').pop() ?? action.category,
  title: action.title,
  description: action.description,
  ctaLabel: action.ctaLabel,
  href: action.href,
  tone: action.tone,
});

/**
 * As duas colunas, o farol combinado e o total.
 *
 * O FAROL É ÍNDICE DAS COLUNAS, não uma quarta classificação:
 *
 *     🔴 vermelho = itens em "Aguardando sua ação"   (a bola está com o cliente)
 *     🟠 laranja  = itens em "Precisam de atenção"
 *     🟢 verde    = total − vermelho − laranja
 *
 *     verde + laranja + vermelho = cotações ativas + embarques
 *
 * Vermelho para a ação do cliente porque a régua aqui é "o que trava se ficar
 * parado", e o que depende dele é o topo dessa régua — nada anda enquanto ele
 * não responde. O verde não é uma lista: é o resto, e é por isso que ele fecha a
 * conta sem que ninguém tenha de somar duas fontes. Um item nunca está nas duas
 * colunas, então as três parcelas são disjuntas por construção.
 *
 * Nada aqui é fabricado: cliente sem itens numa coluna recebe uma coluna vazia,
 * e o farol correspondente marca zero.
 */
export function buildControlTower({
  shipments,
  buckets,
  bucketOrder,
  realSteps,
  now,
}: ControlTowerInput): ControlTower {
  // Coluna 1, já ordenada pela mesma prioridade da Home (proposta -> booking ->
  // documento -> dados, depois prazo mais curto). O primeiro gatilho de um
  // registro é o que representa a linha: sendo a lista ordenada, é o mais urgente.
  const awaiting: TowerItem[] = [];
  const claimed = new Set<string>();

  for (const action of collectHomeActions({ shipments, buckets, realSteps, now })) {
    const key = `${action.module}:${action.recordId}`;
    if (claimed.has(key)) continue;
    claimed.add(key);
    awaiting.push(towerItemFromAction(action));
  }

  // Coluna 2. Só embarque: risco de prazo é medido sobre as duas datas da
  // companhia marítima, e cotação não tem nenhuma.
  const attention: TowerItem[] = [];

  for (const shipment of shipments) {
    if (claimed.has(`embarque:${shipment.id}`)) continue;

    const risk = delayRiskFromTracking(shipment.tracking);
    if (!ATTENTION_STATUSES.has(risk.status)) continue;

    const days = risk.deltaDays;
    const delayed = risk.status === 'delayed';

    attention.push({
      id: `embarque:${shipment.id}`,
      module: 'embarque',
      reference: shipment.referencia,
      title: 'Chegada mais tarde que o previsto',
      // Não imprimimos `risk.label` ("Atraso, +5 dias"): aquele é o texto do chip
      // que fica colado no ETA, dentro do embarque. Aqui a frase precisa dizer
      // QUEM moveu a data e CONTRA O QUÊ, porque não há ETA nenhum ao lado dela.
      // O número é o mesmo `deltaDays` que a função devolveu.
      description:
        days == null
          ? 'A companhia marítima moveu a chegada para depois da primeira previsão.'
          : `A companhia marítima moveu a chegada ${days} ${
              days === 1 ? 'dia' : 'dias'
            } para frente da primeira previsão.`,
      ctaLabel: 'Acompanhar embarque',
      href: `/portal/embarques/${shipment.id}`,
      tone: delayed ? 'danger' : 'warning',
    });
  }

  const activeQuotations = bucketOrder.reduce(
    (sum, bucket) => sum + (buckets[bucket]?.length ?? 0),
    0,
  );
  const total = activeQuotations + shipments.length;

  return {
    awaiting,
    attention,
    total,
    beacons: [
      {
        tone: 'success',
        // `Math.max` é cinto de segurança, não regra: as duas colunas são
        // subconjuntos disjuntos do total por construção (ação de cotação só sai
        // dos baldes de `bucketOrder`, ação de embarque só sai de `shipments`),
        // e o teste trava a identidade. Se um balde novo furar isso, a tela
        // mostra 0 em vez de um número negativo.
        count: Math.max(0, total - awaiting.length - attention.length),
        label: 'Em andamento',
      },
      { tone: 'warning', count: attention.length, label: 'Precisam de atenção' },
      { tone: 'danger', count: awaiting.length, label: 'Aguardando sua ação' },
    ],
  };
}

/** Reexportado para a tela montar o input sem importar de dois lugares. */
export type { HomeActionsInput };

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
// O FAROL DA TELA NÃO SAI DAQUI. Ele é `countBySemaforo`, o mesmo do Mapa e da
// Home, e mede RISCO por embarque (verde/laranja/vermelho). As colunas medem
// QUEM PRECISA AGIR. São duas perguntas diferentes sobre a mesma carteira, e
// popular uma com a outra daria um número que não responde nenhuma — por isso
// este módulo devolve só as colunas, e a página busca o farol na fonte de sempre.
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

/** Uma coluna da Torre: o recorte visível e o que ficou de fora. */
export interface TowerColumnData {
  /** Os `TOWER_COLUMN_LIMIT` mais urgentes, já ordenados. */
  items: TowerItem[];
  /** Quantos existem no total nesta coluna — o que a tela precisa para não truncar calada. */
  total: number;
  /** Quantos ficaram de fora do recorte. */
  hidden: number;
  /**
   * Se os itens escondidos vêm dos DOIS módulos. Decide o texto do rodapé: "entre
   * os dois módulos" só é dito quando é verdade — a coluna de prazo é só de
   * embarque e nunca o diz.
   */
  hiddenSpansBothModules: boolean;
}

export interface ControlTower {
  awaiting: TowerColumnData;
  attention: TowerColumnData;
}

/**
 * Quantos itens cada coluna mostra. O resto é CONTADO no rodapé, com link para
 * o módulo — nunca omitido em silêncio, que leria como "é só isso".
 */
export const TOWER_COLUMN_LIMIT = 3;

export interface ControlTowerInput {
  shipments: PortalShipment[];
  buckets: Partial<Record<PortalBucketKey, PortalQuotation[]>>;
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
 * As duas colunas, cada uma já cortada em `TOWER_COLUMN_LIMIT`.
 *
 * ORDEM DAS COLUNAS = URGÊNCIA, e nas duas ela é PRAZO onde existe prazo:
 *
 *   - "Aguardando sua ação" herda a ordem de `collectHomeActions`, que JÁ é
 *     "prazo mais próximo primeiro". Não é coincidência: só ações de `proposta`
 *     carregam prazo (a validade da proposta vencedora — nada em `step-insights`
 *     data um gatilho de embarque), e `proposta` é a categoria de menor peso em
 *     `KIND_WEIGHT`. Logo toda ação com prazo precede toda ação sem prazo, e
 *     entre elas a ordem é por `daysLeft` crescente. Reordenar aqui daria a mesma
 *     lista e criaria uma segunda definição de urgência para divergir da primeira.
 *   - "Precisam de atenção" não tem prazo nenhum: nenhum embarque cobra data do
 *     cliente. A urgência ali é o TAMANHO do deslize da companhia, então a coluna
 *     ordena por `deltaDays` decrescente — a carga que escorregou mais aparece
 *     primeiro. Sem esse critério a ordem seria a do payload, que não significa nada.
 *
 * UM ITEM NUNCA APARECE NAS DUAS COLUNAS, e o desempate é sempre para a
 * primeira: se o cliente já tem o que fazer naquele embarque, o risco de prazo é
 * contexto da mesma linha, não uma segunda cobrança.
 *
 * Nada aqui é fabricado: cliente sem itens numa coluna recebe uma coluna vazia.
 */
export function buildControlTower({
  shipments,
  buckets,
  realSteps,
  now,
}: ControlTowerInput): ControlTower {
  // Coluna 1, já ordenada pela urgência da Home. O primeiro gatilho de um
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
  const attention: (TowerItem & { deltaDays: number })[] = [];

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
      // Só para ordenar; não vai para a tela. `deltaDays` é sempre um número aqui:
      // `attention`/`delayed` só saem de `computeDelayRisk` com as duas datas
      // válidas. O `?? 0` é cinto de segurança contra uma mudança lá dentro.
      deltaDays: days ?? 0,
    });
  }

  attention.sort(
    (a, b) => b.deltaDays - a.deltaDays || a.reference.localeCompare(b.reference),
  );

  return {
    awaiting: cutColumn(awaiting),
    attention: cutColumn(attention),
  };
}

/** Aplica o corte da coluna e descreve o que ficou de fora. */
function cutColumn(items: TowerItem[]): TowerColumnData {
  const visible = items.slice(0, TOWER_COLUMN_LIMIT);
  const hiddenItems = items.slice(TOWER_COLUMN_LIMIT);
  const modules = new Set(hiddenItems.map((i) => i.module));

  return {
    items: visible,
    total: items.length,
    hidden: hiddenItems.length,
    hiddenSpansBothModules: modules.size > 1,
  };
}

/** Reexportado para a tela montar o input sem importar de dois lugares. */
export type { HomeActionsInput };

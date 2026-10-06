// As respostas das boas-vindas chegam à Inteligência (07/10/2026).
//
// Antes, prioridade, rotas e papel só ajustavam a Home. Agora as ROTAS (até 3)
// e a PRIORIDADE geram a visão salva padrão "Minha operação" da Inteligência:
// filtro de Rota pré-aplicado e a ordem dos blocos puxada pela prioridade
// (Custo → custo primeiro; Prazo → prazo/transit time; Visibilidade →
// status e atrasos).
//
// CAMINHO: a Inteligência é um iframe da MESMA origem e guarda as visões em
// `centrix-proto-v2:intelligence-views` (intel-layout.js). O host grava a
// visão direto ali, no mesmo formato que o iframe já lê — sem postMessage nem
// parâmetro novo de URL para o filtro. A visão é uma visão comum: aparece em
// "Minhas visões" e o cliente renomeia ou exclui como qualquer outra.
//
// PURO, sem `@/`: roda sob `node --test` (onboarding-intel.test.ts), que
// também confere o mapa de rotas contra o data.js da Inteligência.

import { placeName, type PreferredRoute, type Priority } from './onboarding.ts';

/** Nome no store de demonstração (prefixo `centrix-proto-v2:`). */
export const INTEL_VIEWS_STORE_NAME = 'intelligence-views';

export const DEFAULT_INTEL_VIEW_ID = 'minha-operacao';
export const DEFAULT_INTEL_VIEW_NAME = 'Minha operação';

/**
 * Rota das boas-vindas → id de rota da fixture da Inteligência. Só as que
 * existem lá; o teste confere origem e destino pelo código do porto. Rota sem
 * par entra no filtro mesmo assim (ver `routeFilterValue`) e a Inteligência
 * mostra o estado "Nenhum embarque neste recorte", que já existe.
 */
export const INTEL_ROUTE_BY_PAIR: Record<string, string> = {
  'CNSHA>BRSSZ': 'shanghai',
  'CNNGB>BRITJ': 'ningbo',
  'DEHAM>BRITJ': 'hamburgo',
};

/**
 * O valor do filtro `rota`. Sem par na fixture, "Origem>Destino" pelo nome: a
 * Inteligência mostra "Origem → Destino" no chip e nenhum embarque bate.
 */
export function routeFilterValue(route: Pick<PreferredRoute, 'origin' | 'destination'>): string {
  return (
    INTEL_ROUTE_BY_PAIR[`${route.origin}>${route.destination}`] ??
    `${placeName(route.origin)}>${placeName(route.destination)}`
  );
}

type IntelMode = 'completa' | 'objetiva';
export type IntelBlockOrder = Record<IntelMode, string[]>;

/** Ordem padrão da Inteligência (a mesma de `IntelLayout.BLOCKS`). */
export const DEFAULT_BLOCK_ORDER: IntelBlockOrder = {
  completa: ['destaque', 'funil', 'kpis', 'graficos', 'performance', 'precos', 'compromissos'],
  objetiva: ['kpis', 'q_prazo', 'q_frete', 'q_parceiros', 'q_perda'],
};

/**
 * O que a prioridade puxa para cima. Os blocos citados vão para o topo, na
 * ordem citada; o resto segue a ordem padrão. Nenhum bloco é escondido: a
 * prioridade ordena, não recorta.
 */
const PRIORITY_FIRST: Record<Priority, IntelBlockOrder> = {
  // Frete por mês, preços por rota e o número de frete.
  custo: { completa: ['graficos', 'precos', 'kpis'], objetiva: ['q_frete', 'kpis'] },
  // Entrega no prazo, onde o prazo se perde (por etapa, transit time).
  prazo: { completa: ['destaque', 'funil', 'graficos'], objetiva: ['q_prazo', 'q_perda'] },
  // Status e atrasos: indicadores do recorte, etapas atrasadas, compromissos.
  visibilidade: {
    completa: ['kpis', 'funil', 'performance', 'compromissos'],
    objetiva: ['kpis', 'q_perda', 'q_prazo'],
  },
};

export function blockOrderFor(priority: Priority | ''): IntelBlockOrder {
  if (!priority) return { completa: [...DEFAULT_BLOCK_ORDER.completa], objetiva: [...DEFAULT_BLOCK_ORDER.objetiva] };
  const first = PRIORITY_FIRST[priority];
  const merge = (mode: IntelMode) => [
    ...first[mode],
    ...DEFAULT_BLOCK_ORDER[mode].filter((id) => !first[mode].includes(id)),
  ];
  return { completa: merge('completa'), objetiva: merge('objetiva') };
}

/** Formato de visão de `IntelLayout.captureView` (+ `order`, opcional lá). */
export interface IntelView {
  id: string;
  name: string;
  query: string;
  mode: IntelMode;
  hidden: Record<IntelMode, string[]>;
  order: IntelBlockOrder;
}

/**
 * A visão "Minha operação". Rotas viram UM filtro `rota` (OU dentro do
 * filtro, como em toda a Inteligência); sem rota, a visão não filtra nada.
 * Período não entra: a visão abre no período padrão da página.
 */
export function buildDefaultIntelView(
  routes: Pick<PreferredRoute, 'origin' | 'destination'>[],
  priority: Priority | '',
): IntelView {
  const values = Array.from(new Set(routes.map(routeFilterValue)));
  const query = values.length ? new URLSearchParams({ rota: values.join(',') }).toString() : '';
  return {
    id: DEFAULT_INTEL_VIEW_ID,
    name: DEFAULT_INTEL_VIEW_NAME,
    query,
    mode: 'completa',
    hidden: { completa: [], objetiva: [] },
    order: blockOrderFor(priority),
  };
}

/** Lê a lista guardada; qualquer coisa estranha vira lista vazia. */
export function parseIntelViews(raw: string | null): Record<string, unknown>[] {
  if (raw == null) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => x && typeof x === 'object' && x.id && x.name) : [];
  } catch {
    return [];
  }
}

/**
 * Põe a visão padrão na lista: substitui a de mesmo id (refazer a
 * personalização recria a partir das novas respostas) ou entra em primeiro.
 * As visões do próprio cliente ficam intactas.
 */
export function upsertDefaultView(
  views: Record<string, unknown>[],
  view: IntelView,
): Record<string, unknown>[] {
  return [{ ...view }, ...views.filter((v) => v.id !== view.id)];
}

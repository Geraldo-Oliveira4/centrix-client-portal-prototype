// Boas-vindas do portal (30/09/2026): tour curto + configuração inicial em 3
// passos, antes da escolha de temas da Home — UM fluxo, não três modais que
// disputam a primeira visita.
//
// PURE, sem o alias `@/`: roda sob `npm run test:unit`. Persistência só local,
// sob o prefixo da camada de demonstração (`centrix-proto-v2:onboarding`), e
// nenhum dado pessoal real: os campos vêm com exemplos fictícios.
//
// ROTAS PREFERIDAS TÊM UMA FONTE. O catálogo abaixo usa os mesmos locais de
// Configurações (`public/prototypes/centrix-configuracoes`) e os mesmos códigos
// do Radar (`public/prototypes/centrix-radar`); os dois iframes leem esta chave
// ao carregar e marcam as rotas como preferidas. Quando existir o "agente
// preferido da rota" (fechamento direto, PR dos ajustes do Orsi), é daqui que
// ele lê.

import type {
  PortalHomeCard,
  PortalHomeTheme,
} from '../home/lib/home-layout.ts';

export const ONBOARDING_STORE_NAME = 'onboarding';

export type RouteModal = 'MARITIMO' | 'AEREO';

export interface RoutePlace {
  /** Código UN/LOCODE ou IATA — o do Radar. */
  code: string;
  /** Id do local em Configurações. */
  configId: string;
  name: string;
  modal: RouteModal;
}

export const ROUTE_ORIGINS: RoutePlace[] = [
  { code: 'CNSHA', configId: 'shanghai', name: 'Shanghai', modal: 'MARITIMO' },
  { code: 'CNNGB', configId: 'ningbo', name: 'Ningbo', modal: 'MARITIMO' },
  { code: 'DEHAM', configId: 'hamburgo', name: 'Hamburgo', modal: 'MARITIMO' },
  { code: 'FRA', configId: 'frankfurt', name: 'Frankfurt', modal: 'AEREO' },
];

export const ROUTE_DESTINATIONS: RoutePlace[] = [
  { code: 'BRSSZ', configId: 'santos', name: 'Santos', modal: 'MARITIMO' },
  { code: 'BRITJ', configId: 'itajai', name: 'Itajaí', modal: 'MARITIMO' },
  { code: 'GRU', configId: 'gru', name: 'Guarulhos', modal: 'AEREO' },
];

export interface PreferredRoute {
  origin: string;
  destination: string;
  modal: RouteModal;
}

export interface NotifyContact {
  name: string;
  email: string;
}

export const NOTIFY_EVENTS = {
  propostas: 'Propostas liberadas para escolher',
  prazos: 'Prazos vencendo (hoje ou vencidos)',
  chegada: 'Mudança na previsão de chegada',
  documentos: 'Documentos pendentes com você',
} as const;
export type NotifyEvent = keyof typeof NOTIFY_EVENTS;

export interface OnboardingState {
  tourDone: boolean;
  setupDone: boolean;
  company: { name: string; segment: string; role: string };
  routes: PreferredRoute[];
  contacts: NotifyContact[];
  events: NotifyEvent[];
  /** Respostas das boas-vindas (Prompt 4). Vazio = ainda não respondeu. */
  priority: Priority | '';
  persona: Persona | '';
  /** Tela em que o assistente parou, para retomar de onde saiu. */
  wizardStep: number;
  /** A Home acabou de ser montada: ela entra em sequência uma vez. */
  revealPending: boolean;
}

export const EMPTY_ONBOARDING: OnboardingState = {
  tourDone: false,
  setupDone: false,
  company: { name: '', segment: '', role: '' },
  routes: [],
  contacts: [],
  events: ['propostas', 'prazos'],
  priority: '',
  persona: '',
  wizardStep: 0,
  revealPending: false,
};

export function routeKey(route: PreferredRoute): string {
  return `${route.origin}>${route.destination}`;
}

export function placeName(code: string): string {
  return (
    [...ROUTE_ORIGINS, ...ROUTE_DESTINATIONS].find((p) => p.code === code)
      ?.name ?? code
  );
}

export function routeLabel(route: PreferredRoute): string {
  return `${placeName(route.origin)} → ${placeName(route.destination)} · ${
    route.modal === 'AEREO' ? 'Aéreo' : 'Marítimo'
  }`;
}

/**
 * Por que esta rota não pode ser acrescentada, ou `null`. Origem e destino têm
 * de ser do MESMO modal (Frankfurt → Santos não existe como rota aérea neste
 * catálogo), e a mesma rota não entra duas vezes.
 */
export function routeIssue(
  route: Partial<PreferredRoute>,
  existing: PreferredRoute[],
): string | null {
  const origin = ROUTE_ORIGINS.find((p) => p.code === route.origin);
  const destination = ROUTE_DESTINATIONS.find(
    (p) => p.code === route.destination,
  );
  if (!origin || !destination) return 'Escolha a origem e o destino.';
  if (origin.modal !== destination.modal) {
    return origin.modal === 'AEREO'
      ? 'Frankfurt é aeroporto: escolha Guarulhos como destino.'
      : `${origin.name} é porto: escolha um porto de destino.`;
  }
  if (
    existing.some(
      (r) => r.origin === origin.code && r.destination === destination.code,
    )
  ) {
    return 'Esta rota já está na lista.';
  }
  return null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function contactIssue(contact: Partial<NotifyContact>): string | null {
  if (!contact.name?.trim()) return 'Informe o nome de quem recebe.';
  if (!contact.email?.trim() || !EMAIL.test(contact.email.trim())) {
    return 'Informe um e-mail válido (ex.: compras@suaempresa.com.br).';
  }
  return null;
}

/** Coerces the stored state. Unknown values are dropped, never repaired. */
export function parseOnboarding(raw: string | null): OnboardingState {
  if (raw == null) return EMPTY_ONBOARDING;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return EMPTY_ONBOARDING;
  }
  if (data == null || typeof data !== 'object' || Array.isArray(data))
    return EMPTY_ONBOARDING;
  const d = data as Record<string, unknown>;
  const company = (d.company ?? {}) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === 'string' ? v : '');
  const routes = Array.isArray(d.routes)
    ? (d.routes as Record<string, unknown>[])
        .filter(
          (r): r is Record<string, unknown> =>
            r != null &&
            typeof r === 'object' &&
            ROUTE_ORIGINS.some((p) => p.code === r.origin) &&
            ROUTE_DESTINATIONS.some((p) => p.code === r.destination) &&
            (r.modal === 'MARITIMO' || r.modal === 'AEREO'),
        )
        .map((r) => ({
          origin: r.origin as string,
          destination: r.destination as string,
          modal: r.modal as RouteModal,
        }))
    : [];
  const contacts = Array.isArray(d.contacts)
    ? (d.contacts as Record<string, unknown>[])
        .filter(
          (c) =>
            c != null &&
            typeof c.name === 'string' &&
            typeof c.email === 'string',
        )
        .map((c) => ({ name: c.name as string, email: c.email as string }))
    : [];
  const events = Array.isArray(d.events)
    ? (d.events as unknown[]).filter(
        (e): e is NotifyEvent => typeof e === 'string' && e in NOTIFY_EVENTS,
      )
    : EMPTY_ONBOARDING.events;
  return {
    priority: isPriority(d.priority) ? d.priority : '',
    persona: isPersona(d.persona) ? d.persona : '',
    wizardStep:
      typeof d.wizardStep === 'number' &&
      d.wizardStep >= 0 &&
      d.wizardStep < WIZARD_STEPS.length
        ? Math.floor(d.wizardStep)
        : 0,
    revealPending: d.revealPending === true,
    tourDone: d.tourDone === true,
    setupDone: d.setupDone === true,
    company: {
      name: text(company.name),
      segment: text(company.segment),
      role: text(company.role),
    },
    routes,
    contacts,
    events,
  };
}

/** Um passo do tour. `module` esconde o passo quando o módulo está desligado. */
export interface TourStep {
  id: string;
  title: string;
  body: string;
  /** Seletor do elemento a destacar; sem alvo, o card fica centralizado. */
  target?: string;
  module?: 'cotacao' | 'embarques' | 'inteligencia';
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'boas-vindas',
    title: 'Bem-vindo ao Centrix',
    body: 'Em um minuto, mostramos onde fica cada coisa. Você pode pular e rever o tour quando quiser, em Configurações.',
  },
  {
    id: 'central',
    title: 'Central de trabalho',
    body: 'Seu ponto de partida no dia: o que venceu, o que vence hoje e o que espera retorno, com a ação ao lado de cada item.',
    target: 'a[href="/portal/visao-geral"]',
  },
  {
    id: 'cotacoes',
    title: 'Minhas Cotações e Nova cotação',
    body: 'Acompanhe cada cotação até a escolha da proposta. Para pedir uma nova, use "Solicitar nova cotação" no topo da tela.',
    target: 'a[href="/portal/cotacoes"]',
    module: 'cotacao',
  },
  {
    id: 'embarques',
    title: 'Meus Embarques',
    body: 'Onde está cada carga, a previsão de chegada e o que depende de você, como documentos e aprovação de booking.',
    target: 'a[href="/portal/embarques"]',
    module: 'embarques',
  },
  {
    id: 'performance',
    title: 'Performance',
    body: 'Para a leitura da semana: pontualidade, preços das suas rotas e auditoria de frete, com o que mudou em cada número.',
    target: 'a[href="/portal/inteligencia"]',
    module: 'inteligencia',
  },
  {
    id: 'suporte',
    title: 'Ajuda e suporte',
    body: 'Dúvida ou problema? Fale com o suporte ou reporte o que aconteceu, direto desta tela.',
    target: '[data-tour="suporte"]',
  },
];

export function visibleTourSteps(
  flags: Partial<Record<string, boolean>>,
): TourStep[] {
  return TOUR_STEPS.filter(
    (step) => !step.module || flags[step.module] !== false,
  );
}

// ---------------------------------------------------------------------------
// Boas-vindas "uau" (Prompt 4, 01/10/2026). Feedback do Vinicius: o onboarding
// era "só funcional". Três perguntas em cartões, um mapa de rotas desenhado à
// mão e a Home se montando no fim. No máximo ~90 s, "Pular" sempre à vista,
// retomável, e nada de número inventado apresentado como real.
// ---------------------------------------------------------------------------

export const WIZARD_STEPS = [
  'boas-vindas',
  'prioridade',
  'rotas',
  'papel',
] as const;

export type Priority = 'custo' | 'prazo' | 'visibilidade';
export type Persona = 'comex' | 'compras' | 'financeiro' | 'gestor';

export const PRIORITY_OPTIONS: { id: Priority; label: string; hint: string }[] =
  [
    {
      id: 'custo',
      label: 'Custo',
      hint: 'Pagar menos pelo frete e entender cada cobrança.',
    },
    {
      id: 'prazo',
      label: 'Prazo',
      hint: 'Saber quando a carga chega e agir antes do atraso.',
    },
    {
      id: 'visibilidade',
      label: 'Visibilidade',
      hint: 'Ver onde está cada embarque, sem perguntar a ninguém.',
    },
  ];

export const PERSONA_OPTIONS: { id: Persona; label: string; hint: string }[] = [
  {
    id: 'comex',
    label: 'Comex',
    hint: 'Cotações, embarques e documentos no dia a dia.',
  },
  {
    id: 'compras',
    label: 'Compras',
    hint: 'Pedidos, fornecedores e quando cada PO chega.',
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    hint: 'Custo de frete, economia e o que vai ser cobrado.',
  },
  {
    id: 'gestor',
    label: 'Gestor',
    hint: 'A visão do todo: riscos, custos e onde está a carga.',
  },
];

export function isPriority(value: unknown): value is Priority {
  return PRIORITY_OPTIONS.some((o) => o.id === value);
}
export function isPersona(value: unknown): value is Persona {
  return PERSONA_OPTIONS.some((o) => o.id === value);
}

/** Ordem dos temas da Home por papel: o primeiro é o que a pessoa olha antes. */
const PERSONA_THEMES: Record<Persona, PortalHomeTheme[]> = {
  comex: ['acao', 'mapa', 'custos'],
  compras: ['acao', 'custos', 'mapa'],
  financeiro: ['custos', 'acao'],
  gestor: ['mapa', 'custos', 'acao'],
};

/** O tema que responde à prioridade escolhida. */
const PRIORITY_THEME: Record<Priority, PortalHomeTheme> = {
  custo: 'custos',
  prazo: 'acao',
  visibilidade: 'mapa',
};

/**
 * Os temas iniciais da Home, em ordem: o tema da PRIORIDADE vem primeiro (é o
 * que a pessoa disse que mais importa, e a faixa "Sua Home está pronta" afirma
 * isso), e o papel ordena o resto. Sem papel, a Home completa na ordem de
 * sempre.
 */
export function themesForProfile(
  persona: Persona | '',
  priority: Priority | '',
): PortalHomeTheme[] {
  const base = persona
    ? [...PERSONA_THEMES[persona]]
    : (['acao', 'mapa', 'custos'] as PortalHomeTheme[]);
  if (!priority) return base;
  const theme = PRIORITY_THEME[priority];
  return [theme, ...base.filter((t) => t !== theme)];
}

/**
 * Reordena os cards da Home pela ordem dos temas do perfil. Os cards de um
 * mesmo tema mantêm a ordem entre si; card de tema fora do perfil vai para o
 * fim. Sem papel, nada muda.
 */
export function orderCardsForProfile<C extends PortalHomeCard>(
  cards: C[],
  cardTheme: Record<PortalHomeCard, PortalHomeTheme>,
  persona: Persona | '',
  priority: Priority | '',
): C[] {
  if (!persona) return cards;
  const order = themesForProfile(persona, priority);
  const rank = (card: C) => {
    const i = order.indexOf(cardTheme[card]);
    return i < 0 ? order.length : i;
  };
  return cards
    .map((card, i) => ({ card, i }))
    .sort((a, b) => rank(a.card) - rank(b.card) || a.i - b.i)
    .map((x) => x.card);
}

/** Coordenadas públicas dos portos/aeroportos da lista curta (lon, lat). */
export const PLACE_COORDS: Record<string, [number, number]> = {
  CNSHA: [121.5, 31.2],
  CNNGB: [121.6, 29.9],
  DEHAM: [9.99, 53.55],
  FRA: [8.57, 50.03],
  BRSSZ: [-46.33, -23.96],
  BRITJ: [-48.66, -26.91],
  GRU: [-46.47, -23.43],
};

/** Projeção equirretangular no viewBox 0..360 x 0..180 do mapa. */
export function projectPlace(code: string): { x: number; y: number } | null {
  const c = PLACE_COORDS[code];
  if (!c) return null;
  return { x: c[0] + 180, y: 90 - c[1] };
}

/** Um arco entre dois pontos: curva quadrática com o meio erguido. */
export function arcPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
): string {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const lift = Math.min(40, Math.hypot(to.x - from.x, to.y - from.y) / 3);
  return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${mx.toFixed(1)} ${(my - lift).toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
}

/**
 * EXEMPLO de leitura de rota, do seed fictício. Sempre exibido com a etiqueta
 * "exemplo": no produto real isto viria do data lake (HANDOFF-BACKEND.md).
 * Nenhum número aqui é medição.
 */
export interface RouteExample {
  transit: string;
  trend: 'alta' | 'estavel' | 'queda';
  trendLabel: string;
  sentence: string;
}

const ROUTE_EXAMPLES: Record<string, RouteExample> = {
  'CNSHA>BRSSZ': {
    transit: '35 a 42 dias',
    trend: 'alta',
    trendLabel: 'Frete em alta (+12% em 4 semanas)',
    sentence:
      'Rota de maior volume: vale cotar com antecedência na alta temporada.',
  },
  'CNSHA>BRITJ': {
    transit: '38 a 45 dias',
    trend: 'estavel',
    trendLabel: 'Frete estável',
    sentence:
      'Menos saídas semanais que Santos; prontidão confirmada cedo evita rolagem.',
  },
  'CNNGB>BRSSZ': {
    transit: '36 a 43 dias',
    trend: 'alta',
    trendLabel: 'Frete em alta (+9% em 4 semanas)',
    sentence: 'Costuma acompanhar Shanghai com uma semana de atraso no preço.',
  },
  'CNNGB>BRITJ': {
    transit: '39 a 46 dias',
    trend: 'estavel',
    trendLabel: 'Frete estável',
    sentence: 'Boa alternativa quando Santos está congestionado.',
  },
  'DEHAM>BRSSZ': {
    transit: '22 a 28 dias',
    trend: 'queda',
    trendLabel: 'Frete em queda (-6% em 4 semanas)',
    sentence: 'Janela favorável para fechar contratos de médio prazo.',
  },
  'DEHAM>BRITJ': {
    transit: '24 a 30 dias',
    trend: 'estavel',
    trendLabel: 'Frete estável',
    sentence: 'Transbordo comum; confira o porto de baldeação na proposta.',
  },
  'FRA>GRU': {
    transit: '2 a 4 dias',
    trend: 'estavel',
    trendLabel: 'Tarifa estável',
    sentence: 'Aéreo direto: o prazo pesa mais que o preço por quilo.',
  },
};

export function routeExample(route: {
  origin: string;
  destination: string;
}): RouteExample | null {
  return ROUTE_EXAMPLES[`${route.origin}>${route.destination}`] ?? null;
}

/** Até 3 rotas nas boas-vindas: é uma amostra, não um cadastro. */
export const MAX_WELCOME_ROUTES = 3;

// ---------------------------------------------------- "Primeiros passos" --

export const FIRST_STEPS_STORE_NAME = 'first-steps';

export const FIRST_STEPS = [
  {
    id: 'cotacao',
    label: 'Abrir a sua primeira cotação',
    href: '/portal/nova-cotacao',
  },
  {
    id: 'alertas',
    label: 'Configurar os seus alertas',
    href: '/portal/embarques?tab=alertas',
  },
  { id: 'colega', label: 'Convidar um colega', href: null },
] as const;

export type FirstStepId = (typeof FIRST_STEPS)[number]['id'];

export interface FirstStepsState {
  done: FirstStepId[];
  dismissed: boolean;
}

export const EMPTY_FIRST_STEPS: FirstStepsState = {
  done: [],
  dismissed: false,
};

export function parseFirstSteps(raw: string | null): FirstStepsState {
  if (raw == null) return EMPTY_FIRST_STEPS;
  try {
    const d = JSON.parse(raw) as Record<string, unknown>;
    const ids = FIRST_STEPS.map((s) => s.id) as string[];
    const done = Array.isArray(d.done)
      ? Array.from(
          new Set(
            (d.done as unknown[]).filter(
              (x): x is FirstStepId => typeof x === 'string' && ids.includes(x),
            ),
          ),
        )
      : [];
    return { done, dismissed: d.dismissed === true };
  } catch {
    return EMPTY_FIRST_STEPS;
  }
}

export function firstStepsProgress(state: FirstStepsState): {
  done: number;
  total: number;
  complete: boolean;
} {
  const total = FIRST_STEPS.length;
  return {
    done: state.done.length,
    total,
    complete: state.done.length >= total,
  };
}

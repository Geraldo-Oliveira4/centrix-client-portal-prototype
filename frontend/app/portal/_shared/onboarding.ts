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
  /** Ação secundária da parada (ex.: "Ver na prática"). Encerra o tour. */
  cta?: { label: string; href: string };
}

/** Abre a Inteligência na visão "Minha operação" com o mini-guia de 3 balões. */
export const INTEL_PRACTICE_HREF = '/portal/inteligencia?visao=minha-operacao&guia=1';

/**
 * O MINI TOUR (Prompt 5): opcional, oferecido no fim das boas-vindas. Mostra
 * onde ficam as coisas que o cliente não acha sozinho: os dois grupos do menu,
 * a Central de trabalho, a Performance (07/10/2026: a Inteligência é
 * estratégica e só aparecia numa frase) e o botão de Ajuda. Sem alvo visível
 * (menu fechado no celular), o card vira folha de baixo e o texto continua.
 */
export const TOUR_STEPS: TourStep[] = [
  {
    id: 'menu',
    title: 'Operação e Performance',
    body: 'O menu tem dois grupos: Operação, para o dia a dia (cotações e embarques), e Performance, para a leitura da semana (indicadores, preços e auditoria).',
    target: '[data-tour="menu"]',
  },
  {
    id: 'central',
    title: 'Central de trabalho',
    body: 'Seu ponto de partida no dia: o que venceu, o que vence hoje e o que espera retorno, com a ação ao lado de cada item.',
    target: 'a[href="/portal/visao-geral"]',
  },
  {
    id: 'performance',
    title: 'Performance',
    body: 'Na Inteligência fica a leitura da semana: cada indicador traz a variação e uma conclusão em uma frase. Os filtros recortam por rota, agente ou exportador, e o que você escolheu nas boas-vindas já virou a visão "Minha operação".',
    target: '[data-tour="menu"] a[href^="/portal/inteligencia"]',
    module: 'inteligencia',
    cta: { label: 'Ver na prática', href: INTEL_PRACTICE_HREF },
  },
  {
    id: 'suporte',
    title: 'Ajuda',
    body: 'Dúvida ou problema? Fale com o suporte ou reporte o que aconteceu, direto desta tela.',
    target: '[data-tour="suporte"]',
  },
];

/** Teto do mini tour: mais que isso deixa de ser "mini". */
export const MAX_TOUR_STEPS = 4;

/** "2 de 4": a numeração conta só as paradas visíveis com os módulos atuais. */
export function tourStepLabel(index: number, total: number): string {
  return `${index + 1} de ${total}`;
}

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
 * O mesmo arco, em [lat, lng] para o Leaflet (mapa da Home): bezier
 * quadrática com o meio erguido para o norte, amostrada em `n` pontos.
 */
export function routeArcLatLngs(
  originCode: string,
  destinationCode: string,
  n = 32,
): [number, number][] | null {
  const a = PLACE_COORDS[originCode];
  const b = PLACE_COORDS[destinationCode];
  if (!a || !b) return null;
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const lift = Math.min(28, Math.hypot(lon2 - lon1, lat2 - lat1) / 4);
  const cLon = (lon1 + lon2) / 2;
  const cLat = (lat1 + lat2) / 2 + lift;
  const points: [number, number][] = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const u = 1 - t;
    points.push([
      u * u * lat1 + 2 * u * t * cLat + t * t * lat2,
      u * u * lon1 + 2 * u * t * cLon + t * t * lon2,
    ]);
  }
  return points;
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

// --------------------------------------------- "Cotar esta rota agora" --

/**
 * O valor do formulário da Nova cotação para cada ponto do mapa. Mapa
 * explícito, como o `QUOTATION_PORT_OPTION` do Radar: o formulário fala
 * UN/LOCODE em inglês e a busca por prefixo erraria calada. O teste confere
 * cada valor contra as listas reais do formulário.
 */
export const WELCOME_FORM_OPTION: Record<string, string> = {
  CNSHA: 'Shanghai, China (CNSHA)',
  CNNGB: 'Ningbo, China (CNNGB)',
  DEHAM: 'Hamburg, Germany (DEHAM)',
  FRA: '(FRA) Frankfurt am Main, DE',
  BRSSZ: 'Santos, Brazil (BRSSZ)',
  BRITJ: 'Itajai, Brazil (BRITJ)',
  GRU: '(GRU) São Paulo, BR',
};

/** Marca a cotação que nasceu das boas-vindas (`fonte=boas_vindas`). */
export const WELCOME_SOURCE_PARAM = 'fonte';
export const WELCOME_SOURCE = 'boas_vindas';

/**
 * Link da Nova cotação com origem, destino e modal da rota escolhida. São
 * valores que o PRÓPRIO cliente informou, por isso valem também para o SaaS
 * puro (a regra "nada vem preenchido" é sobre o que o sistema deduz).
 */
export function welcomeQuotationHref(route: PreferredRoute): string {
  const params = new URLSearchParams();
  params.set('modal', route.modal);
  const from = WELCOME_FORM_OPTION[route.origin];
  const to = WELCOME_FORM_OPTION[route.destination];
  const air = route.modal === 'AEREO';
  if (from) params.set(air ? 'aeroporto_embarque' : 'porto_embarque', from);
  if (to) params.set(air ? 'aeroporto_destino' : 'porto_destino', to);
  params.set(
    'rota',
    `${placeName(route.origin)} → ${placeName(route.destination)}`,
  );
  params.set(WELCOME_SOURCE_PARAM, WELCOME_SOURCE);
  return `/portal/nova-cotacao?${params.toString()}`;
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
    // Preferências de alertas (canal, frequência, resumo semanal). Os TIPOS de
    // alerta continuam em Configurações > Alertas, linkada de lá.
    href: '/portal/preferencias/alertas',
  },
  {
    id: 'inteligencia',
    label: 'Ver sua Inteligência',
    // Conclui ao ABRIR a página (IntelligencePreview), não no clique.
    href: '/portal/inteligencia',
  },
  {
    id: 'visao',
    label: 'Salvar uma visão',
    // Conclui quando a Inteligência avisa que uma visão foi salva ou editada.
    href: '/portal/inteligencia',
  },
  { id: 'colega', label: 'Convidar um colega', href: null },
] as const;

/**
 * Passos que se concluem pela AÇÃO na tela de destino, nunca pelo clique no
 * link do checklist: cotação (ao enviar), alertas (ao salvar), Inteligência
 * (ao abrir) e visão (ao salvar uma).
 */
export const FIRST_STEPS_DONE_BY_ACTION: FirstStepId[] = [
  'cotacao',
  'alertas',
  'inteligencia',
  'visao',
];

export type FirstStepId = (typeof FIRST_STEPS)[number]['id'];

export interface FirstStepsState {
  done: FirstStepId[];
  dismissed: boolean;
  /**
   * O passo concluído por último e ainda não comemorado: a Home anima o anel
   * uma vez e limpa. Existe porque a cotação conclui o passo em OUTRA tela.
   */
  justDone: FirstStepId | null;
}

export const EMPTY_FIRST_STEPS: FirstStepsState = {
  done: [],
  dismissed: false,
  justDone: null,
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
    const justDone =
      typeof d.justDone === 'string' && done.includes(d.justDone as FirstStepId)
        ? (d.justDone as FirstStepId)
        : null;
    return { done, dismissed: d.dismissed === true, justDone };
  } catch {
    return EMPTY_FIRST_STEPS;
  }
}

/** O próximo passo a fazer, na ordem da lista, ou `null` se acabou. */
export function nextFirstStep(
  state: FirstStepsState,
): (typeof FIRST_STEPS)[number] | null {
  return FIRST_STEPS.find((s) => !state.done.includes(s.id)) ?? null;
}

/** Faltando um só passo, o cartão vira uma barra fina: o resto já é rotina. */
export function firstStepsCompact(state: FirstStepsState): boolean {
  return state.done.length >= FIRST_STEPS.length - 1;
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

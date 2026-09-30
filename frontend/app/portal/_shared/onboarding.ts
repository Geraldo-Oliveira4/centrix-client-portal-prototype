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
}

export const EMPTY_ONBOARDING: OnboardingState = {
  tourDone: false,
  setupDone: false,
  company: { name: '', segment: '', role: '' },
  routes: [],
  contacts: [],
  events: ['propostas', 'prazos'],
};

export function routeKey(route: PreferredRoute): string {
  return `${route.origin}>${route.destination}`;
}

export function placeName(code: string): string {
  return (
    [...ROUTE_ORIGINS, ...ROUTE_DESTINATIONS].find((p) => p.code === code)?.name ?? code
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
  const destination = ROUTE_DESTINATIONS.find((p) => p.code === route.destination);
  if (!origin || !destination) return 'Escolha a origem e o destino.';
  if (origin.modal !== destination.modal) {
    return origin.modal === 'AEREO'
      ? 'Frankfurt é aeroporto: escolha Guarulhos como destino.'
      : `${origin.name} é porto: escolha um porto de destino.`;
  }
  if (existing.some((r) => r.origin === origin.code && r.destination === destination.code)) {
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
  if (data == null || typeof data !== 'object' || Array.isArray(data)) return EMPTY_ONBOARDING;
  const d = data as Record<string, unknown>;
  const company = (d.company ?? {}) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === 'string' ? v : '');
  const routes = Array.isArray(d.routes)
    ? (d.routes as Record<string, unknown>[]).filter(
        (r): r is Record<string, unknown> =>
          r != null &&
          typeof r === 'object' &&
          ROUTE_ORIGINS.some((p) => p.code === r.origin) &&
          ROUTE_DESTINATIONS.some((p) => p.code === r.destination) &&
          (r.modal === 'MARITIMO' || r.modal === 'AEREO'),
      ).map((r) => ({
        origin: r.origin as string,
        destination: r.destination as string,
        modal: r.modal as RouteModal,
      }))
    : [];
  const contacts = Array.isArray(d.contacts)
    ? (d.contacts as Record<string, unknown>[])
        .filter((c) => c != null && typeof c.name === 'string' && typeof c.email === 'string')
        .map((c) => ({ name: c.name as string, email: c.email as string }))
    : [];
  const events = Array.isArray(d.events)
    ? (d.events as unknown[]).filter((e): e is NotifyEvent =>
        typeof e === 'string' && e in NOTIFY_EVENTS,
      )
    : EMPTY_ONBOARDING.events;
  return {
    tourDone: d.tourDone === true,
    setupDone: d.setupDone === true,
    company: { name: text(company.name), segment: text(company.segment), role: text(company.role) },
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
  return TOUR_STEPS.filter((step) => !step.module || flags[step.module] !== false);
}

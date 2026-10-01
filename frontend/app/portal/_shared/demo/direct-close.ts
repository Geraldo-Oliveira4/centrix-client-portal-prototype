// Fechamento direto — o cliente fecha com o agente PREFERIDO da rota, sem
// cotar. Visão do cliente, simulada no navegador como o resto da V2.
//
// PURE, sem o alias `@/`: roda sob `npm run test:unit`.
//
// POR QUE EXISTE. Em rotas onde o cliente sempre embarca com o mesmo agente,
// cotar de novo é trabalho sem decisão no fim. O fechamento direto pula a
// cotação, mas NÃO pula a Freitas: o pedido entra no Inbox e passa pela revisão
// de entrada como qualquer outra entrada (mesmo prazo, mesma devolução com
// motivo). Só depois dela a instrução segue para o agente.
//
// O QUE É ILUSTRATIVO. Não existe, neste repositório, a relação "rota -> agente
// preferido": `DIRECT_CLOSE_ROUTES` é uma tabela FICTÍCIA, com os agentes do
// seed (ALPHA/BETA/GAMMA) e portos que a demo já usa. Na versão integrada ela
// vem do cadastro da Freitas (DNA do cliente / acordo de rota) e o cliente não
// escolhe o agente — ele é o preferido da rota ou a rota não tem fechamento
// direto. A rota SEM agente preferido existe de propósito: é o estado vazio que
// explica e oferece "Cotar normalmente".

export const DIRECT_CLOSE_STORE_NAME = 'direct-close';

export interface DirectCloseRoute {
  id: string;
  origin: string;
  destination: string;
  modal: 'MARITIMO' | 'AEREO' | 'RODOVIARIO';
  /** O valor do formulário de cotação, para o atalho "Cotar normalmente". */
  originOption: string | null;
  destinationOption: string | null;
  /** `null`: a rota não tem agente preferido cadastrado. */
  preferredAgent: string | null;
}

export const DIRECT_CLOSE_ROUTES: DirectCloseRoute[] = [
  {
    id: 'shanghai-santos',
    origin: 'Shanghai',
    destination: 'Santos',
    modal: 'MARITIMO',
    originOption: 'Shanghai, China (CNSHA)',
    destinationOption: 'Santos, Brazil (BRSSZ)',
    preferredAgent: 'AGENTE ALPHA',
  },
  {
    id: 'busan-santos',
    origin: 'Busan',
    destination: 'Santos',
    modal: 'MARITIMO',
    originOption: 'Busan, South Korea (KRPUS)',
    destinationOption: 'Santos, Brazil (BRSSZ)',
    preferredAgent: 'AGENTE BETA',
  },
  {
    id: 'hamburgo-santos',
    origin: 'Hamburgo',
    destination: 'Santos',
    modal: 'MARITIMO',
    originOption: 'Hamburg, Germany (DEHAM)',
    destinationOption: 'Santos, Brazil (BRSSZ)',
    preferredAgent: 'AGENTE GAMMA',
  },
  {
    id: 'izmir-santos',
    origin: 'Izmir',
    destination: 'Santos',
    modal: 'MARITIMO',
    originOption: 'Izmir, Turkey (TRIZM)',
    destinationOption: 'Santos, Brazil (BRSSZ)',
    preferredAgent: null,
  },
];

export function routeLabel(
  route: Pick<DirectCloseRoute, 'origin' | 'destination'>,
) {
  return `${route.origin} → ${route.destination}`;
}

/** The "Cotar normalmente" link: Nova cotação with the route pre-filled. */
export function quoteNormallyHref(route: DirectCloseRoute | null): string {
  if (!route) return '/portal/nova-cotacao';
  const params = new URLSearchParams();
  params.set('modal', route.modal);
  if (route.originOption) params.set('porto_embarque', route.originOption);
  if (route.destinationOption)
    params.set('porto_destino', route.destinationOption);
  params.set('rota', routeLabel(route));
  return `/portal/nova-cotacao?${params.toString()}`;
}

/** Os dados mínimos do embarque. Tudo texto, como o formulário os entrega. */
export interface DirectCloseForm {
  routeId: string;
  product: string;
  clientReference: string;
  incoterm: string;
  readyDate: string;
  cargo: string;
  observations: string;
}

export const EMPTY_DIRECT_CLOSE_FORM: DirectCloseForm = {
  routeId: '',
  product: '',
  clientReference: '',
  incoterm: '',
  readyDate: '',
  cargo: '',
  observations: '',
};

/**
 * SaaS puro (Prompt 3): sem tabela da Freitas, o cliente INFORMA a rota e o
 * agente. Nada é preenchido pela rota. O pedido guarda o que foi informado
 * (`manualRoute`), e `routeId` vira `MANUAL_ROUTE_ID`.
 */
export const MANUAL_ROUTE_ID = 'manual';

export interface ManualDirectCloseRoute {
  origin: string;
  destination: string;
  agent: string;
}

export const EMPTY_MANUAL_ROUTE: ManualDirectCloseRoute = { origin: '', destination: '', agent: '' };

export interface DirectCloseIssue {
  field: keyof DirectCloseForm;
  label: string;
  reason: string;
}

/**
 * What still blocks sending. Short on purpose: the agent is already decided,
 * so what the Freitas needs is what to ship, when, and under which terms.
 * Observações is the only optional field.
 */
export function directCloseIssues(
  form: DirectCloseForm,
  routes: DirectCloseRoute[] = DIRECT_CLOSE_ROUTES,
  manual: ManualDirectCloseRoute | null = null,
): DirectCloseIssue[] {
  const issues: DirectCloseIssue[] = [];
  const route = routes.find((item) => item.id === form.routeId);
  if (manual) {
    const fields: [keyof ManualDirectCloseRoute, string, string][] = [
      ['origin', 'Origem', 'Informe a origem.'],
      ['destination', 'Destino', 'Informe o destino.'],
      ['agent', 'Agente', 'Informe o agente com quem você embarca.'],
    ];
    for (const [key, label, reason] of fields)
      if (!manual[key].trim()) issues.push({ field: 'routeId', label, reason });
  } else if (!route) {
    issues.push({ field: 'routeId', label: 'Rota', reason: 'Escolha a rota.' });
  } else if (!route.preferredAgent) {
    issues.push({
      field: 'routeId',
      label: 'Rota',
      reason: 'Esta rota não tem agente preferido: use "Cotar normalmente".',
    });
  }
  const required: [keyof DirectCloseForm, string, string][] = [
    ['product', 'Mercadoria', 'Descreva a mercadoria.'],
    [
      'clientReference',
      'Referência do cliente',
      'Informe a sua referência (PO ou pedido).',
    ],
    ['incoterm', 'Incoterm', 'Escolha o Incoterm combinado com o fornecedor.'],
    ['readyDate', 'Prontidão da carga', 'Informe quando a carga fica pronta.'],
    [
      'cargo',
      'Carga',
      'Descreva equipamento ou volumes (ex.: 1 × 40’ HC, 12.000 kg).',
    ],
  ];
  for (const [field, label, reason] of required) {
    if (!form[field].trim()) issues.push({ field, label, reason });
  }
  return issues;
}

export type DirectCloseStage = 'entry_review' | 'returned' | 'approved';

export const DIRECT_CLOSE_STAGE_LABELS: Record<DirectCloseStage, string> = {
  entry_review: 'Em revisão',
  returned: 'Devolvido',
  approved: 'Instrução enviada',
};

export const DIRECT_CLOSE_STAGE_DESCRIPTIONS: Record<DirectCloseStage, string> =
  {
    entry_review:
      'A Freitas está revisando o pedido antes de instruir o agente',
    returned: 'A Freitas pediu um ajuste antes de instruir o agente',
    approved: 'A Freitas aprovou e enviou a instrução de embarque ao agente',
  };

export interface DirectCloseEvent {
  kind: 'submitted' | 'resubmitted' | 'returned' | 'approved';
  at: string;
  reason?: string;
}

export interface DirectCloseRequest {
  id: string;
  reference: string;
  routeId: string;
  /** Snapshot of the agent at the time of the request. */
  agent: string;
  /** Only for SaaS-pure requests: route and agent as the client typed them. */
  manualRoute?: { origin: string; destination: string };
  form: DirectCloseForm;
  stage: DirectCloseStage;
  stageEnteredAt: string;
  returnReason?: string;
  history: DirectCloseEvent[];
}

export type DirectCloseStore = Record<string, DirectCloseRequest>;

/** "FD-2026-0001", sequential inside this browser. */
export function nextDirectCloseReference(
  store: DirectCloseStore,
  year = 2026,
): string {
  const used = Object.values(store)
    .map((request) => /^FD-\d{4}-(\d{4})$/.exec(request.reference)?.[1])
    .filter((n): n is string => !!n)
    .map(Number);
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `FD-${year}-${String(next).padStart(4, '0')}`;
}

/**
 * Sends a new request to the Freitas' entry review. Refused (`null`) while
 * anything blocks — the screen keeps the button disabled, this is the net.
 */
export function submitDirectClose(
  store: DirectCloseStore,
  form: DirectCloseForm,
  at: string,
  routes: DirectCloseRoute[] = DIRECT_CLOSE_ROUTES,
  manual: ManualDirectCloseRoute | null = null,
): DirectCloseRequest | null {
  if (directCloseIssues(form, routes, manual).length) return null;
  const reference = nextDirectCloseReference(store);
  if (manual) {
    return {
      id: `fd:${reference}`,
      reference,
      routeId: MANUAL_ROUTE_ID,
      agent: manual.agent.trim(),
      manualRoute: { origin: manual.origin.trim(), destination: manual.destination.trim() },
      form: { ...form, routeId: MANUAL_ROUTE_ID },
      stage: 'entry_review',
      stageEnteredAt: at,
      history: [{ kind: 'submitted', at }],
    };
  }
  const route = routes.find((item) => item.id === form.routeId)!;
  return {
    id: `fd:${reference}`,
    reference,
    routeId: route.id,
    agent: route.preferredAgent!,
    form: { ...form },
    stage: 'entry_review',
    stageEnteredAt: at,
    history: [{ kind: 'submitted', at }],
  };
}

/** Freitas returns it with a reason. Always manual, like the quotation. */
export function returnDirectClose(
  request: DirectCloseRequest,
  reason: string,
  at: string,
): DirectCloseRequest {
  const trimmed = reason.trim();
  if (!trimmed || request.stage !== 'entry_review') return request;
  return {
    ...request,
    stage: 'returned',
    stageEnteredAt: at,
    returnReason: trimmed,
    history: [...request.history, { kind: 'returned', at, reason: trimmed }],
  };
}

/** Client corrects and resends: back to the Inbox, history preserved. */
export function resubmitDirectClose(
  request: DirectCloseRequest,
  form: DirectCloseForm,
  at: string,
  routes: DirectCloseRoute[] = DIRECT_CLOSE_ROUTES,
): DirectCloseRequest {
  if (request.stage !== 'returned') return request;
  const manual = request.manualRoute ? { ...request.manualRoute, agent: request.agent } : null;
  if (directCloseIssues(form, routes, manual).length) return request;
  const { returnReason: _dropped, ...rest } = request;
  return {
    ...rest,
    form: { ...form },
    stage: 'entry_review',
    stageEnteredAt: at,
    history: [...request.history, { kind: 'resubmitted', at }],
  };
}

/** Freitas approves: the shipping instruction goes to the preferred agent. */
export function approveDirectClose(
  request: DirectCloseRequest,
  at: string,
): DirectCloseRequest {
  if (request.stage !== 'entry_review') return request;
  return {
    ...request,
    stage: 'approved',
    stageEnteredAt: at,
    history: [...request.history, { kind: 'approved', at }],
  };
}

const STAGES: DirectCloseStage[] = ['entry_review', 'returned', 'approved'];
const FORM_KEYS = Object.keys(
  EMPTY_DIRECT_CLOSE_FORM,
) as (keyof DirectCloseForm)[];

/**
 * Parses the stored map. An entry this version does not understand is DROPPED,
 * never repaired — same rule as the rest of the V2 overlay.
 */
export function parseDirectCloseStore(raw: string | null): DirectCloseStore {
  if (raw == null) return {};
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {};
  }
  if (data == null || typeof data !== 'object' || Array.isArray(data))
    return {};
  const out: DirectCloseStore = {};
  for (const [id, value] of Object.entries(data as Record<string, unknown>)) {
    if (value == null || typeof value !== 'object') continue;
    const entry = value as Record<string, unknown>;
    const form = entry.form as Record<string, unknown> | undefined;
    if (
      typeof entry.reference !== 'string' ||
      typeof entry.routeId !== 'string' ||
      typeof entry.agent !== 'string' ||
      typeof entry.stageEnteredAt !== 'string' ||
      !STAGES.includes(entry.stage as DirectCloseStage) ||
      form == null ||
      typeof form !== 'object' ||
      !FORM_KEYS.every((key) => typeof form[key] === 'string')
    ) {
      continue;
    }
    const history = Array.isArray(entry.history)
      ? (entry.history as DirectCloseEvent[]).filter(
          (event) =>
            event != null &&
            typeof event.at === 'string' &&
            ['submitted', 'resubmitted', 'returned', 'approved'].includes(
              event.kind,
            ),
        )
      : [];
    out[id] = {
      id,
      reference: entry.reference,
      routeId: entry.routeId,
      agent: entry.agent,
      form: Object.fromEntries(
        FORM_KEYS.map((key) => [key, form[key] as string]),
      ) as unknown as DirectCloseForm,
      stage: entry.stage as DirectCloseStage,
      stageEnteredAt: entry.stageEnteredAt,
      history,
      ...(isManualRoute(entry.manualRoute) ? { manualRoute: entry.manualRoute } : {}),
      ...(typeof entry.returnReason === 'string' && entry.returnReason
        ? { returnReason: entry.returnReason }
        : {}),
    };
  }
  return out;
}

function isManualRoute(value: unknown): value is { origin: string; destination: string } {
  if (value == null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.origin === 'string' && typeof v.destination === 'string';
}

/** The route as the request names it: from the table, or as the client typed it. */
export function requestRouteLabel(
  request: DirectCloseRequest,
  routes: DirectCloseRoute[] = DIRECT_CLOSE_ROUTES,
): string {
  if (request.manualRoute) return `${request.manualRoute.origin} → ${request.manualRoute.destination}`;
  const route = routes.find((item) => item.id === request.routeId);
  return route ? routeLabel(route) : 'Rota não encontrada';
}

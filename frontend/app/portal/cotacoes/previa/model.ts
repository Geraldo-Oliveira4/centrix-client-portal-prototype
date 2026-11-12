// Demonstration-only data. No writes to the portal API.
//
// RELÓGIO DA DEMONSTRAÇÃO (12/11/2026), mesma regra da Inteligência: as datas
// abaixo são escritas contra a DATA-BASE `BASE_TODAY` e deslocadas inteiras para
// o `today` de cada cotação (`createQuote(id, today)`), que é a data atual ou
// `?hoje=AAAA-MM-DD`. Diferenças entre datas (validade, chegada x necessidade)
// não mudam; nenhum "hoje" fica congelado. Os testes injetam `today`.
import { addDays, shiftIso } from '../../../../lib/demo-clock.ts';

export const BASE_TODAY = '2026-09-13';

/** "DD/MM" de uma data `AAAA-MM-DD`. */
export const dayMonth = (day: string) =>
  day.slice(8, 10) + '/' + day.slice(5, 7);
/** "DD/MM/AAAA" de uma data `AAAA-MM-DD`. */
export const fullDay = (day: string) => dayMonth(day) + '/' + day.slice(0, 4);

/** Horário padrão do envio programado: amanhã às 09:00. */
export function defaultSendAt(today: string): string {
  return addDays(today, 1) + 'T09:00';
}
export const STORAGE_KEY = 'centrix-quotation-preview-v1';
export const availableAgents = [
  'Alpha Cargo',
  'Beta Logistics',
  'Gamma Comex',
  'Delta Freight',
  'Atlas Cargo',
];

export function inviteMoreAgents(q: Quote, names: string[]): Quote {
  if (!['waiting', 'partial', 'ready'].includes(q.stage))
    throw new Error(
      'Convites adicionais estão disponíveis enquanto a cotação está aberta para propostas.',
    );
  const added = Array.from(new Set(names)).filter(
    (name) => !q.targetAgents.includes(name),
  );
  if (!added.length) throw new Error('Selecione um novo agente.');
  if (added.some((name) => !availableAgents.includes(name)))
    throw new Error('Selecione agentes disponíveis para esta solicitação.');
  const targetAgents = [...q.targetAgents, ...added];
  return {
    ...q,
    targetAgents,
    agentCount: targetAgents.length,
    events: [
      'Agora — Convite adicional para ' + added.join(', ') + ' (simulação).',
      ...q.events,
    ],
  };
}

export function receiveNextOffer(q: Quote): Quote {
  if (!['waiting', 'partial', 'ready'].includes(q.stage)) return q;
  const next = createQuote('comparar', q.today).offers.find(
    (offer) =>
      q.targetAgents.includes(offer.agent) &&
      !q.offers.some((existing) => existing.id === offer.id),
  );
  if (!next) return q;
  return {
    ...q,
    offers: [...q.offers, next],
    stage: q.stage === 'ready' ? 'ready' : 'partial',
    events: [
      'Agora — Proposta de ' + next.agent + ' recebida (simulação).',
      ...q.events,
    ],
  };
}
export type Stage =
  | 'draft'
  | 'scheduled'
  | 'needs-info'
  | 'waiting'
  | 'partial'
  | 'ready'
  | 'review'
  | 'released'
  | 'closed'
  | 'declined'
  | 'cancelled';
export type Offer = {
  id: string;
  agent: string;
  carrier: string;
  service: string;
  total: number;
  transit: number | null;
  departure: string | null;
  arrival: string | null;
  freeDays: number | null;
  validity: string | null;
  complete: boolean;
  route: string;
  charges: { label: string; amount: number | null }[];
  onTime: number;
  completed: number;
  audited: number;
  discrepancies: number;
};
export type Quote = {
  id: string;
  /** O hoje da demonstração em que a cotação foi montada (`AAAA-MM-DD`). */
  today: string;
  reference: string;
  supplier: string;
  po: string;
  product: string;
  origin: string;
  destination: string;
  modal: string;
  equipment: string;
  incoterm: string;
  readyDate: string;
  needDate: string;
  stage: Stage;
  offers: Offer[];
  sentAt: string | null;
  scheduledFor?: string | null;
  responseBy: string | null;
  agentCount: number;
  targetAgents: string[];
  selected: string | null;
  weight: string;
  manualDraft?: import('../../../cotacao/nova-cotacao/components/manual-form').ManualFormDraft;
  volume: string;
  pickup: string;
  followup: boolean;
  reason: string;
  events: string[];
};
export const labels: Record<Stage, string> = {
  draft: 'Solicitação em preparo',
  scheduled: 'Envio programado',
  'needs-info': 'Faltam informações',
  waiting: 'Aguardando agentes',
  partial: 'Respostas parciais',
  ready: 'Pronta para escolher',
  review: 'Escolha em análise',
  released: 'Escolha liberada',
  closed: 'Cotação fechada',
  declined: 'Cotação recusada',
  cancelled: 'Cotação cancelada',
};
const baseOffers: Offer[] = [
  {
    id: 'alpha',
    agent: 'Alpha Cargo',
    carrier: 'Maersk',
    service: 'Oferta AL-2140',
    total: 22840,
    transit: 29,
    departure: '2026-09-21',
    arrival: '2026-10-20',
    freeDays: 7,
    validity: '2026-09-16',
    complete: true,
    route: 'Direta',
    charges: [
      { label: 'Frete internacional', amount: 19200 },
      { label: 'Taxas de origem', amount: 1840 },
      { label: 'Taxas de destino', amount: 1800 },
    ],
    onTime: 8,
    completed: 10,
    audited: 8,
    discrepancies: 1,
  },
  {
    id: 'beta',
    agent: 'Beta Logistics',
    carrier: 'Hapag-Lloyd',
    service: 'Oferta BT-3802',
    total: 23400,
    transit: 25,
    departure: '2026-09-21',
    arrival: '2026-10-16',
    freeDays: 14,
    validity: '2026-09-17',
    complete: true,
    route: 'Direta',
    charges: [
      { label: 'Frete internacional', amount: 19600 },
      { label: 'Taxas de origem', amount: 2000 },
      { label: 'Taxas de destino', amount: 1800 },
    ],
    onTime: 12,
    completed: 14,
    audited: 12,
    discrepancies: 0,
  },
  {
    id: 'gamma',
    agent: 'Gamma Comex',
    carrier: 'MSC',
    service: 'Oferta GM-1058',
    total: 21980,
    transit: 32,
    departure: '2026-09-22',
    arrival: '2026-10-24',
    freeDays: 10,
    validity: '2026-09-18',
    complete: false,
    route: '1 transbordo',
    charges: [
      { label: 'Frete internacional', amount: 20180 },
      { label: 'Taxas de origem', amount: 1800 },
      { label: 'Taxas de destino', amount: null },
    ],
    onTime: 4,
    completed: 6,
    audited: 5,
    discrepancies: 1,
  },
];
export const scenarios = [
  ['comparar', 'Comparar propostas'],
  ['complementar', 'Completar dados'],
  ['rascunho', 'Solicitação em preparo'],
  ['envio', 'Dados completos · revisar envio'],
  ['programado', 'Envio programado aos agentes'],
  ['aguardando', 'Aguardando agentes'],
  ['parciais', 'Respostas parciais'],
  ['analise', 'Escolha em análise'],
  ['liberada', 'Escolha liberada'],
  ['devolvida', 'Escolha devolvida'],
  ['fechada', 'Cotação fechada'],
  ['vencidas', 'Propostas vencidas'],
  ['sem-dados', 'Informações indisponíveis'],
  ['recusada', 'Cotação recusada'],
  ['cancelada', 'Cotação cancelada'],
] as const;
/** As ofertas-base deslocadas para `today`. */
function offersFor(today: string): Offer[] {
  const move = (d: string | null) => (d ? shiftIso(d, BASE_TODAY, today) : d);
  return structuredClone(baseOffers).map((o) => ({
    ...o,
    departure: move(o.departure),
    arrival: move(o.arrival),
    validity: move(o.validity),
  }));
}

export function createQuote(id: string, today: string = BASE_TODAY): Quote {
  // `d(n)`: n dias a partir do hoje da demonstração; `dm(n)`: o mesmo em "DD/MM".
  const d = (n: number) => addDays(today, n);
  const dm = (n: number) => dayMonth(d(n));
  const q: Quote = {
    id,
    today,
    reference: 'COT-2026-0017',
    supplier: 'Hanwha Industrial',
    po: 'PO-2026-1194',
    product: 'Motores elétricos trifásicos',
    origin: 'Busan, Coreia do Sul',
    destination: 'Santos, Brasil',
    modal: 'Marítimo',
    equipment: '1 × 40’ HC',
    incoterm: 'FOB',
    readyDate: d(5),
    needDate: d(35),
    stage: 'ready',
    offers: offersFor(today),
    sentAt: dm(-2) + ' às 09:20',
    responseBy: dm(1) + ' às 17:00',
    agentCount: 3,
    targetAgents: ['Alpha Cargo', 'Beta Logistics', 'Gamma Comex'],
    selected: null,
    weight: '12400',
    volume: '52',
    pickup: 'Terminal de Busan',
    followup: false,
    reason: '',
    events: [
      dm(0) + ', 09:40 — Propostas liberadas para sua escolha.',
      dm(-1) + ', 16:30 — Última proposta recebida.',
      dm(-2) + ', 09:20 — Solicitação enviada para 3 agentes.',
    ],
  };
  if (id === 'complementar' || id === 'rascunho' || id === 'envio') {
    q.stage = id === 'complementar' ? 'needs-info' : 'draft';
    q.offers = [];
    q.sentAt = null;
    if (id !== 'envio') {
      q.weight = '';
      q.volume = '';
      q.pickup = '';
    }
    q.reference = id === 'complementar' ? 'COT-2026-0013' : 'COT-2026-0020';
    q.events =
      id === 'complementar'
        ? [
            dm(-1) +
              ', 14:10 — Marina, da Freitas, solicitou peso bruto e volume para preparar a cotação.',
          ]
        : [dm(0) + ', 09:00 — Rascunho iniciado por você.'];
  }
  if (id === 'aguardando' || id === 'parciais') {
    q.stage = id === 'aguardando' ? 'waiting' : 'partial';
    q.offers = id === 'parciais' ? [q.offers[0]] : [];
    q.events = [dm(-2) + ', 09:20 — Solicitação enviada para 3 agentes.'];
    q.reference = id === 'aguardando' ? 'COT-2026-0016' : 'COT-2026-0015';
  }
  if (id === 'programado') {
    q.stage = 'scheduled';
    q.offers = [];
    q.sentAt = null;
    q.scheduledFor = defaultSendAt(today);
    q.events = [
      dm(0) +
        ', 10:30 — Envio programado para ' +
        dm(1) +
        ' às 09:00 (simulação).',
    ];
  }
  if (id === 'analise' || id === 'liberada' || id === 'fechada') {
    q.stage =
      id === 'analise' ? 'review' : id === 'liberada' ? 'released' : 'closed';
    q.selected = 'beta';
    q.events.unshift(
      dm(0) + ', 10:10 — Você escolheu a oferta BT-3802, da Beta Logistics.',
    );
    if (id !== 'analise')
      q.events.unshift(dm(0) + ', 10:25 — Freitas liberou a escolha.');
    if (id === 'fechada')
      q.events.unshift(
        dm(0) + ', 10:40 — Contratação confirmada e embarque vinculado.',
      );
  }
  if (id === 'devolvida')
    q.reason =
      'A oferta anterior não contemplava as taxas de destino. Escolha uma condição completa para continuar.';
  if (id === 'vencidas')
    q.offers.forEach((o) => {
      o.validity = d(-1);
    });
  if (id === 'sem-dados') {
    q.supplier = '';
    q.needDate = '';
    q.offers.forEach((o) => {
      o.arrival = null;
      o.departure = null;
      o.freeDays = null;
      o.validity = null;
    });
  }
  if (id === 'recusada' || id === 'cancelada') {
    q.stage = id === 'recusada' ? 'declined' : 'cancelled';
    q.reason =
      id === 'recusada'
        ? 'Condições fora do orçamento.'
        : 'A compra foi adiada pelo fornecedor.';
    q.events.unshift(dm(0) + ', 10:10 — ' + labels[q.stage] + ': ' + q.reason);
  }
  return q;
}
export function validOffer(offer: Offer, today: string = BASE_TODAY) {
  return !!offer.validity && offer.validity >= today;
}
export function recommend(q: Quote): Offer | undefined {
  if (q.stage !== 'ready' || !q.needDate || q.offers.length < 2)
    return undefined;
  return q.offers
    .filter(
      (o) =>
        validOffer(o, q.today) &&
        o.complete &&
        !!o.arrival &&
        o.arrival <= q.needDate,
    )
    .sort((a, b) => a.total - b.total)[0];
}
export function decisionError(q: Quote, offerId: string | null): string | null {
  if (q.stage !== 'ready')
    return 'Esta cotação ainda não está liberada para escolha.';
  const offer = q.offers.find((o) => o.id === offerId);
  if (!offer) return 'Selecione uma proposta para continuar.';
  if (!validOffer(offer, q.today))
    return offer.validity
      ? 'A validade desta oferta terminou. Solicite a revalidação.'
      : 'Confirme a validade com o agente antes de escolher.';
  if (!offer.complete)
    return 'As taxas de destino não foram informadas. Solicite o complemento antes de escolher.';
  return null;
}
export function confirmChoice(q: Quote, offerId: string): Quote {
  const error = decisionError(q, offerId);
  if (error) throw new Error(error);
  const offer = q.offers.find((o) => o.id === offerId)!;
  return {
    ...q,
    stage: 'review',
    selected: offerId,
    reason: '',
    events: [
      'Agora — Você escolheu ' + offer.agent + '. Em análise pela Freitas.',
      ...q.events,
    ],
  };
}
export function validateCargo(weight: string, volume: string): boolean {
  const parse = (n: string) =>
    /^\d+([.,]\d+)?$/.test(n.trim()) && Number(n.replace(',', '.')) > 0;
  return parse(weight) && parse(volume);
}

// Wall-clock time in Sao Paulo, against the quotation's demo clock (`q.today`).
export function scheduleRequest(q: Quote, when: string): Quote {
  if (q.stage !== 'draft' || q.sentAt)
    throw new Error('Somente um rascunho não enviado pode ser programado.');
  if (!q.targetAgents.length)
    throw new Error('Selecione pelo menos um agente.');
  if (!q.manualDraft && !validateCargo(q.weight, q.volume))
    throw new Error('Complete peso e volume antes de programar.');
  const parsed = new Date(when + ':00Z');
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(when) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 16) !== when ||
    when <= q.today + 'T10:30'
  )
    throw new Error(
      'Escolha uma data e horário após ' +
        fullDay(q.today) +
        ' às 10:30, no horário de Brasília.',
    );
  return {
    ...q,
    stage: 'scheduled',
    scheduledFor: when,
    sentAt: null,
    events: [
      'Agora — Envio programado para ' +
        when.replace('T', ' às ') +
        ' (simulação).',
      ...q.events,
    ],
  };
}
export const money = (n: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(n);
export const shortDate = (date: string | null) =>
  date
    ? new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        timeZone: 'UTC',
      })
        .format(new Date(date + 'T12:00:00Z'))
        .replace('.', '')
    : 'Não informada';
export const dayDelta = (a: string, b: string) =>
  Math.round(
    (Date.parse(a + 'T12:00:00Z') - Date.parse(b + 'T12:00:00Z')) / 86400000,
  );

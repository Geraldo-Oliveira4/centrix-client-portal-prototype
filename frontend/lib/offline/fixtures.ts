// Dados de exemplo do protótipo, num lugar só.
//
// Duas pontas consomem este arquivo:
//   - `scripts/preview-shipments-api.mjs` (a API de fixtures da revisão visual
//     de Meus Embarques) usa `buildPreviewData` — mesmos 15 cenários de antes,
//     agora importados daqui em vez de declarados lá;
//   - o MODO OFFLINE (`lib/offline/offline-backend.ts`) usa `buildOfflineFixtures`,
//     que parte dos mesmos 15 e acrescenta o que o resto do portal precisa para
//     não ficar vazio (cotações no Funil, agentes, exportadores, layout da Home).
//
// TUDO FICTÍCIO. O repositório é público: nada de nome de cliente, agente,
// armador, exportador, endereço, nº de PO ou de cotação reais. Os agentes vêm de
// `_shared/demo/quotation-demo-proposals.ts` (Alpha Cargo, Gamma Logistics,
// Delta Freight), que já é a fonte deles na Cotação V2.
//
// DATAS RELATIVAS: todo builder recebe `today` (`AAAA-MM-DD`, ver
// `lib/demo-clock.ts`) e escreve as datas como deslocamento a partir dele.
//
// PURO e sem o alias `@/`: roda sob `node --test` e é importado por um script
// `.mjs` no Node, que só resolve caminho relativo com extensão.

import type {
  PortalAgentsResponse,
  PortalPreferences,
} from '../../types/portal-agent.ts';
import type { PortalHomeLayout } from '../../types/portal-home-layout.ts';
import type {
  PortalClient,
  PortalProposal,
  PortalQuotation,
} from '../../types/portal.ts';
import type { PortalShipmentDetail } from '../../types/portal-shipment.ts';
import type { Exporter } from '../../types/exporter.ts';
import { demoProposalsFor } from '../../app/portal/_shared/demo/quotation-demo-proposals.ts';
import { addDays } from '../demo-clock.ts';

// ---------------------------------------------------------------------------
// Os 15 cenários de embarque da prévia visual (antes em preview-shipments-api.mjs)
// [mercadoria, origem, destino, estado, ETA em dias a partir de hoje, desvio do
//  ETA em dias, urgente, milestone]
// ---------------------------------------------------------------------------

type Scenario = [
  string,
  string,
  string,
  string,
  number | null,
  number,
  boolean,
  string?,
];

export const PREVIEW_SCENARIOS: Scenario[] = [
  [
    'Componentes eletrônicos',
    'Shanghai, China',
    'Santos',
    'analise_booking',
    6,
    4,
    true,
  ],
  [
    'Peças para linha de produção',
    'Hamburgo, Alemanha',
    'Santos',
    'booking_divergente',
    9,
    5,
    true,
  ],
  [
    'Tecidos de algodão',
    'Ningbo, China',
    'Itajaí',
    'solicitado',
    null,
    0,
    false,
  ],
  [
    'Resinas industriais',
    'Busan, Coreia do Sul',
    'Santos',
    'coletado',
    2,
    3,
    false,
  ],
  [
    'Equipamentos de laboratório',
    'Frankfurt, Alemanha',
    'Guarulhos',
    'coletado',
    1,
    0,
    true,
  ],
  [
    'Ferramentas de precisão',
    'Gênova, Itália',
    'Itajaí',
    'coletado',
    5,
    0,
    false,
  ],
  ['Bombas hidráulicas', 'Shanghai, China', 'Santos', 'coletado', 18, 0, false],
  [
    'Embalagens industriais',
    'Qingdao, China',
    'Paranaguá',
    'coletado',
    null,
    0,
    false,
  ],
  [
    'Acessórios metálicos',
    'Ningbo, China',
    'Santos',
    'embarcado',
    -2,
    0,
    false,
    'AVAILABLE',
  ],
  [
    'Sensores e controladores',
    'Hamburgo, Alemanha',
    'Santos',
    'embarcado',
    -4,
    2,
    false,
    'DISCHARGE',
  ],
  [
    'Motores elétricos',
    'Busan, Coreia do Sul',
    'Itajaí',
    'embarcado',
    -6,
    0,
    false,
    'AVAILABLE',
  ],
  [
    'Conexões de aço',
    'Gênova, Itália',
    'Santos',
    'embarcado',
    -7,
    0,
    false,
    'AVAILABLE',
  ],
  [
    'Filmes plásticos',
    'Shanghai, China',
    'Paranaguá',
    'embarcado',
    -8,
    0,
    false,
    'AVAILABLE',
  ],
  [
    'Material de manutenção',
    'Qingdao, China',
    'Santos',
    'embarcado',
    -10,
    0,
    false,
    'AVAILABLE',
  ],
  [
    'Válvulas industriais',
    'Hamburgo, Alemanha',
    'Itajaí',
    'embarcado',
    -12,
    0,
    false,
    'AVAILABLE',
  ],
];

/**
 * Exatamente o que `preview-shipments-api.mjs` servia: 15 cotações FECHADA e os
 * 15 embarques que elas provisionaram. Mudar este builder muda a prévia visual.
 */
export function buildPreviewData(today: string) {
  const date = (offset: number) => addDays(today, offset);
  const quotations = PREVIEW_SCENARIOS.map((s, i) => ({
    id: 'quote-' + (i + 1),
    reference: 'COT-2026-' + String(i + 1).padStart(4, '0'),
    state: 'FECHADA',
    service_type: 'IMPORTACAO',
    modal: i === 4 ? 'AEREO' : 'MARITIMO',
    tipo_embarque: 'FCL',
    tipo_cotacao: 'SPOT',
    data_cotacao: date(-20),
    origin: s[1],
    porto_embarque: s[1].split(',')[0],
    porto_destino: [s[2]],
    aeroporto_destino: i === 4 ? [s[2]] : null,
    product: s[0],
    client_reference: 'PO-' + (4582 + i),
    created_at: date(-20) + 'T12:00:00Z',
    updated_at: date(-1) + 'T12:00:00Z',
    incoterm: 'FOB',
    proposals: [] as PortalProposal[],
    equipments: [],
    volumes: [],
    proposals_count: 0,
    best_proposal: null as PortalProposal | null,
    closed_at: date(-19) + 'T12:00:00Z',
  }));
  const items = PREVIEW_SCENARIOS.map((s, i) => ({
    id: 'preview-' + (i + 1),
    referencia: 'EMB-2026-' + String(i + 1).padStart(4, '0'),
    client_reference: quotations[i].client_reference,
    estado: s[3],
    incoterm: 'FOB',
    modal: quotations[i].modal,
    tipo_embarque: 'FCL',
    tipo_despacho: 'DIRETO',
    carga_urgente: s[6],
    agente_nome: 'Agente Demo',
    quotation_id: quotations[i].id,
    created_at: date(-20) + 'T12:00:00Z',
    updated_at: date(-1) + 'T12:00:00Z',
    tracking: {
      first_eta: s[4] === null ? null : date(s[4] - s[5]),
      current_eta: s[4] === null ? null : date(s[4]),
      eta_is_actual: !!s[7],
      data_status: s[4] === null ? null : 'COMPLETE',
      last_milestone: s[7] ?? null,
      last_milestone_at: s[7] ? date(s[4] as number) + 'T12:00:00Z' : null,
      is_mock: true,
    },
    agente: { id: 'agent-demo', nome: 'Agente Demo' },
    containers: [],
    observacao: null,
  }));
  return { quotations, items };
}

// ---------------------------------------------------------------------------
// Modo offline: o portal inteiro, sem backend
// ---------------------------------------------------------------------------

export const OFFLINE_CLIENT: PortalClient = {
  id: 'offline-demo-client',
  name: 'Cliente Demo',
  email: 'demo@cliente.local',
};

/** Prefixo dos ids de proposta do modo offline. Não é `demo-proposal:` de propósito: */
/** aquelas a tela recusa aprovar; estas passam pelo fluxo normal, que é simulado. */
export const OFFLINE_PROPOSAL_PREFIX = 'offline-proposal:';

/** Todo campo de `PortalQuotation` em branco; cada cotação preenche o seu. */
function blankQuotation(): Omit<
  PortalQuotation,
  'id' | 'reference' | 'state' | 'created_at'
> {
  return {
    exporter_name: null,
    service_type: 'IMPORTACAO',
    modal: 'MARITIMO',
    tipo_embarque: 'FCL',
    tipo_cotacao: 'REAL',
    data_cotacao: null,
    origin: null,
    porto_embarque: null,
    porto_destino: null,
    aeroporto_embarque: null,
    aeroporto_destino: null,
    incoterm: 'FOB',
    product: null,
    desired_deadline: null,
    data_limite_necessidade: null,
    data_prontidao: null,
    declared_value: null,
    declared_value_currency: null,
    stackability: null,
    carga_tombavel: null,
    insurance_required: null,
    destination_yard: null,
    endereco_entrega_final: null,
    observations: null,
    carga_perigosa: null,
    un_number: null,
    imo_class: null,
    temperatura_min: null,
    temperatura_max: null,
    client_reference: null,
    urgency: 'NORMAL',
    decline_reason: null,
    decline_note: null,
    winning_agent_id: null,
    quoted_value_usd: null,
    pais_procedencia: null,
    peso_taxado: null,
    updated_at: null,
    closed_at: null,
    declined_at: null,
    created_by_me: true,
    created_via_portal: true,
    proposals_count: 0,
    proposals: [],
    equipments: [],
    volumes: [],
  };
}

/** Propostas de exemplo de uma cotação: as COM PREÇO do conjunto da Cotação V2. */
export function offlineProposalsFor(
  quotationId: string,
  today: string,
): PortalProposal[] {
  const nowMs = new Date(today + 'T12:00:00Z').getTime();
  return demoProposalsFor(quotationId, nowMs)
    .filter((p) => p.total_brl > 0)
    .map(({ is_demo: _demo, ...p }) => ({
      ...p,
      id: p.id.replace('demo-proposal:', OFFLINE_PROPOSAL_PREFIX),
      received_at: addDays(today, -2) + 'T12:00:00Z',
    }));
}

/** A proposta vencedora de uma cotação FECHADA de exemplo, com valor variando por índice. */
function winningProposal(
  quotationId: string,
  index: number,
  today: string,
): PortalProposal {
  const [base] = offlineProposalsFor(quotationId, today);
  const totalBrl = 5800 + ((index * 370) % 2400);
  return {
    ...base,
    total_brl: totalBrl,
    total_value: Math.round(totalBrl / 5.5),
    freight_value: Math.round(totalBrl / 5.5),
    is_winner: true,
    validity: null,
    received_at: addDays(today, -21) + 'T12:00:00Z',
  };
}

interface ActiveQuotationSpec {
  ref: number;
  state: PortalQuotation['state'];
  product: string;
  origin: string;
  destination: string;
  createdDaysAgo: number;
  withProposals?: boolean;
  missingData?: boolean;
  declineReason?: string;
}

// Cinco cotações a mais, para o Funil ter as três colunas e o Histórico ter uma
// reprovada. Referências seguem a numeração da prévia (0001..0015 são as FECHADA).
const ACTIVE_QUOTATIONS: ActiveQuotationSpec[] = [
  {
    ref: 16,
    state: 'ENVIADA_CLIENTE',
    product: 'Rolamentos industriais',
    origin: 'Shanghai, China',
    destination: 'Santos',
    createdDaysAgo: 6,
    withProposals: true,
  },
  {
    ref: 17,
    state: 'ENVIADA_CLIENTE',
    product: 'Peças de reposição',
    origin: 'Hamburgo, Alemanha',
    destination: 'Itajaí',
    createdDaysAgo: 4,
    withProposals: true,
  },
  {
    ref: 18,
    state: 'COTANDO',
    product: 'Tintas industriais',
    origin: 'Busan, Coreia do Sul',
    destination: 'Santos',
    createdDaysAgo: 2,
  },
  {
    ref: 19,
    state: 'AGUARDANDO_DADOS',
    product: 'Componentes plásticos',
    origin: 'Ningbo, China',
    destination: 'Paranaguá',
    createdDaysAgo: 1,
    missingData: true,
  },
  {
    ref: 20,
    state: 'DECLINADA',
    product: 'Luminárias',
    origin: 'Gênova, Itália',
    destination: 'Santos',
    createdDaysAgo: 30,
    withProposals: true,
    declineReason: 'PRECO',
  },
];

export interface OfflineFixtures {
  today: string;
  client: PortalClient;
  quotations: PortalQuotation[];
  shipments: PortalShipmentDetail[];
  agents: PortalAgentsResponse;
  preferences: PortalPreferences;
  exporters: Exporter[];
  homeLayout: PortalHomeLayout | null;
}

export function buildOfflineFixtures(today: string): OfflineFixtures {
  const date = (offset: number) => addDays(today, offset);
  const preview = buildPreviewData(today);

  const closed: PortalQuotation[] = preview.quotations.map((q, i) => {
    const winner = winningProposal(q.id, i, today);
    return {
      ...blankQuotation(),
      ...q,
      state: 'FECHADA',
      modal: q.modal as PortalQuotation['modal'],
      created_via_portal: false,
      proposals: [winner],
      proposals_count: 1,
      best_proposal: winner,
      winning_agent_id: winner.agent_id,
    } as PortalQuotation;
  });

  const active: PortalQuotation[] = ACTIVE_QUOTATIONS.map((spec) => {
    const id = 'offline-quote-' + spec.ref;
    const proposals = spec.withProposals ? offlineProposalsFor(id, today) : [];
    const cheapest = proposals.reduce<PortalProposal | undefined>(
      (best, p) => (!best || p.total_brl < best.total_brl ? p : best),
      undefined,
    );
    const declined = spec.state === 'DECLINADA';
    return {
      ...blankQuotation(),
      id,
      reference: 'COT-2026-' + String(spec.ref).padStart(4, '0'),
      state: spec.state,
      data_cotacao: date(-spec.createdDaysAgo),
      origin: spec.missingData ? null : spec.origin,
      porto_embarque: spec.origin.split(',')[0],
      porto_destino: [spec.destination],
      product: spec.product,
      client_reference: 'PO-' + (4580 + spec.ref),
      data_prontidao: spec.missingData ? null : date(12),
      desired_deadline: date(45),
      created_at: date(-spec.createdDaysAgo) + 'T12:00:00Z',
      updated_at: date(declined ? -25 : -1) + 'T12:00:00Z',
      declined_at: declined ? date(-25) + 'T12:00:00Z' : null,
      decline_reason: spec.declineReason ?? null,
      proposals,
      proposals_count: proposals.length,
      best_proposal: cheapest,
    };
  });

  const shipments = preview.items as unknown as PortalShipmentDetail[];

  const agentNames = offlineProposalsFor('agents', today).map((p) => p.agent!);
  const agents: PortalAgentsResponse = {
    items: [
      ...agentNames,
      { id: 'demo-agent-delta', name: 'Delta Freight' },
    ].map((a) => ({
      id: a.id,
      name: a.name,
      modal_regions: null,
      certificacao_oea: null,
      carga_imo: null,
      active: true,
    })),
    total_count: 3,
    active_count: 3,
    plan_limit: null,
    plan_name: null,
  };

  return {
    today,
    client: OFFLINE_CLIENT,
    quotations: [...closed, ...active],
    shipments,
    agents,
    preferences: {
      paused_agent_ids: [],
      preferred_port: null,
      default_incoterm: null,
      uses_insurance: null,
      cargo_particularities: null,
      updated_at: null,
    },
    exporters: [
      {
        id: 'offline-exporter-1',
        name: 'Fornecedor Exemplo Ásia',
        endereco: null,
        particularidades: null,
        cargo_profile: 'GERAL',
        contact_email: null,
        created_at: date(-90) + 'T12:00:00Z',
        updated_at: null,
      },
      {
        id: 'offline-exporter-2',
        name: 'Fornecedor Exemplo Europa',
        endereco: null,
        particularidades: null,
        cargo_profile: 'GERAL',
        contact_email: null,
        created_at: date(-60) + 'T12:00:00Z',
        updated_at: null,
      },
    ],
    // A demonstração abre na Home montada, não no onboarding: quem apresenta
    // pode refazer a personalização, e o onboarding abre como sempre.
    homeLayout: {
      themes: ['acao', 'mapa', 'custos'],
      enabled_cards: [
        'acao_urgente',
        'mapa_embarques',
        'economia',
        'tendencia_preco',
      ],
      updated_at: date(-7) + 'T12:00:00Z',
    },
  };
}

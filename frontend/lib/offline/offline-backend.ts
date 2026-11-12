// O "backend" do modo offline: responde às rotas `/portal/*` que o portal chama,
// a partir das fixtures de `fixtures.ts`.
//
// CONTRATO: mesmas rotas e mesmos formatos de resposta da API real
// (`backend/app/routers/portal.py`). Nenhuma tela sabe que está offline — quem
// troca a fonte é o adapter do axios (`offline-adapter.ts`), num ponto só.
//
// ESCRITA É SIMULADA, NUNCA FINGIDA. Toda rota que gravaria algo devolve um
// resultado com `simulated` preenchido: o adapter usa isso para avisar "Prévia:
// nada foi enviado". O efeito fica numa cópia em memória desta aba (o card anda,
// a preferência muda na tela) e some ao recarregar — o mesmo contrato do
// "Aprovar booking" do detalhe do embarque. Envio de arquivo não tem como ser
// simulado (o upload vai direto para uma URL assinada), então ele RECUSA.
//
// PURO e sem o alias `@/`: roda sob `node --test`.

import type { PortalProposal, PortalQuotation } from '../../types/portal.ts';
import type { PortalPreferences } from '../../types/portal-agent.ts';
import { buildOfflineFixtures, type OfflineFixtures } from './fixtures.ts';

export interface OfflineResponse {
  status: number;
  data: unknown;
  /** Preenchido em toda escrita: o que a ação TERIA feito, para o aviso de prévia. */
  simulated?: string;
}

const BUCKET_OF: Record<PortalQuotation['state'], string> = {
  TRIAGEM_IA: 'buscando_propostas',
  COTANDO: 'buscando_propostas',
  PARA_ANALISE: 'buscando_propostas',
  REVISAO_AGENTE: 'buscando_propostas',
  AGUARDANDO_DADOS: 'aguardando_dados',
  ENVIADA_CLIENTE: 'aguardando_aprovacao',
  APROVADA_PELO_CLIENTE: 'aguardando_aprovacao',
  FECHADA: 'finalizadas',
  DECLINADA: 'finalizadas',
  CANCELADO: 'cancelada',
};

const BUCKET_ORDER = [
  'aguardando_dados',
  'buscando_propostas',
  'aguardando_aprovacao',
];
const ALL_BUCKETS = [...BUCKET_ORDER, 'finalizadas', 'cancelada'];

/** Texto do aviso quando o servidor recusaria a escrita por não existir aqui. */
export const OFFLINE_UPLOAD_REFUSAL =
  'Prévia: nada foi enviado. Envio de arquivo não funciona no modo demonstração.';

/** Variação determinística de -3% a +8% pela referência, como `app/audit_preview.py`. */
function auditVariationPct(reference: string): number {
  let hash = 0;
  for (const ch of reference) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return Math.round((-3 + (hash % 1101) / 100) * 100) / 100;
}

function parseBody(body: unknown): Record<string, unknown> {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return (body as Record<string, unknown>) ?? {};
}

export function createOfflineBackend(
  fixtures: OfflineFixtures = buildOfflineFixtures(
    new Date().toISOString().slice(0, 10),
  ),
) {
  // Cópia em memória: as escritas simuladas mexem aqui, nunca na fixture.
  const state = structuredClone(fixtures);
  let created = 0;

  const findQuotation = (id: string) =>
    state.quotations.find((q) => q.id === id);

  const listQuotations = () => {
    const buckets = Object.fromEntries(
      ALL_BUCKETS.map((b) => [b, [] as PortalQuotation[]]),
    );
    for (const q of state.quotations)
      buckets[BUCKET_OF[q.state] ?? 'buscando_propostas'].push(q);
    return {
      buckets,
      bucket_order: BUCKET_ORDER,
      total: state.quotations.length,
      summary: {
        aprovar_propostas: buckets.aguardando_aprovacao.length,
        aguardando_propostas: buckets.buscando_propostas.length,
      },
    };
  };

  const recommendation = (q: PortalQuotation) => {
    const priced = (q.proposals ?? []).filter((p) => p.total_brl > 0);
    const sorted = [...priced].sort((a, b) => a.total_brl - b.total_brl);
    const fastest = [...priced].sort(
      (a, b) => a.transit_time - b.transit_time,
    )[0];
    const recommended = sorted[0] ?? null;
    return {
      recommended_proposal_id: recommended?.id ?? null,
      recommendation_text: null,
      is_overridden: false,
      override: null,
      scores: sorted.map((p, i) => ({
        proposal_id: p.id,
        agent_name: p.agent?.name ?? '',
        is_eligible: true,
        ineligibility_reason: null,
        cost_score: null,
        transit_score: null,
        frequency_score: null,
        route_score: null,
        free_time_score: null,
        validity_score: null,
        total_score: null,
        validade_status: 'VALIDA',
        posicao_ranking: i + 1,
        motivo: null,
        is_recommended: p.id === recommended?.id,
        is_lowest_cost: i === 0,
        is_lowest_transit: p.id === fastest?.id,
      })),
    };
  };

  const quotationAgents = (q: PortalQuotation) => ({
    agents: state.agents.items
      .filter((a) => !state.preferences.paused_agent_ids.includes(a.id))
      .map((a) => ({
        id: a.id,
        name: a.name,
        email: '',
        preferred_channel: null,
        reliability_score: null,
        total_quotations: 0,
        error_count: 0,
        modal_regions: null,
        certificacao_oea: null,
        data_validade_oea: null,
        carga_imo: null,
        contacts: [],
        created_at: q.created_at,
        updated_at: null,
      })),
    rfq_dispatched: q.state !== 'AGUARDANDO_DADOS' && q.state !== 'TRIAGEM_IA',
    selected_agent_ids: [],
  });

  function get(path: string): OfflineResponse {
    if (path === '/portal/clients/me')
      return { status: 200, data: { client: state.client } };
    if (path === '/portal/quotations')
      return { status: 200, data: listQuotations() };
    if (path === '/portal/shipments') {
      const items = state.shipments.map(
        ({ agente: _a, containers: _c, observacao: _o, ...s }) => s,
      );
      const by_estado: Record<string, number> = {};
      for (const s of items)
        by_estado[s.estado] = (by_estado[s.estado] ?? 0) + 1;
      return { status: 200, data: { items, total: items.length, by_estado } };
    }
    if (path === '/portal/agents') {
      const items = state.agents.items.map((a) => ({
        ...a,
        active: !state.preferences.paused_agent_ids.includes(a.id),
      }));
      return {
        status: 200,
        data: {
          ...state.agents,
          items,
          active_count: items.filter((a) => a.active).length,
        },
      };
    }
    if (path === '/portal/preferences')
      return { status: 200, data: { preferences: state.preferences } };
    if (path === '/portal/exporters') {
      return {
        status: 200,
        data: { items: state.exporters, total: state.exporters.length },
      };
    }
    if (path === '/portal/home-layout-experiment')
      return { status: 200, data: { layout: state.homeLayout } };

    const shipment = path.match(/^\/portal\/shipments\/([^/]+)$/);
    if (shipment) {
      const found = state.shipments.find((s) => s.id === shipment[1]);
      return found
        ? { status: 200, data: { shipment: found } }
        : { status: 404, data: { message: 'Embarque não encontrado.' } };
    }

    const sub = path.match(/^\/portal\/quotations\/([^/]+)(?:\/(.+))?$/);
    if (sub) {
      const q = findQuotation(sub[1]);
      if (!q)
        return { status: 404, data: { message: 'Cotação não encontrada.' } };
      switch (sub[2]) {
        case undefined:
          return { status: 200, data: { quotation: q } };
        case 'recommendation':
          return { status: 200, data: recommendation(q) };
        case 'history':
          return {
            status: 200,
            data: {
              items: [
                {
                  id: q.id + ':created',
                  quotation_id: q.id,
                  action: 'quotation_created_by_portal',
                  previous_state: null,
                  new_state: q.state,
                  user_id: 'offline-demo',
                  details: {},
                  created_at: q.created_at,
                },
              ],
            },
          };
        case 'attachments':
          return { status: 200, data: { items: [] } };
        case 'agents':
          return { status: 200, data: quotationAgents(q) };
        case 'audit-preview': {
          const winner = q.best_proposal;
          if (q.state !== 'FECHADA' || !winner) {
            return {
              status: 409,
              data: { message: 'Conferência indisponível.' },
            };
          }
          const pct = auditVariationPct(q.reference);
          const realized =
            Math.round(winner.total_brl * (1 + pct / 100) * 100) / 100;
          return {
            status: 200,
            data: {
              audit_preview: {
                is_mock: true,
                disclaimer:
                  'Valor de fechamento ilustrativo: não existe fatura neste protótipo.',
                quoted_value_brl: winner.total_brl,
                quoted_value_source: 'winning_proposal',
                mock_realized_value_brl: realized,
                mock_variation_pct: pct,
                mock_difference_brl:
                  Math.round((realized - winner.total_brl) * 100) / 100,
                mock_divergence_detected: Math.abs(pct) > 5,
                divergence_threshold_pct: 5,
              },
            },
          };
        }
        case 'si':
          return {
            status: 404,
            data: { message: 'Instrução de embarque não cadastrada.' },
          };
        default:
          return {
            status: 404,
            data: { message: 'Rota fora do modo demonstração.' },
          };
      }
    }
    return {
      status: 404,
      data: { message: 'Rota fora do modo demonstração.' },
    };
  }

  function write(
    method: string,
    path: string,
    rawBody: unknown,
  ): OfflineResponse {
    const body = parseBody(rawBody);
    const now = state.today + 'T12:00:00Z';

    if (method === 'POST' && path === '/portal/quotations') {
      created += 1;
      const id = 'offline-new-' + created;
      const reference = 'COT-2026-' + String(100 + created).padStart(4, '0');
      const base = state.quotations.find(
        (q) => q.state === 'AGUARDANDO_DADOS',
      )!;
      const quotation: PortalQuotation = {
        ...base,
        ...(body as Partial<PortalQuotation>),
        id,
        reference,
        state: 'TRIAGEM_IA',
        created_at: now,
        updated_at: now,
        proposals: [],
        proposals_count: 0,
        best_proposal: undefined,
      };
      state.quotations.push(quotation);
      return {
        status: 201,
        data: { quotation },
        simulated: `A cotação ${reference} não foi enviada à Freitas`,
      };
    }

    if (method === 'PUT' && path === '/portal/preferences') {
      state.preferences = {
        ...state.preferences,
        ...(body as Partial<PortalPreferences>),
        updated_at: now,
      };
      return {
        status: 200,
        data: { preferences: state.preferences },
        simulated: 'Suas preferências não foram salvas no servidor',
      };
    }
    if (method === 'PATCH' && path === '/portal/preferences') {
      state.preferences = {
        ...state.preferences,
        ...(body as Partial<PortalPreferences>),
        updated_at: now,
      };
      return {
        status: 200,
        data: { preferences: state.preferences },
        simulated: 'Suas preferências não foram salvas no servidor',
      };
    }
    if (method === 'POST' && path === '/portal/exporters') {
      const exporter = {
        id: 'offline-exporter-new-' + (state.exporters.length + 1),
        name: String(body.name ?? 'Exportador'),
        endereco: (body.endereco as string) ?? null,
        particularidades: (body.particularidades as string) ?? null,
        cargo_profile: (body.cargo_profile as 'GERAL') ?? 'GERAL',
        contact_email: (body.contact_email as string) ?? null,
        created_at: now,
        updated_at: null,
      };
      state.exporters.push(exporter);
      return {
        status: 201,
        data: { exporter },
        simulated: 'O exportador não foi cadastrado no servidor',
      };
    }
    if (path === '/portal/home-layout-experiment') {
      if (method === 'DELETE') {
        state.homeLayout = null;
        return {
          status: 204,
          data: null,
          simulated: 'A personalização da Home vale só nesta aba',
        };
      }
      if (method === 'PUT') {
        state.homeLayout = {
          themes: (body.themes as never) ?? [],
          enabled_cards: (body.enabled_cards as never) ?? [],
          updated_at: now,
        };
        return {
          status: 200,
          data: { layout: state.homeLayout },
          simulated: 'A personalização da Home vale só nesta aba',
        };
      }
    }

    const sub = path.match(/^\/portal\/quotations\/([^/]+)\/(.+)$/);
    if (sub) {
      const q = findQuotation(sub[1]);
      if (!q)
        return { status: 404, data: { message: 'Cotação não encontrada.' } };
      const action = sub[2];
      const approve = action.match(/^proposals\/([^/]+)\/approve$/);
      if (approve && method === 'POST') {
        const winner = (q.proposals ?? []).find((p) => p.id === approve[1]);
        if (!winner)
          return { status: 404, data: { message: 'Proposta não encontrada.' } };
        q.state = 'FECHADA';
        q.closed_at = now;
        q.updated_at = now;
        q.winning_agent_id = winner.agent_id;
        q.proposals = (q.proposals ?? []).map((p: PortalProposal) => ({
          ...p,
          is_winner: p.id === winner.id,
        }));
        q.best_proposal = { ...winner, is_winner: true };
        return {
          status: 200,
          data: { quotation: q },
          simulated: `A aprovação da ${q.reference} não chegou à Freitas`,
        };
      }
      if (action === 'decline' && method === 'POST') {
        q.state = 'DECLINADA';
        q.declined_at = now;
        q.updated_at = now;
        q.decline_reason =
          (body.reason as string) ?? (body.decline_reason as string) ?? null;
        return {
          status: 200,
          data: { quotation: q },
          simulated: `A reprovação da ${q.reference} não chegou à Freitas`,
        };
      }
      if (action === 'cancel' && method === 'POST') {
        q.state = 'CANCELADO';
        q.updated_at = now;
        return {
          status: 200,
          data: { quotation: q, notifications: [] },
          simulated: `O cancelamento da ${q.reference} não foi comunicado`,
        };
      }
      if (action === 'rfq' && method === 'PUT') {
        return {
          status: 200,
          data: { soft_warnings: [] },
          simulated: 'A solicitação aos agentes não foi salva no servidor',
        };
      }
      if (action === 'rfq/dispatch' && method === 'POST') {
        q.state = 'COTANDO';
        q.updated_at = now;
        const targeted = state.agents.items.filter(
          (a) => !state.preferences.paused_agent_ids.includes(a.id),
        );
        return {
          status: 200,
          data: {
            agents: targeted.map((a) => ({ agent_id: a.id, status: 'sent' })),
          },
          simulated: 'Nenhum agente recebeu a solicitação',
        };
      }
      if (action === 'trigger-extraction' && method === 'POST') {
        return {
          status: 200,
          data: {},
          simulated: 'A leitura dos documentos não foi iniciada',
        };
      }
      if (action === 'documents/upload-url' && method === 'POST') {
        return {
          status: 503,
          data: {
            message: OFFLINE_UPLOAD_REFUSAL,
            error: OFFLINE_UPLOAD_REFUSAL,
          },
          simulated: 'O arquivo não foi enviado',
        };
      }
    }

    // Qualquer outra escrita: não finge sucesso, mas também não derruba a tela.
    return {
      status: 503,
      data: {
        message:
          'Prévia: nada foi enviado. Ação indisponível no modo demonstração.',
      },
      simulated: 'Ação indisponível no modo demonstração',
    };
  }

  return {
    get today() {
      return state.today;
    },
    /** `path` sem query string, relativo à base da API (`/portal/...`). */
    handle(method: string, path: string, body?: unknown): OfflineResponse {
      const clean = path.split('?')[0].replace(/\/+$/, '') || '/';
      const verb = method.toUpperCase();
      return verb === 'GET' || verb === 'HEAD'
        ? get(clean)
        : write(verb, clean, body);
    },
  };
}

export type OfflineBackend = ReturnType<typeof createOfflineBackend>;

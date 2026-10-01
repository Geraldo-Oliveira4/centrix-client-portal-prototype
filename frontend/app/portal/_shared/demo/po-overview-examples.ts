// Exemplo da "Visão por PO" com datas RELATIVAS A HOJE (complemento ao Prompt 4).
//
// PURE, sem o alias `@/`: roda sob `npm run test:unit`.
//
// POR QUE EXISTE. Os dados de demonstração do banco têm datas ABSOLUTAS, gravadas
// no dia em que o top-up rodou; semanas depois, o "em trânsito" já devia ter
// chegado e a linha do tempo vira um ponto vencido e três "sem previsão". Este
// exemplo é calculado a partir de `now` a cada abertura da tela, então nunca
// envelhece, e não toca em dado nenhum: vive só no navegador.
//
// O QUE ELE É: dado FICTÍCIO, e a tela diz isso (faixa "Exemplo" e PO com o
// prefixo `PO-EXEMPLO-`). Todo rastreamento leva `is_mock: true`. Nunca é
// misturado aos pedidos do cliente: ou a tela mostra os pedidos dele, ou mostra
// o exemplo.
//
// O QUE ELE MOSTRA, de propósito, um de cada:
//   - chegadas daqui a 3, 12 e 40 dias (as três faixas: semana, mês, depois);
//   - um PO dividido em 2 embarques;
//   - um PO em risco (a companhia empurrou a chegada em 7 dias, > 3 = atraso);
//   - um PO sem previsão (vira "Informe a data de prontidão");
//   - um PO que já chegou.

import type {
  EmbarqueEstado,
  PortalShipmentTracking,
} from '../../../../types/portal-shipment.ts';
import type { PoOverviewItem } from './po-overview.ts';
import type { PortalShipmentWithReview } from './shipment-po-merge.ts';

const DAY = 24 * 60 * 60 * 1000;

/** Data pura (AAAA-MM-DD, UTC) a `days` dias de `now`. */
export function dayFrom(now: Date, days: number): string {
  return new Date(now.getTime() + days * DAY).toISOString().slice(0, 10);
}

export const PO_EXAMPLE_PREFIX = 'PO-EXEMPLO-';

export interface PoOverviewExample {
  shipments: PortalShipmentWithReview[];
  /** Prontidão por embarque (no real viria da cotação de origem). */
  readyDates: Record<string, string>;
  /** SKUs por embarque (no real viriam do PO). */
  items: Record<string, PoOverviewItem[]>;
}

function tracking(
  partial: Partial<PortalShipmentTracking>,
): PortalShipmentTracking {
  return {
    first_eta: null,
    current_eta: null,
    eta_is_actual: false,
    data_status: 'COMPLETE',
    last_milestone: null,
    last_milestone_at: null,
    is_mock: true,
    ...partial,
  };
}

function shipment(
  id: string,
  po: string,
  estado: EmbarqueEstado,
  modal: 'MARITIMO' | 'AEREO',
  created: string,
  track: PortalShipmentTracking | null,
): PortalShipmentWithReview {
  return {
    id,
    referencia: `EMB-EXEMPLO-${id.slice(-2)}`,
    client_reference: po,
    estado,
    incoterm: 'FOB',
    modal,
    tipo_embarque: modal === 'MARITIMO' ? 'FCL' : null,
    tipo_despacho: 'DIRETO',
    carga_urgente: false,
    agente_nome: null,
    quotation_id: null,
    created_at: `${created}T12:00:00.000Z`,
    updated_at: null,
    tracking: track,
  };
}

export function buildPoOverviewExample(now: Date): PoOverviewExample {
  const d = (days: number) => dayFrom(now, days);
  const po = (n: number) => `${PO_EXAMPLE_PREFIX}${4100 + n}`;

  const shipments: PortalShipmentWithReview[] = [
    // PO dividido: a primeira parte chega em 3 dias, a segunda em 12.
    shipment(
      'exemplo-a1',
      po(1),
      'embarcado',
      'MARITIMO',
      d(-30),
      tracking({
        first_eta: d(3),
        current_eta: d(3),
        last_milestone: 'OCEAN_TRANSIT',
        last_milestone_at: d(-26),
      }),
    ),
    shipment(
      'exemplo-a2',
      po(1),
      'coletado',
      'MARITIMO',
      d(-18),
      tracking({
        first_eta: d(12),
        current_eta: d(12),
      }),
    ),
    // Chega em 40 dias, ainda em análise de booking, prontidão futura.
    shipment(
      'exemplo-b1',
      po(2),
      'analise_booking',
      'MARITIMO',
      d(-6),
      tracking({
        first_eta: d(40),
        current_eta: d(40),
      }),
    ),
    // Em risco: a companhia empurrou a chegada de 2 para 9 dias (+7).
    shipment(
      'exemplo-c1',
      po(3),
      'embarcado',
      'MARITIMO',
      d(-40),
      tracking({
        first_eta: d(2),
        current_eta: d(9),
        last_milestone: 'OCEAN_TRANSIT',
        last_milestone_at: d(-24),
      }),
    ),
    // Sem previsão: falta a data de prontidão.
    shipment('exemplo-d1', po(4), 'aguardando_prontidao', 'AEREO', d(-3), null),
    // Já chegou e foi liberado.
    shipment(
      'exemplo-e1',
      po(5),
      'embarcado',
      'MARITIMO',
      d(-60),
      tracking({
        first_eta: d(-6),
        current_eta: d(-5),
        eta_is_actual: true,
        last_milestone: 'AVAILABLE',
        last_milestone_at: d(-3),
      }),
    ),
  ];

  return {
    shipments,
    readyDates: {
      'exemplo-a1': d(-28),
      'exemplo-a2': d(-8),
      'exemplo-b1': d(6),
      'exemplo-c1': d(-32),
      'exemplo-e1': d(-50),
    },
    items: {
      'exemplo-a1': [
        {
          partNumber: 'SKU-EX-001',
          description: 'Rolamento de esferas 6205',
          quantity: 1200,
        },
        {
          partNumber: 'SKU-EX-002',
          description: 'Retentor 35x52',
          quantity: 800,
        },
      ],
      'exemplo-a2': [
        {
          partNumber: 'SKU-EX-003',
          description: 'Rolamento cônico 30206',
          quantity: 600,
        },
      ],
      'exemplo-b1': [
        {
          partNumber: 'SKU-EX-010',
          description: 'Painel de controle',
          quantity: 40,
        },
      ],
    },
  };
}

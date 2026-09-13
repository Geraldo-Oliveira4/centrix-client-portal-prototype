import type {
  ManualFormDraft,
  ManualFormValues,
} from '../../../cotacao/nova-cotacao/components/manual-form';
import type { Quote } from '../previa/model';

export type Habit = {
  id: string;
  name: string;
  supplierId: string;
  supplier: string;
  routeId: string;
  draft: ManualFormDraft;
};
export const routes = [
  {
    id: 'busan-santos',
    origin: 'Busan, South Korea (KRPUS)',
    destination: 'Santos, Brazil (BRSSZ)',
    label: 'Busan → Santos',
  },
  {
    id: 'shanghai-santos',
    origin: 'Shanghai, China (CNSHA)',
    destination: 'Santos, Brazil (BRSSZ)',
    label: 'Shanghai → Santos',
  },
];
const stableFields = [
  'tipo_cotacao',
  'service_type',
  'modal',
  'tipo_embarque',
  'origin',
  'porto_embarque',
  'porto_destino',
  'aeroporto_embarque',
  'aeroporto_destino',
  'incluir_entrega_destino_final',
  'endereco_entrega_final',
  'incoterm',
  'product',
  'carga_perigosa',
  'un_number',
  'imo_class',
  'stackability',
  'carga_tombavel',
  'temperatura_min',
  'temperatura_max',
  'insurance_required',
  'destination_yard',
] as const;

// An allow-list keeps transactional information out of every reusable model.
export function reusableDraft(source: ManualFormDraft): ManualFormDraft {
  const values: Partial<ManualFormValues> = {};
  for (const key of stableFields) {
    const value = source.values[key];
    if (value !== undefined)
      Object.assign(values, { [key]: structuredClone(value) });
  }
  return {
    values,
    equipments: [],
    volumes: [],
    flags: structuredClone(source.flags || {}),
  };
}

export const initialHabits: Habit[] = [
  {
    id: 'hanwha-motores',
    name: 'Motores · Busan–Santos',
    supplierId: 'hanwha',
    supplier: 'Hanwha Industrial',
    routeId: 'busan-santos',
    draft: {
      values: {
        tipo_cotacao: 'REAL',
        service_type: 'IMPORTACAO',
        modal: 'MARITIMO',
        tipo_embarque: 'FCL',
        origin: 'Terminal de Busan',
        porto_embarque: routes[0].origin,
        porto_destino: [routes[0].destination],
        incoterm: 'FOB',
        product: 'Motores elétricos trifásicos',
      },
      equipments: [],
      volumes: [],
    },
  },
  {
    id: 'hanwha-pecas',
    name: 'Peças · Shanghai–Santos',
    supplierId: 'hanwha',
    supplier: 'Hanwha Industrial',
    routeId: 'shanghai-santos',
    draft: {
      values: {
        tipo_cotacao: 'REAL',
        service_type: 'IMPORTACAO',
        modal: 'MARITIMO',
        tipo_embarque: 'LCL',
        origin: 'Centro de distribuição de Shanghai',
        porto_embarque: routes[1].origin,
        porto_destino: [routes[1].destination],
        incoterm: 'FCA',
        product: 'Peças de reposição',
      },
      equipments: [],
      volumes: [],
    },
  },
  {
    id: 'daehan-chapas',
    name: 'Chapas · Busan–Santos',
    supplierId: 'daehan',
    supplier: 'Daehan Metals',
    routeId: 'busan-santos',
    draft: {
      values: {
        tipo_cotacao: 'REAL',
        service_type: 'IMPORTACAO',
        modal: 'MARITIMO',
        tipo_embarque: 'FCL',
        origin: 'Armazém Daehan em Busan',
        porto_embarque: routes[0].origin,
        porto_destino: [routes[0].destination],
        incoterm: 'FOB',
        product: 'Chapas de aço galvanizado',
      },
      equipments: [],
      volumes: [],
    },
  },
];
export const history = [
  {
    ...initialHabits[0],
    id: 'cot-0017',
    reference: 'COT-2026-0017',
    po: 'PO-2026-1194',
    date: '11/09/2026',
    status: 'Em cotação',
  },
  {
    ...initialHabits[2],
    id: 'cot-0012',
    reference: 'COT-2026-0012',
    po: 'PO-2026-1189',
    date: '02/09/2026',
    status: 'Fechada',
  },
];

export function startRequest(source: Habit | null, routeId?: string): Quote {
  const route = routes.find((r) => r.id === (routeId || source?.routeId));
  const draft = source
    ? reusableDraft(source.draft)
    : {
        values: route
          ? {
              modal: 'MARITIMO' as const,
              porto_embarque: route.origin,
              porto_destino: [route.destination],
            }
          : {},
        equipments: [],
        volumes: [],
      };
  return {
    id: 'nova-local',
    reference: 'Nova solicitação',
    supplier: source?.supplier || '',
    product: draft.values.product || '',
    po: '',
    origin: draft.values.porto_embarque || 'Origem a confirmar',
    destination:
      draft.values.porto_destino?.join(', ') || 'Destino a confirmar',
    pickup: draft.values.origin || '',
    modal: draft.values.modal === 'MARITIMO' ? 'Marítimo' : '',
    equipment: draft.values.tipo_embarque || '',
    incoterm: draft.values.incoterm || '',
    readyDate: '',
    needDate: '',
    weight: '',
    volume: '',
    offers: [],
    targetAgents: [],
    agentCount: 0,
    sentAt: null,
    scheduledFor: null,
    responseBy: null,
    selected: null,
    stage: 'draft',
    events: [],
    followup: false,
    reason: '',
    manualDraft: {
      ...draft,
      values: {
        ...draft.values,
        data_prontidao: '',
        data_limite_necessidade: '',
        desired_deadline: '',
        client_reference: '',
        observations: '',
        declared_value: '',
        ptax_negociada: '',
      },
    },
  };
}
export function habitFromRequest(q: Quote, name: string, id: string): Habit {
  if (!name.trim()) throw new Error('Dê um nome à solicitação habitual.');
  if (!q.supplier.trim() || !q.product.trim())
    throw new Error(
      'Preencha fornecedor e mercadoria antes de salvar como habitual.',
    );
  const draft = reusableDraft(q.manualDraft!);
  const route = routes.find(
    (r) =>
      r.origin === draft.values.porto_embarque &&
      draft.values.porto_destino?.length === 1 &&
      draft.values.porto_destino[0] === r.destination,
  );
  if (!route)
    throw new Error(
      'Nesta prévia, use uma das rotas demonstradas: Busan–Santos ou Shanghai–Santos.',
    );
  return {
    id,
    name: name.trim(),
    supplierId: q.supplier.trim().toLowerCase(),
    supplier: q.supplier.trim(),
    routeId: route.id,
    draft,
  };
}

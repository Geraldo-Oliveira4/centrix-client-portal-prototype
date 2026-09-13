// Explicitly fictional visual-review data. No customer or operational API writes.
export const REVIEW_DAY = '2026-09-13';
export const journeySteps = [
  {
    label: 'Solicitado',
    source: 'Centrix',
    detail:
      'Solicitação registrada no Centrix, com data e autor. A criação do tracking não substitui este evento.',
  },
  {
    label: 'Booking',
    source: 'Centrix · operação',
    detail:
      'Análise e aprovação registradas no Centrix. BOOKED da ShipsGo informa reserva com armador; não comprova aprovação pelo cliente.',
  },
  {
    label: 'Coleta',
    source: 'Inova · operação',
    detail:
      'Contrato Inova: data_prev_coleta_ori / data_coleta_ori. Validar preenchimento. Gate-in e entrega de contêiner vazio não comprovam coleta no fornecedor.',
  },
  {
    label: 'Em trânsito',
    source: 'ShipsGo',
    detail:
      'Movimento DEPA com status ACT confirma partida; SAILING indica trânsito. Preservar local, contêiner e horário do evento.',
  },
  {
    label: 'Chegada ao porto',
    source: 'ShipsGo',
    detail:
      'Movimento ARRV no porto de destino: EST para previsão, ACT para chegada. Não usar chegada em transbordo. date_of_discharge descreve descarga, não este marco.',
  },
  {
    label: 'Descarregado',
    source: 'ShipsGo',
    detail:
      'Movimento DISC no destino: EST / ACT. date_of_discharge é a previsão de descarga. Não calcular como chegada + 2 dias.',
  },
  {
    label: 'Saída do terminal',
    source: 'ShipsGo',
    detail:
      'Movimento GTOT no destino: EST / ACT, quando disponível. Não comprova disponibilidade antecipada, desembaraço ou entrega final. Não calcular como chegada + 5 dias.',
  },
];
export const scenarios = [
  ['transito', 'Em trânsito · documento pendente'],
  ['regular', 'Em trânsito · sem pendências'],
  ['booking', 'Pré-embarque · revisar booking'],
  ['parcial', 'Consolidado · duas POs e moedas'],
  ['vencida', 'Previsão vencida · sem confirmação'],
  ['sem-dados', 'Embarque · informações incompletas'],
  ['chegada', 'Chegada confirmada · retirada'],
] as const;

export type CargoItem = {
  id: string;
  po: string;
  supplier: string;
  part: string | null;
  description: string;
  ordered: number | null;
  quantity: number;
  unit: string;
  unitValue: number | null;
  currency: string;
  invoice: string;
  line: number;
};
export type ShipmentDocument = {
  id: string;
  name: string;
  state: 'Pendente' | 'Em análise' | 'Aprovado';
  version: string;
  file: string | null;
  updated: string;
  owner: string;
};
export type Occurrence = {
  id: string;
  kind: 'document' | 'eta' | 'booking' | 'pickup';
  title: string;
  detail: string;
  owner: string;
  deadline: string | null;
  state: 'Aberta' | 'Em acompanhamento' | 'Resolvida';
  read: boolean;
  source: string;
  target: string;
  blocking: boolean;
};
export type HistoryEvent = {
  id: string;
  date: string;
  title: string;
  detail: string;
  type: 'Documento' | 'Acompanhamento' | 'Contratação';
  owner: string;
};
export type Shipment = {
  id: string;
  reference: string;
  description: string;
  origin: string;
  destination: string;
  stage: number;
  firstEta: string | null;
  eta: string | null;
  actual: boolean;
  updated: string | null;
  priority: boolean;
  items: CargoItem[];
  documents: ShipmentDocument[];
  alerts: Occurrence[];
  events: HistoryEvent[];
};
export const money = (value: number, currency = 'USD') =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value);
export const shortDate = (date: string | null) =>
  date
    ? new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        timeZone: 'UTC',
      })
        .format(new Date(date.slice(0, 10) + 'T12:00:00Z'))
        .replace(' de ', ' ')
        .replace(/\.$/, '')
    : 'A confirmar';

export function createShipment(scenario: string): Shipment {
  const q: Shipment = {
    id: `demo-shipment-${scenario}`,
    reference: 'EMB-DEMO-0183',
    description: 'Componentes para montagem industrial',
    origin: 'Ningbo, China',
    destination: 'Santos, Brasil',
    stage: 3,
    firstEta: '2026-09-18',
    eta: '2026-09-21',
    actual: false,
    updated: '13/09/2026 às 09:40',
    priority: true,
    items: [
      {
        id: 'line-1',
        po: 'PO-2026-1183',
        supplier: 'Ningbo Industrial Co.',
        part: 'MTR-220-4P',
        description: 'Motor elétrico trifásico · 2,2 kW',
        ordered: 200,
        quantity: 120,
        unit: 'un.',
        unitValue: 185,
        currency: 'USD',
        invoice: 'INV-DEMO-083',
        line: 1,
      },
      {
        id: 'line-2',
        po: 'PO-2026-1183',
        supplier: 'Ningbo Industrial Co.',
        part: 'INV-FR-07',
        description: 'Inversor de frequência · 7,5 kW',
        ordered: 80,
        quantity: 80,
        unit: 'un.',
        unitValue: 245,
        currency: 'USD',
        invoice: 'INV-DEMO-083',
        line: 2,
      },
      {
        id: 'line-3',
        po: 'PO-2026-1183',
        supplier: 'Ningbo Industrial Co.',
        part: 'SNS-PRX-18',
        description: 'Sensor de proximidade · M18',
        ordered: 600,
        quantity: 400,
        unit: 'un.',
        unitValue: 18.5,
        currency: 'USD',
        invoice: 'INV-DEMO-083',
        line: 3,
      },
    ],
    documents: [
      {
        id: 'origin',
        name: 'Certificado de Origem',
        state: 'Pendente',
        version: '—',
        file: null,
        updated: 'Solicitado em 12/09',
        owner: 'Sua empresa',
      },
      {
        id: 'invoice',
        name: 'Commercial Invoice',
        state: 'Aprovado',
        version: 'v2',
        file: 'INV-DEMO-083',
        updated: '10/09/2026 às 14:20',
        owner: 'Exportador',
      },
      {
        id: 'packing',
        name: 'Packing List',
        state: 'Aprovado',
        version: 'v1',
        file: 'PL-DEMO-083',
        updated: '10/09/2026 às 14:20',
        owner: 'Exportador',
      },
      {
        id: 'bl',
        name: 'Bill of Lading',
        state: 'Em análise',
        version: 'v1',
        file: 'BL-DEMO-083',
        updated: '12/09/2026 às 10:15',
        owner: 'Agente Demo',
      },
      {
        id: 'booking',
        name: 'Confirmação de booking',
        state: 'Aprovado',
        version: 'v2',
        file: 'BKG-DEMO-083',
        updated: '01/09/2026 às 16:30',
        owner: 'Agente Demo',
      },
    ],
    alerts: [
      {
        id: 'doc-origin',
        kind: 'document',
        title: 'Envie o Certificado de Origem',
        detail:
          'O documento foi solicitado para a conferência antes da chegada. Envie a versão recebida do exportador.',
        owner: 'Sua empresa',
        deadline: '2026-09-14',
        state: 'Aberta',
        read: false,
        source: 'Solicitação da operação · 12/09 às 16:10',
        target: 'origin',
        blocking: false,
      },
      {
        id: 'eta-change',
        kind: 'eta',
        title: 'A chegada mudou de 18 para 21 set.',
        detail:
          'A previsão no porto de Santos foi revisada em 3 dias. A data de entrega na sua empresa ainda não está informada.',
        owner: 'Agente Demo',
        deadline: null,
        state: 'Em acompanhamento',
        read: false,
        source: 'Atualização de tracking · 13/09 às 09:40',
        target: 'arrival',
        blocking: false,
      },
    ],
    events: [
      {
        id: 'e1',
        date: '13/09 · 09:40',
        title: 'Chegada ao porto revisada',
        detail: '18 set. → 21 set. · Santos, Brasil',
        type: 'Acompanhamento',
        owner: 'Tracking demonstrativo',
      },
      {
        id: 'e2',
        date: '12/09 · 16:10',
        title: 'Certificado de Origem solicitado',
        detail: 'Envio solicitado à sua empresa até 14 set.',
        type: 'Documento',
        owner: 'Operação Demo',
      },
      {
        id: 'e3',
        date: '03/09 · 08:00',
        title: 'Partida confirmada em Ningbo',
        detail: 'Carga em trânsito internacional.',
        type: 'Acompanhamento',
        owner: 'Tracking demonstrativo',
      },
      {
        id: 'e4',
        date: '28/08 · 15:30',
        title: 'Condição de frete aprovada',
        detail: 'Agente Demo · proposta v2 · USD 2.850 de frete internacional.',
        type: 'Contratação',
        owner: 'Usuário Demo',
      },
    ],
  };
  if (scenario === 'regular') {
    q.eta = q.firstEta;
    q.alerts = [];
    q.documents = q.documents.map((d) => ({
      ...d,
      state: 'Aprovado',
      file: d.file ?? 'CO-DEMO-083',
      version: 'v1',
    }));
    q.events = q.events.slice(2);
  }
  if (scenario === 'parcial') {
    q.documents.push({
      id: 'invoice91',
      name: 'Commercial Invoice · PO-2026-1204',
      state: 'Aprovado',
      version: 'v1',
      file: 'INV-DEMO-091',
      updated: '10/09/2026 às 14:20',
      owner: 'Precision Components Ltd.',
    });
    q.items.push(
      {
        id: 'line-4',
        po: 'PO-2026-1204',
        supplier: 'Precision Components Ltd.',
        part: null,
        description: 'Liga metálica para componentes',
        ordered: null,
        quantity: 250,
        unit: 'kg',
        unitValue: null,
        currency: 'EUR',
        invoice: 'INV-DEMO-091',
        line: 1,
      },
      {
        id: 'line-5',
        po: 'PO-2026-1204',
        supplier: 'Precision Components Ltd.',
        part: 'MTR-220-4P',
        description: 'Conjunto de fixação do motor',
        ordered: 100,
        quantity: 50,
        unit: 'kits',
        unitValue: 12,
        currency: 'EUR',
        invoice: 'INV-DEMO-091',
        line: 2,
      },
    );
  }
  if (scenario === 'booking') {
    q.stage = 1;
    q.eta = '2026-09-24';
    q.firstEta = '2026-09-21';
    q.alerts = [
      {
        id: 'booking-review',
        kind: 'booking',
        title: 'Revise a alteração do booking',
        detail:
          'O agente propôs a saída em 14 set., em vez de 11 set. A partida ainda não foi confirmada. A aprovação desta versão está pendente.',
        owner: 'Sua empresa',
        deadline: null,
        state: 'Aberta',
        read: false,
        source: 'Booking v3 · recebido em 02/09 às 14:30',
        target: 'booking',
        blocking: true,
      },
    ];
    q.documents = q.documents
      .filter((d) => ['invoice', 'packing', 'booking'].includes(d.id))
      .map((d) =>
        d.id === 'booking'
          ? {
              ...d,
              state: 'Em análise',
              version: 'v3',
              updated: '02/09/2026 às 14:30',
            }
          : d,
      );
    q.events = [q.events[3]];
  }
  if (scenario === 'vencida') {
    q.firstEta = '2026-09-05';
    q.eta = '2026-09-05';
    q.updated = '04/09/2026 às 10:00';
    q.alerts = [
      {
        id: 'eta-expired',
        kind: 'eta',
        title: 'Previsão vencida; confirme a chegada',
        detail:
          'A previsão era 05 set. e ainda não há confirmação de chegada. Não é possível afirmar se a carga já chegou.',
        owner: 'Agente Demo',
        deadline: null,
        state: 'Aberta',
        read: false,
        source: 'Último tracking · 04/09 às 10:00',
        target: 'arrival',
        blocking: false,
      },
    ];
    q.events = [q.events[3]];
  }
  if (scenario === 'sem-dados') {
    q.items = [];
    q.eta = null;
    q.firstEta = null;
    q.updated = null;
    q.stage = 0;
    q.origin = 'Origem não informada';
    q.destination = 'Destino não informado';
    q.alerts = [];
    q.documents = [];
    q.events = [];
    q.priority = false;
  }
  if (scenario === 'chegada') {
    q.eta = '2026-09-12';
    q.firstEta = '2026-09-12';
    q.actual = true;
    q.stage = 4;
    q.alerts = [
      {
        id: 'pickup',
        kind: 'pickup',
        title: 'Acompanhe a liberação para retirada',
        detail:
          'A chegada ao porto foi confirmada. Liberação e prazo de retirada ainda não foram informados. Não há base para calcular franquia ou custo.',
        owner: 'Agente Demo',
        deadline: null,
        state: 'Em acompanhamento',
        read: false,
        source: 'Chegada registrada · 12/09 às 06:15',
        target: 'arrival',
        blocking: false,
      },
    ];
    q.events = [
      {
        id: 'arrived',
        date: '12/09 · 06:15',
        title: 'Chegada confirmada em Santos',
        detail: 'A chegada ao porto não confirma liberação nem entrega final.',
        type: 'Acompanhamento',
        owner: 'Tracking demonstrativo',
      },
      ...q.events.slice(2),
    ];
    q.documents = q.documents.map((d) => ({
      ...d,
      state: 'Aprovado',
      file: d.file ?? 'CO-DEMO-083',
      version: 'v1',
    }));
  }
  return q;
}

export function arrivalState(q: Shipment, day = REVIEW_DAY) {
  if (q.actual && q.eta)
    return {
      label: 'Chegada confirmada ao porto',
      note: 'Entrega na sua empresa ainda não informada.',
      tone: 'success',
    };
  if (!q.eta)
    return {
      label: 'Chegada ao destino',
      note: 'Aguardando previsão e fonte de acompanhamento.',
      tone: 'neutral',
    };
  if (q.eta < day)
    return {
      label: 'Última previsão de chegada ao porto',
      note: 'Previsão vencida; aguardando confirmação de chegada.',
      tone: 'warning',
    };
  if (q.firstEta && q.eta > q.firstEta)
    return {
      label: 'Chegada prevista ao porto',
      note: `Previsão inicial: ${shortDate(q.firstEta)}. Entrega final não informada.`,
      tone: 'warning',
    };
  return {
    label: 'Chegada prevista ao porto',
    note: 'Sem alteração em relação à previsão inicial.',
    tone: 'neutral',
  };
}

export function journeyGuidance(q: Shipment) {
  if (!q.updated)
    return {
      phase: 'Aguardando informações',
      summary: 'Ainda não há dados suficientes para confirmar o andamento.',
      next: 'Confirmar prontidão e programação',
      instruction:
        'A operação precisa confirmar se a carga está pronta, a coleta e a reserva. A ausência de registro não comprova que a etapa não aconteceu.',
      owner: 'Operação · exportador',
      action: 'Solicitar atualização',
      alertId: null,
    };
  if (q.stage === 1) {
    const pending = q.alerts.find(
      (a) => a.kind === 'booking' && a.state !== 'Resolvida',
    );
    return {
      phase: pending ? 'Booking em análise' : 'Booking aprovado pelo cliente',
      summary: pending
        ? 'A reserva está em revisão. A partida ainda não foi confirmada.'
        : 'Sua aprovação foi registrada. Coleta e partida continuam sem confirmação.',
      next: pending
        ? 'Concluir a revisão do booking'
        : 'Confirmar prontidão e coleta',
      instruction: pending
        ? 'Confira navio, datas e condições da versão enviada antes de aprovar. A aprovação não confirma o embarque físico.'
        : 'O agente precisa confirmar a carga pronta e a programação da coleta. Você não tem ação pendente nesta etapa.',
      owner: pending ? 'Sua empresa' : 'Agente · exportador',
      action: pending ? 'Revisar booking' : 'Solicitar atualização',
      alertId: pending?.id ?? null,
    };
  }
  if (q.actual)
    return {
      phase: 'Navio chegou ao destino',
      summary:
        'Chegada ao porto confirmada. Descarga e saída do terminal ainda não confirmadas.',
      next: 'Acompanhar a descarga',
      instruction:
        'Aguarde a confirmação de descarga. Em paralelo, o agente deve informar os requisitos para retirada; chegada não significa carga liberada.',
      owner: 'Armador · agente',
      action: 'Ver acompanhamento',
      alertId: 'pickup',
    };
  if (q.eta && q.eta < REVIEW_DAY)
    return {
      phase: 'Em trânsito · confirmação pendente',
      summary: 'A última previsão venceu, mas não há confirmação de chegada.',
      next: 'Obter uma atualização de chegada',
      instruction:
        'O agente precisa confirmar a posição e a nova previsão. A data vencida não avança a etapa automaticamente.',
      owner: 'Agente',
      action: 'Solicitar atualização',
      alertId: null,
    };
  const pending = q.alerts.find(
    (a) => a.kind === 'document' && a.state !== 'Resolvida',
  );
  return {
    phase: 'Em trânsito internacional',
    summary:
      'Partida confirmada na origem. Acompanhando o percurso até o destino.',
    next: 'Preparar a chegada ao porto',
    instruction: pending
      ? 'Envie o Certificado de Origem para a conferência documental antes da chegada. Essa pendência não interrompe o trânsito do navio.'
      : 'Nenhuma ação sua está pendente agora. A operação acompanha os documentos e a confirmação de chegada.',
    owner: pending ? 'Sua empresa' : 'Operação · armador',
    action: pending ? 'Enviar documento' : 'Ver acompanhamento',
    alertId: pending?.id ?? null,
  };
}

export function cargoTotals(items: CargoItem[]) {
  const totals = new Map<
    string,
    { value: number; known: number; lines: number }
  >();
  items.forEach((item) => {
    const entry = totals.get(item.currency) ?? { value: 0, known: 0, lines: 0 };
    entry.lines++;
    if (item.unitValue !== null) {
      entry.value += item.quantity * item.unitValue;
      entry.known++;
    }
    totals.set(item.currency, entry);
  });
  return Array.from(totals.entries()).map(([currency, total]) => ({
    currency,
    ...total,
  }));
}

export function markRead(q: Shipment, id: string): Shipment {
  return {
    ...q,
    alerts: q.alerts.map((a) => (a.id === id ? { ...a, read: true } : a)),
  };
}
export function submitDocument(
  q: Shipment,
  id: string,
  file: string,
): Shipment {
  if (
    !file.trim() ||
    !q.documents.some((d) => d.id === id && d.state === 'Pendente')
  )
    return q;
  return {
    ...q,
    documents: q.documents.map((d) =>
      d.id === id
        ? {
            ...d,
            state: 'Em análise',
            file,
            version: 'v1',
            updated: 'Agora · nesta prévia',
          }
        : d,
    ),
    alerts: q.alerts.map((a) =>
      a.kind === 'document' && a.target === id
        ? {
            ...a,
            state: 'Resolvida',
            read: true,
            title: 'Certificado de Origem enviado',
            detail:
              'Sua pendência de envio foi concluída. O documento está em análise e ainda não foi aprovado.',
          }
        : a,
    ),
    events: [
      {
        id: `submit-${id}`,
        date: 'Agora',
        title: 'Documento enviado para análise',
        detail: `${file} · envio simulado, sem transferência de arquivo.`,
        type: 'Documento',
        owner: 'Você',
      },
      ...q.events,
    ],
  };
}
export function approveBooking(q: Shipment): Shipment {
  if (!q.alerts.some((a) => a.kind === 'booking' && a.state === 'Aberta'))
    return q;
  return {
    ...q,
    alerts: q.alerts.map((a) =>
      a.kind === 'booking'
        ? {
            ...a,
            state: 'Resolvida',
            read: true,
            title: 'Booking v3 aprovado',
            detail:
              'Você aprovou a alteração da saída de 11 para 14 set. A partida segue sem confirmação.',
          }
        : a,
    ),
    documents: q.documents.map((d) =>
      d.id === 'booking'
        ? { ...d, state: 'Aprovado', updated: 'Agora · nesta prévia' }
        : d,
    ),
    events: [
      {
        id: 'booking-accepted',
        date: 'Agora',
        title: 'Booking v3 aprovado',
        detail: 'Aprovação local registrada. Partida segue sem confirmação.',
        type: 'Contratação',
        owner: 'Você',
      },
      ...q.events,
    ],
  };
}

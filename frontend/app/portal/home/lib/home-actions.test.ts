import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  HOME_ACTION_LIMIT,
  buildHomeActions,
  type HomeActionsInput,
} from './home-actions.ts';
import {
  ESTADO_SEMAFORO,
  EXCEPTION_STATES,
  type EmbarqueEstado,
} from '../../../../types/portal-shipment.ts';
import { SHIPMENT_FILTERS } from '../../embarques/lib/shipment-filters.ts';

const NOW = new Date('2026-08-26T12:00:00Z');

// Os cinco estados operacionais, no formato que `buildTimelineSteps` espera.
// Espelha `REAL_STEPS`, que não pode ser importado aqui (usa o alias `@/`).
const REAL_STEPS: HomeActionsInput['realSteps'] = [
  { key: 'solicitado', label: 'Solicitado', description: '' },
  { key: 'aguardando_prontidao', label: 'Aguardando prontidão', description: '' },
  { key: 'coletado', label: 'Coletado', description: '' },
  { key: 'analise_booking', label: 'Em análise de booking', description: '' },
  { key: 'embarcado', label: 'Embarcado', description: '' },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const shipment = (over: Record<string, unknown> = {}): any => ({
  id: 'ship-1',
  referencia: 'EMB-2026-0001',
  estado: 'analise_booking' as EmbarqueEstado,
  created_at: '2026-07-01T00:00:00Z',
  carga_urgente: false,
  tracking: null,
  ...over,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const quotation = (over: Record<string, unknown> = {}): any => ({
  id: 'q-1',
  reference: 'COT-2026-0001',
  state: 'ENVIADA_CLIENTE',
  created_at: '2026-08-01T00:00:00Z',
  best_proposal: null,
  data_limite_necessidade: null,
  ...over,
});

const run = (over: Partial<HomeActionsInput> = {}) =>
  buildHomeActions({
    shipments: [],
    buckets: {},
    realSteps: REAL_STEPS,
    now: NOW,
    ...over,
  });

test('sem embarque e sem cotação pendente, a fila é vazia — não um placeholder', () => {
  const result = run();
  assert.equal(result.total, 0);
  assert.deepEqual(result.actions, []);
});

test('booking em análise vira ação, com o jargão explicado inline', () => {
  const { actions } = run({ shipments: [shipment({ estado: 'analise_booking' })] });
  const booking = actions.find((a) => a.kind === 'booking');
  assert.ok(booking, 'esperava uma ação de booking');
  assert.match(booking.description, /reserva de espaço no navio/);
  assert.equal(booking.href, '/portal/embarques/ship-1');
  assert.equal(booking.tone, 'warning');
});

test('booking divergente é vermelho; booking em análise, laranja', () => {
  const divergent = run({ shipments: [shipment({ estado: 'booking_divergente' })] })
    .actions.find((a) => a.kind === 'booking');
  const routine = run({ shipments: [shipment({ estado: 'analise_booking' })] })
    .actions.find((a) => a.kind === 'booking');
  assert.equal(divergent?.tone, 'danger');
  assert.equal(routine?.tone, 'warning');
  // Os dois explicam o jargão: o texto não pode depender do caminho.
  assert.match(divergent!.description, /reserva de espaço no navio/);
});

test('ação de documento aponta para a seção Documentos, não para o topo da tela', () => {
  const { actions } = run({ shipments: [shipment({ estado: 'coletado' })] });
  const doc = actions.find((a) => a.kind === 'documento');
  if (doc) assert.equal(doc.href, '/portal/embarques/ship-1#documentos');
});

test('proposta aguardando escolha carrega o prazo em dias, não um rótulo', () => {
  const { actions } = run({
    buckets: {
      aguardando_aprovacao: [
        quotation({ best_proposal: { validity: '2026-08-29T00:00:00Z' } }),
      ],
    },
  });
  assert.equal(actions.length, 1);
  assert.equal(actions[0].kind, 'proposta');
  assert.equal(actions[0].daysLeft, 3);
  // A data crua viaja junto, para a tela formatar com o mesmo `daysUntil` do
  // card do Funil em vez de redigir um segundo rótulo de prazo.
  assert.equal(actions[0].deadline, '2026-08-29T00:00:00Z');
  assert.equal(actions[0].tone, 'warning');
  assert.equal(actions[0].href, '/portal/cotacao/q-1');
});

test('validade vencida vira vermelho e o texto muda de afirmação', () => {
  const { actions } = run({
    buckets: {
      aguardando_aprovacao: [
        quotation({ best_proposal: { validity: '2026-08-20T00:00:00Z' } }),
      ],
    },
  });
  assert.equal(actions[0].tone, 'danger');
  assert.ok(actions[0].daysLeft! < 0);
  assert.match(actions[0].description, /já venceu/);
});

test('sem validade não há prazo inventado — os dois campos simplesmente não vêm', () => {
  const { actions } = run({
    buckets: { aguardando_aprovacao: [quotation()] },
  });
  assert.equal(actions[0].daysLeft, undefined);
  assert.equal(actions[0].deadline, undefined);
});

test('a validade da proposta tem prioridade sobre a data-limite da necessidade', () => {
  const { actions } = run({
    buckets: {
      aguardando_aprovacao: [
        quotation({
          best_proposal: { validity: '2026-08-28T00:00:00Z' },
          data_limite_necessidade: '2026-09-30T00:00:00Z',
        }),
      ],
    },
  });
  assert.equal(actions[0].daysLeft, 2);
});

test('aguardando_dados entra como "Detalhes pendentes", em tom informativo', () => {
  const { actions } = run({
    buckets: {
      aguardando_dados: [quotation({ id: 'q-2', state: 'AGUARDANDO_DADOS' })],
    },
  });
  assert.equal(actions[0].kind, 'dados');
  assert.equal(actions[0].tone, 'info');
  assert.equal(actions[0].href, '/portal/cotacao/q-2');
});

test('bucket que não é de ação do cliente não entra na fila', () => {
  // `buscando_propostas` é o que o rodapé conta como "aguardando retorno": a
  // bola está com o agente, não com o cliente. Se ele vazasse para cá, a Home
  // pediria ação por algo que o cliente não pode resolver.
  const { total } = run({
    buckets: { buscando_propostas: [quotation({ state: 'COTANDO' })] },
  });
  assert.equal(total, 0);
});

test('ordem: prazo primeiro, depois booking, documento e por fim detalhes', () => {
  const { actions } = run({
    shipments: [shipment({ estado: 'analise_booking' })],
    buckets: {
      aguardando_aprovacao: [
        quotation({ best_proposal: { validity: '2026-09-10T00:00:00Z' } }),
      ],
      aguardando_dados: [quotation({ id: 'q-2' })],
    },
  });
  const kinds = actions.map((a) => a.kind);
  assert.equal(kinds[0], 'proposta');
  assert.equal(kinds[kinds.length - 1], 'dados');
  assert.ok(kinds.indexOf('booking') < kinds.indexOf('dados'));
});

test('entre propostas, a que vence antes vem primeiro', () => {
  const { actions } = run({
    buckets: {
      aguardando_aprovacao: [
        quotation({ id: 'q-late', best_proposal: { validity: '2026-09-20T00:00:00Z' } }),
        quotation({ id: 'q-soon', best_proposal: { validity: '2026-08-27T00:00:00Z' } }),
      ],
    },
  });
  assert.deepEqual(
    actions.map((a) => a.id),
    ['proposta:q-soon', 'proposta:q-late'],
  );
});

test('proposta sem prazo vai depois de qualquer proposta com prazo', () => {
  const { actions } = run({
    buckets: {
      aguardando_aprovacao: [
        quotation({ id: 'q-none' }),
        quotation({ id: 'q-dated', best_proposal: { validity: '2026-09-20T00:00:00Z' } }),
      ],
    },
  });
  assert.deepEqual(
    actions.map((a) => a.id),
    ['proposta:q-dated', 'proposta:q-none'],
  );
});

test('o corte é declarado: mostra o limite, mas o total conta tudo', () => {
  const many = Array.from({ length: HOME_ACTION_LIMIT + 4 }, (_, i) =>
    quotation({ id: `q-${i}`, state: 'AGUARDANDO_DADOS' }),
  );
  const { actions, total } = run({ buckets: { aguardando_dados: many } });
  assert.equal(actions.length, HOME_ACTION_LIMIT);
  assert.equal(total, HOME_ACTION_LIMIT + 4);
});

test('ids são estáveis e únicos — a lista não remonta nem colide entre renders', () => {
  const input = {
    shipments: [shipment({ estado: 'booking_divergente' })],
    buckets: { aguardando_aprovacao: [quotation()] },
  };
  const a = run(input).actions.map((x) => x.id);
  const b = run(input).actions.map((x) => x.id);
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, a.length);
});

test('todo href começa em /portal — nenhum CTA da Home é decorativo', () => {
  const { actions } = run({
    shipments: [shipment({ estado: 'booking_divergente' })],
    buckets: {
      aguardando_aprovacao: [quotation()],
      aguardando_dados: [quotation({ id: 'q-2' })],
    },
  });
  assert.ok(actions.length > 0);
  actions.forEach((a) => {
    assert.match(a.href, /^\/portal\//);
    assert.ok(a.ctaLabel.length > 0);
    assert.ok(a.category.length > 0);
  });
});

// O farol da Home manda o cliente para o Mapa com o chip "Com exceção" ligado, e
// afirma que aquele recorte é exatamente "reprogramado + exceção". Isso é
// verdade porque o chip usa `isExceptionState` e o semáforo classifica os mesmos
// estados como warning/danger. Se um estado novo quebrar a igualdade, o link do
// farol passa a levar a uma contagem diferente da que ele mostra — e este teste
// falha antes disso chegar à tela.
test('o chip "Com exceção" do Mapa cobre exatamente os estados não-verdes', () => {
  const excecao = SHIPMENT_FILTERS.find((f) => f.key === 'excecao');
  assert.ok(excecao);
  const naoVerdes = (Object.keys(ESTADO_SEMAFORO) as EmbarqueEstado[]).filter(
    (e) => ESTADO_SEMAFORO[e] !== 'success',
  );
  assert.deepEqual([...naoVerdes].sort(), [...EXCEPTION_STATES].sort());
  naoVerdes.forEach((estado) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assert.equal(excecao.match({ estado } as any), true, estado);
  });
});

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildControlTower,
  type ControlTowerInput,
} from './control-tower.ts';
import { collectHomeActions } from '../../home/lib/home-actions.ts';
import type { EmbarqueEstado } from '../../../../types/portal-shipment.ts';
import { PORTAL_CLIENT_ACTION_BUCKETS } from '../../../../types/portal.ts';

const NOW = new Date('2026-08-26T12:00:00Z');

// Espelha `REAL_STEPS`, que não pode ser importado aqui (usa o alias `@/`).
const REAL_STEPS: ControlTowerInput['realSteps'] = [
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
  // `coletado` e o unico estado operacional que NAO produz gatilho pendente
  // (conferido rodando `collectHomeActions` sobre os sete estados). E o default
  // aqui para os testes da coluna 2 isolarem o risco de prazo: com qualquer
  // outro, o embarque cairia na coluna 1 pela regra de precedencia e o teste
  // estaria medindo o dedupe em vez da classificacao.
  estado: 'coletado' as EmbarqueEstado,
  created_at: '2026-07-01T00:00:00Z',
  carga_urgente: false,
  tracking: null,
  ...over,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const quotation = (over: Record<string, unknown> = {}): any => ({
  id: 'quo-1',
  reference: 'COT-2026-0001',
  created_at: '2026-08-01T00:00:00Z',
  ...over,
});

/** Rastreamento COMPLETE com o desvio pedido, em dias. */
const tracking = (deltaDays: number) => ({
  first_eta: '2026-09-01T00:00:00Z',
  current_eta: new Date(
    Date.UTC(2026, 8, 1 + deltaDays),
  ).toISOString(),
  eta_is_actual: false,
  data_status: 'COMPLETE' as const,
  last_milestone: null,
  last_milestone_at: null,
  is_mock: true,
});

const run = (over: Partial<ControlTowerInput> = {}) =>
  buildControlTower({
    shipments: [],
    buckets: {},
    bucketOrder: ['aguardando_dados', 'buscando_propostas', 'aguardando_aprovacao'],
    realSteps: REAL_STEPS,
    now: NOW,
    ...over,
  });

test('cliente sem nada: as duas colunas vazias, farol todo zero', () => {
  const tower = run();
  assert.deepEqual(tower.awaiting, []);
  assert.deepEqual(tower.attention, []);
  assert.equal(tower.total, 0);
  assert.deepEqual(
    tower.beacons.map((b) => b.count),
    [0, 0, 0],
  );
});

test('cotação em bucket de ação do cliente entra em "Aguardando sua ação"', () => {
  const tower = run({
    buckets: { aguardando_aprovacao: [quotation()] },
  });
  assert.equal(tower.awaiting.length, 1);
  assert.equal(tower.awaiting[0].module, 'cotacao');
  assert.equal(tower.awaiting[0].reference, 'COT-2026-0001');
  assert.equal(tower.attention.length, 0);
});

test('bucket que não é de ação do cliente não entra em coluna nenhuma', () => {
  const tower = run({
    buckets: { buscando_propostas: [quotation()] },
  });
  assert.equal(tower.awaiting.length, 0);
  assert.equal(tower.attention.length, 0);
  // Mas continua contando como cotação ativa — é verde, não invisível.
  assert.equal(tower.total, 1);
  assert.equal(tower.beacons[0].count, 1);
});

test('a coluna 1 usa os MESMOS baldes que o Funil chama de needsAction', () => {
  // Trava a fonte, não a lista: um balde novo em PORTAL_CLIENT_ACTION_BUCKETS
  // tem de aparecer aqui sem ninguém editar este módulo.
  for (const bucket of PORTAL_CLIENT_ACTION_BUCKETS) {
    const tower = run({ buckets: { [bucket]: [quotation()] } });
    assert.equal(tower.awaiting.length, 1, `balde ${bucket} não entrou na coluna 1`);
  }
});

test('embarque com StepAction pendente entra em "Aguardando sua ação"', () => {
  const tower = run({
    shipments: [shipment({ estado: 'analise_booking' })],
  });
  assert.equal(tower.awaiting.length, 1);
  assert.equal(tower.awaiting[0].module, 'embarque');
  assert.equal(tower.awaiting[0].reference, 'EMB-2026-0001');
});

test('risco médio (attention) vai para "Precisam de atenção", em laranja', () => {
  const tower = run({ shipments: [shipment({ tracking: tracking(2) })] });
  assert.equal(tower.attention.length, 1);
  assert.equal(tower.attention[0].tone, 'warning');
  assert.match(tower.attention[0].description, /2 dias/);
});

test('risco alto (delayed) vai para a mesma coluna, em vermelho', () => {
  const tower = run({ shipments: [shipment({ tracking: tracking(9) })] });
  assert.equal(tower.attention.length, 1);
  assert.equal(tower.attention[0].tone, 'danger');
  assert.match(tower.attention[0].description, /9 dias/);
});

test('no prazo, pendente e sem dado suficiente não entram em coluna nenhuma', () => {
  for (const tk of [
    tracking(0),
    tracking(-3),
    null,
    { ...tracking(0), data_status: 'INCOMPLETE' as const },
  ]) {
    const tower = run({ shipments: [shipment({ tracking: tk })] });
    assert.equal(tower.attention.length, 0);
    assert.equal(tower.awaiting.length, 0);
  }
});

test('a descrição de prazo não imprime o rótulo do chip, mas usa o mesmo número', () => {
  const tower = run({ shipments: [shipment({ tracking: tracking(5) })] });
  const { description } = tower.attention[0];
  assert.match(description, /5 dias/);
  // "Atraso, +5 dias" é o texto do chip colado no ETA; fora daquele contexto a
  // linha diz quem moveu a data e contra o quê.
  assert.doesNotMatch(description, /Atraso/);
});

test('atrasado E com ação pendente aparece SÓ em "Aguardando sua ação"', () => {
  const tower = run({
    shipments: [shipment({ estado: 'analise_booking', tracking: tracking(9) })],
  });
  assert.equal(tower.awaiting.length, 1);
  assert.equal(tower.attention.length, 0);
});

test('nenhum id se repete entre as duas colunas, em nenhum arranjo', () => {
  const tower = run({
    shipments: [
      shipment({ id: 'a', referencia: 'EMB-A', estado: 'analise_booking', tracking: tracking(9) }),
      shipment({ id: 'b', referencia: 'EMB-B', estado: 'embarcado', tracking: tracking(4) }),
      shipment({ id: 'c', referencia: 'EMB-C', estado: 'booking_divergente' }),
    ],
    buckets: { aguardando_aprovacao: [quotation()] },
  });
  const ids = [...tower.awaiting, ...tower.attention].map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('dois gatilhos no mesmo embarque viram UMA linha, não duas', () => {
  // `booking_divergente` produz DOIS gatilhos pendentes (booking + documento).
  // A Home lista os dois, e ali isso é certo — cada um tem CTA próprio. A Torre
  // lista o REGISTRO, senão o farol contaria o embarque duas vezes.
  const input = { shipments: [shipment({ estado: 'booking_divergente' })] };
  assert.equal(
    collectHomeActions({
      ...input,
      buckets: {},
      realSteps: REAL_STEPS,
      now: NOW,
    }).length,
    2,
    'o cenário precisa de dois gatilhos para o teste significar alguma coisa',
  );

  const tower = run(input);
  assert.equal(tower.awaiting.length, 1);
  // O gatilho representante é o primeiro da ordem da Home: booking vem antes de
  // documento, porque segura o navio.
  assert.equal(tower.awaiting[0].reference, 'EMB-2026-0001');
});

test('o farol fecha: verde + laranja + vermelho = cotações ativas + embarques', () => {
  const tower = run({
    shipments: [
      shipment({ id: 'a', referencia: 'EMB-A', estado: 'analise_booking' }),
      shipment({ id: 'b', referencia: 'EMB-B', estado: 'embarcado', tracking: tracking(7) }),
      shipment({ id: 'c', referencia: 'EMB-C', estado: 'embarcado', tracking: tracking(0) }),
    ],
    buckets: {
      aguardando_aprovacao: [quotation({ id: 'q1', reference: 'COT-1' })],
      buscando_propostas: [quotation({ id: 'q2', reference: 'COT-2' })],
      // Fora de `bucketOrder`: Histórico não é carteira ativa e não pode entrar
      // no denominador.
      finalizadas: [quotation({ id: 'q3', reference: 'COT-3' })],
    },
  });

  assert.equal(tower.total, 2 + 3);
  const sum = tower.beacons.reduce((acc, b) => acc + b.count, 0);
  assert.equal(sum, tower.total);
  assert.equal(tower.beacons[2].count, tower.awaiting.length);
  assert.equal(tower.beacons[1].count, tower.attention.length);
});

test('o farol nunca conta o mesmo embarque duas vezes', () => {
  // Um embarque com ação pendente E atraso poderia entrar nas duas parcelas se o
  // dedupe fosse por gatilho — o farol estouraria o total.
  const tower = run({
    shipments: [shipment({ estado: 'analise_booking', tracking: tracking(9) })],
  });
  assert.equal(tower.beacons.reduce((acc, b) => acc + b.count, 0), tower.total);
});

test('todo href começa em /portal — nenhuma linha da Torre é decorativa', () => {
  const tower = run({
    shipments: [
      shipment({ id: 'a', referencia: 'EMB-A', estado: 'analise_booking' }),
      shipment({ id: 'b', referencia: 'EMB-B', estado: 'embarcado', tracking: tracking(7) }),
    ],
    buckets: { aguardando_aprovacao: [quotation()] },
  });
  for (const item of [...tower.awaiting, ...tower.attention]) {
    assert.ok(item.href.startsWith('/portal'), item.href);
    assert.ok(item.ctaLabel.length > 0);
  }
});

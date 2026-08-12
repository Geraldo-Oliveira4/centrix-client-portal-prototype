// Unit test das agregações por rota e por armador. Mesmo runner dos outros:
//
//     npm run test:unit
//
// As duas funções são fáceis de quebrar de um jeito invisível na tela de hoje:
// com quase todo embarque sem rastreamento, um bug que trate "sem dado" como
// zero produz "0 dias / 100% no prazo" — que parece um resultado excelente em
// vez de um resultado ausente. É esse o caso que os testes travam.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeCarrierUsage,
  computeRouteDeviations,
} from './shipment-dimensions.ts';

/** Embarque mínimo; só o que as agregações leem. */
const shipment = (id, quotationId, tracking = null) => ({
  id,
  referencia: id,
  client_reference: null,
  estado: 'embarcado',
  incoterm: null,
  modal: 'MARITIMO',
  tipo_embarque: null,
  tipo_despacho: null,
  carga_urgente: false,
  agente_nome: null,
  quotation_id: quotationId,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: null,
  tracking,
});

/** Rastreamento COMPLETE com um desvio de `days` dias. */
const trackedBy = (days) => ({
  first_eta: '2026-03-10T00:00:00Z',
  current_eta: new Date(
    Date.UTC(2026, 2, 10 + days),
  ).toISOString(),
  eta_is_actual: false,
  data_status: 'COMPLETE',
  last_milestone: null,
  last_milestone_at: null,
  is_mock: true,
});

// `porto_destino` e `aeroporto_destino` sao LISTAS no payload do portal.
const quotation = (id, origin, carrier, destination = null) => ({
  id,
  origin,
  porto_destino: destination,
  aeroporto_destino: null,
  best_proposal: carrier ? { carrier } : null,
});

// --- Rotas ----------------------------------------------------------------

test('rota: sem rastreamento nenhum, o ranking é vazio (não é "0 dias")', () => {
  const rows = computeRouteDeviations(
    [shipment('S1', 'Q1'), shipment('S2', 'Q1')],
    [quotation('Q1', 'Shanghai, China', 'Maersk')],
  );
  assert.deepEqual(rows, []);
});

test('rota: INCOMPLETE não conta como no prazo', () => {
  const incomplete = {
    first_eta: null,
    current_eta: null,
    eta_is_actual: null,
    data_status: 'INCOMPLETE',
    last_milestone: null,
    last_milestone_at: null,
    is_mock: true,
  };
  const rows = computeRouteDeviations(
    [shipment('S1', 'Q1', incomplete)],
    [quotation('Q1', 'Shanghai, China', 'Maersk')],
  );
  assert.deepEqual(rows, []);
});

test('rota: média sobre os embarques medidos, pior primeiro', () => {
  const rows = computeRouteDeviations(
    [
      shipment('S1', 'Q1', trackedBy(6)),
      shipment('S2', 'Q1', trackedBy(4)),
      shipment('S3', 'Q2', trackedBy(1)),
    ],
    [
      quotation('Q1', 'Houston, USA', 'Maersk'),
      quotation('Q2', 'Genova, Italy', 'ONE'),
    ],
  );
  assert.deepEqual(rows, [
    { route: 'Houston → Brasil', shipments: 2, avgDeltaDays: 5 },
    { route: 'Genova → Brasil', shipments: 1, avgDeltaDays: 1 },
  ]);
});

test('rota: usa o porto de destino da cotação quando existe', () => {
  const rows = computeRouteDeviations(
    [shipment('S1', 'Q1', trackedBy(2))],
    [quotation('Q1', 'Shanghai, China', 'Maersk', ['Santos (BRSSZ)'])],
  );
  assert.equal(rows[0].route, 'Shanghai → Santos (BRSSZ)');
});

test('rota: com varios portos candidatos, o destino nao e inventado', () => {
  // A cotacao pode listar portos alternativos e deixar a escolha para o agente.
  // Pegar o primeiro nomearia um destino que talvez nao seja o da carga.
  const rows = computeRouteDeviations(
    [shipment('S1', 'Q1', trackedBy(2))],
    [quotation('Q1', 'Shanghai, China', 'Maersk', ['Santos (BRSSZ)', 'Itapoa (BRIOA)'])],
  );
  assert.equal(rows[0].route, 'Shanghai → Brasil');
});

test('rota: embarque sem cotação conhecida fica de fora, sem balde "Outras"', () => {
  const rows = computeRouteDeviations(
    [shipment('S1', null, trackedBy(9)), shipment('S2', 'DESCONHECIDA', trackedBy(9))],
    [quotation('Q1', 'Shanghai, China', 'Maersk')],
  );
  assert.deepEqual(rows, []);
});

test('rota: desvio negativo (chegou antes) não é descartado como ausência', () => {
  const rows = computeRouteDeviations(
    [shipment('S1', 'Q1', trackedBy(-3))],
    [quotation('Q1', 'Shanghai, China', 'Maersk')],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].avgDeltaDays, -3);
});

// --- Armadores -------------------------------------------------------------

test('armador: conta embarques mesmo sem rastreamento, mas on-time fica null', () => {
  // O ponto do bloco: nome e contagem são reais e aparecem; o on-time não é
  // fabricado. `null` vira "—" na tela, nunca "0%".
  const rows = computeCarrierUsage(
    [shipment('S1', 'Q1'), shipment('S2', 'Q1')],
    [quotation('Q1', 'Shanghai, China', 'Maersk')],
  );
  assert.deepEqual(rows, [
    { carrier: 'Maersk', shipments: 2, onTimePct: null, trackedShipments: 0 },
  ]);
});

test('armador: on-time só sobre os medidos', () => {
  const rows = computeCarrierUsage(
    [
      shipment('S1', 'Q1', trackedBy(0)), // no prazo
      shipment('S2', 'Q1', trackedBy(8)), // atrasado
      shipment('S3', 'Q1'), // sem rastreamento — não entra no percentual
    ],
    [quotation('Q1', 'Shanghai, China', 'Maersk')],
  );
  assert.equal(rows[0].shipments, 3);
  assert.equal(rows[0].trackedShipments, 2);
  assert.equal(rows[0].onTimePct, 50);
});

test('armador: sem carrier na proposta, o embarque fica fora (sem "Não informado")', () => {
  const rows = computeCarrierUsage(
    [shipment('S1', 'Q1'), shipment('S2', 'Q2')],
    [
      quotation('Q1', 'Shanghai, China', null),
      quotation('Q2', 'Genova, Italy', 'ONE'),
    ],
  );
  assert.deepEqual(
    rows.map((r) => r.carrier),
    ['ONE'],
  );
});

test('armador: ordena por volume, com o nome desempatando', () => {
  const rows = computeCarrierUsage(
    [
      shipment('S1', 'Q1'),
      shipment('S2', 'Q1'),
      shipment('S3', 'Q2'),
      shipment('S4', 'Q3'),
    ],
    [
      quotation('Q1', 'Shanghai, China', 'Maersk'),
      quotation('Q2', 'Genova, Italy', 'ONE'),
      quotation('Q3', 'Houston, USA', 'CMA CGM'),
    ],
  );
  assert.deepEqual(
    rows.map((r) => r.carrier),
    ['Maersk', 'CMA CGM', 'ONE'],
  );
});

test('armador não é agente: o nome do agente nunca entra no ranking', () => {
  // Regressão possível: alguém "conserta" o join lendo best_proposal.agent.name
  // por achar que carrier está vazio. Aí o bloco de armadores viraria uma cópia
  // do ranking de agentes, com o mesmo nome em duas dimensões diferentes.
  const withAgent = {
    ...quotation('Q1', 'Shanghai, China', 'Maersk'),
    best_proposal: { carrier: 'Maersk', agent: { name: 'AGENTE ALPHA' } },
  };
  const rows = computeCarrierUsage([shipment('S1', 'Q1')], [withAgent]);
  assert.deepEqual(
    rows.map((r) => r.carrier),
    ['Maersk'],
  );
});

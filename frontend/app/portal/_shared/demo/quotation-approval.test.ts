// Unit test do embarque que nasce de uma proposta aprovada (RQ-18). Mesmo
// runner: npm run test:unit
//
// O QUE ERRA EM SILENCIO AQUI:
//
//   1. O embarque nascer SEM vinculo com a cotacao. E o vinculo que faz a tela
//      resolver a rota pela COTACAO; sem ele o embarque cairia no hub
//      ilustrativo e a jornada terminaria com uma origem inventada.
//   2. Fabricar SKU, peso ou quantidade que a cotacao nao tem.
//   3. Nascer em revisao. Quem aprovou foi o cliente, sobre propostas que a
//      Freitas tinha acabado de liberar — nao ha segunda revisao nesta ponta.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  approvalShipmentId,
  shipmentFromApproval,
  type ApprovalProposal,
  type ApprovalQuotation,
} from './quotation-approval.ts';
import { mergePoShipments, poRouteLabel } from './shipment-po-merge.ts';

const AT = '2026-09-24T15:00:00.000Z';

const QUOTATION: ApprovalQuotation = {
  id: 'cot-1',
  reference: 'COT-2026-0001',
  product: 'Motores elétricos',
  client_reference: 'PO-2026-1183',
  exporter_name: 'Sense Components Ltd.',
  incoterm: 'FOB',
  modal: 'MARITIMO',
  tipo_embarque: 'FCL',
};

const PROPOSAL: ApprovalProposal = {
  id: 'demo-proposal:cot-1:alpha',
  agent: { name: 'Alpha Cargo' },
  total_brl: 6490,
  transit_time: 29,
};

const built = () =>
  shipmentFromApproval('EMB-2026-0101', QUOTATION, PROPOSAL, AT);

test('o embarque nasce ATIVO e vinculado a cotacao', () => {
  const s = built();
  assert.equal(s.stage, 'active');
  assert.equal(s.origin, 'cotacao');
  assert.equal(s.linkedQuotationId, 'cot-1');
  assert.equal(s.reference, 'EMB-2026-0101');
});

test('os dados vem da COTACAO e da PROPOSTA, nao de lugar nenhum', () => {
  const s = built();
  assert.deepEqual(s.data.poNumbers, ['PO-2026-1183']);
  assert.equal(s.data.clientRef, 'PO-2026-1183');
  assert.equal(s.data.exporter, 'Sense Components Ltd.');
  assert.equal(s.data.incoterm, 'FOB');
  assert.equal(s.data.modal, 'MARITIMO');
  assert.equal(s.data.tipoEmbarque, 'FCL');
  assert.equal(s.data.agentName, 'Alpha Cargo');
  assert.equal(s.data.items[0].description, 'Motores elétricos');
});

test('NAO fabrica SKU, quantidade nem peso — a cotacao nao os tem', () => {
  const item = built().data.items[0];
  assert.equal(item.partNumber, '');
  assert.equal(item.quantity, null);
  assert.equal(item.unitValue, null);
  assert.equal(item.netWeightKg, null);
  assert.equal(item.grossWeightKg, null);
  assert.equal(item.totalValue, null);
});

test('sem mercadoria na cotacao, nao inventa um item', () => {
  const s = shipmentFromApproval(
    'EMB-2026-0101',
    { ...QUOTATION, product: null },
    PROPOSAL,
    AT,
  );
  assert.deepEqual(s.data.items, []);
});

test('modal desconhecido vira vazio, e tipo de carga so no maritimo', () => {
  const aereo = shipmentFromApproval(
    'EMB-2026-0101',
    { ...QUOTATION, modal: 'AEREO', tipo_embarque: 'FCL' },
    PROPOSAL,
    AT,
  );
  assert.equal(aereo.data.modal, 'AEREO');
  assert.equal(aereo.data.tipoEmbarque, '', 'FCL nao existe fora do maritimo');

  const estranho = shipmentFromApproval(
    'EMB-2026-0101',
    { ...QUOTATION, modal: 'TELETRANSPORTE' },
    PROPOSAL,
    AT,
  );
  assert.equal(estranho.data.modal, '');
});

test('cotacao sem PO nao inventa um numero de PO', () => {
  const s = shipmentFromApproval(
    'EMB-2026-0101',
    { ...QUOTATION, client_reference: null },
    PROPOSAL,
    AT,
  );
  assert.deepEqual(s.data.poNumbers, []);
  assert.equal(s.data.clientRef, '');
});

test('proposta sem agente nao inventa um nome', () => {
  const s = shipmentFromApproval(
    'EMB-2026-0101',
    QUOTATION,
    { id: 'p1', agent: null },
    AT,
  );
  assert.equal(s.data.agentName, '');
});

test('o historico conta a jornada inteira num instante so', () => {
  assert.deepEqual(
    built().history.map((e) => e.kind),
    ['created', 'submitted', 'validated', 'quotation_linked'],
  );
});

test('A ROTA NAO E FABRICADA: o vinculo manda a tela resolver pela cotacao', () => {
  const [row] = mergePoShipments([], { s1: built() });
  assert.equal(row.quotation_id, 'cot-1');
  assert.equal(row.review_status?.hasQuotation, true);
  // `null` = "resolva como sempre resolve", e a resolucao normal usa a cotacao.
  assert.equal(poRouteLabel(row), null);
});

test('o embarque chega a carteira, com agente e mercadoria', () => {
  const [row] = mergePoShipments([], { s1: built() });
  assert.equal(row.estado, 'solicitado');
  assert.equal(row.review_status?.stage, 'active');
  assert.equal(row.agente_nome, 'Alpha Cargo');
  assert.equal(row.review_status?.title, 'Motores elétricos');
  assert.equal(row.client_reference, 'PO-2026-1183');
});

test('o id do overlay e estavel: aprovar duas vezes nao cria dois embarques', () => {
  assert.equal(approvalShipmentId('cot-1'), approvalShipmentId('cot-1'));
  assert.notEqual(approvalShipmentId('cot-1'), approvalShipmentId('cot-2'));
});

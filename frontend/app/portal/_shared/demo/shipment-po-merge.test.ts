// Unit test do merge do overlay de PO na carteira. Mesmo runner:
//
//     npm run test:unit
//
// O QUE ERRA EM SILENCIO AQUI:
//
//   1. Rascunho aparecendo na carteira. Seria um embarque que a Freitas nunca
//      viu, misturado com os que ela acompanha.
//   2. Origem FABRICADA. `routePartsOf` inventa um porto a partir da
//      referencia quando nao ha cotacao — e para um embarque em analise isso
//      seria inventar justamente o dado que a revisao existe para estabelecer.
//   3. A carteira mudando quando NAO ha overlay. E o que mantem a Onda 1
//      intacta.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PO_UNDEFINED_ROUTE,
  countShipmentsInPoReview,
  hidesRoute,
  mergePoShipments,
  poRouteLabel,
  poShipmentFrom,
  shipmentsInPoReview,
  type PortalShipmentWithReview,
} from './shipment-po-merge.ts';
import {
  createDraft,
  linkQuotation,
  returnToClient,
  saveDraft,
  submitToFreitas,
  validate,
  type ShipmentPoStore,
} from './shipment-po-review.ts';
import type { PortalShipment } from '../../../../types/portal-shipment.ts';

const T0 = '2026-09-24T10:00:00.000Z';
const T1 = '2026-09-24T11:00:00.000Z';
const T2 = '2026-09-24T12:00:00.000Z';

const apiShipment = (id: string, referencia: string): PortalShipment => ({
  id,
  referencia,
  client_reference: null,
  estado: 'embarcado',
  incoterm: 'FOB',
  modal: 'MARITIMO',
  tipo_embarque: 'FCL',
  tipo_despacho: 'DIRETO',
  carga_urgente: false,
  agente_nome: 'Agente Alpha',
  quotation_id: 'cot-1',
  created_at: '2026-09-01T10:00:00.000Z',
  updated_at: null,
});

const base = (reference = 'EMB-2026-0101') =>
  saveDraft(
    createDraft(reference, 'po', T0),
    { poNumbers: ['PO-2026-1183'], clientRef: 'SENSE-0924', modal: 'MARITIMO' },
    T0,
  );

const inReview = () => submitToFreitas(base(), T1);

test('SEM overlay a carteira e exatamente a mesma', () => {
  const rows = [apiShipment('s1', 'EMB-2026-0001')];
  assert.deepEqual(mergePoShipments(rows, {}), rows);
});

test('o RASCUNHO nao entra na carteira', () => {
  const store: ShipmentPoStore = { po1: base() };
  assert.deepEqual(mergePoShipments([], store), []);
});

test('o embarque em analise entra, como "solicitado" + review_status', () => {
  const merged = mergePoShipments([], { po1: inReview() });
  assert.equal(merged.length, 1);
  // O union fechado de EmbarqueEstado NAO ganhou valor novo.
  assert.equal(merged[0].estado, 'solicitado');
  assert.equal(merged[0].review_status?.stage, 'awaiting_review');
  assert.equal(merged[0].referencia, 'EMB-2026-0101');
  assert.equal(merged[0].client_reference, 'PO-2026-1183');
  assert.equal(merged[0].review_status?.since, T1);
});

test('nada e fabricado: sem agente, sem tracking, sem cotacao', () => {
  const [row] = mergePoShipments([], { po1: inReview() });
  assert.equal(row.agente_nome, null);
  assert.equal(row.tracking, null);
  assert.equal(row.quotation_id, null);
  assert.equal(row.review_status?.hasQuotation, false);
});

test('a rota fica "A definir" enquanto a Freitas nao reviu', () => {
  const [row] = mergePoShipments([], { po1: inReview() });
  assert.equal(hidesRoute(row), true);
  assert.equal(poRouteLabel(row), PO_UNDEFINED_ROUTE);
});

test('devolvido tambem esconde a rota', () => {
  const store = { po1: returnToClient(inReview(), 'motivo', ['items'], T2) };
  const [row] = mergePoShipments([], store);
  assert.equal(hidesRoute(row), true);
  assert.equal(row.review_status?.returnReason, 'motivo');
  assert.deepEqual(row.review_status?.fieldsToFix, ['items']);
});

test('ATIVO sem cotacao CONTINUA "A definir" — origem nao e fabricada', () => {
  // `routePartsOf` cai no `illustrativeHub`, que deriva um porto da REFERENCIA.
  // Um embarque aberto por PO nao ganha cotacao ao ser validado, entao sem esta
  // regra ele passaria a exibir um porto inventado no instante da ativacao.
  const [row] = mergePoShipments([], { po1: validate(inReview(), T2) });
  assert.equal(hidesRoute(row), false, 'ativo nao esconde mais peso e datas');
  assert.equal(poRouteLabel(row), PO_UNDEFINED_ROUTE);
});

test('ATIVO COM cotacao volta a resolucao normal da tela', () => {
  const linked = linkQuotation(validate(inReview(), T2), 'cot-9', T2);
  const [row] = mergePoShipments([], { po1: linked });
  assert.equal(poRouteLabel(row), null);
});

test('com cotacao vinculada, a tela resolve a rota pela cotacao', () => {
  const linked = linkQuotation(inReview(), 'cot-9', T2);
  const [row] = mergePoShipments([], { po1: linked });
  assert.equal(row.quotation_id, 'cot-9');
  assert.equal(row.review_status?.hasQuotation, true);
  // Em analise, mas COM cotacao: a rota sai da cotacao, nao de "A definir".
  assert.equal(poRouteLabel(row), null);
});

test('o titulo do cartao sai do primeiro item, nao do numero do PO', () => {
  const withItem = saveDraft(
    inReview(),
    {
      items: [
        {
          id: 'i1',
          partNumber: 'SP-4410',
          description: 'Sensor de pressão 0-10 bar',
          currency: 'USD',
          quantity: 1,
          unitValue: 1,
          netWeightKg: 1,
          totalValue: 1,
          grossWeightKg: 1,
        },
      ],
    },
    T2,
  );
  const [row] = mergePoShipments([], { po1: withItem });
  assert.equal(row.review_status?.title, 'Sensor de pressão 0-10 bar');
  // Sem itens, o cartao cai no que a tela ja sabia mostrar.
  const [bare] = mergePoShipments([], { po2: inReview() });
  assert.equal(bare.review_status?.title, null);
});

test('um embarque da API com overlay e ANOTADO, nao duplicado', () => {
  const rows = [apiShipment('s1', 'EMB-2026-0001')];
  const merged = mergePoShipments(rows, { s1: validate(inReview(), T2) });
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 's1');
  assert.equal(merged[0].estado, 'embarcado', 'o estado da API e preservado');
  assert.equal(merged[0].agente_nome, 'Agente Alpha');
  assert.equal(merged[0].review_status?.stage, 'active');
});

test('os criados pelo PO vem primeiro, do mais novo para o mais antigo', () => {
  const older = submitToFreitas(createDraft('EMB-2026-0101', 'po', T0), T1);
  const newer = submitToFreitas(createDraft('EMB-2026-0102', 'po', T1), T2);
  const merged = mergePoShipments([apiShipment('s1', 'EMB-2026-0001')], {
    a: older,
    b: newer,
  });
  assert.deepEqual(
    merged.map((s) => s.referencia),
    ['EMB-2026-0102', 'EMB-2026-0101', 'EMB-2026-0001'],
  );
});

test('o filtro "Em analise" pega revisao e devolvido, nunca ativo', () => {
  const merged = mergePoShipments([apiShipment('s1', 'EMB-2026-0001')], {
    a: inReview(),
    b: returnToClient(submitToFreitas(base('EMB-2026-0102'), T1), 'x', [], T2),
    c: validate(submitToFreitas(base('EMB-2026-0103'), T1), T2),
  });
  assert.equal(countShipmentsInPoReview(merged), 2);
  assert.deepEqual(
    shipmentsInPoReview(merged)
      .map((s) => s.referencia)
      .sort(),
    ['EMB-2026-0101', 'EMB-2026-0102'],
  );
});

test('um embarque comum da API nunca conta como "Em analise"', () => {
  const rows: PortalShipmentWithReview[] = [apiShipment('s1', 'EMB-2026-0001')];
  assert.equal(countShipmentsInPoReview(rows), 0);
  assert.equal(hidesRoute(rows[0]), false);
  assert.equal(poRouteLabel(rows[0]), null);
});

test('poShipmentFrom data o embarque pela CRIACAO, nao pela etapa atual', () => {
  const row = poShipmentFrom('po1', validate(inReview(), T2));
  assert.equal(row.created_at, T0);
  assert.equal(row.updated_at, T2);
});

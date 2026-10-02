import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildShipmentIndicators,
  countShipmentIndicators,
  isShipmentListRecorte,
  SHIPMENT_INDICATOR_KEYS,
  SHIPMENT_INDICATOR_LABELS,
  shipmentsWithPendingDocuments,
} from './shipment-indicators.ts';
import { buildShipmentOverview } from './shipment-overview.ts';
import {
  collectHomeActions,
  type HomeActionsInput,
} from '../../home/lib/home-actions.ts';
import { groupShipmentsByPo } from '../../_shared/demo/po-overview.ts';

const NOW = new Date('2026-09-10T15:00:00Z');
const PORTAL = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const REAL_STEPS: HomeActionsInput['realSteps'] = [
  { key: 'solicitado', label: 'Solicitado', description: '' },
  { key: 'aguardando_prontidao', label: 'Aguardando prontidão', description: '' },
  { key: 'coletado', label: 'Coletado', description: '' },
  { key: 'analise_booking', label: 'Em análise de booking', description: '' },
  { key: 'embarcado', label: 'Embarcado', description: '' },
];

const tracking = (first: string | null, current: string | null, extra = {}) => ({
  first_eta: first,
  current_eta: current,
  eta_is_actual: false,
  data_status: 'COMPLETE',
  last_milestone: null,
  last_milestone_at: null,
  is_mock: true,
  ...extra,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ship = (id: string, po: string, over: Record<string, unknown> = {}): any => ({
  id,
  referencia: `EMB-${id}`,
  client_reference: po,
  estado: 'embarcado',
  modal: 'MARITIMO',
  carga_urgente: false,
  created_at: '2026-08-01T00:00:00Z',
  tracking: tracking('2026-09-20', '2026-09-20'),
  ...over,
});

// Uma carteira com um embarque em cada situação, e sobreposições de propósito.
const CARTEIRA = [
  ship('noprazo', 'PO-1'),
  ship('atrasado', 'PO-1', { tracking: tracking('2026-09-12', '2026-09-18') }),
  ship('chega', 'PO-2', { tracking: tracking('2026-09-13', '2026-09-13') }),
  ship('semeta', 'PO-2', { tracking: null }),
  ship('incompleto', 'PO-3', { tracking: tracking(null, null, { data_status: 'INCOMPLETE' }) }),
  ship('booking', 'PO-3', { estado: 'analise_booking', tracking: null }),
  ship('divergente', 'PO-4', { estado: 'booking_divergente' }),
  ship('postergado', 'PO-4', { estado: 'postergado', tracking: tracking('2026-09-01', '2026-09-03') }),
  ship('chegou', 'PO-5', {
    tracking: tracking('2026-09-05', '2026-09-05', {
      last_milestone: 'ARRIVAL',
      last_milestone_at: '2026-09-05',
    }),
  }),
];

const shipmentActions = () =>
  collectHomeActions({ shipments: CARTEIRA, buckets: {}, realSteps: REAL_STEPS, now: NOW });

test('as cinco definições, sobre uma carteira com um caso de cada', () => {
  const ind = buildShipmentIndicators(CARTEIRA, shipmentActions(), NOW);
  assert.ok(ind.action.has('booking'), 'booking em análise precisa de você');
  assert.ok(ind.action.has('divergente'), 'booking divergente precisa de você');
  // O postergado também está atrasado: indicadores se sobrepõem.
  assert.deepEqual([...ind.delayed].sort(), ['atrasado', 'postergado']);
  assert.deepEqual([...ind.upcoming].sort(), ['chega']);
  assert.deepEqual([...ind.no_forecast].sort(), ['booking', 'incompleto', 'semeta']);
  assert.deepEqual([...ind.exception].sort(), ['divergente', 'postergado']);
});

test('sem previsão nunca é atraso nem chegada próxima; chegou sai dos três', () => {
  const ind = buildShipmentIndicators(CARTEIRA, [], NOW);
  for (const id of ind.no_forecast) {
    assert.equal(ind.delayed.has(id), false);
    assert.equal(ind.upcoming.has(id), false);
  }
  for (const key of ['delayed', 'upcoming', 'no_forecast'] as const)
    assert.equal(ind[key].has('chegou'), false);
});

test('MESMO número em Panorama, lista, Visão por PO e Home', () => {
  // Panorama e lista: `buildShipmentOverview(...).groups`, fila só de embarque.
  const overview = buildShipmentOverview(CARTEIRA, shipmentActions(), NOW).groups;
  // Visão por PO: a faixa conta os embarques da mesma carteira.
  const poStrip = buildShipmentIndicators(CARTEIRA, shipmentActions(), NOW);
  // Home: a fila dela inclui as ações de COTAÇÃO; o indicador de embarque não
  // pode mudar por causa delas.
  const homeActions = collectHomeActions({
    shipments: CARTEIRA,
    buckets: {
      aguardando_aprovacao: [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { id: 'q-1', reference: 'COT-1', state: 'ENVIADA_CLIENTE', created_at: '2026-08-01T00:00:00Z' } as any,
      ],
    },
    realSteps: REAL_STEPS,
    now: NOW,
  });
  assert.ok(homeActions.some((a) => a.module === 'cotacao'));
  const home = buildShipmentIndicators(CARTEIRA, homeActions, NOW);

  const counts = countShipmentIndicators(overview);
  assert.deepEqual(countShipmentIndicators(poStrip), counts);
  assert.deepEqual(countShipmentIndicators(home), counts);
  for (const key of SHIPMENT_INDICATOR_KEYS) assert.ok(key in counts);

  // E o recorte da Visão por PO devolve exatamente os pedidos desses embarques.
  const groups = groupShipmentsByPo(CARTEIRA, { stateLabel: (s) => s.estado });
  for (const key of SHIPMENT_INDICATOR_KEYS) {
    const pos = groups
      .filter((g) => g.shipments.some((s) => poStrip[key].has(s.id)))
      .map((g) => g.po)
      .sort();
    const expected = [
      ...new Set(
        CARTEIRA.filter((s) => overview[key].has(s.id)).map((s) => s.client_reference),
      ),
    ].sort();
    assert.deepEqual(pos, expected, key);
  }
});

test('as quatro telas consomem a fonte única, e as fontes paralelas sumiram', () => {
  const read = (path: string) => readFileSync(resolve(PORTAL, path), 'utf8');
  const screens = {
    Panorama: 'embarques/components/shipment-map-workspace.tsx',
    Lista: 'embarques/components/shipment-list-tab.tsx',
    'Visão por PO': '_shared/demo/po-overview-tab.tsx',
    Home: 'home/components/home-banner.tsx',
  };
  for (const [name, path] of Object.entries(screens)) {
    assert.match(read(path), /<ShipmentIndicatorStrip/, `${name} desenha a faixa única`);
  }
  assert.match(read('home/page.tsx'), /useShipmentIndicators\(/);
  assert.match(read('home/page.tsx'), /useShipmentsWithPo\(/, 'Home usa a mesma carteira de Embarques');
  assert.match(read('_shared/demo/po-overview-tab.tsx'), /useShipmentIndicators\(/);
  assert.doesNotMatch(read('_shared/demo/po-overview.ts'), /PO_FILTER_LABELS|matchesPoFilter/);
  assert.doesNotMatch(read('embarques/components/shipment-map-workspace.tsx'), /panorama-summary|missingEta/);
  assert.doesNotMatch(read('home/components/home-banner.tsx'), /import[^;]*(countBySemaforo|SemaforoChips)/);
});

test('rótulos fixos e recortes da lista', () => {
  assert.deepEqual(Object.values(SHIPMENT_INDICATOR_LABELS), [
    'Precisam de você',
    'Com chegada atrasada',
    'Chegam nos próximos 7 dias',
    'Sem previsão',
    'Com exceção',
  ]);
  assert.equal(isShipmentListRecorte('documentos'), true);
  assert.equal(isShipmentListRecorte('delayed'), true);
  assert.equal(isShipmentListRecorte('alertas'), false);
  assert.equal(isShipmentListRecorte(null), false);
  const docs = shipmentsWithPendingDocuments([
    { module: 'embarque', recordId: 'a', kind: 'documento' },
    { module: 'embarque', recordId: 'b', kind: 'booking' },
    { module: 'cotacao', recordId: 'c', kind: 'documento' },
  ]);
  assert.deepEqual([...docs], ['a']);
});

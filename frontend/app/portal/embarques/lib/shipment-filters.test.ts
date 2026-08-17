// Unit test dos filtros rápidos. Mesmo runner dos outros libs:
//
//     npm run test:unit
//
// O que erra em silêncio aqui: um embarque SEM rastreamento entrando no chip
// "Com atraso". Ele não está no prazo nem atrasado — não se sabe —, e contá-lo
// como atrasado transformaria "Pendente integração" numa acusação. O outro é a
// contagem: o número do chip tem de falar da carteira inteira, senão todo chip
// inativo zera assim que outro é ligado.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SHIPMENT_FILTERS,
  countShipmentFilters,
  filterShipments,
} from './shipment-filters.ts';

const tracking = (overrides = {}) => ({
  first_eta: null,
  current_eta: null,
  eta_is_actual: null,
  data_status: null,
  last_milestone: null,
  last_milestone_at: null,
  is_mock: true,
  ...overrides,
});

const COMPLETE = (firstEta, currentEta) =>
  tracking({ data_status: 'COMPLETE', first_eta: firstEta, current_eta: currentEta });

const shipment = (id, overrides = {}) => ({
  id,
  referencia: `EMB-2026-${id}`,
  estado: 'embarcado',
  carga_urgente: false,
  tracking: null,
  ...overrides,
});

// Carteira de teste, montada para cobrir cada predicado e as sobreposições
// (um embarque pode ser urgente E atrasado).
const SEM_TRACKING = shipment('0001');
const NO_PRAZO = shipment('0002', {
  tracking: COMPLETE('2026-08-20T00:00:00Z', '2026-08-20T00:00:00Z'),
});
const ATENCAO = shipment('0003', {
  tracking: COMPLETE('2026-08-20T00:00:00Z', '2026-08-22T00:00:00Z'),
});
const ATRASADO_URGENTE = shipment('0004', {
  carga_urgente: true,
  tracking: COMPLETE('2026-08-20T00:00:00Z', '2026-08-27T00:00:00Z'),
});
const POSTERGADO = shipment('0005', { estado: 'postergado' });
const BOOKING_DIVERGENTE = shipment('0006', { estado: 'booking_divergente' });
const INCOMPLETO = shipment('0007', {
  estado: 'coletado',
  tracking: tracking({ data_status: 'INCOMPLETE' }),
});

const CARTEIRA = [
  SEM_TRACKING,
  NO_PRAZO,
  ATENCAO,
  ATRASADO_URGENTE,
  POSTERGADO,
  BOOKING_DIVERGENTE,
  INCOMPLETO,
];

const refs = (list) => list.map((s) => s.id).sort();

test('"Com atraso" pega atenção e atraso, e só quem tem as duas previsões', () => {
  const visible = filterShipments(CARTEIRA, 'atraso');
  assert.deepEqual(refs(visible), ['0003', '0004']);

  // As três formas de não ter número não entram: sem rastreamento, no prazo e
  // a companhia calada.
  [SEM_TRACKING, NO_PRAZO, INCOMPLETO].forEach((s) =>
    assert.equal(visible.includes(s), false, `${s.id} não deveria aparecer`),
  );
});

test('"Com exceção" é estado do GE, não risco de atraso', () => {
  assert.deepEqual(refs(filterShipments(CARTEIRA, 'excecao')), ['0005', '0006']);
});

test('"Urgentes" é bandeira do cliente e convive com atraso', () => {
  const urgentes = filterShipments(CARTEIRA, 'urgentes');
  assert.deepEqual(refs(urgentes), ['0004']);
  // O mesmo embarque aparece nos dois chips — os recortes não são exclusivos.
  assert.ok(filterShipments(CARTEIRA, 'atraso').includes(ATRASADO_URGENTE));
});

test('"Embarcados" é o estado real de partida, não o milestone de trânsito', () => {
  const embarcados = filterShipments(CARTEIRA, 'embarcados');
  assert.deepEqual(refs(embarcados), ['0001', '0002', '0003', '0004']);
  // `coletado` e os estados de exceção ficam de fora.
  assert.equal(embarcados.includes(INCOMPLETO), false);
  assert.equal(embarcados.includes(POSTERGADO), false);
});

test('sem filtro nada é escondido — e é a MESMA lista, para não remontar o mapa', () => {
  assert.equal(filterShipments(CARTEIRA, null), CARTEIRA);
});

test('chave desconhecida não esvazia a tela', () => {
  assert.equal(filterShipments(CARTEIRA, 'inexistente'), CARTEIRA);
});

test('a contagem fala da carteira inteira, não do recorte já filtrado', () => {
  const counts = countShipmentFilters(CARTEIRA);
  const byKey = Object.fromEntries(counts.map((c) => [c.key, c.count]));
  assert.deepEqual(byKey, { urgentes: 1, embarcados: 4, atraso: 2, excecao: 2 });
  assert.equal(counts.length, SHIPMENT_FILTERS.length);
});

test('o Mapa pede três chips e recebe três, na ordem canônica', () => {
  const counts = countShipmentFilters(CARTEIRA, ['atraso', 'excecao', 'urgentes']);
  // A ordem é a de SHIPMENT_FILTERS, não a do argumento: as duas telas mostram
  // os chips na mesma sequência.
  assert.deepEqual(
    counts.map((c) => c.key),
    ['urgentes', 'atraso', 'excecao'],
  );
});

test('chip zerado é contado, não omitido — quem esconde é a tela', () => {
  const semExcecao = [NO_PRAZO, ATENCAO];
  const counts = countShipmentFilters(semExcecao, ['excecao']);
  assert.equal(counts.length, 1);
  assert.equal(counts[0].count, 0);
  // E filtrá-lo devolve vazio, que é o que dispara o estado vazio do Mapa.
  assert.deepEqual(filterShipments(semExcecao, 'excecao'), []);
});

test('carteira vazia não quebra nem inventa chip', () => {
  assert.deepEqual(filterShipments([], 'atraso'), []);
  countShipmentFilters([]).forEach((c) => assert.equal(c.count, 0));
});

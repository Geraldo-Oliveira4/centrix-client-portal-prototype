// Unit test da notificação de preço. Mesmo runner dos outros libs:
//
//     npm run test:unit
//
// O que erra em silêncio aqui, e por isso está coberto:
//
//   - o alerta virar "oportunidade" numa rota que o Radar classificou como
//     `atencao`: o cliente cotaria acreditando numa janela que o próprio card
//     do Radar não promete, e as duas telas se contradiriam;
//   - o texto do alerta divergir do texto do card — duas explicações para o
//     mesmo número, que é o problema que já custou o KPI de Economia;
//   - o id passar a depender da data: cada visita ressuscitaria a notificação
//     como não lida, e "marcar como lida" viraria botão decorativo.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_PER_PRICE_TYPE,
  RADAR_HREF,
  buildPriceAlerts,
} from './price-alerts.ts';
import { buildPriceAlert } from '../../inteligencia/lib/price-radar.ts';

const OBSERVED_AT = '2026-08-18T12:00:00Z';

// Rota no formato que `computePriceRadar` devolve. O alerta é construído a
// partir da CLASSIFICAÇÃO real (`buildPriceAlert`), não de um rótulo digitado
// aqui: assim o teste falha se a regra do Radar mudar sem o alerta acompanhar.
const route = (origin, destination, variationPct, trendPct) => ({
  id: `${origin}>${destination}`,
  origin,
  destination,
  modal: 'MARITIMO',
  shipments: 2,
  currency: 'USD',
  currentPrice: 3000,
  unit: "contêiner 40'",
  historicalAvg: 3400,
  historicalWindowDays: 90,
  variationPct,
  trendPct,
  trendWindowDays: 14,
  alert: buildPriceAlert({ variationPct, trendPct }),
});

const OPORTUNIDADE = route('Gênova', 'Santos', -18, -2);
const OPORTUNIDADE_MENOR = route('Izmir', 'Santos', -9, 0);
const ALTA = route('Shanghai', 'Santos', 30, 12);
const ATENCAO = route('Hamburgo', 'Santos', 4, 3);

test('só os dois extremos viram notificação — "atenção" não avisa nada', () => {
  const alerts = buildPriceAlerts({
    routes: [OPORTUNIDADE, ALTA, ATENCAO],
    observedAt: OBSERVED_AT,
  });
  assert.deepEqual(
    alerts.map((a) => a.subject),
    ['Gênova → Santos', 'Shanghai → Santos'],
  );
  alerts.forEach((a) => assert.equal(a.type, 'preco'));
});

test('a oportunidade é verde e a alta é vermelha, como no card do Radar', () => {
  const [oportunidade, alta] = buildPriceAlerts({
    routes: [OPORTUNIDADE, ALTA],
    observedAt: OBSERVED_AT,
  });
  assert.equal(oportunidade.tone, 'success');
  assert.equal(alta.tone, 'danger');
});

test('título e texto saem do MESMO alerta que o card do Radar imprime', () => {
  const [alerta] = buildPriceAlerts({
    routes: [OPORTUNIDADE],
    observedAt: OBSERVED_AT,
  });
  assert.equal(alerta.title, 'Oportunidade de preço — Gênova → Santos');
  assert.equal(alerta.description, OPORTUNIDADE.alert.rationale);
  // O número do texto é o da rota, não um segundo cálculo.
  assert.match(alerta.description, /18% abaixo da média/);
});

test('a notificação leva de volta ao Radar, e não a um embarque', () => {
  const [alerta] = buildPriceAlerts({
    routes: [ALTA],
    observedAt: OBSERVED_AT,
  });
  assert.equal(alerta.link.href, RADAR_HREF);
  assert.equal(alerta.link.label, 'Ver no Radar de Preços');
  // Sem embarque: o alerta é da rota. É o que faz o filtro do Mapa deixá-lo de
  // fora em vez de o pendurar num embarque qualquer.
  assert.equal(alerta.shipmentId, undefined);
});

test('o id é estável e não carrega a data — senão o "já li" nunca gruda', () => {
  const primeira = buildPriceAlerts({ routes: [OPORTUNIDADE], observedAt: OBSERVED_AT });
  const depois = buildPriceAlerts({
    routes: [OPORTUNIDADE],
    observedAt: '2026-09-01T08:00:00Z',
  });
  assert.equal(primeira[0].id, 'radar:Gênova>Santos');
  assert.equal(primeira[0].id, depois[0].id);
  // A data muda só o carimbo mostrado.
  assert.equal(depois[0].timestamp, '2026-09-01T08:00:00Z');
});

test('uma rota de cada extremo, a mais forte — o feed é cutucada, não catálogo', () => {
  const alerts = buildPriceAlerts({
    routes: [OPORTUNIDADE_MENOR, OPORTUNIDADE, ALTA],
    observedAt: OBSERVED_AT,
  });
  assert.equal(alerts.length, 2 * MAX_PER_PRICE_TYPE);
  // Entre duas oportunidades, a de maior desconto (-18% vence -9%).
  assert.equal(alerts[0].subject, 'Gênova → Santos');
});

test('carteira sem extremo nenhum não inventa notificação', () => {
  assert.deepEqual(buildPriceAlerts({ routes: [ATENCAO], observedAt: OBSERVED_AT }), []);
  assert.deepEqual(buildPriceAlerts({ routes: [], observedAt: OBSERVED_AT }), []);
});

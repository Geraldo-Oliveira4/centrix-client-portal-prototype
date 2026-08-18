// Unit test do Radar de Preços. Mesmo runner dos outros libs:
//
//     npm run test:unit
//
// Três coisas aqui erram sem estourar:
//
//  1. a classificação do alerta — um preço 30% acima da média pintado de verde
//     manda o cliente cotar no pior momento possível, que é o oposto exato do
//     que a aba promete;
//  2. a aritmética entre preço atual, média e variação — os três números são
//     impressos lado a lado no card, e o cliente refaz a conta de cabeça;
//  3. os rótulos de porto do CTA "Cotar agora" — um valor que não existe nas
//     opções do formulário abre a Nova Cotação com o campo vazio, sem erro
//     nenhum na tela.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ANOMALY_ABOVE_PCT,
  OPPORTUNITY_BELOW_PCT,
  ORIGIN_PARAM,
  QUOTATION_DESTINATION_OPTION,
  QUOTATION_PORT_OPTION,
  RADAR_ORIGIN,
  SHARP_RISE_PCT,
  buildPriceAlert,
  classifyPriceAlert,
  computePriceRadar,
  quotationPrefillParams,
  radarOriginFields,
} from './price-radar.ts';
import {
  PORTS_DEPARTURE_OPTIONS,
  PORTS_DESTINATION_OPTIONS,
} from '../../../../constants/ports.ts';

const shipment = (n, overrides = {}) => ({
  id: `id-${n}`,
  referencia: `EMB-2026-${String(n).padStart(4, '0')}`,
  estado: 'embarcado',
  modal: 'MARITIMO',
  quotation_id: null,
  carga_urgente: false,
  tracking: null,
  ...overrides,
});

// --- Classificação -----------------------------------------------------------

test('preço muito acima da média é ALTA mesmo tendo parado de subir', () => {
  // O custo já está no patamar: "parou de subir esta semana" não o desfaz.
  assert.equal(
    classifyPriceAlert({ variationPct: ANOMALY_ABOVE_PCT + 5, trendPct: 0 }),
    'alta',
  );
  assert.equal(classifyPriceAlert({ variationPct: 30, trendPct: -8 }), 'alta');
});

test('subida forte agora é ALTA mesmo com o preço ainda abaixo da média', () => {
  assert.equal(
    classifyPriceAlert({ variationPct: -12, trendPct: SHARP_RISE_PCT + 1 }),
    'alta',
  );
});

test('OPORTUNIDADE exige estar abaixo da média E estável', () => {
  assert.equal(
    classifyPriceAlert({ variationPct: -OPPORTUNITY_BELOW_PCT, trendPct: 2 }),
    'oportunidade',
  );
  // Abaixo da média, mas a janela está fechando: não é oportunidade.
  assert.equal(classifyPriceAlert({ variationPct: -20, trendPct: 9 }), 'atencao');
  // Estável, mas sem desconto relevante: também não é.
  assert.equal(classifyPriceAlert({ variationPct: -3, trendPct: 0 }), 'atencao');
});

test('o resto é ATENÇÃO — oscilação sem direção que justifique agir', () => {
  assert.equal(classifyPriceAlert({ variationPct: 0, trendPct: 0 }), 'atencao');
  assert.equal(classifyPriceAlert({ variationPct: 12, trendPct: 4 }), 'atencao');
});

test('o alerta carrega rótulo e uma frase de ação, nunca só a cor', () => {
  const alert = buildPriceAlert({ variationPct: -14, trendPct: 1 });
  assert.equal(alert.type, 'oportunidade');
  assert.equal(alert.label, 'Oportunidade');
  assert.match(alert.rationale, /14% abaixo/);

  const anomaly = buildPriceAlert({ variationPct: 31, trendPct: 2 });
  assert.match(anomaly.rationale, /atípico/);

  // Alta por tendência fala da tendência, não do patamar.
  const rising = buildPriceAlert({ variationPct: 4, trendPct: 18 });
  assert.match(rising.rationale, /18%/);
});

// --- Agregação ---------------------------------------------------------------

test('as rotas saem dos embarques, ordenadas pela frequência real', () => {
  // Os hubs ilustrativos são estáveis por referência, então EMB-...0001 e
  // EMB-...0011 caem no mesmo hub (rodízio de 10).
  const routes = computePriceRadar({
    shipments: [shipment(1), shipment(11), shipment(2)],
    quotations: [],
  });
  assert.equal(routes[0].shipments, 2, 'a rota repetida vem primeiro');
  assert.equal(routes[1].shipments, 1);
  assert.equal(routes.length, 2);
});

test('a rota da cotação tem prioridade sobre o hub ilustrativo', () => {
  const routes = computePriceRadar({
    shipments: [shipment(1, { quotation_id: 'q1' })],
    quotations: [
      { id: 'q1', origin: 'Ningbo, China', porto_destino: ['Santos'] },
    ],
  });
  assert.equal(routes[0].origin, 'Ningbo');
  assert.equal(routes[0].destination, 'Santos');
});

test('preço atual, média e variação fecham a conta impressa no card', () => {
  const [route] = computePriceRadar({ shipments: [shipment(1)], quotations: [] });
  const expected = route.historicalAvg * (1 + route.variationPct / 100);
  assert.ok(
    Math.abs(route.currentPrice - expected) <= 1,
    `${route.currentPrice} não bate com ${expected}`,
  );
  assert.equal(route.currency, 'USD');
  assert.ok(route.unit.length > 0, 'preço sem unidade não é comparável');
  assert.equal(route.alert.type, classifyPriceAlert(route));
});

test('mesma rota, mesmos números — nada é sorteado em tempo de render', () => {
  const a = computePriceRadar({ shipments: [shipment(1)], quotations: [] })[0];
  const b = computePriceRadar({ shipments: [shipment(1)], quotations: [] })[0];
  assert.deepEqual(a, b);

  // E o preço é da LANE: mover mais carga na mesma rota não muda o mercado.
  const busy = computePriceRadar({
    shipments: [shipment(1), shipment(11)],
    quotations: [],
  })[0];
  assert.equal(busy.currentPrice, a.currentPrice);
  assert.equal(busy.shipments, 2);
});

test('o modal predominante define a unidade de cotação', () => {
  const [aereo] = computePriceRadar({
    shipments: [shipment(1, { modal: 'AEREO' })],
    quotations: [],
  });
  assert.equal(aereo.modal, 'AEREO');
  assert.equal(aereo.unit, 'kg');
  // Frete aéreo por quilo não pode sair na ordem de grandeza do contêiner.
  assert.ok(aereo.currentPrice < 100, `${aereo.currentPrice} parece preço de contêiner`);
});

test('o radar corta em poucas rotas — é foco, não catálogo', () => {
  const many = Array.from({ length: 10 }, (_, i) => shipment(i + 1));
  assert.equal(computePriceRadar({ shipments: many, quotations: [] }).length, 6);
  assert.equal(
    computePriceRadar({ shipments: many, quotations: [], limit: 3 }).length,
    3,
  );
});

test('sem embarque, o radar é vazio — não inventa rota para preencher a tela', () => {
  assert.deepEqual(computePriceRadar({ shipments: [], quotations: [] }), []);
});

// --- Deep link ---------------------------------------------------------------

test('todo porto mapeado existe nas opções reais do formulário', () => {
  const departure = new Set(PORTS_DEPARTURE_OPTIONS.map((o) => o.value));
  Object.entries(QUOTATION_PORT_OPTION).forEach(([city, option]) => {
    assert.ok(departure.has(option), `${city}: "${option}" não é opção de embarque`);
  });

  const destination = new Set(PORTS_DESTINATION_OPTIONS.map((o) => o.value));
  Object.entries(QUOTATION_DESTINATION_OPTION).forEach(([city, option]) => {
    assert.ok(destination.has(option), `${city}: "${option}" não é opção de destino`);
  });
});

test('o CTA leva modal, portos e o rótulo da rota', () => {
  const params = quotationPrefillParams({
    id: 'Shanghai>Santos',
    origin: 'Shanghai',
    destination: 'Santos',
    modal: 'MARITIMO',
  });
  assert.equal(params.get('modal'), 'MARITIMO');
  assert.equal(params.get('porto_embarque'), 'Shanghai, China (CNSHA)');
  assert.equal(params.get('porto_destino'), 'Santos, Brazil (BRSSZ)');
  assert.equal(params.get('rota'), 'Shanghai → Santos');
});

// --- Rastreabilidade de origem ----------------------------------------------
//
// O clique no CTA é o único momento em que se sabe que a cotação nasceu do
// Radar. Se o rastro se perder aqui, ele não se recupera depois — e a pergunta
// que decide o futuro do Radar ("quantas cotações ele gerou?") fica sem
// resposta, sem nada na tela indicando que algo quebrou.

test('o CTA carrega a origem, e a criação lê exatamente o que ele escreveu', () => {
  const params = quotationPrefillParams({
    id: 'Gênova>Santos',
    origin: 'Gênova',
    destination: 'Santos',
    modal: 'MARITIMO',
  });
  assert.equal(params.get(ORIGIN_PARAM), RADAR_ORIGIN);

  // A volta: é este objeto que entra no POST /portal/quotations.
  assert.deepEqual(
    radarOriginFields(params.get(ORIGIN_PARAM), params.get('rota')),
    { portal_origin: 'radar_precos', portal_origin_route: 'Gênova → Santos' },
  );
});

test('origem desconhecida na URL não inaugura categoria de origem', () => {
  assert.equal(radarOriginFields('campanha_inventada', 'Gênova → Santos'), null);
  assert.equal(radarOriginFields(null, 'Gênova → Santos'), null);
});

test('sem rótulo de rota a origem continua contando', () => {
  // Porto que o formulário não conhece deixa o pré-preenchimento incompleto —
  // mas o clique continua tendo vindo do Radar, e continua sendo contado.
  assert.deepEqual(radarOriginFields(RADAR_ORIGIN, null), {
    portal_origin: 'radar_precos',
  });
});

test('porto sem mapeamento não quebra o CTA — leva o que sabe', () => {
  const params = quotationPrefillParams({
    id: 'Porto Novo>Brasil',
    origin: 'Porto Novo',
    destination: 'Brasil',
    modal: 'MARITIMO',
  });
  assert.equal(params.get('modal'), 'MARITIMO');
  assert.equal(params.get('porto_embarque'), null);
  assert.equal(params.get('porto_destino'), null);
  assert.equal(params.get('rota'), 'Porto Novo → Brasil');
});

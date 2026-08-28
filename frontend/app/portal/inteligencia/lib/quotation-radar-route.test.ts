// Unit test da ponte cotação -> rota do Radar. Mesmo runner dos outros libs:
//
//     npm run test:unit
//
// Duas coisas aqui erram sem estourar, e as duas são silenciosas:
//
//  1. a chave da rota divergir da que `computePriceRadar` produziu — a busca
//     passa a não achar NADA e o bloco "Mercado" mostra o estado vazio para
//     sempre, sem erro nenhum na tela;
//  2. a normalização do destino ("Brasil" -> porto de chegada) sumir — como a
//     maioria das cotações não nomeia um porto de destino único, seria
//     justamente o caso mais comum a falhar.

import test from 'node:test';
import assert from 'node:assert/strict';

import { computePriceRadar } from './price-radar.ts';
import {
  findQuotationRadarRoute,
  quotationRadarRoute,
} from './quotation-radar-route.ts';

const quotation = (overrides = {}) => ({
  id: 'q-1',
  reference: 'COT-2026-0001',
  state: 'FECHADA',
  modal: 'MARITIMO',
  origin: 'Shanghai, China',
  porto_destino: null,
  aeroporto_destino: null,
  proposals: [],
  ...overrides,
});

const shipment = (n, quotationId = null) => ({
  id: `id-${n}`,
  referencia: `EMB-2026-${String(n).padStart(4, '0')}`,
  estado: 'embarcado',
  modal: 'MARITIMO',
  quotation_id: quotationId,
  carga_urgente: false,
  tracking: null,
});

// --- Adaptação ---------------------------------------------------------------

test('a origem perde o país e o destino não nomeado vira o porto de chegada', () => {
  // "Shanghai, China" é como o seed guarda; "Brasil" é o que a resolução de rota
  // devolve quando `porto_destino` é lista vazia ou com mais de um candidato.
  const route = quotationRadarRoute(quotation());
  assert.equal(route.id, 'Shanghai>Santos');
  assert.equal(route.label, 'Shanghai → Santos');
});

test('destino nomeado uma única vez é preservado como está', () => {
  const route = quotationRadarRoute(
    quotation({ porto_destino: ['Paranaguá'] }),
  );
  assert.equal(route.id, 'Shanghai>Paranaguá');
  assert.equal(route.label, 'Shanghai → Paranaguá');
});

test('dois portos candidatos caem no destino padrão, sem escolher um deles', () => {
  // Escolher o primeiro inventaria um destino que talvez não seja o da carga.
  const route = quotationRadarRoute(
    quotation({ porto_destino: ['Santos', 'Itajaí'] }),
  );
  assert.equal(route.id, 'Shanghai>Santos');
});

test('cotação sem origem devolve null nos dois campos, sem hub ilustrativo', () => {
  // O fallback por referência é do EMBARQUE. Aplicá-lo aqui nomearia uma rota
  // que a cotação não nomeia.
  assert.deepEqual(quotationRadarRoute(quotation({ origin: '   ' })), {
    id: null,
    label: null,
  });
  assert.deepEqual(quotationRadarRoute(undefined), { id: null, label: null });
});

// --- Busca no Radar ----------------------------------------------------------

test('a chave da cotação acha a rota que o Radar montou pelos embarques', () => {
  // Este é o teste que sustenta o bloco inteiro: as duas pontas (embarque e
  // cotação) têm de produzir a MESMA chave.
  const q = quotation();
  const routes = computePriceRadar({
    shipments: [shipment(1, q.id), shipment(2, q.id)],
    quotations: [q],
  });

  const found = findQuotationRadarRoute(q, routes);
  assert.ok(found, 'a rota da cotação deveria estar no radar');
  assert.equal(found.id, 'Shanghai>Santos');
  assert.equal(found.shipments, 2);
  // O alerta vem pronto do radar — nada é reclassificado na adaptação.
  assert.ok(['oportunidade', 'atencao', 'alta'].includes(found.alert.type));
});

test('rota sem embarque nenhum devolve null em vez de estourar', () => {
  // O estado vazio amigável do bloco "Mercado" depende deste null.
  const q = quotation();
  const outra = quotation({ id: 'q-2', origin: 'Hamburgo, Alemanha' });
  const routes = computePriceRadar({
    shipments: [shipment(1, q.id)],
    quotations: [q, outra],
  });

  assert.equal(findQuotationRadarRoute(outra, routes), null);
  // E a rota continua nomeável, que é o que o estado vazio imprime.
  assert.equal(quotationRadarRoute(outra).label, 'Hamburgo → Santos');
});

test('radar vazio devolve null para qualquer cotação', () => {
  assert.equal(findQuotationRadarRoute(quotation(), []), null);
});

test('cotação sem origem não casa com rota nenhuma', () => {
  const q = quotation();
  const routes = computePriceRadar({
    shipments: [shipment(1, q.id)],
    quotations: [q],
  });
  assert.ok(routes.length > 0);
  assert.equal(findQuotationRadarRoute(quotation({ origin: null }), routes), null);
});

test('rota fora do corte do radar cai no estado vazio, pelo mesmo critério', () => {
  // O radar é foco, não catálogo: `limit` corta as rotas menos frequentes. Uma
  // rota cortada NÃO pode aparecer aqui, senão o "Ver no Radar de Preços"
  // levaria o cliente a uma tela sem a rota que ele acabou de ler.
  const frequente = quotation({ id: 'q-frequente', origin: 'Shanghai, China' });
  const rara = quotation({ id: 'q-rara', origin: 'Izmir, Turquia' });
  const routes = computePriceRadar({
    shipments: [
      shipment(1, frequente.id),
      shipment(2, frequente.id),
      shipment(3, rara.id),
    ],
    quotations: [frequente, rara],
    limit: 1,
  });

  assert.equal(routes.length, 1);
  assert.ok(findQuotationRadarRoute(frequente, routes));
  assert.equal(findQuotationRadarRoute(rara, routes), null);
});

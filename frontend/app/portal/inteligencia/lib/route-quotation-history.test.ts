// Unit test do histórico de cotações na rota. Mesmo runner dos outros libs:
//
//     npm run test:unit
//
// O que erra em silêncio aqui, e por isso está coberto:
//
//  1. a rota deixar de ser comparada pela chave NORMALIZADA — cotações sem
//     porto de destino nomeado (a maioria) parariam de casar entre si e o bloco
//     diria "sem histórico" para um cliente que tem vários fechamentos na rota;
//  2. a cotação aberta na tela entrar na própria lista, que a faria servir de
//     referência para si mesma;
//  3. o singular/plural da frase, que é o único texto do bloco e muda com uma
//     cotação a mais.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ROUTE_HISTORY_WINDOW,
  findRouteQuotationHistory,
} from './route-quotation-history.ts';

const quotation = (overrides = {}) => ({
  id: 'q-atual',
  reference: 'COT-2026-0100',
  state: 'ENVIADA_CLIENTE',
  modal: 'MARITIMO',
  origin: 'Rotterdam, Netherlands',
  porto_destino: null,
  aeroporto_destino: null,
  closed_at: null,
  updated_at: null,
  created_at: '2026-08-01T00:00:00Z',
  proposals: [],
  ...overrides,
});

/** Uma cotação FECHADA com valor, que é o que a lista mostra. */
const closed = (n, overrides = {}) =>
  quotation({
    id: `q-${n}`,
    reference: `COT-2026-${String(n).padStart(4, '0')}`,
    state: 'FECHADA',
    closed_at: `2026-0${n}-10T00:00:00Z`,
    best_proposal: { total_brl: n * 1000 },
    ...overrides,
  });

// --- Encontrou histórico -----------------------------------------------------

test('lista as fechadas da mesma rota, mais recente primeiro', () => {
  const history = findRouteQuotationHistory({
    quotation: quotation(),
    quotations: [closed(1), closed(3), closed(2)],
  });

  assert.ok(history);
  assert.deepEqual(
    history.items.map((i) => i.reference),
    ['COT-2026-0003', 'COT-2026-0002', 'COT-2026-0001'],
  );
  assert.equal(history.items[0].valueBRL, 3000);
  assert.equal(history.total, 3);
});

test('a rota casa pela chave normalizada, não pelo texto do campo', () => {
  // A cotação aberta não nomeia o porto de destino (vira "Brasil" -> Santos); a
  // anterior nomeia "Santos" explicitamente. É a MESMA rota, e comparar os
  // campos crus as separaria.
  const history = findRouteQuotationHistory({
    quotation: quotation({ porto_destino: null }),
    quotations: [closed(1, { porto_destino: ['Santos'] })],
  });

  assert.ok(history);
  assert.equal(history.total, 1);
});

test('rota diferente não entra, nem por origem nem por destino', () => {
  const outraOrigem = closed(1, { origin: 'Shanghai, China' });
  const outroDestino = closed(2, { porto_destino: ['Paranaguá'] });

  assert.equal(
    findRouteQuotationHistory({
      quotation: quotation(),
      quotations: [outraOrigem, outroDestino],
    }),
    null,
  );
});

test('a cotação aberta na tela nunca entra na própria lista', () => {
  // Mesma rota, FECHADA e com valor: só o id a exclui.
  const atual = closed(4, { id: 'q-atual', reference: 'COT-2026-0100' });

  assert.equal(
    findRouteQuotationHistory({ quotation: atual, quotations: [atual] }),
    null,
  );
});

// --- Singular, plural e o corte ---------------------------------------------

test('uma única cotação anterior fala no singular, sem número', () => {
  const history = findRouteQuotationHistory({
    quotation: quotation(),
    quotations: [closed(1)],
  });

  assert.ok(history);
  assert.equal(history.total, 1);
  assert.equal(history.headline, 'Você já fechou uma cotação nesta rota.');
});

test('duas ou mais falam no plural, com o número', () => {
  const history = findRouteQuotationHistory({
    quotation: quotation(),
    quotations: [closed(1), closed(2)],
  });

  assert.ok(history);
  assert.equal(history.headline, 'Você já fechou 2 cotações nesta rota.');
});

test('acima da janela o corte é declarado, e o total continua o real', () => {
  const many = [1, 2, 3, 4, 5].map((n) => closed(n));
  const history = findRouteQuotationHistory({
    quotation: quotation(),
    quotations: many,
  });

  assert.ok(history);
  assert.equal(history.total, 5);
  assert.equal(history.items.length, ROUTE_HISTORY_WINDOW);
  assert.equal(
    history.headline,
    'Você já fechou 5 cotações nesta rota. Abaixo, as 3 mais recentes.',
  );
});

// --- Sem histórico: null, para o bloco manter a frase de ausência ------------

test('cliente sem nenhuma cotação anterior na rota devolve null', () => {
  assert.equal(
    findRouteQuotationHistory({ quotation: quotation(), quotations: [] }),
    null,
  );
});

test('cotação não fechada não conta como histórico', () => {
  // COTANDO na mesma rota ainda não tem preço fechado para servir de referência.
  const emAndamento = closed(1, { state: 'COTANDO' });

  assert.equal(
    findRouteQuotationHistory({
      quotation: quotation(),
      quotations: [emAndamento],
    }),
    null,
  );
});

test('fechada sem valor fica de fora, em vez de entrar como R$ 0,00', () => {
  const semValor = closed(1, { best_proposal: { total_brl: 0 } });
  const semProposta = closed(2, { best_proposal: undefined });

  assert.equal(
    findRouteQuotationHistory({
      quotation: quotation(),
      quotations: [semValor, semProposta],
    }),
    null,
  );
});

test('cotação aberta sem origem não procura histórico nenhum', () => {
  // Sem origem não há rota, e o fallback por referência é do EMBARQUE — a
  // mesma regra de `quotationRadarRoute`.
  assert.equal(
    findRouteQuotationHistory({
      quotation: quotation({ origin: '   ' }),
      quotations: [closed(1)],
    }),
    null,
  );
  assert.equal(
    findRouteQuotationHistory({ quotation: undefined, quotations: [closed(1)] }),
    null,
  );
});

// --- Data de fechamento ------------------------------------------------------

test('sem closed_at a data cai em updated_at e depois em created_at', () => {
  const history = findRouteQuotationHistory({
    quotation: quotation(),
    quotations: [
      closed(1, { closed_at: null, updated_at: '2026-07-01T00:00:00Z' }),
      closed(2, {
        closed_at: null,
        updated_at: null,
        created_at: '2026-06-01T00:00:00Z',
      }),
    ],
  });

  assert.ok(history);
  assert.equal(history.items[0].closedAt, '2026-07-01T00:00:00Z');
  assert.equal(history.items[1].closedAt, '2026-06-01T00:00:00Z');
});

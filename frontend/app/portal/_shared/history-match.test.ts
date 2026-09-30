import { test } from 'node:test';
import assert from 'node:assert/strict';

import { matchHistory, normalize } from './history-match.ts';

const past = [
  {
    id: 'q1', reference: 'COT-2026-0001', state: 'FECHADA', product: 'Peças de reposição',
    origin: 'Shanghai, China', porto_embarque: 'Shanghai, China (CNSHA)',
    porto_destino: ['Santos, Brazil (BRSSZ)'], closed_at: '2026-08-12T10:00:00Z', created_at: '2026-07-30T10:00:00Z',
  },
  {
    id: 'q2', reference: 'COT-2026-0009', state: 'COTANDO', product: 'Pecas de reposicao',
    origin: 'Shanghai', porto_destino: ['Santos'], created_at: '2026-09-02T10:00:00Z',
  },
  {
    id: 'q3', reference: 'COT-2026-0004', state: 'FECHADA', product: 'Piso vinílico',
    origin: 'Ho Chi Minh, Vietnam', porto_destino: ['Santos, Brazil (BRSSZ)'], closed_at: '2026-06-01T00:00:00Z', created_at: '2026-05-20T00:00:00Z',
  },
];

test('normaliza caixa, acento e pontuação', () => {
  assert.equal(normalize('  Peças de REPOSIÇÃO! '), 'pecas de reposicao');
});

test('produto + origem + destino batem: prefere a que virou embarque', () => {
  const match = matchHistory(
    { product: 'peças de reposição', origins: ['Shanghai, China (CNSHA)'], destinations: ['Santos, Brazil (BRSSZ)'] },
    past,
  );
  assert.deepEqual(match, { quotationId: 'q1', reference: 'COT-2026-0001', month: '2026-08', shipped: true, destinationUnknown: false });
});

test('local de coleta com endereço também identifica a origem', () => {
  const match = matchHistory(
    { product: 'Peças de reposição', origins: ['Rua Demo 100, Shanghai'], destinations: ['Santos'] },
    past,
  );
  assert.equal(match?.quotationId, 'q1');
});

test('mesmo produto em outra rota não é a mesma carga', () => {
  assert.equal(
    matchHistory({ product: 'Peças de reposição', origins: ['Busan'], destinations: ['Santos'] }, past),
    null,
  );
});

test('mesma rota com outro produto também não', () => {
  assert.equal(
    matchHistory({ product: 'Motores elétricos', origins: ['Shanghai'], destinations: ['Santos'] }, past),
    null,
  );
});

test('produto curto demais ou vazio não casa com nada', () => {
  assert.equal(matchHistory({ product: '', origins: ['Shanghai'], destinations: ['Santos'] }, past), null);
  assert.equal(matchHistory({ product: 'pe', origins: ['Shanghai'], destinations: ['Santos'] }, past), null);
});

test('só cotada, sem embarque, é informada como cotação', () => {
  const match = matchHistory(
    { product: 'Peças de reposição', origins: ['Shanghai'], destinations: ['Santos'] },
    past.filter((q) => q.id === 'q2'),
  );
  assert.deepEqual(match, { quotationId: 'q2', reference: 'COT-2026-0009', month: '2026-09', shipped: false, destinationUnknown: false });
});

test('anterior sem destino registrado casa por produto + origem, e diz isso', () => {
  const noDestination = [{ id: 'q9', reference: 'COT-2026-0001', state: 'FECHADA', product: 'Peças industriais', origin: 'Shanghai, China', closed_at: '2026-09-11T00:00:00Z', created_at: '2026-09-01T00:00:00Z' }];
  const match = matchHistory({ product: 'Peças industriais', origins: ['Shanghai'], destinations: ['Santos'] }, noDestination);
  assert.equal(match?.destinationUnknown, true);
  // Com destino registrado e diferente, não casa.
  assert.equal(
    matchHistory({ product: 'Peças de reposição', origins: ['Shanghai'], destinations: ['Itajaí'] }, past),
    null,
  );
});

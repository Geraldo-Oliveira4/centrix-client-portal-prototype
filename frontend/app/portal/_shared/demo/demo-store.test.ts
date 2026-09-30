// Unit test do nucleo do store de demonstracao. Mesmo runner dos outros libs:
//
//     npm run test:unit
//
// O QUE ERRA EM SILENCIO AQUI, e por isso e testado:
//
//   1. Um reset que passa do prefixo. `resetPrefix` roda ao lado do login
//      (`@centrix:session`), dos rascunhos de cotacao
//      (`centrix-preparation-v1:`) e do tema (`portal:theme`). Um `clear()`
//      disfarcado de reset deslogaria quem estava apresentando e jogaria fora
//      trabalho do cliente.
//   2. Um reset que pula chaves. Remover enquanto se caminha por indice desloca
//      tudo o que vem depois — e a metade nao apagada so aparece na proxima
//      demonstracao, como um estado que "voltou sozinho".
//   3. JSON corrompido derrubando a tela. Storage e superficie externa: o valor
//      no disco foi escrito por uma versao ANTERIOR deste codigo, ou por outra
//      aba, ou por ninguem.
//   4. Uma assinatura que escuta so um dos dois canais. `storage` nao dispara na
//      aba que escreveu, e o evento custom nao atravessa abas.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEMO_STORE_EVENT,
  DEMO_STORE_PREFIX,
  decodeDemoValue,
  demoStoreKey,
  listDemoKeys,
  notifyDemoStore,
  readDemoRaw,
  readDemoValue,
  removeDemoValue,
  resetPrefix,
  subscribeDemoStore,
  writeDemoValue,
  type DemoStorage,
} from './demo-store.ts';

/** `localStorage` em memoria, com a mesma semantica de indice. */
function memoryStorage(seed: Record<string, string> = {}): DemoStorage {
  const map = new Map(Object.entries(seed));
  return {
    get length() {
      return map.size;
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

/** Storage que recusa tudo — navegador com dados de site bloqueados. */
function hostileStorage(): DemoStorage {
  const boom = () => {
    throw new Error('storage disabled');
  };
  return {
    get length(): number {
      return boom();
    },
    key: boom,
    getItem: boom,
    setItem: boom,
    removeItem: boom,
  };
}

test('a chave sempre carrega o prefixo unico', () => {
  assert.equal(demoStoreKey('feature-flags'), 'centrix-proto-v2:feature-flags');
  assert.ok(demoStoreKey('x').startsWith(DEMO_STORE_PREFIX));
});

test('grava e le de volta o mesmo valor', () => {
  const storage = memoryStorage();
  assert.equal(writeDemoValue(storage, 'k', { a: 1 }), true);
  assert.deepEqual(readDemoValue(storage, 'k', null), { a: 1 });
  assert.equal(readDemoRaw(storage, 'k'), '{"a":1}');
});

test('chave ausente devolve o fallback, nao undefined', () => {
  const storage = memoryStorage();
  assert.deepEqual(readDemoValue(storage, 'nada', { padrao: true }), {
    padrao: true,
  });
});

test('JSON corrompido cai no fallback em vez de estourar', () => {
  const storage = memoryStorage({
    'centrix-proto-v2:k': '{isto nao e json',
  });
  assert.deepEqual(readDemoValue(storage, 'k', { padrao: true }), {
    padrao: true,
  });
});

test('um normalizador que estoura tambem cai no fallback', () => {
  const explode = () => {
    throw new Error('shape inesperado');
  };
  assert.equal(decodeDemoValue('{"a":1}', 'fallback', explode), 'fallback');
});

test('storage indisponivel nunca propaga o erro', () => {
  const storage = hostileStorage();
  assert.deepEqual(readDemoValue(storage, 'k', 'padrao'), 'padrao');
  assert.equal(writeDemoValue(storage, 'k', 1), false);
  assert.equal(removeDemoValue(storage, 'k'), false);
  assert.deepEqual(listDemoKeys(storage), []);
  assert.deepEqual(resetPrefix(storage), []);
});

test('storage ausente (SSR) tem o mesmo comportamento', () => {
  assert.deepEqual(readDemoValue(null, 'k', 'padrao'), 'padrao');
  assert.equal(readDemoRaw(null, 'k'), null);
  assert.equal(writeDemoValue(null, 'k', 1), false);
  assert.deepEqual(resetPrefix(null), []);
});

test('resetPrefix apaga SOMENTE as chaves do prefixo', () => {
  const storage = memoryStorage({
    'centrix-proto-v2:feature-flags': '{}',
    'centrix-proto-v2:freitas-simulation': '{}',
    '@centrix:session': 'sessao-do-cliente',
    'centrix-preparation-v1:c1:q1': 'rascunho',
    'portal:theme': 'dark',
    'centrix-proto-v2': 'sem os dois pontos, nao e do prefixo',
  });

  const removed = resetPrefix(storage);

  assert.deepEqual(removed.sort(), [
    'centrix-proto-v2:feature-flags',
    'centrix-proto-v2:freitas-simulation',
  ]);
  assert.equal(storage.getItem('@centrix:session'), 'sessao-do-cliente');
  assert.equal(storage.getItem('centrix-preparation-v1:c1:q1'), 'rascunho');
  assert.equal(storage.getItem('portal:theme'), 'dark');
  assert.equal(
    storage.getItem('centrix-proto-v2'),
    'sem os dois pontos, nao e do prefixo',
  );
  assert.equal(storage.length, 4);
});

test('resetPrefix nao pula chave nenhuma, mesmo intercaladas', () => {
  // O caso que o laco por indice erra: apagar desloca o resto e pula um.
  const storage = memoryStorage({
    'centrix-proto-v2:a': '1',
    'centrix-proto-v2:b': '2',
    'outro:x': '3',
    'centrix-proto-v2:c': '4',
    'centrix-proto-v2:d': '5',
  });

  assert.equal(resetPrefix(storage).length, 4);
  assert.deepEqual(listDemoKeys(storage), []);
  assert.equal(storage.length, 1);
  assert.equal(storage.getItem('outro:x'), '3');
});

test('a assinatura escuta os DOIS canais e devolve o unsubscribe', () => {
  const events = new EventTarget();
  let calls = 0;
  const unsubscribe = subscribeDemoStore(events, () => {
    calls += 1;
  });

  // Outra aba.
  events.dispatchEvent(new Event('storage'));
  assert.equal(calls, 1);

  // Esta aba.
  notifyDemoStore(events);
  assert.equal(calls, 2);

  unsubscribe();
  events.dispatchEvent(new Event('storage'));
  events.dispatchEvent(new Event(DEMO_STORE_EVENT));
  assert.equal(calls, 2);
});

test('assinar sem event target e um no-op, nao um erro', () => {
  const unsubscribe = subscribeDemoStore(null, () => {
    throw new Error('nao deveria ser chamado');
  });
  notifyDemoStore(null);
  unsubscribe();
});

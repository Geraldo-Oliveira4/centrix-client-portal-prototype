import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  checkHealthOnce,
  isNetworkFailure,
  offlineBannerText,
  probeHealth,
  resolveDataMode,
  type FetchLike,
} from './offline-mode.ts';

const API = 'http://api.invalid';

/** Fetch falso: cada chamada consome a próxima resposta do roteiro. */
function scripted(...steps: Array<'ok' | 'down' | 'error' | 'hang'>) {
  const calls: string[] = [];
  const fetchImpl: FetchLike = (url, init) => {
    calls.push(url);
    const step = steps[Math.min(calls.length - 1, steps.length - 1)];
    if (step === 'ok') return Promise.resolve({ ok: true });
    if (step === 'down') return Promise.resolve({ ok: false });
    if (step === 'error')
      return Promise.reject(new TypeError('Failed to fetch'));
    return new Promise((_, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('aborted')));
    });
  };
  return { fetchImpl, calls };
}

test('API de pé: o teste de saúde passa na primeira tentativa', async () => {
  const { fetchImpl, calls } = scripted('ok');
  assert.equal(await probeHealth(API, fetchImpl, { timeoutMs: 50 }), true);
  assert.deepEqual(calls, [API + '/health']);
});

test('timeout: a tentativa que não responde vira falha, e só há UMA tentativa extra', async () => {
  const { fetchImpl, calls } = scripted('hang', 'hang', 'ok');
  const started = Date.now();
  assert.equal(await probeHealth(API, fetchImpl, { timeoutMs: 30 }), false);
  assert.equal(calls.length, 2);
  assert.ok(Date.now() - started < 1000, 'o timeout corta a espera');
});

test('erro de rede e status não-2xx também são falha, sem lançar', async () => {
  assert.equal(
    await checkHealthOnce(API, scripted('error').fetchImpl, 30),
    false,
  );
  assert.equal(
    await checkHealthOnce(API, scripted('down').fetchImpl, 30),
    false,
  );
  assert.equal(await checkHealthOnce('', scripted('ok').fetchImpl, 30), false);
});

test('a tentativa extra salva um servidor que acordou no meio do teste', async () => {
  const { fetchImpl, calls } = scripted('hang', 'ok');
  assert.equal(await probeHealth(API, fetchImpl, { timeoutMs: 30 }), true);
  assert.equal(calls.length, 2);
});

test('volta ao normal: offline pela saúde, e "Tentar de novo" com a API de pé grava online na sessão', async () => {
  const first = await probeHealth(API, scripted('down', 'down').fetchImpl, {
    timeoutMs: 30,
  });
  assert.equal(first, false);
  assert.deepEqual(resolveDataMode({ stored: 'offline:health' }), {
    kind: 'offline',
    reason: 'health',
  });
  const retry = await probeHealth(API, scripted('ok').fetchImpl, {
    timeoutMs: 30,
  });
  assert.equal(retry, true);
  assert.deepEqual(resolveDataMode({ stored: 'online' }), {
    kind: 'online',
    explicit: false,
  });
  // Mesmo com a variável de demonstração ligada: o clique é explícito e vale para a sessão.
  assert.deepEqual(resolveDataMode({ env: '1', stored: 'online' }), {
    kind: 'online',
    explicit: false,
  });
});

test('precedência: URL > sessão > variável de ambiente > teste de saúde', () => {
  assert.deepEqual(resolveDataMode({}), { kind: 'probe' });
  assert.deepEqual(resolveDataMode({ env: '1' }), {
    kind: 'offline',
    reason: 'env',
  });
  assert.deepEqual(resolveDataMode({ env: '0' }), {
    kind: 'online',
    explicit: true,
  });
  assert.deepEqual(resolveDataMode({ search: '?offline=1', env: '0' }), {
    kind: 'offline',
    reason: 'query',
  });
  assert.deepEqual(
    resolveDataMode({ search: '?offline=0', stored: 'offline:health' }),
    { kind: 'online', explicit: true },
  );
  assert.deepEqual(resolveDataMode({ stored: 'offline:network', env: '0' }), {
    kind: 'offline',
    reason: 'network',
  });
  assert.deepEqual(
    resolveDataMode({ search: '?offline=talvez', stored: 'lixo' }),
    { kind: 'probe' },
  );
});

test('só erro de REDE troca para dados de exemplo; erro HTTP de API de pé continua erro', () => {
  assert.equal(
    isNetworkFailure({ isAxiosError: true, code: 'ERR_NETWORK' }),
    true,
  );
  assert.equal(
    isNetworkFailure({ isAxiosError: true, code: 'ECONNABORTED' }),
    true,
  );
  assert.equal(
    isNetworkFailure({ isAxiosError: true, response: { status: 500 } }),
    false,
  );
  assert.equal(
    isNetworkFailure({ isAxiosError: true, response: { status: 404 } }),
    false,
  );
  assert.equal(
    isNetworkFailure({ isAxiosError: true, code: 'ERR_CANCELED' }),
    false,
  );
  assert.equal(isNetworkFailure(new Error('x')), false);
});

test('a faixa sempre começa por "Modo demonstração" e diz quando o servidor caiu', () => {
  assert.equal(
    offlineBannerText('health'),
    'Modo demonstração: servidor indisponível, mostrando dados de exemplo.',
  );
  assert.equal(offlineBannerText('network'), offlineBannerText('health'));
  assert.match(
    offlineBannerText('query'),
    /^Modo demonstração: mostrando dados de exemplo/,
  );
});

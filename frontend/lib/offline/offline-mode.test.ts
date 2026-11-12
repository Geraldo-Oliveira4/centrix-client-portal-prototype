import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  checkHealthOnce,
  isServerUnavailable,
  offlineBannerText,
  HEALTH_PATH,
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

test('API de pé: o teste de saúde consulta uma rota que USA o banco, não /health nem /docs', async () => {
  const { fetchImpl, calls } = scripted('ok');
  assert.equal(await probeHealth(API, fetchImpl, { timeoutMs: 50 }), true);
  assert.deepEqual(calls, [API + HEALTH_PATH]);
  assert.equal(HEALTH_PATH, '/portal/clients/me');
});

test('timeout: a tentativa que não responde vira falha, sem espera longa (uma tentativa)', async () => {
  const { fetchImpl, calls } = scripted('hang', 'ok');
  const started = Date.now();
  assert.equal(await probeHealth(API, fetchImpl, { timeoutMs: 30 }), false);
  assert.equal(calls.length, 1);
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

test('tentativas extras continuam possíveis por opção', async () => {
  const { fetchImpl, calls } = scripted('hang', 'ok');
  assert.equal(
    await probeHealth(API, fetchImpl, { timeoutMs: 30, attempts: 2 }),
    true,
  );
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

test('rede, timeout e 5xx contam como indisponível; 4xx de API de pé continua erro', () => {
  assert.equal(
    isServerUnavailable({ isAxiosError: true, code: 'ERR_NETWORK' }),
    true,
  );
  assert.equal(
    isServerUnavailable({ isAxiosError: true, code: 'ECONNABORTED' }),
    true,
  );
  assert.equal(
    isServerUnavailable({ isAxiosError: true, response: { status: 500 } }),
    true,
  );
  assert.equal(
    isServerUnavailable({ isAxiosError: true, response: { status: 503 } }),
    true,
  );
  assert.equal(
    isServerUnavailable({ isAxiosError: true, response: { status: 404 } }),
    false,
  );
  assert.equal(
    isServerUnavailable({ isAxiosError: true, code: 'ERR_CANCELED' }),
    false,
  );
  assert.equal(isServerUnavailable(new Error('x')), false);
});

test('a faixa sempre começa por "Modo demonstração" e diz quando o servidor caiu', () => {
  assert.equal(
    offlineBannerText('health'),
    'Modo demonstração: servidor indisponível. Dados de exemplo.',
  );
  assert.equal(offlineBannerText('network'), offlineBannerText('health'));
  assert.match(
    offlineBannerText('query'),
    /^Modo demonstração: dados de exemplo/,
  );
});

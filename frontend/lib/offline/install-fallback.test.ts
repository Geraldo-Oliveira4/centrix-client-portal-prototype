// O fallback do modo offline contra um backend MOCKADO de verdade (servidor HTTP
// local): 500, timeout e rede caída viram dados de exemplo; 4xx e 200 de uma API
// de pé passam intactos; com o modo offline decidido, a rede nem é tocada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

import axios, { type AxiosAdapter } from 'axios';

import { buildOfflineFixtures } from './fixtures.ts';
import {
  installOfflineFallback,
  type OfflineStatus,
} from './install-fallback.ts';
import { createOfflineBackend } from './offline-backend.ts';

/** Backend falso: cada caminho escolhe como falhar. Conta as requisições. */
async function mockBackend() {
  let hits = 0;
  const server = http.createServer((req, res) => {
    hits += 1;
    if (req.url?.startsWith('/hang')) return; // nunca responde
    if (req.url?.startsWith('/ok')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ client: { name: 'Do servidor' } }));
    }
    if (req.url?.startsWith('/missing')) {
      res.writeHead(404, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ message: 'não existe' }));
    }
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ message: 'database unavailable' }));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  return {
    port,
    hits: () => hits,
    close: () =>
      new Promise<void>((r) => {
        server.closeAllConnections();
        server.close(() => r());
      }),
  };
}

/** Um portal_api em miniatura: mesma instalação, relógio e fixtures fixos. */
function client(baseURL: string, start: OfflineStatus) {
  let status = start;
  const backend = createOfflineBackend(buildOfflineFixtures('2026-11-12'));
  const adapter: AxiosAdapter = async (config) => {
    const path = new URL(config.url ?? '', 'http://x').pathname;
    const res = backend.handle(config.method ?? 'get', path, config.data);
    return {
      data: res.data,
      status: res.status,
      statusText: 'OK',
      headers: {},
      config,
    };
  };
  const api = axios.create({ baseURL, timeout: 300 });
  installOfflineFallback(api, {
    ensureMode: async () => status,
    getStatus: () => status,
    markOffline: (reason) => {
      status = { status: 'offline', reason };
    },
    adapter,
  });
  return { api, status: () => status };
}

const ONLINE: OfflineStatus = { status: 'online', explicit: false };

test('5xx (banco fora) vira dados de exemplo e a sessão passa a offline', async () => {
  const server = await mockBackend();
  try {
    const { api, status } = client(
      `http://127.0.0.1:${server.port}/err`,
      ONLINE,
    );
    const res = await api.get('/portal/clients/me');
    assert.equal(res.data.client.name, 'Cliente Demo');
    assert.deepEqual(status(), { status: 'offline', reason: 'network' });
  } finally {
    await server.close();
  }
});

test('timeout (servidor pendurado) vira dados de exemplo', async () => {
  const server = await mockBackend();
  try {
    const { api, status } = client(
      `http://127.0.0.1:${server.port}/hang`,
      ONLINE,
    );
    const res = await api.get('/portal/quotations');
    assert.ok(res.data.buckets.aguardando_aprovacao.length > 0);
    assert.equal(status().status, 'offline');
  } finally {
    await server.close();
  }
});

test('rede caída (porta fechada) vira dados de exemplo', async () => {
  const server = await mockBackend();
  const port = server.port;
  await server.close();
  const { api, status } = client(`http://127.0.0.1:${port}`, ONLINE);
  const res = await api.get('/portal/shipments');
  assert.equal(res.data.total, 15);
  assert.equal(status().status, 'offline');
});

test('telas principais: as rotas de Início, Cotações, Embarques e Nova cotação respondem offline', async () => {
  const server = await mockBackend();
  try {
    const { api } = client(`http://127.0.0.1:${server.port}/err`, ONLINE);
    const routes = [
      '/portal/clients/me',
      '/portal/quotations',
      '/portal/shipments',
      '/portal/home-layout-experiment',
      '/portal/exporters',
      '/portal/agents',
      '/portal/preferences',
    ];
    for (const route of routes) {
      const res = await api.get(route);
      assert.equal(res.status, 200, route);
    }
    const created = await api.post('/portal/quotations', { product: 'Teste' });
    assert.equal(created.status, 201);
  } finally {
    await server.close();
  }
});

test('API de pé: 200 e 4xx passam intactos, sem dados de exemplo', async () => {
  const server = await mockBackend();
  try {
    const ok = client(`http://127.0.0.1:${server.port}/ok`, ONLINE);
    assert.equal(
      (await ok.api.get('/portal/clients/me')).data.client.name,
      'Do servidor',
    );
    assert.equal(ok.status().status, 'online');
    const missing = client(`http://127.0.0.1:${server.port}/missing`, ONLINE);
    await assert.rejects(
      missing.api.get('/portal/quotations/x'),
      (e: { response?: { status: number } }) => e.response?.status === 404,
    );
    assert.equal(missing.status().status, 'online');
  } finally {
    await server.close();
  }
});

test('modo offline decidido (flag): zero chamadas ao backend', async () => {
  const server = await mockBackend();
  try {
    const { api } = client(`http://127.0.0.1:${server.port}/hang`, {
      status: 'offline',
      reason: 'env',
    });
    const started = Date.now();
    await api.get('/portal/shipments');
    assert.equal(server.hits(), 0);
    assert.ok(Date.now() - started < 200, 'sem espera');
  } finally {
    await server.close();
  }
});

test('offline desligado de propósito: 5xx continua erro (sem dados de exemplo)', async () => {
  const server = await mockBackend();
  try {
    const { api, status } = client(`http://127.0.0.1:${server.port}/err`, {
      status: 'online',
      explicit: true,
    });
    await assert.rejects(api.get('/portal/clients/me'));
    assert.equal(status().status, 'online');
  } finally {
    await server.close();
  }
});

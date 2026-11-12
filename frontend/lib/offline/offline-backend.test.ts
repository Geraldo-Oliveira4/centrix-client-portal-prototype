import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  buildOfflineFixtures,
  buildPreviewData,
  OFFLINE_CLIENT,
} from './fixtures.ts';
import {
  createOfflineBackend,
  OFFLINE_UPLOAD_REFUSAL,
} from './offline-backend.ts';

const TODAY = '2026-11-12';
const backend = () => createOfflineBackend(buildOfflineFixtures(TODAY));

test('usuário fictício: "Cliente Demo", nunca vazio', () => {
  const res = backend().handle('GET', '/portal/clients/me');
  assert.equal(res.status, 200);
  assert.deepEqual(res.data, { client: OFFLINE_CLIENT });
  assert.equal(OFFLINE_CLIENT.name, 'Cliente Demo');
});

test('troca de fonte: as rotas de leitura do portal respondem no formato da API', () => {
  const b = backend();
  const quotations = b.handle('GET', '/portal/quotations').data as {
    buckets: Record<string, { id: string }[]>;
    bucket_order: string[];
    total: number;
  };
  assert.deepEqual(quotations.bucket_order, [
    'aguardando_dados',
    'buscando_propostas',
    'aguardando_aprovacao',
  ]);
  for (const bucket of quotations.bucket_order) {
    assert.ok(
      quotations.buckets[bucket].length > 0,
      `coluna ${bucket} tem cotação`,
    );
  }
  assert.equal(quotations.total, 20);

  const shipments = b.handle('GET', '/portal/shipments?x=1').data as {
    items: { id: string }[];
    total: number;
  };
  assert.equal(shipments.total, 15);
  const detail = b.handle('GET', `/portal/shipments/${shipments.items[0].id}`)
    .data as { shipment: { containers: unknown[] } };
  assert.ok(Array.isArray(detail.shipment.containers));

  const pending = quotations.buckets.aguardando_aprovacao[0];
  for (const sub of [
    '',
    '/recommendation',
    '/history',
    '/attachments',
    '/agents',
  ]) {
    assert.equal(
      b.handle('GET', `/portal/quotations/${pending.id}${sub}`).status,
      200,
      sub || 'detalhe',
    );
  }
  const closed = quotations.buckets.finalizadas.find((q) =>
    q.id.startsWith('quote-'),
  )!;
  assert.equal(
    b.handle('GET', `/portal/quotations/${closed.id}/audit-preview`).status,
    200,
  );
  for (const path of [
    '/portal/agents',
    '/portal/preferences',
    '/portal/exporters',
    '/portal/home-layout-experiment',
  ]) {
    assert.equal(b.handle('GET', path).status, 200, path);
  }
  assert.equal(b.handle('GET', '/portal/quotations/nao-existe').status, 404);
});

test('a recomendação é a proposta mais barata e não carrega placar', () => {
  const b = backend();
  const rec = b.handle(
    'GET',
    '/portal/quotations/offline-quote-16/recommendation',
  ).data as {
    recommended_proposal_id: string;
    scores: {
      total_score: number | null;
      is_lowest_cost: boolean;
      proposal_id: string;
    }[];
  };
  const cheapest = rec.scores.find((s) => s.is_lowest_cost)!;
  assert.equal(rec.recommended_proposal_id, cheapest.proposal_id);
  assert.ok(rec.scores.every((s) => s.total_score === null));
});

test('datas relativas: a mesma fixture em dois "hojes" desloca tudo igual', () => {
  const a = buildOfflineFixtures('2026-11-12');
  const b = buildOfflineFixtures('2026-12-02');
  const dayDiff = (x: string, y: string) =>
    (Date.parse(y) - Date.parse(x)) / 86_400_000;
  assert.equal(
    dayDiff(
      a.shipments[0].tracking!.current_eta!,
      b.shipments[0].tracking!.current_eta!,
    ),
    20,
  );
  assert.equal(
    dayDiff(
      a.quotations[0].created_at.slice(0, 10),
      b.quotations[0].created_at.slice(0, 10),
    ),
    20,
  );
  // O ETA do primeiro embarque fica sempre 6 dias depois do hoje da demonstração.
  assert.equal(a.shipments[0].tracking!.current_eta, '2026-11-18');
});

test('a prévia visual continua servindo os mesmos 15 cenários de antes', () => {
  const { quotations, items } = buildPreviewData(TODAY);
  assert.equal(quotations.length, 15);
  assert.equal(items.length, 15);
  assert.ok(
    quotations.every((q) => q.state === 'FECHADA' && q.best_proposal === null),
  );
  assert.equal(items[2].tracking.data_status, null);
});

test('ações que gravam são SIMULADAS: respondem, avisam e mudam só a cópia desta aba', () => {
  const b = backend();
  const approve = b.handle(
    'POST',
    '/portal/quotations/offline-quote-16/proposals/offline-proposal:offline-quote-16:demo-agent-alpha/approve',
    '{}',
  );
  assert.equal(approve.status, 200);
  assert.match(approve.simulated!, /não chegou à Freitas/);
  const after = b.handle('GET', '/portal/quotations/offline-quote-16').data as {
    quotation: { state: string };
  };
  assert.equal(after.quotation.state, 'FECHADA');
  // Outra aba (outro backend) parte da fixture intacta.
  const fresh = backend().handle('GET', '/portal/quotations/offline-quote-16')
    .data as { quotation: { state: string } };
  assert.equal(fresh.quotation.state, 'ENVIADA_CLIENTE');

  const created = b.handle(
    'POST',
    '/portal/quotations',
    JSON.stringify({ product: 'Produto teste' }),
  );
  assert.equal(created.status, 201);
  assert.match(created.simulated!, /não foi enviada/);
  const createdId = (created.data as { quotation: { id: string } }).quotation
    .id;
  assert.equal(b.handle('GET', `/portal/quotations/${createdId}`).status, 200);

  const prefs = b.handle('PUT', '/portal/preferences', {
    paused_agent_ids: ['demo-agent-gamma'],
  });
  assert.ok(prefs.simulated);
  const agents = b.handle('GET', '/portal/agents').data as {
    active_count: number;
  };
  assert.equal(agents.active_count, 2);

  const dispatch = b.handle(
    'POST',
    '/portal/quotations/offline-quote-19/rfq/dispatch',
  );
  assert.match(dispatch.simulated!, /Nenhum agente recebeu/);
});

test('envio de arquivo e escrita desconhecida RECUSAM em vez de fingir sucesso', () => {
  const b = backend();
  const upload = b.handle(
    'POST',
    '/portal/quotations/offline-quote-19/documents/upload-url',
    {},
  );
  assert.equal(upload.status, 503);
  assert.equal(
    (upload.data as { message: string }).message,
    OFFLINE_UPLOAD_REFUSAL,
  );
  const other = b.handle('POST', '/portal/qualquer-coisa', {});
  assert.equal(other.status, 503);
  assert.match(
    (other.data as { message: string }).message,
    /^Prévia: nada foi enviado/,
  );
});

test('ponto único: só lib/portal-api.ts instala o adapter offline', () => {
  const root = join(import.meta.dirname, '..', '..');
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (
        name === 'node_modules' ||
        name.startsWith('.') ||
        name === 'public' ||
        name === 'vendor'
      )
        continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts')) {
        if (
          /from ['"][^'"]*offline-adapter['"]/.test(readFileSync(full, 'utf8'))
        )
          hits.push(relative(root, full));
      }
    }
  };
  for (const dir of ['app', 'hooks', 'lib', 'components'])
    walk(join(root, dir));
  assert.deepEqual(hits.sort(), ['lib/portal-api.ts']);
});

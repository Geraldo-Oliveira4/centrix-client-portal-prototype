import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import {
  MIN_SAMPLE,
  agentHistory,
  type CommitmentsFn,
  type IntelDataset,
} from './agent-history.ts';

// A MESMA fixture e o MESMO motor que a Inteligência usa, só para leitura.
const require = createRequire(import.meta.url);
const D = require('../../../../../public/prototypes/centrix-inteligencia/data.js') as IntelDataset;
const E = require('../../../../../public/prototypes/centrix-inteligencia/intel-engine.js') as {
  commitments: CommitmentsFn;
};

test('agente da fixture: contagem, etapas da Inteligência, últimos 5 e desvios', () => {
  const h = agentHistory(D, E.commitments, 'beta');
  assert.equal(h.state, 'com_historico');
  if (h.state !== 'com_historico') return;
  assert.equal(h.shipments, D.operations.filter((o) => o.agent === 'beta').length);
  assert.deepEqual(
    h.stages.map((s) => s.id),
    D.stages.map((s) => s.id),
  );
  for (const s of h.stages) {
    assert.ok(s.onTime <= s.base);
    if (s.base) assert.equal(s.pct, Math.round((s.onTime / s.base) * 100));
    else assert.equal(s.pct, null);
  }
  assert.equal(h.recent.length, 5);
  assert.match(h.recent[0].route, / → /);
  // A Beta perde prazo no trânsito em julho/agosto na fixture: tem desvio registrado.
  assert.ok(h.deviations.some((d) => d.control === 'Trânsito internacional'));
});

test('não lê nem altera a fixture: mesma contagem antes e depois', () => {
  const before = JSON.stringify(D.operations);
  agentHistory(D, E.commitments, 'alpha');
  assert.equal(JSON.stringify(D.operations), before);
});

test('agente fora da fixture: "Sem histórico", nunca zero', () => {
  assert.deepEqual(agentHistory(D, E.commitments, 'epsilon'), { state: 'sem_historico' });
});

test('menos de 3 embarques: amostra pequena', () => {
  const tiny: IntelDataset = {
    ...D,
    operations: D.operations.filter((o) => o.agent === 'gamma').slice(0, MIN_SAMPLE - 1),
  };
  const h = agentHistory(tiny, E.commitments, 'gamma');
  assert.equal(h.state, 'com_historico');
  if (h.state !== 'com_historico') return;
  assert.equal(h.shipments, 2);
  assert.equal(h.smallSample, true);
  assert.ok(h.stages.every((s) => s.smallSample));
});

test('nenhuma nota de agente no resultado', () => {
  const h = agentHistory(D, E.commitments, 'delta');
  assert.doesNotMatch(JSON.stringify(h), /score|nota|ranking/i);
});

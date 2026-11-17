import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { SIMULATOR_SOURCE, simulatorPrefill } from './simulator-quotation.ts';

// As duas pontas: o link que o Simulador (iframe) escreve e a leitura da Nova Cotação.
const require = createRequire(import.meta.url);
const D = require('../../../../public/prototypes/centrix-inteligencia/data.js');
const S = require('../../../../public/prototypes/centrix-inteligencia/intel-sim.js');

const linkParams = (q: string) => new URLSearchParams(S.quotationLink(D, S.readTask(D, new URLSearchParams(q), D.cutoff)).split('?')[1]);

test('ida e volta: rota, modal e data-alvo do Simulador preenchem a Nova Cotação', () => {
  const p = linkParams('srota=ningbo&smodal=maritimo&chegada=2026-12-15');
  assert.equal(p.get('fonte'), SIMULATOR_SOURCE);
  const pre = simulatorPrefill(p);
  assert.ok(pre);
  assert.deepEqual(pre.values, { modal: 'MARITIMO', porto_embarque: 'Ningbo, China (CNNGB)', porto_destino: ['Itajai, Brazil (BRITJ)'], data_limite_necessidade: '2026-12-15' });
  assert.equal(pre.routeLabel, 'Ningbo → Itajaí');
});

test('nenhum agente de carga é pré-selecionado', () => {
  const p = linkParams('srota=shanghai&smodal=maritimo&chegada=2026-12-15&sprom=alpha:40');
  assert.ok(![...p.keys()].some((k) => /agent|agente/i.test(k)));
  assert.ok(![...p.values()].some((v) => /alpha|beta|gamma|delta/i.test(v)));
});

test('"Vou embarcar em" não vira data de necessidade; aéreo leva só modal e data', () => {
  assert.equal(simulatorPrefill(linkParams('smodo=embarcar&sembarque=2026-11-30'))?.values.data_limite_necessidade, undefined);
  const air = simulatorPrefill(linkParams('srota=ningbo&smodal=aereo&chegada=2026-12-01'));
  assert.deepEqual(air?.values, { modal: 'AEREO', data_limite_necessidade: '2026-12-01' });
});

test('sem a fonte do Simulador, ou com lixo, nada é preenchido', () => {
  assert.equal(simulatorPrefill(new URLSearchParams('modal=MARITIMO')), null);
  assert.deepEqual(simulatorPrefill(new URLSearchParams('fonte=simulador&modal=NAVIO&data_necessidade=2026-13-40'))?.values, {});
});

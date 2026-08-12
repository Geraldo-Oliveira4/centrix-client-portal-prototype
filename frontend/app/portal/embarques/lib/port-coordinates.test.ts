// Unit test da resolução de porto do mapa. Mesmo runner dos outros:
//
//     npm run test:unit
//
// O que estes testes travam é a regra que decide ONDE cada embarque aparece no
// mapa real. Um erro aqui não quebra a tela — ele desenha o embarque no país
// errado, que é pior: parece dado.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DESTINATION_PORT,
  ILLUSTRATIVE_HUBS,
  hubIndex,
  illustrativeHub,
  originPortOf,
  portFromQuotationOrigin,
} from './port-coordinates.ts';

test('origem da cotação tem prioridade sobre o hub ilustrativo', () => {
  const port = originPortOf('EMB-2026-0001', 'Ningbo, China');
  assert.equal(port.name, 'Ningbo');
  assert.equal(port.country, 'China');
});

test('sem cotação, cai no hub ilustrativo e nunca fica sem posição', () => {
  const port = originPortOf('EMB-2026-0002', null);
  assert.ok(port, 'todo embarque precisa de uma posição — sumir do mapa não é opção');
  assert.ok(ILLUSTRATIVE_HUBS.includes(port));
});

test('porto desconhecido cai no hub, em vez de derrubar o embarque do mapa', () => {
  // Cenário do futuro: uma cotação nomeia um porto que ainda não está na tabela.
  assert.equal(portFromQuotationOrigin('Antuérpia, Bélgica'), null);
  const port = originPortOf('EMB-2026-0002', 'Antuérpia, Bélgica');
  assert.ok(ILLUSTRATIVE_HUBS.includes(port));
});

test('o parser aceita acento, caixa e espaço do jeito que o seed grava', () => {
  assert.equal(portFromQuotationOrigin('Genova, Italy')?.name, 'Gênova');
  assert.equal(portFromQuotationOrigin('  SHANGHAI , China ')?.name, 'Shanghai');
  assert.equal(portFromQuotationOrigin('Ho Chi Minh, Vietnam')?.name, 'Ho Chi Minh');
});

test('todos os portos que aparecem em cotação do seed estão na tabela', () => {
  // Se o seed ganhar uma origem nova e ninguém acrescentar a coordenada, o
  // embarque cai calado no hub ilustrativo — este teste é quem grita.
  const seeded = [
    'Shanghai, China',
    'Hamburg, Germany',
    'Genova, Italy',
    'Ningbo, China',
    'Rotterdam, Netherlands',
    'Shenzhen, China',
    'Ho Chi Minh, Vietnam',
    'Izmir, Turkey',
  ];
  const missing = seeded.filter((o) => portFromQuotationOrigin(o) == null);
  assert.deepEqual(missing, []);
});

test('o hub é estável entre chamadas para a mesma referência', () => {
  const a = illustrativeHub('EMB-2026-0007');
  const b = illustrativeHub('EMB-2026-0007');
  assert.equal(a.name, b.name);
});

test('referências sequenciais espalham por hubs diferentes', () => {
  const refs = ['EMB-2026-0002', 'EMB-2026-0003', 'EMB-2026-0004', 'EMB-2026-0005'];
  const names = new Set(refs.map((r) => illustrativeHub(r).name));
  assert.equal(names.size, refs.length, 'a demo perde variedade se dois caírem no mesmo hub');
});

test('hubIndex nunca sai da faixa da tabela, inclusive sem sufixo numérico', () => {
  for (const ref of ['EMB-2026-0001', 'sem-numero', '', 'EMB-9999-9999']) {
    const i = hubIndex(ref);
    assert.ok(Number.isInteger(i) && i >= 0 && i < ILLUSTRATIVE_HUBS.length, ref);
  }
});

test('coordenadas caem em faixa geográfica válida', () => {
  for (const port of [...ILLUSTRATIVE_HUBS, DESTINATION_PORT]) {
    assert.ok(port.lat >= -90 && port.lat <= 90, `${port.name} lat`);
    assert.ok(port.lon >= -180 && port.lon <= 180, `${port.name} lon`);
  }
});

test('Santos é o destino, no hemisfério sul e a oeste', () => {
  assert.equal(DESTINATION_PORT.name, 'Santos');
  assert.ok(DESTINATION_PORT.lat < 0 && DESTINATION_PORT.lon < 0);
});

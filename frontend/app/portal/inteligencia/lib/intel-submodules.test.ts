import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  INTEL_SUBMODULES,
  activeIntelSubmodule,
  intelSubmoduleHash,
  isIntelPath,
} from './intel-submodules.ts';

const P = '/portal/inteligencia';

test('ordem fixa do menu, Simulador por último e com Prévia', () => {
  assert.deepEqual(
    INTEL_SUBMODULES.map((s) => s.label),
    ['Visão geral', 'Exportadores', 'Agentes de carga', 'Rotas', 'Simulador'],
  );
  assert.deepEqual(INTEL_SUBMODULES.filter((s) => s.preview).map((s) => s.id), ['simulador']);
});

test('nada chamado Preço no menu', () => {
  assert.ok(!INTEL_SUBMODULES.some((s) => /pre[çc]o/i.test(s.label)));
});

test('deep links existentes marcam o submódulo certo', () => {
  assert.equal(activeIntelSubmodule(P, ''), 'geral');
  assert.equal(activeIntelSubmodule(P, '#executivo'), 'geral');
  assert.equal(activeIntelSubmodule(P, '#executivo?aba=exportadores'), 'exportadores');
  assert.equal(activeIntelSubmodule(P, '#executivo?aba=agentes'), 'agentes');
  assert.equal(activeIntelSubmodule(P, '#executivo?aba=agentes&sel=beta'), 'agentes');
  assert.equal(activeIntelSubmodule(P, '#executivo?period=days30&aba=rotas'), 'rotas');
  assert.equal(activeIntelSubmodule(P, '#executivo?aba=simulador&chegada=2026-12-15'), 'simulador');
});

test('aba desconhecida cai na Visão geral, como no protótipo', () => {
  assert.equal(activeIntelSubmodule(P, '#executivo?aba=preco'), 'geral');
});

test('hashes antigos de bloco abrem a aba equivalente', () => {
  assert.equal(activeIntelSubmodule(P, '#agentes'), 'agentes');
  assert.equal(activeIntelSubmodule(P, '#compromissos'), 'agentes');
  assert.equal(activeIntelSubmodule(P, '#rotas'), 'rotas');
  assert.equal(activeIntelSubmodule(P, '#exportadores'), 'exportadores');
  assert.equal(activeIntelSubmodule(P, '#performance'), 'geral');
});

test('URLs antigas sem hash seguem a seção inicial do layout', () => {
  assert.equal(activeIntelSubmodule(P + '/agentes', ''), 'agentes');
  assert.equal(activeIntelSubmodule(P + '/executivo', ''), 'geral');
});

test('fichas e telas internas não marcam submódulo', () => {
  assert.equal(activeIntelSubmodule(P, '#agentes/alpha/resumo'), null);
  assert.equal(activeIntelSubmodule(P, '#casos/DEMO-1'), null);
  assert.equal(activeIntelSubmodule(P, '#metodo'), null);
});

test('fora da Inteligência (e no Radar antigo) nada fica ativo', () => {
  assert.equal(activeIntelSubmodule('/portal/home', '#executivo'), null);
  assert.equal(activeIntelSubmodule(P + '/radar', ''), null);
  assert.equal(isIntelPath('/portal/inteligenciaX'), false);
});

test('destino de cada submódulo é o hash que a aba tinha', () => {
  assert.equal(intelSubmoduleHash('geral'), '#executivo');
  assert.equal(intelSubmoduleHash('exportadores'), '#executivo?aba=exportadores');
  assert.equal(intelSubmoduleHash('agentes'), '#executivo?aba=agentes');
  assert.equal(intelSubmoduleHash('rotas'), '#executivo?aba=rotas');
  assert.equal(intelSubmoduleHash('simulador'), '#executivo?aba=simulador');
});

test('trocar de submódulo preserva período e filtros e fecha a ficha', () => {
  assert.equal(
    intelSubmoduleHash('rotas', '#executivo?period=days30&ag=alpha&aba=agentes&sel=alpha'),
    '#executivo?period=days30&ag=alpha&aba=rotas',
  );
  assert.equal(intelSubmoduleHash('geral', '#executivo?aba=rotas&period=year'), '#executivo?period=year');
  // A origem do link entre fichas (`de`) some junto com a ficha.
  assert.equal(intelSubmoduleHash('rotas', '#executivo?aba=agentes&sel=alpha&de=rota:shanghai'), '#executivo?aba=rotas');
  // De uma ficha interna, os parâmetros dela não vazam para a página de abas.
  assert.equal(intelSubmoduleHash('agentes', '#fornecedores/east/resumo?variant=direto'), '#executivo?aba=agentes');
});

test('ida e volta: o hash gerado marca o próprio submódulo', () => {
  for (const s of INTEL_SUBMODULES) {
    assert.equal(activeIntelSubmodule(P, intelSubmoduleHash(s.id)), s.id);
  }
});

// B4 (17/11/2026): ficha aberta por link de outra ficha — o menu destaca a
// subaba da ficha aberta, não a de origem.
test('ficha aberta por link de outra ficha: o menu acompanha a subaba da ficha', () => {
  assert.equal(activeIntelSubmodule(P, '#executivo?aba=agentes&sel=gamma&de=exp%3Aeast'), 'agentes');
  assert.equal(activeIntelSubmodule(P, '#executivo?aba=rotas&sel=ningbo&de=ag%3Agamma'), 'rotas');
  assert.equal(activeIntelSubmodule(P, '#executivo?aba=exportadores&sel=east&de=rota%3Aningbo'), 'exportadores');
});

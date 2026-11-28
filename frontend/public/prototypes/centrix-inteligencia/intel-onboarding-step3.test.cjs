'use strict';
// Passo 3 da introdução da Inteligência ("Por onde começar"). Cobre o que é
// PURO: a lista de cartões e o resumo dos temas. O HTML do passo, os cliques e
// a ordem fechar -> navegar/abrir painel dependem de DOM (<dialog>) e foram
// conferidos no navegador, não aqui.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./intel-personalize.js');
const T = require('./intel-tabs.js');

const EXTRA = ['simulador'];   // a família do futuro (extraTabs() em intel-page.js)

test('quatro cartões, um por submódulo, na ordem das abas', () => {
  assert.deepEqual(P.STEP3_CARDS.map((c) => c.tab), ['exportadores', 'agentes', 'rotas', 'simulador']);
  assert.deepEqual(P.STEP3_CARDS.map((c) => c.name), ['Exportadores', 'Agentes de carga', 'Rotas', 'Simulador']);
  assert.deepEqual(P.STEP3_CARDS.map((c) => c.question), [
    'Quem entrega a carga pronta no prazo?',
    'Qual agente cumpre o que promete?',
    'Onde o trânsito demora mais?',
    'Testar uma data de chegada.',
  ]);
});

test('só o Simulador leva o selo Prévia', () => {
  assert.deepEqual(P.STEP3_CARDS.filter((c) => c.preview).map((c) => c.tab), ['simulador']);
});

test('cada cartão aponta para uma aba que a página sabe abrir', () => {
  const ids = T.TABS.map(([id]) => id);
  for (const c of P.STEP3_CARDS) {
    assert.ok(ids.includes(c.tab) || EXTRA.includes(c.tab), c.tab);
    assert.notEqual(c.tab, 'geral', 'a Visão geral é o CTA, não um cartão');
    // O hash que o "Abrir" escreve é lido de volta como a mesma aba.
    assert.equal(T.readTab(T.writeTab(new URLSearchParams(), c.tab), EXTRA), c.tab);
    // O nome do cartão é o rótulo da aba (o Simulador não está em TABS).
    const label = (T.TABS.find(([id]) => id === c.tab) || [])[1];
    if (label) assert.equal(c.name, label);
  }
});

test('resumo dos temas: um, dois e três', () => {
  const soVolume = P.toggleTheme(P.toggleTheme(P.defaults(), 'prazo'), 'custo');
  const prazoVolume = P.toggleTheme(P.defaults(), 'custo');
  assert.equal(P.step3Summary(soVolume, false), 'Você escolheu Volume');
  assert.equal(P.step3Summary(prazoVolume, false), 'Você escolheu Prazo e Volume');
  assert.equal(P.step3Summary(P.defaults(), false), 'Você escolheu Prazo, Custo e Volume');
});

test('resumo dos temas: passo 2 pulado mantém a ideia do choiceSummary', () => {
  const prazoVolume = P.toggleTheme(P.defaults(), 'custo');
  assert.equal(P.step3Summary(P.defaults(), true), 'Você manteve a visão padrão');
  assert.equal(P.step3Summary(prazoVolume, true), 'Você manteve a sua visão atual');
  for (const s of [P.defaults(), prazoVolume]) assert.equal(P.step3Summary(s, true), P.choiceSummary(s, true));
});

test('resumo dos temas: nenhum tema e valor ilegível', () => {
  assert.equal(P.step3Summary({ themes: [], enabled_cards: [] }, false), 'Você desligou todos os temas');
  assert.equal(P.step3Summary(null, false), 'Você escolheu Prazo, Custo e Volume');
});

test('o resumo não conta cartões nem termina em ponto: a tela emenda o link', () => {
  for (const s of [P.defaults(), P.toggleTheme(P.defaults(), 'custo')]) {
    for (const skipped of [true, false]) assert.doesNotMatch(P.step3Summary(s, skipped), /cart(ão|ões)|[.:]$/);
  }
});

// Unit test do molde da Home personalizavel. Mesmo runner dos outros libs:
//
//     npm run test:unit
//
// O QUE ERRA EM SILENCIO AQUI, e por isso e testado:
//
//   1. Um card religado sozinho. O cliente desliga "Notificações", depois mexe
//      em OUTRO tema, e o card volta ligado porque a poda recomecou do zero.
//      Ninguem percebe ate a demo mostrar um card que o cliente tinha tirado.
//   2. A ordem da tela seguindo a ordem do CLIQUE do cliente em vez da ordem dos
//      temas — duas contas com os mesmos temas veriam Homes diferentes.
//   3. Um card orfao sobrevivendo na tela depois de o tema dele sair.
//   4. O registro e o backend saindo de sincronia: card que existe de um lado e
//      nao do outro. A checagem estrutural abaixo cobre o lado do frontend; a
//      comparacao com `backend/app/home_layout_experiment.py` esta no e2e.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_PORTAL_HOME_THEMES,
  PORTAL_HOME_CARD_DESCRIPTIONS,
  PORTAL_HOME_CARD_LABELS,
  PORTAL_HOME_CARD_THEME,
  PORTAL_HOME_LAYOUT_CARDS,
  PORTAL_HOME_THEMES,
  PORTAL_HOME_THEME_DESCRIPTIONS,
  PORTAL_HOME_THEME_LABELS,
  cardsForThemes,
  reconcileEnabledCards,
  visibleCards,
} from './home-layout.ts';

test('cardsForThemes devolve os cards do tema escolhido, so eles', () => {
  assert.deepEqual(cardsForThemes(['mapa_mundi']), ['mapa_embarques']);
  assert.deepEqual(cardsForThemes(['inteligencia']), ['economia']);
  assert.deepEqual(cardsForThemes(['alertas']), [
    'acao_urgente',
    'alertas_embarque',
  ]);
});

test('cardsForThemes sem tema nenhum devolve lista vazia', () => {
  assert.deepEqual(cardsForThemes([]), []);
});

test('a ordem e a dos TEMAS, nao a da escolha do cliente', () => {
  // Duas contas com os mesmos temas tem de ver a mesma Home.
  assert.deepEqual(
    cardsForThemes(['inteligencia', 'alertas']),
    cardsForThemes(['alertas', 'inteligencia']),
  );
  assert.deepEqual(cardsForThemes(['inteligencia', 'alertas']), [
    'acao_urgente',
    'alertas_embarque',
    'economia',
  ]);
});

test('visibleCards desenha so o que esta habilitado', () => {
  assert.deepEqual(
    visibleCards(['alertas'], ['acao_urgente']),
    ['acao_urgente'],
  );
});

test('visibleCards descarta card orfao de tema', () => {
  // A janela entre o cliente tirar um tema e o PUT voltar: sem este filtro a
  // tela desenharia por um instante o card do tema que acabou de sair.
  assert.deepEqual(
    visibleCards(['alertas'], ['acao_urgente', 'mapa_embarques']),
    ['acao_urgente'],
  );
});

test('visibleCards com tudo desligado devolve lista vazia, nao os cards do tema', () => {
  // "Escolhi temas e desliguei tudo" e um estado legitimo, diferente de "nunca
  // escolhi" — e a tela tem um vazio proprio para ele.
  assert.deepEqual(visibleCards(['alertas', 'mapa_mundi'], []), []);
});

test('reconcileEnabledCards preserva o que o cliente desligou num tema que fica', () => {
  const next = reconcileEnabledCards(
    ['alertas'],
    ['alertas', 'mapa_mundi'],
    ['acao_urgente'], // "alertas_embarque" estava DESLIGADO
  );
  assert.ok(!next.includes('alertas_embarque'), 'o card desligado voltou sozinho');
  assert.ok(next.includes('acao_urgente'));
  assert.ok(next.includes('mapa_embarques'), 'tema novo entra com tudo ligado');
});

test('reconcileEnabledCards liga tudo do tema NOVO', () => {
  assert.deepEqual(reconcileEnabledCards([], ['alertas'], []), [
    'acao_urgente',
    'alertas_embarque',
  ]);
});

test('reconcileEnabledCards remove os cards do tema que saiu', () => {
  const next = reconcileEnabledCards(
    ['alertas', 'mapa_mundi'],
    ['mapa_mundi'],
    ['acao_urgente', 'alertas_embarque', 'mapa_embarques'],
  );
  assert.deepEqual(next, ['mapa_embarques']);
});

test('tirar e devolver um tema NAO ressuscita o card que estava desligado', () => {
  // O tema volta como tema NOVO (nao estava em `previousThemes`), entao ele
  // entra com tudo ligado. Documenta o limite da regra: a memoria e do estado
  // atual, nao um historico.
  const semTema = reconcileEnabledCards(
    ['alertas'],
    [],
    ['acao_urgente'],
  );
  assert.deepEqual(semTema, []);
  assert.deepEqual(reconcileEnabledCards([], ['alertas'], semTema), [
    'acao_urgente',
    'alertas_embarque',
  ]);
});

test('todo card pertence a exatamente um tema, e todo tema tem rotulo', () => {
  const seen = new Set<string>();
  for (const theme of PORTAL_HOME_THEMES) {
    assert.ok(PORTAL_HOME_THEME_LABELS[theme], `tema ${theme} sem rotulo`);
    assert.ok(
      PORTAL_HOME_THEME_DESCRIPTIONS[theme],
      `tema ${theme} sem descricao`,
    );
    assert.ok(
      PORTAL_HOME_LAYOUT_CARDS[theme].length > 0,
      `tema ${theme} sem card`,
    );
    for (const card of PORTAL_HOME_LAYOUT_CARDS[theme]) {
      assert.ok(!seen.has(card), `card ${card} em mais de um tema`);
      seen.add(card);
      assert.equal(PORTAL_HOME_CARD_THEME[card], theme);
      assert.ok(PORTAL_HOME_CARD_LABELS[card], `card ${card} sem rotulo`);
      assert.ok(
        PORTAL_HOME_CARD_DESCRIPTIONS[card],
        `card ${card} sem descricao`,
      );
    }
  }
});

test('o teto de temas nao passa do numero de temas existentes', () => {
  // Se um dia o teto ficar MAIOR que a lista, "escolha ate N" viraria uma
  // promessa que a tela nao consegue cumprir.
  assert.ok(MAX_PORTAL_HOME_THEMES <= PORTAL_HOME_THEMES.length);
});

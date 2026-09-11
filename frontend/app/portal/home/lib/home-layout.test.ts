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
  PORTAL_HOME_THEME_QUESTIONS,
  cardsForThemes,
  knownThemes,
  layoutRows,
  reconcileEnabledCards,
  visibleCards,
  type PortalHomeTheme,
} from './home-layout.ts';

test('cardsForThemes devolve os cards do tema escolhido, so eles', () => {
  assert.deepEqual(cardsForThemes(['mapa']), ['mapa_embarques']);
  assert.deepEqual(cardsForThemes(['custos']), ['economia', 'tendencia_preco']);
  assert.deepEqual(cardsForThemes(['acao']), ['acao_urgente']);
});

test('cardsForThemes sem tema nenhum devolve lista vazia', () => {
  assert.deepEqual(cardsForThemes([]), []);
});

test('a ordem e a dos TEMAS, nao a da escolha do cliente', () => {
  // Duas contas com os mesmos temas tem de ver a mesma Home.
  assert.deepEqual(
    cardsForThemes(['custos', 'acao']),
    cardsForThemes(['acao', 'custos']),
  );
  assert.deepEqual(cardsForThemes(['custos', 'acao']), [
    'acao_urgente',
    'economia',
    'tendencia_preco',
  ]);
});

test('os tres temas juntos dao os quatro cards, sem repeticao', () => {
  const all = cardsForThemes(['acao', 'mapa', 'custos']);
  assert.equal(all.length, 4);
  assert.equal(new Set(all).size, 4);
  assert.deepEqual(all, [
    'acao_urgente',
    'mapa_embarques',
    'economia',
    'tendencia_preco',
  ]);
});

test('visibleCards desenha so o que esta habilitado', () => {
  assert.deepEqual(visibleCards(['acao'], ['acao_urgente']), ['acao_urgente']);
});

test('visibleCards descarta card orfao de tema', () => {
  // A janela entre o cliente tirar um tema e o PUT voltar: sem este filtro a
  // tela desenharia por um instante o card do tema que acabou de sair.
  assert.deepEqual(
    visibleCards(['acao'], ['acao_urgente', 'mapa_embarques']),
    ['acao_urgente'],
  );
});

test('visibleCards com tudo desligado devolve lista vazia, nao os cards do tema', () => {
  // "Escolhi temas e desliguei tudo" e um estado legitimo, diferente de "nunca
  // escolhi" — e a tela tem um vazio proprio para ele.
  assert.deepEqual(visibleCards(['acao', 'mapa'], []), []);
});

test('reconcileEnabledCards preserva o que o cliente desligou num tema que fica', () => {
  const next = reconcileEnabledCards(
    ['custos'],
    ['custos', 'mapa'],
    ['economia'], // "tendencia_preco" estava DESLIGADO
  );
  assert.ok(!next.includes('tendencia_preco'), 'o card desligado voltou sozinho');
  assert.ok(next.includes('economia'));
  assert.ok(next.includes('mapa_embarques'), 'tema novo entra com tudo ligado');
});

test('reconcileEnabledCards liga tudo do tema NOVO', () => {
  assert.deepEqual(reconcileEnabledCards([], ['custos'], []), [
    'economia',
    'tendencia_preco',
  ]);
});

test('reconcileEnabledCards remove os cards do tema que saiu', () => {
  const next = reconcileEnabledCards(
    ['acao', 'mapa'],
    ['mapa'],
    ['acao_urgente', 'mapa_embarques'],
  );
  assert.deepEqual(next, ['mapa_embarques']);
});

test('tirar e devolver um tema NAO ressuscita o card que estava desligado', () => {
  // O tema volta como tema NOVO (nao estava em `previousThemes`), entao ele
  // entra com tudo ligado. Documenta o limite da regra: a memoria e do estado
  // atual, nao um historico.
  const semTema = reconcileEnabledCards(['custos'], [], ['economia']);
  assert.deepEqual(semTema, []);
  assert.deepEqual(reconcileEnabledCards([], ['custos'], semTema), [
    'economia',
    'tendencia_preco',
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
      PORTAL_HOME_THEME_QUESTIONS[theme],
      `tema ${theme} sem a pergunta que ele responde`,
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

test('knownThemes descarta o vocabulario aposentado', () => {
  // Os temas se chamavam assim ate 11/09/2026. Uma linha gravada com eles nao
  // pode virar uma Home vazia sem saida — ela tem de reabrir o onboarding, e e
  // `themes.length === 0` que a pagina le para isso.
  assert.deepEqual(knownThemes(['alertas', 'mapa_mundi', 'inteligencia']), []);
});

test('knownThemes preserva a ordem e mantem o que ainda vale', () => {
  assert.deepEqual(knownThemes(['inteligencia', 'mapa', 'acao']), [
    'mapa',
    'acao',
  ]);
});

test('knownThemes aguenta lixo no lugar de string', () => {
  assert.deepEqual(knownThemes([null, 42, {}, 'acao', undefined]), ['acao']);
});

test('nenhum rotulo de tema colide com um item da sidebar', () => {
  // "Inteligência" era um dos temas e saiu por isto: o mesmo nome em dois
  // lugares faz o cliente esperar que escolher o tema o leve aquela aba.
  const sidebar = [
    'Início',
    'Visão Geral',
    'Minhas Cotações',
    'Meus Embarques',
    'Inteligência',
    'Auditoria',
    'Minhas Preferências',
  ].map((item) => item.toLowerCase());

  for (const theme of PORTAL_HOME_THEMES) {
    assert.ok(
      !sidebar.includes(PORTAL_HOME_THEME_LABELS[theme].toLowerCase()),
      `o rotulo do tema ${theme} colide com um item da sidebar`,
    );
  }
});

test('layoutRows preserva a ordem e nao perde nenhum card', () => {
  const cards = cardsForThemes(['acao', 'mapa', 'custos']);
  assert.deepEqual(layoutRows(cards).flat(), cards);
});

test('layoutRows: card de largura inteira fica sozinho na fileira', () => {
  assert.deepEqual(layoutRows(['acao_urgente', 'mapa_embarques']), [
    ['acao_urgente'],
    ['mapa_embarques'],
  ]);
});

test('layoutRows pareia duas metades consecutivas', () => {
  assert.deepEqual(layoutRows(['economia', 'tendencia_preco']), [
    ['economia', 'tendencia_preco'],
  ]);
});

test('metade orfa vira fileira de item unico, e nao meia tela vazia', () => {
  // Entrada SINTETICA: com a tabela de cards de hoje nenhuma combinacao de
  // temas produz metade orfa (as duas metades vivem no mesmo tema e sao
  // adjacentes). O caso ja aconteceu de verdade — foi o `farol_resumido`,
  // entre dois cards de largura inteira, que motivou esta funcao — e o proximo
  // card meia-largura num tema de numero impar o reabre em silencio.
  assert.deepEqual(layoutRows(['economia', 'mapa_embarques']), [
    ['economia'],
    ['mapa_embarques'],
  ]);
});

test('os tres temas ligados nao deixam nenhuma metade orfa hoje', () => {
  assert.deepEqual(layoutRows(cardsForThemes(['acao', 'mapa', 'custos'])), [
    ['acao_urgente'],
    ['mapa_embarques'],
    ['economia', 'tendencia_preco'],
  ]);
});

test('nenhuma fileira passa de duas colunas, em qualquer combinacao de temas', () => {
  const combos: PortalHomeTheme[][] = [
    ['acao'],
    ['mapa'],
    ['custos'],
    ['acao', 'mapa'],
    ['acao', 'custos'],
    ['mapa', 'custos'],
    ['acao', 'mapa', 'custos'],
  ];
  for (const themes of combos) {
    for (const row of layoutRows(cardsForThemes(themes))) {
      assert.ok(row.length >= 1 && row.length <= 2, `fileira de ${row.length}`);
    }
  }
});
